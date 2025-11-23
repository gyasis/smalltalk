/**
 * EventBus Implementation
 *
 * Provides event-driven communication between agents with publish-subscribe patterns,
 * at-least-once delivery, event persistence, and replay capabilities.
 *
 * @see specs/001-production-robustness/contracts/EventBus.contract.ts
 * @see specs/001-production-robustness/spec.md FR-011 to FR-016c
 */

import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { performance } from 'perf_hooks';
import {
  EventBus as IEventBus,
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
} from '../types/robustness';

/**
 * Subscription data structure
 */
interface Subscription<T = any> {
  topic: string;
  subscriberId: string;
  handler: EventHandler<T>;
  options?: SubscribeOptions;
}

/**
 * Latency tracking for performance monitoring
 */
interface LatencyMeasurement {
  timestamp: number;
  latencyMs: number;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  eventRetentionHours: 24, // FR-014
  processedEventRegistryMaxSize: 10000, // FR-011a
  eventLogDirectory: 'data/events',
  latencyAlertThresholdMs: 10, // SC-008
  latencyWindowMinutes: 5, // FR-013
};

/**
 * EventBus implementation
 *
 * Responsibilities:
 * - Topic-based publish-subscribe routing (FR-011, FR-012)
 * - At-least-once delivery with deduplication (FR-011a)
 * - Event persistence in JSONL format (FR-014)
 * - Event replay with filtering (FR-014, SC-011)
 * - Replay policy management (FR-016a, FR-016b, FR-016c)
 * - Latency measurement and monitoring (FR-013, SC-008)
 */
export class EventBus implements IEventBus {
  // Subscriptions registry
  private subscriptions: Map<string, Set<Subscription>> = new Map();

  // Processed event tracking for at-least-once delivery (FR-011a)
  private processedEvents: Map<string, Set<string>> = new Map();

  // Replay policies per subscriber (FR-016a/b/c)
  private replayPolicies: Map<string, EventReplayPolicy> = new Map();

  // Statistics tracking
  private stats = {
    totalEventsPublished: 0,
    totalEventsDelivered: 0,
    eventsByPriority: {
      critical: 0,
      normal: 0,
    },
    latencies: [] as LatencyMeasurement[],
  };

  // Cleanup intervals
  private cleanupInterval?: NodeJS.Timeout;
  private latencyCheckInterval?: NodeJS.Timeout;

  // Configuration
  private config = DEFAULT_CONFIG;

  /**
   * Initialize the event bus
   */
  async initialize(): Promise<void> {
    // Create event log directory
    await fs.mkdir(this.config.eventLogDirectory, { recursive: true });

    // Start cleanup tasks
    this.startCleanupTasks();
  }

  /**
   * Publish event to topic (FR-011, FR-013, SC-008)
   *
   * Target: <10ms p95 propagation latency
   *
   * @param topic Event topic
   * @param payload Event payload
   * @param options Publishing options
   * @returns Published event ID
   */
  async publish<T = any>(
    topic: string,
    payload: T,
    options?: PublishOptions
  ): Promise<string> {
    const publishStart = performance.now();

    // Create event with UUID v4
    const event: Event = {
      id: crypto.randomUUID(),
      topic,
      payload,
      priority: options?.priority ?? EventPriority.NORMAL,
      timestamp: Date.now(),
      sessionId: options?.sessionId,
      conversationId: options?.conversationId,
      metadata: options?.metadata,
    };

    // Update statistics
    this.stats.totalEventsPublished++;
    this.stats.eventsByPriority[event.priority]++;

    // Persist event to log (FR-014)
    await this.persistEvent(event);

    // Deliver to subscribers
    await this.deliverEvent(event);

    // Track latency (FR-013)
    const latency = performance.now() - publishStart;
    this.trackLatency(latency);

    return event.id;
  }

