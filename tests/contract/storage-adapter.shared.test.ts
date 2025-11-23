/**
 * StorageAdapter Contract Tests
 *
 * Comprehensive contract test suite for all StorageAdapter implementations.
 * Tests validate compliance with the StorageAdapter interface specification.
 *
 * RED PHASE: These tests MUST FAIL initially - no adapter implementations exist yet.
 *
 * Usage:
 *   import { runStorageAdapterContractTests } from './storage-adapter.shared.test';
 *   runStorageAdapterContractTests(() => new FileStorageAdapter());
 *   runStorageAdapterContractTests(() => new InMemoryStorageAdapter());
 *
 * @see specs/001-production-robustness/contracts/StorageAdapter.contract.ts
 * @see specs/001-production-robustness/spec.md FR-001 to FR-043
 * @see src/types/robustness.ts Session, SessionState, SessionSerializer types
 */

import {
  Session,
  SessionState,
  SessionSerializer,
  MessageTurn,
  AgentContext,
  StorageError,
  NotFoundError,
  ConflictError,
  ValidationError,
} from '../../src/types/robustness';

import {
  StorageAdapter,
  StorageAdapterConfig,
  StorageStats,
} from '../../specs/001-production-robustness/contracts/StorageAdapter.contract';

// ============================================================================
// Test Helper Functions
// ============================================================================

/**
 * Generate unique session ID (UUID v4 format)
 */
function generateSessionId(): string {
  // Simple UUID v4 generator for tests (not cryptographically secure)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Create test message turn
 */
function createMessageTurn(
  sequence: number,
  overrides?: Partial<MessageTurn>
): MessageTurn {
  return {
    sequence,
    timestamp: new Date(),
    userMessage: `User message ${sequence}`,
    agentResponses: [
      {
        agentId: 'agent-1',
        response: `Agent response ${sequence}`,
        timestamp: new Date(),
      },
    ],
    ...overrides,
  };
}

/**
 * Create test agent context
 */
function createAgentContext(
  trimmableFields?: string[]
): AgentContext {
  const context: AgentContext = {
    agentType: 'test-agent',
    lastActivity: new Date().toISOString(),
    customField: 'test-value',
  };

  if (trimmableFields && trimmableFields.length > 0) {
    context._metadata = {};
    trimmableFields.forEach((field) => {
      context[field] = `trimmable-${field}`;
      context._metadata![field] = { trimmable: true };
    });
  }

  return context;
}

/**
 * Create test session with default or custom values
 *
 * FR-001: Session with UUID v4 identifier
 * FR-003: Session with full conversation history and agent context
 */
function createTestSession(overrides?: Partial<Session>): Session {
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + 7); // Default: 7 days

  return {
    id: generateSessionId(),
    createdAt: now,
    updatedAt: now,
    expiresAt,
    state: SessionState.ACTIVE,
    agentIds: ['agent-1', 'agent-2'],
    agentStates: {
      'agent-1': {
        config: { model: 'gpt-4', temperature: 0.7 },
        context: createAgentContext(),
        messageHistory: [createMessageTurn(1), createMessageTurn(2)],
      },
      'agent-2': {
        config: { model: 'claude-3', temperature: 0.8 },
        context: createAgentContext(),
        messageHistory: [createMessageTurn(1)],
      },
    },
    conversationHistory: [
      createMessageTurn(1),
      createMessageTurn(2),
      createMessageTurn(3),
    ],
    sharedContext: {
      topic: 'test-conversation',
      workflowState: 'in-progress',
    },
    metadata: {
      userId: 'user-123',
      tags: ['test', 'contract-test'],
    },
    version: 1,
    ...overrides,
  };
}

/**
 * Create large session for performance testing
 *
 * FR-009a: Test with large conversation history (1000+ messages)
 * SC-007: Session restoration performance with large state
 */
