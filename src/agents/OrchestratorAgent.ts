import { Agent } from './Agent.js';
import { ChatMessage, ToolDefinition, SmallTalkConfig } from '../types/index.js';
import { nanoid } from 'nanoid';

export interface AgentCapabilities {
  expertise: string[];
  tools: string[];
  personalityTraits: string[];
  taskTypes: string[];
  complexity: 'basic' | 'intermediate' | 'advanced' | 'expert';
  contextAwareness: number; // 0-1, how well agent maintains context
  collaborationStyle: 'independent' | 'collaborative' | 'supportive' | 'leading';
}

export interface HandoffDecision {
  targetAgent: string;
  reason: string;
  confidence: number;
  contextToTransfer: Record<string, any>;
  expectedOutcome: string;
  fallbackAgent?: string;
}

export interface ConversationContext {
  currentTopic: string;
  userIntent: string;
  complexity: number;
  emotionalTone: string;
  taskProgress: number;
  previousAgents: string[];
  userSatisfaction: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}


export class OrchestratorAgent extends Agent {
  private agentRegistry: Map<string, { agent: Agent; capabilities: AgentCapabilities }> = new Map();
  private conversationHistory: Map<string, ConversationContext> = new Map();
  private handoffRules: Array<{
    condition: (context: ConversationContext, message: string) => boolean;
    targetAgent: string;
    priority: number;
  }> = [];

