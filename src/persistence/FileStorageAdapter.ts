/**
 * FileStorageAdapter - File-based storage implementation
 *
 * Implements StorageAdapter interface using JSON files on disk.
 * Supports gzip compression for sessions >100KB.
 * Enforces file permissions (chmod 600) for security.
 *
 * Storage Structure:
 * - data/sessions/{sessionId}.json       (if <100KB)
 * - data/sessions/{sessionId}.json.gz    (if >100KB, compressed)
 * - data/kv/{key}.json                   (key-value storage)
 *
 * @see specs/001-production-robustness/contracts/StorageAdapter.contract.ts
 * @see specs/001-production-robustness/spec.md FR-001 to FR-005, FR-034a, FR-009a
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as zlib from 'zlib';
import { promisify } from 'util';
import {
  Session,
  SessionState,
  SessionSerializer,
  StorageError,
  NotFoundError,
  ConflictError,
} from '../types/robustness';
import {
  StorageAdapter,
  StorageAdapterConfig,
  StorageStats,
} from '../../specs/001-production-robustness/contracts/StorageAdapter.contract';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

/**
 * FileStorageAdapter implementation
 */
export class FileStorageAdapter implements StorageAdapter {
  private basePath: string;
  private sessionsPath: string;
  private kvPath: string;
  private initialized: boolean = false;

  // Constants
  private readonly GZIP_THRESHOLD = 100 * 1024; // 100KB
  private readonly FILE_PERMISSIONS = 0o600; // Owner read/write only
  private readonly DIR_PERMISSIONS = 0o700; // Owner full access only

  /**
   * Create FileStorageAdapter instance
   *
   * @param basePath Base directory for storage (default: 'data/sessions')
   */
  constructor(basePath: string = 'data/sessions') {
    this.basePath = basePath;
    this.sessionsPath = path.join(basePath, 'sessions');
    this.kvPath = path.join(basePath, 'kv');
  }

