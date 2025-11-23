import { Agent } from '../agents/Agent.js';
import { TokenJSWrapper } from '../utils/TokenJSWrapper.js';

export interface AgentCapabilities {
  primarySkills: string[];
  secondarySkills: string[];
  domainExpertise: string[];
  collaborationStrengths: string[];
  taskTypes: string[];
  complexityHandling: 'basic' | 'intermediate' | 'advanced' | 'expert';
  interruptionTolerance: 'low' | 'medium' | 'high';
  contextPreservation: number; // 0-1 score
  averageResponseTime: number; // milliseconds
  confidenceThreshold: number; // 0-1 minimum confidence for tasks
}

export interface SkillsMatchAnalysis {
  agent: Agent;
  overallMatch: number; // 0-1 score
  skillBreakdown: {
    primarySkillMatch: number;
    secondarySkillMatch: number;
    domainExpertiseMatch: number;
    taskTypeMatch: number;
  };
  reasoning: string;
  confidence: number;
  suitabilityRank: number;
  collaborationPotential: string[];
  estimatedPerformance: number;
  riskFactors: string[];
}

export interface CollaborationOpportunity {
  agentCombination: Agent[];
  synergy: number; // 0-1 score
  skillComplementarity: number;
  collaborationPattern: 'sequential' | 'parallel' | 'debate' | 'review' | 'specialist-lead';
  expectedOutcome: string;
  reasoning: string;
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * AgentSkillsAnalyzer - Heavy analysis engine for agent capabilities and routing
 * 
 * Performs sophisticated analysis of:
 * - Agent skills vs task requirements matching
 * - Collaboration opportunity detection
 * - Skill complementarity analysis
 * - Performance prediction and risk assessment
 * 
 * Uses LLM reasoning for deep analysis beyond simple keyword matching.
 */
export class AgentSkillsAnalyzer {
  private llm: TokenJSWrapper;
  private agentCapabilities: Map<string, AgentCapabilities> = new Map();
  private analysisHistory: Map<string, SkillsMatchAnalysis[]> = new Map();

  constructor(llmConfig: { provider: string; model: string }) {
    this.llm = new TokenJSWrapper({
      llmProvider: llmConfig.provider,
      model: llmConfig.model,
      temperature: 0.3, // Lower temperature for analytical tasks
      maxTokens: 2000
    });

    console.log('[🧠 AgentSkillsAnalyzer] Initialized with heavy skills analysis capabilities');
  }

  /**
   * Register agent with detailed capability mapping
   */
  registerAgent(agent: Agent, capabilities: AgentCapabilities): void {
    this.agentCapabilities.set(agent.name, capabilities);
    console.log(`[🧠 AgentSkillsAnalyzer] 📋 Registered ${agent.name} with ${capabilities.primarySkills.length} primary skills`);
  }

  /**
   * Perform heavy skills analysis for agent selection
   */
  async performDeepSkillsAnalysis(
    userRequest: string,
    availableAgents: Agent[],
    conversationContext: string[] = []
  ): Promise<SkillsMatchAnalysis[]> {
    console.log(`[🧠 AgentSkillsAnalyzer] 🔍 Starting deep skills analysis for: "${userRequest.substring(0, 50)}..."`);

    const analyses: SkillsMatchAnalysis[] = [];

    for (const agent of availableAgents) {
      const capabilities = this.agentCapabilities.get(agent.name);
      if (!capabilities) {
        console.warn(`[🧠 AgentSkillsAnalyzer] ⚠️ No capabilities found for agent: ${agent.name}`);
        continue;
      }

      const analysis = await this.analyzeAgentMatch(userRequest, agent, capabilities, conversationContext);
      analyses.push(analysis);
    }

    // Sort by overall match score
    analyses.sort((a, b) => b.overallMatch - a.overallMatch);

    // Assign suitability ranks
    analyses.forEach((analysis, index) => {
      analysis.suitabilityRank = index + 1;
    });

    console.log(`[🧠 AgentSkillsAnalyzer] 📊 Analysis complete. Top agent: ${analyses[0]?.agent.name} (${Math.round(analyses[0]?.overallMatch * 100)}% match)`);

    // Store analysis for learning
    this.analysisHistory.set(userRequest, analyses);

    return analyses;
  }

