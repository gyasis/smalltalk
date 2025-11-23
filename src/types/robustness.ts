/**
 * Type definitions for Production Robustness features
 *
 * @see specs/001-production-robustness/spec.md
 */

/**
 * Session state enumeration
 *
 * Represents the lifecycle state of a conversation session.
 */
export enum SessionState {
  /** Session is actively processing messages */
  ACTIVE = 'active',
  /** Session is paused, not accepting new messages */
  PAUSED = 'paused',
  /** Session has expired per expiration policy */
  EXPIRED = 'expired',
  /** Session invalidated via API, pending cleanup */
  INVALIDATED_PENDING_CLEANUP = 'invalidated_pending_cleanup',
  /** Session closed normally by user */
  CLOSED = 'closed',
}

/**
 * Agent context data with optional trimmable fields
 *
 * Context fields can be marked as trimmable for state size management.
 */
export interface AgentContext {
  /** Agent-specific context variables */
  [key: string]: any;
  /** Metadata for field management */
  _metadata?: {
    [fieldName: string]: {
      /** If true, field can be trimmed when state exceeds size limit */
      trimmable?: boolean;
    };
  };
}

/**
 * Message turn in conversation history
 */
export interface MessageTurn {
  /** Turn sequence number */
  sequence: number;
  /** Message timestamp */
  timestamp: Date;
  /** User message */
  userMessage: string;
  /** Agent response(s) */
  agentResponses: Array<{
    agentId: string;
    response: string;
    timestamp: Date;
  }>;
}

/**
 * Session entity
 *
 * Represents a persistent conversation context with full state.
 * Serialization format: JSON (see Session.toJSON() and Session.fromJSON())
 *
 * FR-001: Unique session identifiers using UUID v4
 * FR-002: Serialized to persistent storage at configurable intervals
 * FR-003: Restored from session ID with full history and context
 * FR-004: Session expiration policies with configurable timeout
 */
export interface Session {
  /** Unique session identifier (UUID v4) */
  id: string;

  /** Session creation timestamp */
  createdAt: Date;

  /** Session last updated timestamp */
  updatedAt: Date;

  /** Session expiration timestamp (based on SESSION_EXPIRATION_DAYS) */
  expiresAt: Date;

  /** Current session state */
  state: SessionState;

  /** Active agent IDs participating in session */
  agentIds: string[];

  /** Serialized agent state per agent */
  agentStates: {
    [agentId: string]: {
      /** Agent configuration */
      config: Record<string, any>;
      /** Agent context with trimmable fields */
      context: AgentContext;
      /** Recent message history (configurable via AGENT_STATE_MESSAGE_HISTORY) */
      messageHistory: MessageTurn[];
    };
  };

  /** Full conversation history */
  conversationHistory: MessageTurn[];

  /** Shared context accessible to all agents */
  sharedContext: Record<string, any>;

  /** Session metadata */
  metadata: {
    /** User identifier (if available) */
    userId?: string;
    /** Session tags for categorization */
    tags?: string[];
    /** Custom metadata */
    [key: string]: any;
  };

  /** Optimistic locking version for concurrent access (FR-005) */
  version: number;
}

/**
 * Session serialization utilities
 *
 * Handles JSON serialization/deserialization with Date type preservation.
 */
export class SessionSerializer {
  /**
   * Serialize session to JSON string
   *
   * Converts Date objects to ISO 8601 strings for storage.
   *
   * @param session Session to serialize
   * @returns JSON string representation
   */
  static toJSON(session: Session): string {
    return JSON.stringify(session, (key, value) => {
      // Convert Date objects to ISO strings
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    });
  }

  /**
   * Deserialize session from JSON string
   *
   * Converts ISO 8601 strings back to Date objects.
   *
   * @param json JSON string representation
   * @returns Deserialized session
   * @throws Error if JSON is invalid
   */
  static fromJSON(json: string): Session {
    const parsed = JSON.parse(json);

    // Convert ISO strings back to Date objects
    const dateFields = ['createdAt', 'updatedAt', 'expiresAt'];
    dateFields.forEach((field) => {
      if (parsed[field]) {
        parsed[field] = new Date(parsed[field]);
      }
    });

    // Convert message timestamps
    if (parsed.conversationHistory) {
      parsed.conversationHistory.forEach((turn: any) => {
        turn.timestamp = new Date(turn.timestamp);
        turn.agentResponses?.forEach((response: any) => {
          response.timestamp = new Date(response.timestamp);
        });
      });
    }

    // Convert agent state message timestamps
    if (parsed.agentStates) {
      Object.values(parsed.agentStates).forEach((agentState: any) => {
        agentState.messageHistory?.forEach((turn: any) => {
          turn.timestamp = new Date(turn.timestamp);
          turn.agentResponses?.forEach((response: any) => {
            response.timestamp = new Date(response.timestamp);
          });
        });
      });
    }

    return parsed as Session;
  }

