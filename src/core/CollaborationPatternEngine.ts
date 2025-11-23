import { Agent } from '../agents/Agent.js';
import { TokenJSWrapper } from '../utils/TokenJSWrapper.js';
import { AgentCapabilities, SkillsMatchAnalysis, CollaborationOpportunity } from './AgentSkillsAnalyzer.js';

export interface CollaborationPattern {
  name: string;
  description: string;
  suitableFor: string[];
  agentCount: { min: number; max: number };
  executionFlow: ExecutionStep[];
  benefits: string[];
  risks: string[];
  successCriteria: string[];
}

export interface ExecutionStep {
  stepType: 'agent_action' | 'evaluation' | 'synthesis' | 'handoff' | 'parallel_start' | 'parallel_end';
  description: string;
  participants: string[]; // agent roles or 'all'
  duration: number; // estimated milliseconds
  interruptible: boolean;
  outputExpected: string;
}

export interface CollaborationRecommendation {
  pattern: CollaborationPattern;
  selectedAgents: Agent[];
  confidence: number;
  reasoning: string;
  executionPlan: ExecutionStep[];
  estimatedDuration: number;
  riskAssessment: string;
  alternatives: CollaborationPattern[];
}

/**
 * CollaborationPatternEngine - Deep pattern detection for agent collaboration
 * 
 * Analyzes user requests to identify optimal collaboration patterns:
 * - Sequential execution with handoffs
 * - Parallel collaboration with synthesis
 * - Debate/discussion patterns
 * - Review and refinement workflows
 * - Specialist-lead consulting patterns
 * - Workshop and brainstorming patterns
 */
export class CollaborationPatternEngine {
  private llm: TokenJSWrapper;
  private patterns: Map<string, CollaborationPattern> = new Map();
  private patternHistory: Array<{
    userRequest: string;
    selectedPattern: string;
    agents: string[];
    success: boolean;
    feedback: string;
  }> = [];

  constructor(llmConfig: { provider: string; model: string }) {
    this.llm = new TokenJSWrapper({
      llmProvider: llmConfig.provider,
      model: llmConfig.model,
      temperature: 0.4, // Balanced for pattern detection
      maxTokens: 2500
    });

    this.initializeDefaultPatterns();
    console.log('[🤝 CollaborationPatternEngine] Initialized with deep pattern detection capabilities');
  }

