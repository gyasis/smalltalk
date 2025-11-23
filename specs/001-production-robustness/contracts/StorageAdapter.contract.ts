/**
 * StorageAdapter Contract
 *
 * Defines the abstract interface that all storage backend implementations
 * must satisfy. Enables pluggable storage strategies (file, Redis, memory).
 *
 * @see spec.md User Story 1 - Session Persistence and Recovery
 * @see research.md Section 2 - Storage Adapter Pattern
 * @see research.md Section 3 - Session Storage Backend (SQLite)
 */

import {
  Session,
  SessionState,
  SessionSerializer,
  StorageError,
  NotFoundError,
  ConflictError,
} from '../../../src/types/robustness.js';

/**
 * Storage adapter initialization options
 *
 * Security: Sensitive data (passwords, API keys) in connection strings
 * must be handled securely (encrypted at rest, not logged).
 */
export interface StorageAdapterConfig {
  /** Storage location (file path or connection string)
   * File paths must be sanitized to prevent path traversal attacks.
   */
  location?: string;

  /** Time-to-live for stored items in seconds (optional) */
  ttl?: number;

  /** Maximum storage size in bytes (optional) */
  maxSize?: number;

  /** Compression enabled (default: false for Phase 1) */
  compression?: boolean;

  /** Encryption enabled (default: false for Phase 1, required for Phase 2) */
  encryption?: boolean;

  /** Storage-specific options - MUST be validated and sanitized */
  options?: {
    /** For FileStorage: file permissions (default: 0o600) */
    filePermissions?: number;
    /** For Redis: connection pool size */
    poolSize?: number;
    /** For Postgres: SSL mode */
    sslMode?: 'disable' | 'require' | 'verify-full';
    [key: string]: any;
  };
}

/**
 * Storage statistics
 */
export interface StorageStats {
  /** Total number of sessions stored */
  totalSessions: number;
  /** Total storage size in bytes */
  sizeBytes: number;
  /** Storage backend type */
  backendType: string;
  /** Additional backend-specific metrics */
  metrics?: Record<string, any>;
}

/**
 * StorageAdapter interface
 *
 * Abstract interface for session persistence backends.
 * All storage implementations (file, Redis, memory) must implement this contract.
 *
 * Serialization: Sessions are serialized to JSON using SessionSerializer.toJSON()
 * and deserialized using SessionSerializer.fromJSON(). All implementations MUST
 * use this format for compatibility.
 *
 * Error Handling: Methods throw custom error types (StorageError, NotFoundError,
 * ConflictError) for specific failure scenarios. Callers should catch and handle
 * these error types appropriately.
 */
export interface StorageAdapter {
  /**
   * Initialize the storage backend
   *
   * FR-001: System MUST restore multi-agent conversations after restart
   * FR-005: System MUST support pluggable storage adapters
   * FR-053: Readiness probe checks this initialization
   *
   * @param config Storage configuration
   * @throws StorageError if initialization fails
   */
  initialize(config?: StorageAdapterConfig): Promise<void>;

  /**
   * Close storage connection and cleanup resources
   *
   * Called during graceful shutdown (FR-054 step 4).
   *
   * @throws StorageError if close fails
   */
  close(): Promise<void>;

  /**
   * Health check for readiness probe
   *
   * FR-053: Readiness probe checks storage health
   *
   * @returns Health status with message
   */
  healthCheck(): Promise<{ healthy: boolean; message?: string }>;

  /**
   * Serialize session to storage format
   *
   * Uses SessionSerializer.toJSON() for consistent JSON serialization.
   * Implementations may apply additional transformations (compression, encryption).
   *
   * @param session Session to serialize
   * @returns Serialized representation
   */
  serializeSession(session: Session): string;

  /**
   * Deserialize session from storage format
   *
   * Uses SessionSerializer.fromJSON() for consistent JSON deserialization.
   * Implementations may apply transformations (decompression, decryption).
   *
   * @param data Serialized session data
   * @returns Deserialized session
   * @throws ValidationError if data is invalid
   */
  deserializeSession(data: string): Session;

  /**
   * Save session to storage
   *
   * FR-002: System MUST serialize agent conversation state to persistent storage
   * FR-002a/b: Retry logic and background saves handled by caller
   * SC-009: State serialization completes in under 50ms (p95)
   *
   * @param session Session to save
   * @throws StorageError if save fails
   * @throws ValidationError if session data is invalid
   */
  saveSession(session: Session): Promise<void>;

