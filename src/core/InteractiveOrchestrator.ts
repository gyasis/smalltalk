import { EventEmitter } from 'events';
import { Agent } from '../agents/Agent.js';
import { RealTimeUserMonitor, UserInterruption } from './RealTimeUserMonitor.js';
import { InterruptibleExecutor, ExecutionPlan, ExecutionState, AgentStep, InterruptionPoint, ExecutionContext } from './InterruptibleExecutor.js';
import { AgentSkillsAnalyzer, AgentCapabilities, SkillsMatchAnalysis } from './AgentSkillsAnalyzer.js';
import { CollaborationPatternEngine, CollaborationRecommendation } from './CollaborationPatternEngine.js';
import { SequencePlanner, OptimizedSequence, SequenceOptimizationOptions } from './SequencePlanner.js';
import { AdaptivePlanningEngine, PlanAdaptation, UserFeedback } from './AdaptivePlanningEngine.js';
import { FeedbackLearner, UserBehaviorModel } from './FeedbackLearner.js';
import { PredictiveRouter, RoutingPrediction } from './PredictiveRouter.js';
import { nanoid } from 'nanoid';

export interface InteractiveOrchestratorConfig {
  llmProvider: string;
  model: string;
  debugMode?: boolean;
  interruptionSensitivity?: 'low' | 'medium' | 'high';
  allowAgentSwitching?: boolean;
  enablePlanRedirection?: boolean;
}

export interface RoutingDecision {
  selectedAgents: Agent[];
  collaborationPattern: 'sequential' | 'parallel' | 'debate' | 'review';
  confidence: number;
  reasoning: string;
  estimatedDuration: number;
  interruptionPoints: InterruptionPoint[];
}

/**
 * InteractiveOrchestrator - Main orchestration engine with real-time user interaction
 * 
 * Core Features:
 * - Heavy agent skills analysis for optimal routing
 * - Real-time user interruption and steering
 * - Always-aware monitoring during agent execution  
 * - Adaptive plan updates based on user input
 * - Streaming responses with interruption capabilities
 */
export class InteractiveOrchestrator extends EventEmitter {
  private userMonitor: RealTimeUserMonitor;
  private executor: InterruptibleExecutor;
  private config: InteractiveOrchestratorConfig;
  private debugMode: boolean;
  private registeredAgents: Map<string, Agent> = new Map();
  private activePlans: Map<string, ExecutionPlan> = new Map();
  
  // Phase 2: Sophisticated Routing Components
  private skillsAnalyzer: AgentSkillsAnalyzer;
  private collaborationEngine: CollaborationPatternEngine;
  private sequencePlanner: SequencePlanner;

  // Phase 3: Adaptive Planning Components
  private adaptivePlanner: AdaptivePlanningEngine;
  private feedbackLearner: FeedbackLearner;
  private predictiveRouter: PredictiveRouter;

  constructor(config: InteractiveOrchestratorConfig) {
    super();
    
    this.config = {
      interruptionSensitivity: 'medium',
      allowAgentSwitching: true,
      enablePlanRedirection: true,
      ...config
    };

    this.debugMode = config.debugMode || false;

    // Initialize Phase 1 components
    this.userMonitor = new RealTimeUserMonitor();
    this.executor = new InterruptibleExecutor(this.userMonitor);

    // Initialize Phase 2: Sophisticated Routing Components
    this.skillsAnalyzer = new AgentSkillsAnalyzer({
      provider: this.config.llmProvider,
      model: this.config.model
    });
    
    this.collaborationEngine = new CollaborationPatternEngine({
      provider: this.config.llmProvider,
      model: this.config.model
    });
    
    this.sequencePlanner = new SequencePlanner({
      provider: this.config.llmProvider,
      model: this.config.model
    });

    // Initialize Phase 3: Adaptive Planning Components
    this.adaptivePlanner = new AdaptivePlanningEngine({
      provider: this.config.llmProvider,
      model: this.config.model
    });
    
    this.feedbackLearner = new FeedbackLearner();
    this.predictiveRouter = new PredictiveRouter();

    this.setupEventListeners();
    
    console.log('[🎭 InteractiveOrchestrator] Initialized with Phase 1 + Phase 2 + Phase 3 interactive orchestration capabilities');
    console.log('[🎭 InteractiveOrchestrator] ✅ AgentSkillsAnalyzer ready');
    console.log('[🎭 InteractiveOrchestrator] ✅ CollaborationPatternEngine ready');
    console.log('[🎭 InteractiveOrchestrator] ✅ SequencePlanner ready');
    console.log('[🎭 InteractiveOrchestrator] ✅ AdaptivePlanningEngine ready');
    console.log('[🎭 InteractiveOrchestrator] ✅ FeedbackLearner ready');
    console.log('[🎭 InteractiveOrchestrator] ✅ PredictiveRouter ready');
  }