  /**
   * Initialize default collaboration patterns
   */
  private initializeDefaultPatterns(): void {
    const patterns: CollaborationPattern[] = [
      {
        name: 'sequential-handoff',
        description: 'Sequential execution where each agent builds on the previous output',
        suitableFor: ['complex-analysis', 'step-by-step-processing', 'pipeline-tasks'],
        agentCount: { min: 2, max: 5 },
        executionFlow: [
          {
            stepType: 'agent_action',
            description: 'First agent provides initial analysis/response',
            participants: ['agent-1'],
            duration: 30000,
            interruptible: true,
            outputExpected: 'Initial analysis or foundation work'
          },
          {
            stepType: 'handoff',
            description: 'Context and output transferred to next agent',
            participants: ['agent-1', 'agent-2'],
            duration: 5000,
            interruptible: false,
            outputExpected: 'Contextual handoff summary'
          },
          {
            stepType: 'agent_action',
            description: 'Second agent refines and builds upon first output',
            participants: ['agent-2'],
            duration: 30000,
            interruptible: true,
            outputExpected: 'Enhanced analysis building on previous work'
          }
        ],
        benefits: ['Builds complexity progressively', 'Each agent adds specialized expertise', 'Clear accountability'],
        risks: ['Earlier mistakes compound', 'Slower execution', 'Context loss between handoffs'],
        successCriteria: ['Each agent adds clear value', 'No significant contradiction between agents', 'Progressive improvement in output quality']
      },
      {
        name: 'parallel-synthesis',
        description: 'Multiple agents work simultaneously, then results are synthesized',
        suitableFor: ['multi-perspective-analysis', 'comprehensive-coverage', 'brainstorming'],
        agentCount: { min: 2, max: 4 },
        executionFlow: [
          {
            stepType: 'parallel_start',
            description: 'Multiple agents begin working on the same task simultaneously',
            participants: ['all'],
            duration: 1000,
            interruptible: false,
            outputExpected: 'Parallel execution initiation'
          },
          {
            stepType: 'agent_action',
            description: 'Each agent provides their perspective simultaneously',
            participants: ['all'],
            duration: 45000,
            interruptible: true,
            outputExpected: 'Multiple independent perspectives'
          },
          {
            stepType: 'parallel_end',
            description: 'Parallel execution ends, prepare for synthesis',
            participants: ['all'],
            duration: 1000,
            interruptible: false,
            outputExpected: 'Parallel execution completion'
          },
          {
            stepType: 'synthesis',
            description: 'Combine and synthesize all perspectives into coherent response',
            participants: ['synthesizer'],
            duration: 20000,
            interruptible: true,
            outputExpected: 'Unified synthesis of all perspectives'
          }
        ],
        benefits: ['Comprehensive coverage', 'Multiple viewpoints', 'Faster than sequential'],
        risks: ['Potential conflicts between perspectives', 'Synthesis complexity', 'Coordination overhead'],
        successCriteria: ['All perspectives add unique value', 'Successful synthesis without major conflicts', 'Comprehensive coverage achieved']
      },
      {
        name: 'debate-discussion',
        description: 'Agents engage in structured debate or discussion to explore different viewpoints',
        suitableFor: ['controversial-topics', 'decision-making', 'exploring-tradeoffs'],
        agentCount: { min: 2, max: 3 },
        executionFlow: [
          {
            stepType: 'agent_action',
            description: 'First agent presents initial position',
            participants: ['agent-1'],
            duration: 30000,
            interruptible: true,
            outputExpected: 'Initial position or argument'
          },
          {
            stepType: 'agent_action',
            description: 'Second agent presents counter-perspective or alternative',
            participants: ['agent-2'],
            duration: 30000,
            interruptible: true,
            outputExpected: 'Counter-argument or alternative viewpoint'
          },
          {
            stepType: 'agent_action',
            description: 'First agent responds and refines position',
            participants: ['agent-1'],
            duration: 20000,
            interruptible: true,
            outputExpected: 'Refined position based on counter-arguments'
          },
          {
            stepType: 'synthesis',
            description: 'Final synthesis of debate outcomes',
            participants: ['moderator'],
            duration: 15000,
            interruptible: true,
            outputExpected: 'Balanced conclusion considering all viewpoints'
          }
        ],
        benefits: ['Thorough exploration of viewpoints', 'Identifies weaknesses in reasoning', 'Balanced outcome'],
        risks: ['May create confusion', 'Time-intensive', 'Requires good moderation'],
        successCriteria: ['Both perspectives well-represented', 'Constructive rather than adversarial', 'Clear synthesis achieved']
      },
      {
        name: 'specialist-consultation',
        description: 'Lead agent consults with specialists for specific expertise',
        suitableFor: ['expert-input-needed', 'specialized-knowledge', 'technical-validation'],
        agentCount: { min: 2, max: 4 },
        executionFlow: [
          {
            stepType: 'agent_action',
            description: 'Lead agent provides initial analysis and identifies areas needing specialist input',
            participants: ['lead-agent'],
            duration: 25000,
            interruptible: true,
            outputExpected: 'Initial analysis with specialist consultation requests'
          },
          {
            stepType: 'agent_action',
            description: 'Specialists provide targeted expertise',
            participants: ['specialists'],
            duration: 35000,
            interruptible: true,
            outputExpected: 'Specialist insights and recommendations'
          },
          {
            stepType: 'synthesis',
            description: 'Lead agent integrates specialist input into final response',
            participants: ['lead-agent'],
            duration: 20000,
            interruptible: true,
            outputExpected: 'Comprehensive response incorporating specialist expertise'
          }
        ],
        benefits: ['Leverages specialized knowledge', 'Maintains clear leadership', 'Efficient use of expertise'],
        risks: ['Specialist input may conflict', 'Lead agent may not integrate well', 'Coordination complexity'],
        successCriteria: ['Specialist input clearly valuable', 'Good integration by lead agent', 'Enhanced quality from collaboration']
      },
      {
        name: 'review-refinement',
        description: 'One agent creates initial output, others review and suggest improvements',
        suitableFor: ['quality-assurance', 'error-checking', 'improvement-suggestions'],
        agentCount: { min: 2, max: 3 },
        executionFlow: [
          {
            stepType: 'agent_action',
            description: 'Primary agent creates initial comprehensive response',
            participants: ['primary-agent'],
            duration: 40000,
            interruptible: true,
            outputExpected: 'Complete initial response or solution'
          },
          {
            stepType: 'evaluation',
            description: 'Review agents analyze and provide feedback',
            participants: ['reviewers'],
            duration: 30000,
            interruptible: true,
            outputExpected: 'Constructive feedback and improvement suggestions'
          },
          {
            stepType: 'agent_action',
            description: 'Primary agent refines based on feedback',
            participants: ['primary-agent'],
            duration: 20000,
            interruptible: true,
            outputExpected: 'Refined response incorporating feedback'
          }
        ],
        benefits: ['Quality assurance', 'Error reduction', 'Multiple perspective validation'],
        risks: ['May slow down simple tasks', 'Feedback may conflict', 'Over-refinement possible'],
        successCriteria: ['Meaningful feedback provided', 'Successful incorporation of suggestions', 'Clear improvement in final output']
      }
    ];

    patterns.forEach(pattern => {
      this.patterns.set(pattern.name, pattern);
    });

    console.log(`[🤝 CollaborationPatternEngine] 📚 Initialized ${patterns.length} default collaboration patterns`);
  }

