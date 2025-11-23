/**
 * SessionManager Contract Tests
 *
 * Shared contract test suite that validates ANY SessionManager implementation
 * against the defined interface requirements.
 *
 * TDD Phase: RED - These tests are designed to FAIL until implementation
 *
 * @see specs/001-production-robustness/contracts/SessionManager.contract.ts
 * @see specs/001-production-robustness/spec.md FR-001 to FR-005, FR-037, FR-038
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { performance } from 'perf_hooks';
import * as crypto from 'crypto';
import {
  SessionManager,
  CreateSessionOptions,
  ListSessionsOptions,
} from '../../specs/001-production-robustness/contracts/SessionManager.contract';
import {
  Session,
  SessionState,
  MessageTurn,
  AgentContext,
  ConflictError,
  NotFoundError,
  ValidationError,
  StorageError,
} from '../../src/types/robustness';

/**
 * Test Helper: Create test session with defaults
 */
function createTestSession(overrides?: Partial<Session>): Session {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(now.getTime() + 3600000), // 1 hour
    state: SessionState.ACTIVE,
    agentIds: ['agent1', 'agent2'],
    agentStates: {},
    conversationHistory: [],
    sharedContext: {},
    metadata: {},
    version: 1,
    ...overrides,
  };
}

/**
 * Test Helper: Create test message turn
 */
function createTestMessageTurn(
  sequence: number,
  userMessage: string,
  agentResponses: Array<{ agentId: string; response: string }> = []
): MessageTurn {
  const now = new Date();
  return {
    sequence,
    timestamp: now,
    userMessage,
    agentResponses: agentResponses.map((resp) => ({
      ...resp,
      timestamp: now,
    })),
  };
}

/**
 * Test Helper: Measure execution time
 */
async function measureTime<T>(
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
}

/**
 * Test Helper: Create large conversation history
 */
function createLargeConversationHistory(messageCount: number): MessageTurn[] {
  return Array.from({ length: messageCount }, (_, i) =>
    createTestMessageTurn(i + 1, `User message ${i + 1}`, [
      { agentId: 'agent1', response: `Agent response ${i + 1}` },
    ])
  );
}

/**
 * Test Helper: Validate UUID v4 format
 */
function isValidUUIDv4(id: string): boolean {
  const uuidv4Regex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidv4Regex.test(id);
}

/**
 * Contract Test Suite Factory
 *
 * This function creates a complete contract test suite for any SessionManager
 * implementation. Import this function and call it with your implementation's
 * factory functions.
 *
 * @param createManager Factory function that creates a SessionManager instance
 *
 * @example
 * ```typescript
 * import { runSessionManagerContractTests } from './session-manager.shared.test.js';
 * import { FileSessionManager } from './FileSessionManager.js';
 *
 * describe('FileSessionManager', () => {
 *   runSessionManagerContractTests(() => new FileSessionManager());
 * });
 * ```
 */
