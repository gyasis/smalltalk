/**
 * SessionManager Implementation
 *
 * Manages session lifecycle: create, save, restore, delete.
 * Implements contract tests from tests/contract/session-manager.shared.test.ts
 *
 * @see specs/001-production-robustness/contracts/SessionManager.contract.ts
 * @see specs/001-production-robustness/spec.md FR-001 to FR-005, FR-037, FR-038
 */

import * as crypto from 'crypto';
import {
  SessionManager as ISessionManager,
  CreateSessionOptions,
  ListSessionsOptions,
  SessionStorageStats,
} from '../../specs/001-production-robustness/contracts/SessionManager.contract';
import { StorageAdapter } from '../../specs/001-production-robustness/contracts/StorageAdapter.contract';
import {
  Session,
  SessionState,
  MessageTurn,
  ConflictError,
  NotFoundError,
  ValidationError,
  StorageError,
} from '../types/robustness';

/**
 * Message type for addMessage API compatibility
 * Contract tests use MessageTurn, but interface defines Message
 */
export type Message = MessageTurn;

/**
 * SessionManager implementation
 *
 * Responsibilities:
 * - Session lifecycle management (create, save, restore, delete)
 * - Optimistic locking with retry (FR-005)
 * - Performance targets (SC-007: <100ms restore, SC-009: <50ms save)
 * - Statistics and metrics (FR-037, FR-038)
 */
export class SessionManager implements ISessionManager {
  private storageAdapter: StorageAdapter;
  private backgroundSaveInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(storageAdapter: StorageAdapter) {
    this.storageAdapter = storageAdapter;
  }

  /**
   * Create new session with UUID v4 (FR-001)
   *
   * @param options Session creation options
   * @returns Created session
   */
  async createSession(options?: CreateSessionOptions): Promise<Session> {
    const now = new Date();
    const expirationMs = options?.expirationMs ?? 3600000; // Default 1 hour

    const session: Session = {
      id: crypto.randomUUID(), // FR-001: UUID v4
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + expirationMs),
      state: SessionState.ACTIVE,
      agentIds: [],
      agentStates: {},
      conversationHistory: [],
      sharedContext: {},
      metadata: options?.metadata ?? {},
      version: 1, // FR-005: Optimistic locking
    };