  /**
   * Initialize storage directories
   *
   * FR-001: System restores multi-agent conversations after restart
   * FR-005: System supports pluggable storage adapters
   * FR-053: Readiness probe checks this initialization
   */
  async initialize(config?: StorageAdapterConfig): Promise<void> {
    try {
      // Update paths if location provided in config
      if (config?.location) {
        this.basePath = config.location;
        this.sessionsPath = path.join(config.location, 'sessions');
        this.kvPath = path.join(config.location, 'kv');
      }

      // Create directories with restrictive permissions
      await fs.mkdir(this.sessionsPath, {
        recursive: true,
        mode: this.DIR_PERMISSIONS,
      });
      await fs.mkdir(this.kvPath, {
        recursive: true,
        mode: this.DIR_PERMISSIONS,
      });

      this.initialized = true;
    } catch (error) {
      throw new StorageError(
        `Failed to initialize FileStorageAdapter: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Close storage connection and cleanup resources
   *
   * FR-054: Called during graceful shutdown
   */
  async close(): Promise<void> {
    // No-op for file adapter (no connections to close)
    this.initialized = false;
  }

  /**
   * Health check for readiness probe
   *
   * FR-053: Readiness probe checks storage health
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.initialized) {
      return {
        healthy: false,
        message: 'Storage not initialized',
      };
    }

    try {
      // Verify directories are accessible
      await fs.access(this.sessionsPath, fs.constants.R_OK | fs.constants.W_OK);
      await fs.access(this.kvPath, fs.constants.R_OK | fs.constants.W_OK);

      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        message: `Storage health check failed: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Serialize session to storage format
   *
   * Uses SessionSerializer.toJSON() for consistent JSON serialization.
   */
  serializeSession(session: Session): string {
    return SessionSerializer.toJSON(session);
  }

  /**
   * Deserialize session from storage format
   *
   * Uses SessionSerializer.fromJSON() for consistent JSON deserialization.
   */
  deserializeSession(data: string): Session {
    return SessionSerializer.fromJSON(data);
  }

  /**
   * Save session to storage with atomic write and gzip compression
   *
   * FR-002: Serialize agent conversation state to persistent storage
   * FR-009a: Gzip compression if state >100KB
   * FR-034a: File permissions chmod 600 (owner read/write only)
   * SC-009: State serialization completes in under 50ms (p95)
   */
  async saveSession(session: Session): Promise<void> {
    try {
      // Serialize session
      const serialized = this.serializeSession(session);
      const sizeBytes = Buffer.byteLength(serialized, 'utf8');

      // Determine file path and apply compression if needed
      const baseFilePath = path.join(this.sessionsPath, `${session.id}.json`);
      const gzFilePath = `${baseFilePath}.gz`;

      if (sizeBytes > this.GZIP_THRESHOLD) {
        // Apply gzip compression
        const compressed = await gzip(Buffer.from(serialized, 'utf8'));
        await this.atomicWrite(gzFilePath, compressed);

        // Remove uncompressed version if it exists
        try {
          await fs.unlink(baseFilePath);
        } catch (error) {
          // Ignore if file doesn't exist
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
          }
        }
      } else {
        // Save uncompressed
        await this.atomicWrite(baseFilePath, serialized);

        // Remove compressed version if it exists
        try {
          await fs.unlink(gzFilePath);
        } catch (error) {
          // Ignore if file doesn't exist
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
          }
        }
      }
    } catch (error) {
      throw new StorageError(
        `Failed to save session ${session.id}: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Save multiple sessions in batch
   *
   * Performance optimization using parallel Promise.all.
   */
  async saveSessions(sessions: Session[]): Promise<number> {
    if (sessions.length === 0) {
      return 0;
    }

    try {
      await Promise.all(sessions.map((session) => this.saveSession(session)));
      return sessions.length;
    } catch (error) {
      throw new StorageError(
        `Failed to save sessions batch: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Get session from storage
   *
   * FR-003: Restore conversation state from session ID
   * SC-007: Session restoration completes in under 100ms (p95)
   */
  async getSession(sessionId: string): Promise<Session | null> {
    try {
      const baseFilePath = path.join(this.sessionsPath, `${sessionId}.json`);
      const gzFilePath = `${baseFilePath}.gz`;

      // Check which file exists
      let filePath: string;
      let isCompressed = false;

      try {
        await fs.access(gzFilePath);
        filePath = gzFilePath;
        isCompressed = true;
      } catch {
        try {
          await fs.access(baseFilePath);
          filePath = baseFilePath;
        } catch {
          // Neither file exists
          return null;
        }
      }

      // Read file
      const data = await fs.readFile(filePath);

      // Decompress if needed
      let serialized: string;
      if (isCompressed) {
        const decompressed = await gunzip(data);
        serialized = decompressed.toString('utf8');
      } else {
        serialized = data.toString('utf8');
      }

      // Deserialize
      return this.deserializeSession(serialized);
    } catch (error) {
      // Return null for ENOENT, throw for other errors
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw new StorageError(
        `Failed to get session ${sessionId}: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Get multiple sessions in batch
   *
   * Performance optimization using parallel retrieval.
   */
  async getSessions(sessionIds: string[]): Promise<Map<string, Session>> {
    const results = new Map<string, Session>();

    try {
      const sessions = await Promise.all(
        sessionIds.map(async (id) => {
          const session = await this.getSession(id);
          return { id, session };
        })
      );

      // Build map, excluding null results
      sessions.forEach(({ id, session }) => {
        if (session !== null) {
          results.set(id, session);
        }
      });

      return results;
    } catch (error) {
      throw new StorageError(
        `Failed to get sessions batch: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Delete session from storage
   *
   * FR-004a: Session invalidation with cleanup
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const baseFilePath = path.join(this.sessionsPath, `${sessionId}.json`);
      const gzFilePath = `${baseFilePath}.gz`;

      let deleted = false;

      // Try deleting both compressed and uncompressed versions
      try {
        await fs.unlink(gzFilePath);
        deleted = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }

      try {
        await fs.unlink(baseFilePath);
        deleted = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }

      return deleted;
    } catch (error) {
      throw new StorageError(
        `Failed to delete session ${sessionId}: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Delete multiple sessions in batch
   *
   * Performance optimization using parallel deletion.
   */
  async deleteSessions(sessionIds: string[]): Promise<number> {
    try {
      const results = await Promise.all(
        sessionIds.map((id) => this.deleteSession(id))
      );

      // Count successful deletions
      return results.filter((deleted) => deleted).length;
    } catch (error) {
      throw new StorageError(
        `Failed to delete sessions batch: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * List session IDs and metadata matching filter
   *
   * Returns session IDs with optional metadata.
   * Supports filtering by state, pagination with limit/offset.
   * Results ordered by updatedAt DESC (most recent first).
   */
  async listSessions(
    state?: SessionState,
    limit?: number,
    offset?: number
  ): Promise<
    Array<{
      id: string;
      state: SessionState;
      updatedAt: Date;
      agentCount?: number;
    }>
  > {
    try {
      // Read all session files
      const files = await fs.readdir(this.sessionsPath);
      const sessionFiles = files.filter(
        (f) => f.endsWith('.json') || f.endsWith('.json.gz')
      );

      // Extract session IDs (remove extensions)
      const sessionIds = Array.from(
        new Set(
          sessionFiles.map((f) =>
            f.replace(/\.json(\.gz)?$/, '')
          )
        )
      );

      // Load sessions and build metadata array
      const sessions = await Promise.all(
        sessionIds.map(async (id) => {
          const session = await this.getSession(id);
          if (!session) return null;

          return {
            id: session.id,
            state: session.state,
            updatedAt: session.updatedAt,
            agentCount: session.agentIds.length,
          };
        })
      );

      // Filter out nulls
      let results = sessions.filter((s) => s !== null) as Array<{
        id: string;
        state: SessionState;
        updatedAt: Date;
        agentCount?: number;
      }>;

      // Filter by state if provided
      if (state !== undefined) {
        results = results.filter((s) => s.state === state);
      }

      // Sort by updatedAt DESC (most recent first)
      results.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      // Apply pagination
      const startIndex = offset || 0;
      const endIndex = limit ? startIndex + limit : results.length;
      results = results.slice(startIndex, endIndex);

      return results;
    } catch (error) {
      throw new StorageError(
        `Failed to list sessions: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Check if session exists in storage
   */
  async hasSession(sessionId: string): Promise<boolean> {
    try {
      const baseFilePath = path.join(this.sessionsPath, `${sessionId}.json`);
      const gzFilePath = `${baseFilePath}.gz`;

      // Check if either file exists
      try {
        await fs.access(gzFilePath);
        return true;
      } catch {
        try {
          await fs.access(baseFilePath);
          return true;
        } catch {
          return false;
        }
      }
    } catch (error) {
      throw new StorageError(
        `Failed to check session existence ${sessionId}: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Store arbitrary key-value data
   *
   * Used for metadata storage (health status, event replay policies, etc.)
   * Values must be JSON-serializable.
   * Files stored with chmod 600 permissions.
   */
  async setValue(key: string, value: any): Promise<void> {
    try {
      // Sanitize key to prevent path traversal
      const sanitizedKey = this.sanitizeKey(key);
      const filePath = path.join(this.kvPath, `${sanitizedKey}.json`);

      // Serialize value
      const serialized = JSON.stringify(value);

      // Atomic write with permissions
      await this.atomicWrite(filePath, serialized);
    } catch (error) {
      throw new StorageError(
        `Failed to set value for key ${key}: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Retrieve key-value data
   */
  async getValue<T = any>(key: string): Promise<T | null> {
    try {
      const sanitizedKey = this.sanitizeKey(key);
      const filePath = path.join(this.kvPath, `${sanitizedKey}.json`);

      // Read file
      const data = await fs.readFile(filePath, 'utf8');

      // Parse JSON
      return JSON.parse(data) as T;
    } catch (error) {
      // Return null for ENOENT, throw for other errors
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw new StorageError(
        `Failed to get value for key ${key}: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Delete key-value data
   */
  async deleteValue(key: string): Promise<boolean> {
    try {
      const sanitizedKey = this.sanitizeKey(key);
      const filePath = path.join(this.kvPath, `${sanitizedKey}.json`);

      await fs.unlink(filePath);
      return true;
    } catch (error) {
      // Return false for ENOENT, throw for other errors
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }
      throw new StorageError(
        `Failed to delete value for key ${key}: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Check if key exists in storage
   */
  async hasValue(key: string): Promise<boolean> {
    try {
      const sanitizedKey = this.sanitizeKey(key);
      const filePath = path.join(this.kvPath, `${sanitizedKey}.json`);

      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear data from storage
   *
   * FR-004: System implements session expiration policies
   * Used for cleanup of expired sessions and old data.
   *
   * @param olderThan Optional Date - clear sessions with updatedAt older than this.
   *                  If not provided, clears ALL sessions.
   * @returns Number of sessions cleared
   */
  async clear(olderThan?: Date): Promise<number> {
    try {
      const files = await fs.readdir(this.sessionsPath);
      const sessionFiles = files.filter(
        (f) => f.endsWith('.json') || f.endsWith('.json.gz')
      );

      // Extract unique session IDs
      const sessionIds = Array.from(
        new Set(
          sessionFiles.map((f) => f.replace(/\.json(\.gz)?$/, ''))
        )
      );

      let deletedCount = 0;

      if (olderThan === undefined) {
        // Delete all sessions
        deletedCount = await this.deleteSessions(sessionIds);
      } else {
        // Filter sessions by date
        const sessionsToDelete: string[] = [];

        for (const id of sessionIds) {
          const session = await this.getSession(id);
          if (session && session.updatedAt < olderThan) {
            sessionsToDelete.push(id);
          }
        }

        deletedCount = await this.deleteSessions(sessionsToDelete);
      }

      return deletedCount;
    } catch (error) {
      throw new StorageError(
        `Failed to clear storage: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Get storage statistics
   *
   * FR-037: System provides session count metrics
   */
  async getStats(): Promise<StorageStats> {
    try {
      const files = await fs.readdir(this.sessionsPath);
      const sessionFiles = files.filter(
        (f) => f.endsWith('.json') || f.endsWith('.json.gz')
      );

      // Extract unique session IDs
      const sessionIds = Array.from(
        new Set(
          sessionFiles.map((f) => f.replace(/\.json(\.gz)?$/, ''))
        )
      );

      // Calculate total size
      let totalSize = 0;
      const stateCounts: Record<string, number> = {
        active: 0,
        paused: 0,
        expired: 0,
        invalidated_pending_cleanup: 0,
        closed: 0,
      };

      for (const file of sessionFiles) {
        const filePath = path.join(this.sessionsPath, file);
        const stat = await fs.stat(filePath);
        totalSize += stat.size;

        // Count by state
        const sessionId = file.replace(/\.json(\.gz)?$/, '');
        const session = await this.getSession(sessionId);
        if (session) {
          stateCounts[session.state] = (stateCounts[session.state] || 0) + 1;
        }
      }

      return {
        totalSessions: sessionIds.length,
        sizeBytes: totalSize,
        backendType: 'file',
        metrics: {
          activeCount: stateCounts['active'] || 0,
          pausedCount: stateCounts['paused'] || 0,
          expiredCount: stateCounts['expired'] || 0,
          invalidatedPendingCleanupCount:
            stateCounts['invalidated_pending_cleanup'] || 0,
          closedCount: stateCounts['closed'] || 0,
        },
      };
    } catch (error) {
      throw new StorageError(
        `Failed to get storage stats: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Atomic write operation to prevent corruption
   *
   * Writes to temporary file, sets permissions, then atomically renames.
   *
   * FR-034a: File permissions chmod 600 (owner read/write only)
   */
  private async atomicWrite(
    filePath: string,
    data: string | Buffer
  ): Promise<void> {
    const tempPath = `${filePath}.tmp`;

    try {
      // Write to temporary file
      await fs.writeFile(tempPath, data);

      // Set restrictive permissions (owner read/write only)
      await fs.chmod(tempPath, this.FILE_PERMISSIONS);

      // Atomic rename
      await fs.rename(tempPath, filePath);
    } catch (error) {
      // Clean up temp file on error
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }

      throw error;
    }
  }

  /**
   * Sanitize key to prevent path traversal attacks
   *
   * Removes path separators and restricts to alphanumeric + underscore/hyphen.
   */
  private sanitizeKey(key: string): string {
    // Remove path separators and special characters
    return key
      .replace(/[/\\]/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_');
  }
}
