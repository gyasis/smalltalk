/**
 * GroupConversationManager Implementation
 *
 * Manages multi-agent group conversations with speaker selection strategies,
 * shared context synchronization, and workflow tracking.
 *
 * @see specs/001-production-robustness/contracts/GroupConversationManager.contract.ts
 * @see specs/001-production-robustness/spec.md FR-017 to FR-021
 */

import * as crypto from 'crypto';
import { performance } from 'perf_hooks';
import { Agent } from '../agents/Agent';
import {
  GroupConversation,
  SpeakerSelectionStrategy,
  Message,
  TaskStatus,
} from '../types/robustness';
import {
  GroupConversationManager as IGroupConversationManager,
  CreateGroupOptions,
  SpeakerSelectionContext,
  SpeakerSelectionResult,
  GroupConversationStats,
} from '../../specs/001-production-robustness/contracts/GroupConversationManager.contract';
import { TokenJSWrapper } from '../utils/TokenJSWrapper';

/**
 * Default configuration values
 */
const DEFAULT_MAX_AGENTS = 10; // FR-036
const DEFAULT_MIN_AGENTS = 2;
const DEFAULT_SELECTION_TIMEOUT_MS = 100; // SC-013
const LLM_SELECTION_MODEL = 'gpt-4o-mini'; // CRITICAL: Use gpt-4o-mini, NOT gpt-4

/**
 * Extract agent ID from Agent object
 * Agents may have either 'id' or 'name' property
 */
function getAgentId(agent: Agent): string {
  return (agent as any).id ?? agent.name;
}

/**
 * GroupConversationManager implementation
 *
 * Responsibilities:
 * - Group creation with 2-10 agents (FR-017, FR-036)
 * - Speaker selection strategies: round-robin, LLM-based, priority (FR-018)
 * - Shared conversation context (FR-019)
 * - <100ms speaker selection performance (FR-020, SC-013)
 * - Workflow state tracking (FR-021)
 */
export class GroupConversationManager implements IGroupConversationManager {
  // Conversation registry
  private conversations: Map<string, GroupConversation> = new Map();
  private conversationAgents: Map<string, Map<string, Agent>> = new Map();

  // LLM wrapper for LLM-based selection
  private llmWrapper?: TokenJSWrapper;

  // Statistics tracking
  private stats = {
    totalMessages: 0,
    selectionsByStrategy: {
      'round-robin': 0,
      'llm-based': 0,
      priority: 0,
    },
    selectionLatencies: [] as number[],
    successfulConversations: 0,
    failedConversations: 0,
  };

  /**
   * Initialize with optional LLM wrapper for LLM-based selection
   *
   * @param llmWrapper Optional TokenJSWrapper for LLM-based speaker selection
   */
  constructor(llmWrapper?: TokenJSWrapper) {
    this.llmWrapper = llmWrapper;
  }

  /**
   * Create a new group conversation (FR-017)
   *
   * @param agents Array of agents (2-10 agents per FR-036)
   * @param options Group creation options
   * @returns Created group conversation
   * @throws Error if agents.length < 2 or > 10
   */
  async createGroup(
    agents: Agent[],
    options?: CreateGroupOptions
  ): Promise<GroupConversation> {
    // Validate agent count (FR-036)
    if (agents.length < DEFAULT_MIN_AGENTS) {
      throw new Error(
        `Group conversations require at least ${DEFAULT_MIN_AGENTS} agents`
      );
    }

    if (agents.length > DEFAULT_MAX_AGENTS) {
      throw new Error(
        `Group conversations support maximum ${DEFAULT_MAX_AGENTS} agents (FR-036)`
      );
    }

    const id = crypto.randomUUID();
    const now = new Date();

    // Extract agent IDs
    const agentIds = agents.map(getAgentId);

    // Initialize speaker queue for round-robin
    const speakerQueue = [...agentIds];

    // Create conversation
    const conversation: GroupConversation = {
      id,
      agentIds,
      conversationHistory: [],
      sharedContext: options?.initialContext ?? {},
      speakerSelection:
        options?.speakerSelection ?? SpeakerSelectionStrategy.ROUND_ROBIN,
      workflowState: {
        tasks: [],
        completedTaskIds: [],
      },
      metadata: {
        createdAt: now,
        updatedAt: now,
        messageCount: 0,
        speakerSelections: 0,
      },
      consecutiveSpeakerTurns: new Map<string, number>(),
      _speakerQueue: speakerQueue,
      _agentPriorities: {},
    };

    // Initialize consecutive turns tracking
    agentIds.forEach((agentId) => {
      conversation.consecutiveSpeakerTurns.set(agentId, 0);
    });

    // Store conversation and agents
    this.conversations.set(id, conversation);
    const agentMap = new Map<string, Agent>();
    agents.forEach((agent) => agentMap.set(getAgentId(agent), agent));
    this.conversationAgents.set(id, agentMap);

    return conversation;
  }

