/**
 * InMemoryStorageAdapter
 *
 * In-memory storage adapter implementation for testing and development.
 * Uses Map-based storage with deep cloning to prevent mutation.
 *
 * Performance target: <1ms operations
 *
 * @see specs/001-production-robustness/contracts/StorageAdapter.contract.ts
 */

import {
  Session,
  SessionState,
  SessionSerializer,
} from '../types/robustness';

import {
  StorageAdapter,
  StorageAdapterConfig,
  StorageStats,
} from '../../specs/001-production-robustness/contracts/StorageAdapter.contract';

/**
 * In-memory storage adapter for testing and development
 *
 * Features:
 * - Map-based storage for O(1) operations
 * - Deep cloning via serialization round-trip
 * - No compression or encryption
 * - <1ms operation performance target
 */
export class InMemoryStorageAdapter implements StorageAdapter {
  private sessions: Map<string, Session> = new Map();
  private keyValueStore: Map<string, any> = new Map();
  private initialized: boolean = false;

  constructor() {}

  // ==========================================================================
  // Lifecycle Methods
  // ==========================================================================

  async initialize(config?: StorageAdapterConfig): Promise<void> {
    this.initialized = true;
  }

  async close(): Promise<void> {
    this.sessions.clear();
    this.keyValueStore.clear();
    this.initialized = false;
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    return {
      healthy: this.initialized,
      message: this.initialized ? undefined : 'Not initialized',
    };
  }

  // ==========================================================================
  // Serialization Methods
  // ==========================================================================

  serializeSession(session: Session): string {
    return SessionSerializer.toJSON(session);
  }

  deserializeSession(data: string): Session {
    return SessionSerializer.fromJSON(data);
  }

  // ==========================================================================
  // Session Operations
  // ==========================================================================

  async saveSession(session: Session): Promise<void> {
    // Deep clone via serialization round-trip to prevent mutation
    const serialized = SessionSerializer.toJSON(session);
    const cloned = SessionSerializer.fromJSON(serialized);
    this.sessions.set(session.id, cloned);
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    // Deep clone to prevent external mutation
    const serialized = SessionSerializer.toJSON(session);
    return SessionSerializer.fromJSON(serialized);
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    return this.sessions.delete(sessionId);
  }

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
    let sessions = Array.from(this.sessions.values());

    // Filter by state if specified
    if (state !== undefined) {
      sessions = sessions.filter((s) => s.state === state);
    }

    // Sort by updatedAt DESC (most recent first)
    sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    // Apply pagination
    const start = offset ?? 0;
    const end = limit ? start + limit : undefined;
    sessions = sessions.slice(start, end);

    // Return summary data
    return sessions.map((s) => ({
      id: s.id,
      state: s.state,
      updatedAt: s.updatedAt,
      agentCount: s.agentIds.length,
    }));
  }

  async hasSession(sessionId: string): Promise<boolean> {
    return this.sessions.has(sessionId);
  }

  // ==========================================================================
  // Batch Operations
  // ==========================================================================

  async saveSessions(sessions: Session[]): Promise<number> {
    for (const session of sessions) {
      await this.saveSession(session);
    }
    return sessions.length;
  }

  async getSessions(sessionIds: string[]): Promise<Map<string, Session>> {
    const result = new Map<string, Session>();
    for (const id of sessionIds) {
      const session = await this.getSession(id);
      if (session) {
        result.set(id, session);
      }
    }
    return result;
  }

  async deleteSessions(sessionIds: string[]): Promise<number> {
    let count = 0;
    for (const id of sessionIds) {
      if (await this.deleteSession(id)) {
        count++;
      }
    }
    return count;
  }

  // ==========================================================================
  // Key-Value Storage
  // ==========================================================================

  async setValue(key: string, value: any): Promise<void> {
    // Deep clone to prevent mutation
    this.keyValueStore.set(key, JSON.parse(JSON.stringify(value)));
  }

  async getValue<T = any>(key: string): Promise<T | null> {
    const value = this.keyValueStore.get(key);
    if (value === undefined) {
      return null;
    }

    // Deep clone to prevent external mutation
    return JSON.parse(JSON.stringify(value)) as T;
  }

  async deleteValue(key: string): Promise<boolean> {
    return this.keyValueStore.delete(key);
  }

  async hasValue(key: string): Promise<boolean> {
    return this.keyValueStore.has(key);
  }

  // ==========================================================================
  // Cleanup and Statistics
  // ==========================================================================

  async clear(olderThan?: Date): Promise<number> {
    if (!olderThan) {
      // Clear all sessions
      const count = this.sessions.size;
      this.sessions.clear();
      return count;
    }

    // Clear sessions older than specified date
    let count = 0;
    const entries = Array.from(this.sessions.entries());
    for (const [id, session] of entries) {
      if (session.updatedAt < olderThan) {
        this.sessions.delete(id);
        count++;
      }
    }
    return count;
  }

  async getStats(): Promise<StorageStats> {
    const sessions = Array.from(this.sessions.values());

    // Count sessions by state
    const sessionsByState: Record<SessionState, number> = {
      [SessionState.ACTIVE]: 0,
      [SessionState.PAUSED]: 0,
      [SessionState.EXPIRED]: 0,
      [SessionState.INVALIDATED_PENDING_CLEANUP]: 0,
      [SessionState.CLOSED]: 0,
    };

    for (const session of sessions) {
      sessionsByState[session.state]++;
    }

    // Calculate total size in bytes
    let totalSizeBytes = 0;
    for (const session of sessions) {
      totalSizeBytes += Buffer.byteLength(
        SessionSerializer.toJSON(session),
        'utf8'
      );
    }

    // Find oldest and newest sessions
    let oldestSession: Date | null = null;
    let newestSession: Date | null = null;
    for (const session of sessions) {
      if (!oldestSession || session.createdAt < oldestSession) {
        oldestSession = session.createdAt;
      }
      if (!newestSession || session.createdAt > newestSession) {
        newestSession = session.createdAt;
      }
    }

    return {
      totalSessions: this.sessions.size,
      sizeBytes: totalSizeBytes,
      backendType: 'in-memory',
      metrics: {
        activeCount: sessionsByState[SessionState.ACTIVE],
        pausedCount: sessionsByState[SessionState.PAUSED],
        expiredCount: sessionsByState[SessionState.EXPIRED],
        invalidatedCount:
          sessionsByState[SessionState.INVALIDATED_PENDING_CLEANUP],
        closedCount: sessionsByState[SessionState.CLOSED],
        oldestSession,
        newestSession,
      },
    };
  }
}
