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
  private async analyzeUserIntent(params: Record<string, unknown>): Promise<{
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

  // Select the best agent based on requirements
  private async selectBestAgent(params: Record<string, unknown>): Promise<{
    agentName: string;
    reason: string;
    confidence: number;
    fallback?: string;
  }> {
    const { intent, complexity, topic, urgency } = params as {
      intent: string;
      complexity?: number;
      topic: string;
      urgency?: string;
    };
    const availableAgents = this.getAvailableAgents();
    let bestAgent: { name: string; score: number } | null = null;
    let maxScore = -1;
    
    for (const { name, capabilities } of availableAgents) {
      let score = 0;
      
      // Expertise match (40% weight)
      const expertiseMatch = this.calculateExpertiseMatch(capabilities.expertise, topic, intent);
      score += expertiseMatch * 0.4;
      
      // Complexity match (25% weight)
      const complexityMatch = this.calculateComplexityMatch(capabilities.complexity, complexity || 0.5);
      score += complexityMatch * 0.25;
      
      // Task type match (20% weight)
      const taskTypeMatch = capabilities.taskTypes.some(type => 
        intent.includes(type) || topic.includes(type)
      ) ? 1 : 0;
      score += taskTypeMatch * 0.2;
      
      // Tool availability (10% weight)
      const toolMatch = this.calculateToolMatch(capabilities.tools, intent, topic);
      score += toolMatch * 0.1;
      
      // Context awareness (5% weight)
      score += capabilities.contextAwareness * 0.05;
      
      if (score > maxScore) {
        maxScore = score;
        bestAgent = { name, score };
      }
    }
    
    if (!bestAgent) {
      throw new Error('No suitable agent found');
    }
    
    const fallbackAgent = this.findFallbackAgent(bestAgent.name);

    const result: { agentName: string; reason: string; confidence: number; fallback?: string } = {
      agentName: bestAgent.name,
      reason: this.generateSelectionReason(bestAgent.name, maxScore, intent, topic),
      confidence: maxScore,
    };
    if (fallbackAgent) {
      result.fallback = fallbackAgent;
    }
    return result;
  }

  // Create a detailed handoff plan
  private async createHandoffPlan(params: Record<string, unknown>): Promise<HandoffDecision> {
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
    
    // Direct topic match
    if (agentExpertise.some(exp => exp.toLowerCase().includes(topic.toLowerCase()))) {
      match += 0.8;
    }
    
    // Intent-based match
    if (agentExpertise.some(exp => intent.toLowerCase().includes(exp.toLowerCase()))) {
      match += 0.6;
    }
    
    // Partial matches
    const topicWords = topic.split(/\s+/);
    const intentWords = intent.split(/\s+/);
    
    for (const expertise of agentExpertise) {
      const expWords = expertise.toLowerCase().split(/\s+/);
      
      for (const word of [...topicWords, ...intentWords]) {
        if (expWords.some(expWord => expWord.includes(word.toLowerCase()))) {
          match += 0.1;
        }
      }
    }
    
    return Math.min(match, 1.0);
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

  private calculateToolMatch(agentTools: string[], intent: string, topic: string): number {
    if (agentTools.length === 0) return 0.5; // Neutral if no tools
    
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

  // Conversation context management
  private getConversationContext(userId: string): ConversationContext {
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

  private updateConversationContext(userId: string, intent: any, message: string): void {
    const context = this.getConversationContext(userId);
    
    context.currentTopic = intent.topic;
    context.userIntent = intent.primaryIntent;
    context.complexity = intent.complexity;
    context.emotionalTone = intent.emotionalTone;
    context.urgency = intent.urgency;
    
    this.conversationHistory.set(userId, context);
  }

  private async shouldHandoff(intent: any, context: ConversationContext, currentAgent?: string): Promise<boolean> {
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
}