    // Note: Caller is responsible for persisting via saveSession()
    // This ensures version remains 1 until first explicit save
    return session;
  }

  /**
   * Save session with optimistic locking (FR-002, FR-005)
   * Target: <50ms p95 (SC-009)
   *
   * Increments version after successful save for optimistic locking.
   *
   * @param session Session to save
   * @throws ValidationError if session is invalid
   * @throws ConflictError if version mismatch detected
   */
  async saveSession(session: Session): Promise<void> {
    // Validate session
    if (!session) {
      throw new ValidationError('Session cannot be null or undefined');
    }

    // Validate UUID format
    if (!this.isValidUUIDv4(session.id)) {
      throw new ValidationError(`Invalid session ID format: ${session.id}`);
    }

    const maxRetries = 3; // FR-005
    let retryCount = 0;
    const originalVersion = session.version; // Store original version for conflict detection

    while (retryCount <= maxRetries) {
      try {
        // Check for version conflicts (FR-005)
        const existing = await this.storageAdapter.getSession(session.id);

        if (existing && existing.version !== originalVersion) {
          // Version mismatch - conflict detected
          // Compare against ORIGINAL version, not current session.version
          throw new ConflictError(
            `Version conflict: trying to save version ${originalVersion}, but storage has version ${existing.version}`,
            [originalVersion, existing.version]
          );
        }

        // Increment version BEFORE save (FR-005)
        // This ensures storage gets the new version
        session.version++;

        // Update timestamp
        session.updatedAt = new Date();

        // Save to storage with incremented version
        await this.storageAdapter.saveSession(session);

        return;

      } catch (error) {
        if (error instanceof ConflictError && retryCount < maxRetries) {
          // Retry with backoff (FR-005)
          // Retries help with transient conflicts (e.g., locking)
          // but version conflicts with stale data will fail all retries
          retryCount++;
          await this.delay(100 * retryCount); // 100ms, 200ms, 300ms

          // Do NOT reset version or merge changes
          // If originalVersion is stale, all retries should fail
          // This ensures concurrent saves with stale versions always fail

          continue;
        }

        // After max retries or non-ConflictError: propagate error
        throw error;
      }
    }

    // If we exit the loop without returning, all retries failed
    throw new ConflictError(
      `Failed to save session after ${maxRetries} retries`,
      [originalVersion, -1]
    );
  }

  /**
   * Restore session from storage (FR-003)
   * Target: <100ms p95 (SC-007)
   *
   * @param sessionId Session identifier
   * @returns Restored session or null if not found
   * @throws ValidationError if sessionId is invalid
   */
  async restoreSession(sessionId: string): Promise<Session | null> {
    // Validate UUID format
    if (!sessionId || !this.isValidUUIDv4(sessionId)) {
      throw new ValidationError(`Invalid session ID format: ${sessionId}`);
    }

    return await this.storageAdapter.getSession(sessionId);
  }

  /**
   * Delete session from storage
   *
   * @param sessionId Session identifier
   * @returns true if deleted, false if not found
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    return await this.storageAdapter.deleteSession(sessionId);
  }

  /**
   * List sessions with filtering and pagination
   *
   * @param options Filtering and pagination options
   * @returns Array of session IDs
   */
  async listSessions(options?: ListSessionsOptions): Promise<string[]> {
    // Get all sessions matching state filter (already sorted by updatedAt DESC)
    const sessions = await this.storageAdapter.listSessions(
      options?.state,
      undefined, // Don't apply limit/offset yet
      undefined
    );

    // Apply createdAfter filter if specified
    let filtered = sessions;
    if (options?.createdAfter !== undefined) {
      const cutoffTime = new Date(options.createdAfter);

      // Need to get full sessions to check createdAt timestamps
      const fullSessions = await Promise.all(
        sessions.map(s => this.storageAdapter.getSession(s.id))
      );

      // Filter by createdAfter
      const filteredIds = new Set<string>();
      fullSessions.forEach(session => {
        if (session && session.createdAt.getTime() >= cutoffTime.getTime()) {
          filteredIds.add(session.id);
        }
      });

      filtered = sessions.filter(s => filteredIds.has(s.id));
    }

    // Apply pagination after filtering
    const start = options?.offset ?? 0;
    const end = options?.limit ? start + options.limit : undefined;
    const paginated = filtered.slice(start, end);

    return paginated.map(s => s.id);
  }

  /**
   * Update session state with lifecycle transitions (FR-004)
   *
   * @param sessionId Session identifier
   * @param state New session state
   * @throws NotFoundError if session not found
   */
  async updateSessionState(sessionId: string, state: SessionState): Promise<void> {
    const session = await this.restoreSession(sessionId);
    if (!session) {
      throw new NotFoundError('Session', sessionId);
    }

    // Validate state transition
    this.validateStateTransition(session.state, state);

    session.state = state;
    // Note: version increment handled by saveSession()
    await this.saveSession(session);
  }

  /**
   * Add message to conversation history
   *
   * @param sessionId Session identifier
   * @param message Message to add
   * @throws NotFoundError if session not found
   */
  async addMessage(sessionId: string, message: Message): Promise<void> {
    // Retry logic for concurrent updates
    const maxRetries = 10; // Increase retries for high concurrency
    let retryCount = 0;

    while (retryCount <= maxRetries) {
      try {
        const session = await this.restoreSession(sessionId);
        if (!session) {
          throw new NotFoundError('Session', sessionId);
        }

        // Ensure timestamp is set
        const messageTurn: MessageTurn = {
          ...message,
          timestamp: message.timestamp ?? new Date(),
        };

        session.conversationHistory.push(messageTurn);
        // Note: version increment handled by saveSession()
        await this.saveSession(session);
        return;

      } catch (error) {
        if (error instanceof ConflictError && retryCount < maxRetries) {
          retryCount++;
          await this.delay(5 * retryCount); // 5ms, 10ms, 15ms...
          continue;
        }
        throw error;
      }
    }
  }

  /**
   * Update agent state in session
   *
   * @param sessionId Session identifier
   * @param agentId Agent identifier
   * @param state Agent state
   * @throws NotFoundError if session not found
   */
  async updateAgentState(
    sessionId: string,
    agentId: string,
    state: any
  ): Promise<void> {
    const session = await this.restoreSession(sessionId);
    if (!session) {
      throw new NotFoundError('Session', sessionId);
    }

    session.agentStates[agentId] = state;
    // Note: version increment handled by saveSession()
    await this.saveSession(session);
  }

  /**
   * Cleanup expired sessions (FR-004a)
   *
   * @param expirationMs Sessions older than this are deleted
   * @returns Number of sessions deleted
   */
  async cleanupExpiredSessions(expirationMs: number): Promise<number> {
    // Get all sessions
    const allSessions = await this.storageAdapter.listSessions();

    const now = Date.now();
    const cutoffTime = new Date(now - expirationMs);

    let deletedCount = 0;

    for (const sessionSummary of allSessions) {
      // Check if session has expired based on expiresAt timestamp
      const session = await this.storageAdapter.getSession(sessionSummary.id);
      if (session && session.expiresAt.getTime() < now) {
        const deleted = await this.storageAdapter.deleteSession(session.id);
        if (deleted) {
          deletedCount++;
        }
      }
    }

    return deletedCount;
  }

  /**
   * Get session statistics (FR-037, FR-038)
   *
   * @returns Session storage statistics
   */
  async getStats(): Promise<SessionStorageStats> {
    const storageStats = await this.storageAdapter.getStats();

    // Extract counts from storage stats metrics
    const metrics = storageStats.metrics || {};
    const activeCount = metrics['activeCount'] ?? 0;
    const pausedCount = metrics['pausedCount'] ?? 0;
    const expiredCount = metrics['expiredCount'] ?? 0;

    return {
      activeSessions: activeCount,
      idleSessions: pausedCount, // Map PAUSED to idle
      expiredSessions: expiredCount,
      storageSizeBytes: storageStats.sizeBytes,
      backendType: storageStats.backendType,
    };
  }

  /**
   * Start background tasks (FR-002b, FR-004a)
   */
  startBackgroundTasks(): void {
    // Background save every 60s (FR-002b)
    this.backgroundSaveInterval = setInterval(async () => {
      // Background saves handled by individual operations
      // This could be extended to flush dirty sessions
    }, 60000);

    // Background cleanup every 5 minutes (FR-004a)
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.cleanupExpiredSessions(0); // Clean all expired
      } catch (error) {
        console.error('Background cleanup failed:', error);
      }
    }, 300000); // 5 minutes
  }

  /**
   * Stop background tasks
   */
  stopBackgroundTasks(): void {
    if (this.backgroundSaveInterval) {
      clearInterval(this.backgroundSaveInterval);
      this.backgroundSaveInterval = undefined;
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  // Helper methods

  /**
   * Validate state transition
   *
   * @param from Current state
   * @param to New state
   * @throws Error if transition is invalid
   */
  private validateStateTransition(from: SessionState, to: SessionState): void {
    const validTransitions: Record<SessionState, SessionState[]> = {
      [SessionState.ACTIVE]: [SessionState.PAUSED, SessionState.CLOSED],
      [SessionState.PAUSED]: [SessionState.ACTIVE, SessionState.CLOSED],
      [SessionState.EXPIRED]: [SessionState.CLOSED],
      [SessionState.INVALIDATED_PENDING_CLEANUP]: [SessionState.CLOSED],
      [SessionState.CLOSED]: [],
    };

    if (!validTransitions[from]?.includes(to)) {
      throw new Error(`Invalid state transition: ${from} → ${to}`);
    }
  }

  /**
   * Validate UUID v4 format
   *
   * @param id String to validate
   * @returns true if valid UUID v4
   */
  private isValidUUIDv4(id: string): boolean {
    const uuidv4Regex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidv4Regex.test(id);
  }

  /**
   * Delay execution
   *
   * @param ms Milliseconds to delay
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