  /**
   * Detect optimal collaboration pattern using deep analysis
   */
  async detectOptimalPattern(
    userRequest: string,
    skillsAnalyses: SkillsMatchAnalysis[],
    collaborationOpportunities: CollaborationOpportunity[]
  ): Promise<CollaborationRecommendation> {
    console.log(`[🤝 CollaborationPatternEngine] 🔍 Analyzing collaboration patterns for: "${userRequest.substring(0, 50)}..."`);

    const prompt = `
COLLABORATION PATTERN ANALYSIS

Analyze this user request to determine the optimal collaboration pattern:

USER REQUEST: "${userRequest}"

AVAILABLE AGENTS & SKILLS:
${skillsAnalyses.slice(0, 5).map(a => `
${a.agent.name} (Match: ${Math.round(a.overallMatch * 100)}%):
- Skills: Primary(${Math.round(a.skillBreakdown.primarySkillMatch * 100)}%), Secondary(${Math.round(a.skillBreakdown.secondarySkillMatch * 100)}%)
- Performance: ${Math.round(a.estimatedPerformance * 100)}%
- Collaboration Strengths: ${a.collaborationPotential.join(', ')}
`).join('')}

COLLABORATION OPPORTUNITIES:
${collaborationOpportunities.slice(0, 3).map(opp => `
Agents: ${opp.agentCombination.map(a => a.name).join(' + ')}
Synergy: ${Math.round(opp.synergy * 100)}%
Pattern: ${opp.collaborationPattern}
Reasoning: ${opp.reasoning}
`).join('')}

AVAILABLE PATTERNS:
${Array.from(this.patterns.values()).map(p => `
${p.name}: ${p.description}
Suitable for: ${p.suitableFor.join(', ')}
Agent count: ${p.agentCount.min}-${p.agentCount.max}
Benefits: ${p.benefits.slice(0, 2).join(', ')}
`).join('')}

Analyze the request and recommend the best collaboration approach:

RECOMMENDED_PATTERN: [pattern name from above]
SELECTED_AGENTS: [comma-separated list of agent names]
CONFIDENCE: [0-100] - Confidence in this recommendation
REASONING: [2-3 sentences explaining why this pattern and agents are optimal]
ESTIMATED_DURATION: [milliseconds] - Expected total execution time
RISK_ASSESSMENT: [Brief assessment of main risks]
ALTERNATIVE_PATTERNS: [comma-separated list of viable alternatives]

Focus on the user's specific needs and the unique strengths of the available agents.
`;

    try {
      const response = await this.llm.generateResponse([{ 
        id: 'collaboration-' + Date.now(), 
        role: 'user', 
        content: prompt,
        timestamp: new Date()
      }]);
      return this.parsePatternRecommendation(response.content, skillsAnalyses);
    } catch (error) {
      console.error(`[🤝 CollaborationPatternEngine] ❌ Pattern detection failed:`, error);
      return this.createFallbackRecommendation(userRequest, skillsAnalyses);
    }
  }

  /**
   * Parse LLM pattern recommendation response
   */
  private parsePatternRecommendation(
    response: string,
    skillsAnalyses: SkillsMatchAnalysis[]
  ): CollaborationRecommendation {
    const patternName = this.extractField(response, 'RECOMMENDED_PATTERN')?.toLowerCase();
    const pattern = patternName ? this.patterns.get(patternName) : null;

    if (!pattern) {
      console.warn(`[🤝 CollaborationPatternEngine] ⚠️ Unknown pattern recommended: ${patternName}, using fallback`);
      return this.createFallbackRecommendation('', skillsAnalyses);
    }

    const selectedAgentNames = this.extractList(response, 'SELECTED_AGENTS');
    const selectedAgents = skillsAnalyses
      .filter(a => selectedAgentNames.includes(a.agent.name))
      .map(a => a.agent);

    const confidence = this.extractScore(response, 'CONFIDENCE') / 100;
    const reasoning = this.extractField(response, 'REASONING') || 'Pattern analysis completed';
    const estimatedDuration = this.extractScore(response, 'ESTIMATED_DURATION') || this.calculatePatternDuration(pattern);
    const riskAssessment = this.extractField(response, 'RISK_ASSESSMENT') || 'Standard collaboration risks apply';
    
    const alternativeNames = this.extractList(response, 'ALTERNATIVE_PATTERNS');
    const alternatives = alternativeNames
      .map(name => this.patterns.get(name.toLowerCase()))
      .filter((p): p is CollaborationPattern => p !== undefined);

    // Create execution plan based on pattern and selected agents
    const executionPlan = this.createExecutionPlan(pattern, selectedAgents);

    return {
      pattern,
      selectedAgents,
      confidence,
      reasoning,
      executionPlan,
      estimatedDuration,
      riskAssessment,
      alternatives
    };
  }