  /**
   * Add agent to existing group (FR-017)
   *
   * @param conversationId Conversation ID
   * @param agent Agent to add
   * @throws Error if group already has 10 agents (FR-036)
   */
  async addAgent(conversationId: string, agent: Agent): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    const agentId = getAgentId(agent);

    // Check for duplicates
    if (conversation.agentIds.includes(agentId)) {
      throw new Error(`Agent ${agentId} already in conversation`);
    }

    // Validate max agents (FR-036)
    if (conversation.agentIds.length >= DEFAULT_MAX_AGENTS) {
      throw new Error(
        `Group already has maximum ${DEFAULT_MAX_AGENTS} agents (FR-036)`
      );
    }

    // Add agent
    conversation.agentIds.push(agentId);
    conversation._speakerQueue?.push(agentId);
    conversation.consecutiveSpeakerTurns.set(agentId, 0);

    // Update timestamp
    conversation.metadata.updatedAt = new Date();

    // Update agent map
    const agentMap = this.conversationAgents.get(conversationId);
    if (agentMap) {
      agentMap.set(agentId, agent);
    }
  }

  /**
   * Remove agent from group
   *
   * @param conversationId Conversation ID
   * @param agentId Agent ID to remove
   * @throws Error if removal would leave group with <2 agents or agent not found
   */
  async removeAgent(conversationId: string, agentId: string): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    // Check agent exists
    if (!conversation.agentIds.includes(agentId)) {
      throw new Error(`Agent ${agentId} not found in conversation`);
    }

    // Validate minimum agents
    if (conversation.agentIds.length <= DEFAULT_MIN_AGENTS) {
      throw new Error(
        `Cannot remove agent - group must have at least ${DEFAULT_MIN_AGENTS} agents`
      );
    }

    // Remove agent
    const index = conversation.agentIds.indexOf(agentId);
    if (index !== -1) {
      conversation.agentIds.splice(index, 1);
    }

    // Remove from speaker queue
    if (conversation._speakerQueue) {
      const queueIndex = conversation._speakerQueue.indexOf(agentId);
      if (queueIndex !== -1) {
        conversation._speakerQueue.splice(queueIndex, 1);
      }
    }

    // Remove from consecutive turns tracking
    conversation.consecutiveSpeakerTurns.delete(agentId);

    // Update timestamp
    conversation.metadata.updatedAt = new Date();

    // Remove from agent map
    const agentMap = this.conversationAgents.get(conversationId);
    if (agentMap) {
      agentMap.delete(agentId);
    }
  }

  /**
   * Handle user message in group conversation (FR-019, FR-021)
   *
   * @param conversationId Conversation ID
   * @param userMessage User message
   * @returns Agent response(s)
   */
  async handleMessage(
    conversationId: string,
    userMessage: Message
  ): Promise<Message[]> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    // Add user message to conversation history (FR-019)
    conversation.conversationHistory.push(userMessage);
    conversation.metadata.messageCount++;
    conversation.metadata.updatedAt = new Date();
    this.stats.totalMessages++;

    // Select speaker
    const agentMap = this.conversationAgents.get(conversationId);
    if (!agentMap) {
      throw new Error(`Agent map not found for conversation: ${conversationId}`);
    }

    const selectionContext: SpeakerSelectionContext = {
      conversationHistory: conversation.conversationHistory,
      lastSpeakerId: conversation.lastSpeakerId,
      availableAgents: Array.from(agentMap.values()),
      userMessage,
      sharedContext: conversation.sharedContext,
    };

    const selection = await this.selectSpeaker(conversationId, selectionContext);

    // Track speaker selections
    conversation.metadata.speakerSelections++;

    // Get selected agent
    const selectedAgent = agentMap.get(selection.agentId);
    if (!selectedAgent) {
      throw new Error(`Selected agent not found: ${selection.agentId}`);
    }

    // Update consecutive turns tracking (FR-020)
    conversation.consecutiveSpeakerTurns.forEach((_, agentId) => {
      if (agentId === selection.agentId) {
        conversation.consecutiveSpeakerTurns.set(
          agentId,
          (conversation.consecutiveSpeakerTurns.get(agentId) ?? 0) + 1
        );
      } else {
        conversation.consecutiveSpeakerTurns.set(agentId, 0);
      }
    });

    // Generate agent response (simplified - in production this would call agent.processMessage)
    const agentResponse: Message = {
      id: crypto.randomUUID(),
      role: 'agent',
      content: `Response from ${selectedAgent.name}`,
      timestamp: Date.now(),
      agentName: selectedAgent.name,
    };

    // Add response to conversation history (FR-019)
    conversation.conversationHistory.push(agentResponse);
    conversation.metadata.messageCount++;
    conversation.metadata.updatedAt = new Date();

    // Update last speaker (FR-021)
    conversation.lastSpeakerId = selection.agentId;

    return [agentResponse];
  }

  /**
   * Select next speaker for group conversation (FR-018, FR-020)
   *
   * Target: <100ms speaker selection (SC-013)
   *
   * @param conversationId Conversation ID
   * @param context Speaker selection context
   * @returns Speaker selection result
   */
  async selectSpeaker(
    conversationId: string,
    context: SpeakerSelectionContext
  ): Promise<SpeakerSelectionResult> {
    const startTime = performance.now();

    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    let selectedAgentId: string;
    let confidence: number | undefined;
    let reasoning: string | undefined;

    // Select based on strategy (FR-018)
    switch (conversation.speakerSelection) {
      case SpeakerSelectionStrategy.ROUND_ROBIN:
        selectedAgentId = this.selectRoundRobin(conversation);
        this.stats.selectionsByStrategy['round-robin']++;
        reasoning = 'Round-robin sequential rotation';
        break;

      case SpeakerSelectionStrategy.LLM_BASED:
        const llmResult = await this.selectLLMBased(conversation, context);
        selectedAgentId = llmResult.agentId;
        confidence = llmResult.confidence;
        reasoning = llmResult.reasoning;
        this.stats.selectionsByStrategy['llm-based']++;
        break;

      case SpeakerSelectionStrategy.PRIORITY:
        selectedAgentId = this.selectPriorityBased(conversation);
        this.stats.selectionsByStrategy['priority']++;
        reasoning = 'Priority-based weighted selection';
        break;

      default:
        throw new Error(
          `Unsupported speaker selection strategy: ${conversation.speakerSelection}`
        );
    }

    const latencyMs = performance.now() - startTime;

    // Track latency for statistics
    this.stats.selectionLatencies.push(latencyMs);

    // Validate performance (SC-013)
    if (latencyMs > DEFAULT_SELECTION_TIMEOUT_MS) {
      console.warn(
        `[GroupConversationManager] Speaker selection exceeded target: ${latencyMs.toFixed(2)}ms > ${DEFAULT_SELECTION_TIMEOUT_MS}ms`
      );
    }

    return {
      agentId: selectedAgentId,
      confidence,
      reasoning,
      latencyMs,
    };
  }

  /**
   * Round-robin speaker selection (FR-018a)
   *
   * Sequential rotation through agents with fair turn distribution.
   *
   * @param conversation Group conversation
   * @returns Selected agent ID
   */
  private selectRoundRobin(conversation: GroupConversation): string {
    if (!conversation._speakerQueue || conversation._speakerQueue.length === 0) {
      throw new Error('Speaker queue is empty');
    }

    // Get next agent from queue
    const agentId = conversation._speakerQueue.shift()!;

    // Add back to end of queue
    conversation._speakerQueue.push(agentId);

    return agentId;
  }

  /**
   * LLM-based speaker selection (FR-018b)
   *
   * Uses gpt-4o-mini for context-aware speaker selection.
   * CRITICAL: Uses gpt-4o-mini model (NOT gpt-4).
   *
   * @param conversation Group conversation
   * @param context Selection context
   * @returns Selection result with confidence and reasoning
   */
  private async selectLLMBased(
    conversation: GroupConversation,
    context: SpeakerSelectionContext
  ): Promise<{ agentId: string; confidence?: number; reasoning?: string }> {
    if (!this.llmWrapper) {
      // Fallback to round-robin if no LLM wrapper available
      console.warn(
        '[GroupConversationManager] LLM wrapper not available, falling back to round-robin'
      );
      return {
        agentId: this.selectRoundRobin(conversation),
        reasoning: 'Fallback to round-robin (no LLM wrapper)',
      };
    }

    // Build agent descriptions
    const agentDescriptions = context.availableAgents
      .map(
        (agent, idx) =>
          `${idx + 1}. ${getAgentId(agent)}: ${agent.config.personality || 'General assistant'}`
      )
      .join('\n');

    // Build recent conversation history
    const recentMessages = context.conversationHistory
      .slice(-5)
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join('\n');

    // Build selection prompt
    const systemPrompt = `You are a conversation orchestrator selecting the most appropriate agent to respond next.
Choose the agent whose expertise best matches the user's query.
Respond ONLY with valid JSON in this exact format:
{
  "agentId": "agent_name",
  "confidence": 0.85,
  "reasoning": "Brief explanation"
}`;

    const userPrompt = `Available agents:
${agentDescriptions}

Recent conversation:
${recentMessages}

User's latest message: ${context.userMessage?.content ?? 'No message'}

Which agent should respond next? Return JSON only.`;

    try {
      // CRITICAL: Use gpt-4o-mini model (NOT gpt-4)
      const now = new Date();
      const response = await this.llmWrapper.generateResponse(
        [
          {
            id: crypto.randomUUID(),
            role: 'system',
            content: systemPrompt,
            timestamp: now,
          },
          {
            id: crypto.randomUUID(),
            role: 'user',
            content: userPrompt,
            timestamp: now,
          },
        ],
        {
          model: LLM_SELECTION_MODEL, // gpt-4o-mini
          temperature: 0.3, // Lower temperature for consistent selection
          maxTokens: 150,
        }
      );

      // Parse JSON response
      const selectionData = JSON.parse(response.content);

      // Validate agent ID
      if (!conversation.agentIds.includes(selectionData.agentId)) {
        throw new Error(`Invalid agent ID selected: ${selectionData.agentId}`);
      }

      return {
        agentId: selectionData.agentId,
        confidence: selectionData.confidence,
        reasoning: selectionData.reasoning,
      };
    } catch (error) {
      console.error('[GroupConversationManager] LLM selection failed:', error);
      // Fallback to round-robin on error
      return {
        agentId: this.selectRoundRobin(conversation),
        reasoning: `Fallback to round-robin (LLM error: ${error instanceof Error ? error.message : 'Unknown'})`,
      };
    }
  }

  /**
   * Priority-based speaker selection (FR-018c)
   *
   * Agents with higher priority get more turns via weighted random selection.
   *
   * @param conversation Group conversation
   * @returns Selected agent ID
   */
  private selectPriorityBased(conversation: GroupConversation): string {
    // Get priorities or use default (1.0 for all agents)
    const priorities = conversation._agentPriorities ?? {};
    const agentIds = conversation.agentIds;

    // Calculate weighted random selection
    const weights = agentIds.map((agentId) => priorities[agentId] ?? 1.0);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    // Random selection weighted by priority
    let random = Math.random() * totalWeight;
    for (let i = 0; i < agentIds.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return agentIds[i];
      }
    }

    // Fallback (should never reach here)
    return agentIds[0];
  }

  /**
   * Update speaker selection strategy (FR-018)
   *
   * @param conversationId Conversation ID
   * @param strategy New speaker selection strategy
   */
  setSelectionStrategy(
    conversationId: string,
    strategy: SpeakerSelectionStrategy
  ): void {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    conversation.speakerSelection = strategy;
    conversation.metadata.updatedAt = new Date();
  }

  /**
   * Get conversation by ID
   *
   * @param conversationId Conversation ID
   * @returns Group conversation or null if not found
   */
  getConversation(conversationId: string): GroupConversation | null {
    return this.conversations.get(conversationId) ?? null;
  }

  /**
   * Update shared context for conversation (FR-019)
   *
   * @param conversationId Conversation ID
   * @param contextUpdate Context updates (merged with existing)
   */
  updateSharedContext(
    conversationId: string,
    contextUpdate: Record<string, any>
  ): void {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    if (contextUpdate === null || contextUpdate === undefined) {
      throw new Error("contextUpdate cannot be null or undefined");
    }

    // Merge context updates
    conversation.sharedContext = {
      ...conversation.sharedContext,
      ...contextUpdate,
    };
    conversation.metadata.updatedAt = new Date();
  }

  /**
   * End group conversation and cleanup
   *
   * @param conversationId Conversation ID
   */
  async endConversation(conversationId: string): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return; // Conversation doesn't exist, return gracefully (idempotent)
    }

    // Track success/failure based on workflow state
    const hadFailures =
      conversation.workflowState.tasks.some(
        (task) => task.status === TaskStatus.FAILED
      ) ?? false;
    if (hadFailures) {
      this.stats.failedConversations++;
    } else {
      this.stats.successfulConversations++;
    }

    // Cleanup
    this.conversations.delete(conversationId);
    this.conversationAgents.delete(conversationId);
  }

  /**
   * Get group conversation statistics (FR-021)
   *
   * @returns Group conversation statistics
   */
  getStats(): GroupConversationStats {
    // Calculate average selection latency
    const avgLatency =
      this.stats.selectionLatencies.length > 0
        ? this.stats.selectionLatencies.reduce((sum, l) => sum + l, 0) /
          this.stats.selectionLatencies.length
        : 0;

    // Calculate average agents per conversation
    const activeConversations = this.conversations.size;
    const totalAgents = Array.from(this.conversations.values()).reduce(
      (sum, conv) => sum + conv.agentIds.length,
      0
    );
    const avgAgents =
      activeConversations > 0 ? totalAgents / activeConversations : 0;

    // Calculate success rate
    const totalConversations =
      this.stats.successfulConversations + this.stats.failedConversations;
    const successRate =
      totalConversations > 0
        ? this.stats.successfulConversations / totalConversations
        : 0;

    return {
      activeConversations,
      totalMessages: this.stats.totalMessages,
      selectionsByStrategy: { ...this.stats.selectionsByStrategy },
      avgSelectionLatencyMs: avgLatency,
      avgAgentsPerConversation: avgAgents,
      successfulConversations: this.stats.successfulConversations,
      failedConversations: this.stats.failedConversations,
      successRate,
    };
  }
}
