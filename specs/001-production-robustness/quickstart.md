# Production Robustness Quickstart Guide

This guide demonstrates how to use SmallTalk's production robustness features: session persistence, agent health monitoring, event-driven communication, and group collaboration.

## Table of Contents

1. [Session Persistence](#session-persistence)
2. [Agent Health Monitoring](#agent-health-monitoring)
3. [Event-Driven Communication](#event-driven-communication)
4. [Group Collaboration](#group-collaboration)
5. [Complete Example](#complete-example)

## Prerequisites

```bash
npm install smalltalk
```

## Session Persistence

Save and restore conversation state across restarts.

### Basic Session Save/Restore

```typescript
import { SmallTalk, SessionManager, FileStorageAdapter } from 'smalltalk';

async function basicSessionExample() {
  // Initialize SmallTalk with session persistence
  const app = new SmallTalk({
    llmProvider: 'openai',
    model: 'gpt-4o',
    sessionManager: new SessionManager(new FileStorageAdapter({
      location: './data/sessions'
    }))
  });

  // Create a new session
  const session = await app.createSession();
  console.log(`Created session: ${session.id}`);

  // Add agents and have a conversation
  const agent = app.createAgent({ name: 'Helper', role: 'assistant' });
  await app.sendMessage(session.id, 'Hello, can you help me?');

  // Session is automatically saved after each message
  // Restore the session later (even after restart)
  const restored = await app.restoreSession(session.id);
  console.log(`Restored ${restored.conversationHistory.length} messages`);
}
```

### Session Expiration and Cleanup

```typescript
async function sessionExpirationExample() {
  const sessionManager = new SessionManager(new FileStorageAdapter());

  // Create session with 24-hour expiration
  const session = await sessionManager.createSession({
    expirationMs: 24 * 60 * 60 * 1000,
    metadata: { userId: 'user123' }
  });

  // Cleanup expired sessions (run periodically)
  const deleted = await sessionManager.cleanupExpiredSessions(
    24 * 60 * 60 * 1000 // 24 hours
  );
  console.log(`Deleted ${deleted} expired sessions`);
}
```

### Storage Adapters

```typescript
import {
  FileStorageAdapter,
  RedisStorageAdapter,
  InMemoryStorageAdapter
} from 'smalltalk';

// File-based storage (default)
const fileAdapter = new FileStorageAdapter({
  location: './data/sessions'
});

// Redis storage (for distributed systems)
const redisAdapter = new RedisStorageAdapter({
  location: 'redis://localhost:6379',
  options: { keyPrefix: 'smalltalk:' }
});

// In-memory storage (for testing)
const memoryAdapter = new InMemoryStorageAdapter();

const sessionManager = new SessionManager(fileAdapter);
```

## Agent Health Monitoring

Monitor agent health with automatic recovery.

### Basic Health Monitoring

```typescript
import { SmallTalk, AgentHealthMonitor } from 'smalltalk';

async function healthMonitoringExample() {
  const app = new SmallTalk({ llmProvider: 'openai', model: 'gpt-4o' });

  // Initialize health monitor
  const healthMonitor = new AgentHealthMonitor();
  await healthMonitor.initialize({
    heartbeatInterval: 2000,    // 2 seconds
    activityTimeout: 5000,      // 5 seconds
    maxMissedBeats: 2           // 2 missed heartbeats = failure
  });

  // Register agents for monitoring
  const agent = app.createAgent({ name: 'Worker', role: 'assistant' });
  healthMonitor.registerAgent(agent, {
    type: 'restart',            // Recovery strategy
    failureThreshold: 3,
    timeoutMs: 10000
  });

  // Start monitoring
  healthMonitor.startMonitoring();

  // Check agent health
  const health = healthMonitor.getAgentHealth(agent.id);
  console.log(`Agent ${agent.name} state: ${health.state}`);
  console.log(`Last heartbeat: ${new Date(health.lastHeartbeat)}`);
}
```

### Automatic Recovery

```typescript
async function autoRecoveryExample() {
  const healthMonitor = new AgentHealthMonitor();
  const agent = app.createAgent({ name: 'Worker' });

  // Register with auto-recovery
  healthMonitor.registerAgent(agent, {
    type: 'restart',
    failureThreshold: 3
  });

  // Monitor will automatically recover disconnected agents
  healthMonitor.on('agent:disconnected', async (event) => {
    console.log(`Agent ${event.agentId} disconnected, attempting recovery...`);
    const result = await healthMonitor.recoverAgent(event.agentId);

    if (result.success) {
      console.log(`Recovery succeeded in ${result.durationMs}ms`);
    } else {
      console.error(`Recovery failed: ${result.error}`);
    }
  });
}
```

### Recovery Strategies

```typescript
// Restart strategy (default)
healthMonitor.registerAgent(agent, {
  type: 'restart',
  failureThreshold: 3,
  timeoutMs: 10000
});

// Failover strategy
healthMonitor.registerAgent(agent, {
  type: 'failover',
  fallbackAgentId: 'backup-agent-id'
});

// Notify-only strategy
healthMonitor.registerAgent(agent, {
  type: 'notify',
  webhookUrl: 'https://api.example.com/alerts'
});
```

## Event-Driven Communication

Publish and subscribe to events between agents.

### Basic Pub/Sub

```typescript
import { EventBus } from 'smalltalk';

async function eventBusExample() {
  const eventBus = new EventBus();

  // Subscribe to events
  const unsubscribe = eventBus.subscribe(
    'task:completed',
    'agent-1',
    async (payload, event) => {
      console.log(`Task completed: ${payload.taskId}`);
      console.log(`Priority: ${event.priority}`);
    }
  );

  // Publish event
  await eventBus.publish('task:completed', {
    taskId: 'task-123',
    result: { success: true }
  }, {
    priority: 'normal',
    conversationId: 'conv-456'
  });

  // Unsubscribe when done
  unsubscribe();
}
```

### Wildcard Subscriptions

```typescript
// Subscribe to all agent events
eventBus.subscribe('agent:*', 'subscriber-1', (payload, event) => {
  console.log(`Agent event: ${event.eventType}`);
});

// Subscribe to all task events
eventBus.subscribe('task:*', 'subscriber-2', (payload, event) => {
  console.log(`Task event: ${event.eventType}`);
});

// Publish events
await eventBus.publish('agent:started', { agentId: 'agent-1' });
await eventBus.publish('task:created', { taskId: 'task-1' });
```

### Event Replay

```typescript
async function eventReplayExample() {
  const eventBus = new EventBus();
  const agentId = 'agent-1';

  // Set replay policy for agent (default: critical-only)
  eventBus.setReplayPolicy(agentId, {
    policyType: 'critical-only',  // or 'full', 'none'
    enabled: true,
    maxEvents: 100
  });

  // Subscribe to events
  eventBus.subscribe('task:*', agentId, (payload) => {
    console.log('Received task event:', payload);
  });

  // Simulate agent disconnection period
  // ... events published during this time ...

  // Replay missed critical events
  const replayedCount = await eventBus.replay(agentId, {
    priority: 'critical',
    since: Date.now() - 60000,  // Last 60 seconds
    limit: 50
  });

  console.log(`Replayed ${replayedCount} critical events`);
}
```

### Event Priority

```typescript
// Critical event (will be replayed by default)
await eventBus.publish('agent:failed', {
  agentId: 'agent-1',
  reason: 'Connection timeout'
}, {
  priority: 'critical',
  sessionId: 'session-123'
});

// Normal event
await eventBus.publish('task:progress', {
  taskId: 'task-1',
  progress: 50
}, {
  priority: 'normal'
});
```

## Group Collaboration

Multi-agent conversations with speaker selection.

### Create Group Conversation

```typescript
import { GroupConversationManager } from 'smalltalk';

async function groupConversationExample() {
  const app = new SmallTalk({ llmProvider: 'openai', model: 'gpt-4o' });
  const groupManager = new GroupConversationManager();

  // Create agents
  const researcher = app.createAgent({
    name: 'Researcher',
    role: 'Research and fact-finding'
  });
  const writer = app.createAgent({
    name: 'Writer',
    role: 'Content creation'
  });
  const reviewer = app.createAgent({
    name: 'Reviewer',
    role: 'Quality assurance'
  });

  // Create group with round-robin speaker selection
  const group = await groupManager.createGroup([researcher, writer, reviewer], {
    speakerSelection: 'round-robin',
    initialContext: { topic: 'AI Safety' }
  });

  console.log(`Created group: ${group.id}`);
}
```

### Speaker Selection Strategies

```typescript
// Round-robin (predictable rotation)
const group1 = await groupManager.createGroup(agents, {
  speakerSelection: 'round-robin'
});

// LLM-based (intelligent selection)
const group2 = await groupManager.createGroup(agents, {
  speakerSelection: 'llm-based',
  maxSpeakersPerTurn: 1
});

// Priority-based (weighted selection)
const group3 = await groupManager.createGroup(agents, {
  speakerSelection: 'priority',
  initialContext: {
    priorities: {
      'researcher': 0.5,
      'writer': 0.3,
      'reviewer': 0.2
    }
  }
});
```

### Group Message Handling

```typescript
async function groupMessageExample() {
  const groupManager = new GroupConversationManager();
  const group = await groupManager.createGroup(agents, {
    speakerSelection: 'llm-based'
  });

  // Send message to group
  const responses = await groupManager.handleMessage(group.id, {
    id: 'msg-1',
    role: 'user',
    content: 'What are the key challenges in AI alignment?',
    timestamp: Date.now()
  });

  // Process responses from selected agents
  for (const response of responses) {
    console.log(`${response.agentId}: ${response.content}`);
  }
}
```

### Shared Context

```typescript
// Update shared context for all agents
groupManager.updateSharedContext(group.id, {
  researchPhase: 'literature-review',
  deadline: '2024-12-31',
  focusAreas: ['safety', 'alignment', 'interpretability']
});

// Get current group state
const conversation = groupManager.getConversation(group.id);
console.log('Shared context:', conversation.sharedContext);
console.log('Participants:', conversation.participantIds);
```

## Complete Example

Combining all robustness features in a production application.

```typescript
import {
  SmallTalk,
  SessionManager,
  AgentHealthMonitor,
  EventBus,
  GroupConversationManager,
  FileStorageAdapter
} from 'smalltalk';

async function productionExample() {
  // 1. Initialize SmallTalk with session persistence
  const app = new SmallTalk({
    llmProvider: 'openai',
    model: 'gpt-4o',
    sessionManager: new SessionManager(new FileStorageAdapter({
      location: './data/sessions'
    }))
  });

  // 2. Setup health monitoring
  const healthMonitor = new AgentHealthMonitor();
  await healthMonitor.initialize({
    heartbeatInterval: 2000,
    activityTimeout: 5000,
    maxMissedBeats: 2
  });

  // 3. Setup event bus
  const eventBus = new EventBus();

  // 4. Create agents
  const researcher = app.createAgent({
    name: 'Researcher',
    role: 'Research and analysis'
  });
  const writer = app.createAgent({
    name: 'Writer',
    role: 'Content creation'
  });

  // 5. Register agents for health monitoring
  healthMonitor.registerAgent(researcher, { type: 'restart' });
  healthMonitor.registerAgent(writer, { type: 'restart' });
  healthMonitor.startMonitoring();

  // 6. Setup event subscriptions
  eventBus.subscribe('agent:*', researcher.id, async (payload, event) => {
    console.log(`Researcher received event: ${event.eventType}`);
  });

  eventBus.setReplayPolicy(researcher.id, {
    policyType: 'critical-only',
    enabled: true
  });

  // 7. Create group conversation
  const groupManager = new GroupConversationManager();
  const group = await groupManager.createGroup([researcher, writer], {
    speakerSelection: 'llm-based',
    initialContext: { topic: 'Climate Change Solutions' }
  });

  // 8. Create session
  const session = await app.createSession({
    expirationMs: 24 * 60 * 60 * 1000,
    metadata: { groupId: group.id }
  });

  // 9. Send messages to group
  const responses = await groupManager.handleMessage(group.id, {
    id: 'msg-1',
    role: 'user',
    content: 'What are promising carbon capture technologies?',
    timestamp: Date.now()
  });

  // 10. Publish completion event
  await eventBus.publish('task:completed', {
    taskId: 'research-task-1',
    groupId: group.id,
    responseCount: responses.length
  }, {
    priority: 'normal',
    sessionId: session.id
  });

  // 11. Monitor health
  const stats = healthMonitor.getStats();
  console.log(`Healthy agents: ${stats.healthyAgents}/${stats.totalAgents}`);

  // 12. Save session (happens automatically, but can be triggered)
  await app.sessionManager.saveSession(session);

  // 13. Cleanup on shutdown
  healthMonitor.stopMonitoring();
  await app.sessionManager.cleanupExpiredSessions(24 * 60 * 60 * 1000);
  await eventBus.clearEventHistory(session.id);
  await groupManager.endConversation(group.id);
}

// Run example
productionExample().catch(console.error);
```

## Error Handling

```typescript
async function errorHandlingExample() {
  const sessionManager = new SessionManager(new FileStorageAdapter());

  try {
    // Attempt to restore session
    const session = await sessionManager.restoreSession('session-123');

    if (!session) {
      console.log('Session not found, creating new session');
      const newSession = await sessionManager.createSession();
      return newSession;
    }

    return session;
  } catch (error) {
    console.error('Session restore failed:', error);
    // Fallback to new session
    return await sessionManager.createSession();
  }
}
```

## Performance Monitoring

```typescript
async function monitoringExample() {
  const sessionManager = new SessionManager(new FileStorageAdapter());
  const healthMonitor = new AgentHealthMonitor();
  const eventBus = new EventBus();

  // Get statistics
  const sessionStats = await sessionManager.getStats();
  console.log('Session Storage:', {
    active: sessionStats.activeSessions,
    idle: sessionStats.idleSessions,
    backend: sessionStats.backendType
  });

  const healthStats = healthMonitor.getStats();
  console.log('Agent Health:', {
    healthy: healthStats.healthyAgents,
    disconnected: healthStats.disconnectedAgents,
    recovering: healthStats.recoveringAgents,
    cpuOverhead: `${healthStats.cpuOverheadPercent}%`
  });

  const eventStats = eventBus.getStats();
  console.log('Event Bus:', {
    published: eventStats.totalEventsPublished,
    subscriptions: eventStats.activeSubscriptions,
    avgLatency: `${eventStats.avgPropagationLatencyMs}ms`
  });
}
```

## Testing

```typescript
import { InMemoryStorageAdapter } from 'smalltalk';

async function testExample() {
  // Use in-memory adapter for fast, isolated tests
  const sessionManager = new SessionManager(new InMemoryStorageAdapter());

  const session = await sessionManager.createSession();
  await sessionManager.saveSession(session);

  const restored = await sessionManager.restoreSession(session.id);
  expect(restored).not.toBeNull();
  expect(restored.id).toBe(session.id);
}
```

## Next Steps

- See [spec.md](./spec.md) for complete feature requirements
- See [data-model.md](./data-model.md) for entity definitions
- See [contracts/](./contracts/) for TypeScript interfaces
- See [research.md](./research.md) for technical decisions

## Support

- **Documentation**: See SmallTalk docs at `/docs`
- **Issues**: Report bugs at GitHub
- **Community**: Join SmallTalk Discord
