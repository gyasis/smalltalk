/**
 * ReactiveChainOrchestrator - Core SmallTalk orchestration strategy
 * Implements Agent1→Evaluate→Agent2→Evaluate→Agent3 reactive chains
 */

import { OrchestrationStrategy, OrchestrationContext, OrchestrationDecision, ChainEvaluationResult } from './OrchestrationStrategy.js';
import { TokenJS } from 'token.js';

export interface ChainState {
  sequence: Array<{
    agent: string;
    role: string;
    objective: string;
    response?: string;
    completed: boolean;
  }>;
  currentStep: number;
  conversationSummary: string;
  userQuery: string;
  isActive: boolean;
}

export class ReactiveChainOrchestrator extends OrchestrationStrategy {
  private llm: TokenJS;
  private llmConfig: { provider: string; model: string; apiKey?: string };
  private activeChains: Map<string, ChainState> = new Map();
  
  constructor(llmConfig?: { provider?: string; model?: string; apiKey?: string }) {
    super('ReactiveChain');
    this.llmConfig = {
      provider: llmConfig?.provider || 'openai',
      model: llmConfig?.model || 'gpt-4o-mini',
      apiKey: llmConfig?.apiKey
    };
    this.llm = new TokenJS();
  }

  /**
   * Main orchestration decision making with sophisticated LLM analysis
   */
  async orchestrate(context: OrchestrationContext): Promise<OrchestrationDecision> {
    console.log(`[ReactiveChain] 🔗 Analyzing message for chain orchestration...`);
    
    // Check if this is a continuation of an existing chain
    const existingChain = this.activeChains.get(context.userId);
    if (existingChain && existingChain.isActive) {
      console.log(`[ReactiveChain] ↪️ Continuing existing chain at step ${existingChain.currentStep}`);
      return this.continueExistingChain(context, existingChain);
    }

    // Create sophisticated orchestration prompt
    const orchestrationPrompt = this.createReactiveChainPrompt(context);
    
    try {
      const completion = await this.llm.chat.completions.create({
        provider: this.llmConfig.provider as any,
        model: this.llmConfig.model,
        messages: [{ role: 'user', content: orchestrationPrompt }],
        temperature: 0.3,
        max_tokens: 800
      });

      const llmResponse = completion.choices[0]?.message?.content || '';

      const decision = this.parseOrchestrationDecision(llmResponse, context);
      
      // If chain strategy, initialize chain state
      if (decision.strategy === 'chain' && decision.sequence) {
        this.initializeChain(context.userId, context.message, decision.sequence);
      }

      console.log(`[ReactiveChain] ✅ Decision: ${decision.strategy} | Primary: ${decision.primaryAgent} | Confidence: ${(decision.confidence * 100).toFixed(0)}%`);
      
      return decision;
      
    } catch (error) {
      console.error(`[ReactiveChain] ❌ LLM orchestration failed:`, error);
      return this.getFallbackDecision(context);
    }
  }

  /**
   * Evaluate if chain should continue after agent response
   */
  async evaluateChain(
    agentResponse: string,
    context: OrchestrationContext,
    chainState: ChainState
  ): Promise<ChainEvaluationResult> {
    console.log(`[ReactiveChain] 🔍 Evaluating chain continuation...`);
    
    const evaluationPrompt = this.createChainEvaluationPrompt(agentResponse, context, chainState);
    
    try {
      const completion = await this.llm.chat.completions.create({
        provider: this.llmConfig.provider as any,
        model: this.llmConfig.model,
        messages: [{ role: 'user', content: evaluationPrompt }],
        temperature: 0.2,
        max_tokens: 400
      });

      const llmResponse = completion.choices[0]?.message?.content || '';

      const evaluation = this.parseChainEvaluation(llmResponse, chainState);
      
      // Update chain state
      this.updateChainState(context.userId, agentResponse, evaluation);
      
      console.log(`[ReactiveChain] ${evaluation.shouldContinue ? '▶️ Continuing' : '⏹️ Completing'} chain: ${evaluation.reason}`);
      
      return evaluation;
      
    } catch (error) {
      console.error(`[ReactiveChain] ❌ Chain evaluation failed:`, error);
      return {
        shouldContinue: false,
        reason: 'Evaluation error - completing chain',
        contextSummary: 'Chain completed due to evaluation failure',
        isComplete: true
      };
    }
  }

