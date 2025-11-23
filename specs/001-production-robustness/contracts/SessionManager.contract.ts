/**
 * SessionManager Contract
 *
 * Defines the interface for session persistence and recovery.
 * All implementations must satisfy this contract.
 *
 * @see spec.md User Story 1 - Session Persistence and Recovery
 * @see research.md Section 3 - Session Storage Backend
 */

import { Session, SessionState, Message, AgentState } from '../../../src/types/robustness.js';

/**
 * Session creation options
 */
export interface CreateSessionOptions {
  /** Optional expiration duration in milliseconds */
  expirationMs?: number;
  /** Initial session metadata */
  metadata?: Record<string, any>;
}

/**
 * Session list options
 */
export interface ListSessionsOptions {
  /** Maximum number of sessions to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Filter by session state */
  state?: SessionState;
  /** Filter sessions created after this timestamp */
  createdAfter?: number;
}

/**
 * SessionManager interface
 *
 * Responsible for session lifecycle management: create, save, restore, delete.
 */
export interface SessionManager {
  /**
   * Create a new session
   *
   * @param options Session creation options
   * @returns Created session object
   * @throws Error if session creation fails
   */
  createSession(options?: CreateSessionOptions): Promise<Session>;

  /**
   * Save session state to persistent storage
   *
   * FR-002: System MUST serialize agent conversation state to persistent storage
   * SC-009: State serialization completes in under 50ms
   *
   * @param session Session to save
   * @throws Error if session save fails
   */
  saveSession(session: Session): Promise<void>;

  /**
   * Restore session from persistent storage
   *
   * FR-003: System MUST restore conversation state from session ID
   * SC-007: Session restoration completes in under 100ms
   *
   * @param sessionId Session identifier
   * @returns Restored session or null if not found
   * @throws Error if restore fails (not including "not found")
   */
  restoreSession(sessionId: string): Promise<Session | null>;

  /**
   * Delete session from storage
   *
   * @param sessionId Session identifier
   * @returns true if deleted, false if not found
   * @throws Error if deletion fails
   */
  deleteSession(sessionId: string): Promise<boolean>;

  /**
   * List all session IDs
   *
   * @param options Listing and filtering options
   * @returns Array of session IDs
   */
  listSessions(options?: ListSessionsOptions): Promise<string[]>;

  /**
   * Update session state (active, idle, expired)
   *
   * @param sessionId Session identifier
   * @param state New session state
   * @throws Error if session not found or update fails
   */
  updateSessionState(sessionId: string, state: SessionState): Promise<void>;

  /**
   * Add message to session conversation history
   *
   * @param sessionId Session identifier
   * @param message Message to add
   * @throws Error if session not found
   */
  addMessage(sessionId: string, message: Message): Promise<void>;

  /**
   * Update agent state within session
   *
   * @param sessionId Session identifier
   * @param agentId Agent identifier
   * @param state New agent state
   * @throws Error if session not found
   */
  updateAgentState(
    sessionId: string,
    agentId: string,
    state: AgentState
  ): Promise<void>;

  /**
   * Cleanup expired sessions
   *
   * FR-004: System MUST implement session expiration policies
   *
   * @param expirationMs Sessions older than this are deleted
   * @returns Number of sessions deleted
   */
  cleanupExpiredSessions(expirationMs: number): Promise<number>;

  /**
   * Get session storage statistics
   *
   * FR-037: System MUST provide session count metrics
   *
   * @returns Storage statistics
   */
  getStats(): Promise<SessionStorageStats>;
}

/**
 * Session storage statistics
 */
export interface SessionStorageStats {
  /** Total number of active sessions */
  activeSessions: number;
  /** Total number of idle sessions */
  idleSessions: number;
  /** Total number of expired sessions */
  expiredSessions: number;
  /** Total storage size in bytes (if available) */
  storageSizeBytes?: number;
  /** Storage backend type */
  backendType: string;
}