  /**
   * Save multiple sessions in batch
   *
   * Performance optimization for bulk operations.
   * Default implementation: sequential saveSession() calls.
   *
   * @param sessions Sessions to save
   * @returns Number of sessions successfully saved
   * @throws StorageError if batch operation fails
   */
  saveSessions(sessions: Session[]): Promise<number>;

  /**
   * Get session from storage
   *
   * FR-003: System MUST restore conversation state from session ID
   * SC-007: Session restoration completes in under 100ms (p95)
   *
   * @param sessionId Session identifier
   * @returns Session or null if not found
   * @throws StorageError if retrieval fails (not including "not found")
   */
  getSession(sessionId: string): Promise<Session | null>;

  /**
   * Get multiple sessions in batch
   *
   * Performance optimization for bulk retrieval.
   * Default implementation: parallel getSession() calls.
   *
   * @param sessionIds Session identifiers
   * @returns Map of sessionId to Session (missing sessions excluded)
   * @throws StorageError if batch operation fails
   */
  getSessions(sessionIds: string[]): Promise<Map<string, Session>>;

  /**
   * Delete session from storage
   *
   * FR-004a: Session invalidation with cleanup
   *
   * @param sessionId Session identifier
   * @returns true if deleted, false if not found
   * @throws StorageError if deletion fails
   */
  deleteSession(sessionId: string): Promise<boolean>;

  /**
   * Delete multiple sessions in batch
   *
   * Performance optimization for bulk deletion.
   * Default implementation: parallel deleteSession() calls.
   *
   * @param sessionIds Session identifiers
   * @returns Number of sessions successfully deleted
   * @throws StorageError if batch operation fails
   */
  deleteSessions(sessionIds: string[]): Promise<number>;

  /**
   * List session IDs and metadata matching filter
   *
   * Returns session IDs with optional metadata to reduce need for getSession calls.
   * Large result sets may require pagination at implementation level.
   *
   * @param state Optional filter by session state
   * @param limit Maximum number of sessions to return (optional)
   * @param offset Pagination offset (optional)
   * @returns Array of session summaries with ID and metadata
   */
  listSessions(
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
  >;

  /**
   * Check if session exists in storage
   *
   * Performance note: Some backends may require full read to check existence.
   * Consider using getSession() if you need the data anyway.
   *
   * @param sessionId Session identifier
   * @returns true if session exists
   * @throws StorageError if check fails
   */
  hasSession(sessionId: string): Promise<boolean>;

  /**
   * Store arbitrary key-value data
   *
   * Used for metadata storage (health status, event replay policies, etc.)
   * Values must be JSON-serializable.
   *
   * @param key Data key (will be sanitized to prevent path traversal)
   * @param value Data value (must be JSON-serializable)
   * @throws StorageError if storage fails
   * @throws ValidationError if key or value is invalid
   */
  setValue(key: string, value: any): Promise<void>;

  /**
   * Retrieve key-value data
   *
   * Generic type T ensures type safety at call site.
   * Caller is responsible for validating returned type.
   *
   * @param key Data key
   * @returns Stored value or null if not found
   * @throws StorageError if retrieval fails (not including "not found")
   */
  getValue<T = any>(key: string): Promise<T | null>;

  /**
   * Delete key-value data
   *
   * @param key Data key
   * @returns true if deleted, false if not found
   * @throws StorageError if deletion fails
   */
  deleteValue(key: string): Promise<boolean>;

  /**
   * Check if key exists in storage
   *
   * Performance note: Some backends may require full read to check existence.
   *
   * @param key Data key
   * @returns true if key exists
   * @throws StorageError if check fails
   */
  hasValue(key: string): Promise<boolean>;

  /**
   * Clear data from storage
   *
   * FR-004: System MUST implement session expiration policies
   * Used for cleanup of expired sessions and old data.
   *
   * @param olderThan Optional Date - clear data with updatedAt older than this.
   *                  If not provided, clears ALL data (use with caution).
   * @returns Number of items cleared
   * @throws StorageError if clear fails
   */
  clear(olderThan?: Date): Promise<number>;

  /**
   * Get storage statistics
   *
   * FR-037: System MUST provide session count metrics
   *
   * @returns Storage statistics
   */
  getStats(): Promise<StorageStats>;
}

/**
 * Storage adapter factory
 *
 * Factory interface for creating storage adapter instances.
 * Enables dependency injection and testing.
 */
export interface StorageAdapterFactory {
  /**
   * Create storage adapter instance
   *
   * @param backendType Storage backend type ('file', 'redis', 'memory')
   * @param config Adapter configuration
   * @returns Created storage adapter
   * @throws Error if backend type is unsupported
   */
  createAdapter(
    backendType: string,
    config?: StorageAdapterConfig
  ): Promise<StorageAdapter>;
}