  /**
   * Analyze individual agent match using LLM reasoning
   */
  private async analyzeAgentMatch(
    userRequest: string,
    agent: Agent,
    capabilities: AgentCapabilities,
    context: string[]
  ): Promise<SkillsMatchAnalysis> {
    const prompt = `
AGENT SKILLS ANALYSIS TASK

Analyze how well this agent matches the user request:

USER REQUEST: "${userRequest}"

AGENT: ${agent.name}
PERSONALITY: Not specified

AGENT CAPABILITIES:
- Primary Skills: ${capabilities.primarySkills.join(', ')}
- Secondary Skills: ${capabilities.secondarySkills.join(', ')}  
- Domain Expertise: ${capabilities.domainExpertise.join(', ')}
- Task Types: ${capabilities.taskTypes.join(', ')}
- Complexity Handling: ${capabilities.complexityHandling}
- Collaboration Strengths: ${capabilities.collaborationStrengths.join(', ')}

CONVERSATION CONTEXT: ${context.length > 0 ? context.join(' | ') : 'None'}

Provide analysis in this format:

PRIMARY_SKILL_MATCH: [0-100 score] - How well primary skills match the request
SECONDARY_SKILL_MATCH: [0-100 score] - How well secondary skills support the task  
DOMAIN_EXPERTISE_MATCH: [0-100 score] - How relevant domain expertise is
TASK_TYPE_MATCH: [0-100 score] - How well this matches agent's typical tasks
OVERALL_MATCH: [0-100 score] - Overall suitability for this request
CONFIDENCE: [0-100 score] - Confidence in this analysis
ESTIMATED_PERFORMANCE: [0-100 score] - Expected performance quality

REASONING: [2-3 sentences explaining the match assessment]

COLLABORATION_POTENTIAL: [List of other agent types this agent would work well with]

RISK_FACTORS: [List potential issues or limitations for this task]
`;

    try {
      const response = await this.llm.generateResponse([{ 
        id: 'analysis-' + Date.now(), 
        role: 'user', 
        content: prompt,
        timestamp: new Date()
      }]);
      return this.parseSkillsAnalysisResponse(response.content, agent, capabilities);
    } catch (error) {
      console.error(`[🧠 AgentSkillsAnalyzer] ❌ LLM analysis failed for ${agent.name}:`, error);
      return this.createFallbackAnalysis(userRequest, agent, capabilities);
    }
  }

  /**
   * Parse LLM response into structured analysis
   */
  private parseSkillsAnalysisResponse(response: string, agent: Agent, capabilities: AgentCapabilities): SkillsMatchAnalysis {
    const lines = response.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    const scores = {
      primarySkillMatch: this.extractScore(response, 'PRIMARY_SKILL_MATCH') / 100,
      secondarySkillMatch: this.extractScore(response, 'SECONDARY_SKILL_MATCH') / 100,
      domainExpertiseMatch: this.extractScore(response, 'DOMAIN_EXPERTISE_MATCH') / 100,
      taskTypeMatch: this.extractScore(response, 'TASK_TYPE_MATCH') / 100
    };

    const overallMatch = this.extractScore(response, 'OVERALL_MATCH') / 100;
    const confidence = this.extractScore(response, 'CONFIDENCE') / 100;
    const estimatedPerformance = this.extractScore(response, 'ESTIMATED_PERFORMANCE') / 100;

    const reasoning = this.extractField(response, 'REASONING') || 'Analysis completed';
    const collaborationPotential = this.extractList(response, 'COLLABORATION_POTENTIAL');
    const riskFactors = this.extractList(response, 'RISK_FACTORS');

    return {
      agent,
      overallMatch,
      skillBreakdown: scores,
      reasoning,
      confidence,
      suitabilityRank: 0, // Will be set later
      collaborationPotential,
      estimatedPerformance,
      riskFactors
    };
  }

  /**
   * Create fallback analysis if LLM fails
   */
  private createFallbackAnalysis(userRequest: string, agent: Agent, capabilities: AgentCapabilities): SkillsMatchAnalysis {
    // Simple keyword-based fallback
    const requestLower = userRequest.toLowerCase();
    const allSkills = [...capabilities.primarySkills, ...capabilities.secondarySkills, ...capabilities.domainExpertise];
    
    const matchingSkills = allSkills.filter(skill => 
      requestLower.includes(skill.toLowerCase()) || 
      skill.toLowerCase().includes(requestLower.split(' ')[0])
    );

    const overallMatch = Math.min(0.8, matchingSkills.length / allSkills.length + 0.2);

    return {
      agent,
      overallMatch,
      skillBreakdown: {
        primarySkillMatch: overallMatch * 0.9,
        secondarySkillMatch: overallMatch * 0.7,
        domainExpertiseMatch: overallMatch * 0.8,
        taskTypeMatch: overallMatch * 0.6
      },
      reasoning: `Fallback analysis based on keyword matching. Found ${matchingSkills.length} matching skills.`,
      confidence: 0.6,
      suitabilityRank: 0,
      collaborationPotential: capabilities.collaborationStrengths,
      estimatedPerformance: overallMatch * 0.8,
      riskFactors: ['Analysis performed without LLM reasoning']
    };
  }

