# Data Model: Production Robustness Enhancements

**Feature**: Production Robustness Enhancements
**Branch**: `001-production-robustness`
**Date**: 2025-11-23
**Status**: Complete

This document defines the data model for session persistence, agent health monitoring, event-driven architecture, and group collaboration features.

---

## Table of Contents

1. [Core Entities](#core-entities)
2. [Entity Relationships](#entity-relationships)
3. [TypeScript Type Definitions](#typescript-type-definitions)
4. [State Transitions](#state-transitions)
5. [Validation Rules](#validation-rules)
6. [Storage Considerations](#storage-considerations)

---

## Core Entities

### 1. Session

**Purpose**: Represents a persistent conversation context with unique identifier, expiration policy, and full conversation state.

**Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | UUID (string) | ✅ | Unique session identifier |
| `createdAt` | Timestamp (number) | ✅ | Unix timestamp when session created |
| `expiresAt` | Timestamp (number) | ✅ | Unix timestamp when session expires |
| `state` | Enum | ✅ | Session state: `active`, `idle`, `expired` |
| `conversationHistory` | Message[] | ✅ | Array of conversation messages |
| `agentStates` | Map<agentId, AgentState> | ✅ | Map of agent IDs to their states |
| `metadata` | JSON | ❌ | Optional metadata (tags, labels, etc.) |

**Relationships**:
- **Has many** Messages (via `conversationHistory`)
- **Has many** AgentStates (via `agentStates` map)

**Validation Rules**:
- `sessionId` must be unique globally
- `expiresAt` must be greater than `createdAt`
- `state` must be one of: `active`, `idle`, `expired`
- `conversationHistory` must be an array (can be empty)
- `agentStates` must be a valid Map object

---

### 2. AgentHealthStatus

**Purpose**: Tracks agent liveness with heartbeat monitoring and failure detection.

**Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agentId` | String | ✅ | Agent identifier |
| `lastHeartbeat` | Timestamp (number) | ✅ | Unix timestamp of last successful heartbeat |
| `lastActivity` | Timestamp (number) | ✅ | Unix timestamp of last agent activity (event) |
| `failureCount` | Number | ✅ | Count of consecutive heartbeat failures |
| `state` | Enum | ✅ | Health state: `active`, `disconnected`, `recovering` |
| `lastRecoveryAttempt` | Timestamp (number) | ❌ | Unix timestamp of last recovery attempt |
| `recoveryStrategy` | String | ✅ | Recovery strategy in use: `restart`, `replace`, `alert` |

**Relationships**:
- **Belongs to** Agent (one-to-one)

**Validation Rules**:
- `state` must be one of: `active`, `disconnected`, `recovering`
- `failureCount` must be >= 0
- `lastHeartbeat` and `lastActivity` must be valid timestamps
- `recoveryStrategy` must be one of: `restart`, `replace`, `alert`

---

### 3. Event

**Purpose**: Represents a published message in the event bus with metadata for routing and replay.

**Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `eventId` | UUID (string) | ✅ | Unique event identifier |
| `eventType` | String | ✅ | Event type (e.g., `agent:message`, `task:completed`) |
| `topic` | String | ✅ | Event topic for subscription routing |
| `publisherId` | String | ✅ | ID of agent/component that published event |
| `timestamp` | Timestamp (number) | ✅ | Unix timestamp when event published |
| `payload` | JSON | ✅ | Event data (any serializable JSON) |
| `subscriberIds` | String[] | ✅ | Array of subscriber IDs (populated on delivery) |
| `priority` | Enum | ✅ | Priority level: `critical`, `normal` |
| `sessionId` | String | ❌ | Optional session ID for session-scoped events |
| `conversationId` | String | ❌ | Optional conversation ID for conversation-scoped events |

**Relationships**:
- **Published by** Agent (via `publisherId`)
- **Delivered to** Subscribers (via `subscriberIds`)

**Validation Rules**:
- `eventType` must be non-empty string
- `topic` must be non-empty string
- `priority` must be one of: `critical`, `normal`
- `payload` must be valid JSON
- `subscriberIds` must be an array (can be empty)

---

### 4. EventReplayPolicy

**Purpose**: Defines how agents handle missed events during disconnection periods.

**Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agentId` | String | ✅ | Agent identifier |
| `policyType` | Enum | ✅ | Policy type: `none`, `full`, `critical-only` |
| `enabled` | Boolean | ✅ | Whether event replay is enabled |
| `maxEvents` | Number | ❌ | Maximum events to replay (0 = unlimited) |
| `replayWindowMs` | Number | ❌ | Time window for replay in milliseconds |

**Relationships**:
- **Belongs to** Agent (one-to-one)

**Validation Rules**:
- `policyType` must be one of: `none`, `full`, `critical-only`
- Default policy is `critical-only`
- `enabled` defaults to `true`
- `maxEvents` must be >= 0 if specified
- `replayWindowMs` must be > 0 if specified

---

### 5. GroupConversation

**Purpose**: Manages multi-agent collaboration in shared conversation contexts.

**Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `conversationId` | UUID (string) | ✅ | Unique conversation identifier |
| `participantIds` | String[] | ✅ | Array of agent IDs participating in conversation |
| `sharedContext` | ConversationContext | ✅ | Shared conversation history and context |
| `speakerSelectionStrategy` | Enum | ✅ | Strategy: `round-robin`, `llm-based`, `priority` |
| `workflowState` | JSON | ✅ | Current workflow state (task queue, completion status) |
| `createdAt` | Timestamp (number) | ✅ | Unix timestamp when conversation created |
| `lastSpeakerId` | String | ❌ | ID of agent who spoke last |
| `speakerQueue` | String[] | ❌ | Queue of agents for round-robin selection |

**Relationships**:
- **Has many** Agents (via `participantIds`)
- **Has shared** ConversationContext

**Validation Rules**:
- `participantIds.length` must be <= 10 (max agents per group)
- `participantIds.length` must be >= 2 (minimum for group conversation)
- `speakerSelectionStrategy` must be one of: `round-robin`, `llm-based`, `priority`
- `workflowState` must be valid JSON
- All `participantIds` must reference valid, active agents

---

### 6. StateVersion

**Purpose**: Tracks state changes over time for audit trail and rollback capabilities.

**Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `versionId` | UUID (string) | ✅ | Unique version identifier |
| `entityId` | String | ✅ | ID of entity being versioned (session or agent) |
| `entityType` | Enum | ✅ | Type of entity: `session`, `agent`, `conversation` |
| `version` | Number | ✅ | Monotonic version number |
| `timestamp` | Timestamp (number) | ✅ | Unix timestamp of state change |
| `changeAuthor` | String | ✅ | ID of agent/user who made change |
| `snapshot` | JSON | ✅ | Complete state snapshot at this version |
| `diff` | JSON | ❌ | Optional diff from previous version (storage optimization) |

**Relationships**:
- **Tracks changes to** AgentState or SessionState (via `entityId` and `entityType`)

**Validation Rules**:
- `version` must be monotonically increasing for each `entityId`
- `entityType` must be one of: `session`, `agent`, `conversation`
- `snapshot` must be valid JSON
- `diff` must be valid JSON if provided

---

### 7. RecoveryStrategy

**Purpose**: Defines failure handling configuration for agent recovery.

**Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `strategyType` | Enum | ✅ | Strategy type: `restart`, `replace`, `alert` |
| `failureThreshold` | Number | ✅ | Number of failures before triggering strategy |
| `timeoutMs` | Number | ✅ | Timeout in milliseconds for recovery attempts |
| `configParams` | JSON | ❌ | Strategy-specific configuration parameters |
| `backoffMultiplier` | Number | ❌ | Exponential backoff multiplier (default: 2.0) |
| `maxRetries` | Number | ❌ | Maximum retry attempts (0 = infinite) |

**Relationships**:
- **Configured per** Agent or System-wide default

**Validation Rules**:
- `strategyType` must be one of: `restart`, `replace`, `alert`
- `failureThreshold` must be > 0
- `timeoutMs` must be > 0
- `backoffMultiplier` must be >= 1.0 if specified
- `maxRetries` must be >= 0 if specified

---

## Entity Relationships

```
┌──────────────┐
│   Session    │
└──────┬───────┘
       │ has many
       ├─────────────────────┐
       │                     │
       ▼                     ▼
  ┌─────────┐         ┌─────────────┐
  │ Message │         │ AgentState  │
  └─────────┘         └──────┬──────┘
                             │ belongs to
                             ▼
                      ┌────────────────────┐
                      │      Agent         │
                      └──────┬─────────────┘
                             │ has one
                 ┌───────────┼───────────┬─────────────────┐
                 │           │           │                 │
                 ▼           ▼           ▼                 ▼
        ┌─────────────┐ ┌────────┐ ┌─────────────┐ ┌────────────┐
        │ HealthStatus│ │  Event │ │ ReplayPolicy│ │  Recovery  │
        └─────────────┘ └────┬───┘ └─────────────┘ │  Strategy  │
                             │                       └────────────┘
                             │ belongs to
                             ▼
                      ┌──────────────┐
                      │   EventBus   │
                      └──────────────┘

┌────────────────────┐
│ GroupConversation  │
└──────┬─────────────┘
       │ has many
       ├────────────────────┐
       │                    │
       ▼                    ▼
  ┌─────────┐        ┌────────────────┐
  │  Agent  │        │  ConversationContext │
  └─────────┘        └────────────────┘
```

---

## TypeScript Type Definitions

```typescript
// Session Types
export interface Session {
  sessionId: string;
  createdAt: number;
  expiresAt: number;
  state: SessionState;
  conversationHistory: Message[];
  agentStates: Map<string, AgentState>;
  metadata?: Record<string, any>;
}

export type SessionState = 'active' | 'idle' | 'expired';

export interface Message {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: number;
  agentName?: string;
  metadata?: Record<string, any>;
}

export interface AgentState {
  agentId: string;
  currentTask?: string;
  context: Record<string, any>;
  memory: any[];
}

// Agent Health Types
export interface AgentHealthStatus {
  agentId: string;
  lastHeartbeat: number;
  lastActivity: number;
  failureCount: number;
  state: HealthState;
  lastRecoveryAttempt?: number;
  recoveryStrategy: RecoveryStrategyType;
}

export type HealthState = 'active' | 'disconnected' | 'recovering';

// Event Types
export interface Event {
  eventId: string;
  eventType: string;
  topic: string;
  publisherId: string;
  timestamp: number;
  payload: any;
  subscriberIds: string[];
  priority: EventPriority;
  sessionId?: string;
  conversationId?: string;
}

export type EventPriority = 'critical' | 'normal';

// Event Replay Types
export interface EventReplayPolicy {
  agentId: string;
  policyType: ReplayPolicyType;
  enabled: boolean;
  maxEvents?: number;
  replayWindowMs?: number;
}

export type ReplayPolicyType = 'none' | 'full' | 'critical-only';

// Group Conversation Types
export interface GroupConversation {
  conversationId: string;
  participantIds: string[];
  sharedContext: ConversationContext;
  speakerSelectionStrategy: SpeakerSelectionStrategy;
  workflowState: any;
  createdAt: number;
  lastSpeakerId?: string;
  speakerQueue?: string[];
}

export type SpeakerSelectionStrategy = 'round-robin' | 'llm-based' | 'priority';

export interface ConversationContext {
  messages: Message[];
  sharedMemory: Record<string, any>;
  currentTopic?: string;
}

// State Versioning Types
export interface StateVersion {
  versionId: string;
  entityId: string;
  entityType: EntityType;
  version: number;
  timestamp: number;
  changeAuthor: string;
  snapshot: any;
  diff?: any;
}

export type EntityType = 'session' | 'agent' | 'conversation';

// Recovery Strategy Types
export interface RecoveryStrategy {
  strategyType: RecoveryStrategyType;
  failureThreshold: number;
  timeoutMs: number;
  configParams?: Record<string, any>;
  backoffMultiplier?: number;
  maxRetries?: number;
}

export type RecoveryStrategyType = 'restart' | 'replace' | 'alert';
```

---

## State Transitions

### Session State Transitions

```
        create()
           │
           ▼
      ┌─────────┐
      │ active  │───────────────────────────────┐
      └────┬────┘                               │
           │                                    │
           │ inactive for timeout period        │ explicit expiration
           ▼                                    │
      ┌─────────┐                               │
      │  idle   │                               │
      └────┬────┘                               │
           │                                    │
           │ resume()                           │
           ├────────────────────────┐           │
           │                        │           │
           ▼                        ▼           ▼
      ┌─────────┐              ┌──────────┐
      │ active  │              │ expired  │
      └─────────┘              └──────────┘
```

### Agent Health State Transitions

```
        register()
           │
           ▼
      ┌─────────┐
      │ active  │◄───────────────┐
      └────┬────┘                │
           │                     │
           │ heartbeat failure   │ recovery successful
           ▼                     │
   ┌───────────────┐             │
   │ disconnected  │             │
   └───────┬───────┘             │
           │                     │
           │ recovery attempt    │
           ▼                     │
     ┌────────────┐              │
     │ recovering │──────────────┘
     └────────────┘
```

### Event Priority Levels

```
User Action ──────────► Event Published
      │                       │
      │                       ├──────► Priority: normal
      │                       │         (messages, tool calls)
      │                       │
      │                       └──────► Priority: critical
      │                                 (handoffs, interrupts)
      ▼
Event Bus ──────────────► Subscribers
      │
      ├──────► Policy: none
      │         (no replay)
      │
      ├──────► Policy: critical-only
      │         (replay critical events)
      │
      └──────► Policy: full
                (replay all events)
```

---

## Validation Rules

### Session Validation

```typescript
function validateSession(session: Session): ValidationResult {
  const errors: string[] = [];

  // Session ID must be UUID format
  if (!isValidUUID(session.sessionId)) {
    errors.push('sessionId must be a valid UUID');
  }

  // Expiration must be after creation
  if (session.expiresAt <= session.createdAt) {
    errors.push('expiresAt must be greater than createdAt');
  }

  // State must be valid enum value
  if (!['active', 'idle', 'expired'].includes(session.state)) {
    errors.push('state must be active, idle, or expired');
  }

  // Conversation history must be array
  if (!Array.isArray(session.conversationHistory)) {
    errors.push('conversationHistory must be an array');
  }

  return { valid: errors.length === 0, errors };
}
```

### Group Conversation Validation

```typescript
function validateGroupConversation(
  group: GroupConversation
): ValidationResult {
  const errors: string[] = [];

  // Must have 2-10 participants
  if (group.participantIds.length < 2) {
    errors.push('Group must have at least 2 participants');
  }

  if (group.participantIds.length > 10) {
    errors.push('Group cannot exceed 10 participants (FR-036)');
  }

  // All participants must be unique
  const uniqueIds = new Set(group.participantIds);
  if (uniqueIds.size !== group.participantIds.length) {
    errors.push('Participant IDs must be unique');
  }

  // Speaker selection strategy must be valid
  const validStrategies = ['round-robin', 'llm-based', 'priority'];
  if (!validStrategies.includes(group.speakerSelectionStrategy)) {
    errors.push('Invalid speaker selection strategy');
  }

  return { valid: errors.length === 0, errors };
}
```

---

## Storage Considerations

### Session Storage

- **Backend**: SQLite (see [research.md](./research.md#3-session-storage-backend))
- **Schema**: Single `sessions` table with JSON-encoded data
- **Indexes**: `created_at`, `updated_at`, `state`, `active_agent`
- **Retention**: Configurable expiration (default: 30 days for idle sessions)

### Event Storage

- **Backend**: File-based JSON Lines (see [research.md](./research.md#6-event-replay-storage))
- **Structure**: One `.jsonl` file per session in `events/active/` directory
- **Archival**: Move to `events/archive/{date}/` after configurable retention period
- **Retention**: 1 hour to 30 days (configurable per deployment)

### State Versioning Storage

- **Backend**: Same as session storage (SQLite)
- **Schema**: Separate `state_versions` table with foreign key to entity
- **Optimization**: Store diffs instead of full snapshots for large states
- **Retention**: Keep last N versions (default: 10) per entity

---

**Next Phase**: Proceed to contracts generation to define TypeScript interfaces and API contracts for all components.
