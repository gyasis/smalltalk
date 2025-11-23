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