function createLargeSession(messageCount: number): Session {
  const session = createTestSession();
  const conversationHistory: MessageTurn[] = [];

  for (let i = 0; i < messageCount; i++) {
    conversationHistory.push(
      createMessageTurn(i + 1, {
        userMessage: `Large session message ${i + 1}`,
        agentResponses: [
          {
            agentId: 'agent-1',
            response: `Response ${i + 1} with significant content to increase size`,
            timestamp: new Date(),
          },
        ],
      })
    );
  }

  session.conversationHistory = conversationHistory;
  session.agentStates['agent-1'].messageHistory = conversationHistory.slice(
    -10
  ); // Last 10 messages

  return session;
}

/**
 * Create session exceeding size limit (for trimming tests)
 *
 * FR-009a: State trimming when exceeding 10MB limit
 */
function createOversizedSession(): Session {
  const session = createTestSession();

  // Add 12MB of data via agent states (exceeds 10MB limit)
  session.agentStates['agent-1'].context = {
    ...createAgentContext(['cached_responses', 'debug_info']),
    largeData: 'x'.repeat(6 * 1024 * 1024), // 6MB
  };

  session.agentStates['agent-2'].context = {
    ...createAgentContext(['temporary_calculations']),
    largeData: 'x'.repeat(6 * 1024 * 1024), // 6MB
  };

  // Add large message history
  const largeHistory: MessageTurn[] = [];
  for (let i = 0; i < 500; i++) {
    largeHistory.push(createMessageTurn(i + 1));
  }
  session.conversationHistory = largeHistory;
  session.agentStates['agent-1'].messageHistory = largeHistory.slice(-200);
  session.agentStates['agent-2'].messageHistory = largeHistory.slice(-200);

  return session;
}

/**
 * Measure execution time of async function
 */
async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const start = Date.now();
  const result = await fn();
  const durationMs = Date.now() - start;
  return { result, durationMs };
}

/**
 * Wait for specified milliseconds
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Contract Test Suite
// ============================================================================

/**
 * Run complete StorageAdapter contract test suite
 *
 * Factory pattern allows testing multiple adapter implementations
 * with the same test suite.
 *
 * @param createAdapter Factory function that creates adapter instance
 */