  /**
   * Register agent for orchestration
   */
  registerAgent(agent: Agent, capabilities?: AgentCapabilities): void {
    this.registeredAgents.set(agent.name, agent);
    
    // Register capabilities with Phase 2 skills analyzer if provided
    if (capabilities) {
      this.skillsAnalyzer.registerAgent(agent, capabilities);
      console.log(`[🎭 InteractiveOrchestrator] ✅ Registered agent: ${agent.name} with capabilities`);
    } else {
      // Auto-generate capabilities based on agent name and personality
      const autoCapabilities = this.generateDefaultCapabilities(agent);
      this.skillsAnalyzer.registerAgent(agent, autoCapabilities);
      console.log(`[🎭 InteractiveOrchestrator] ✅ Registered agent: ${agent.name} with auto-generated capabilities`);
    }
  }

  /**
   * Auto-generate capabilities for agents without explicit capabilities
   */
  private generateDefaultCapabilities(agent: Agent): AgentCapabilities {
    // Extract skills from agent name and personality
    const name = agent.name.toLowerCase();
    const personality = (agent.config.personality as string)?.toLowerCase() || '';
    
    const skillMap: Record<string, Partial<AgentCapabilities>> = {
      'ceo': {
        primarySkills: ['strategic-planning', 'leadership', 'business-analysis'],
        domainExpertise: ['executive-strategy', 'company-vision', 'stakeholder-management'],
        taskTypes: ['strategic-decisions', 'high-level-planning', 'leadership-guidance']
      },
      'techlead': {
        primarySkills: ['technical-architecture', 'system-design', 'code-review'],
        domainExpertise: ['software-engineering', 'scalability', 'technical-leadership'],
        taskTypes: ['architecture-decisions', 'technical-analysis', 'implementation-planning']
      },
      'marketing': {
        primarySkills: ['marketing-strategy', 'brand-management', 'customer-analysis'],
        domainExpertise: ['digital-marketing', 'content-creation', 'market-research'],
        taskTypes: ['campaign-planning', 'brand-strategy', 'market-analysis']
      },
      'sales': {
        primarySkills: ['sales-strategy', 'customer-relations', 'revenue-optimization'],
        domainExpertise: ['sales-processes', 'lead-generation', 'deal-closing'],
        taskTypes: ['sales-planning', 'customer-outreach', 'revenue-strategies']
      },
      'research': {
        primarySkills: ['data-analysis', 'market-research', 'competitive-analysis'],
        domainExpertise: ['research-methodology', 'data-interpretation', 'trend-analysis'],
        taskTypes: ['research-projects', 'data-collection', 'analytical-reports']
      },
      'finance': {
        primarySkills: ['financial-analysis', 'budgeting', 'risk-assessment'],
        domainExpertise: ['financial-planning', 'investment-analysis', 'cost-optimization'],
        taskTypes: ['financial-modeling', 'budget-planning', 'roi-analysis']
      }
    };

    // Find matching skill set
    let matchedSkills: Partial<AgentCapabilities> = {};
    for (const [key, skills] of Object.entries(skillMap)) {
      if (name.includes(key)) {
        matchedSkills = skills;
        break;
      }
    }

    // Default capabilities if no match found
    if (!matchedSkills.primarySkills) {
      matchedSkills = {
        primarySkills: ['general-assistance', 'problem-solving'],
        domainExpertise: ['general-knowledge'],
        taskTypes: ['general-tasks', 'information-gathering']
      };
    }

    // Personality-based adjustments
    const collaborationStrengths = ['communication', 'adaptability'];
    if (personality.includes('friendly')) collaborationStrengths.push('team-harmony');
    if (personality.includes('analytical')) collaborationStrengths.push('detail-analysis');
    if (personality.includes('creative')) collaborationStrengths.push('innovative-thinking');

    return {
      primarySkills: matchedSkills.primarySkills || ['general-assistance'],
      secondarySkills: matchedSkills.primarySkills?.map(skill => `supporting-${skill}`) || ['problem-solving'],
      domainExpertise: matchedSkills.domainExpertise || ['general-knowledge'],
      collaborationStrengths,
      taskTypes: matchedSkills.taskTypes || ['general-tasks'],
      complexityHandling: 'intermediate',
      interruptionTolerance: 'medium',
      contextPreservation: 0.8,
      averageResponseTime: 5000,
      confidenceThreshold: 0.7
    };
  }