  constructor(config: SmallTalkConfig & Partial<import('../types/index.js').AgentConfig> = {}) {
    // Compose AgentConfig using SmallTalkConfig as base
    const agentConfig = {
      name: 'Orchestrator',
      personality:
        'I am the Orchestrator, an intelligent routing system that decides which agent should handle each interaction. My goal is to analyze user messages, route conversations to the most suitable agent, and manage handoffs smoothly to optimize the conversation flow and user satisfaction.',
      systemPrompt: undefined,
      expertise: [],
      ...config
    };
    super(agentConfig);

    const orchestratorTools: ToolDefinition[] = [
      {
        name: 'analyzeUserIntent',
        description: 'Analyze user message to determine intent and requirements',
        parameters: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'User message to analyze' },
            context: { type: 'object', description: 'Conversation context' }
          },
          required: ['message']
        },
        handler: this.analyzeUserIntent.bind(this)
      },
      {
        name: 'selectBestAgent',
        description: 'Select the most suitable agent for a task',
        parameters: {
          type: 'object',
          properties: {
            intent: { type: 'string', description: 'User intent' },
            complexity: { type: 'number', description: 'Task complexity 0-1' },
            topic: { type: 'string', description: 'Conversation topic' },
            urgency: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] }
          },
          required: ['intent', 'topic']
        },
        handler: this.selectBestAgent.bind(this)
      },
      {
        name: 'createHandoffPlan',
        description: 'Create a plan for handing off to another agent',
        parameters: {
          type: 'object',
          properties: {
            targetAgent: { type: 'string', description: 'Target agent name' },
            context: { type: 'object', description: 'Context to transfer' },
            reason: { type: 'string', description: 'Reason for handoff' }
          },
          required: ['targetAgent', 'reason']
        },
        handler: this.createHandoffPlan.bind(this)
      },
      {
        name: 'evaluateAgentPerformance',
        description: 'Evaluate how well an agent handled a task',
        parameters: {
          type: 'object',
          properties: {
            agentName: { type: 'string', description: 'Agent name' },
            taskResult: { type: 'object', description: 'Task completion data' },
            userFeedback: { type: 'object', description: 'User satisfaction data' }
          },
          required: ['agentName']
        },
        handler: this.evaluateAgentPerformance.bind(this)
      }
    ];

    orchestratorTools.forEach(tool => this.addTool(tool));
  }

  // Register an agent with the orchestrator
  public registerAgent(agent: Agent, capabilities: AgentCapabilities): void {
    this.agentRegistry.set(agent.name, { agent, capabilities });
    console.log(`[Orchestrator] Registered agent: ${agent.name} with expertise: ${capabilities.expertise.join(', ')}`);
  }

  // Main orchestration method - decides which agent should handle the message
  public async orchestrate(
    message: string, 
    userId: string,
    currentAgent?: string
  ): Promise<HandoffDecision | null> {
    try {
      // Get or create conversation context
      const context = this.getConversationContext(userId);
      
      // Analyze the user's message
      const intent = await this.analyzeUserIntent({ message, context });
      
      // Update conversation context
      this.updateConversationContext(userId, intent, message);
      
      // Determine if we need to switch agents
      const needsHandoff = await this.shouldHandoff(intent, context, currentAgent);
      
      if (!needsHandoff) {
        return null; // Stay with current agent
      }
      
      // Select the best agent for this task
      const bestAgent = await this.selectBestAgent({
        intent: intent.primaryIntent,
        complexity: intent.complexity,
        topic: intent.topic,
        urgency: intent.urgency
      });
      
      // Create handoff plan
      const handoffPlan = await this.createHandoffPlan({
        targetAgent: bestAgent.agentName,
        context: {
          userIntent: intent,
          conversationContext: context,
          transferReason: bestAgent.reason
        },
        reason: bestAgent.reason
      });
      
      // Log the decision
      console.log(`[Orchestrator] Routing to ${bestAgent.agentName}: ${bestAgent.reason}`);
      
      return handoffPlan;
      
    } catch (error) {
      console.error('[Orchestrator] Error during orchestration:', error);
      return null; // Fallback to current agent
    }
  }

  // Add a custom handoff rule
  public addHandoffRule(
    condition: (context: ConversationContext, message: string) => boolean,
    targetAgent: string,
    priority: number = 0
  ): void {
    this.handoffRules.push({ condition, targetAgent, priority });
    this.handoffRules.sort((a, b) => b.priority - a.priority); // Sort by priority
  }

  // Get available agents and their capabilities
  public getAvailableAgents(): Array<{ name: string; capabilities: AgentCapabilities }> {
    return Array.from(this.agentRegistry.entries()).map(([name, data]) => ({
      name,
      capabilities: data.capabilities
    }));
  }

  // Analyze user intent using NLP and context
  protected async analyzeUserIntent(params: Record<string, unknown>): Promise<{
    primaryIntent: string;
    secondaryIntents: string[];
    topic: string;
    complexity: number;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    emotionalTone: string;
    taskType: 'question' | 'request' | 'conversation' | 'problem' | 'creative';
    requiredExpertise: string[];
  }> {
    const { message, context } = params as { message: string; context?: ConversationContext };
    // Keyword analysis for intent detection
    const intents = this.detectIntents(message);
    const topic = this.extractTopic(message, context);
    const complexity = this.assessComplexity(message, topic);
    const urgency = this.assessUrgency(message);
    const emotionalTone = this.detectEmotionalTone(message);
    const taskType = this.classifyTaskType(message);
    const requiredExpertise = this.identifyRequiredExpertise(message, topic);

    return {
      primaryIntent: intents[0] || 'general_conversation',
      secondaryIntents: intents.slice(1),
      topic,
      complexity,
      urgency,
      emotionalTone,
      taskType,
      requiredExpertise
    };
  }

  // Select the best agent using sophisticated orchestration intelligence
  protected async selectBestAgent(params: Record<string, unknown>): Promise<{
    agentName: string;
    reason: string;
    confidence: number;
    fallback?: string;
    collaborationPlan?: {
      sequence: Array<{agent: string; role: string; objective: string}>;
      expectedFlow: string;
    };
  }> {
    const { intent, complexity, topic, urgency, originalMessage, userId = 'default' } = params as {
      intent: string;
      complexity?: number;
      topic: string;
      urgency?: string;
      originalMessage?: string;
      userId?: string;
    };
    
    console.log(`[Orchestrator] 🧠 SOPHISTICATED ORCHESTRATION ANALYSIS STARTING...`);
    
    // Check for direct agent requests first (high confidence routing)
    if (originalMessage) {
      const directAgentRequest = this.detectDirectAgentRequest(originalMessage);
      if (directAgentRequest) {
        console.log(`[Orchestrator] 🎯 DIRECT AGENT REQUEST DETECTED: ${directAgentRequest}`);
        return {
          agentName: directAgentRequest,
          reason: `Direct request for ${directAgentRequest} agent`,
          confidence: 0.95
        };
      }
    }
    
    // Get conversation context and history  
    const conversationContext = this.getConversationContext(userId);
    
    const availableAgents = this.getAvailableAgents();
    
    let bestAgent: { name: string; score: number; breakdown: any } | null = null;
    let maxScore = -1;
    let allScores: Array<{ name: string; score: number; breakdown: any }> = [];
    
    console.log(`[Orchestrator] 🎯 Analyzing ${availableAgents.length} agents for query: "${topic}" (intent: "${intent}")`);
    
    for (const { name, capabilities } of availableAgents) {
      let score = 0;
      let breakdown = {
        expertise: 0,
        complexity: 0,
        taskType: 0,
        tools: 0,
        context: 0,
        total: 0
      };
      
      // Expertise match (40% weight) - Enhanced scoring
      const expertiseMatch = this.calculateExpertiseMatch(capabilities.expertise, topic, intent);
      const expertiseScore = expertiseMatch * 0.4;
      score += expertiseScore;
      breakdown.expertise = expertiseScore;
      
      // Complexity match (25% weight)
      const complexityMatch = this.calculateComplexityMatch(capabilities.complexity, complexity || 0.5);
      const complexityScore = complexityMatch * 0.25;
      score += complexityScore;
      breakdown.complexity = complexityScore;
      
      // Task type match (20% weight) - Enhanced matching
      const taskTypeMatch = this.calculateTaskTypeMatch(capabilities.taskTypes, intent, topic);
      const taskTypeScore = taskTypeMatch * 0.2;
      score += taskTypeScore;
      breakdown.taskType = taskTypeScore;
      
      // Tool availability (10% weight)
      const toolMatch = this.calculateToolMatch(capabilities.tools, intent, topic);
      const toolScore = toolMatch * 0.1;
      score += toolScore;
      breakdown.tools = toolScore;
      
      // Context awareness (5% weight)
      const contextScore = capabilities.contextAwareness * 0.05;
      score += contextScore;
      breakdown.context = contextScore;
      
      breakdown.total = score;
      
      // Log detailed breakdown for each agent
      console.log(`[Orchestrator] 📊 ${name}: Total=${(score*100).toFixed(1)}% | Expertise=${(breakdown.expertise*100).toFixed(1)}% | Complexity=${(breakdown.complexity*100).toFixed(1)}% | TaskType=${(breakdown.taskType*100).toFixed(1)}% | Tools=${(breakdown.tools*100).toFixed(1)}%`);
      
      const matchDetails = (this as any)._lastMatchDetails || [];
      if (matchDetails.length > 0) {
        console.log(`[Orchestrator] 🔍 ${name} expertise matches: [${matchDetails.join(', ')}]`);
      }
      
      allScores.push({ name, score, breakdown });
      
      if (score > maxScore) {
        maxScore = score;
        bestAgent = { name, score, breakdown };
      }
    }
    
    if (!bestAgent) {
      throw new Error('No suitable agent found');
    }
    
    // Show top 3 candidates for transparency
    const topCandidates = allScores
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
      
    console.log(`[Orchestrator] 🏆 Top candidates:`);
    topCandidates.forEach((candidate, index) => {
      const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
      console.log(`[Orchestrator] ${rank} ${candidate.name}: ${(candidate.score*100).toFixed(1)}% confidence`);
    });
    
    const fallbackAgent = this.findFallbackAgent(bestAgent.name);
    
    // Normalize confidence to a more realistic range (30-95%)
    const normalizedConfidence = 0.3 + (maxScore * 0.65);

    const result: { agentName: string; reason: string; confidence: number; fallback?: string } = {
      agentName: bestAgent.name,
      reason: this.generateEnhancedSelectionReason(bestAgent.name, normalizedConfidence, intent, topic, bestAgent.breakdown),
      confidence: normalizedConfidence,
    };
    if (fallbackAgent) {
      result.fallback = fallbackAgent;
    }
    return result;
  }

  private calculateTaskTypeMatch(agentTaskTypes: string[], intent: string, topic: string): number {
    let match = 0;
    const searchText = `${intent} ${topic}`.toLowerCase();
    
    // Enhanced task type matching
    const taskTypeKeywords = {
      'strategy': ['strategy', 'strategic', 'planning', 'vision', 'direction', 'leadership'],
      'technical': ['technical', 'tech', 'development', 'architecture', 'implementation'],
      'creative': ['creative', 'design', 'content', 'writing', 'innovative', 'brainstorm'],
      'analysis': ['analysis', 'analyze', 'research', 'data', 'insights', 'evaluation'],
      'sales': ['sales', 'selling', 'revenue', 'customer', 'leads', 'conversion'],
      'marketing': ['marketing', 'branding', 'promotion', 'advertising', 'campaign'],
      'financial': ['financial', 'budget', 'cost', 'roi', 'investment', 'money'],
      'planning': ['planning', 'project', 'timeline', 'coordination', 'management'],
      'conversation': ['chat', 'talk', 'discuss', 'conversation', 'general'],
      'problem': ['problem', 'issue', 'fix', 'solve', 'troubleshoot', 'debug']
    };
    
    for (const taskType of agentTaskTypes) {
      const keywords = taskTypeKeywords[taskType.toLowerCase()] || [taskType.toLowerCase()];
      
      // Check for keyword matches in search text
      const matchCount = keywords.filter(keyword => searchText.includes(keyword)).length;
      
      if (matchCount > 0) {
        match += (matchCount / keywords.length); // Partial match based on keyword coverage
      }
    }
    
    return Math.min(match, 1.0);
  }

  // Create a detailed handoff plan
  protected async createHandoffPlan(params: Record<string, unknown>): Promise<HandoffDecision> {
    const { targetAgent, context, reason } = params as {
      targetAgent: string;
      context: Record<string, any>;
      reason: string;
    };
    const handoffContext = {
      ...context,
      handoffTime: new Date().toISOString(),
      orchestratorId: this.name,
    };
    
    const decision: HandoffDecision = {
      targetAgent,
      reason,
      confidence: 1, // Placeholder
      contextToTransfer: handoffContext,
      expectedOutcome: this.predictOutcome(targetAgent, context),
    };

    const fallbackAgent = this.findFallbackAgent(targetAgent);
    if (fallbackAgent) {
      decision.fallbackAgent = fallbackAgent;
    }
    
    return decision;
  }

  // Evaluate agent performance for learning
  private async evaluateAgentPerformance(params: Record<string, unknown>): Promise<{
    performance: number;
    recommendations: string[];
    shouldAdjustRouting: boolean;
  }> {
    const { agentName, taskResult, userFeedback } = params as {
      agentName: string;
      taskResult?: any;
      userFeedback?: any;
    };
    const performance = this.calculatePerformanceScore(taskResult, userFeedback);
    const recommendations = this.generateRecommendations(agentName, performance);
    
    return {
      performance,
      recommendations,
      shouldAdjustRouting: performance < 0.7
    };
  }

  // Helper methods for intent analysis
  private detectIntents(message: string): string[] {
    const message_lower = message.toLowerCase();
    const intents: string[] = [];
    
    // Intent patterns
    const patterns = {
      'question': /\b(what|how|why|when|where|who|can you|could you|would you|do you know)\b/,
      'help_request': /\b(help|assist|support|guide|show me|teach me)\b/,
      'problem_solving': /\b(problem|issue|error|bug|fix|solve|troubleshoot)\b/,
      'creative_task': /\b(create|generate|write|design|build|make)\b/,
      'analysis': /\b(analyze|review|examine|evaluate|assess|compare)\b/,
      'explanation': /\b(explain|describe|clarify|elaborate|detail)\b/,
      'conversation': /\b(chat|talk|discuss|conversation|hello|hi)\b/,
      'learning': /\b(learn|study|practice|understand|master)\b/,
      'correction': /\b(correct|fix|improve|better|wrong|mistake)\b/
    };
    
    for (const [intent, pattern] of Object.entries(patterns)) {
      if (pattern.test(message_lower)) {
        intents.push(intent);
      }
    }
    
    return intents.length > 0 ? intents : ['general_conversation'];
  }

  private extractTopic(message: string, context?: ConversationContext): string {
    // Simple keyword extraction - could be enhanced with NLP
    const topics = {
      'programming': /\b(code|programming|software|development|javascript|python|typescript|react|node)\b/i,
      'language_learning': /\b(grammar|language|english|spanish|french|pronunciation|vocabulary)\b/i,
      'medical': /\b(medical|health|doctor|patient|diagnosis|treatment|symptoms)\b/i,
      'business': /\b(business|strategy|marketing|sales|finance|management|meeting)\b/i,
      'education': /\b(education|teaching|learning|student|course|lesson|study)\b/i,
      'science': /\b(science|research|experiment|hypothesis|data|analysis)\b/i,
      'technology': /\b(technology|tech|AI|machine learning|database|API|system)\b/i
    };
    
    for (const [topic, pattern] of Object.entries(topics)) {
      if (pattern.test(message)) {
        return topic;
      }
    }
    
    return context?.currentTopic || 'general';
  }

  private assessComplexity(message: string, topic: string): number {
    // Word count and sentence complexity
    const wordCount = message.split(/\s+/).length;
    const sentenceCount = (message.match(/[.!?]+/g) || []).length + 1;
    const complexityScore = wordCount / sentenceCount;

    // Jargon and technical terms
    const jargon = ['API', 'database', 'frontend', 'backend', 'deployment'];
    const jargonCount = jargon.filter(j => message.includes(j)).length;

    // Topic-based complexity
    const topicComplexity: { [key: string]: number } = {
      'technical_support': 0.7,
      'billing': 0.4,
      'sales': 0.3,
      'general_inquiry': 0.2
    };
    const topicMod = topicComplexity[topic] || 0.5;

    return Math.min(1, (complexityScore / 20) + (jargonCount * 0.1) + topicMod);
  }

  private assessUrgency(message: string): 'low' | 'medium' | 'high' | 'critical' {
    const message_lower = message.toLowerCase();
    
    if (/\b(urgent|emergency|critical|asap|immediately|now)\b/.test(message_lower)) {
      return 'critical';
    }
    if (/\b(quick|fast|soon|hurry|deadline)\b/.test(message_lower)) {
      return 'high';
    }
    if (/\b(when you can|later|sometime|eventually)\b/.test(message_lower)) {
      return 'low';
    }
    
    return 'medium';
  }

  private detectEmotionalTone(message: string): string {
    const message_lower = message.toLowerCase();
    
    const patterns = {
      'frustrated': /\b(frustrated|annoyed|stuck|confused|lost)\b/,
      'excited': /\b(excited|awesome|amazing|love|great)\b/,
      'worried': /\b(worried|concerned|anxious|nervous)\b/,
      'confident': /\b(confident|sure|certain|know)\b/,
      'curious': /\b(curious|interested|wonder|explore)\b/
    };
    
    for (const [tone, pattern] of Object.entries(patterns)) {
      if (pattern.test(message_lower)) {
        return tone;
      }
    }
    
    return 'neutral';
  }

  private classifyTaskType(message: string): 'question' | 'request' | 'conversation' | 'problem' | 'creative' {
    const message_lower = message.toLowerCase();
    
    if (/\?/.test(message) || /\b(what|how|why|when|where)\b/.test(message_lower)) {
      return 'question';
    }
    if (/\b(create|generate|write|design|build)\b/.test(message_lower)) {
      return 'creative';
    }
    if (/\b(problem|issue|error|fix|solve)\b/.test(message_lower)) {
      return 'problem';
    }
    if (/\b(please|can you|could you|would you)\b/.test(message_lower)) {
      return 'request';
    }
    
    return 'conversation';
  }

  private identifyRequiredExpertise(message: string, topic: string): string[] {
    const expertise: string[] = [];
    const lowerMessage = message.toLowerCase();
    
    // Leadership/executive patterns - override topic-based matching
    const leadershipPatterns = [
      'what does the ceo',
      'ceo opinion',
      'ceo perspective',
      'chief executive',
      'company leader',
      'leadership view',
      'executive opinion',
      'company vision',
      'company direction'
    ];
    
    for (const pattern of leadershipPatterns) {
      if (lowerMessage.includes(pattern)) {
        expertise.push('leadership', 'strategy', 'vision', 'executive');
        console.log(`[Orchestrator] 🎯 Leadership expertise detected: "${pattern}"`);
        return expertise; // Return early for leadership queries
      }
    }
    
    // Topic-based expertise
    const topicExpertise: Record<string, string[]> = {
      'programming': ['software development', 'coding', 'debugging'],
      'language_learning': ['linguistics', 'education', 'language pedagogy'],
      'medical': ['healthcare', 'medicine', 'patient care'],
      'business': ['strategy', 'management', 'finance'],
      'education': ['teaching', 'pedagogy', 'curriculum'],
      'science': ['research', 'analysis', 'methodology']
    };
    
    if (topicExpertise[topic]) {
      expertise.push(...topicExpertise[topic]);
    }
    
    // Skill-based expertise from message content
    const skillPatterns = {
      'writing': /\b(write|writing|author|content|copywriting)\b/i,
      'analysis': /\b(analyze|analysis|review|evaluate|assess)\b/i,
      'teaching': /\b(teach|explain|educate|guide|mentor)\b/i,
      'problem-solving': /\b(solve|fix|troubleshoot|debug|resolve)\b/i
    };
    
    for (const [skill, pattern] of Object.entries(skillPatterns)) {
      if (pattern.test(message)) {
        expertise.push(skill);
      }
    }
    
    return [...new Set(expertise)]; // Remove duplicates
  }

  // Helper methods for agent selection
  private calculateExpertiseMatch(agentExpertise: string[], topic: string, intent: string): number {
    let match = 0;
    let matchDetails: string[] = [];
    
    // Enhanced topic matching with semantic similarity
    const topicLower = topic.toLowerCase();
    const intentLower = intent.toLowerCase();
    
    // Direct expertise matches (highest weight)
    for (const expertise of agentExpertise) {
      const expLower = expertise.toLowerCase();
      
      // Exact match
      if (expLower === topicLower || expLower === intentLower) {
        match += 1.0;
        matchDetails.push(`exact:${expertise}`);
        continue;
      }
      
      // Contains match  
      if (expLower.includes(topicLower) || topicLower.includes(expLower)) {
        match += 0.8;
        matchDetails.push(`contains:${expertise}→${topic}`);
        continue;
      }
      
      if (expLower.includes(intentLower) || intentLower.includes(expLower)) {
        match += 0.7;
        matchDetails.push(`contains:${expertise}→${intent}`);
        continue;
      }
    }
    
    // Semantic word overlap (medium weight)
    const topicWords = this.extractMeaningfulWords(topic);
    const intentWords = this.extractMeaningfulWords(intent);
    const searchWords = [...topicWords, ...intentWords];
    
    for (const expertise of agentExpertise) {
      const expWords = this.extractMeaningfulWords(expertise);
      
      for (const searchWord of searchWords) {
        for (const expWord of expWords) {
          // Exact word match
          if (searchWord === expWord) {
            match += 0.3;
            matchDetails.push(`word:${searchWord}`);
          }
          // Root word similarity (basic stemming)
          else if (this.areSimilarWords(searchWord, expWord)) {
            match += 0.2;
            matchDetails.push(`similar:${searchWord}~${expWord}`);
          }
        }
      }
    }
    
    // Domain-specific expertise mapping
    const domainScore = this.calculateDomainExpertiseMatch(agentExpertise, topic, intent);
    match += domainScore;
    
    if (domainScore > 0) {
      matchDetails.push(`domain:${domainScore.toFixed(2)}`);
    }
    
    // Store match details for detailed logging
    (this as any)._lastMatchDetails = matchDetails;
    
    return Math.min(match, 1.0);
  }

  private extractMeaningfulWords(text: string): string[] {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being']);
    return text.toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
  }
  
  private areSimilarWords(word1: string, word2: string): boolean {
    // Basic similarity checks for business terms
    const similarities = [
      ['tech', 'technology', 'technical'],
      ['market', 'marketing', 'markets'],  
      ['business', 'biz', 'commercial'],
      ['strategy', 'strategic', 'strategies'],
      ['finance', 'financial', 'money', 'budget'],
      ['research', 'analysis', 'study'],
      ['project', 'projects', 'planning'],
      ['sales', 'selling', 'revenue'],
      ['development', 'dev', 'build', 'create']
    ];
    
    for (const group of similarities) {
      if (group.includes(word1) && group.includes(word2)) {
        return true;
      }
    }
    
    // Prefix matching for technical terms
    if (word1.length > 4 && word2.length > 4) {
      const prefix = Math.min(word1.length, word2.length, 5);
      return word1.substring(0, prefix) === word2.substring(0, prefix);
    }
    
    return false;
  }
  
  private calculateDomainExpertiseMatch(agentExpertise: string[], topic: string, intent: string): number {
    // Domain expertise mapping for business contexts
    const domainMappings = {
      'technology': ['technical', 'development', 'architecture', 'coding', 'systems', 'software'],
      'marketing': ['branding', 'campaigns', 'promotion', 'advertising', 'content', 'digital'],
      'finance': ['budget', 'cost', 'revenue', 'profit', 'investment', 'roi', 'financial'],
      'strategy': ['planning', 'vision', 'leadership', 'direction', 'goals', 'executive'],
      'research': ['analysis', 'data', 'insights', 'competitive', 'market', 'trends'],
      'project': ['management', 'coordination', 'timeline', 'resources', 'planning', 'execution'],
      'sales': ['customer', 'revenue', 'leads', 'conversion', 'pipeline', 'negotiation']
    };
    
    const textToAnalyze = `${topic} ${intent}`.toLowerCase();
    let domainScore = 0;
    
    for (const [domain, keywords] of Object.entries(domainMappings)) {
      // Check if agent has expertise in this domain
      const hasExpertise = agentExpertise.some(exp => 
        exp.toLowerCase().includes(domain) || 
        keywords.some(keyword => exp.toLowerCase().includes(keyword))
      );
      
      if (hasExpertise) {
        // Check if the user query relates to this domain
        const queryRelevance = keywords.filter(keyword => 
          textToAnalyze.includes(keyword)
        ).length;
        
        if (queryRelevance > 0) {
          domainScore += (queryRelevance / keywords.length) * 0.4; // Max 0.4 per domain
        }
      }
    }
    
    return Math.min(domainScore, 0.6); // Cap domain bonus at 0.6
  }

  private calculateComplexityMatch(agentComplexity: 'basic' | 'intermediate' | 'advanced' | 'expert', taskComplexity: number): number {
    const complexityMap: { [key: string]: number } = {
      basic: 0.25,
      intermediate: 0.5,
      advanced: 0.75,
      expert: 1.0,
    };
    const agentScore = complexityMap[agentComplexity] || 0.5;
    return 1 - Math.abs(agentScore - taskComplexity);
  }

  private calculateToolMatch(agentTools: string[] | undefined, intent: string, topic: string): number {
    if (!agentTools || agentTools.length === 0) return 0.5; // Neutral if no tools
    
    let match = 0;
    const searchTerms = [intent, topic].join(' ').toLowerCase();
    
    for (const tool of agentTools) {
      if (searchTerms.includes(tool.toLowerCase())) {
        match += 0.3;
      }
    }
    
    return Math.min(match, 1.0);
  }

  private generateSelectionReason(agentName: string, score: number, intent: string, topic: string): string {
    const agentData = this.agentRegistry.get(agentName);
    if (!agentData) return `Selected ${agentName}`;
    
    const { capabilities } = agentData;
    const matchedExpertise = capabilities.expertise.filter(exp => 
      topic.toLowerCase().includes(exp.toLowerCase()) || 
      intent.toLowerCase().includes(exp.toLowerCase())
    );
    
    if (matchedExpertise.length > 0) {
      return `${agentName} is the best match with expertise in ${matchedExpertise.join(', ')} (confidence: ${(score * 100).toFixed(0)}%)`;
    }
    
    return `${agentName} is well-suited for ${topic} tasks (confidence: ${(score * 100).toFixed(0)}%)`;
  }

  private generateEnhancedSelectionReason(
    agentName: string, 
    confidence: number, 
    intent: string, 
    topic: string, 
    breakdown: any
  ): string {
    const agentData = this.agentRegistry.get(agentName);
    if (!agentData) return `Selected ${agentName}`;
    
    const { capabilities } = agentData;
    const matchedExpertise = capabilities.expertise.filter(exp => 
      topic.toLowerCase().includes(exp.toLowerCase()) || 
      intent.toLowerCase().includes(exp.toLowerCase())
    );
    
    let reason = `🎯 Selected ${agentName} for "${topic}" task`;
    
    // Add expertise details
    if (matchedExpertise.length > 0) {
      reason += ` | Expertise: ${matchedExpertise.join(', ')}`;
    }
    
    // Add confidence and breakdown
    reason += ` | Confidence: ${(confidence * 100).toFixed(0)}%`;
    
    // Add breakdown details for high-confidence selections
    if (confidence > 0.7) {
      const topScores = Object.entries(breakdown)
        .filter(([key, value]) => key !== 'total' && (value as number) > 0.1)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 2)
        .map(([key, value]) => `${key}:${((value as number) * 100).toFixed(0)}%`);
      
      if (topScores.length > 0) {
        reason += ` | Strong in: ${topScores.join(', ')}`;
      }
    }
    
    return reason;
  }

  // Conversation context management
  protected getConversationContext(userId: string): ConversationContext {
    if (!this.conversationHistory.has(userId)) {
      this.conversationHistory.set(userId, {
        currentTopic: 'general',
        userIntent: 'conversation',
        complexity: 0.5,
        emotionalTone: 'neutral',
        taskProgress: 0,
        previousAgents: [],
        userSatisfaction: 0.8,
        urgency: 'medium'
      });
    }
    
    return this.conversationHistory.get(userId)!;
  }

  protected updateConversationContext(userId: string, intent: any, message: string): void {
    const context = this.getConversationContext(userId);
    
    context.currentTopic = intent.topic;
    context.userIntent = intent.primaryIntent;
    context.complexity = intent.complexity;
    context.emotionalTone = intent.emotionalTone;
    context.urgency = intent.urgency;
    
    this.conversationHistory.set(userId, context);
  }

  protected async shouldHandoff(intent: any, context: ConversationContext, currentAgent?: string): Promise<boolean> {
    // Check custom handoff rules first
    for (const rule of this.handoffRules) {
      if (rule.condition(context, intent.primaryIntent)) {
        return rule.targetAgent !== currentAgent;
      }
    }
    
    // No current agent means we need to select one
    if (!currentAgent) return true;
    
    // Check if current agent is still suitable
    const currentAgentData = this.agentRegistry.get(currentAgent);
    if (!currentAgentData) return true;
    
    const { capabilities } = currentAgentData;
    
    // Topic change requiring different expertise
    const topicMatch = capabilities.expertise.some(exp => 
      intent.topic.toLowerCase().includes(exp.toLowerCase())
    );
    
    if (!topicMatch && intent.topic !== 'general') return true;
    
    // Complexity mismatch
    const complexityLevels = { 'basic': 0.25, 'intermediate': 0.5, 'advanced': 0.75, 'expert': 1.0 };
    const agentComplexity = complexityLevels[capabilities.complexity] || 0.5;
    const complexityDiff = Math.abs(agentComplexity - intent.complexity);
    
    if (complexityDiff > 0.3) return true;
    
    // User satisfaction too low
    if (context.userSatisfaction < 0.6) return true;
    
    return false; // Stay with current agent
  }

  private predictOutcome(targetAgent: string, context: any): string {
    const agentData = this.agentRegistry.get(targetAgent);
    if (!agentData) return 'Unknown outcome';
    
    const { capabilities } = agentData;
    
    if (capabilities.taskTypes.includes('problem')) {
      return 'Problem resolution and detailed solution';
    }
    if (capabilities.taskTypes.includes('creative')) {
      return 'Creative output and innovative ideas';
    }
    if (capabilities.taskTypes.includes('educational')) {
      return 'Educational guidance and skill development';
    }
    
    return 'Expert assistance and personalized response';
  }

  private findFallbackAgent(targetAgent: string): string | undefined {
    // Find the most general agent as fallback
    const agents = Array.from(this.agentRegistry.entries());
    
    const generalAgent = agents.find(([name, data]) => 
      name !== targetAgent && 
      data.capabilities.expertise.includes('general') ||
      data.capabilities.taskTypes.includes('conversation')
    );
    
    return generalAgent?.[0];
  }

  private calculatePerformanceScore(taskResult: any, userFeedback: any): number {
    // Simple performance calculation - could be much more sophisticated
    let score = 0.7; // Base score
    
    if (taskResult?.completed) score += 0.2;
    if (userFeedback?.satisfied) score += 0.1;
    if (taskResult?.quality === 'high') score += 0.1;
    
    return Math.min(score, 1.0);
  }

  private generateRecommendations(agentName: string, performance: number): string[] {
    const recommendations: string[] = [];
    
    if (performance < 0.5) {
      recommendations.push(`Consider retraining ${agentName} or updating their expertise`);
      recommendations.push('Review agent personality and communication style');
    }
    
    if (performance < 0.7) {
      recommendations.push('Monitor future interactions closely');
      recommendations.push('Consider providing additional tools or context');
    }
    
    return recommendations;
  }
  
  // Detect direct agent requests in user messages
  private detectDirectAgentRequest(message: string): string | null {
    const lowerMessage = message.toLowerCase();
    const availableAgents = this.getAvailableAgents();
    
    // Check for explicit agent mentions
    for (const { name } of availableAgents) {
      const agentLower = name.toLowerCase();
      
      // Direct name mention patterns
      const directPatterns = [
        `what does ${agentLower} have to say`,
        `what does the ${agentLower} have to say`,
        `ask ${agentLower}`,
        `ask the ${agentLower}`,
        `${agentLower} what do you think`,
        `${agentLower},`,
        `hey ${agentLower}`,
        `${agentLower} please`,
        `can ${agentLower}`,
        `could ${agentLower}`,
        `would ${agentLower}`,
        `${agentLower}:`
      ];
      
      for (const pattern of directPatterns) {
        if (lowerMessage.includes(pattern)) {
          console.log(`[Orchestrator] 🎯 Found direct pattern: "${pattern}" → ${name}`);
          return name;
        }
      }
      
      // Role-based patterns (CEO, Marketing, Tech, etc.)
      const rolePatterns = this.getRolePatternsForAgent(name);
      for (const rolePattern of rolePatterns) {
        if (lowerMessage.includes(rolePattern)) {
          console.log(`[Orchestrator] 🎯 Found role pattern: "${rolePattern}" → ${name}`);
          return name;
        }
      }
    }
    
    return null;
  }
  
  // Get role-based patterns for each agent type
  private getRolePatternsForAgent(agentName: string): string[] {
    const patterns: Record<string, string[]> = {
      'CEO': [
        'what does the ceo',
        'ceo opinion',
        'ceo perspective',
        'chief executive',
        'company leader',
        'ask the ceo',
        'ceo says',
        'ceo thinks'
      ],
      'MarketingLead': [
        'marketing team',
        'marketing lead',
        'marketing perspective',
        'marketing opinion',
        'ask marketing',
        'marketing says'
      ],
      'TechLead': [
        'tech lead',
        'technical lead',
        'tech team',
        'technical perspective',
        'ask tech',
        'tech says'
      ],
      'SalesChief': [
        'sales team',
        'sales lead',
        'sales chief',
        'sales perspective',
        'ask sales',
        'sales says'
      ],
      'ResearchPro': [
        'research team',
        'researcher',
        'research perspective',
        'ask research',
        'research says'
      ],
      'ProjectManager': [
        'project manager',
        'pm',
        'project lead',
        'project perspective',
        'ask pm',
        'project says'
      ],
      'FinanceAdvisor': [
        'finance team',
        'finance advisor',
        'financial perspective',
        'ask finance',
        'finance says'
      ]
    };
    
    return patterns[agentName] || [];
  }
}