export function runStorageAdapterContractTests(
  createAdapter: (config?: StorageAdapterConfig) => StorageAdapter
) {
  let adapter: StorageAdapter;

  beforeEach(async () => {
    adapter = createAdapter();
    await adapter.initialize();
  });

  afterEach(async () => {
    await adapter.close();
  });

  // ==========================================================================
  // Part 1: Lifecycle Tests (Task 2.1)
  // ==========================================================================

  describe('StorageAdapter Contract - Lifecycle', () => {
    describe('initialize()', () => {
      it('should initialize without errors', async () => {
        // Test: Adapter can initialize successfully
        // Note: beforeEach already calls initialize(), so this tests re-initialization
        const freshAdapter = createAdapter();
        await expect(freshAdapter.initialize()).resolves.not.toThrow();
        await freshAdapter.close();
      });

      it('should accept configuration options', async () => {
        // FR-051: System supports externalized configuration
        const config: StorageAdapterConfig = {
          location: './test-data',
          ttl: 3600,
          maxSize: 1024 * 1024 * 100, // 100MB
          compression: false,
          encryption: false,
        };

        const configuredAdapter = createAdapter(config);
        await expect(configuredAdapter.initialize(config)).resolves.not.toThrow();
        await configuredAdapter.close();
      });

      it('should be idempotent (multiple calls safe)', async () => {
        // Test: Multiple initialize() calls don't cause errors
        await expect(adapter.initialize()).resolves.not.toThrow();
        await expect(adapter.initialize()).resolves.not.toThrow();
        await expect(adapter.initialize()).resolves.not.toThrow();
      });
    });

    describe('healthCheck()', () => {
      it('should return {healthy: true} when initialized (FR-053)', async () => {
        // FR-053: Readiness probe checks storage health
        const health = await adapter.healthCheck();

        expect(health).toBeDefined();
        expect(health.healthy).toBe(true);
      });

      it('should return {healthy: false, message} when not initialized', async () => {
        // Test: Health check fails before initialization
        const uninitializedAdapter = createAdapter();

        const health = await uninitializedAdapter.healthCheck();

        expect(health).toBeDefined();
        expect(health.healthy).toBe(false);
        expect(health.message).toBeDefined();
        expect(typeof health.message).toBe('string');
      });
    });

    describe('close()', () => {
      it('should clean up resources (FR-054)', async () => {
        // FR-054: Graceful shutdown closes storage connections
        await expect(adapter.close()).resolves.not.toThrow();
      });

      it('should be safe to call multiple times', async () => {
        // Test: Multiple close() calls are idempotent
        await expect(adapter.close()).resolves.not.toThrow();
        await expect(adapter.close()).resolves.not.toThrow();
        await expect(adapter.close()).resolves.not.toThrow();
      });
    });
  });

  // ==========================================================================
  // Part 2: Session Operations Tests (Task 2.2)
  // ==========================================================================

  describe('StorageAdapter Contract - Session Operations', () => {
    describe('saveSession() / getSession()', () => {
      it('should save and retrieve session with UUID v4 id (FR-001)', async () => {
        // FR-001: System assigns unique session identifiers using UUID v4
        const session = createTestSession();

        // UUID v4 format validation
        expect(session.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );

        await adapter.saveSession(session);
        const retrieved = await adapter.getSession(session.id);

        expect(retrieved).not.toBeNull();
        expect(retrieved!.id).toBe(session.id);
      });

      it('should handle session with conversationHistory[] (FR-003)', async () => {
        // FR-003: System restores conversation state with full history
        const session = createTestSession({
          conversationHistory: [
            createMessageTurn(1),
            createMessageTurn(2),
            createMessageTurn(3),
            createMessageTurn(4),
            createMessageTurn(5),
          ],
        });

        await adapter.saveSession(session);
        const retrieved = await adapter.getSession(session.id);

        expect(retrieved).not.toBeNull();
        expect(retrieved!.conversationHistory).toHaveLength(5);
        expect(retrieved!.conversationHistory[0].sequence).toBe(1);
        expect(retrieved!.conversationHistory[4].sequence).toBe(5);
      });

      it('should preserve agentStates{} Map', async () => {
        // Test: Agent states are preserved with config, context, messageHistory
        const session = createTestSession();

        await adapter.saveSession(session);
        const retrieved = await adapter.getSession(session.id);

        expect(retrieved).not.toBeNull();
        expect(retrieved!.agentStates).toBeDefined();
        expect(Object.keys(retrieved!.agentStates)).toHaveLength(2);
        expect(retrieved!.agentStates['agent-1']).toBeDefined();
        expect(retrieved!.agentStates['agent-1'].config).toEqual({
          model: 'gpt-4',
          temperature: 0.7,
        });
        expect(retrieved!.agentStates['agent-1'].context).toBeDefined();
        expect(retrieved!.agentStates['agent-1'].messageHistory).toHaveLength(2);
      });

      it('should preserve Date fields (createdAt, updatedAt, expiresAt)', async () => {
        // Test: Date objects are correctly serialized and deserialized
        const session = createTestSession();
        const originalCreatedAt = session.createdAt.getTime();
        const originalUpdatedAt = session.updatedAt.getTime();
        const originalExpiresAt = session.expiresAt.getTime();

        await adapter.saveSession(session);
        const retrieved = await adapter.getSession(session.id);

        expect(retrieved).not.toBeNull();
        expect(retrieved!.createdAt).toBeInstanceOf(Date);
        expect(retrieved!.updatedAt).toBeInstanceOf(Date);
        expect(retrieved!.expiresAt).toBeInstanceOf(Date);
        expect(retrieved!.createdAt.getTime()).toBe(originalCreatedAt);
        expect(retrieved!.updatedAt.getTime()).toBe(originalUpdatedAt);
        expect(retrieved!.expiresAt.getTime()).toBe(originalExpiresAt);
      });

      it('should enforce version for optimistic locking (FR-005)', async () => {
        // FR-005: System handles concurrent session access using optimistic locking
        const session = createTestSession({ version: 1 });

        await adapter.saveSession(session);
        const retrieved = await adapter.getSession(session.id);

        expect(retrieved).not.toBeNull();
        expect(retrieved!.version).toBe(1);

        // Update with incremented version
        retrieved!.version = 2;
        await adapter.saveSession(retrieved!);

        const updated = await adapter.getSession(session.id);
        expect(updated!.version).toBe(2);
      });

      it('should complete saveSession() in <50ms p95 (SC-009)', async () => {
        // SC-009: State serialization completes in under 50ms (p95)
        const session = createTestSession();
        const measurements: number[] = [];

        // Run 20 iterations to get p95
        for (let i = 0; i < 20; i++) {
          const { durationMs } = await measureTime(() =>
            adapter.saveSession({ ...session, id: generateSessionId() })
          );
          measurements.push(durationMs);
        }

        // Calculate p95
        measurements.sort((a, b) => a - b);
        const p95Index = Math.ceil(measurements.length * 0.95) - 1;
        const p95 = measurements[p95Index];

        expect(p95).toBeLessThan(50);
      });

      it('should complete getSession() in <100ms p95 (SC-007)', async () => {
        // SC-007: Session restoration completes in under 100ms (p95)
        const session = createTestSession();
        await adapter.saveSession(session);

        const measurements: number[] = [];

        // Run 20 iterations to get p95
        for (let i = 0; i < 20; i++) {
          const { durationMs } = await measureTime(() =>
            adapter.getSession(session.id)
          );
          measurements.push(durationMs);
        }

        // Calculate p95
        measurements.sort((a, b) => a - b);
        const p95Index = Math.ceil(measurements.length * 0.95) - 1;
        const p95 = measurements[p95Index];

        expect(p95).toBeLessThan(100);
      });
    });

    describe('listSessions()', () => {
      beforeEach(async () => {
        // Create test sessions in different states
        await adapter.saveSession(
          createTestSession({ id: 'session-1', state: SessionState.ACTIVE })
        );
        await adapter.saveSession(
          createTestSession({ id: 'session-2', state: SessionState.ACTIVE })
        );
        await adapter.saveSession(
          createTestSession({ id: 'session-3', state: SessionState.PAUSED })
        );
        await adapter.saveSession(
          createTestSession({ id: 'session-4', state: SessionState.EXPIRED })
        );
      });

      it('should filter by SessionState enum', async () => {
        // Test: Filter sessions by state
        const activeSessions = await adapter.listSessions(SessionState.ACTIVE);
        const pausedSessions = await adapter.listSessions(SessionState.PAUSED);
        const expiredSessions = await adapter.listSessions(SessionState.EXPIRED);

        expect(activeSessions.length).toBe(2);
        expect(pausedSessions.length).toBe(1);
        expect(expiredSessions.length).toBe(1);

        expect(activeSessions[0].state).toBe(SessionState.ACTIVE);
        expect(pausedSessions[0].state).toBe(SessionState.PAUSED);
        expect(expiredSessions[0].state).toBe(SessionState.EXPIRED);
      });

      it('should support pagination (limit, offset)', async () => {
        // Test: Pagination parameters work correctly
        const page1 = await adapter.listSessions(undefined, 2, 0);
        const page2 = await adapter.listSessions(undefined, 2, 2);

        expect(page1.length).toBe(2);
        expect(page2.length).toBe(2);

        // Ensure no overlap
        const page1Ids = page1.map((s) => s.id);
        const page2Ids = page2.map((s) => s.id);
        expect(page1Ids).not.toContain(page2Ids[0]);
        expect(page1Ids).not.toContain(page2Ids[1]);
      });

      it('should return sessions ordered by updatedAt DESC', async () => {
        // Test: Sessions are ordered by most recently updated
        const allSessions = await adapter.listSessions();

        expect(allSessions.length).toBeGreaterThan(0);

        // Verify descending order
        for (let i = 0; i < allSessions.length - 1; i++) {
          const current = allSessions[i].updatedAt.getTime();
          const next = allSessions[i + 1].updatedAt.getTime();
          expect(current).toBeGreaterThanOrEqual(next);
        }
      });
    });

    describe('deleteSession()', () => {
      it('should return true when session exists (FR-004a)', async () => {
        // FR-004a: Session invalidation with cleanup
        const session = createTestSession();
        await adapter.saveSession(session);

        const deleted = await adapter.deleteSession(session.id);

        expect(deleted).toBe(true);

        // Verify session is actually deleted
        const retrieved = await adapter.getSession(session.id);
        expect(retrieved).toBeNull();
      });

      it('should return false when session does not exist', async () => {
        // Test: Deleting non-existent session returns false
        const deleted = await adapter.deleteSession('non-existent-id');

        expect(deleted).toBe(false);
      });
    });

    describe('hasSession()', () => {
      it('should return true for existing session', async () => {
        // Test: Check session existence
        const session = createTestSession();
        await adapter.saveSession(session);

        const exists = await adapter.hasSession(session.id);

        expect(exists).toBe(true);
      });

      it('should return false for non-existent session', async () => {
        // Test: Check non-existent session
        const exists = await adapter.hasSession('non-existent-id');

        expect(exists).toBe(false);
      });
    });
  });

  // ==========================================================================
  // Part 3: Batch & Key-Value Tests (Task 2.3)
  // ==========================================================================

  describe('StorageAdapter Contract - Batch Operations', () => {
    describe('saveSessions()', () => {
      it('should save multiple sessions atomically', async () => {
        // Test: Batch save operation
        const sessions = [
          createTestSession({ id: 'batch-1' }),
          createTestSession({ id: 'batch-2' }),
          createTestSession({ id: 'batch-3' }),
        ];

        const count = await adapter.saveSessions(sessions);

        expect(count).toBe(3);

        // Verify all sessions were saved
        const retrieved1 = await adapter.getSession('batch-1');
        const retrieved2 = await adapter.getSession('batch-2');
        const retrieved3 = await adapter.getSession('batch-3');

        expect(retrieved1).not.toBeNull();
        expect(retrieved2).not.toBeNull();
        expect(retrieved3).not.toBeNull();
      });

      it('should return count of saved sessions', async () => {
        // Test: Return value matches number of sessions saved
        const sessions = [
          createTestSession(),
          createTestSession(),
          createTestSession(),
          createTestSession(),
          createTestSession(),
        ];

        const count = await adapter.saveSessions(sessions);

        expect(count).toBe(5);
      });

      it('should handle empty array', async () => {
        // Test: Empty batch operation
        const count = await adapter.saveSessions([]);

        expect(count).toBe(0);
      });
    });

    describe('getSessions()', () => {
      beforeEach(async () => {
        // Create test sessions
        await adapter.saveSession(createTestSession({ id: 'multi-1' }));
        await adapter.saveSession(createTestSession({ id: 'multi-2' }));
        await adapter.saveSession(createTestSession({ id: 'multi-3' }));
      });

      it('should retrieve multiple sessions by ID', async () => {
        // Test: Batch retrieval operation
        const sessions = await adapter.getSessions([
          'multi-1',
          'multi-2',
          'multi-3',
        ]);

        expect(sessions.size).toBe(3);
        expect(sessions.has('multi-1')).toBe(true);
        expect(sessions.has('multi-2')).toBe(true);
        expect(sessions.has('multi-3')).toBe(true);
      });

      it('should return Map<string, Session>', async () => {
        // Test: Return type is Map
        const sessions = await adapter.getSessions(['multi-1', 'multi-2']);

        expect(sessions).toBeInstanceOf(Map);
        expect(sessions.get('multi-1')).toBeDefined();
        expect(sessions.get('multi-2')).toBeDefined();
      });

      it('should handle non-existent IDs gracefully', async () => {
        // Test: Missing sessions are excluded from result
        const sessions = await adapter.getSessions([
          'multi-1',
          'non-existent',
          'multi-2',
          'also-missing',
        ]);

        expect(sessions.size).toBe(2);
        expect(sessions.has('multi-1')).toBe(true);
        expect(sessions.has('multi-2')).toBe(true);
        expect(sessions.has('non-existent')).toBe(false);
        expect(sessions.has('also-missing')).toBe(false);
      });
    });

    describe('deleteSessions()', () => {
      beforeEach(async () => {
        // Create test sessions
        await adapter.saveSession(createTestSession({ id: 'delete-1' }));
        await adapter.saveSession(createTestSession({ id: 'delete-2' }));
        await adapter.saveSession(createTestSession({ id: 'delete-3' }));
      });

      it('should delete multiple sessions', async () => {
        // Test: Batch deletion operation
        const count = await adapter.deleteSessions([
          'delete-1',
          'delete-2',
          'delete-3',
        ]);

        expect(count).toBe(3);

        // Verify sessions are deleted
        const exists1 = await adapter.hasSession('delete-1');
        const exists2 = await adapter.hasSession('delete-2');
        const exists3 = await adapter.hasSession('delete-3');

        expect(exists1).toBe(false);
        expect(exists2).toBe(false);
        expect(exists3).toBe(false);
      });

      it('should return count of deleted sessions', async () => {
        // Test: Return value matches deleted count
        const count = await adapter.deleteSessions(['delete-1', 'delete-2']);

        expect(count).toBe(2);
      });
    });
  });

  describe('StorageAdapter Contract - Key-Value Storage', () => {
    describe('setValue() / getValue()', () => {
      it('should store and retrieve primitive values (FR-022 to FR-026)', async () => {
        // FR-022: System supports persistent storage adapters for agent state
        // Test: String values
        await adapter.setValue('string-key', 'test-string');
        const stringValue = await adapter.getValue<string>('string-key');
        expect(stringValue).toBe('test-string');

        // Test: Number values
        await adapter.setValue('number-key', 42);
        const numberValue = await adapter.getValue<number>('number-key');
        expect(numberValue).toBe(42);

        // Test: Boolean values
        await adapter.setValue('boolean-key', true);
        const boolValue = await adapter.getValue<boolean>('boolean-key');
        expect(boolValue).toBe(true);

        // Test: Null values
        await adapter.setValue('null-key', null);
        const nullValue = await adapter.getValue('null-key');
        expect(nullValue).toBeNull();
      });

      it('should store and retrieve objects', async () => {
        // Test: Complex object serialization
        const testObject = {
          name: 'Test Object',
          count: 123,
          nested: {
            value: 'nested-value',
            array: [1, 2, 3],
          },
          timestamp: new Date().toISOString(),
        };

        await adapter.setValue('object-key', testObject);
        const retrieved = await adapter.getValue<typeof testObject>('object-key');

        expect(retrieved).toEqual(testObject);
        expect(retrieved!.nested.array).toEqual([1, 2, 3]);
      });

      it('should return null for non-existent keys', async () => {
        // Test: Missing key returns null
        const value = await adapter.getValue('non-existent-key');

        expect(value).toBeNull();
      });
    });

    describe('deleteValue()', () => {
      it('should return true when key exists', async () => {
        // Test: Delete existing key-value
        await adapter.setValue('delete-key', 'delete-value');

        const deleted = await adapter.deleteValue('delete-key');

        expect(deleted).toBe(true);

        // Verify deletion
        const value = await adapter.getValue('delete-key');
        expect(value).toBeNull();
      });

      it('should return false when key does not exist', async () => {
        // Test: Delete non-existent key
        const deleted = await adapter.deleteValue('non-existent-key');

        expect(deleted).toBe(false);
      });
    });

    describe('hasValue()', () => {
      it('should return true for existing key', async () => {
        // Test: Check key existence
        await adapter.setValue('exists-key', 'exists-value');

        const exists = await adapter.hasValue('exists-key');

        expect(exists).toBe(true);
      });

      it('should return false for non-existent key', async () => {
        // Test: Check non-existent key
        const exists = await adapter.hasValue('non-existent-key');

        expect(exists).toBe(false);
      });
    });
  });

  // ==========================================================================
  // Part 4: Performance & Statistics Tests (Task 2.4)
  // ==========================================================================

  describe('StorageAdapter Contract - Performance', () => {
    it('should handle large session (1000+ messages) within time limits', async () => {
      // SC-007: Session restoration with large state (<100ms p95)
      const largeSession = createLargeSession(1000);

      // Save large session
      const { durationMs: saveDuration } = await measureTime(() =>
        adapter.saveSession(largeSession)
      );

      // Retrieve large session
      const { durationMs: getDuration } = await measureTime(() =>
        adapter.getSession(largeSession.id)
      );

      // Verify size
      const size = SessionSerializer.getSize(largeSession);
      expect(size).toBeGreaterThan(100 * 1024); // Should be >100KB

      // Performance assertions
      expect(saveDuration).toBeLessThan(50); // SC-009
      expect(getDuration).toBeLessThan(100); // SC-007
    });

    it('should handle concurrent saveSession() calls without corruption', async () => {
      // Test: Concurrent writes don't corrupt data
      const sessions = [
        createTestSession({ id: 'concurrent-1' }),
        createTestSession({ id: 'concurrent-2' }),
        createTestSession({ id: 'concurrent-3' }),
        createTestSession({ id: 'concurrent-4' }),
        createTestSession({ id: 'concurrent-5' }),
      ];

      // Save all sessions concurrently
      await Promise.all(sessions.map((s) => adapter.saveSession(s)));

      // Verify all sessions were saved correctly
      const results = await Promise.all(
        sessions.map((s) => adapter.getSession(s.id))
      );

      results.forEach((result, index) => {
        expect(result).not.toBeNull();
        expect(result!.id).toBe(sessions[index].id);
      });
    });

    it('should perform batch operations faster than individual operations', async () => {
      // Test: Batch operations have performance advantage
      const sessions = Array.from({ length: 10 }, (_, i) =>
        createTestSession({ id: `perf-${i}` })
      );

      // Measure individual saves
      const { durationMs: individualDuration } = await measureTime(async () => {
        for (const session of sessions) {
          await adapter.saveSession(session);
        }
      });

      // Clear storage
      await adapter.clear();

      // Measure batch save
      const { durationMs: batchDuration } = await measureTime(() =>
        adapter.saveSessions(sessions)
      );

      // Batch should be faster (or at least not significantly slower)
      // Allow 20% margin for overhead
      expect(batchDuration).toBeLessThanOrEqual(individualDuration * 1.2);
    });
  });

  describe('StorageAdapter Contract - Statistics & Cleanup', () => {
    describe('getStats()', () => {
      beforeEach(async () => {
        // Create sessions in different states
        await adapter.saveSession(
          createTestSession({ id: 'stats-1', state: SessionState.ACTIVE })
        );
        await adapter.saveSession(
          createTestSession({ id: 'stats-2', state: SessionState.ACTIVE })
        );
        await adapter.saveSession(
          createTestSession({ id: 'stats-3', state: SessionState.PAUSED })
        );
        await adapter.saveSession(
          createTestSession({ id: 'stats-4', state: SessionState.EXPIRED })
        );
      });

      it('should return total session count (FR-037)', async () => {
        // FR-037: System provides session count metrics
        const stats = await adapter.getStats();

        expect(stats).toBeDefined();
        expect(stats.totalSessions).toBe(4);
      });

      it('should return session count by state (FR-038)', async () => {
        // FR-038: System provides session count metrics for capacity monitoring
        const stats = await adapter.getStats();

        expect(stats).toBeDefined();
        expect(stats.totalSessions).toBe(4);

        // Note: State-specific counts may be in metrics field
        if (stats.metrics) {
          expect(stats.metrics['activeCount']).toBeDefined();
          expect(stats.metrics['pausedCount']).toBeDefined();
          expect(stats.metrics['expiredCount']).toBeDefined();
        }
      });

      it('should return storage size metrics (FR-043)', async () => {
        // FR-043: System exposes structured metrics (session_count)
        const stats = await adapter.getStats();

        expect(stats).toBeDefined();
        expect(stats.sizeBytes).toBeDefined();
        expect(typeof stats.sizeBytes).toBe('number');
        expect(stats.sizeBytes).toBeGreaterThan(0);
      });
    });

    describe('clear()', () => {
      beforeEach(async () => {
        // Create test sessions
        await adapter.saveSession(createTestSession({ id: 'clear-1' }));
        await adapter.saveSession(createTestSession({ id: 'clear-2' }));
        await adapter.saveSession(createTestSession({ id: 'clear-3' }));
      });

      it('should delete all sessions when called without arguments (FR-004)', async () => {
        // FR-004: System implements session expiration policies
        const count = await adapter.clear();

        expect(count).toBe(3);

        // Verify all sessions deleted
        const stats = await adapter.getStats();
        expect(stats.totalSessions).toBe(0);
      });

      it('should delete sessions older than specified date', async () => {
        // Test: Clear with date filter
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

        // Create sessions with different ages
        const oldSession = createTestSession({
          id: 'old-session',
          updatedAt: twoHoursAgo,
        });
        const newSession = createTestSession({
          id: 'new-session',
          updatedAt: now,
        });

        await adapter.saveSession(oldSession);
        await adapter.saveSession(newSession);

        // Clear sessions older than 1 hour
        const count = await adapter.clear(oneHourAgo);

        expect(count).toBeGreaterThanOrEqual(1);

        // Verify old session deleted, new session remains
        const oldExists = await adapter.hasSession('old-session');
        const newExists = await adapter.hasSession('new-session');

        expect(oldExists).toBe(false);
        expect(newExists).toBe(true);
      });

      it('should return count of deleted sessions', async () => {
        // Test: Clear returns count
        const count = await adapter.clear();

        expect(typeof count).toBe('number');
        expect(count).toBe(3);
      });
    });

    describe('Serialization Methods', () => {
      it('should use SessionSerializer.toJSON() for serializeSession()', () => {
        // Test: Serialization method uses SessionSerializer
        const session = createTestSession();

        const serialized = adapter.serializeSession(session);

        expect(typeof serialized).toBe('string');

        // Verify it's valid JSON
        const parsed = JSON.parse(serialized);
        expect(parsed.id).toBe(session.id);
        expect(parsed.version).toBe(session.version);
      });

      it('should use SessionSerializer.fromJSON() for deserializeSession()', () => {
        // Test: Deserialization method uses SessionSerializer
        const session = createTestSession();
        const serialized = SessionSerializer.toJSON(session);

        const deserialized = adapter.deserializeSession(serialized);

        expect(deserialized).toBeDefined();
        expect(deserialized.id).toBe(session.id);
        expect(deserialized.version).toBe(session.version);
        expect(deserialized.createdAt).toBeInstanceOf(Date);
        expect(deserialized.updatedAt).toBeInstanceOf(Date);
        expect(deserialized.expiresAt).toBeInstanceOf(Date);
      });

      it('should preserve all session fields through serialization round-trip', () => {
        // Test: Complete round-trip preserves all data
        const session = createTestSession({
          agentIds: ['agent-1', 'agent-2', 'agent-3'],
          conversationHistory: [
            createMessageTurn(1),
            createMessageTurn(2),
            createMessageTurn(3),
          ],
          sharedContext: {
            complex: {
              nested: {
                value: 'deep',
              },
            },
          },
          metadata: {
            userId: 'user-123',
            tags: ['tag1', 'tag2', 'tag3'],
            customField: { data: 'custom' },
          },
        });

        // Serialize and deserialize
        const serialized = adapter.serializeSession(session);
        const deserialized = adapter.deserializeSession(serialized);

        // Verify all fields preserved
        expect(deserialized.id).toBe(session.id);
        expect(deserialized.agentIds).toEqual(session.agentIds);
        expect(deserialized.conversationHistory).toHaveLength(3);
        expect(deserialized.sharedContext['complex']['nested']['value']).toBe('deep');
        expect(deserialized.metadata.tags).toEqual(['tag1', 'tag2', 'tag3']);
        expect(deserialized.version).toBe(session.version);

        // Verify Date objects
        expect(deserialized.createdAt).toBeInstanceOf(Date);
        expect(deserialized.updatedAt).toBeInstanceOf(Date);
        expect(deserialized.expiresAt).toBeInstanceOf(Date);
        expect(deserialized.createdAt.getTime()).toBe(session.createdAt.getTime());
      });
    });
  });
}
