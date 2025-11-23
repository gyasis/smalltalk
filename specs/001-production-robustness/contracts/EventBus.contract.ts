/**
 * EventBus Contract
 *
 * Defines the interface for event-driven agent communication with
 * publish-subscribe patterns and event replay capabilities.
 *
 * @see spec.md User Story 3 - Event-Driven Agent Communication
 * @see research.md Section 1 - Event Bus Library Selection
 */

import { Event, EventPriority, EventReplayPolicy } from '../../../src/types/robustness.js';

/**
 * Event subscription handler
 */
export type EventHandler<T = any> = (payload: T, event: Event) => void | Promise<void>;

/**
 * Event subscription options
 */
export interface SubscribeOptions {
  /** Filter events by priority */
  priority?: EventPriority;
  /** Only receive events from this session */
  sessionId?: string;
  /** Only receive events from this conversation */
  conversationId?: string;
}

/**
 * Event replay options
 */
export interface ReplayOptions {
  /** Replay events since this timestamp */
  since?: number;
  /** Replay events until this timestamp */
  until?: number;
  /** Only replay events with this priority */
  priority?: EventPriority;
  /** Only replay events on these topics */
  topics?: string[];
  /** Maximum number of events to replay */
  limit?: number;
}

/**
 * Event publishing options
 */
export interface PublishOptions {
  /** Event priority (default: 'normal') */
  priority?: EventPriority;
  /** Session ID for session-scoped events */
  sessionId?: string;
  /** Conversation ID for conversation-scoped events */
  conversationId?: string;
  /** Metadata to attach to event */
  metadata?: Record<string, any>;
}

/**
 * EventBus interface
 *
 * Responsible for event-driven communication between agents.
 */
export interface EventBus {
  /**
   * Publish event to topic
   *
   * FR-011: System MUST provide event bus for publishing
   * FR-013: System MUST deliver events with minimal latency
   * SC-008: Events propagate in under 10ms
   *
   * @param topic Event topic
   * @param payload Event payload
   * @param options Publishing options
   * @returns Published event ID
   */
  publish<T = any>(
    topic: string,
    payload: T,
    options?: PublishOptions
  ): Promise<string>;

  /**
   * Subscribe to events on topic
   *
   * FR-012: System MUST support topic-based subscriptions
   *
   * @param topic Event topic (supports wildcards: 'agent.*', 'task:*')
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
  ): () => void;

  /**
   * Unsubscribe from topic
   *
   * @param topic Event topic
   * @param subscriberId Subscriber ID
   */
  unsubscribe(topic: string, subscriberId: string): void;

  /**
   * Unsubscribe subscriber from all topics
   *
   * @param subscriberId Subscriber ID
   */
  unsubscribeAll(subscriberId: string): void;

  /**
   * Replay events for a subscriber
   *
   * FR-014: System MUST persist events for replay
   * FR-016a: System MUST support configurable event replay policies
   * SC-011: Event replay completes in under 200ms
   *
   * @param subscriberId Subscriber ID
   * @param options Replay options
   * @returns Number of events replayed
   */
  replay(subscriberId: string, options?: ReplayOptions): Promise<number>;

  /**
   * Set event replay policy for subscriber
   *
   * FR-016b: System MUST default to critical-events-only replay
   * FR-016c: System MUST allow agents to specify replay behavior
   *
   * @param subscriberId Subscriber ID
   * @param policy Replay policy
   */
  setReplayPolicy(subscriberId: string, policy: EventReplayPolicy): void;

  /**
   * Get replay policy for subscriber
   *
   * @param subscriberId Subscriber ID
   * @returns Current replay policy
   */
  getReplayPolicy(subscriberId: string): EventReplayPolicy;

  /**
   * Clear event history for session
   *
   * @param sessionId Session ID
   * @param olderThan Optional timestamp - clear events older than this
   */
  clearEventHistory(sessionId?: string, olderThan?: number): Promise<void>;

  /**
   * Get event bus statistics
   *
   * FR-015: System MUST integrate event patterns into orchestration
   *
   * @returns Event bus statistics
   */
  getStats(): EventBusStats;
}

/**
 * Event bus statistics
 */
export interface EventBusStats {
  /** Total events published */
  totalEventsPublished: number;
  /** Total events delivered */
  totalEventsDelivered: number;
  /** Current number of active subscriptions */
  activeSubscriptions: number;
  /** Total unique topics */
  uniqueTopics: number;
  /** Events currently in replay queue */
  eventsInReplayQueue: number;
  /** Average event propagation latency in milliseconds */
  avgPropagationLatencyMs: number;
  /** Events published by priority */
  eventsByPriority: {
    critical: number;
    normal: number;
  };
  /** Storage size for event history in bytes */
  eventHistorySizeBytes: number;
}
