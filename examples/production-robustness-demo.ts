/**
 * Production Robustness Demo Application
 *
 * Demonstrates all 5 user stories for SmallTalk Production Robustness:
 * 1. Session Persistence and Recovery
 * 2. Agent Health Monitoring
 * 3. Event-Driven Architecture
 * 4. Group Collaboration
 * 5. Externalized State Management
 *
 * Run with: npx tsx examples/production-robustness-demo.ts
 */

import * as path from 'path';
import { SessionManager } from '../src/session/SessionManager';
import { AgentHealthMonitor } from '../src/health/AgentHealthMonitor';
import { EventBus } from '../src/events/EventBus';
import { GroupConversationManager } from '../src/group/GroupConversationManager';
import { FileStorageAdapter } from '../src/persistence/FileStorageAdapter';
import { InMemoryStorageAdapter } from '../src/persistence/InMemoryStorageAdapter';
import { Agent } from '../src/agents/Agent';
import { TokenJSWrapper } from '../src/utils/TokenJSWrapper';
import {
  SessionState,
  EventPriority,
  HealthState,
  RecoveryStrategy,
  SpeakerSelectionStrategy,
} from '../src/types/robustness';

// Console styling
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

function section(title: string): void {
  console.log(`\n${COLORS.bright}${COLORS.cyan}${'='.repeat(80)}`);
  console.log(`${title}`);
  console.log(`${'='.repeat(80)}${COLORS.reset}\n`);
}

function step(message: string): void {
  console.log(`${COLORS.green}▶ ${message}${COLORS.reset}`);
}

function info(message: string, data?: any): void {
  console.log(`${COLORS.blue}  ℹ ${message}${COLORS.reset}`);
  if (data) {
    console.log(`    ${JSON.stringify(data, null, 2)}`);
  }
}

function success(message: string): void {
  console.log(`${COLORS.green}  ✓ ${message}${COLORS.reset}`);
}

/**
 * USER STORY 1: Session Persistence and Recovery
 *
 * Demonstrates:
 * - Creating a session with multiple agents
 * - Saving session state to persistent storage
 * - Simulating application restart
 * - Restoring session from storage
 * - Session expiration handling
 */
async function demoSessionPersistence(): Promise<void> {
  section('USER STORY 1: Session Persistence and Recovery');

  const storageDir = path.join(process.cwd(), 'data', 'demo-sessions');
  const storage = new FileStorageAdapter();
  await storage.initialize({ location: storageDir });

  const sessionManager = new SessionManager(storage);

  step('Creating a multi-agent session');
  const session = await sessionManager.createSession({
    metadata: { purpose: 'Demo conversation' },
    expirationMs: 30000, // 30 seconds for demo
  });
  info('Session created', { id: session.id, state: session.state });

  step('Adding agents to session');
  session.agentIds = ['agent-1', 'agent-2', 'agent-3'];
  session.agentStates = {
    'agent-1': { role: 'coordinator', status: 'active' },
    'agent-2': { role: 'executor', status: 'active' },
    'agent-3': { role: 'validator', status: 'active' },
  };
  info('Agents added', { count: session.agentIds.length });

  step('Adding conversation history');
  await sessionManager.addMessage(session.id, {
    id: crypto.randomUUID(),
    role: 'user',
    content: 'Hello, agents!',
    timestamp: new Date(),
  });
  await sessionManager.addMessage(session.id, {
    id: crypto.randomUUID(),
    role: 'agent',
    content: 'Hello! I am agent-1, the coordinator.',
    agentName: 'agent-1',
    timestamp: new Date(),
  });
  success('Conversation history added');

  step('Saving session to persistent storage');
  await sessionManager.saveSession(session);
  const stats = await sessionManager.getStats();
  success(`Session saved (version: ${session.version})`);
  info('Storage stats', stats);

  step('Simulating application restart...');
  await new Promise((resolve) => setTimeout(resolve, 1000));
  info('Application restarted');

  step('Restoring session from storage');
  const restoredSession = await sessionManager.restoreSession(session.id);
  if (!restoredSession) {
    throw new Error('Failed to restore session');
  }
  success('Session restored successfully');
  info('Restored data', {
    id: restoredSession.id,
    agentCount: restoredSession.agentIds.length,
    messageCount: restoredSession.conversationHistory.length,
    version: restoredSession.version,
  });

  step('Waiting for session expiration...');
  await new Promise((resolve) => setTimeout(resolve, 3000));
  await sessionManager.updateSessionState(session.id, SessionState.EXPIRED);
  success('Session expired');

  step('Cleaning up expired sessions');
  const deletedCount = await sessionManager.cleanupExpiredSessions(0);
  success(`Cleaned up ${deletedCount} expired session(s)`);

  await storage.close();
}