  /**
   * Main orchestration method - processes user input with real-time interaction
   */
  async orchestrate(
    message: string,
    sessionId: string,
    userId: string,
    conversationHistory: any[] = []
  ): Promise<ExecutionState> {
    if (this.debugMode) {
      console.log(`\n[🎭 InteractiveOrchestrator] 🚀 ORCHESTRATING REQUEST`);
      console.log(`[🎭 InteractiveOrchestrator] 📝 Message: "${message.substring(0, 50)}..."`);
      console.log(`[🎭 InteractiveOrchestrator] 👤 User: ${userId} | Session: ${sessionId}`);
    }

    try {
      // Phase 3: Adaptive Agent Analysis & Predictive Routing
      if (this.debugMode) {
        console.log(`[🎭 InteractiveOrchestrator] 🧠 Phase 3: Adaptive analysis and predictive routing...`);
      }
      const routingDecision = await this.analyzeAndRoute(message, conversationHistory, userId);
      
      // Phase 2: Create Execution Plan with Interruption Points
      if (this.debugMode) {
        console.log(`[🎭 InteractiveOrchestrator] 📋 Phase 2: Creating execution plan...`);
      }
      const executionPlan = await this.createExecutionPlan(message, routingDecision, {
        sessionId,
        userId,
        conversationHistory,
        currentTopic: this.extractTopic(message),
        userGoals: this.extractUserGoals(message)
      });

      // Phase 3: Execute with Real-Time Interaction
      if (this.debugMode) {
        console.log(`[🎭 InteractiveOrchestrator] ⚡ Phase 3: Executing with real-time interaction...`);
      }
      const executionResult = await this.executor.executeWithInterruption(executionPlan);

      if (this.debugMode) {
        console.log(`[🎭 InteractiveOrchestrator] ✅ Orchestration completed successfully`);
      }
      return executionResult;

    } catch (error) {
      console.error(`[🎭 InteractiveOrchestrator] ❌ Orchestration failed:`, error);
      throw error;
    }
  }

