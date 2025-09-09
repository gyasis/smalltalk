/**
 * Core orchestration strategy system for SmallTalk framework
 * Provides different patterns for multi-agent conversation flow
 */

import { Agent } from '../agents/Agent.js';
import { ChatMessage } from '../types/index.js';

export interface OrchestrationContext {
  userId: string;
  message: string;
  conversationHistory: ChatMessage[];
  currentAgent?: string;
  availableAgents: Array<{
    agent: Agent;
    capabilities: {
      expertise: string[];
      complexity: string;
      taskTypes: string[];
      tools: string[];
      contextAwareness: number;
      collaborationStyle: string;
    };
  }>;
}

export interface OrchestrationDecision {
  strategy: 'single' | 'chain' | 'team' | 'consensus' | 'specialized';
  primaryAgent: string;
  sequence?: Array<{
    agent: string;
    role: string;
    objective: string;
    contextToTransfer: Record<string, any>;
  }>;
  expectedFlow: string;
  confidence: number;
  reason: string;
  shouldContinueChain?: boolean;
  chainEvaluationPrompt?: string;
}

export interface ChainEvaluationResult {
  shouldContinue: boolean;
  nextAgent?: string;
  reason: string;
  contextSummary: string;
  isComplete: boolean;
}

/**
 * Base abstract class for orchestration strategies
 */
export abstract class OrchestrationStrategy {
  protected name: string;
  
  constructor(name: string) {
    this.name = name;
  }

  /**
   * Decide on the orchestration approach for a given context
   */
  abstract orchestrate(context: OrchestrationContext): Promise<OrchestrationDecision>;

  /**
   * Evaluate if a chain should continue after an agent response
   */
  evaluateChain?(
    agentResponse: string,
    context: OrchestrationContext,
    chainState: any
  ): Promise<ChainEvaluationResult>;

  /**
   * Generate context for next agent in chain
   */
  protected generateChainContext(
    previousResponses: Array<{ agent: string; response: string }>,
    nextAgent: string,
    objective: string
  ): Record<string, any> {
    return {
      conversationThread: previousResponses,
      buildUponPrevious: true,
      nextAgentRole: nextAgent,
      specificObjective: objective,
      shouldReference: previousResponses.map(r => r.agent),
      continuityRequired: true
    };
  }

  /**
   * Create sophisticated orchestration prompt (1000-1500 tokens)
   */
  protected createOrchestrationPrompt(context: OrchestrationContext): string {
    return `
<SOPHISTICATED_ORCHESTRATION_ANALYSIS>

You are an expert AI Orchestrator managing a multi-agent conversation system. Your role is to make intelligent routing decisions that optimize conversation flow, maintain context continuity, and ensure appropriate agent collaboration.

CONVERSATION CONTEXT:
- User ID: ${context.userId}
- Current Message: "${context.message}"
- Current Agent: ${context.currentAgent || 'None'}
- Available Agents: ${context.availableAgents.map(a => a.agent.name).join(', ')}

CONVERSATION HISTORY:
${context.conversationHistory.slice(-3).map((msg, i) => 
  `${i + 1}. ${msg.role === 'user' ? 'USER' : (msg.metadata && 'agentName' in msg.metadata ? msg.metadata['agentName'] : 'AGENT')}: ${msg.content.substring(0, 200)}...`
).join('\n')}

AGENT CAPABILITIES MATRIX:
${context.availableAgents.map(({ agent, capabilities }) => `
• ${agent.name}:
  - Expertise: ${capabilities.expertise.join(', ')}
  - Complexity: ${capabilities.complexity}
  - Task Types: ${capabilities.taskTypes.join(', ')}
  - Collaboration: ${capabilities.collaborationStyle}
`).join('')}

ORCHESTRATION DECISION FRAMEWORK:

1. CONTEXT ANALYSIS:
   - Analyze user intent and message complexity
   - Identify required expertise domains
   - Assess conversation continuity needs
   - Determine collaboration requirements

2. STRATEGY SELECTION:
   - SINGLE: Simple query requiring one expert
   - CHAIN: Complex topic needing sequential agent contributions
   - TEAM: Multiple perspectives needed simultaneously
   - CONSENSUS: Agents need to debate/agree
   - SPECIALIZED: Domain-specific routing logic

3. AGENT ROUTING LOGIC:
   - Direct agent requests (high priority)
   - Expertise domain matching
   - Conversation context building
   - Collaboration synergy assessment

4. CHAIN SEQUENCING (if chain strategy):
   - Plan optimal agent sequence
   - Define each agent's role and objective
   - Ensure context transfer between agents
   - Determine completion criteria

5. QUALITY ASSURANCE:
   - Confidence scoring (0.0-1.0)
   - Fallback agent identification
   - Context preservation validation
   - User experience optimization

Provide a detailed orchestration decision with clear reasoning, agent selection justification, and if applicable, a multi-agent collaboration plan.

</SOPHISTICATED_ORCHESTRATION_ANALYSIS>
    `.trim();
  }

  getName(): string {
    return this.name;
  }
}