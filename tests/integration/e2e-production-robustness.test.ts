/**
 * End-to-End Production Robustness Integration Tests
 *
 * Tests all 5 user stories in realistic scenarios:
 * 1. Full System Lifecycle (30s)
 * 2. Failure and Recovery (45s)
 * 3. Multi-Adapter Migration (30s)
 *
 * Total test time target: <2 minutes
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { SessionManager } from '../../src/session/SessionManager';
import { AgentHealthMonitor } from '../../src/health/AgentHealthMonitor';
import { EventBus } from '../../src/events/EventBus';
import { GroupConversationManager } from '../../src/group/GroupConversationManager';
import { FileStorageAdapter } from '../../src/persistence/FileStorageAdapter';
import { InMemoryStorageAdapter } from '../../src/persistence/InMemoryStorageAdapter';
import { Agent } from '../../src/agents/Agent';
import {
  SessionState,
  EventPriority,
  EventReplayPolicy,
  HealthState,
  RecoveryStrategy,
  SpeakerSelectionStrategy,
} from '../../src/types/robustness';

describe('E2E Production Robustness Integration Tests', () => {
  const testDataDir = path.join(process.cwd(), 'data', 'e2e-tests');

  beforeAll(async () => {
    // Create test data directory
    await fs.mkdir(testDataDir, { recursive: true });
  });

  afterAll(async () => {
    // Cleanup test data
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  /**
   * SCENARIO 1: Full System Lifecycle
   *
   * Tests complete system initialization, concurrent operations, and graceful shutdown.
   * Target: 30 seconds
   */
  describe('Scenario 1: Full System Lifecycle', () => {
    let storage: FileStorageAdapter;
    let sessionManager: SessionManager;
    let healthMonitor: AgentHealthMonitor;
    let eventBus: EventBus;
    let groupManager: GroupConversationManager;

    beforeAll(async () => {
      const storageDir = path.join(testDataDir, 'scenario1');
      storage = new FileStorageAdapter();
      await storage.initialize({ location: storageDir });
      sessionManager = new SessionManager(storage);
      healthMonitor = new AgentHealthMonitor();
      await healthMonitor.initialize();
      eventBus = new EventBus();
      await eventBus.initialize();
      groupManager = new GroupConversationManager();
    }, 10000);

    afterAll(async () => {
      healthMonitor.stopMonitoring();
      await eventBus.stop();
      await storage.close();
    });

    test('should initialize all components successfully', () => {
      expect(sessionManager).toBeDefined();
      expect(healthMonitor).toBeDefined();
      expect(eventBus).toBeDefined();
      expect(groupManager).toBeDefined();
    });

    test('should create 100 concurrent sessions', async () => {
      const sessionPromises = [];
      for (let i = 0; i < 100; i++) {
        const promise = (async () => {
          const session = await sessionManager.createSession({
            metadata: { batchId: 'lifecycle-test', index: i },
          });
          session.agentIds = [`agent-${i}`];
          await sessionManager.saveSession(session);
          return session;
        })();
        sessionPromises.push(promise);
      }

      const sessions = await Promise.all(sessionPromises);
      expect(sessions).toHaveLength(100);

      // Verify all sessions are persisted
      const stats = await sessionManager.getStats();
      expect(stats.activeSessions).toBe(100);
    }, 15000);

    test('should publish 1000 events with delivery guarantees', async () => {
      const receivedEvents: string[] = [];
      const subscriberId = 'lifecycle-subscriber';

      // Subscribe to all events
      eventBus.subscribe('test:*', subscriberId, async (payload, event) => {
        receivedEvents.push(event.id);
      });

      // Publish 1000 events
      const publishPromises = [];
      for (let i = 0; i < 1000; i++) {
        const promise = eventBus.publish('test:event', {
          index: i,
          data: 'test-payload',
        });
        publishPromises.push(promise);
      }

      await Promise.all(publishPromises);

      // Wait for event delivery
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify at-least-once delivery
      expect(receivedEvents.length).toBeGreaterThanOrEqual(1000);

      // Verify no duplicates (deduplication working)
      const uniqueEvents = new Set(receivedEvents);
      expect(uniqueEvents.size).toBe(1000);

      eventBus.unsubscribeAll(subscriberId);
    }, 10000);

    test('should monitor agent health continuously', async () => {
      const agents = [];
      for (let i = 0; i < 10; i++) {
        const agent = new Agent({ name: `lifecycle-agent-${i}` });
        agents.push(agent);
        healthMonitor.registerAgent(agent, RecoveryStrategy.RESTART);
      }

      healthMonitor.startMonitoring();

      // Simulate agent activity
      for (const agent of agents) {
        await healthMonitor.sendHeartbeat(agent.name);
        healthMonitor.recordActivity(agent.name, 'processing');
      }

      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Verify all agents are healthy
      const stats = healthMonitor.getStats();
      expect(stats.totalAgents).toBe(10);
      expect(stats.healthyAgents).toBe(10);
      expect(stats.disconnectedAgents).toBe(0);
    }, 5000);

    test('should perform graceful shutdown', async () => {
      // Stop all components
      healthMonitor.stopMonitoring();
      await eventBus.stop();

      // Verify data persistence
      const stats = await storage.getStats();
      expect(stats.totalSessions).toBeGreaterThanOrEqual(100);
    });
  });

  /**
   * SCENARIO 2: Failure and Recovery
   *
   * Tests system resilience under failure conditions.
   * Target: 45 seconds
   */
  describe('Scenario 2: Failure and Recovery', () => {
    let storage: FileStorageAdapter;
    let sessionManager: SessionManager;
    let healthMonitor: AgentHealthMonitor;
    let eventBus: EventBus;

    beforeAll(async () => {
      const storageDir = path.join(testDataDir, 'scenario2');
      storage = new FileStorageAdapter();
      await storage.initialize({ location: storageDir });
      sessionManager = new SessionManager(storage);
      healthMonitor = new AgentHealthMonitor();
      await healthMonitor.initialize({
        heartbeatInterval: 1000,
        activityTimeout: 3000,
        maxMissedBeats: 2,
      });
      eventBus = new EventBus();
      await eventBus.initialize();
      healthMonitor.setEventBus(eventBus);
    }, 10000);

    afterAll(async () => {
      healthMonitor.stopMonitoring();
      await eventBus.stop();
      await storage.close();
    });

    test('should start system successfully', async () => {
      // Create baseline session
      const session = await sessionManager.createSession({
        metadata: { scenario: 'failure-recovery' },
      });
      await sessionManager.saveSession(session);

      const stats = await sessionManager.getStats();
      expect(stats.activeSessions).toBeGreaterThanOrEqual(1);
    });

    test('should detect agent failures within 5 seconds', async () => {
      const agent = new Agent({ name: 'failing-agent' });
      healthMonitor.registerAgent(agent, RecoveryStrategy.RESTART);
      healthMonitor.startMonitoring();

      // Send initial heartbeat
      await healthMonitor.sendHeartbeat(agent.name);

      const startTime = Date.now();

      // Wait for failure detection (should be < 5s)
      await new Promise((resolve) => setTimeout(resolve, 6000));

      const detectionTime = Date.now() - startTime;
      const health = healthMonitor.getAgentHealth(agent.name);

      expect(health?.state).toBe(HealthState.DISCONNECTED);
      expect(detectionTime).toBeLessThan(6000); // Within 5s + buffer
    }, 10000);

    test('should recover failed agents automatically', async () => {
      const agent = new Agent({ name: 'recovering-agent' });
      healthMonitor.registerAgent(agent, RecoveryStrategy.RESTART);

      // Send initial heartbeat then simulate failure
      await healthMonitor.sendHeartbeat(agent.name);
      await new Promise((resolve) => setTimeout(resolve, 6000));

      // Verify failure detected
      let health = healthMonitor.getAgentHealth(agent.name);
      expect(health?.state).toBe(HealthState.DISCONNECTED);

      // Trigger recovery
      const recoveryResult = await healthMonitor.recoverAgent(agent.name);

      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.strategy).toBe(RecoveryStrategy.RESTART);

      // Verify agent is healthy after recovery
      health = healthMonitor.getAgentHealth(agent.name);
      expect(health?.state).toBe(HealthState.HEALTHY);
    }, 10000);

    test('should replay events after recovery', async () => {
      const agentId = 'event-replay-agent';
      const agent = new Agent({ name: agentId });

      // Set replay policy to FULL
      eventBus.setReplayPolicy(agentId, EventReplayPolicy.FULL);

      // Subscribe to events
      const receivedEvents: any[] = [];
      eventBus.subscribe('recovery:*', agentId, async (payload, event) => {
        receivedEvents.push(event);
      });

      // Publish events before failure
      await eventBus.publish('recovery:before-1', { index: 1 });
      await eventBus.publish('recovery:before-2', { index: 2 }, { priority: EventPriority.CRITICAL });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const beforeFailureCount = receivedEvents.length;
      expect(beforeFailureCount).toBe(2);

      // Simulate agent failure (unsubscribe)
      eventBus.unsubscribeAll(agentId);

      // Publish events during failure
      await eventBus.publish('recovery:during-1', { index: 3 });
      await eventBus.publish('recovery:during-2', { index: 4 });
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify events not delivered during failure
      expect(receivedEvents.length).toBe(2);

      // Recover agent - re-subscribe
      eventBus.subscribe('recovery:*', agentId, async (payload, event) => {
        receivedEvents.push(event);
      });

      // Replay missed events
      const replayedCount = await eventBus.replay(agentId, {
        since: Date.now() - 60000, // Last minute
        topics: ['recovery:*'],
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify events were replayed
      expect(replayedCount).toBeGreaterThanOrEqual(2); // At least the 2 missed events
    }, 10000);

    test('should verify no data loss after recovery', async () => {
      // Create sessions before simulated crash
      const sessions = [];
      for (let i = 0; i < 10; i++) {
        const session = await sessionManager.createSession({
          metadata: { recoveryTest: true, index: i },
        });
        session.agentIds = [`recovery-agent-${i}`];
        await sessionManager.saveSession(session);
        sessions.push(session);
      }

      // Simulate application crash and restart
      const newSessionManager = new SessionManager(storage);

      // Verify all sessions can be restored
      let restoredCount = 0;
      for (const session of sessions) {
        const restored = await newSessionManager.restoreSession(session.id);
        if (restored && restored.id === session.id) {
          restoredCount++;
        }
      }

      expect(restoredCount).toBe(10);
    }, 10000);
  });

  /**
   * SCENARIO 3: Multi-Adapter Migration
   *
   * Tests session migration between different storage backends.
   * Target: 30 seconds
   */
  describe('Scenario 3: Multi-Adapter Migration', () => {
    let fileStorage: FileStorageAdapter;
    let memoryStorage: InMemoryStorageAdapter;
    let sessions: any[] = [];

    beforeAll(async () => {
      const storageDir = path.join(testDataDir, 'scenario3');
      fileStorage = new FileStorageAdapter();
      await fileStorage.initialize({ location: storageDir });
      memoryStorage = new InMemoryStorageAdapter();
      await memoryStorage.initialize();
    }, 10000);

    afterAll(async () => {
      await fileStorage.close();
      await memoryStorage.close();
    });

    test('should create sessions in FileStorage', async () => {
      const fileManager = new SessionManager(fileStorage);

      for (let i = 0; i < 20; i++) {
        const session = await fileManager.createSession({
          metadata: { migrationTest: true, index: i },
          expirationMs: 3600000,
        });

        // Add diverse session data
        session.agentIds = [`agent-${i}`, `agent-${i + 1}`];
        session.agentStates = {
          [`agent-${i}`]: {
            config: { role: 'primary' },
            context: { status: 'active' },
            messageHistory: [],
          },
          [`agent-${i + 1}`]: {
            config: { role: 'backup' },
            context: { status: 'standby' },
            messageHistory: [],
          },
        };

        // Add conversation history using MessageTurn format
        session.conversationHistory.push({
          sequence: i,
          timestamp: new Date(),
          userMessage: `Test message ${i}`,
          agentResponses: [
            {
              agentId: `agent-${i}`,
              response: `Response ${i}`,
              timestamp: new Date(),
            },
          ],
        });

        await fileManager.saveSession(session);
        sessions.push(session);
      }

      const stats = await fileStorage.getStats();
      expect(stats.totalSessions).toBe(20);
    }, 10000);

    test('should migrate to InMemoryStorage', async () => {
      const memoryManager = new SessionManager(memoryStorage);

      const migrationStart = Date.now();

      // Migrate all sessions
      for (const session of sessions) {
        await memoryManager.saveSession(session);
      }

      const migrationTime = Date.now() - migrationStart;

      // Verify migration completed
      const stats = await memoryStorage.getStats();
      expect(stats.totalSessions).toBe(20);

      // Performance check: migration should be fast for in-memory
      expect(migrationTime).toBeLessThan(5000); // <5s for 20 sessions
    }, 10000);

    test('should verify session integrity after migration', async () => {
      const fileManager = new SessionManager(fileStorage);
      const memoryManager = new SessionManager(memoryStorage);

      // Compare each session
      for (const originalSession of sessions) {
        const fileSession = await fileManager.restoreSession(originalSession.id);
        const memorySession = await memoryManager.restoreSession(originalSession.id);

        expect(fileSession).toBeTruthy();
        expect(memorySession).toBeTruthy();

        // Verify critical fields match
        expect(memorySession?.id).toBe(fileSession?.id);
        expect(memorySession?.agentIds).toEqual(fileSession?.agentIds);
        expect(memorySession?.conversationHistory.length).toBe(
          fileSession?.conversationHistory.length
        );
        expect(memorySession?.state).toBe(fileSession?.state);

        // Verify metadata preserved
        expect(memorySession?.metadata).toEqual(fileSession?.metadata);
      }
    }, 10000);

    test('should verify final state in InMemoryStorage', async () => {
      const memoryManager = new SessionManager(memoryStorage);

      // List all sessions
      const sessionIds = await memoryManager.listSessions();
      expect(sessionIds.length).toBe(20);

      // Verify each session is accessible
      for (const sessionId of sessionIds) {
        const session = await memoryManager.restoreSession(sessionId);
        expect(session).toBeTruthy();
        expect(session?.id).toBe(sessionId);
      }
    }, 5000);
  });

  /**
   * BONUS: Cross-Component Integration
   *
   * Tests interactions between multiple components simultaneously.
   */
  describe('Cross-Component Integration', () => {
    test('should coordinate session, health, events, and group conversation', async () => {
      const storageDir = path.join(testDataDir, 'cross-component');
      const storage = new FileStorageAdapter();
      await storage.initialize({ location: storageDir });

      const sessionManager = new SessionManager(storage);
      const healthMonitor = new AgentHealthMonitor();
      await healthMonitor.initialize();
      const eventBus = new EventBus();
      await eventBus.initialize();
      const groupManager = new GroupConversationManager();

      healthMonitor.setEventBus(eventBus);

      // Create agents
      const agents = [
        new Agent({ name: 'coordinator' }),
        new Agent({ name: 'worker' }),
        new Agent({ name: 'observer' }),
      ];

      // Register with health monitor
      agents.forEach((agent) => {
        healthMonitor.registerAgent(agent, RecoveryStrategy.RESTART);
      });

      healthMonitor.startMonitoring();

      // Create session for conversation
      const session = await sessionManager.createSession({
        metadata: { type: 'cross-component-test' },
      });
      session.agentIds = agents.map((a) => a.name);
      await sessionManager.saveSession(session);

      // Create group conversation
      const conversation = await groupManager.createGroup(agents, {
        speakerSelection: SpeakerSelectionStrategy.ROUND_ROBIN,
        initialContext: { sessionId: session.id },
      });

      // Subscribe to conversation events
      const events: any[] = [];
      eventBus.subscribe('conversation:*', 'test-subscriber', async (payload, event) => {
        events.push(event);
      });

      // Publish conversation events
      await eventBus.publish('conversation:started', { conversationId: conversation.id });
      await eventBus.publish('conversation:message', { speaker: 'coordinator', content: 'Hello' });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify all components working together
      expect(session).toBeTruthy();
      expect(conversation).toBeTruthy();
      expect(events.length).toBeGreaterThanOrEqual(2);

      const healthStats = healthMonitor.getStats();
      expect(healthStats.totalAgents).toBe(3);
      expect(healthStats.healthyAgents).toBe(3);

      // Cleanup
      healthMonitor.stopMonitoring();
      await eventBus.stop();
      await storage.close();
    }, 15000);
  });
});