  /**
   * Phase 3: Adaptive routing with predictive optimization and learning
   */
  private async analyzeAndRoute(message: string, conversationHistory: any[], userId: string = 'default'): Promise<RoutingDecision> {
    const availableAgents = Array.from(this.registeredAgents.values());
    
    if (availableAgents.length === 0) {
      throw new Error('No agents registered for orchestration');
    }

    console.log(`[🎭 InteractiveOrchestrator] 🧠 Phase 3: Starting adaptive analysis with predictive routing...`);

    // Get user behavior model for adaptive routing
    const userModel = this.feedbackLearner.getUserModel(userId);
    const recentExecutions: ExecutionState[] = [];

    // Step 1: Predictive routing analysis
    if (this.debugMode) {
      console.log(`[🎭 InteractiveOrchestrator] 🔮 Step 1: Predictive routing analysis...`);
    }
    const conversationContext = conversationHistory.map(h => h.content || h.message || '').filter(Boolean);
    const skillsAnalyses = await this.skillsAnalyzer.performDeepSkillsAnalysis(
      message, 
      availableAgents, 
      conversationContext
    );

    const routingPrediction = this.predictiveRouter.predictOptimalRoute(
      message,
      userId,
      availableAgents,
      skillsAnalyses,
      userModel,
      recentExecutions
    );

    // Step 2: Enhanced collaboration pattern detection with adaptive learning
    if (this.debugMode) {
      console.log(`[🎭 InteractiveOrchestrator] 🤝 Step 2: Enhanced collaboration pattern detection...`);
    }
    const collaborationRecommendation = await this.collaborationEngine.detectOptimalPattern(
      message,
      skillsAnalyses,
      conversationContext
    );

    // Step 3: Adaptive sequence planning using predictive insights
    if (this.debugMode) {
      console.log(`[🎭 InteractiveOrchestrator] 📋 Step 3: Adaptive sequence planning...`);
    }
    const selectedAgents = routingPrediction.primaryRoute.agents.length > 0 
      ? routingPrediction.primaryRoute.agents 
      : collaborationRecommendation.selectedAgents;

    const optimizedSequence = await this.sequencePlanner.createOptimalSequence(
      message,
      collaborationRecommendation,
      skillsAnalyses
    );

    // Extract interruption points from optimized sequence
    const interruptionPoints = optimizedSequence.interruptionPoints;

    // Calculate overall confidence from skills analyses
    const overallConfidence = Math.round(
      skillsAnalyses.reduce((sum, analysis) => sum + analysis.confidence, 0) / skillsAnalyses.length * 100
    );

    // Phase 3: Combine predictive insights with sophisticated analysis
    const finalPattern = routingPrediction.primaryRoute.pattern !== 'sequential' 
      ? routingPrediction.primaryRoute.pattern 
      : collaborationRecommendation.pattern.name;

    const finalConfidence = Math.max(overallConfidence / 100, routingPrediction.primaryRoute.confidence);
    const predictiveReasonig = `Predictive routing (${Math.round(routingPrediction.primaryRoute.confidence * 100)}% confidence) combined with ${collaborationRecommendation.reasoning}`;

    const routingDecision: RoutingDecision = {
      selectedAgents,
      collaborationPattern: finalPattern as 'sequential' | 'parallel' | 'debate' | 'review',
      confidence: Math.round(finalConfidence * 100),
      reasoning: predictiveReasonig,
      estimatedDuration: Math.round(routingPrediction.primaryRoute.estimatedDuration || optimizedSequence.totalDuration),
      interruptionPoints
    };

    if (this.debugMode) {
      console.log(`[🎭 InteractiveOrchestrator] 🎯 Phase 3 Adaptive Routing Decision:`);
      console.log(`  Selected Agents: ${selectedAgents.map(a => a.name).join(', ')}`);
      console.log(`  Collaboration: ${finalPattern}`);
      console.log(`  Confidence: ${Math.round(finalConfidence * 100)}%`);
      console.log(`  Predicted Satisfaction: ${Math.round(routingPrediction.primaryRoute.estimatedSatisfaction * 100)}%`);
    }
    if (this.debugMode) {
      console.log(`  Interruption Points: ${interruptionPoints.length}`);
      console.log(`  Risk Factors: ${routingPrediction.riskFactors.length}`);
      console.log(`  Optimization Opportunities: ${routingPrediction.optimizationOpportunities.length}`);
    }

    return routingDecision;
  }




  /**
   * Create execution plan with interruption support
   */
  private async createExecutionPlan(
    message: string,
    routingDecision: RoutingDecision,
    context: ExecutionContext
  ): Promise<ExecutionPlan> {
    const planId = nanoid();
    
    // Create execution steps for each agent
    const executionSequence: AgentStep[] = routingDecision.selectedAgents.map((agent, index) => ({
      agentName: agent.name,
      action: `Process user request: "${message}" from ${agent.name}'s perspective`,
      parameters: {
        userMessage: message,
        context,
        collaborationPattern: routingDecision.collaborationPattern
      },
      expectedOutput: `${agent.name}'s analysis and response to the user request`,
      canInterrupt: true,
      priority: index + 1
    }));

    const plan: ExecutionPlan = {
      id: planId,
      selectedAgents: routingDecision.selectedAgents,
      executionSequence,
      collaborationPattern: routingDecision.collaborationPattern,
      interruptionPoints: routingDecision.interruptionPoints,
      userIntent: message,
      context
    };

    this.activePlans.set(planId, plan);
    
    console.log(`[🎭 InteractiveOrchestrator] 📋 Created execution plan: ${planId}`);
    console.log(`  Agents: ${plan.selectedAgents.length}`);
    console.log(`  Steps: ${plan.executionSequence.length}`);
    console.log(`  Interruption Points: ${plan.interruptionPoints.length}`);

    return plan;
  }