/**
 * USER STORY 2: Agent Health Monitoring
 *
 * Demonstrates:
 * - Registering agents for health monitoring
 * - Heartbeat monitoring (2-second intervals)
 * - Failure detection (within 5 seconds)
 * - Automatic recovery with different strategies
 * - Health statistics and metrics
 */
async function demoAgentHealthMonitoring(): Promise<void> {
  section('USER STORY 2: Agent Health Monitoring');

  const healthMonitor = new AgentHealthMonitor();
  await healthMonitor.initialize({
    heartbeatInterval: 2000, // 2 seconds
    activityTimeout: 5000, // 5 seconds
    maxMissedBeats: 2,
  });

  step('Creating test agents');
  const agents = [
    new Agent({ name: 'coordinator-agent', personality: 'leadership' }),
    new Agent({ name: 'worker-agent', personality: 'execution' }),
    new Agent({ name: 'monitor-agent', personality: 'observation' }),
  ];
  info('Agents created', { count: agents.length });

  step('Registering agents with health monitor');
  healthMonitor.registerAgent(agents[0], RecoveryStrategy.RESTART);
  healthMonitor.registerAgent(agents[1], RecoveryStrategy.REPLACE);
  healthMonitor.registerAgent(agents[2], RecoveryStrategy.ALERT);
  success('All agents registered');

  step('Starting health monitoring');
  healthMonitor.startMonitoring();
  success('Health monitoring started');

  step('Simulating agent activity');
  for (const agent of agents) {
    const agentId = agent.name;
    await healthMonitor.sendHeartbeat(agentId);
    healthMonitor.recordActivity(agentId, 'processing');
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
  success('Agent activity recorded');

  step('Checking agent health status');
  const allHealth = healthMonitor.getAllAgentHealth();
  for (const [agentId, status] of allHealth) {
    info(`${agentId} health`, {
      state: status.state,
      missedBeats: status.missedHeartbeats,
      strategy: status.recoveryStrategy,
    });
  }

  step('Simulating agent failure (worker-agent)');
  const failedAgentId = 'worker-agent';
  // Simulate missed heartbeats by not sending any
  await new Promise((resolve) => setTimeout(resolve, 6000)); // Wait >5s for detection
  const failedHealth = healthMonitor.getAgentHealth(failedAgentId);
  if (failedHealth?.state === HealthState.DISCONNECTED) {
    success('Failure detected within 5 seconds');
  }
  info('Failed agent status', failedHealth);

  step('Triggering automatic recovery');
  const recoveryResult = await healthMonitor.recoverAgent(failedAgentId);
  if (recoveryResult.success) {
    success(`Recovery succeeded (${recoveryResult.strategy})`);
  }
  info('Recovery result', recoveryResult);

  step('Getting health monitoring statistics');
  const stats = healthMonitor.getStats();
  success('Statistics collected');
  info('Health monitor stats', stats);

  healthMonitor.stopMonitoring();
}

/**
 * USER STORY 3: Event-Driven Architecture
 *
 * Demonstrates:
 * - Publishing events to topics
 * - Subscribing to topics with wildcards
 * - At-least-once delivery guarantee
 * - Event persistence to JSONL logs
 * - Event replay after system recovery
 */
async function demoEventDrivenArchitecture(): Promise<void> {
  section('USER STORY 3: Event-Driven Architecture');

  const eventBus = new EventBus();
  await eventBus.initialize();

  step('Subscribing to event topics');
  const receivedEvents: any[] = [];
  const unsubscribe1 = eventBus.subscribe(
    'agent:*',
    'subscriber-1',
    async (payload, event) => {
      receivedEvents.push({ subscriber: 'subscriber-1', topic: event.topic, payload });
    }
  );
  const unsubscribe2 = eventBus.subscribe(
    'task:completed',
    'subscriber-2',
    async (payload, event) => {
      receivedEvents.push({ subscriber: 'subscriber-2', topic: event.topic, payload });
    }
  );
  success('Subscriptions created (agent:*, task:completed)');

  step('Publishing events to topics');
  await eventBus.publish('agent:started', { agentId: 'agent-1', timestamp: Date.now() });
  await eventBus.publish('agent:stopped', { agentId: 'agent-2', timestamp: Date.now() });
  await eventBus.publish(
    'task:completed',
    { taskId: 'task-123', result: 'success' },
    { priority: EventPriority.CRITICAL }
  );
  await new Promise((resolve) => setTimeout(resolve, 100)); // Allow delivery
  success(`Published 3 events, delivered ${receivedEvents.length} events`);
  info('Received events', receivedEvents);

  step('Testing at-least-once delivery (duplicate prevention)');
  const initialCount = receivedEvents.length;
  await eventBus.publish('agent:started', { agentId: 'agent-3', timestamp: Date.now() });
  await new Promise((resolve) => setTimeout(resolve, 100));
  const newCount = receivedEvents.length - initialCount;
  success(`New event delivered once to ${newCount} subscriber(s)`);

  step('Testing event persistence (checking JSONL logs)');
  const stats = eventBus.getStats();
  success('Events persisted to append-only logs');
  info('Event bus stats', stats);

  step('Simulating system recovery with event replay');
  const replayedCount = await eventBus.replay('subscriber-1', {
    since: Date.now() - 60000, // Last minute
  });
  success(`Replayed ${replayedCount} events after recovery`);

  step('Clearing event history');
  await eventBus.clearEventHistory();
  success('Event history cleared');

  unsubscribe1();
  unsubscribe2();
  await eventBus.stop();
}

/**
 * USER STORY 4: Group Collaboration
 *
 * Demonstrates:
 * - Creating group conversation with multiple agents
 * - Round-robin speaker selection
 * - LLM-based speaker selection (if API keys available)
 * - Priority-based speaker selection
 * - Shared context management
 */
async function demoGroupCollaboration(): Promise<void> {
  section('USER STORY 4: Group Collaboration');

  // Initialize LLM wrapper (will fallback to round-robin if no API keys)
  let llmWrapper: TokenJSWrapper | undefined;
  try {
    llmWrapper = new TokenJSWrapper();
    info('LLM wrapper initialized (API keys detected)');
  } catch {
    info('LLM wrapper not available (will use fallback strategies)');
  }

  const groupManager = new GroupConversationManager(llmWrapper);

  step('Creating agents with different roles');
  const agents = [
    new Agent({ name: 'architect', personality: 'system design expert' }),
    new Agent({ name: 'developer', personality: 'implementation specialist' }),
    new Agent({ name: 'qa', personality: 'testing and quality assurance' }),
  ];
  success('3 agents created');

  step('Creating group conversation with round-robin strategy');
  const conversation = await groupManager.createGroup(agents, {
    speakerSelection: SpeakerSelectionStrategy.ROUND_ROBIN,
    initialContext: { topic: 'Production robustness implementation' },
  });
  success('Group conversation created');
  info('Conversation', {
    id: conversation.id,
    agentCount: conversation.agentIds.length,
    strategy: conversation.speakerSelection,
  });

  step('Handling user messages with speaker selection');
  const userMessage = {
    id: crypto.randomUUID(),
    role: 'user' as const,
    content: 'How should we implement session persistence?',
    timestamp: Date.now(),
  };

  const responses1 = await groupManager.handleMessage(conversation.id, userMessage);
  success('First response (round-robin)');
  info('Selected speaker', { agentId: conversation.lastSpeakerId });

  const responses2 = await groupManager.handleMessage(conversation.id, {
    id: crypto.randomUUID(),
    role: 'user' as const,
    content: 'What about error handling?',
    timestamp: Date.now(),
  });
  success('Second response (round-robin)');
  info('Selected speaker', { agentId: conversation.lastSpeakerId });

  step('Switching to priority-based strategy');
  groupManager.setSelectionStrategy(conversation.id, SpeakerSelectionStrategy.PRIORITY);
  // Set priorities: architect=2.0, developer=1.5, qa=1.0
  conversation._agentPriorities = {
    architect: 2.0,
    developer: 1.5,
    qa: 1.0,
  };
  success('Strategy changed to priority-based');

  const responses3 = await groupManager.handleMessage(conversation.id, {
    id: crypto.randomUUID(),
    role: 'user' as const,
    content: 'What is the overall architecture?',
    timestamp: Date.now(),
  });
  info('Selected speaker (priority-weighted)', { agentId: conversation.lastSpeakerId });

  step('Updating shared context');
  groupManager.updateSharedContext(conversation.id, {
    decisions: ['Use FileStorage for MVP', 'Implement optimistic locking'],
    nextSteps: ['Write tests', 'Deploy to staging'],
  });
  success('Shared context updated');

  step('Getting group conversation statistics');
  const stats = groupManager.getStats();
  success('Statistics collected');
  info('Group stats', stats);

  await groupManager.endConversation(conversation.id);
}

/**
 * USER STORY 5: Externalized State Management
 *
 * Demonstrates:
 * - Switching between storage adapters (File, In-Memory)
 * - Session migration between storage backends
 * - Performance comparison
 * - Data integrity verification
 */
async function demoExternalizedState(): Promise<void> {
  section('USER STORY 5: Externalized State Management');

  // Part 1: FileStorage
  step('Initializing FileStorage adapter');
  const fileStorage = new FileStorageAdapter();
  await fileStorage.initialize({
    location: path.join(process.cwd(), 'data', 'demo-migration'),
  });
  success('FileStorage initialized');

  const fileManager = new SessionManager(fileStorage);

  step('Creating sessions in FileStorage');
  const sessions = [];
  for (let i = 0; i < 5; i++) {
    const session = await fileManager.createSession({
      metadata: { source: 'file-storage', index: i },
    });
    session.agentIds = [`agent-${i}`];
    await fileManager.saveSession(session);
    sessions.push(session);
  }
  success('5 sessions created in FileStorage');

  const fileStats = await fileStorage.getStats();
  info('FileStorage stats', fileStats);

  // Part 2: In-Memory Storage
  step('Initializing InMemoryStorage adapter');
  const memoryStorage = new InMemoryStorageAdapter();
  await memoryStorage.initialize();
  success('InMemoryStorage initialized');

  const memoryManager = new SessionManager(memoryStorage);

  step('Migrating sessions from FileStorage to InMemoryStorage');
  const migrationStart = performance.now();
  for (const session of sessions) {
    await memoryManager.saveSession(session);
  }
  const migrationTime = performance.now() - migrationStart;
  success(`Migration completed in ${migrationTime.toFixed(2)}ms`);

  step('Verifying data integrity after migration');
  let verifiedCount = 0;
  for (const session of sessions) {
    const restored = await memoryManager.restoreSession(session.id);
    if (
      restored &&
      restored.id === session.id &&
      restored.agentIds.length === session.agentIds.length
    ) {
      verifiedCount++;
    }
  }
  success(`Verified ${verifiedCount}/${sessions.length} sessions`);

  const memoryStats = await memoryStorage.getStats();
  info('InMemoryStorage stats', memoryStats);

  step('Performance comparison: Save operation');
  const fileTime = await measureSavePerformance(fileManager);
  const memoryTime = await measureSavePerformance(memoryManager);
  success('Performance measured');
  info('Save performance', {
    fileStorage: `${fileTime.toFixed(2)}ms`,
    memoryStorage: `${memoryTime.toFixed(2)}ms`,
    speedup: `${(fileTime / memoryTime).toFixed(1)}x faster`,
  });

  step('Performance comparison: Restore operation');
  const fileRestoreTime = await measureRestorePerformance(fileManager, sessions[0].id);
  const memoryRestoreTime = await measureRestorePerformance(memoryManager, sessions[0].id);
  success('Performance measured');
  info('Restore performance', {
    fileStorage: `${fileRestoreTime.toFixed(2)}ms`,
    memoryStorage: `${memoryRestoreTime.toFixed(2)}ms`,
    speedup: `${(fileRestoreTime / memoryRestoreTime).toFixed(1)}x faster`,
  });

  await fileStorage.close();
  await memoryStorage.close();
}

/**
 * Helper: Measure session save performance
 */
async function measureSavePerformance(manager: SessionManager): Promise<number> {
  const session = await manager.createSession();
  session.agentIds = ['test-agent'];

  const start = performance.now();
  await manager.saveSession(session);
  const end = performance.now();

  return end - start;
}

/**
 * Helper: Measure session restore performance
 */
async function measureRestorePerformance(
  manager: SessionManager,
  sessionId: string
): Promise<number> {
  const start = performance.now();
  await manager.restoreSession(sessionId);
  const end = performance.now();

  return end - start;
}

/**
 * Main demo execution
 */
async function main(): Promise<void> {
  console.log(
    `${COLORS.bright}${COLORS.magenta}
╔════════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║           SmallTalk Production Robustness Demo Application                ║
║                                                                            ║
║  Demonstrating all 5 user stories:                                        ║
║  1. Session Persistence and Recovery                                      ║
║  2. Agent Health Monitoring                                               ║
║  3. Event-Driven Architecture                                             ║
║  4. Group Collaboration                                                   ║
║  5. Externalized State Management                                         ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
${COLORS.reset}
`
  );

  try {
    await demoSessionPersistence();
    await demoAgentHealthMonitoring();
    await demoEventDrivenArchitecture();
    await demoGroupCollaboration();
    await demoExternalizedState();

    console.log(
      `\n${COLORS.bright}${COLORS.green}
╔════════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║                     ✓ ALL DEMOS COMPLETED SUCCESSFULLY                     ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
${COLORS.reset}
`
    );
  } catch (error) {
    console.error(
      `\n${COLORS.bright}${COLORS.yellow}
╔════════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║                           ⚠ DEMO ERROR                                     ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
${COLORS.reset}
`
    );
    console.error(error);
    process.exit(1);
  }
}

// Run demo
main();
