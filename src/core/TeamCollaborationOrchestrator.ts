/**
 * TeamCollaborationOrchestrator - SmallTalk orchestration strategy
 * Implements simultaneous multi-agent collaboration patterns
 */

import { OrchestrationStrategy, OrchestrationContext, OrchestrationDecision, ChainEvaluationResult } from './OrchestrationStrategy.js';
import { TokenJS } from 'token.js';

export interface TeamCollaborationPlan {
  participants: Array<{
    agent: string;
    role: string;
    perspective: string;
    priority: number;
  }>;
  collaborationType: 'parallel' | 'debate' | 'consensus' | 'review';
  synthesisRequired: boolean;
  expectedOutcome: string;
}

export class TeamCollaborationOrchestrator extends OrchestrationStrategy {
  private llm: TokenJS;
  private llmConfig: { provider: string; model: string; apiKey?: string };
  
  constructor(llmConfig?: { provider?: string; model?: string; apiKey?: string }) {
    super('TeamCollaboration');
    this.llmConfig = {
      provider: llmConfig?.provider || 'openai',
      model: llmConfig?.model || 'gpt-4o-mini',
      apiKey: llmConfig?.apiKey
    };
    this.llm = new TokenJS();
  }

  /**
   * Orchestrate team collaboration approach
   */
  async orchestrate(context: OrchestrationContext): Promise<OrchestrationDecision> {
    console.log(`[TeamCollab] 👥 Analyzing for team collaboration opportunity...`);
    
    const collaborationPrompt = this.createTeamCollaborationPrompt(context);
    
    try {
      const completion = await this.llm.chat.completions.create({
        provider: this.llmConfig.provider as any,
        model: this.llmConfig.model,
        messages: [{ role: 'user', content: collaborationPrompt }],
        temperature: 0.3,
        max_tokens: 600
      });

      const llmResponse = completion.choices[0]?.message?.content || '';

      const decision = this.parseTeamDecision(llmResponse, context);
      
      console.log(`[TeamCollab] ✅ Decision: ${decision.strategy} | Participants: ${decision.sequence?.length || 1} | Confidence: ${(decision.confidence * 100).toFixed(0)}%`);
      
      return decision;
      
    } catch (error) {
      console.error(`[TeamCollab] ❌ Team orchestration failed:`, error);
      return this.getFallbackDecision(context);
    }
  }

  /**
   * Evaluate team collaboration (placeholder - teams don't use chains)
   */
  async evaluateChain(
    agentResponse: string,
    context: OrchestrationContext,
    chainState: any
  ): Promise<ChainEvaluationResult> {
    // Team collaboration doesn't use chain evaluation
    return {
      shouldContinue: false,
      reason: 'Team collaboration completed',
      contextSummary: 'Team collaboration response provided',
      isComplete: true
    };
  }

  /**
   * Create team collaboration analysis prompt
   */
  private createTeamCollaborationPrompt(context: OrchestrationContext): string {
    const basePrompt = this.createOrchestrationPrompt(context);
    
    return `${basePrompt}

<TEAM_COLLABORATION_ORCHESTRATION>

TEAM COLLABORATION STRATEGY:
This orchestration pattern enables multiple agents to contribute simultaneously or in coordinated fashion:
- PARALLEL: Multiple agents respond independently, then synthesized
- DEBATE: Agents present different viewpoints for user consideration  
- CONSENSUS: Agents collaborate to reach agreement
- REVIEW: One agent proposes, others review/improve

COLLABORATION TRIGGERS:
1. Complex strategic decisions requiring multiple perspectives
2. Creative tasks benefiting from diverse viewpoints
3. Problem-solving scenarios needing various expertise
4. Comprehensive analysis requiring domain specializations
5. User explicitly requesting multiple opinions

TEAM COMPOSITION EXAMPLES:

Business Strategy: CEO + MarketingLead + FinanceAdvisor
Product Launch: MarketingLead + TechLead + SalesChief  
Technical Architecture: TechLead + ProjectManager + CEO
Market Analysis: ResearchPro + MarketingLead + SalesChief

USER MESSAGE ANALYSIS:
"${context.message}"

COLLABORATION ASSESSMENT:
- Does this benefit from multiple perspectives? 
- Are there different expertise domains involved?
- Would diverse viewpoints improve the response quality?
- Is this a complex decision requiring team input?

DECISION CRITERIA:
- Single expert sufficient: Use 'single' strategy
- Multiple perspectives valuable: Use 'team' strategy
- Sequential expertise building: Use 'chain' strategy

OUTPUT FORMAT:
{
  "strategy": "single|team|chain",
  "primaryAgent": "LeadAgentName",
  "confidence": 0.8,
  "reason": "Detailed reasoning for strategy choice",
  "sequence": [
    {
      "agent": "Agent1",
      "role": "Lead perspective role",
      "objective": "Primary contribution focus"
    },
    {
      "agent": "Agent2",
      "role": "Complementary role", 
      "objective": "Additional perspective to provide"
    }
  ],
  "collaborationType": "parallel|debate|consensus|review",
  "expectedFlow": "Description of team collaboration flow"
}

</TEAM_COLLABORATION_ORCHESTRATION>`;
  }

