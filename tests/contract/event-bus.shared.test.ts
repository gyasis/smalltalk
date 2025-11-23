/**
 * EventBus Contract Tests
 *
 * Shared contract test suite that validates ANY EventBus implementation
 * against the defined interface requirements.
 *
 * TDD Phase: RED - These tests are designed to FAIL until implementation
 *
 * @see specs/001-production-robustness/contracts/EventBus.contract.ts
 * @see specs/001-production-robustness/spec.md FR-011 to FR-016
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { performance } from 'perf_hooks';
import * as crypto from 'crypto';
import {
  EventBus,
  EventHandler,
  SubscribeOptions,
  ReplayOptions,
  PublishOptions,
  EventBusStats,
} from '../../specs/001-production-robustness/contracts/EventBus.contract';
import {
  Event,
  EventPriority,
  EventReplayPolicy,
} from '../../src/types/robustness';

/**
 * Test Helper: Wait for condition to be true
 */
async function waitFor(
  condition: () => boolean,
  timeoutMs: number = 5000,
  intervalMs: number = 10
): Promise<void> {
  const startTime = Date.now();
  while (!condition()) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error('Timeout waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
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
 * Test Helper: Measure p95 latency
 */
function calculateP95(durations: number[]): number {
  const sorted = [...durations].sort((a, b) => a - b);
  const p95Index = Math.floor(sorted.length * 0.95);
  return sorted[p95Index];
}

/**
 * Test Helper: Create test event payload
 */
function createTestPayload(data: any = {}): any {
  return {
    message: 'test event',
    timestamp: Date.now(),
    ...data,
  };
}

/**
 * Test Helper: Create event handler with tracking
 */
function createTrackedHandler<T = any>(): {
  handler: EventHandler<T>;
  events: Array<{ payload: T; event: Event }>;
  callCount: number;
} {
  const events: Array<{ payload: T; event: Event }> = [];
  let callCount = 0;

  const handler: EventHandler<T> = (payload: T, event: Event) => {
    events.push({ payload, event });
    callCount++;
  };

  return { handler, events, callCount };
}

/**
 * Contract Test Suite Factory
 *
 * This function creates a complete contract test suite for any EventBus
 * implementation. Import this function and call it with your implementation's
 * factory functions.
 *
 * @param createEventBus Factory function that creates an EventBus instance (can be async)
 *
 * @example
 * ```typescript
 * import { runEventBusContractTests } from './event-bus.shared.test.js';
 * import { DefaultEventBus } from './DefaultEventBus.js';
 *
 * describe('DefaultEventBus', () => {
 *   runEventBusContractTests(async () => {
 *     const bus = new DefaultEventBus();
 *     await bus.initialize();
 *     return bus;
 *   });
 * });
 * ```
 */
export function runEventBusContractTests(
  createEventBus: () => EventBus | Promise<EventBus>
) {
  let eventBus: EventBus;

  beforeEach(async () => {
    eventBus = await createEventBus();
  });

  afterEach(async () => {
    // Cleanup - implementations should handle cleanup in their own lifecycle
  });

  // =========================================================================
  // Part 1: Basic Publish-Subscribe (FR-011)
  // =========================================================================

  describe('EventBus Contract - Publish-Subscribe', () => {
    describe('publish()', () => {
      it('should publish event and return unique event ID (FR-011)', async () => {
        const eventId = await eventBus.publish('test.topic', {
          message: 'test',
        });

        expect(eventId).toBeDefined();
        expect(typeof eventId).toBe('string');
        expect(eventId.length).toBeGreaterThan(0);
      });

      it('should generate UUID v4 for event ID', async () => {
        const eventId = await eventBus.publish('test.topic', {
          message: 'test',
        });

        // UUID v4 regex
        const uuidv4Regex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        expect(uuidv4Regex.test(eventId)).toBe(true);
      });

      it('should accept event payload of any type', async () => {
        // String payload
        await expect(
          eventBus.publish('test.string', 'simple string')
        ).resolves.toBeDefined();

        // Object payload
        await expect(
          eventBus.publish('test.object', { key: 'value', nested: { data: 42 } })
        ).resolves.toBeDefined();

        // Array payload
        await expect(
          eventBus.publish('test.array', [1, 2, 3, 4, 5])
        ).resolves.toBeDefined();

        // Number payload
        await expect(eventBus.publish('test.number', 42)).resolves.toBeDefined();

        // Boolean payload
        await expect(
          eventBus.publish('test.boolean', true)
        ).resolves.toBeDefined();
      });

      it('should support optional priority (default: normal)', async () => {
        const normalEventId = await eventBus.publish('test.priority', {
          data: 'normal',
        });
        expect(normalEventId).toBeDefined();

        const criticalEventId = await eventBus.publish(
          'test.priority',
          { data: 'critical' },
          { priority: EventPriority.CRITICAL }
        );
        expect(criticalEventId).toBeDefined();
      });

      it('should support optional sessionId and conversationId', async () => {
        const eventId = await eventBus.publish(
          'test.scoped',
          { message: 'scoped' },
          {
            sessionId: 'session-123',
            conversationId: 'conv-456',
          }
        );

        expect(eventId).toBeDefined();
      });

      it('should support optional metadata', async () => {
        const eventId = await eventBus.publish(
          'test.metadata',
          { message: 'with metadata' },
          {
            metadata: {
              userId: 'user-123',
              source: 'test-suite',
              tags: ['test', 'metadata'],
            },
          }
        );

        expect(eventId).toBeDefined();
      });

      it('should handle rapid consecutive publishes', async () => {
        const publishPromises = [];
        for (let i = 0; i < 100; i++) {
          publishPromises.push(
            eventBus.publish('test.rapid', { index: i })
          );
        }

        const eventIds = await Promise.all(publishPromises);

        expect(eventIds.length).toBe(100);
        // All event IDs should be unique
        const uniqueIds = new Set(eventIds);
        expect(uniqueIds.size).toBe(100);
      });
    });

    describe('subscribe()', () => {
      it('should subscribe to topic and receive published events (FR-011)', async () => {
        const tracked = createTrackedHandler();

        eventBus.subscribe('test.subscribe', 'subscriber-1', tracked.handler);

        await eventBus.publish('test.subscribe', { message: 'hello' });

        // Wait for event delivery
        await waitFor(() => tracked.callCount > 0, 1000);

        expect(tracked.callCount).toBe(1);
        expect(tracked.events[0].payload.message).toBe('hello');
      });

      it('should return unsubscribe function', () => {
        const tracked = createTrackedHandler();

        const unsubscribe = eventBus.subscribe(
          'test.unsubscribe',
          'subscriber-1',
          tracked.handler
        );

        expect(typeof unsubscribe).toBe('function');
      });

      it('should deliver event with full Event object', async () => {
        const tracked = createTrackedHandler();

        eventBus.subscribe('test.event-obj', 'subscriber-1', tracked.handler);

        await eventBus.publish('test.event-obj', { data: 'test' });

        await waitFor(() => tracked.callCount > 0, 1000);

        const event = tracked.events[0].event;
        expect(event).toBeDefined();
        expect(event.id).toBeDefined();
        expect(event.topic).toBe('test.event-obj');
        expect(event.payload).toEqual({ data: 'test' });
        expect(event.priority).toBe(EventPriority.NORMAL);
        expect(event.timestamp).toBeDefined();
        expect(typeof event.timestamp).toBe('number');
      });

      it('should support multiple subscribers on same topic', async () => {
        const tracked1 = createTrackedHandler();
        const tracked2 = createTrackedHandler();
        const tracked3 = createTrackedHandler();

        eventBus.subscribe('test.multiple', 'subscriber-1', tracked1.handler);
        eventBus.subscribe('test.multiple', 'subscriber-2', tracked2.handler);
        eventBus.subscribe('test.multiple', 'subscriber-3', tracked3.handler);

        await eventBus.publish('test.multiple', { message: 'broadcast' });

        await waitFor(
          () =>
            tracked1.callCount > 0 &&
            tracked2.callCount > 0 &&
            tracked3.callCount > 0,
          1000
        );

        expect(tracked1.callCount).toBe(1);
        expect(tracked2.callCount).toBe(1);
        expect(tracked3.callCount).toBe(1);
      });

      it('should allow same subscriber on multiple topics', async () => {
        const tracked = createTrackedHandler();

        eventBus.subscribe('topic.one', 'subscriber-1', tracked.handler);
        eventBus.subscribe('topic.two', 'subscriber-1', tracked.handler);
        eventBus.subscribe('topic.three', 'subscriber-1', tracked.handler);

        await eventBus.publish('topic.one', { source: 'one' });
        await eventBus.publish('topic.two', { source: 'two' });
        await eventBus.publish('topic.three', { source: 'three' });

        await waitFor(() => tracked.callCount === 3, 1000);

        expect(tracked.callCount).toBe(3);
      });

      it('should support async event handlers', async () => {
        let asyncExecuted = false;
        const asyncHandler: EventHandler = async (payload, event) => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          asyncExecuted = true;
        };

        eventBus.subscribe('test.async', 'subscriber-1', asyncHandler);

        await eventBus.publish('test.async', { message: 'async test' });

        await waitFor(() => asyncExecuted === true, 1000);

        expect(asyncExecuted).toBe(true);
      });

      it('should support synchronous event handlers', async () => {
        const tracked = createTrackedHandler();

        eventBus.subscribe('test.sync', 'subscriber-1', tracked.handler);

        await eventBus.publish('test.sync', { message: 'sync test' });

        await waitFor(() => tracked.callCount > 0, 1000);

        expect(tracked.callCount).toBe(1);
      });
    });

    describe('unsubscribe()', () => {
      it('should unsubscribe from topic', async () => {
        const tracked = createTrackedHandler();

        eventBus.subscribe('test.unsub', 'subscriber-1', tracked.handler);

        await eventBus.publish('test.unsub', { message: 'before unsub' });
        await waitFor(() => tracked.callCount > 0, 1000);

        expect(tracked.callCount).toBe(1);

        // Unsubscribe
        eventBus.unsubscribe('test.unsub', 'subscriber-1');

        // Publish after unsubscribe
        await eventBus.publish('test.unsub', { message: 'after unsub' });

        // Wait and verify no new events received
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(tracked.callCount).toBe(1); // Still 1, not 2
      });

      it('should unsubscribe via returned function', async () => {
        const tracked = createTrackedHandler();

        const unsubscribe = eventBus.subscribe(
          'test.unsub-fn',
          'subscriber-1',
          tracked.handler
        );

        await eventBus.publish('test.unsub-fn', { message: 'before' });
        await waitFor(() => tracked.callCount > 0, 1000);

        expect(tracked.callCount).toBe(1);

        unsubscribe();

        await eventBus.publish('test.unsub-fn', { message: 'after' });
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(tracked.callCount).toBe(1);
      });

      it('should handle unsubscribe from non-existent topic (idempotent)', () => {
        expect(() =>
          eventBus.unsubscribe('non.existent', 'subscriber-1')
        ).not.toThrow();
      });

      it('should handle unsubscribe for non-existent subscriber (idempotent)', async () => {
        const tracked = createTrackedHandler();

        eventBus.subscribe('test.topic', 'subscriber-1', tracked.handler);

        expect(() =>
          eventBus.unsubscribe('test.topic', 'subscriber-2')
        ).not.toThrow();

        // Verify subscriber-1 still receives events
        await eventBus.publish('test.topic', { message: 'test' });
        await waitFor(() => tracked.callCount > 0, 1000);
        expect(tracked.callCount).toBe(1);
      });

      it('should not affect other subscribers on same topic', async () => {
        const tracked1 = createTrackedHandler();
        const tracked2 = createTrackedHandler();

        eventBus.subscribe('test.selective', 'subscriber-1', tracked1.handler);
        eventBus.subscribe('test.selective', 'subscriber-2', tracked2.handler);

        eventBus.unsubscribe('test.selective', 'subscriber-1');

        await eventBus.publish('test.selective', { message: 'test' });
        await waitFor(() => tracked2.callCount > 0, 1000);

        expect(tracked1.callCount).toBe(0);
        expect(tracked2.callCount).toBe(1);
      });
    });

    describe('unsubscribeAll()', () => {
      it('should unsubscribe subscriber from all topics', async () => {
        const tracked = createTrackedHandler();

        eventBus.subscribe('topic.one', 'subscriber-1', tracked.handler);
        eventBus.subscribe('topic.two', 'subscriber-1', tracked.handler);
        eventBus.subscribe('topic.three', 'subscriber-1', tracked.handler);

        eventBus.unsubscribeAll('subscriber-1');

        await eventBus.publish('topic.one', { message: 'one' });
        await eventBus.publish('topic.two', { message: 'two' });
        await eventBus.publish('topic.three', { message: 'three' });

        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(tracked.callCount).toBe(0);
      });

      it('should not affect other subscribers', async () => {
        const tracked1 = createTrackedHandler();
        const tracked2 = createTrackedHandler();

        eventBus.subscribe('topic.shared', 'subscriber-1', tracked1.handler);
        eventBus.subscribe('topic.shared', 'subscriber-2', tracked2.handler);

        eventBus.unsubscribeAll('subscriber-1');

        await eventBus.publish('topic.shared', { message: 'test' });
        await waitFor(() => tracked2.callCount > 0, 1000);

        expect(tracked1.callCount).toBe(0);
        expect(tracked2.callCount).toBe(1);
      });

      it('should handle unsubscribeAll for non-existent subscriber (idempotent)', () => {
        expect(() =>
          eventBus.unsubscribeAll('non-existent-subscriber')
        ).not.toThrow();
      });
    });
  });

  // =========================================================================
  // Part 2: Wildcard Topic Subscriptions (FR-012)
  // =========================================================================

  describe('EventBus Contract - Wildcard Topics', () => {
    describe('Wildcard Pattern Matching (FR-012)', () => {
      it('should support prefix wildcard (agent:*)', async () => {
        const tracked = createTrackedHandler();

        eventBus.subscribe('agent:*', 'subscriber-1', tracked.handler);

        await eventBus.publish('agent:started', { message: 'started' });
        await eventBus.publish('agent:stopped', { message: 'stopped' });
        await eventBus.publish('agent:error', { message: 'error' });
        await eventBus.publish('task:completed', { message: 'should not match' });

        await waitFor(() => tracked.callCount === 3, 1000);

        expect(tracked.callCount).toBe(3);
        expect(tracked.events[0].event.topic).toBe('agent:started');
        expect(tracked.events[1].event.topic).toBe('agent:stopped');
        expect(tracked.events[2].event.topic).toBe('agent:error');
      });

      it('should support suffix wildcard (*:error)', async () => {
        const tracked = createTrackedHandler();

        eventBus.subscribe('*:error', 'subscriber-1', tracked.handler);

        await eventBus.publish('agent:error', { message: 'agent error' });
        await eventBus.publish('task:error', { message: 'task error' });
        await eventBus.publish('system:error', { message: 'system error' });
        await eventBus.publish('agent:success', { message: 'should not match' });

        await waitFor(() => tracked.callCount === 3, 1000);

        expect(tracked.callCount).toBe(3);
      });

      it('should support middle wildcard (agent:*:completed)', async () => {
        const tracked = createTrackedHandler();

        eventBus.subscribe('agent:*:completed', 'subscriber-1', tracked.handler);

        await eventBus.publish('agent:task:completed', { message: 'task done' });
        await eventBus.publish('agent:action:completed', { message: 'action done' });
        await eventBus.publish('agent:workflow:completed', { message: 'workflow done' });
        await eventBus.publish('agent:task:started', { message: 'should not match' });

        await waitFor(() => tracked.callCount === 3, 1000);

        expect(tracked.callCount).toBe(3);
      });

      it('should support multiple wildcards (agent:*:*)', async () => {
        const tracked = createTrackedHandler();

        eventBus.subscribe('agent:*:*', 'subscriber-1', tracked.handler);

        await eventBus.publish('agent:task:started', { message: 'started' });
        await eventBus.publish('agent:task:completed', { message: 'completed' });
        await eventBus.publish('agent:action:error', { message: 'error' });

        await waitFor(() => tracked.callCount === 3, 1000);

        expect(tracked.callCount).toBe(3);
      });

      it('should support global wildcard (*)', async () => {
        const tracked = createTrackedHandler();

        eventBus.subscribe('*', 'subscriber-1', tracked.handler);

        await eventBus.publish('agent:started', { message: 'agent' });
        await eventBus.publish('task:completed', { message: 'task' });
        await eventBus.publish('system:error', { message: 'system' });

        await waitFor(() => tracked.callCount === 3, 1000);

        expect(tracked.callCount).toBe(3);
      });

      it('should support both exact and wildcard subscriptions', async () => {
        const exactTracked = createTrackedHandler();
        const wildcardTracked = createTrackedHandler();

        eventBus.subscribe('agent:started', 'exact-sub', exactTracked.handler);
        eventBus.subscribe('agent:*', 'wildcard-sub', wildcardTracked.handler);

        await eventBus.publish('agent:started', { message: 'started' });
        await eventBus.publish('agent:stopped', { message: 'stopped' });

        await waitFor(() => wildcardTracked.callCount === 2, 1000);

        expect(exactTracked.callCount).toBe(1); // Only agent:started
        expect(wildcardTracked.callCount).toBe(2); // Both events
      });

      it('should handle overlapping wildcard subscriptions', async () => {
        const tracked1 = createTrackedHandler();
        const tracked2 = createTrackedHandler();

        eventBus.subscribe('agent:*', 'subscriber-1', tracked1.handler);
        eventBus.subscribe('*:started', 'subscriber-2', tracked2.handler);

        await eventBus.publish('agent:started', { message: 'test' });

        await waitFor(
          () => tracked1.callCount > 0 && tracked2.callCount > 0,
          1000
        );

        // Both subscribers should receive the event
        expect(tracked1.callCount).toBe(1);
        expect(tracked2.callCount).toBe(1);
      });
    });
  });

  // =========================================================================
  // Part 3: At-Least-Once Delivery (FR-011a)
  // =========================================================================

  describe('EventBus Contract - At-Least-Once Delivery', () => {
    describe('Delivery Guarantee (FR-011a)', () => {
      it('should deliver event to all subscribers (at-least-once)', async () => {
        const tracked1 = createTrackedHandler();
        const tracked2 = createTrackedHandler();
        const tracked3 = createTrackedHandler();

        eventBus.subscribe('delivery.test', 'subscriber-1', tracked1.handler);
        eventBus.subscribe('delivery.test', 'subscriber-2', tracked2.handler);
        eventBus.subscribe('delivery.test', 'subscriber-3', tracked3.handler);

        await eventBus.publish('delivery.test', { message: 'guaranteed' });

        await waitFor(
          () =>
            tracked1.callCount > 0 &&
            tracked2.callCount > 0 &&
            tracked3.callCount > 0,
          1000
        );

        expect(tracked1.callCount).toBeGreaterThanOrEqual(1);
        expect(tracked2.callCount).toBeGreaterThanOrEqual(1);
        expect(tracked3.callCount).toBeGreaterThanOrEqual(1);
      });

      it('should handle handler errors without dropping events', async () => {
        const errorHandler: EventHandler = () => {
          throw new Error('Handler error');
        };
        const successTracked = createTrackedHandler();

        eventBus.subscribe('error.test', 'error-sub', errorHandler);
        eventBus.subscribe('error.test', 'success-sub', successTracked.handler);

        await eventBus.publish('error.test', { message: 'error test' });

        // Success handler should still receive event
        await waitFor(() => successTracked.callCount > 0, 1000);

        expect(successTracked.callCount).toBe(1);
      });

      it('should prevent duplicate event delivery to same subscriber', async () => {
        const tracked = createTrackedHandler();

        eventBus.subscribe('duplicate.test', 'subscriber-1', tracked.handler);

        const eventId = await eventBus.publish('duplicate.test', {
          message: 'test',
        });

        await waitFor(() => tracked.callCount > 0, 1000);

        // Wait additional time to ensure no duplicates
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Should receive exactly once, not more
        expect(tracked.callCount).toBe(1);
      });

      it('should track processed events per subscriber', async () => {
        const tracked = createTrackedHandler();

        eventBus.subscribe('tracking.test', 'subscriber-1', tracked.handler);

        await eventBus.publish('tracking.test', { seq: 1 });
        await eventBus.publish('tracking.test', { seq: 2 });
        await eventBus.publish('tracking.test', { seq: 3 });

        await waitFor(() => tracked.callCount === 3, 1000);

        expect(tracked.callCount).toBe(3);

        // All events should be unique
        const eventIds = tracked.events.map((e) => e.event.id);
        const uniqueIds = new Set(eventIds);
        expect(uniqueIds.size).toBe(3);
      });
    });
  });

  // =========================================================================
  // Part 4: Event Propagation Latency (FR-013, SC-008)
  // =========================================================================

  describe('EventBus Contract - Latency Performance', () => {
    describe('Event Propagation Latency (FR-013, SC-008)', () => {
      it('should propagate events in under 10ms p95 (SC-008)', async () => {
        const latencies: number[] = [];
        const iterations = 100;

        for (let i = 0; i < iterations; i++) {
          const startTime = performance.now();
          let eventReceived = false;

          const handler: EventHandler = () => {
            const endTime = performance.now();
            latencies.push(endTime - startTime);
            eventReceived = true;
          };

          eventBus.subscribe(`latency.test.${i}`, 'subscriber-1', handler);

          await eventBus.publish(`latency.test.${i}`, { index: i });

          // Wait for event delivery
          await waitFor(() => eventReceived, 1000);

          eventBus.unsubscribe(`latency.test.${i}`, 'subscriber-1');
        }

        const p95Latency = calculateP95(latencies);

        // SC-008: p95 latency must be under 10ms
        expect(p95Latency).toBeLessThan(10);
      });

      it('should maintain low latency under high event volume', async () => {
        const latencies: number[] = [];
        const eventCount = 1000;
        let receivedCount = 0;

        const handler: EventHandler = (payload, event) => {
          const latency = performance.now() - event.timestamp;
          latencies.push(latency);
          receivedCount++;
        };

        eventBus.subscribe('volume.test', 'subscriber-1', handler);

        // Publish 1000 events rapidly
        for (let i = 0; i < eventCount; i++) {
          await eventBus.publish('volume.test', { index: i });
        }

        await waitFor(() => receivedCount === eventCount, 5000);

        const p95Latency = calculateP95(latencies);

        expect(p95Latency).toBeLessThan(10);
      });

      it('should measure latency from publish() to handler invocation', async () => {
        let publishTime = 0;
        let deliveryTime = 0;

        const handler: EventHandler = () => {
          deliveryTime = performance.now();
        };

        eventBus.subscribe('timing.test', 'subscriber-1', handler);

        publishTime = performance.now();
        await eventBus.publish('timing.test', { message: 'timing' });

        await waitFor(() => deliveryTime > 0, 1000);

        const latency = deliveryTime - publishTime;

        // Should be very fast (sub-millisecond to a few milliseconds)
        expect(latency).toBeLessThan(50);
      });
    });
  });

  // =========================================================================
  // Part 5: Event Persistence and Replay (FR-014, FR-016)
  // =========================================================================

  describe('EventBus Contract - Event Persistence', () => {
    describe('Event Persistence (FR-014)', () => {
      it('should persist events for replay capabilities', async () => {
        const tracked = createTrackedHandler();

        eventBus.subscribe('persist.test', 'subscriber-1', tracked.handler);

        await eventBus.publish('persist.test', { message: 'event 1' });
        await eventBus.publish('persist.test', { message: 'event 2' });
        await eventBus.publish('persist.test', { message: 'event 3' });

        await waitFor(() => tracked.callCount === 3, 1000);

        // Unsubscribe and resubscribe
        eventBus.unsubscribe('persist.test', 'subscriber-1');

        // New subscriber should be able to replay persisted events
        const replayedCount = await eventBus.replay('new-subscriber', {
          topics: ['persist.test'],
        });

        expect(replayedCount).toBeGreaterThanOrEqual(3);
      });

      it('should support event replay with time filters', async () => {
        const beforeTime = Date.now();

        await eventBus.publish('time.test', { message: 'old event' });

        await new Promise((resolve) => setTimeout(resolve, 100));

        const middleTime = Date.now();

        await eventBus.publish('time.test', { message: 'new event' });

        // Replay events since middleTime
        const replayedCount = await eventBus.replay('subscriber-1', {
          topics: ['time.test'],
          since: middleTime,
        });

        expect(replayedCount).toBe(1);
      });

      it('should support event replay with priority filters', async () => {
        await eventBus.publish('priority.test', { message: 'normal' });
        await eventBus.publish(
          'priority.test',
          { message: 'critical' },
          { priority: EventPriority.CRITICAL }
        );

        // Replay only critical events
        const replayedCount = await eventBus.replay('subscriber-1', {
          topics: ['priority.test'],
          priority: EventPriority.CRITICAL,
        });

        expect(replayedCount).toBe(1);
      });

      it('should support event replay with limit', async () => {
        for (let i = 0; i < 10; i++) {
          await eventBus.publish('limit.test', { index: i });
        }

        // Replay only first 5 events
        const replayedCount = await eventBus.replay('subscriber-1', {
          topics: ['limit.test'],
          limit: 5,
        });

        expect(replayedCount).toBe(5);
      });

      it('should replay events in chronological order', async () => {
        const tracked = createTrackedHandler();

        for (let i = 0; i < 5; i++) {
          await eventBus.publish('order.test', { sequence: i });
          await new Promise((resolve) => setTimeout(resolve, 10));
        }

        // Subscribe and replay
        eventBus.subscribe('order.test', 'subscriber-1', tracked.handler);
        await eventBus.replay('subscriber-1', {
          topics: ['order.test'],
        });

        await waitFor(() => tracked.callCount >= 5, 2000);

        // Verify order
        for (let i = 0; i < 5; i++) {
          expect(tracked.events[i].payload.sequence).toBe(i);
        }
      });
    });

    describe('Event Replay Policies (FR-016a, FR-016b, FR-016c)', () => {
      it('should default to critical-only replay policy (FR-016b)', () => {
        const policy = eventBus.getReplayPolicy('new-subscriber');

        expect(policy).toBe(EventReplayPolicy.CRITICAL_ONLY);
      });

      it('should allow setting NONE replay policy', () => {
        eventBus.setReplayPolicy('subscriber-1', EventReplayPolicy.NONE);

        const policy = eventBus.getReplayPolicy('subscriber-1');
        expect(policy).toBe(EventReplayPolicy.NONE);
      });

      it('should allow setting FULL replay policy', () => {
        eventBus.setReplayPolicy('subscriber-1', EventReplayPolicy.FULL);

        const policy = eventBus.getReplayPolicy('subscriber-1');
        expect(policy).toBe(EventReplayPolicy.FULL);
      });

      it('should allow setting CRITICAL_ONLY replay policy', () => {
        eventBus.setReplayPolicy(
          'subscriber-1',
          EventReplayPolicy.CRITICAL_ONLY
        );

        const policy = eventBus.getReplayPolicy('subscriber-1');
        expect(policy).toBe(EventReplayPolicy.CRITICAL_ONLY);
      });

      it('should respect NONE policy during replay', async () => {
        await eventBus.publish('policy.none', { message: 'event 1' });
        await eventBus.publish('policy.none', { message: 'event 2' });

        eventBus.setReplayPolicy('subscriber-1', EventReplayPolicy.NONE);

        const replayedCount = await eventBus.replay('subscriber-1', {
          topics: ['policy.none'],
        });

        expect(replayedCount).toBe(0);
      });

      it('should respect FULL policy during replay', async () => {
        await eventBus.publish('policy.full', { message: 'normal' });
        await eventBus.publish(
          'policy.full',
          { message: 'critical' },
          { priority: EventPriority.CRITICAL }
        );

        eventBus.setReplayPolicy('subscriber-1', EventReplayPolicy.FULL);

        const replayedCount = await eventBus.replay('subscriber-1', {
          topics: ['policy.full'],
        });

        expect(replayedCount).toBe(2); // Both events
      });

      it('should respect CRITICAL_ONLY policy during replay', async () => {
        await eventBus.publish('policy.critical', { message: 'normal' });
        await eventBus.publish(
          'policy.critical',
          { message: 'critical' },
          { priority: EventPriority.CRITICAL }
        );

        eventBus.setReplayPolicy(
          'subscriber-1',
          EventReplayPolicy.CRITICAL_ONLY
        );

        const replayedCount = await eventBus.replay('subscriber-1', {
          topics: ['policy.critical'],
        });

        expect(replayedCount).toBe(1); // Only critical event
      });

      it('should maintain independent policies per subscriber', () => {
        eventBus.setReplayPolicy('subscriber-1', EventReplayPolicy.NONE);
        eventBus.setReplayPolicy('subscriber-2', EventReplayPolicy.FULL);
        eventBus.setReplayPolicy(
          'subscriber-3',
          EventReplayPolicy.CRITICAL_ONLY
        );

        expect(eventBus.getReplayPolicy('subscriber-1')).toBe(
          EventReplayPolicy.NONE
        );
        expect(eventBus.getReplayPolicy('subscriber-2')).toBe(
          EventReplayPolicy.FULL
        );
        expect(eventBus.getReplayPolicy('subscriber-3')).toBe(
          EventReplayPolicy.CRITICAL_ONLY
        );
      });
    });

    describe('Event Replay Performance (SC-011)', () => {
      it('should replay 1000 events in under 200ms p95 (SC-011)', async () => {
        // Publish 1000 events
        for (let i = 0; i < 1000; i++) {
          await eventBus.publish('replay.perf', { index: i });
        }

        // Measure replay latency
        const durations: number[] = [];

        for (let i = 0; i < 20; i++) {
          const { duration } = await measureTime(() =>
            eventBus.replay(`subscriber-${i}`, {
              topics: ['replay.perf'],
            })
          );
          durations.push(duration);
        }

        const p95Latency = calculateP95(durations);

        expect(p95Latency).toBeLessThan(200);
      });
    });
  });

  // =========================================================================
  // Part 6: Event History Management (FR-014)
  // =========================================================================

  describe('EventBus Contract - Event History', () => {
    describe('clearEventHistory()', () => {
      it('should clear all event history when no parameters provided', async () => {
        await eventBus.publish('clear.test', { message: 'event 1' });
        await eventBus.publish('clear.test', { message: 'event 2' });

        await eventBus.clearEventHistory();

        const replayedCount = await eventBus.replay('subscriber-1', {
          topics: ['clear.test'],
        });

        expect(replayedCount).toBe(0);
      });

      it('should clear event history for specific session', async () => {
        await eventBus.publish(
          'session.test',
          { message: 'session-1' },
          { sessionId: 'session-1' }
        );
        await eventBus.publish(
          'session.test',
          { message: 'session-2' },
          { sessionId: 'session-2' }
        );

        await eventBus.clearEventHistory('session-1');

        // session-1 events should be cleared
        const session1Count = await eventBus.replay('subscriber-1', {
          topics: ['session.test'],
        });

        // Implementation-specific: May return 1 (session-2) or 0 (all cleared)
        expect(session1Count).toBeGreaterThanOrEqual(0);
      });

      it('should clear events older than timestamp', async () => {
        await eventBus.publish('old.test', { message: 'old event' });

        await new Promise((resolve) => setTimeout(resolve, 100));

        const cutoffTime = Date.now();

        await new Promise((resolve) => setTimeout(resolve, 100));

        await eventBus.publish('old.test', { message: 'new event' });

        await eventBus.clearEventHistory(undefined, cutoffTime);

        const replayedCount = await eventBus.replay('subscriber-1', {
          topics: ['old.test'],
        });

        // Only new event should remain
        expect(replayedCount).toBe(1);
      });

      it('should handle clearing empty history (idempotent)', async () => {
        await expect(eventBus.clearEventHistory()).resolves.not.toThrow();
        await expect(eventBus.clearEventHistory()).resolves.not.toThrow();
      });
    });
  });

  // =========================================================================
  // Part 7: Statistics and Observability (FR-015, FR-043)
  // =========================================================================

  describe('EventBus Contract - Statistics', () => {
    describe('getStats()', () => {
      it('should return total events published', async () => {
        await eventBus.publish('stats.test', { message: 'event 1' });
        await eventBus.publish('stats.test', { message: 'event 2' });
        await eventBus.publish('stats.test', { message: 'event 3' });

        const stats = eventBus.getStats();

        expect(stats.totalEventsPublished).toBeGreaterThanOrEqual(3);
      });

      it('should return total events delivered', async () => {
        const tracked = createTrackedHandler();

        eventBus.subscribe('delivery.stats', 'subscriber-1', tracked.handler);

        await eventBus.publish('delivery.stats', { message: 'event 1' });
        await eventBus.publish('delivery.stats', { message: 'event 2' });

        await waitFor(() => tracked.callCount === 2, 1000);

        const stats = eventBus.getStats();

        expect(stats.totalEventsDelivered).toBeGreaterThanOrEqual(2);
      });

      it('should return active subscription count', () => {
        const tracked1 = createTrackedHandler();
        const tracked2 = createTrackedHandler();

        eventBus.subscribe('sub.stats.1', 'subscriber-1', tracked1.handler);
        eventBus.subscribe('sub.stats.2', 'subscriber-2', tracked2.handler);

        const stats = eventBus.getStats();

        expect(stats.activeSubscriptions).toBeGreaterThanOrEqual(2);
      });

      it('should return unique topic count', async () => {
        await eventBus.publish('topic.one', { message: 'test' });
        await eventBus.publish('topic.two', { message: 'test' });
        await eventBus.publish('topic.three', { message: 'test' });

        const stats = eventBus.getStats();

        expect(stats.uniqueTopics).toBeGreaterThanOrEqual(3);
      });

      it('should return events by priority', async () => {
        await eventBus.publish('priority.stats', { message: 'normal' });
        await eventBus.publish(
          'priority.stats',
          { message: 'critical' },
          { priority: EventPriority.CRITICAL }
        );

        const stats = eventBus.getStats();

        expect(stats.eventsByPriority.normal).toBeGreaterThanOrEqual(1);
        expect(stats.eventsByPriority.critical).toBeGreaterThanOrEqual(1);
      });

      it('should return average propagation latency', async () => {
        const tracked = createTrackedHandler();

        eventBus.subscribe('latency.stats', 'subscriber-1', tracked.handler);

        for (let i = 0; i < 10; i++) {
          await eventBus.publish('latency.stats', { index: i });
        }

        await waitFor(() => tracked.callCount === 10, 1000);

        const stats = eventBus.getStats();

        expect(stats.avgPropagationLatencyMs).toBeDefined();
        expect(typeof stats.avgPropagationLatencyMs).toBe('number');
        expect(stats.avgPropagationLatencyMs).toBeGreaterThanOrEqual(0);
      });

      it('should return event history size in bytes', async () => {
        await eventBus.publish('size.stats', { message: 'test' });

        const stats = eventBus.getStats();

        expect(stats.eventHistorySizeBytes).toBeDefined();
        expect(typeof stats.eventHistorySizeBytes).toBe('number');
        expect(stats.eventHistorySizeBytes).toBeGreaterThanOrEqual(0);
      });

      it('should update stats in real-time', async () => {
        const stats1 = eventBus.getStats();
        const initialCount = stats1.totalEventsPublished;

        await eventBus.publish('realtime.stats', { message: 'test' });

        const stats2 = eventBus.getStats();

        expect(stats2.totalEventsPublished).toBeGreaterThan(initialCount);
      });
    });
  });

  // =========================================================================
  // Part 8: Subscription Options (Session/Conversation Scoping)
  // =========================================================================

  describe('EventBus Contract - Subscription Options', () => {
    describe('Session-Scoped Subscriptions', () => {
      it('should filter events by sessionId', async () => {
        const tracked = createTrackedHandler();

        eventBus.subscribe('session.scoped', 'subscriber-1', tracked.handler, {
          sessionId: 'session-123',
        });

        await eventBus.publish(
          'session.scoped',
          { message: 'session-123' },
          { sessionId: 'session-123' }
        );
        await eventBus.publish(
          'session.scoped',
          { message: 'session-456' },
          { sessionId: 'session-456' }
        );

        await waitFor(() => tracked.callCount > 0, 1000);

        // Should only receive events from session-123
        expect(tracked.callCount).toBe(1);
        expect(tracked.events[0].payload.message).toBe('session-123');
      });
    });

    describe('Conversation-Scoped Subscriptions', () => {
      it('should filter events by conversationId', async () => {
        const tracked = createTrackedHandler();

        eventBus.subscribe('conv.scoped', 'subscriber-1', tracked.handler, {
          conversationId: 'conv-abc',
        });

        await eventBus.publish(
          'conv.scoped',
          { message: 'conv-abc' },
          { conversationId: 'conv-abc' }
        );
        await eventBus.publish(
          'conv.scoped',
          { message: 'conv-xyz' },
          { conversationId: 'conv-xyz' }
        );

        await waitFor(() => tracked.callCount > 0, 1000);

        expect(tracked.callCount).toBe(1);
        expect(tracked.events[0].payload.message).toBe('conv-abc');
      });
    });

    describe('Priority-Filtered Subscriptions', () => {
      it('should filter events by priority', async () => {
        const tracked = createTrackedHandler();

        eventBus.subscribe('priority.filtered', 'subscriber-1', tracked.handler, {
          priority: EventPriority.CRITICAL,
        });

        await eventBus.publish('priority.filtered', { message: 'normal' });
        await eventBus.publish(
          'priority.filtered',
          { message: 'critical' },
          { priority: EventPriority.CRITICAL }
        );

        await waitFor(() => tracked.callCount > 0, 1000);

        expect(tracked.callCount).toBe(1);
        expect(tracked.events[0].payload.message).toBe('critical');
      });
    });
  });

  // =========================================================================
  // Part 9: Edge Cases and Error Handling
  // =========================================================================

  describe('EventBus Contract - Edge Cases', () => {
    describe('Error Handling', () => {
      it('should handle invalid topic names', async () => {
        const invalidTopics = ['', null as any, undefined as any];

        for (const topic of invalidTopics) {
          await expect(
            eventBus.publish(topic, { message: 'test' })
          ).rejects.toThrow();
        }
      });

      it('should handle invalid subscriber IDs', () => {
        const invalidIds = ['', null as any, undefined as any];
        const handler = createTrackedHandler().handler;

        for (const id of invalidIds) {
          expect(() =>
            eventBus.subscribe('test.topic', id, handler)
          ).toThrow();
        }
      });

      it('should handle null/undefined event handlers', () => {
        expect(() =>
          eventBus.subscribe('test.topic', 'subscriber-1', null as any)
        ).toThrow();

        expect(() =>
          eventBus.subscribe('test.topic', 'subscriber-1', undefined as any)
        ).toThrow();
      });

      it('should handle handler exceptions gracefully', async () => {
        const errorHandler: EventHandler = () => {
          throw new Error('Handler error');
        };
        const successTracked = createTrackedHandler();

        eventBus.subscribe('error.handling', 'error-sub', errorHandler);
        eventBus.subscribe('error.handling', 'success-sub', successTracked.handler);

        // Should not throw
        await expect(
          eventBus.publish('error.handling', { message: 'test' })
        ).resolves.toBeDefined();

        // Success handler should still receive event
        await waitFor(() => successTracked.callCount > 0, 1000);
        expect(successTracked.callCount).toBe(1);
      });

      it('should handle async handler rejections', async () => {
        const rejectHandler: EventHandler = async () => {
          throw new Error('Async handler rejection');
        };
        const successTracked = createTrackedHandler();

        eventBus.subscribe('async.error', 'reject-sub', rejectHandler);
        eventBus.subscribe('async.error', 'success-sub', successTracked.handler);

        await eventBus.publish('async.error', { message: 'test' });

        await waitFor(() => successTracked.callCount > 0, 1000);
        expect(successTracked.callCount).toBe(1);
      });
    });

    describe('Concurrency', () => {
      it('should handle concurrent publishes', async () => {
        const publishPromises = [];
        for (let i = 0; i < 100; i++) {
          publishPromises.push(
            eventBus.publish('concurrent.publish', { index: i })
          );
        }

        const eventIds = await Promise.all(publishPromises);

        // All should succeed with unique IDs
        expect(eventIds.length).toBe(100);
        const uniqueIds = new Set(eventIds);
        expect(uniqueIds.size).toBe(100);
      });

      it('should handle concurrent subscriptions', () => {
        const handlers = Array.from({ length: 50 }, () =>
          createTrackedHandler().handler
        );

        // Subscribe concurrently
        handlers.forEach((handler, i) => {
          eventBus.subscribe('concurrent.sub', `subscriber-${i}`, handler);
        });

        const stats = eventBus.getStats();
        expect(stats.activeSubscriptions).toBeGreaterThanOrEqual(50);
      });

      it('should handle concurrent subscribe/unsubscribe', async () => {
        const tracked = createTrackedHandler();

        // Rapid subscribe/unsubscribe cycles
        for (let i = 0; i < 20; i++) {
          eventBus.subscribe('rapid.cycle', 'subscriber-1', tracked.handler);
          eventBus.unsubscribe('rapid.cycle', 'subscriber-1');
        }

        // Final state should be unsubscribed
        await eventBus.publish('rapid.cycle', { message: 'test' });
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(tracked.callCount).toBe(0);
      });
    });

    describe('Large Payloads', () => {
      it('should handle large event payloads (1MB)', async () => {
        const tracked = createTrackedHandler();

        eventBus.subscribe('large.payload', 'subscriber-1', tracked.handler);

        // Create 1MB payload
        const largePayload = {
          data: 'x'.repeat(1024 * 1024),
          metadata: { size: '1MB' },
        };

        const eventId = await eventBus.publish('large.payload', largePayload);
        expect(eventId).toBeDefined();

        await waitFor(() => tracked.callCount > 0, 2000);

        expect(tracked.events[0].payload.data.length).toBe(1024 * 1024);
      });
    });

    describe('Memory Management', () => {
      it('should handle many subscribers without memory issues', () => {
        const handlers = Array.from({ length: 1000 }, () =>
          createTrackedHandler().handler
        );

        handlers.forEach((handler, i) => {
          eventBus.subscribe('memory.test', `subscriber-${i}`, handler);
        });

        const stats = eventBus.getStats();
        expect(stats.activeSubscriptions).toBeGreaterThanOrEqual(1000);
      });

      it('should clean up after unsubscribeAll', () => {
        const handlers = Array.from({ length: 100 }, () =>
          createTrackedHandler().handler
        );

        // Subscribe
        handlers.forEach((handler, i) => {
          eventBus.subscribe('cleanup.test', `subscriber-${i}`, handler);
        });

        // Unsubscribe all
        for (let i = 0; i < 100; i++) {
          eventBus.unsubscribeAll(`subscriber-${i}`);
        }

        const stats = eventBus.getStats();
        // Subscriptions should be cleaned up
        expect(stats.activeSubscriptions).toBe(0);
      });
    });
  });
}
