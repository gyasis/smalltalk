/**
 * RedisStorageAdapter - Redis-based storage implementation
 *
 * Implements StorageAdapter interface using Redis for high-performance storage.
 * Leverages Redis pipelining for batch operations and native TTL support.
 *
 * Storage Structure:
 * - Session keys: session:{sessionId} (Redis Hash)
 * - KV keys: kv:{key} (Redis String)
 * - TTL support via EXPIRE command
 *
 * Performance Optimizations:
 * - Pipeline API for batch operations (MGET, MSET, DEL)
 * - Connection pooling via ioredis
 * - Minimal serialization overhead (JSON only)
 *
 * @see specs/001-production-robustness/contracts/StorageAdapter.contract.ts
 * @see specs/001-production-robustness/spec.md FR-001 to FR-005, FR-022 to FR-026
 */

import Redis, { RedisOptions } from 'ioredis';
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

/**
 * RedisStorageAdapter implementation
 */
export class RedisStorageAdapter implements StorageAdapter {
  private client: Redis | null = null;
  private initialized: boolean = false;
  private config: RedisOptions;

  // Key prefixes
  private readonly SESSION_PREFIX = 'session:';
  private readonly KV_PREFIX = 'kv:';

  // Default TTL (7 days in seconds)
  private readonly DEFAULT_TTL = 7 * 24 * 60 * 60;

  /**
   * Create RedisStorageAdapter instance
   *
   * @param config Redis connection configuration
   */
  constructor(config?: Partial<RedisOptions>) {
    this.config = {
      host: config?.host || 'localhost',
      port: config?.port || 6379,
      password: config?.password,
      db: config?.db || 0,
      retryStrategy: (times) => {
        // Exponential backoff with max delay of 3 seconds
        const delay = Math.min(times * 50, 3000);
        return delay;
      },
      ...config,
    };
  }