  /**
   * Create sophisticated prompt for reactive chain orchestration
   */
  private createReactiveChainPrompt(context: OrchestrationContext): string {
    const basePrompt = this.createOrchestrationPrompt(context);
    
    return `${basePrompt}

<REACTIVE_CHAIN_ORCHESTRATION_ANALYSIS>

REACTIVE CHAIN STRATEGY:
This orchestration pattern creates Agent1→Evaluate→Agent2→Evaluate→Agent3 sequences where:
- Each agent builds upon previous responses
- Orchestrator evaluates after each response
- Chain continues until topic is fully addressed
- Context is preserved and enhanced through the sequence

CHAIN SEQUENCING EXAMPLES:

Marketing Question → MarketingLead → SalesChief → CEO
Technical Question → TechLead → ProjectManager → CEO
Strategy Question → CEO → MarketingLead → TechLead
Research Question → ResearchPro → AnalystAgent → CEO

DECISION CRITERIA FOR CHAINS:
1. Complex topics requiring multiple perspectives
2. Questions that benefit from expertise building
3. Strategic discussions needing various viewpoints
4. Collaborative problem-solving scenarios

USER MESSAGE ANALYSIS:
"${context.message}"

Determine if this should be:
- SINGLE: One expert can fully address this
- CHAIN: Multiple experts should contribute sequentially

If CHAIN, design a 2-4 agent sequence that:
1. Starts with most relevant primary expert
2. Builds logical progression of expertise
3. Ends with synthesizing/strategic perspective
4. Maintains conversation coherence

OUTPUT FORMAT:
{
  "strategy": "single|chain",
  "primaryAgent": "AgentName",
  "confidence": 0.8,
  "reason": "Detailed reasoning for strategy choice",
  "sequence": [
    {
      "agent": "Agent1",
      "role": "Primary expert role",
      "objective": "Specific objective for this agent"
    },
    {
      "agent": "Agent2", 
      "role": "Building/complementary role",
      "objective": "How to build on Agent1's response"
    }
  ],
  "expectedFlow": "Description of expected conversation flow"
}

</REACTIVE_CHAIN_ORCHESTRATION_ANALYSIS>`;
  }

  /**
   * Create chain evaluation prompt
   */
  private createChainEvaluationPrompt(
    agentResponse: string,
    context: OrchestrationContext,
    chainState: ChainState
  ): string {
    return `
<CHAIN_CONTINUATION_EVALUATION>

You are evaluating whether a reactive agent chain should continue after an agent response.

ORIGINAL USER QUERY: "${chainState.userQuery}"

CHAIN PROGRESS:
${chainState.sequence.map((step, i) => `
${i + 1}. ${step.agent} (${step.role})
   Objective: ${step.objective}
   Status: ${step.completed ? 'COMPLETED' : 'PENDING'}
   ${step.response ? `Response: ${step.response.substring(0, 200)}...` : ''}
`).join('')}

LATEST AGENT RESPONSE:
Agent: ${chainState.sequence[chainState.currentStep]?.agent}
Response: "${agentResponse}"

EVALUATION CRITERIA:
1. Is the user's query fully addressed?
2. Would additional agent perspectives add significant value?
3. Is the conversation naturally concluded?
4. Are there obvious next steps that another agent should handle?

DECISION FACTORS:
- Query complexity vs coverage achieved
- Natural conversation flow
- Agent expertise synergies
- User satisfaction potential

OUTPUT FORMAT:
{
  "shouldContinue": true|false,
  "reason": "Clear reasoning for continuation decision",
  "nextAgent": "NextAgentName (if continuing)",
  "contextSummary": "Summary of conversation so far",
  "isComplete": true|false
}

Evaluate and decide whether to continue the chain or complete it.

</CHAIN_CONTINUATION_EVALUATION>`;
  }

  /**
   * Parse LLM orchestration decision
   */
  private parseOrchestrationDecision(llmResponse: string, context: OrchestrationContext): OrchestrationDecision {
    try {
      // Extract JSON from LLM response
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        return {
          strategy: parsed.strategy || 'single',
          primaryAgent: parsed.primaryAgent,
          sequence: parsed.sequence ? parsed.sequence.map((step: any) => ({
            agent: step.agent,
            role: step.role,
            objective: step.objective,
            contextToTransfer: {}
          })) : undefined,
          expectedFlow: parsed.expectedFlow || 'Single agent response',
          confidence: parsed.confidence || 0.7,
          reason: parsed.reason || 'LLM orchestration decision',
          shouldContinueChain: parsed.strategy === 'chain'
        };
      }
    } catch (error) {
      console.warn(`[ReactiveChain] ⚠️ Failed to parse LLM decision, using fallback`);
    }
    