  /**
   * Calculate session state size in bytes
   *
   * Used for FR-009a state size limit checks (default: 10MB).
   *
   * @param session Session to measure
   * @returns Size in bytes
   */
  static getSize(session: Session): number {
    return Buffer.byteLength(this.toJSON(session), 'utf8');
  }

  /**
   * Trim session state to fit size limit
   *
   * FR-009a: Trim oldest message turns first, then trimmable context fields.
   *
   * @param session Session to trim
   * @param maxSizeBytes Maximum size in bytes
   * @returns Trimmed session and bytes removed
   */
  static trim(
    session: Session,
    maxSizeBytes: number
  ): { session: Session; bytesRemoved: number } {
    const originalSize = this.getSize(session);
    if (originalSize <= maxSizeBytes) {
      return { session, bytesRemoved: 0 };
    }

    const trimmed = { ...session };

    // Step 1: Trim oldest message turns from agent states
    for (const agentId in trimmed.agentStates) {
      while (
        this.getSize(trimmed) > maxSizeBytes &&
        trimmed.agentStates[agentId].messageHistory.length > 1
      ) {
        trimmed.agentStates[agentId].messageHistory.shift();
      }
    }

    // Step 2: Trim trimmable context fields
    if (this.getSize(trimmed) > maxSizeBytes) {
      for (const agentId in trimmed.agentStates) {
        const context = trimmed.agentStates[agentId].context;
        const metadata = context._metadata;

        if (metadata) {
          for (const field in metadata) {
            if (
              metadata[field].trimmable &&
              context[field] &&
              this.getSize(trimmed) > maxSizeBytes
            ) {
              delete context[field];
            }
          }
        }
      }
    }

    const finalSize = this.getSize(trimmed);
    return {
      session: trimmed,
      bytesRemoved: originalSize - finalSize,
    };
  }
}

/**
 * Custom error types for storage operations
 */
export class StorageError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'StorageError';
  }
}