  /**
   * Detect collaboration opportunities between agents
   */
  async detectCollaborationOpportunities(
    userRequest: string,
    skillsAnalyses: SkillsMatchAnalysis[]
  ): Promise<CollaborationOpportunity[]> {
    console.log(`[🧠 AgentSkillsAnalyzer] 🤝 Detecting collaboration opportunities...`);

    const opportunities: CollaborationOpportunity[] = [];
    const topAgents = skillsAnalyses.slice(0, 4); // Consider top 4 agents

    // Analyze pairs and triplets for collaboration potential
    for (let i = 0; i < topAgents.length; i++) {
      for (let j = i + 1; j < topAgents.length; j++) {
        const pairOpportunity = await this.analyzeAgentPairCollaboration(
          userRequest, 
          [topAgents[i], topAgents[j]]
        );
        if (pairOpportunity.synergy > 0.6) {
          opportunities.push(pairOpportunity);
        }

        // Try triplets with high-synergy pairs
        if (pairOpportunity.synergy > 0.7 && j + 1 < topAgents.length) {
          const tripletOpportunity = await this.analyzeAgentPairCollaboration(
            userRequest,
            [topAgents[i], topAgents[j], topAgents[j + 1]]
          );
          if (tripletOpportunity.synergy > pairOpportunity.synergy) {
            opportunities.push(tripletOpportunity);
          }
        }
      }
    }

    // Sort by synergy score
    opportunities.sort((a, b) => b.synergy - a.synergy);

    console.log(`[🧠 AgentSkillsAnalyzer] 📊 Found ${opportunities.length} collaboration opportunities`);

    return opportunities;
  }

  /**
   * Analyze collaboration potential between specific agents
   */
  private async analyzeAgentPairCollaboration(
    userRequest: string,
    analyses: SkillsMatchAnalysis[]
  ): Promise<CollaborationOpportunity> {
    const agents = analyses.map(a => a.agent);
    const agentNames = agents.map(a => a.name).join(', ');

    const prompt = `
COLLABORATION ANALYSIS TASK

Analyze collaboration potential for this agent combination:

USER REQUEST: "${userRequest}"

AGENTS: ${agentNames}

INDIVIDUAL ANALYSES:
${analyses.map(a => `
${a.agent.name}:
- Overall Match: ${Math.round(a.overallMatch * 100)}%
- Strengths: ${a.collaborationPotential.join(', ')}  
- Performance: ${Math.round(a.estimatedPerformance * 100)}%
- Risks: ${a.riskFactors.join(', ')}
`).join('\n')}

Assess their collaboration potential:

SYNERGY_SCORE: [0-100] - How well these agents complement each other
SKILL_COMPLEMENTARITY: [0-100] - How their skills fill each other's gaps
COLLABORATION_PATTERN: [sequential|parallel|debate|review|specialist-lead] - Best working pattern
EXPECTED_OUTCOME: [Description of likely collaboration result]
REASONING: [Why this combination works well or doesn't]
RISK_LEVEL: [low|medium|high] - Overall collaboration risk
`;

    try {
      const response = await this.llm.generateResponse([{ 
        id: 'analysis-' + Date.now(), 
        role: 'user', 
        content: prompt,
        timestamp: new Date()
      }]);
      return this.parseCollaborationResponse(response.content, agents);
    } catch (error) {
      console.error(`[🧠 AgentSkillsAnalyzer] ❌ Collaboration analysis failed:`, error);
      return this.createFallbackCollaboration(agents, analyses);
    }
  }

  /**
   * Parse collaboration analysis response
   */
  private parseCollaborationResponse(response: string, agents: Agent[]): CollaborationOpportunity {
    const synergy = this.extractScore(response, 'SYNERGY_SCORE') / 100;
    const skillComplementarity = this.extractScore(response, 'SKILL_COMPLEMENTARITY') / 100;
    const pattern = this.extractField(response, 'COLLABORATION_PATTERN') as CollaborationOpportunity['collaborationPattern'] || 'sequential';
    const expectedOutcome = this.extractField(response, 'EXPECTED_OUTCOME') || 'Collaborative response';
    const reasoning = this.extractField(response, 'REASONING') || 'Collaboration analysis completed';
    const riskLevel = this.extractField(response, 'RISK_LEVEL') as CollaborationOpportunity['riskLevel'] || 'medium';

    return {
      agentCombination: agents,
      synergy,
      skillComplementarity,
      collaborationPattern: pattern,
      expectedOutcome,
      reasoning,
      riskLevel
    };
  }

  /**
   * Create fallback collaboration analysis
   */
  private createFallbackCollaboration(agents: Agent[], analyses: SkillsMatchAnalysis[]): CollaborationOpportunity {
    const avgMatch = analyses.reduce((sum, a) => sum + a.overallMatch, 0) / analyses.length;
    
    return {
      agentCombination: agents,
      synergy: Math.min(0.8, avgMatch * 1.2),
      skillComplementarity: avgMatch * 0.9,
      collaborationPattern: 'sequential',
      expectedOutcome: `Collaborative response from ${agents.map(a => a.name).join(' and ')}`,
      reasoning: 'Fallback collaboration analysis based on individual match scores',
      riskLevel: 'medium'
    };
  }

  /**
   * Get detailed capability report for an agent
   */
  getAgentCapabilityReport(agentName: string): AgentCapabilities | null {
    return this.agentCapabilities.get(agentName) || null;
  }

  /**
   * Get analysis history for learning and optimization
   */
  getAnalysisHistory(): Map<string, SkillsMatchAnalysis[]> {
    return new Map(this.analysisHistory);
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
    return match ? match[1].trim() : null;
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