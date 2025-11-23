/**
 * PostgresStorageAdapter - PostgreSQL-based storage implementation
 *
 * Implements StorageAdapter interface using PostgreSQL with JSONB for efficient JSON storage.
 * Features:
 * - Connection pooling for performance
 * - JSONB for efficient JSON queries
 * - Optimistic locking via version column
 * - Prepared statements for security
 * - Transactions for batch operations
 * - TTL support via timestamp columns
 *
 * Schema:
 * - sessions table: id (text PK), data (jsonb), version (int), created_at, updated_at
 * - key_value table: key (text PK), value (jsonb), ttl (timestamp), created_at
 *
 * @see specs/001-production-robustness/contracts/StorageAdapter.contract.ts
 * @see specs/001-production-robustness/spec.md FR-001 to FR-005, FR-022 to FR-026
 */

import { Pool, PoolClient, PoolConfig } from 'pg';
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
 * PostgreSQL connection configuration
 */
export interface PostgresConfig {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  connectionString?: string;
  poolSize?: number;
  ssl?: boolean;
}

/**
 * PostgresStorageAdapter implementation
 */
export class PostgresStorageAdapter implements StorageAdapter {
  private pool: Pool | null = null;
  private initialized: boolean = false;
  private config: PostgresConfig;

  // Schema SQL
  private readonly SCHEMA_SQL = `
    -- Sessions table
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    -- Index for session state queries
    CREATE INDEX IF NOT EXISTS idx_sessions_state ON sessions ((data->>'state'));

    -- Index for session updated_at queries (for expiration)
    CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions (updated_at);

    -- Key-value table
    CREATE TABLE IF NOT EXISTS key_value (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      ttl TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    -- Index for TTL queries
    CREATE INDEX IF NOT EXISTS idx_key_value_ttl ON key_value (ttl) WHERE ttl IS NOT NULL;
  `;

  /**
   * Create PostgresStorageAdapter instance
   *
   * @param config PostgreSQL connection configuration
   */
  constructor(config?: PostgresConfig) {
    this.config = config || {
      host: 'localhost',
      port: 5432,
      database: 'smalltalk',
      user: 'postgres',
      password: 'postgres',
      poolSize: 10,
    };
  }

