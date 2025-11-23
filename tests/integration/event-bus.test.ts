/**
 * EventBus Integration Tests
 *
 * Validates EventBus implementation with real event publishing, subscription,
 * persistence, and replay scenarios.
 *
 * @see src/events/EventBus.ts
 * @see specs/001-production-robustness/contracts/EventBus.contract.ts
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import { EventBus } from '../../src/events/EventBus';
import { EventPriority, EventReplayPolicy } from '../../src/types/robustness';

describe('EventBus Integration Tests', () => {
  let eventBus: EventBus;
  const testDataDir = 'data/events-test';

  beforeEach(async () => {
    eventBus = new EventBus();

    // Override config for testing
    (eventBus as any).config = {
      eventRetentionHours: 24,
      processedEventRegistryMaxSize: 10000,
      eventLogDirectory: testDataDir,
      latencyAlertThresholdMs: 10,
      latencyWindowMinutes: 5,
    };

    await eventBus.initialize();
  });

  afterEach(async () => {
    await eventBus.stop();

    // Cleanup test data
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Basic Publish-Subscribe', () => {
    it('should deliver event to subscriber', async () => {
      const received: any[] = [];

      // Subscribe
      eventBus.subscribe('test:event', 'subscriber1', (payload) => {
        received.push(payload);
        return;
      });

      // Publish
      await eventBus.publish('test:event', { message: 'Hello' });

      // Verify delivery
      expect(received).toHaveLength(1);
      expect(received[0]).toEqual({ message: 'Hello' });
    });

    it('should support wildcard subscriptions', async () => {
      const received: any[] = [];

      // Subscribe with wildcard
      eventBus.subscribe('agent:*', 'subscriber1', (payload) => {
        received.push(payload);
        return;
      });

      // Publish multiple events
      await eventBus.publish('agent:started', { id: 'agent1' });
      await eventBus.publish('agent:stopped', { id: 'agent1' });
      await eventBus.publish('task:completed', { id: 'task1' }); // Should not match

      // Verify only matching events delivered
      expect(received).toHaveLength(2);
      expect(received[0]).toEqual({ id: 'agent1' });
      expect(received[1]).toEqual({ id: 'agent1' });
    });

    it('should deliver events to multiple subscribers', async () => {
      const received1: any[] = [];
      const received2: any[] = [];

      // Multiple subscribers
      eventBus.subscribe('test:event', 'subscriber1', (payload) => {
        received1.push(payload);
        return;
      });
      eventBus.subscribe('test:event', 'subscriber2', (payload) => {
        received2.push(payload);
        return;
      });

      // Publish
      await eventBus.publish('test:event', { data: 'test' });

      // Verify both received
      expect(received1).toHaveLength(1);
      expect(received2).toHaveLength(1);
    });
  });

  describe('At-Least-Once Delivery', () => {
    it('should not deliver duplicate events to same subscriber', async () => {
      const received: any[] = [];

      eventBus.subscribe('test:event', 'subscriber1', (payload, event) => {
        received.push(event.id);
        return;
      });

      // Publish event
      const eventId = await eventBus.publish('test:event', { data: 'test' });

      // Manually trigger duplicate delivery
      const event = {
        id: eventId,
        topic: 'test:event',
        payload: { data: 'test' },
        priority: EventPriority.NORMAL,
        timestamp: Date.now(),
      };

      const subscription = {
        topic: 'test:event',
        subscriberId: 'subscriber1',
        handler: (payload: any, evt: any) => {
          received.push(evt.id);
          return;
        },
      };

      await (eventBus as any).deliverToSubscriber(event, subscription);

      // Should only receive once (deduplication)
      expect(received).toHaveLength(1);
    });
  });

  describe('Event Persistence', () => {
    it('should persist events to JSONL log', async () => {
      // Publish event
      await eventBus.publish('test:persistence', { message: 'Persisted' });

      // Check log file exists
      const logPath = path.join(testDataDir, 'test_persistence.log');
      const exists = await fs
        .access(logPath)
        .then(() => true)
        .catch(() => false);

      expect(exists).toBe(true);

      // Read and parse log
      const content = await fs.readFile(logPath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());

      expect(lines).toHaveLength(1);

      const event = JSON.parse(lines[0]);
      expect(event.topic).toBe('test:persistence');
      expect(event.payload).toEqual({ message: 'Persisted' });
    });

    it('should persist events with restrictive file permissions', async () => {
      await eventBus.publish('test:security', { data: 'secret' });

      const logPath = path.join(testDataDir, 'test_security.log');
      const stats = await fs.stat(logPath);

      // Check file permissions (0o600 = owner read/write only)
      const mode = stats.mode & 0o777;
      expect(mode).toBe(0o600);
    });
  });

  describe('Event Replay', () => {
    it('should replay missed events', async () => {
      // Publish events before subscription
      await eventBus.publish('test:replay', { seq: 1 }, { priority: EventPriority.CRITICAL });
      await eventBus.publish('test:replay', { seq: 2 }, { priority: EventPriority.NORMAL });
      await eventBus.publish('test:replay', { seq: 3 }, { priority: EventPriority.CRITICAL });

      // Subscribe after events published
      const received: any[] = [];
      eventBus.subscribe('test:replay', 'subscriber1', (payload) => {
        received.push(payload);
        return;
      });

      // Replay events
      const replayedCount = await eventBus.replay('subscriber1');

      // With default CRITICAL_ONLY policy, should replay 2 events
      expect(replayedCount).toBe(2);
      expect(received).toHaveLength(2);
      expect(received[0]).toEqual({ seq: 1 });
      expect(received[1]).toEqual({ seq: 3 });
    });

    it('should respect replay policy - NONE', async () => {
      await eventBus.publish('test:policy', { data: 'test' }, { priority: EventPriority.CRITICAL });

      eventBus.subscribe('test:policy', 'subscriber1', () => {});
      eventBus.setReplayPolicy('subscriber1', EventReplayPolicy.NONE);

      const replayedCount = await eventBus.replay('subscriber1');
      expect(replayedCount).toBe(0);
    });

    it('should respect replay policy - FULL', async () => {
      await eventBus.publish('test:policy', { seq: 1 }, { priority: EventPriority.CRITICAL });
      await eventBus.publish('test:policy', { seq: 2 }, { priority: EventPriority.NORMAL });

      const received: any[] = [];
      eventBus.subscribe('test:policy', 'subscriber1', (payload) => {
        received.push(payload);
        return;
      });
      eventBus.setReplayPolicy('subscriber1', EventReplayPolicy.FULL);

      const replayedCount = await eventBus.replay('subscriber1');

      expect(replayedCount).toBe(2);
      expect(received).toHaveLength(2);
    });

    it('should filter replay by time range', async () => {
      const now = Date.now();

      // Publish events
      await eventBus.publish('test:time', { old: true });
      await new Promise(resolve => setTimeout(resolve, 10));
      const cutoffTime = Date.now();
      await new Promise(resolve => setTimeout(resolve, 10));
      await eventBus.publish('test:time', { recent: true });

      const received: any[] = [];
      eventBus.subscribe('test:time', 'subscriber1', (payload) => {
        received.push(payload);
        return;
      });
      eventBus.setReplayPolicy('subscriber1', EventReplayPolicy.FULL);

      // Replay only recent events
      await eventBus.replay('subscriber1', { since: cutoffTime });

      expect(received).toHaveLength(1);
      expect(received[0]).toEqual({ recent: true });
    });
  });

  describe('Subscription Filtering', () => {
    it('should filter events by priority', async () => {
      const received: any[] = [];

      eventBus.subscribe(
        'test:filter',
        'subscriber1',
        (payload) => {
          received.push(payload);
          return;
        },
        { priority: EventPriority.CRITICAL }
      );

      await eventBus.publish('test:filter', { critical: true }, { priority: EventPriority.CRITICAL });
      await eventBus.publish('test:filter', { normal: true }, { priority: EventPriority.NORMAL });

      expect(received).toHaveLength(1);
      expect(received[0]).toEqual({ critical: true });
    });

    it('should filter events by session ID', async () => {
      const received: any[] = [];

      eventBus.subscribe(
        'test:session',
        'subscriber1',
        (payload) => {
          received.push(payload);
          return;
        },
        { sessionId: 'session-123' }
      );

      await eventBus.publish('test:session', { data: 1 }, { sessionId: 'session-123' });
      await eventBus.publish('test:session', { data: 2 }, { sessionId: 'session-456' });

      expect(received).toHaveLength(1);
      expect(received[0]).toEqual({ data: 1 });
    });
  });

  describe('Unsubscribe', () => {
    it('should stop receiving events after unsubscribe', async () => {
      const received: any[] = [];

      const unsubscribe = eventBus.subscribe('test:unsub', 'subscriber1', (payload) => {
        received.push(payload);
        return;
      });

      await eventBus.publish('test:unsub', { before: true });
      unsubscribe();
      await eventBus.publish('test:unsub', { after: true });

      expect(received).toHaveLength(1);
      expect(received[0]).toEqual({ before: true });
    });

    it('should remove all subscriptions for subscriber', async () => {
      const received: any[] = [];

      eventBus.subscribe('topic1', 'subscriber1', (payload) => {
        received.push({ topic: 'topic1', payload });
        return;
      });
      eventBus.subscribe('topic2', 'subscriber1', (payload) => {
        received.push({ topic: 'topic2', payload });
        return;
      });

      eventBus.unsubscribeAll('subscriber1');

      await eventBus.publish('topic1', { data: 1 });
      await eventBus.publish('topic2', { data: 2 });

      expect(received).toHaveLength(0);
    });
  });

  describe('Statistics', () => {
    it('should track event publication and delivery counts', async () => {
      eventBus.subscribe('test:stats', 'subscriber1', () => {});
      eventBus.subscribe('test:stats', 'subscriber2', () => {});

      await eventBus.publish('test:stats', { data: 'test' });

      const stats = eventBus.getStats();
      expect(stats.totalEventsPublished).toBe(1);
      expect(stats.totalEventsDelivered).toBe(2); // 2 subscribers
    });

    it('should track events by priority', async () => {
      await eventBus.publish('test:priority', { data: 1 }, { priority: EventPriority.CRITICAL });
      await eventBus.publish('test:priority', { data: 2 }, { priority: EventPriority.NORMAL });
      await eventBus.publish('test:priority', { data: 3 }, { priority: EventPriority.CRITICAL });

      const stats = eventBus.getStats();
      expect(stats.eventsByPriority.critical).toBe(2);
      expect(stats.eventsByPriority.normal).toBe(1);
    });

    it('should track active subscriptions', async () => {
      eventBus.subscribe('topic1', 'subscriber1', () => {});
      eventBus.subscribe('topic2', 'subscriber1', () => {});
      eventBus.subscribe('topic1', 'subscriber2', () => {});

      const stats = eventBus.getStats();
      expect(stats.activeSubscriptions).toBe(3);
      expect(stats.uniqueTopics).toBe(2);
    });
  });

  describe('Clear Event History', () => {
    it('should clear events for specific session', async () => {
      await eventBus.publish('test:clear', { data: 1 }, { sessionId: 'session-123' });
      await eventBus.publish('test:clear', { data: 2 }, { sessionId: 'session-456' });

      await eventBus.clearEventHistory('session-123');

      // Verify session-123 events are cleared
      const received: any[] = [];
      eventBus.subscribe('test:clear', 'subscriber1', (payload) => {
        received.push(payload);
        return;
      });
      eventBus.setReplayPolicy('subscriber1', EventReplayPolicy.FULL);

      await eventBus.replay('subscriber1');

      expect(received).toHaveLength(1);
      expect(received[0]).toEqual({ data: 2 });
    });

    it('should clear old events by timestamp', async () => {
      await eventBus.publish('test:old', { old: true });
      await new Promise(resolve => setTimeout(resolve, 50));
      const cutoffTime = Date.now();
      await new Promise(resolve => setTimeout(resolve, 50));
      await eventBus.publish('test:old', { recent: true });

      await eventBus.clearEventHistory(undefined, cutoffTime);

      const received: any[] = [];
      eventBus.subscribe('test:old', 'subscriber1', (payload) => {
        received.push(payload);
        return;
      });
      eventBus.setReplayPolicy('subscriber1', EventReplayPolicy.FULL);

      await eventBus.replay('subscriber1');

      expect(received).toHaveLength(1);
      expect(received[0]).toEqual({ recent: true });
    });
  });
});