export class NotFoundError extends StorageError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends StorageError {
  constructor(message: string, public readonly conflictingVersions?: any[]) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class ValidationError extends StorageError {
  constructor(message: string, public readonly invalidFields?: string[]) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Agent health state enumeration
 *
 * Represents the health status of an agent.
 * FR-006, FR-007: Health states for heartbeat monitoring
 */
export enum HealthState {
  /** Agent is healthy and responding to heartbeats */
  HEALTHY = 'healthy',
  /** Agent has missed heartbeats and is considered disconnected */
  DISCONNECTED = 'disconnected',
  /** Agent is responding to heartbeats but failing liveness probes (zombie) */
  ZOMBIE = 'zombie',
  /** Agent is currently recovering from a failure */
  RECOVERING = 'recovering',
  /** Agent is in degraded mode with incomplete context */
  DEGRADED = 'degraded',
  /** Agent has failed recovery attempts */
  FAILED = 'failed',
}

/**
 * Recovery strategy enumeration
 *
 * Defines available recovery strategies for failed agents.
 * FR-008: Configurable recovery strategies
 */
export enum RecoveryStrategy {
  /** Restart the agent process */
  RESTART = 'restart',
  /** Replace with a new agent instance */
  REPLACE = 'replace',
  /** Alert operators without automatic recovery */
  ALERT = 'alert',
  /** No recovery action */
  NONE = 'none',
}

/**
 * Agent health status
 *
 * Complete health information for a single agent.
 */
export interface AgentHealthStatus {
  /** Agent identifier */
  agentId: string;
  /** Current health state */
  state: HealthState;
  /** Last successful heartbeat timestamp */
  lastHeartbeat: number;
  /** Last successful liveness probe timestamp */
  lastLivenessCheck?: number;
  /** Consecutive missed heartbeats */
  missedHeartbeats: number;
  /** Recovery strategy assigned to this agent */
  recoveryStrategy: RecoveryStrategy;
  /** Recovery attempt count */
  recoveryAttempts: number;
  /** Last error message if any */
  lastError?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Event priority enumeration
 *
 * Defines priority levels for events.
 * FR-016a, FR-016b: Event priority for replay policies
 */
export enum EventPriority {
  /** Critical events that must always be replayed */
  CRITICAL = 'critical',
  /** Normal priority events */
  NORMAL = 'normal',
}

/**
 * Event replay policy enumeration
 *
 * Defines how events should be replayed during recovery.
 * FR-016a, FR-016b, FR-016c: Event replay policies
 */
export enum EventReplayPolicy {
  /** Do not replay any events */
  NONE = 'none',
  /** Replay all events */
  FULL = 'full',
  /** Replay only critical priority events (default) */
  CRITICAL_ONLY = 'critical_only',
}

/**
 * Event entity
 *
 * Represents a single event in the event bus.
 * FR-011, FR-011a: Event structure with unique IDs
 */
export interface Event {
  /** Unique event identifier (UUID v4) */
  id: string;
  /** Event topic */
  topic: string;
  /** Event payload */
  payload: any;
  /** Event priority */
  priority: EventPriority;
  /** Publish timestamp */
  timestamp: number;
  /** Session ID for session-scoped events */
  sessionId?: string;
  /** Conversation ID for conversation-scoped events */
  conversationId?: string;
  /** Event metadata */
  metadata?: Record<string, any>;
}

/**
 * Message entity
 *
 * Represents a single message in a conversation.
 * Used in group conversations and message history.
 */
export interface Message {
  /** Unique message identifier */
  id: string;
  /** Message role */
  role: 'user' | 'agent' | 'system';
  /** Message content */
  content: string;
  /** Message timestamp (Unix timestamp in milliseconds) */
  timestamp: number;
  /** Agent name if role is 'agent' */
  agentName?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Speaker selection strategy enumeration
 *
 * Defines available strategies for selecting next speaker in group conversations.
 * FR-018: Speaker selection strategies
 */
export enum SpeakerSelectionStrategy {
  /** Round-robin: Sequential rotation through agents */
  ROUND_ROBIN = 'round-robin',
  /** LLM-based: AI-powered context-aware selection */
  LLM_BASED = 'llm-based',
  /** Priority-based: Higher priority agents get more turns */
  PRIORITY = 'priority',
}

/**
 * Conversation context
 *
 * Shared context for group conversations.
 */
export interface ConversationContext {
  /** Conversation messages */
  messages: Message[];
  /** Shared context variables */
  variables?: Record<string, any>;
}

/**
 * Workflow task status enumeration
 */
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Workflow task entity
 */
export interface WorkflowTask {
  id: string;
  description: string;
  assignedAgentId?: string;
  status: TaskStatus;
  createdAt: Date;
  completedAt?: Date;
  dependencies?: string[];
  metadata?: Record<string, any>;
}

/**
 * Group conversation entity
 *
 * Manages multi-agent collaboration in shared conversation contexts.
 * FR-017: Multiple agents in shared contexts
 * FR-018: Speaker selection strategies
 * FR-019: Shared conversation history
 */
export interface GroupConversation {
  /** Unique conversation identifier (UUID v4) */
  id: string;
  /** Array of agent IDs participating in conversation */
  agentIds: string[];
  /** Conversation history */
  conversationHistory: Message[];
  /** Shared context accessible to all agents */
  sharedContext: Record<string, any>;
  /** Speaker selection strategy */
  speakerSelection: SpeakerSelectionStrategy;
  /** Last speaker agent ID */
  lastSpeakerId?: string;
  /** Current workflow state */
  workflowState: {
    tasks: WorkflowTask[];
    currentTaskId?: string;
    completedTaskIds: string[];
  };
  /** Conversation metadata */
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    messageCount: number;
    speakerSelections: number;
    [key: string]: any;
  };
  /** Consecutive turns per speaker for throttling */
  consecutiveSpeakerTurns: Map<string, number>;
  /** Speaker queue for round-robin selection (internal) */
  _speakerQueue?: string[];
  /** Agent priorities for priority-based selection (internal) */
  _agentPriorities?: Record<string, number>;
}