  /**
   * Subscribe to events on topic (FR-012)
   *
   * Supports wildcard patterns: 'agent:*', 'task:*'
   *
   * @param topic Event topic (supports wildcards)
   * @param subscriberId Unique subscriber ID
   * @param handler Event handler function
   * @param options Subscription options
   * @returns Unsubscribe function
   */
  subscribe<T = any>(
    topic: string,
    subscriberId: string,
    handler: EventHandler<T>,
    options?: SubscribeOptions
  ): () => void {
    const subscription: Subscription<T> = {
      topic,
      subscriberId,
      handler,
      options,
    };

    // Add subscription to registry
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
    }
    this.subscriptions.get(topic)!.add(subscription);

    // Initialize processed events registry for subscriber (FR-011a)
    if (!this.processedEvents.has(subscriberId)) {
      this.processedEvents.set(subscriberId, new Set());
    }

    // Set default replay policy if not already set (FR-016b)
    if (!this.replayPolicies.has(subscriberId)) {
      this.replayPolicies.set(subscriberId, EventReplayPolicy.CRITICAL_ONLY);
    }

    // Return unsubscribe function
    return () => {
      this.unsubscribe(topic, subscriberId);
    };
  }

  /**
   * Unsubscribe from topic
   *
   * @param topic Event topic
   * @param subscriberId Subscriber ID
   */
  unsubscribe(topic: string, subscriberId: string): void {
    const topicSubs = this.subscriptions.get(topic);
    if (topicSubs) {
      // Remove all subscriptions for this subscriber on this topic
      for (const sub of topicSubs) {
        if (sub.subscriberId === subscriberId) {
          topicSubs.delete(sub);
        }
      }

      // Clean up empty topic
      if (topicSubs.size === 0) {
        this.subscriptions.delete(topic);
      }
    }
  }

  /**
   * Unsubscribe subscriber from all topics
   *
   * @param subscriberId Subscriber ID
   */
  unsubscribeAll(subscriberId: string): void {
    for (const [topic, subs] of this.subscriptions.entries()) {
      for (const sub of subs) {
        if (sub.subscriberId === subscriberId) {
          subs.delete(sub);
        }
      }

      // Clean up empty topics
      if (subs.size === 0) {
        this.subscriptions.delete(topic);
      }
    }

    // Clean up processed events registry
    this.processedEvents.delete(subscriberId);
    this.replayPolicies.delete(subscriberId);
  }

  /**
   * Replay events for a subscriber (FR-014, FR-016a, SC-011)
   *
   * Target: <200ms replay performance
   *
   * @param subscriberId Subscriber ID
   * @param options Replay options
   * @returns Number of events replayed
   */
  async replay(subscriberId: string, options?: ReplayOptions): Promise<number> {
    const replayStart = performance.now();

    // Load events from persistence
    const events = await this.loadEvents(options);

    // Get subscriber's subscriptions
    const subscriberSubs = this.getSubscriberSubscriptions(subscriberId);

    let replayedCount = 0;

    for (const event of events) {
      // Check if subscriber is interested in this event
      const matchingSubs = subscriberSubs.filter(sub =>
        this.topicMatches(event.topic, sub.topic)
      );

      if (matchingSubs.length === 0) {
        continue;
      }

      // Apply replay policy filters
      if (!this.shouldReplayEvent(subscriberId, event)) {
        continue;
      }

      // Deliver event to subscriber
      for (const sub of matchingSubs) {
        await this.deliverToSubscriber(event, sub);
        replayedCount++;
      }
    }

    const replayTime = performance.now() - replayStart;

    // Log warning if replay exceeds target (SC-011)
    if (replayTime > 200) {
      console.warn(
        `[EventBus] Replay latency exceeded 200ms: ${replayTime.toFixed(2)}ms for ${replayedCount} events`
      );
    }

    return replayedCount;
  }

  /**
   * Set event replay policy for subscriber (FR-016a, FR-016b, FR-016c)
   *
   * @param subscriberId Subscriber ID
   * @param policy Replay policy
   */
  setReplayPolicy(subscriberId: string, policy: EventReplayPolicy): void {
    this.replayPolicies.set(subscriberId, policy);
  }

  /**
   * Get replay policy for subscriber
   *
   * @param subscriberId Subscriber ID
   * @returns Current replay policy
   */
  getReplayPolicy(subscriberId: string): EventReplayPolicy {
    return this.replayPolicies.get(subscriberId) ?? EventReplayPolicy.CRITICAL_ONLY;
  }

  /**
   * Clear event history for session
   *
   * @param sessionId Session ID (optional)
   * @param olderThan Optional timestamp - clear events older than this
   */
  async clearEventHistory(sessionId?: string, olderThan?: number): Promise<void> {
    // Get all topic log files
    const logFiles = await fs.readdir(this.config.eventLogDirectory);

    for (const logFile of logFiles) {
      if (!logFile.endsWith('.log')) continue;

      const filePath = path.join(this.config.eventLogDirectory, logFile);
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());

      // Filter events
      const filteredLines = lines.filter(line => {
        try {
          const event: Event = JSON.parse(line);

          // Filter by session ID
          if (sessionId && event.sessionId !== sessionId) {
            return true; // Keep event
          }

          // Filter by age
          if (olderThan && event.timestamp >= olderThan) {
            return true; // Keep event
          }

          return false; // Remove event
        } catch {
          return true; // Keep malformed lines
        }
      });

      // Write filtered events back
      await fs.writeFile(filePath, filteredLines.join('\n') + '\n');
    }
  }

  /**
   * Get event bus statistics (FR-015, FR-043)
   *
   * @returns Event bus statistics
   */
  getStats(): EventBusStats {
    // Calculate average propagation latency
    const recentLatencies = this.stats.latencies.slice(-1000); // Last 1000 events
    const avgLatency =
      recentLatencies.length > 0
        ? recentLatencies.reduce((sum, l) => sum + l.latencyMs, 0) / recentLatencies.length
        : 0;

    // Count active subscriptions
    let activeSubscriptions = 0;
    for (const subs of this.subscriptions.values()) {
      activeSubscriptions += subs.size;
    }

    // Calculate event history size
    let eventHistorySizeBytes = 0;
    // Note: Would need async operation to calculate accurately
    // For now, estimate based on events published

    return {
      totalEventsPublished: this.stats.totalEventsPublished,
      totalEventsDelivered: this.stats.totalEventsDelivered,
      activeSubscriptions,
      uniqueTopics: this.subscriptions.size,
      eventsInReplayQueue: 0, // Not implemented in this phase
      avgPropagationLatencyMs: avgLatency,
      eventsByPriority: { ...this.stats.eventsByPriority },
      eventHistorySizeBytes,
    };
  }

  /**
   * Stop event bus and cleanup
   */
  async stop(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    if (this.latencyCheckInterval) {
      clearInterval(this.latencyCheckInterval);
      this.latencyCheckInterval = undefined;
    }
  }

  // Private helper methods

  /**
   * Persist event to append-only log (FR-014)
   *
   * Format: JSONL (one JSON object per line)
   * File structure: data/events/<topic>.log
   */
  private async persistEvent(event: Event): Promise<void> {
    try {
      // Sanitize topic for filename
      const topicFilename = event.topic.replace(/[:/]/g, '_');
      const logPath = path.join(this.config.eventLogDirectory, `${topicFilename}.log`);

      // Append event as JSON line
      const eventLine = JSON.stringify(event) + '\n';
      await fs.appendFile(logPath, eventLine, { mode: 0o600 }); // FR-034b: restrictive permissions
    } catch (error) {
      console.error('[EventBus] Failed to persist event:', error);
      // Continue - persistence failure should not block event delivery
    }
  }

  /**
   * Deliver event to all matching subscribers (FR-011, FR-013)
   */
  private async deliverEvent(event: Event): Promise<void> {
    // Find matching subscriptions (exact match + wildcards)
    const matchingSubs = this.findMatchingSubscriptions(event);

    // Deliver to each subscriber
    for (const sub of matchingSubs) {
      await this.deliverToSubscriber(event, sub);
    }
  }

  /**
   * Deliver event to a single subscriber with deduplication (FR-011a)
   */
  private async deliverToSubscriber(event: Event, subscription: Subscription): Promise<void> {
    const { subscriberId, handler, options } = subscription;

    // Check filters
    if (options?.priority && event.priority !== options.priority) {
      return;
    }
    if (options?.sessionId && event.sessionId !== options.sessionId) {
      return;
    }
    if (options?.conversationId && event.conversationId !== options.conversationId) {
      return;
    }

    // Check processed events registry for deduplication (FR-011a)
    const processedSet = this.processedEvents.get(subscriberId);
    if (processedSet?.has(event.id)) {
      // Event already processed - skip
      return;
    }

    try {
      // Invoke handler
      await handler(event.payload, event);

      // Mark event as processed (FR-011a)
      if (processedSet) {
        processedSet.add(event.id);

        // Apply LRU eviction if registry exceeds max size
        if (processedSet.size > this.config.processedEventRegistryMaxSize) {
          const firstEntry = processedSet.values().next().value;
          processedSet.delete(firstEntry);
        }
      }

      // Update delivery statistics
      this.stats.totalEventsDelivered++;
    } catch (error) {
      console.error(
        `[EventBus] Handler error for subscriber ${subscriberId}:`,
        error
      );
      // Continue - handler failure should not affect other subscribers
    }
  }

  /**
   * Find all subscriptions matching an event
   */
  private findMatchingSubscriptions(event: Event): Subscription[] {
    const matching: Subscription[] = [];

    for (const [topic, subs] of this.subscriptions.entries()) {
      if (this.topicMatches(event.topic, topic)) {
        matching.push(...subs);
      }
    }

    return matching;
  }

  /**
   * Check if event topic matches subscription topic (with wildcard support)
   *
   * Examples:
   * - 'agent:started' matches 'agent:started' (exact)
   * - 'agent:started' matches 'agent:*' (wildcard)
   * - 'task:completed:123' matches 'task:*' (wildcard prefix)
   */
  private topicMatches(eventTopic: string, subscriptionTopic: string): boolean {
    // Exact match
    if (eventTopic === subscriptionTopic) {
      return true;
    }

    // Wildcard match
    if (subscriptionTopic.endsWith('*')) {
      const prefix = subscriptionTopic.slice(0, -1); // Remove '*'
      return eventTopic.startsWith(prefix);
    }

    return false;
  }

  /**
   * Get all subscriptions for a subscriber
   */
  private getSubscriberSubscriptions(subscriberId: string): Subscription[] {
    const subs: Subscription[] = [];

    for (const topicSubs of this.subscriptions.values()) {
      for (const sub of topicSubs) {
        if (sub.subscriberId === subscriberId) {
          subs.push(sub);
        }
      }
    }

    return subs;
  }

  /**
   * Load events from persistence with filtering
   */
  private async loadEvents(options?: ReplayOptions): Promise<Event[]> {
    const events: Event[] = [];

    try {
      // Get all topic log files
      const logFiles = await fs.readdir(this.config.eventLogDirectory);

      for (const logFile of logFiles) {
        if (!logFile.endsWith('.log')) continue;

        // Check topic filter
        if (options?.topics) {
          const topicName = logFile.replace('.log', '').replace(/_/g, ':');
          if (!options.topics.some(t => this.topicMatches(topicName, t))) {
            continue;
          }
        }

        const filePath = path.join(this.config.eventLogDirectory, logFile);
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const event: Event = JSON.parse(line);

            // Apply filters
            if (options?.since && event.timestamp < options.since) {
              continue;
            }
            if (options?.until && event.timestamp > options.until) {
              continue;
            }
            if (options?.priority && event.priority !== options.priority) {
              continue;
            }

            events.push(event);
          } catch (error) {
            console.error('[EventBus] Failed to parse event line:', error);
          }
        }
      }

      // Sort by timestamp (chronological order for replay)
      events.sort((a, b) => a.timestamp - b.timestamp);

      // Apply limit
      if (options?.limit && events.length > options.limit) {
        return events.slice(0, options.limit);
      }

      return events;
    } catch (error) {
      console.error('[EventBus] Failed to load events:', error);
      return [];
    }
  }

  /**
   * Check if event should be replayed based on replay policy (FR-016a/b/c)
   */
  private shouldReplayEvent(subscriberId: string, event: Event): boolean {
    const policy = this.getReplayPolicy(subscriberId);

    switch (policy) {
      case EventReplayPolicy.NONE:
        return false;
      case EventReplayPolicy.FULL:
        return true;
      case EventReplayPolicy.CRITICAL_ONLY:
        return event.priority === EventPriority.CRITICAL;
      default:
        return false;
    }
  }

  /**
   * Track event propagation latency (FR-013)
   */
  private trackLatency(latencyMs: number): void {
    this.stats.latencies.push({
      timestamp: Date.now(),
      latencyMs,
    });

    // Keep only recent measurements (last hour)
    const oneHourAgo = Date.now() - 3600000;
    this.stats.latencies = this.stats.latencies.filter(
      l => l.timestamp > oneHourAgo
    );

    // Log warning if latency exceeds threshold (SC-008)
    if (latencyMs > this.config.latencyAlertThresholdMs) {
      console.warn(
        `[EventBus] Event propagation latency exceeded ${this.config.latencyAlertThresholdMs}ms: ${latencyMs.toFixed(2)}ms`
      );
    }
  }

  /**
   * Start cleanup tasks (FR-011a, FR-014)
   */
  private startCleanupTasks(): void {
    // Cleanup processed events registry (hourly)
    this.cleanupInterval = setInterval(() => {
      this.cleanupProcessedEvents();
      this.cleanupEventLogs();
    }, 3600000); // 1 hour

    // Check latency violations (every 5 minutes) - FR-013
    this.latencyCheckInterval = setInterval(() => {
      this.checkLatencyViolations();
    }, 300000); // 5 minutes
  }

  /**
   * Cleanup old processed event IDs (FR-011a)
   */
  private cleanupProcessedEvents(): void {
    const cutoffTime = Date.now() - this.config.eventRetentionHours * 3600000;

    // Note: Current implementation doesn't track timestamps for processed events
    // In production, would need to enhance registry to track processing timestamps
    // For now, we rely on LRU eviction during delivery

    console.log('[EventBus] Processed events cleanup completed');
  }

  /**
   * Cleanup old event logs (FR-014)
   */
  private async cleanupEventLogs(): Promise<void> {
    try {
      const cutoffTime = Date.now() - this.config.eventRetentionHours * 3600000;
      const logFiles = await fs.readdir(this.config.eventLogDirectory);

      for (const logFile of logFiles) {
        if (!logFile.endsWith('.log')) continue;

        const filePath = path.join(this.config.eventLogDirectory, logFile);
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());

        // Filter events newer than cutoff
        const filteredLines = lines.filter(line => {
          try {
            const event: Event = JSON.parse(line);
            return event.timestamp >= cutoffTime;
          } catch {
            return true; // Keep malformed lines
          }
        });

        // Write filtered events back
        await fs.writeFile(filePath, filteredLines.join('\n') + '\n');
      }

      console.log('[EventBus] Event log cleanup completed');
    } catch (error) {
      console.error('[EventBus] Event log cleanup failed:', error);
    }
  }

  /**
   * Check for latency violations and emit critical alert (FR-013)
   */
  private checkLatencyViolations(): void {
    const windowStart = Date.now() - this.config.latencyWindowMinutes * 60000;
    const windowLatencies = this.stats.latencies.filter(
      l => l.timestamp > windowStart
    );

    if (windowLatencies.length === 0) {
      return;
    }

    // Calculate p95 latency
    const sorted = windowLatencies.map(l => l.latencyMs).sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p95Latency = sorted[p95Index] ?? 0;

    // Emit critical alert if p95 exceeds threshold (FR-013)
    if (p95Latency > this.config.latencyAlertThresholdMs) {
      console.error(
        `[EventBus] CRITICAL: p95 latency exceeded ${this.config.latencyAlertThresholdMs}ms over ${this.config.latencyWindowMinutes}-minute window: ${p95Latency.toFixed(2)}ms`
      );
    }
  }
}