  /**
   * Extract topic from user message
   */
  private extractTopic(message: string): string {
    // Simple topic extraction - in real system would use NLP
    const words = message.toLowerCase().split(' ');
    const topicKeywords = ['strategy', 'marketing', 'technical', 'financial', 'sales', 'research'];
    
    for (const keyword of topicKeywords) {
      if (words.includes(keyword)) {
        return keyword;
      }
    }
    
    return 'general';
  }

  /**
   * Extract user goals from message
   */
  private extractUserGoals(message: string): string[] {
    // Simple goal extraction - in real system would use NLP
    const goals = [];
    
    if (message.includes('analyze') || message.includes('analysis')) {
      goals.push('analysis');
    }
    if (message.includes('plan') || message.includes('strategy')) {
      goals.push('planning');
    }
    if (message.includes('recommend') || message.includes('suggest')) {
      goals.push('recommendations');
    }
    
    return goals.length > 0 ? goals : ['general-assistance'];
  }

  /**
   * Setup event listeners for orchestrator components
   */
  private setupEventListeners(): void {
    // Listen for executor events
    this.executor.on('stream-chunk', (chunk) => {
      this.emit('response-chunk', chunk);
    });

    this.executor.on('execution-paused', (data) => {
      console.log(`[🎭 InteractiveOrchestrator] ⏸️ Execution paused: ${data.planId}`);
      this.emit('execution-paused', data);
    });

    this.executor.on('redirection-requested', async (data) => {
      console.log(`[🎭 InteractiveOrchestrator] 🔄 Redirection requested for plan: ${data.planId}`);
      await this.handleRedirectionRequest(data);
    });

    this.executor.on('agent-switch-requested', async (data) => {
      console.log(`[🎭 InteractiveOrchestrator] 🔄 Agent switch requested: ${data.currentAgent} → ${data.targetAgent}`);
      await this.handleAgentSwitchRequest(data);
    });

    this.executor.on('new-plan-requested', async (data) => {
      console.log(`[🎭 InteractiveOrchestrator] 🆕 New plan requested for: ${data.planId}`);
      await this.handleNewPlanRequest(data);
    });
  }

  /**
   * Handle redirection request from user
   */
  private async handleRedirectionRequest(data: any): Promise<void> {
    // Implementation for handling plan redirection
    console.log(`[🎭 InteractiveOrchestrator] 🔄 Processing redirection: "${data.newDirection}"`);
    
    // This would involve:
    // 1. Re-analyzing the new direction
    // 2. Updating the execution plan
    // 3. Resuming execution with new plan
    
    this.emit('plan-updated', {
      planId: data.planId,
      reason: 'user-redirection',
      newDirection: data.newDirection
    });
  }

  /**
   * Handle agent switch request from user
   */
  private async handleAgentSwitchRequest(data: any): Promise<void> {
    console.log(`[🎭 InteractiveOrchestrator] 🔄 Processing agent switch: ${data.targetAgent}`);
    
    const targetAgent = this.registeredAgents.get(data.targetAgent);
    if (!targetAgent) {
      console.log(`[🎭 InteractiveOrchestrator] ⚠️ Target agent not found: ${data.targetAgent}`);
      return;
    }

    // This would involve:
    // 1. Updating the current execution plan
    // 2. Switching to the target agent
    // 3. Preserving context across the switch
    
    this.emit('agent-switched', {
      planId: data.planId,
      fromAgent: data.currentAgent,
      toAgent: data.targetAgent
    });
  }

  /**
   * Handle new plan request from user
   */
  private async handleNewPlanRequest(data: any): Promise<void> {
    console.log(`[🎭 InteractiveOrchestrator] 🆕 Processing new plan request`);
    
    // This would involve:
    // 1. Stopping current execution
    // 2. Creating entirely new plan
    // 3. Starting fresh execution
    
    this.emit('new-plan-created', {
      originalPlanId: data.planId,
      reason: data.reason
    });
  }

  /**
   * Get orchestrator statistics
   */
  getStatistics() {
    return {
      registeredAgents: this.registeredAgents.size,
      activePlans: this.activePlans.size,
      isMonitoring: this.userMonitor.isMonitoring(),
      monitoringStats: this.userMonitor.getStatistics(),
      currentExecution: this.executor.getCurrentExecution()
    };
  }