    return this.getFallbackDecision(context);
  }

  /**
   * Parse chain evaluation result
   */
  private parseChainEvaluation(llmResponse: string, chainState: ChainState): ChainEvaluationResult {
    try {
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        return {
          shouldContinue: parsed.shouldContinue || false,
          nextAgent: parsed.nextAgent,
          reason: parsed.reason || 'Chain evaluation decision',
          contextSummary: parsed.contextSummary || 'Context summary',
          isComplete: parsed.isComplete !== undefined ? parsed.isComplete : !parsed.shouldContinue
        };
      }
    } catch (error) {
      console.warn(`[ReactiveChain] ⚠️ Failed to parse chain evaluation, completing chain`);
    }
    
    return {
      shouldContinue: false,
      reason: 'Parse error - completing chain',
      contextSummary: 'Chain completed due to parsing error',
      isComplete: true
    };
  }

  /**
   * Initialize new chain state
   */
  private initializeChain(userId: string, userQuery: string, sequence: any[]): void {
    const chainState: ChainState = {
      sequence: sequence.map(step => ({
        agent: step.agent,
        role: step.role,
        objective: step.objective,
        completed: false
      })),
      currentStep: 0,
      conversationSummary: `User query: ${userQuery}`,
      userQuery,
      isActive: true
    };
    
    this.activeChains.set(userId, chainState);
    console.log(`[ReactiveChain] 🔗 Initialized chain with ${sequence.length} steps for user ${userId}`);
  }

  /**
   * Continue existing chain
   */
  private continueExistingChain(context: OrchestrationContext, chainState: ChainState): OrchestrationDecision {
    const currentStep = chainState.sequence[chainState.currentStep];
    
    return {
      strategy: 'chain',
      primaryAgent: currentStep.agent,
      sequence: chainState.sequence.map(step => ({
        agent: step.agent,
        role: step.role,
        objective: step.objective,
        contextToTransfer: {}
      })),
      expectedFlow: `Continuing chain step ${chainState.currentStep + 1}/${chainState.sequence.length}`,
      confidence: 0.9,
      reason: `Chain continuation: ${currentStep.role}`,
      shouldContinueChain: true
    };
  }

  /**
   * Update chain state after agent response
   */
  private updateChainState(userId: string, agentResponse: string, evaluation: ChainEvaluationResult): void {
    const chainState = this.activeChains.get(userId);
    if (!chainState) return;
    
    // Mark current step as completed
    chainState.sequence[chainState.currentStep].response = agentResponse;
    chainState.sequence[chainState.currentStep].completed = true;
    
    // Update conversation summary
    chainState.conversationSummary = evaluation.contextSummary;
    
    if (evaluation.shouldContinue && evaluation.nextAgent) {
      // Find next agent step
      const nextStepIndex = chainState.sequence.findIndex(
        (step, index) => index > chainState.currentStep && step.agent === evaluation.nextAgent
      );
      
      if (nextStepIndex !== -1) {
        chainState.currentStep = nextStepIndex;
      } else {
        // End chain if next agent not found
        chainState.isActive = false;
      }
    } else {
      // Complete chain
      chainState.isActive = false;
    }
    
    console.log(`[ReactiveChain] 📊 Chain state updated - Step ${chainState.currentStep}/${chainState.sequence.length} | Active: ${chainState.isActive}`);
  }

  /**
   * Get fallback decision when LLM fails
   */
  private getFallbackDecision(context: OrchestrationContext): OrchestrationDecision {
    // Simple fallback: route to most relevant agent
    const relevantAgent = context.availableAgents[0]?.agent.name || 'DefaultAgent';
    
    return {
      strategy: 'single',
      primaryAgent: relevantAgent,
      expectedFlow: 'Fallback single agent response',
      confidence: 0.5,
      reason: 'Fallback routing due to orchestration failure'
    };
  }

  /**
   * Get active chain for user (for external access)
   */
  getActiveChain(userId: string): ChainState | undefined {
    return this.activeChains.get(userId);
  }

  /**
   * Clear chain state (for cleanup)
   */
  clearChain(userId: string): void {
    this.activeChains.delete(userId);
    console.log(`[ReactiveChain] 🧹 Cleared chain state for user ${userId}`);
  }
}