  /**
   * Parse team collaboration decision
   */
  private parseTeamDecision(llmResponse: string, context: OrchestrationContext): OrchestrationDecision {
    try {
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
          expectedFlow: parsed.expectedFlow || 'Team collaboration response',
          confidence: parsed.confidence || 0.7,
          reason: parsed.reason || 'Team collaboration orchestration'
        };
      }
    } catch (error) {
      console.warn(`[TeamCollab] ⚠️ Failed to parse team decision, using fallback`);
    }
    
    return this.getFallbackDecision(context);
  }

  /**
   * Create team collaboration plan
   */
  createCollaborationPlan(
    agents: string[],
    collaborationType: 'parallel' | 'debate' | 'consensus' | 'review',
    context: OrchestrationContext
  ): TeamCollaborationPlan {
    const participants = agents.map((agent, index) => ({
      agent,
      role: this.determineAgentRole(agent, collaborationType, context),
      perspective: this.determineAgentPerspective(agent, context),
      priority: index + 1
    }));

    return {
      participants,
      collaborationType,
      synthesisRequired: collaborationType === 'parallel' || collaborationType === 'consensus',
      expectedOutcome: this.determineExpectedOutcome(collaborationType, participants.length)
    };
  }

  /**
   * Determine agent role in collaboration
   */
  private determineAgentRole(
    agentName: string,
    collaborationType: string,
    context: OrchestrationContext
  ): string {
    const roleMap: Record<string, Record<string, string>> = {
      'parallel': {
        'CEO': 'Strategic oversight and decision-making perspective',
        'MarketingLead': 'Market positioning and customer perspective',
        'TechLead': 'Technical feasibility and implementation perspective',
        'SalesChief': 'Revenue and customer acquisition perspective',
        'FinanceAdvisor': 'Financial impact and resource perspective',
        'ProjectManager': 'Execution planning and resource coordination',
        'ResearchPro': 'Data analysis and research perspective'
      },
      'debate': {
        'CEO': 'Strategic advocate and final decision authority',
        'MarketingLead': 'Customer-centric advocate',
        'TechLead': 'Technical constraints advocate',
        'SalesChief': 'Revenue optimization advocate'
      },
      'consensus': {
        'CEO': 'Consensus facilitator and strategic guide',
        'MarketingLead': 'Market requirements contributor',
        'TechLead': 'Technical requirements contributor'
      }
    };

    return roleMap[collaborationType]?.[agentName] || `${agentName} perspective contributor`;
  }

  /**
   * Determine agent perspective
   */
  private determineAgentPerspective(agentName: string, context: OrchestrationContext): string {
    const perspectiveMap: Record<string, string> = {
      'CEO': 'Strategic, high-level business impact',
      'MarketingLead': 'Customer needs, market positioning, brand impact',
      'TechLead': 'Technical implementation, architecture, feasibility',
      'SalesChief': 'Revenue impact, customer acquisition, competitive advantage',
      'FinanceAdvisor': 'Cost-benefit analysis, financial viability, ROI',
      'ProjectManager': 'Implementation planning, resource allocation, timeline',
      'ResearchPro': 'Data-driven insights, market research, trend analysis'
    };

    return perspectiveMap[agentName] || 'Domain expertise perspective';
  }

  /**
   * Determine expected collaboration outcome
   */
  private determineExpectedOutcome(collaborationType: string, participantCount: number): string {
    const outcomeMap: Record<string, string> = {
      'parallel': `Comprehensive response with ${participantCount} expert perspectives synthesized`,
      'debate': `Balanced analysis with contrasting viewpoints from ${participantCount} experts`,
      'consensus': `Unified recommendation agreed upon by ${participantCount} expert team`,
      'review': `Refined solution improved through ${participantCount}-stage expert review`
    };

    return outcomeMap[collaborationType] || 'Multi-agent collaborative response';
  }

  /**
   * Get fallback decision
   */
  private getFallbackDecision(context: OrchestrationContext): OrchestrationDecision {
    const relevantAgent = context.availableAgents[0]?.agent.name || 'DefaultAgent';
    
    return {
      strategy: 'single',
      primaryAgent: relevantAgent,
      expectedFlow: 'Fallback single agent response',
      confidence: 0.5,
      reason: 'Fallback routing due to team orchestration failure'
    };
  }
}