  /**
   * Initialize Redis connection
   *
   * FR-001: System restores multi-agent conversations after restart
   * FR-005: System supports pluggable storage adapters
   * FR-053: Readiness probe checks this initialization
   */
  async initialize(config?: StorageAdapterConfig): Promise<void> {
    try {
      // Create Redis client
      this.client = new Redis(this.config);

      // Test connection with PING
      await this.client.ping();

      this.initialized = true;
    } catch (error) {
      throw new StorageError(
        `Failed to initialize RedisStorageAdapter: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Close Redis connection and cleanup resources
   *
   * FR-054: Called during graceful shutdown
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
    this.initialized = false;
  }

  /**
   * Health check for readiness probe
   *
   * FR-053: Readiness probe checks storage health
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.initialized || !this.client) {
      return {
        healthy: false,
        message: 'Redis client not initialized',
      };
    }

    try {
      // PING command to verify connection
      await this.client.ping();
      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        message: `Redis health check failed: ${(error as Error).message}`,
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
   * Save session to Redis
   *
   * FR-002: Serialize agent conversation state to persistent storage
   * SC-009: State serialization completes in under 50ms (p95)
   *
   * Uses Redis Hash (HSET) for session storage with TTL.
   */
  async saveSession(session: Session): Promise<void> {
    if (!this.client) {
      throw new StorageError('Redis client not initialized');
    }

    try {
      const key = this.SESSION_PREFIX + session.id;
      const serialized = this.serializeSession(session);

      // Store session data in hash
      await this.client.hset(key, 'data', serialized);

      // Store metadata for fast filtering
      await this.client.hset(key, 'state', session.state);
      await this.client.hset(key, 'updatedAt', session.updatedAt.getTime().toString());
      await this.client.hset(key, 'agentCount', session.agentIds.length.toString());

      // Set TTL if expiresAt is set
      const ttl = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000);
      if (ttl > 0) {
        await this.client.expire(key, ttl);
      }
    } catch (error) {
      throw new StorageError(
        `Failed to save session ${session.id}: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Save multiple sessions using Redis pipeline
   *
   * Performance optimization using Redis pipelining.
   */
  async saveSessions(sessions: Session[]): Promise<number> {
    if (sessions.length === 0) {
      return 0;
    }

    if (!this.client) {
      throw new StorageError('Redis client not initialized');
    }

    try {
      const pipeline = this.client.pipeline();

      for (const session of sessions) {
        const key = this.SESSION_PREFIX + session.id;
        const serialized = this.serializeSession(session);

        // Add commands to pipeline
        pipeline.hset(key, 'data', serialized);
        pipeline.hset(key, 'state', session.state);
        pipeline.hset(key, 'updatedAt', session.updatedAt.getTime().toString());
        pipeline.hset(key, 'agentCount', session.agentIds.length.toString());

        // Set TTL
        const ttl = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000);
        if (ttl > 0) {
          pipeline.expire(key, ttl);
        }
      }

      // Execute pipeline
      await pipeline.exec();

      return sessions.length;
    } catch (error) {
      throw new StorageError(
        `Failed to save sessions batch: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Get session from Redis
   *
   * FR-003: Restore conversation state from session ID
   * SC-007: Session restoration completes in under 100ms (p95)
   */
  async getSession(sessionId: string): Promise<Session | null> {
    if (!this.client) {
      throw new StorageError('Redis client not initialized');
    }

    try {
      const key = this.SESSION_PREFIX + sessionId;

      // Get session data from hash
      const data = await this.client.hget(key, 'data');

      if (!data) {
        return null;
      }

      // Deserialize
      return this.deserializeSession(data);
    } catch (error) {
      throw new StorageError(
        `Failed to get session ${sessionId}: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Get multiple sessions using Redis pipeline
   *
   * Performance optimization using Redis pipelining.
   */
  async getSessions(sessionIds: string[]): Promise<Map<string, Session>> {
    const results = new Map<string, Session>();

    if (sessionIds.length === 0) {
      return results;
    }

    if (!this.client) {
      throw new StorageError('Redis client not initialized');
    }

    try {
      const pipeline = this.client.pipeline();

      // Add HGET commands to pipeline
      for (const id of sessionIds) {
        const key = this.SESSION_PREFIX + id;
        pipeline.hget(key, 'data');
      }

      // Execute pipeline
      const pipelineResults = await pipeline.exec();

      if (!pipelineResults) {
        return results;
      }

      // Process results
      pipelineResults.forEach((result, index) => {
        const [error, data] = result;
        if (!error && data) {
          const session = this.deserializeSession(data as string);
          results.set(sessionIds[index], session);
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
   * Delete session from Redis
   *
   * FR-004a: Session invalidation with cleanup
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    if (!this.client) {
      throw new StorageError('Redis client not initialized');
    }

    try {
      const key = this.SESSION_PREFIX + sessionId;

      // DEL returns number of keys deleted (0 or 1)
      const deleted = await this.client.del(key);

      return deleted > 0;
    } catch (error) {
      throw new StorageError(
        `Failed to delete session ${sessionId}: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Delete multiple sessions using Redis pipeline
   *
   * Performance optimization using Redis pipelining.
   */
  async deleteSessions(sessionIds: string[]): Promise<number> {
    if (sessionIds.length === 0) {
      return 0;
    }

    if (!this.client) {
      throw new StorageError('Redis client not initialized');
    }

    try {
      const pipeline = this.client.pipeline();

      // Add DEL commands to pipeline
      for (const id of sessionIds) {
        const key = this.SESSION_PREFIX + id;
        pipeline.del(key);
      }

      // Execute pipeline
      const results = await pipeline.exec();

      if (!results) {
        return 0;
      }

      // Count successful deletions
      return results.filter(([error, deleted]) => !error && (deleted as number) > 0).length;
    } catch (error) {
      throw new StorageError(
        `Failed to delete sessions batch: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * List sessions matching filter
   *
   * Returns session IDs with metadata.
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
    if (!this.client) {
      throw new StorageError('Redis client not initialized');
    }

    try {
      // Scan for all session keys
      const keys: string[] = [];
      let cursor = '0';

      do {
        const [nextCursor, scannedKeys] = await this.client.scan(
          cursor,
          'MATCH',
          this.SESSION_PREFIX + '*',
          'COUNT',
          100
        );
        cursor = nextCursor;
        keys.push(...scannedKeys);
      } while (cursor !== '0');

      // Build pipeline to get metadata
      const pipeline = this.client.pipeline();
      for (const key of keys) {
        pipeline.hmget(key, 'state', 'updatedAt', 'agentCount');
      }

      const results = await pipeline.exec();

      if (!results) {
        return [];
      }

      // Build session list
      const sessions: Array<{
        id: string;
        state: SessionState;
        updatedAt: Date;
        agentCount?: number;
      }> = [];

      results.forEach((result, index) => {
        const [error, data] = result;
        if (!error && data && Array.isArray(data)) {
          const [sessionState, updatedAtStr, agentCountStr] = data;

          // Skip if state doesn't match filter
          if (state !== undefined && sessionState !== state) {
            return;
          }

          sessions.push({
            id: keys[index].replace(this.SESSION_PREFIX, ''),
            state: sessionState as SessionState,
            updatedAt: new Date(parseInt(updatedAtStr, 10)),
            agentCount: agentCountStr ? parseInt(agentCountStr, 10) : undefined,
          });
        }
      });

      // Sort by updatedAt DESC
      sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      // Apply pagination
      const startIndex = offset || 0;
      const endIndex = limit ? startIndex + limit : sessions.length;

      return sessions.slice(startIndex, endIndex);
    } catch (error) {
      throw new StorageError(
        `Failed to list sessions: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Check if session exists in Redis
   */
  async hasSession(sessionId: string): Promise<boolean> {
    if (!this.client) {
      throw new StorageError('Redis client not initialized');
    }

    try {
      const key = this.SESSION_PREFIX + sessionId;

      // EXISTS returns 1 if key exists, 0 otherwise
      const exists = await this.client.exists(key);

      return exists > 0;
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
   * FR-022: System supports persistent storage adapters for agent state
   * Values must be JSON-serializable.
   */
  async setValue(key: string, value: any): Promise<void> {
    if (!this.client) {
      throw new StorageError('Redis client not initialized');
    }

    try {
      const redisKey = this.KV_PREFIX + key;
      const serialized = JSON.stringify(value);

      await this.client.set(redisKey, serialized);
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
    if (!this.client) {
      throw new StorageError('Redis client not initialized');
    }

    try {
      const redisKey = this.KV_PREFIX + key;

      const data = await this.client.get(redisKey);

      if (!data) {
        return null;
      }

      return JSON.parse(data) as T;
    } catch (error) {
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
    if (!this.client) {
      throw new StorageError('Redis client not initialized');
    }

    try {
      const redisKey = this.KV_PREFIX + key;

      const deleted = await this.client.del(redisKey);

      return deleted > 0;
    } catch (error) {
      throw new StorageError(
        `Failed to delete value for key ${key}: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Check if key exists in Redis
   */
  async hasValue(key: string): Promise<boolean> {
    if (!this.client) {
      throw new StorageError('Redis client not initialized');
    }

    try {
      const redisKey = this.KV_PREFIX + key;

      const exists = await this.client.exists(redisKey);

      return exists > 0;
    } catch (error) {
      throw new StorageError(
        `Failed to check key existence ${key}: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Clear data from Redis
   *
   * FR-004: System implements session expiration policies
   * Used for cleanup of expired sessions and old data.
   *
   * @param olderThan Optional Date - clear sessions with updatedAt older than this.
   *                  If not provided, clears ALL sessions.
   * @returns Number of sessions cleared
   */
  async clear(olderThan?: Date): Promise<number> {
    if (!this.client) {
      throw new StorageError('Redis client not initialized');
    }

    try {
      // Scan for all session keys
      const keys: string[] = [];
      let cursor = '0';

      do {
        const [nextCursor, scannedKeys] = await this.client.scan(
          cursor,
          'MATCH',
          this.SESSION_PREFIX + '*',
          'COUNT',
          100
        );
        cursor = nextCursor;
        keys.push(...scannedKeys);
      } while (cursor !== '0');

      let keysToDelete: string[] = [];

      if (olderThan === undefined) {
        // Delete all sessions
        keysToDelete = keys;
      } else {
        // Filter by date
        const pipeline = this.client.pipeline();
        for (const key of keys) {
          pipeline.hget(key, 'updatedAt');
        }

        const results = await pipeline.exec();

        if (results) {
          results.forEach((result, index) => {
            const [error, updatedAtStr] = result;
            if (!error && updatedAtStr) {
              const updatedAt = new Date(parseInt(updatedAtStr as string, 10));
              if (updatedAt < olderThan) {
                keysToDelete.push(keys[index]);
              }
            }
          });
        }
      }

      // Delete keys
      if (keysToDelete.length > 0) {
        await this.client.del(...keysToDelete);
      }

      return keysToDelete.length;
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
    if (!this.client) {
      throw new StorageError('Redis client not initialized');
    }

    try {
      // Scan for all session keys
      const keys: string[] = [];
      let cursor = '0';

      do {
        const [nextCursor, scannedKeys] = await this.client.scan(
          cursor,
          'MATCH',
          this.SESSION_PREFIX + '*',
          'COUNT',
          100
        );
        cursor = nextCursor;
        keys.push(...scannedKeys);
      } while (cursor !== '0');

      // Get memory usage
      const info = await this.client.info('memory');
      const usedMemoryMatch = info.match(/used_memory:(\d+)/);
      const usedMemory = usedMemoryMatch ? parseInt(usedMemoryMatch[1], 10) : 0;

      // Count sessions by state
      const pipeline = this.client.pipeline();
      for (const key of keys) {
        pipeline.hget(key, 'state');
      }

      const results = await pipeline.exec();

      const stateCounts: Record<string, number> = {
        active: 0,
        paused: 0,
        expired: 0,
        invalidated_pending_cleanup: 0,
        closed: 0,
      };

      if (results) {
        results.forEach((result) => {
          const [error, state] = result;
          if (!error && state) {
            stateCounts[state as string] = (stateCounts[state as string] || 0) + 1;
          }
        });
      }

      return {
        totalSessions: keys.length,
        sizeBytes: usedMemory,
        backendType: 'redis',
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
}