  /**
   * Phase 3: Handle user feedback and adapt plan dynamically
   */
  async handleUserFeedback(
    planId: string,
    feedback: UserFeedback,
    userId: string
  ): Promise<PlanAdaptation | null> {
    console.log(`[🎭 InteractiveOrchestrator] 🔄 Processing user feedback for plan: ${planId}`);

    const executionPlan = this.activePlans.get(planId);
    if (!executionPlan) {
      console.log(`[🎭 InteractiveOrchestrator] ⚠️ Plan not found: ${planId}`);
      return null;
    }

    const executionState = this.executor.getCurrentExecution();
    if (!executionState || executionState.plan.id !== planId) {
      console.log(`[🎭 InteractiveOrchestrator] ⚠️ No active execution for plan: ${planId}`);
      return null;
    }

    // Process feedback with learning system
    this.feedbackLearner.processFeedback(userId, feedback, {
      agentUsed: executionPlan.executionSequence[executionState.currentStep]?.agentName || 'unknown',
      pattern: executionPlan.collaborationPattern || 'sequential',
      duration: Date.now() - (executionState.startTime?.getTime() || 0),
      interruptionOccurred: (executionState.interruptionHistory?.length || 0) > 0
    });

    // Get adaptive plan recommendation
    const availableAgents = Array.from(this.registeredAgents.values());
    const adaptation = await this.adaptivePlanner.adaptPlanBasedOnFeedback(
      executionPlan,
      feedback,
      executionState,
      availableAgents
    );

    // Apply adaptation if confidence is high enough
    if (adaptation.confidence > 0.7) {
      console.log(`[🎭 InteractiveOrchestrator] ✅ Applying plan adaptation: ${adaptation.adaptationType}`);
      
      // Emit adaptation event for UI/monitoring
      this.emit('plan-adaptation', {
        planId,
        adaptation,
        userId,
        timestamp: new Date()
      });
      
      return adaptation;
    } else {
      console.log(`[🎭 InteractiveOrchestrator] ⚠️ Adaptation confidence too low (${Math.round(adaptation.confidence * 100)}%)`);
      return null;
    }
  }

  /**
   * Phase 3: Update routing metrics based on execution outcome
   */
  updateRoutingMetrics(
    userId: string,
    planId: string,
    outcome: {
      success: boolean;
      satisfaction: number;
      duration: number;
      interruptions: number;
    }
  ): void {
    const plan = this.activePlans.get(planId);
    if (!plan) return;

    console.log(`[🎭 InteractiveOrchestrator] 📊 Updating routing metrics for plan: ${planId}`);

    // Update predictive router metrics
    this.predictiveRouter.updateRoutingMetrics(
      userId,
      plan.userIntent,
      plan.selectedAgents,
      plan.collaborationPattern,
      outcome
    );

    // Update agent performance metrics in adaptive planner
    for (const agent of plan.selectedAgents) {
      this.adaptivePlanner.updateAgentPerformanceMetrics(agent.name, {
        success: outcome.success,
        responseTime: outcome.duration / plan.selectedAgents.length,
        userSatisfaction: outcome.satisfaction,
        wasInterrupted: outcome.interruptions > 0
      });
    }

    console.log(`[🎭 InteractiveOrchestrator] ✅ Metrics updated successfully`);
  }

  /**
   * Phase 3: Get adaptive insights and recommendations
   */
  getAdaptiveInsights(userId?: string): {
    behaviorModel: UserBehaviorModel | null;
    learningInsights: any[];
    routingRecommendations: string[];
    performanceMetrics: any;
  } {
    return {
      behaviorModel: userId ? this.feedbackLearner.getUserModel(userId) : null,
      learningInsights: this.feedbackLearner.getLearningInsights(userId),
      routingRecommendations: this.predictiveRouter.getRoutingRecommendations(),
      performanceMetrics: {
        agentPerformance: this.adaptivePlanner.getAgentPerformanceReport(),
        routingMetrics: this.predictiveRouter.getMetrics(),
        learningPatterns: this.adaptivePlanner.getLearningPatterns()
      }
    };
  }

  /**
   * Shutdown orchestrator gracefully
   */
  async shutdown(): Promise<void> {
    console.log(`[🎭 InteractiveOrchestrator] 🛑 Shutting down...`);
    
    this.userMonitor.stopMonitoring();
    this.activePlans.clear();
    
    console.log(`[🎭 InteractiveOrchestrator] ✅ Shutdown complete`);
  }
}