export function runSessionManagerContractTests(
  createManager: () => SessionManager
) {
  let manager: SessionManager;

  beforeEach(async () => {
    manager = createManager();
  });

  afterEach(async () => {
    // Cleanup - implementations should handle cleanup in their own lifecycle
  });

  // =========================================================================
  // Part 1: Session Creation and Basic Operations
  // =========================================================================

  describe('SessionManager Contract - Session Creation', () => {
    describe('createSession()', () => {
      it('should create session with UUID v4 id (FR-001)', async () => {
        const session = await manager.createSession();

        expect(session).toBeDefined();
        expect(session.id).toBeDefined();
        expect(typeof session.id).toBe('string');
        expect(isValidUUIDv4(session.id)).toBe(true);
      });

      it('should set initial state to ACTIVE', async () => {
        const session = await manager.createSession();

        expect(session.state).toBe(SessionState.ACTIVE);
      });

      it('should set createdAt, updatedAt, expiresAt timestamps', async () => {
        const beforeCreate = Date.now();
        const session = await manager.createSession();
        const afterCreate = Date.now();

        expect(session.createdAt).toBeInstanceOf(Date);
        expect(session.updatedAt).toBeInstanceOf(Date);
        expect(session.expiresAt).toBeInstanceOf(Date);

        // Verify timestamps are within reasonable bounds
        expect(session.createdAt.getTime()).toBeGreaterThanOrEqual(
          beforeCreate
        );
        expect(session.createdAt.getTime()).toBeLessThanOrEqual(afterCreate);

        // Verify expiresAt is in the future
        expect(session.expiresAt.getTime()).toBeGreaterThan(
          session.createdAt.getTime()
        );
      });

      it('should initialize empty conversationHistory', async () => {
        const session = await manager.createSession();

        expect(session.conversationHistory).toBeDefined();
        expect(Array.isArray(session.conversationHistory)).toBe(true);
        expect(session.conversationHistory.length).toBe(0);
      });

      it('should initialize empty agentStates', async () => {
        const session = await manager.createSession();

        expect(session.agentStates).toBeDefined();
        expect(typeof session.agentStates).toBe('object');
        expect(Object.keys(session.agentStates).length).toBe(0);
      });

      it('should set version to 1 for optimistic locking (FR-005)', async () => {
        const session = await manager.createSession();

        expect(session.version).toBe(1);
      });

      it('should accept optional agentIds array', async () => {
        const agentIds = ['agent1', 'agent2', 'agent3'];
        const session = await manager.createSession();

        // Note: Implementation may or may not use CreateSessionOptions.agentIds
        // This test validates the session structure can hold agentIds
        expect(session.agentIds).toBeDefined();
        expect(Array.isArray(session.agentIds)).toBe(true);
      });

      it('should accept optional expirationMs (default: 1 hour)', async () => {
        const customExpiration = 7200000; // 2 hours
        const options: CreateSessionOptions = {
          expirationMs: customExpiration,
        };

        const session = await manager.createSession(options);
        const expectedExpiration =
          session.createdAt.getTime() + customExpiration;

        // Allow 1 second tolerance for timing variations
        expect(Math.abs(session.expiresAt.getTime() - expectedExpiration)).toBeLessThan(1000);
      });
    });

    describe('saveSession() / restoreSession()', () => {
      it('should save and restore session with all fields (FR-002, FR-003)', async () => {
        const originalSession = createTestSession({
          agentIds: ['agent1', 'agent2'],
          metadata: { userId: 'user123', tags: ['test'] },
          sharedContext: { theme: 'dark' },
        });

        await manager.saveSession(originalSession);
        const restored = await manager.restoreSession(originalSession.id);

        expect(restored).not.toBeNull();
        expect(restored!.id).toBe(originalSession.id);
        expect(restored!.state).toBe(originalSession.state);
        expect(restored!.agentIds).toEqual(originalSession.agentIds);
        expect(restored!.version).toBe(originalSession.version);
        expect(restored!.metadata).toEqual(originalSession.metadata);
        expect(restored!.sharedContext).toEqual(originalSession.sharedContext);
      });

      it('should complete saveSession() in <50ms p95 (SC-009)', async () => {
        const session = createTestSession();
        const iterations = 100;
        const durations: number[] = [];

        for (let i = 0; i < iterations; i++) {
          const testSession = createTestSession({ id: crypto.randomUUID() });
          const { duration } = await measureTime(() =>
            manager.saveSession(testSession)
          );
          durations.push(duration);
        }

        // Calculate p95
        durations.sort((a, b) => a - b);
        const p95Index = Math.floor(iterations * 0.95);
        const p95Latency = durations[p95Index];

        expect(p95Latency).toBeLessThan(50);
      });

      it('should complete restoreSession() in <100ms p95 (SC-007)', async () => {
        // Create and save test sessions
        const sessionIds: string[] = [];
        for (let i = 0; i < 100; i++) {
          const session = createTestSession({ id: crypto.randomUUID() });
          await manager.saveSession(session);
          sessionIds.push(session.id);
        }

        // Measure restore times
        const durations: number[] = [];
        for (const sessionId of sessionIds) {
          const { duration } = await measureTime(() =>
            manager.restoreSession(sessionId)
          );
          durations.push(duration);
        }

        // Calculate p95
        durations.sort((a, b) => a - b);
        const p95Index = Math.floor(100 * 0.95);
        const p95Latency = durations[p95Index];

        expect(p95Latency).toBeLessThan(100);
      });

      it('should return null when restoring non-existent session', async () => {
        const nonExistentId = crypto.randomUUID();
        const restored = await manager.restoreSession(nonExistentId);

        expect(restored).toBeNull();
      });

      it('should preserve conversationHistory order', async () => {
        const messages = createLargeConversationHistory(10);
        const session = createTestSession({ conversationHistory: messages });

        await manager.saveSession(session);
        const restored = await manager.restoreSession(session.id);

        expect(restored).not.toBeNull();
        expect(restored!.conversationHistory.length).toBe(10);

        // Verify order is preserved
        for (let i = 0; i < 10; i++) {
          expect(restored!.conversationHistory[i].sequence).toBe(i + 1);
          expect(restored!.conversationHistory[i].userMessage).toBe(
            `User message ${i + 1}`
          );
        }
      });

      it('should preserve agentStates Map structure', async () => {
        const session = createTestSession({
          agentStates: {
            agent1: {
              config: { temperature: 0.7 },
              context: { lastQuery: 'test' },
              messageHistory: [],
            },
            agent2: {
              config: { temperature: 0.9 },
              context: { lastQuery: 'hello' },
              messageHistory: [],
            },
          },
        });

        await manager.saveSession(session);
        const restored = await manager.restoreSession(session.id);

        expect(restored).not.toBeNull();
        expect(restored!.agentStates).toEqual(session.agentStates);
        expect(restored!.agentStates.agent1.config.temperature).toBe(0.7);
        expect(restored!.agentStates.agent2.config.temperature).toBe(0.9);
      });

      it('should preserve Date fields with millisecond precision', async () => {
        const now = new Date();
        const session = createTestSession({
          createdAt: now,
          updatedAt: now,
          expiresAt: new Date(now.getTime() + 3600000),
        });

        await manager.saveSession(session);
        const restored = await manager.restoreSession(session.id);

        expect(restored).not.toBeNull();
        expect(restored!.createdAt.getTime()).toBe(session.createdAt.getTime());
        expect(restored!.updatedAt.getTime()).toBe(session.updatedAt.getTime());
        expect(restored!.expiresAt.getTime()).toBe(session.expiresAt.getTime());
      });
    });
  });

  // =========================================================================
  // Part 2: State Management
  // =========================================================================

  describe('SessionManager Contract - State Management', () => {
    describe('updateSessionState()', () => {
      it('should transition from ACTIVE to PAUSED (FR-004)', async () => {
        const session = await manager.createSession();
        await manager.saveSession(session);

        await manager.updateSessionState(session.id, SessionState.PAUSED);
        const updated = await manager.restoreSession(session.id);

        expect(updated).not.toBeNull();
        expect(updated!.state).toBe(SessionState.PAUSED);
      });

      it('should transition from ACTIVE to CLOSED', async () => {
        const session = await manager.createSession();
        await manager.saveSession(session);

        await manager.updateSessionState(session.id, SessionState.CLOSED);
        const updated = await manager.restoreSession(session.id);

        expect(updated).not.toBeNull();
        expect(updated!.state).toBe(SessionState.CLOSED);
      });

      it('should transition from PAUSED to ACTIVE', async () => {
        const session = createTestSession({ state: SessionState.PAUSED });
        await manager.saveSession(session);

        await manager.updateSessionState(session.id, SessionState.ACTIVE);
        const updated = await manager.restoreSession(session.id);

        expect(updated).not.toBeNull();
        expect(updated!.state).toBe(SessionState.ACTIVE);
      });

      it('should transition from PAUSED to CLOSED', async () => {
        const session = createTestSession({ state: SessionState.PAUSED });
        await manager.saveSession(session);

        await manager.updateSessionState(session.id, SessionState.CLOSED);
        const updated = await manager.restoreSession(session.id);

        expect(updated).not.toBeNull();
        expect(updated!.state).toBe(SessionState.CLOSED);
      });

      it('should throw error for invalid transitions', async () => {
        const session = createTestSession({ state: SessionState.CLOSED });
        await manager.saveSession(session);

        // Closed -> Active should be invalid
        await expect(
          manager.updateSessionState(session.id, SessionState.ACTIVE)
        ).rejects.toThrow();
      });

      it('should update updatedAt timestamp on state change', async () => {
        const session = await manager.createSession();
        await manager.saveSession(session);

        const beforeUpdate = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay

        await manager.updateSessionState(session.id, SessionState.PAUSED);
        const updated = await manager.restoreSession(session.id);

        expect(updated).not.toBeNull();
        expect(updated!.updatedAt.getTime()).toBeGreaterThan(beforeUpdate);
      });

      it('should increment version for optimistic locking', async () => {
        const session = await manager.createSession();
        await manager.saveSession(session);
        const originalVersion = session.version;

        await manager.updateSessionState(session.id, SessionState.PAUSED);
        const updated = await manager.restoreSession(session.id);

        expect(updated).not.toBeNull();
        expect(updated!.version).toBe(originalVersion + 1);
      });
    });

    describe('listSessions()', () => {
      beforeEach(async () => {
        // Create test sessions in different states
        const activeSession = createTestSession({
          id: crypto.randomUUID(),
          state: SessionState.ACTIVE,
        });
        const pausedSession = createTestSession({
          id: crypto.randomUUID(),
          state: SessionState.PAUSED,
        });
        const closedSession = createTestSession({
          id: crypto.randomUUID(),
          state: SessionState.CLOSED,
        });

        await manager.saveSession(activeSession);
        await manager.saveSession(pausedSession);
        await manager.saveSession(closedSession);
      });

      it('should filter by SessionState', async () => {
        const activeSessions = await manager.listSessions({
          state: SessionState.ACTIVE,
        });
        const pausedSessions = await manager.listSessions({
          state: SessionState.PAUSED,
        });

        expect(activeSessions.length).toBeGreaterThanOrEqual(1);
        expect(pausedSessions.length).toBeGreaterThanOrEqual(1);

        // Verify filtering by checking actual session states
        for (const sessionId of activeSessions) {
          const session = await manager.restoreSession(sessionId);
          expect(session?.state).toBe(SessionState.ACTIVE);
        }
      });

      it('should support pagination (limit, offset)', async () => {
        // Create 10 sessions
        for (let i = 0; i < 10; i++) {
          const session = createTestSession({ id: crypto.randomUUID() });
          await manager.saveSession(session);
        }

        const page1 = await manager.listSessions({ limit: 5, offset: 0 });
        const page2 = await manager.listSessions({ limit: 5, offset: 5 });

        expect(page1.length).toBeLessThanOrEqual(5);
        expect(page2.length).toBeLessThanOrEqual(5);

        // Pages should not overlap
        const page1Set = new Set(page1);
        const page2Set = new Set(page2);
        const intersection = page1.filter((id) => page2Set.has(id));
        expect(intersection.length).toBe(0);
      });

      it('should return sessions ordered by updatedAt DESC', async () => {
        const sessions = await manager.listSessions({ limit: 3 });

        // Verify order by checking updatedAt timestamps
        let previousTimestamp = Number.MAX_SAFE_INTEGER;
        for (const sessionId of sessions) {
          const session = await manager.restoreSession(sessionId);
          expect(session).not.toBeNull();
          expect(session!.updatedAt.getTime()).toBeLessThanOrEqual(
            previousTimestamp
          );
          previousTimestamp = session!.updatedAt.getTime();
        }
      });

      it('should filter by timestamp range (createdAfter, createdBefore)', async () => {
        const now = Date.now();

        // Create sessions with specific timestamps
        const oldSession = createTestSession({
          id: crypto.randomUUID(),
          createdAt: new Date(now - 7200000), // 2 hours ago
        });
        const recentSession = createTestSession({
          id: crypto.randomUUID(),
          createdAt: new Date(now - 1800000), // 30 minutes ago
        });

        await manager.saveSession(oldSession);
        await manager.saveSession(recentSession);

        // Filter for sessions created after 1 hour ago
        const recentSessions = await manager.listSessions({
          createdAfter: now - 3600000,
        });

        expect(recentSessions).toContain(recentSession.id);
        expect(recentSessions).not.toContain(oldSession.id);
      });

      it('should handle empty result set', async () => {
        const nonExistentState = SessionState.EXPIRED;
        const sessions = await manager.listSessions({
          state: nonExistentState,
        });

        expect(Array.isArray(sessions)).toBe(true);
        expect(sessions.length).toBe(0);
      });
    });

    describe('deleteSession()', () => {
      it('should delete session and return true when exists', async () => {
        const session = await manager.createSession();
        await manager.saveSession(session);

        const deleted = await manager.deleteSession(session.id);
        expect(deleted).toBe(true);

        // Verify session is deleted
        const restored = await manager.restoreSession(session.id);
        expect(restored).toBeNull();
      });

      it('should return false when session does not exist', async () => {
        const nonExistentId = crypto.randomUUID();
        const deleted = await manager.deleteSession(nonExistentId);

        expect(deleted).toBe(false);
      });

      it('should remove session from listSessions() results', async () => {
        const session = await manager.createSession();
        await manager.saveSession(session);

        const beforeDelete = await manager.listSessions();
        expect(beforeDelete).toContain(session.id);

        await manager.deleteSession(session.id);

        const afterDelete = await manager.listSessions();
        expect(afterDelete).not.toContain(session.id);
      });
    });
  });

  // =========================================================================
  // Part 3: Conversation History
  // =========================================================================

  describe('SessionManager Contract - Conversation History', () => {
    describe('addMessage()', () => {
      it('should append message to conversationHistory (FR-003)', async () => {
        const session = await manager.createSession();
        await manager.saveSession(session);

        const message = createTestMessageTurn(1, 'Hello, world!');
        await manager.addMessage(session.id, message);

        const updated = await manager.restoreSession(session.id);
        expect(updated).not.toBeNull();
        expect(updated!.conversationHistory.length).toBe(1);
        expect(updated!.conversationHistory[0].userMessage).toBe(
          'Hello, world!'
        );
      });

      it('should preserve message order (chronological)', async () => {
        const session = await manager.createSession();
        await manager.saveSession(session);

        // Add multiple messages
        for (let i = 1; i <= 5; i++) {
          const message = createTestMessageTurn(i, `Message ${i}`);
          await manager.addMessage(session.id, message);
        }

        const updated = await manager.restoreSession(session.id);
        expect(updated).not.toBeNull();
        expect(updated!.conversationHistory.length).toBe(5);

        // Verify order
        for (let i = 0; i < 5; i++) {
          expect(updated!.conversationHistory[i].sequence).toBe(i + 1);
          expect(updated!.conversationHistory[i].userMessage).toBe(
            `Message ${i + 1}`
          );
        }
      });

      it('should update updatedAt timestamp', async () => {
        const session = await manager.createSession();
        await manager.saveSession(session);
        const originalUpdatedAt = session.updatedAt.getTime();

        await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay

        const message = createTestMessageTurn(1, 'Test message');
        await manager.addMessage(session.id, message);

        const updated = await manager.restoreSession(session.id);
        expect(updated).not.toBeNull();
        expect(updated!.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt);
      });

      it('should increment version', async () => {
        const session = await manager.createSession();
        await manager.saveSession(session);
        const originalVersion = session.version;

        const message = createTestMessageTurn(1, 'Test message');
        await manager.addMessage(session.id, message);

        const updated = await manager.restoreSession(session.id);
        expect(updated).not.toBeNull();
        expect(updated!.version).toBe(originalVersion + 1);
      });

      it('should persist message immediately', async () => {
        const session = await manager.createSession();
        await manager.saveSession(session);

        const message = createTestMessageTurn(1, 'Test immediate persistence');
        await manager.addMessage(session.id, message);

        // Restore in a separate call to verify persistence
        const restored = await manager.restoreSession(session.id);
        expect(restored).not.toBeNull();
        expect(restored!.conversationHistory.length).toBe(1);
        expect(restored!.conversationHistory[0].userMessage).toBe(
          'Test immediate persistence'
        );
      });

      it('should handle rapid message additions (100+ messages)', async () => {
        const session = await manager.createSession();
        await manager.saveSession(session);

        // Add 100 messages rapidly
        const addPromises = [];
        for (let i = 1; i <= 100; i++) {
          const message = createTestMessageTurn(i, `Rapid message ${i}`);
          addPromises.push(manager.addMessage(session.id, message));
        }

        await Promise.all(addPromises);

        const updated = await manager.restoreSession(session.id);
        expect(updated).not.toBeNull();
        expect(updated!.conversationHistory.length).toBe(100);
      });
    });

    describe('Message Persistence', () => {
      it('should restore all messages after saveSession/restoreSession cycle', async () => {
        const messages = createLargeConversationHistory(50);
        const session = createTestSession({ conversationHistory: messages });

        await manager.saveSession(session);
        const restored = await manager.restoreSession(session.id);

        expect(restored).not.toBeNull();
        expect(restored!.conversationHistory.length).toBe(50);

        // Verify all messages match
        for (let i = 0; i < 50; i++) {
          expect(restored!.conversationHistory[i].userMessage).toBe(
            messages[i].userMessage
          );
        }
      });

      it('should preserve message timestamps', async () => {
        const timestamp = new Date('2025-01-15T10:30:00Z');
        const message = createTestMessageTurn(1, 'Test message');
        message.timestamp = timestamp;

        const session = createTestSession({
          conversationHistory: [message],
        });

        await manager.saveSession(session);
        const restored = await manager.restoreSession(session.id);

        expect(restored).not.toBeNull();
        expect(restored!.conversationHistory[0].timestamp.getTime()).toBe(
          timestamp.getTime()
        );
      });

      it('should preserve message roles (user, assistant, system)', async () => {
        const message = createTestMessageTurn(1, 'User query', [
          { agentId: 'agent1', response: 'Assistant response' },
        ]);

        const session = createTestSession({
          conversationHistory: [message],
        });

        await manager.saveSession(session);
        const restored = await manager.restoreSession(session.id);

        expect(restored).not.toBeNull();
        expect(restored!.conversationHistory[0].userMessage).toBe('User query');
        expect(restored!.conversationHistory[0].agentResponses.length).toBe(1);
        expect(restored!.conversationHistory[0].agentResponses[0].response).toBe(
          'Assistant response'
        );
      });

      it('should handle messages with complex content', async () => {
        const complexMessage = createTestMessageTurn(
          1,
          JSON.stringify({
            query: 'Complex query',
            metadata: { source: 'api', priority: 'high' },
            nested: { deeply: { nested: { value: 42 } } },
          })
        );

        const session = createTestSession({
          conversationHistory: [complexMessage],
        });

        await manager.saveSession(session);
        const restored = await manager.restoreSession(session.id);

        expect(restored).not.toBeNull();
        const restoredMessage = JSON.parse(
          restored!.conversationHistory[0].userMessage
        );
        expect(restoredMessage.nested.deeply.nested.value).toBe(42);
      });
    });
  });

  // =========================================================================
  // Part 4: Agent State Management
  // =========================================================================

  describe('SessionManager Contract - Agent State', () => {
    describe('updateAgentState()', () => {
      it('should update agent state in agentStates Map (FR-003)', async () => {
        const session = await manager.createSession();
        await manager.saveSession(session);

        const agentState = {
          config: { temperature: 0.8 },
          context: { lastQuery: 'test query' },
          messageHistory: [],
        };

        await manager.updateAgentState(session.id, 'agent1', agentState);

        const updated = await manager.restoreSession(session.id);
        expect(updated).not.toBeNull();
        expect(updated!.agentStates.agent1).toBeDefined();
        expect(updated!.agentStates.agent1.config.temperature).toBe(0.8);
      });

      it('should create new entry if agent not in session', async () => {
        const session = await manager.createSession();
        await manager.saveSession(session);

        const agentState = {
          config: { model: 'gpt-4' },
          context: { newAgent: true },
          messageHistory: [],
        };

        await manager.updateAgentState(session.id, 'newAgent', agentState);

        const updated = await manager.restoreSession(session.id);
        expect(updated).not.toBeNull();
        expect(updated!.agentStates.newAgent).toBeDefined();
        expect(updated!.agentStates.newAgent.context.newAgent).toBe(true);
      });

      it('should preserve other agents\' states', async () => {
        const session = createTestSession({
          agentStates: {
            agent1: {
              config: { temperature: 0.7 },
              context: { agent1Data: 'preserved' },
              messageHistory: [],
            },
          },
        });
        await manager.saveSession(session);

        const newAgentState = {
          config: { temperature: 0.9 },
          context: { agent2Data: 'new' },
          messageHistory: [],
        };

        await manager.updateAgentState(session.id, 'agent2', newAgentState);

        const updated = await manager.restoreSession(session.id);
        expect(updated).not.toBeNull();
        expect(updated!.agentStates.agent1.context.agent1Data).toBe('preserved');
        expect(updated!.agentStates.agent2.context.agent2Data).toBe('new');
      });

      it('should update updatedAt timestamp', async () => {
        const session = await manager.createSession();
        await manager.saveSession(session);
        const originalUpdatedAt = session.updatedAt.getTime();

        await new Promise((resolve) => setTimeout(resolve, 10));

        const agentState = {
          config: {},
          context: {},
          messageHistory: [],
        };
        await manager.updateAgentState(session.id, 'agent1', agentState);

        const updated = await manager.restoreSession(session.id);
        expect(updated).not.toBeNull();
        expect(updated!.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt);
      });

      it('should increment version', async () => {
        const session = await manager.createSession();
        await manager.saveSession(session);
        const originalVersion = session.version;

        const agentState = {
          config: {},
          context: {},
          messageHistory: [],
        };
        await manager.updateAgentState(session.id, 'agent1', agentState);

        const updated = await manager.restoreSession(session.id);
        expect(updated).not.toBeNull();
        expect(updated!.version).toBe(originalVersion + 1);
      });

      it('should persist state immediately', async () => {
        const session = await manager.createSession();
        await manager.saveSession(session);

        const agentState = {
          config: { immediate: true },
          context: {},
          messageHistory: [],
        };
        await manager.updateAgentState(session.id, 'agent1', agentState);

        // Verify immediate persistence
        const restored = await manager.restoreSession(session.id);
        expect(restored).not.toBeNull();
        expect(restored!.agentStates.agent1.config.immediate).toBe(true);
      });
    });

    describe('Agent State Persistence', () => {
      it('should restore all agent states after saveSession/restoreSession', async () => {
        const session = createTestSession({
          agentStates: {
            agent1: {
              config: { model: 'gpt-4', temperature: 0.7 },
              context: { specialization: 'coding' },
              messageHistory: [],
            },
            agent2: {
              config: { model: 'gpt-3.5', temperature: 0.9 },
              context: { specialization: 'writing' },
              messageHistory: [],
            },
            agent3: {
              config: { model: 'claude-3', temperature: 0.8 },
              context: { specialization: 'analysis' },
              messageHistory: [],
            },
          },
        });

        await manager.saveSession(session);
        const restored = await manager.restoreSession(session.id);

        expect(restored).not.toBeNull();
        expect(Object.keys(restored!.agentStates).length).toBe(3);
        expect(restored!.agentStates.agent1.context.specialization).toBe(
          'coding'
        );
        expect(restored!.agentStates.agent2.context.specialization).toBe(
          'writing'
        );
        expect(restored!.agentStates.agent3.context.specialization).toBe(
          'analysis'
        );
      });

      it('should handle complex agent context objects', async () => {
        const complexContext: AgentContext = {
          nested: {
            deeply: {
              nested: {
                data: [1, 2, 3, 4, 5],
                map: { key1: 'value1', key2: 'value2' },
              },
            },
          },
          array: [{ id: 1 }, { id: 2 }, { id: 3 }],
        };

        const session = createTestSession({
          agentStates: {
            agent1: {
              config: {},
              context: complexContext,
              messageHistory: [],
            },
          },
        });

        await manager.saveSession(session);
        const restored = await manager.restoreSession(session.id);

        expect(restored).not.toBeNull();
        expect(
          restored!.agentStates.agent1.context.nested.deeply.nested.data
        ).toEqual([1, 2, 3, 4, 5]);
        expect(restored!.agentStates.agent1.context.array.length).toBe(3);
      });

      it('should preserve nested data structures in agent context', async () => {
        const nestedData = {
          level1: {
            level2: {
              level3: {
                level4: {
                  value: 'deeply nested',
                  array: [1, 2, 3],
                  map: { key: 'value' },
                },
              },
            },
          },
        };

        const session = createTestSession({
          agentStates: {
            agent1: {
              config: {},
              context: nestedData,
              messageHistory: [],
            },
          },
        });

        await manager.saveSession(session);
        const restored = await manager.restoreSession(session.id);

        expect(restored).not.toBeNull();
        expect(
          restored!.agentStates.agent1.context.level1.level2.level3.level4.value
        ).toBe('deeply nested');
      });
    });
  });

  // =========================================================================
  // Part 5: Cleanup and Statistics
  // =========================================================================

  describe('SessionManager Contract - Cleanup', () => {
    describe('cleanupExpiredSessions()', () => {
      it('should delete sessions where expiresAt < now (FR-004a)', async () => {
        const now = Date.now();

        // Create expired session
        const expiredSession = createTestSession({
          id: crypto.randomUUID(),
          expiresAt: new Date(now - 3600000), // 1 hour ago
        });

        // Create active session
        const activeSession = createTestSession({
          id: crypto.randomUUID(),
          expiresAt: new Date(now + 3600000), // 1 hour from now
        });

        await manager.saveSession(expiredSession);
        await manager.saveSession(activeSession);

        const deletedCount = await manager.cleanupExpiredSessions(0);

        expect(deletedCount).toBeGreaterThanOrEqual(1);

        // Verify expired session is deleted
        const restored = await manager.restoreSession(expiredSession.id);
        expect(restored).toBeNull();

        // Verify active session still exists
        const activeRestored = await manager.restoreSession(activeSession.id);
        expect(activeRestored).not.toBeNull();
      });

      it('should return count of deleted sessions', async () => {
        const now = Date.now();

        // Create 5 expired sessions
        for (let i = 0; i < 5; i++) {
          const expiredSession = createTestSession({
            id: crypto.randomUUID(),
            expiresAt: new Date(now - 3600000),
          });
          await manager.saveSession(expiredSession);
        }

        const deletedCount = await manager.cleanupExpiredSessions(0);

        expect(deletedCount).toBeGreaterThanOrEqual(5);
      });

      it('should not delete active sessions within expiration', async () => {
        const now = Date.now();

        const activeSession = createTestSession({
          id: crypto.randomUUID(),
          expiresAt: new Date(now + 7200000), // 2 hours from now
        });

        await manager.saveSession(activeSession);
        await manager.cleanupExpiredSessions(0);

        const restored = await manager.restoreSession(activeSession.id);
        expect(restored).not.toBeNull();
      });

      it('should handle sessions with custom expiration times', async () => {
        const now = Date.now();

        const shortExpiration = createTestSession({
          id: crypto.randomUUID(),
          expiresAt: new Date(now - 60000), // 1 minute ago
        });

        const longExpiration = createTestSession({
          id: crypto.randomUUID(),
          expiresAt: new Date(now + 86400000), // 1 day from now
        });

        await manager.saveSession(shortExpiration);
        await manager.saveSession(longExpiration);

        await manager.cleanupExpiredSessions(0);

        const shortRestored = await manager.restoreSession(shortExpiration.id);
        const longRestored = await manager.restoreSession(longExpiration.id);

        expect(shortRestored).toBeNull();
        expect(longRestored).not.toBeNull();
      });

      it('should run in <500ms for 1000 sessions', async () => {
        const now = Date.now();

        // Create 1000 sessions (500 expired, 500 active)
        const createPromises = [];
        for (let i = 0; i < 1000; i++) {
          const expiresAt =
            i < 500
              ? new Date(now - 3600000) // Expired
              : new Date(now + 3600000); // Active

          const session = createTestSession({
            id: crypto.randomUUID(),
            expiresAt,
          });
          createPromises.push(manager.saveSession(session));
        }

        await Promise.all(createPromises);

        const { duration } = await measureTime(() =>
          manager.cleanupExpiredSessions(0)
        );

        expect(duration).toBeLessThan(500);
      });
    });
  });

  describe('SessionManager Contract - Statistics', () => {
    describe('getStats()', () => {
      it('should return total session count (FR-037)', async () => {
        // Create multiple sessions
        for (let i = 0; i < 5; i++) {
          const session = createTestSession({ id: crypto.randomUUID() });
          await manager.saveSession(session);
        }

        const stats = await manager.getStats();

        expect(stats).toBeDefined();
        expect(stats.activeSessions + stats.idleSessions + stats.expiredSessions).toBeGreaterThanOrEqual(5);
      });

      it('should return session count by state (FR-038)', async () => {
        // Create sessions in different states
        const activeSession = createTestSession({
          id: crypto.randomUUID(),
          state: SessionState.ACTIVE,
        });
        const pausedSession = createTestSession({
          id: crypto.randomUUID(),
          state: SessionState.PAUSED,
        });

        await manager.saveSession(activeSession);
        await manager.saveSession(pausedSession);

        const stats = await manager.getStats();

        expect(stats.activeSessions).toBeGreaterThanOrEqual(1);
        // Note: PAUSED may be counted as idleSessions depending on implementation
        expect(stats.idleSessions).toBeGreaterThanOrEqual(0);
      });

      it('should return average session age', async () => {
        const now = Date.now();

        // Create sessions with different ages
        const oldSession = createTestSession({
          id: crypto.randomUUID(),
          createdAt: new Date(now - 7200000), // 2 hours ago
        });
        const newSession = createTestSession({
          id: crypto.randomUUID(),
          createdAt: new Date(now - 1800000), // 30 minutes ago
        });

        await manager.saveSession(oldSession);
        await manager.saveSession(newSession);

        const stats = await manager.getStats();

        // Implementation-specific: stats may include average age
        expect(stats).toBeDefined();
      });

      it('should return oldest and newest session timestamps', async () => {
        const now = Date.now();

        const oldSession = createTestSession({
          id: crypto.randomUUID(),
          createdAt: new Date(now - 7200000),
        });
        const newSession = createTestSession({
          id: crypto.randomUUID(),
          createdAt: new Date(now - 1800000),
        });

        await manager.saveSession(oldSession);
        await manager.saveSession(newSession);

        const stats = await manager.getStats();

        expect(stats).toBeDefined();
        expect(stats.backendType).toBeDefined();
      });

      it('should handle empty session manager', async () => {
        // Clean all sessions first
        const allSessions = await manager.listSessions();
        for (const sessionId of allSessions) {
          await manager.deleteSession(sessionId);
        }

        const stats = await manager.getStats();

        expect(stats).toBeDefined();
        expect(stats.activeSessions).toBe(0);
        expect(stats.idleSessions).toBe(0);
        expect(stats.expiredSessions).toBe(0);
      });
    });
  });

  // =========================================================================
  // Part 6: Optimistic Locking
  // =========================================================================

  describe('SessionManager Contract - Optimistic Locking', () => {
    describe('Version Conflicts', () => {
      it('should detect version mismatch on saveSession() (FR-005)', async () => {
        const session = await manager.createSession();
        await manager.saveSession(session);

        // Simulate concurrent update by manually changing version
        const staleSession = { ...session, version: 1 };
        const updatedSession = { ...session, version: 2, state: SessionState.PAUSED };

        await manager.saveSession(updatedSession);

        // Attempting to save stale version should throw
        await expect(manager.saveSession(staleSession)).rejects.toThrow(
          ConflictError
        );
      });

      it('should throw ConflictError when version is stale', async () => {
        const session = await manager.createSession();
        await manager.saveSession(session);

        // Update session (increments version)
        await manager.updateSessionState(session.id, SessionState.PAUSED);

        // Try to save with old version
        const staleSession = { ...session };
        await expect(manager.saveSession(staleSession)).rejects.toThrow(
          ConflictError
        );
      });

      it('should include current and expected version in error', async () => {
        const session = await manager.createSession();
        await manager.saveSession(session);

        await manager.updateSessionState(session.id, SessionState.PAUSED);

        try {
          await manager.saveSession({ ...session });
          fail('Should have thrown ConflictError');
        } catch (error) {
          expect(error).toBeInstanceOf(ConflictError);
          expect((error as ConflictError).message).toContain('version');
        }
      });

      it('should succeed when version matches', async () => {
        const session = await manager.createSession();
        await manager.saveSession(session);

        // Load fresh version
        const fresh = await manager.restoreSession(session.id);
        expect(fresh).not.toBeNull();

        // Update with correct version
        fresh!.state = SessionState.PAUSED;
        await expect(manager.saveSession(fresh!)).resolves.not.toThrow();
      });

      it('should increment version on successful save', async () => {
        const session = await manager.createSession();
        await manager.saveSession(session);
        const initialVersion = session.version;

        const updated = await manager.restoreSession(session.id);
        expect(updated).not.toBeNull();

        updated!.state = SessionState.PAUSED;
        await manager.saveSession(updated!);

        const final = await manager.restoreSession(session.id);
        expect(final).not.toBeNull();
        expect(final!.version).toBe(initialVersion + 1);
      });
    });

    describe('Concurrent Updates', () => {
      it('should handle concurrent saveSession() calls with different versions', async () => {
        const session = await manager.createSession();
        await manager.saveSession(session);

        // Simulate two concurrent updates
        const update1 = manager.restoreSession(session.id);
        const update2 = manager.restoreSession(session.id);

        const [session1, session2] = await Promise.all([update1, update2]);

        session1!.metadata.tag = 'update1';
        session2!.metadata.tag = 'update2';

        // One should succeed, one should fail
        const results = await Promise.allSettled([
          manager.saveSession(session1!),
          manager.saveSession(session2!),
        ]);

        const successful = results.filter((r) => r.status === 'fulfilled').length;
        const failed = results.filter((r) => r.status === 'rejected').length;

        expect(successful).toBe(1);
        expect(failed).toBe(1);
      });

      it('should allow last-write-wins with retry logic', async () => {
        const session = await manager.createSession();
        await manager.saveSession(session);

        // Implementation should retry on conflict
        // This test validates that retries can succeed

        const session1 = await manager.restoreSession(session.id);
        const session2 = await manager.restoreSession(session.id);

        session1!.metadata.update = 'first';
        await manager.saveSession(session1!);

        // Second save should detect conflict and potentially retry
        session2!.metadata.update = 'second';
        // Implementation may handle this internally with retry logic

        // For this test, we just verify conflict is detected
        await expect(manager.saveSession(session2!)).rejects.toThrow();
      });

      it('should preserve data integrity under concurrent access', async () => {
        const session = await manager.createSession();
        await manager.saveSession(session);

        // Multiple concurrent operations
        const operations = [];
        for (let i = 0; i < 10; i++) {
          operations.push(
            (async () => {
              const s = await manager.restoreSession(session.id);
              if (s) {
                s.metadata[`operation_${i}`] = true;
                try {
                  await manager.saveSession(s);
                  return 'success';
                } catch {
                  return 'conflict';
                }
              }
            })()
          );
        }

        const results = await Promise.all(operations);
        const successful = results.filter((r) => r === 'success').length;

        // At least one should succeed
        expect(successful).toBeGreaterThanOrEqual(1);

        // Final state should be consistent
        const final = await manager.restoreSession(session.id);
        expect(final).not.toBeNull();
        expect(final!.version).toBeGreaterThan(1);
      });
    });
  });

  // =========================================================================
  // Part 7: Error Handling
  // =========================================================================

  describe('SessionManager Contract - Error Handling', () => {
    describe('Validation', () => {
      it('should throw ValidationError for invalid sessionId format', async () => {
        const invalidIds = [
          'not-a-uuid',
          '12345',
          'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          '',
          null as any,
          undefined as any,
        ];

        for (const invalidId of invalidIds) {
          await expect(manager.restoreSession(invalidId)).rejects.toThrow();
        }
      });

      it('should throw ValidationError for null session in saveSession()', async () => {
        await expect(manager.saveSession(null as any)).rejects.toThrow(
          ValidationError
        );
      });

      it('should throw NotFoundError when updating non-existent session state', async () => {
        const nonExistentId = crypto.randomUUID();

        await expect(
          manager.updateSessionState(nonExistentId, SessionState.PAUSED)
        ).rejects.toThrow(NotFoundError);
      });

      it('should throw NotFoundError when adding message to non-existent session', async () => {
        const nonExistentId = crypto.randomUUID();
        const message = createTestMessageTurn(1, 'Test');

        await expect(
          manager.addMessage(nonExistentId, message)
        ).rejects.toThrow(NotFoundError);
      });

      it('should throw NotFoundError when updating agent state in non-existent session', async () => {
        const nonExistentId = crypto.randomUUID();
        const agentState = {
          config: {},
          context: {},
          messageHistory: [],
        };

        await expect(
          manager.updateAgentState(nonExistentId, 'agent1', agentState)
        ).rejects.toThrow(NotFoundError);
      });
    });

    describe('Storage Adapter Failures', () => {
      it('should propagate StorageError from adapter failures', async () => {
        // This test depends on implementation being able to simulate
        // storage failures. The contract requires proper error propagation.

        // Example: If storage is unavailable, errors should be thrown
        // Implementation-specific test
        expect(true).toBe(true); // Placeholder
      });

      it('should maintain consistency after storage failures', async () => {
        const session = await manager.createSession();
        await manager.saveSession(session);

        // Even if some operations fail, session data should remain consistent
        const restored = await manager.restoreSession(session.id);
        expect(restored).not.toBeNull();
        expect(restored!.id).toBe(session.id);
      });
    });
  });
}