  /**
   * Create execution plan from pattern template and selected agents
   */
  private createExecutionPlan(pattern: CollaborationPattern, agents: Agent[]): ExecutionStep[] {
    const executionPlan: ExecutionStep[] = [];

    for (const templateStep of pattern.executionFlow) {
      const step: ExecutionStep = {
        ...templateStep,
        participants: this.mapParticipants(templateStep.participants, agents)
      };
      executionPlan.push(step);
    }

    return executionPlan;
  }

  /**
   * Map template participants to actual agent names
   */
  private mapParticipants(templateParticipants: string[], agents: Agent[]): string[] {
    return templateParticipants.map(participant => {
      switch (participant) {
        case 'all':
          return agents.map(a => a.name).join(',');
        case 'agent-1':
        case 'lead-agent':
        case 'primary-agent':
          return agents[0]?.name || 'unknown';
        case 'agent-2':
          return agents[1]?.name || 'unknown';
        case 'specialists':
        case 'reviewers':
          return agents.slice(1).map(a => a.name).join(',');
        case 'synthesizer':
        case 'moderator':
          // Use the agent with highest collaboration potential
          const bestCollaborator = agents.reduce((best, current) => 
            current.name.includes('Manager') || current.name.includes('CEO') ? current : best
          );
          return bestCollaborator?.name || agents[0]?.name || 'unknown';
        default:
          return participant;
      }
    });
  }

  /**
   * Create fallback recommendation when analysis fails
   */
  private createFallbackRecommendation(
    userRequest: string,
    skillsAnalyses: SkillsMatchAnalysis[]
  ): CollaborationRecommendation {
    // Default to sequential-handoff with top 2 agents
    const pattern = this.patterns.get('sequential-handoff')!;
    const selectedAgents = skillsAnalyses.slice(0, 2).map(a => a.agent);

    return {
      pattern,
      selectedAgents,
      confidence: 0.6,
      reasoning: 'Fallback to sequential handoff pattern with top-performing agents',
      executionPlan: this.createExecutionPlan(pattern, selectedAgents),
      estimatedDuration: this.calculatePatternDuration(pattern),
      riskAssessment: 'Standard sequential execution risks',
      alternatives: [this.patterns.get('parallel-synthesis')!].filter(p => p)
    };
  }

  /**
   * Calculate estimated duration for a pattern
   */
  private calculatePatternDuration(pattern: CollaborationPattern): number {
    return pattern.executionFlow.reduce((total, step) => total + step.duration, 0);
  }

  /**
   * Record pattern usage for learning
   */
  recordPatternUsage(
    userRequest: string,
    selectedPattern: string,
    agents: string[],
    success: boolean,
    feedback: string = ''
  ): void {
    this.patternHistory.push({
      userRequest,
      selectedPattern,
      agents,
      success,
      feedback
    });

    console.log(`[🤝 CollaborationPatternEngine] 📊 Recorded pattern usage: ${selectedPattern} (${success ? 'success' : 'failure'})`);
  }

  /**
   * Get pattern usage statistics
   */
  getPatternStatistics(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [name, pattern] of this.patterns) {
      const usage = this.patternHistory.filter(h => h.selectedPattern === name);
      const successes = usage.filter(h => h.success).length;
      
      stats[name] = {
        description: pattern.description,
        totalUsage: usage.length,
        successRate: usage.length > 0 ? successes / usage.length : 0,
        avgAgents: usage.length > 0 ? 
          usage.reduce((sum, h) => sum + h.agents.length, 0) / usage.length : 0
      };
    }

    return stats;
  }

  /**
   * Utility methods for parsing LLM responses
   */
  private extractScore(response: string, field: string): number {
    const regex = new RegExp(`${field}:\\s*\\[?(\\d+)`, 'i');
    const match = response.match(regex);
    return match ? parseInt(match[1]) : 50;
  }

  private extractField(response: string, field: string): string | null {
    const regex = new RegExp(`${field}:\\s*(.+?)(?=\\n|$)`, 'i');
    const match = response.match(regex);
    return match ? match[1].trim().replace(/^\[|\]$/g, '') : null;
  }

  private extractList(response: string, field: string): string[] {
    const fieldContent = this.extractField(response, field);
    if (!fieldContent) return [];
    
    return fieldContent
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);
  }
}