  /**
   * Initialize storage connection and schema
   *
   * FR-001: System restores multi-agent conversations after restart
   * FR-005: System supports pluggable storage adapters
   * FR-053: Readiness probe checks this initialization
   */
  async initialize(config?: StorageAdapterConfig): Promise<void> {
    try {
      // Update config if provided
      // Note: StorageAdapterConfig.location may be a file path OR connection string
      // For PostgreSQL, we only use it if it looks like a connection string
      if (config?.location && config.location.includes('postgres://')) {
        this.config.connectionString = config.location;
      }

      // Create connection pool
      const poolConfig: PoolConfig = this.config.connectionString
        ? { connectionString: this.config.connectionString }
        : {
            host: this.config.host,
            port: this.config.port,
            database: this.config.database,
            user: this.config.user,
            password: this.config.password,
            max: this.config.poolSize || 10,
            ssl: this.config.ssl,
          };

      this.pool = new Pool(poolConfig);

      // Test connection
      const client = await this.pool.connect();

      try {
        // Create schema
        await client.query(this.SCHEMA_SQL);
        this.initialized = true;
      } finally {
        client.release();
      }
    } catch (error) {
      throw new StorageError(
        `Failed to initialize PostgresStorageAdapter: ${(error as Error).message}`,
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
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    this.initialized = false;
  }

  /**
   * Health check for readiness probe
   *
   * FR-053: Readiness probe checks storage health
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.initialized || !this.pool) {
      return {
        healthy: false,
        message: 'Storage not initialized',
      };
    }

    try {
      // Test database connectivity
      const result = await this.pool.query('SELECT 1 as health');

      if (result.rows.length > 0 && result.rows[0].health === 1) {
        return { healthy: true };
      }

      return {
        healthy: false,
        message: 'Health check query returned unexpected result',
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Database health check failed: ${(error as Error).message}`,
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
   * Save session to storage with optimistic locking
   *
   * FR-002: Serialize agent conversation state to persistent storage
   * FR-005: Optimistic locking via version column
   * SC-009: State serialization completes in under 50ms (p95)
   */
  async saveSession(session: Session): Promise<void> {
    this.ensureInitialized();

    try {
      const serialized = this.serializeSession(session);
      const data = JSON.parse(serialized);

      // Use INSERT ... ON CONFLICT for upsert with version check
      const query = `
        INSERT INTO sessions (id, data, version, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE
        SET
          data = EXCLUDED.data,
          version = EXCLUDED.version,
          updated_at = EXCLUDED.updated_at
        WHERE sessions.version = $6 OR NOT EXISTS (SELECT 1 FROM sessions WHERE id = $1)
        RETURNING id
      `;

      const values = [
        session.id,
        data,
        session.version,
        session.createdAt,
        session.updatedAt, // Use session's updatedAt timestamp
        session.version - 1, // Expected previous version for optimistic locking
      ];

      const result = await this.pool!.query(query, values);

      if (result.rowCount === 0) {
        throw new ConflictError(
          `Version conflict when saving session ${session.id}. Session may have been modified by another process.`
        );
      }
    } catch (error) {
      if (error instanceof ConflictError) {
        throw error;
      }
      throw new StorageError(
        `Failed to save session ${session.id}: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Save multiple sessions in batch with transaction
   *
   * Performance optimization using transactions.
   */
  async saveSessions(sessions: Session[]): Promise<number> {
    if (sessions.length === 0) {
      return 0;
    }

    this.ensureInitialized();

    const client = await this.pool!.connect();

    try {
      await client.query('BEGIN');

      let savedCount = 0;

      for (const session of sessions) {
        const serialized = this.serializeSession(session);
        const data = JSON.parse(serialized);

        const query = `
          INSERT INTO sessions (id, data, version, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id) DO UPDATE
          SET
            data = EXCLUDED.data,
            version = EXCLUDED.version,
            updated_at = EXCLUDED.updated_at
        `;

        const values = [
          session.id,
          data,
          session.version,
          session.createdAt,
          session.updatedAt, // Use session's updatedAt timestamp
        ];

        await client.query(query, values);
        savedCount++;
      }

      await client.query('COMMIT');
      return savedCount;
    } catch (error) {
      await client.query('ROLLBACK');
      throw new StorageError(
        `Failed to save sessions batch: ${(error as Error).message}`,
        error as Error
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get session from storage
   *
   * FR-003: Restore conversation state from session ID
   * SC-007: Session restoration completes in under 100ms (p95)
   */
  async getSession(sessionId: string): Promise<Session | null> {
    this.ensureInitialized();

    try {
      const query = 'SELECT data FROM sessions WHERE id = $1';
      const result = await this.pool!.query(query, [sessionId]);

      if (result.rows.length === 0) {
        return null;
      }

      const data = result.rows[0].data;
      const serialized = JSON.stringify(data);
      return this.deserializeSession(serialized);
    } catch (error) {
      throw new StorageError(
        `Failed to get session ${sessionId}: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Get multiple sessions in batch
   *
   * Performance optimization using IN clause.
   */
  async getSessions(sessionIds: string[]): Promise<Map<string, Session>> {
    this.ensureInitialized();

    const results = new Map<string, Session>();

    if (sessionIds.length === 0) {
      return results;
    }

    try {
      const query = 'SELECT id, data FROM sessions WHERE id = ANY($1)';
      const result = await this.pool!.query(query, [sessionIds]);

      for (const row of result.rows) {
        const serialized = JSON.stringify(row.data);
        const session = this.deserializeSession(serialized);
        results.set(row.id, session);
      }

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
    this.ensureInitialized();

    try {
      const query = 'DELETE FROM sessions WHERE id = $1';
      const result = await this.pool!.query(query, [sessionId]);

      return (result.rowCount || 0) > 0;
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
   * Performance optimization using ANY clause.
   */
  async deleteSessions(sessionIds: string[]): Promise<number> {
    this.ensureInitialized();

    if (sessionIds.length === 0) {
      return 0;
    }

    try {
      const query = 'DELETE FROM sessions WHERE id = ANY($1)';
      const result = await this.pool!.query(query, [sessionIds]);

      return result.rowCount || 0;
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
    this.ensureInitialized();

    try {
      let query = `
        SELECT
          id,
          data->>'state' as state,
          updated_at,
          jsonb_array_length(data->'agentIds') as agent_count
        FROM sessions
      `;

      const params: any[] = [];
      let paramIndex = 1;

      // Filter by state if provided
      if (state !== undefined) {
        query += ` WHERE data->>'state' = $${paramIndex}`;
        params.push(state);
        paramIndex++;
      }

      // Order by updated_at DESC
      query += ' ORDER BY updated_at DESC';

      // Apply pagination
      if (limit !== undefined) {
        query += ` LIMIT $${paramIndex}`;
        params.push(limit);
        paramIndex++;
      }

      if (offset !== undefined) {
        query += ` OFFSET $${paramIndex}`;
        params.push(offset);
        paramIndex++;
      }

      const result = await this.pool!.query(query, params);

      return result.rows.map((row) => ({
        id: row.id,
        state: row.state as SessionState,
        updatedAt: new Date(row.updated_at),
        agentCount: parseInt(row.agent_count, 10),
      }));
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
    this.ensureInitialized();

    try {
      const query = 'SELECT 1 FROM sessions WHERE id = $1 LIMIT 1';
      const result = await this.pool!.query(query, [sessionId]);

      return result.rows.length > 0;
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
   * Supports optional TTL.
   */
  async setValue(key: string, value: any): Promise<void> {
    this.ensureInitialized();

    try {
      const query = `
        INSERT INTO key_value (key, value, created_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value
      `;

      const values = [key, JSON.stringify(value)];
      await this.pool!.query(query, values);
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
    this.ensureInitialized();

    try {
      const query = `
        SELECT value FROM key_value
        WHERE key = $1
        AND (ttl IS NULL OR ttl > NOW())
      `;

      const result = await this.pool!.query(query, [key]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0].value as T;
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
    this.ensureInitialized();

    try {
      const query = 'DELETE FROM key_value WHERE key = $1';
      const result = await this.pool!.query(query, [key]);

      return (result.rowCount || 0) > 0;
    } catch (error) {
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
    this.ensureInitialized();

    try {
      const query = `
        SELECT 1 FROM key_value
        WHERE key = $1
        AND (ttl IS NULL OR ttl > NOW())
        LIMIT 1
      `;

      const result = await this.pool!.query(query, [key]);

      return result.rows.length > 0;
    } catch (error) {
      throw new StorageError(
        `Failed to check key existence ${key}: ${(error as Error).message}`,
        error as Error
      );
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
    this.ensureInitialized();

    try {
      let query = 'DELETE FROM sessions';
      const params: any[] = [];

      if (olderThan !== undefined) {
        query += ' WHERE updated_at < $1';
        params.push(olderThan);
      }

      const result = await this.pool!.query(query, params);

      return result.rowCount || 0;
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
    this.ensureInitialized();

    try {
      // Get total count and size
      const countQuery = 'SELECT COUNT(*) as total FROM sessions';
      const countResult = await this.pool!.query(countQuery);
      const totalSessions = parseInt(countResult.rows[0].total, 10);

      // Get size (approximate using pg_total_relation_size)
      const sizeQuery = `
        SELECT
          pg_total_relation_size('sessions') +
          pg_total_relation_size('key_value') as total_bytes
      `;
      const sizeResult = await this.pool!.query(sizeQuery);
      const sizeBytes = parseInt(sizeResult.rows[0].total_bytes, 10);

      // Get state counts
      const stateQuery = `
        SELECT
          data->>'state' as state,
          COUNT(*) as count
        FROM sessions
        GROUP BY data->>'state'
      `;
      const stateResult = await this.pool!.query(stateQuery);

      const stateCounts: Record<string, number> = {};
      stateResult.rows.forEach((row) => {
        stateCounts[row.state] = parseInt(row.count, 10);
      });

      return {
        totalSessions,
        sizeBytes,
        backendType: 'postgres',
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
   * Ensure adapter is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.pool) {
      throw new StorageError('PostgresStorageAdapter not initialized');
    }
  }
}
