/**
 * GroupConversationManager Contract
 *
 * Defines the interface for multi-agent group collaboration with
 * speaker selection and shared conversation context.
 *
 * @see spec.md User Story 4 - Group Conversation Collaboration
 * @see data-model.md GroupConversation Entity
 */

import { Agent } from '../../../src/agents/Agent.js';
import {
  GroupConversation,
  SpeakerSelectionStrategy,
  Message
} from '../../../src/types/robustness.js';

/**
 * Group creation options
 */
export interface CreateGroupOptions {
  /** Speaker selection strategy */
  speakerSelection?: SpeakerSelectionStrategy;
  /** Initial shared context */
  initialContext?: Record<string, any>;
  /** Maximum speakers per turn (for priority/llm-based strategies) */
  maxSpeakersPerTurn?: number;
}

/**
 * Speaker selection context
 */
export interface SpeakerSelectionContext {
  /** Current conversation history */
  conversationHistory: Message[];
  /** Last speaker ID */
  lastSpeakerId?: string;
  /** Available agents */
  availableAgents: Agent[];
  /** User message that triggered selection */
  userMessage?: Message;
  /** Shared context */
  sharedContext: Record<string, any>;
}

/**
 * Speaker selection result
 */
export interface SpeakerSelectionResult {
  /** Selected agent ID */
  agentId: string;
  /** Confidence score (0-1) for LLM-based selection */
  confidence?: number;
  /** Reasoning for selection */
  reasoning?: string;
  /** Selection latency in milliseconds */
  latencyMs: number;
}

/**
 * GroupConversationManager interface
 *
 * Responsible for managing multi-agent group conversations with
 * automatic speaker selection.
 */
export interface GroupConversationManager {
  /**
   * Create a new group conversation
   *
   * FR-016: System MUST support multiple agents in shared contexts (now FR-017)
   * FR-017: System MUST implement speaker selection strategies (now FR-018)
   * SC-012: Speaker selection completes in under 100ms
   *
   * @param agents Array of agents to include in group
   * @param options Group creation options
   * @returns Created group conversation
   * @throws Error if agents.length > 10 (FR-035/FR-036)
   */
  createGroup(
    agents: Agent[],
    options?: CreateGroupOptions
  ): Promise<GroupConversation>;

  /**
   * Add agent to existing group
   *
   * @param conversationId Conversation ID
   * @param agent Agent to add
   * @throws Error if group already has 10 agents (FR-035/FR-036)
   */
  addAgent(conversationId: string, agent: Agent): Promise<void>;

  /**
   * Remove agent from group
   *
   * @param conversationId Conversation ID
   * @param agentId Agent ID to remove
   * @throws Error if removal would leave group with <2 agents
   */
  removeAgent(conversationId: string, agentId: string): Promise<void>;

  /**
   * Handle user message in group conversation
   *
   * FR-018: System MUST provide shared conversation history (now FR-019)
   * FR-020: System MUST track group workflow state (now FR-021)
   *
   * @param conversationId Conversation ID
   * @param userMessage User message
   * @returns Agent response(s)
   */
  handleMessage(
    conversationId: string,
    userMessage: Message
  ): Promise<Message[]>;

  /**
   * Select next speaker for group conversation
   *
   * FR-019: System MUST prevent conversation chaos (now FR-020)
   * SC-013: 90% of speaker selections choose contextually appropriate agents
   *
   * @param conversationId Conversation ID
   * @param context Speaker selection context
   * @returns Speaker selection result
   */
  selectSpeaker(
    conversationId: string,
    context: SpeakerSelectionContext
  ): Promise<SpeakerSelectionResult>;

  /**
   * Update speaker selection strategy for group
   *
   * @param conversationId Conversation ID
   * @param strategy New speaker selection strategy
   */
  setSelectionStrategy(
    conversationId: string,
    strategy: SpeakerSelectionStrategy
  ): void;

  /**
   * Get conversation by ID
   *
   * @param conversationId Conversation ID
   * @returns Group conversation or null if not found
   */
  getConversation(conversationId: string): GroupConversation | null;

  /**
   * Update shared context for conversation
   *
   * @param conversationId Conversation ID
   * @param contextUpdate Context updates (merged with existing)
   */
  updateSharedContext(
    conversationId: string,
    contextUpdate: Record<string, any>
  ): void;

  /**
   * End group conversation and cleanup
   *
   * @param conversationId Conversation ID
   */
  endConversation(conversationId: string): Promise<void>;

  /**
   * Get group conversation statistics
   *
   * SC-011: Group conversations with 3-5 agents complete successfully 85% of time
   *
   * @returns Group conversation statistics
   */
  getStats(): GroupConversationStats;
}

/**
 * Group conversation statistics
 */
export interface GroupConversationStats {
  /** Total active group conversations */
  activeConversations: number;
  /** Total messages exchanged in groups */
  totalMessages: number;
  /** Speaker selections by strategy */
  selectionsByStrategy: {
    'round-robin': number;
    'llm-based': number;
    priority: number;
  };
  /** Average speaker selection latency in milliseconds */
  avgSelectionLatencyMs: number;
  /** Average agents per conversation */
  avgAgentsPerConversation: number;
  /** Successful conversations (completed without failures) */
  successfulConversations: number;
  /** Failed conversations (agent failures during conversation) */
  failedConversations: number;
  /** Success rate (successful / total) */
  successRate: number;
}
