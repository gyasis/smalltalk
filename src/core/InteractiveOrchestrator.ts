import { EventEmitter } from 'events';
import { Agent } from '../agents/Agent.js';
import { RealTimeUserMonitor, UserInterruption } from './RealTimeUserMonitor.js';
import { InterruptibleExecutor, ExecutionPlan, ExecutionState, AgentStep, InterruptionPoint, ExecutionContext } from './InterruptibleExecutor.js';
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
  private registeredAgents: Map<string, Agent> = new Map();
  private activePlans: Map<string, ExecutionPlan> = new Map();

  constructor(config: InteractiveOrchestratorConfig) {
    super();
    
    this.config = {
      interruptionSensitivity: 'medium',
      allowAgentSwitching: true,
      enablePlanRedirection: true,
      ...config
    };

    // Initialize core components
    this.userMonitor = new RealTimeUserMonitor();
    this.executor = new InterruptibleExecutor(this.userMonitor);

    this.setupEventListeners();
    
    console.log('[🎭 InteractiveOrchestrator] Initialized with interactive orchestration capabilities');
  }

  /**
   * Register agent for orchestration
   */
  registerAgent(agent: Agent): void {
    this.registeredAgents.set(agent.name, agent);
    console.log(`[🎭 InteractiveOrchestrator] ✅ Registered agent: ${agent.name}`);
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
    console.log(`\n[🎭 InteractiveOrchestrator] 🚀 ORCHESTRATING REQUEST`);
    console.log(`[🎭 InteractiveOrchestrator] 📝 Message: "${message}"`);
    console.log(`[🎭 InteractiveOrchestrator] 👤 User: ${userId} | Session: ${sessionId}`);

    try {
      // Phase 1: Heavy Agent Skills Analysis & Routing
      console.log(`[🎭 InteractiveOrchestrator] 🧠 Phase 1: Analyzing agent skills and routing...`);
      const routingDecision = await this.analyzeAndRoute(message, conversationHistory);
      
      // Phase 2: Create Execution Plan with Interruption Points
      console.log(`[🎭 InteractiveOrchestrator] 📋 Phase 2: Creating execution plan...`);
      const executionPlan = await this.createExecutionPlan(message, routingDecision, {
        sessionId,
        userId,
        conversationHistory,
        currentTopic: this.extractTopic(message),
        userGoals: this.extractUserGoals(message)
      });

      // Phase 3: Execute with Real-Time Interaction
      console.log(`[🎭 InteractiveOrchestrator] ⚡ Phase 3: Executing with real-time interaction...`);
      const executionResult = await this.executor.executeWithInterruption(executionPlan);

      console.log(`[🎭 InteractiveOrchestrator] ✅ Orchestration completed successfully`);
      return executionResult;

    } catch (error) {
      console.error(`[🎭 InteractiveOrchestrator] ❌ Orchestration failed:`, error);
      throw error;
    }
  }

  /**
   * Phase 1: Heavy agent skills analysis and routing
   */
  private async analyzeAndRoute(message: string, conversationHistory: any[]): Promise<RoutingDecision> {
    const availableAgents = Array.from(this.registeredAgents.values());
    
    if (availableAgents.length === 0) {
      throw new Error('No agents registered for orchestration');
    }

    // Sophisticated skills analysis (heavy LLM processing)
    const skillsAnalysis = await this.performDeepSkillsAnalysis(message, availableAgents);
    
    // Collaboration pattern detection
    const collaborationNeeds = await this.analyzeCollaborationRequirements(message, skillsAnalysis);
    
    // Optimal agent selection and sequencing
    const selectedAgents = this.selectOptimalAgents(skillsAnalysis, collaborationNeeds);
    const interruptionPoints = this.identifyInterruptionPoints(selectedAgents, message);

    const routingDecision: RoutingDecision = {
      selectedAgents,
      collaborationPattern: collaborationNeeds.pattern,
      confidence: skillsAnalysis.overallConfidence,
      reasoning: skillsAnalysis.reasoning,
      estimatedDuration: this.estimateExecutionDuration(selectedAgents),
      interruptionPoints
    };

    console.log(`[🎭 InteractiveOrchestrator] 🎯 Routing Decision:`);
    console.log(`  Selected Agents: ${selectedAgents.map(a => a.name).join(', ')}`);
    console.log(`  Collaboration: ${collaborationNeeds.pattern}`);
    console.log(`  Confidence: ${skillsAnalysis.overallConfidence}%`);
    console.log(`  Interruption Points: ${interruptionPoints.length}`);

    return routingDecision;
  }

  /**
   * Perform deep skills analysis using LLM reasoning
   */
  private async performDeepSkillsAnalysis(message: string, agents: Agent[]): Promise<any> {
    // Mock implementation - in real system, would use TokenJS/LLM for analysis
    console.log(`[🎭 InteractiveOrchestrator] 🔍 Performing deep skills analysis...`);
    
    // Analyze each agent's capability match
    const agentAnalysis = agents.map(agent => ({
      agent: agent.name,
      skillMatch: this.calculateSkillMatch(message, agent),
      capabilities: this.extractAgentCapabilities(agent),
      suitability: Math.floor(Math.random() * 100) + 1 // Mock score
    }));

    // Sort by suitability
    agentAnalysis.sort((a, b) => b.suitability - a.suitability);

    return {
      agentAnalysis,
      overallConfidence: Math.floor(Math.random() * 30) + 70, // Mock: 70-100%
      reasoning: `Based on skill analysis, ${agentAnalysis[0].agent} is most suitable for this request due to strong capability match.`,
      topCandidates: agentAnalysis.slice(0, 3)
    };
  }

  /**
   * Calculate skill match between message and agent
   */
  private calculateSkillMatch(message: string, agent: Agent): number {
    // Mock implementation - in real system would use sophisticated matching
    const messageLower = message.toLowerCase();
    
    // Basic keyword matching for demo
    if (agent.name.includes('CEO') && (messageLower.includes('strategy') || messageLower.includes('business'))) {
      return 90;
    }
    if (agent.name.includes('TechLead') && (messageLower.includes('technical') || messageLower.includes('architecture'))) {
      return 95;
    }
    if (agent.name.includes('Marketing') && messageLower.includes('marketing')) {
      return 85;
    }
    
    return Math.floor(Math.random() * 50) + 25; // Random 25-75%
  }

  /**
   * Extract agent capabilities for analysis
   */
  private extractAgentCapabilities(agent: Agent): string[] {
    // Mock implementation - would extract from agent configuration
    const capabilityMap: Record<string, string[]> = {
      'CEO': ['strategy', 'leadership', 'business-planning', 'decision-making'],
      'TechLead': ['architecture', 'technical-analysis', 'scalability', 'implementation'],
      'MarketingLead': ['marketing-strategy', 'branding', 'customer-analysis', 'campaigns'],
      'SalesChief': ['sales-strategy', 'revenue-optimization', 'customer-relations'],
      'ResearchPro': ['market-research', 'competitive-analysis', 'data-analysis'],
      'ProjectManager': ['project-planning', 'coordination', 'timeline-management'],
      'FinanceAdvisor': ['financial-analysis', 'budgeting', 'roi-calculation', 'risk-assessment']
    };

    return capabilityMap[agent.name] || ['general'];
  }

  /**
   * Analyze collaboration requirements
   */
  private async analyzeCollaborationRequirements(message: string, skillsAnalysis: any): Promise<any> {
    console.log(`[🎭 InteractiveOrchestrator] 🤝 Analyzing collaboration requirements...`);
    
    const messageLower = message.toLowerCase();
    
    // Detect collaboration patterns
    let pattern: 'sequential' | 'parallel' | 'debate' | 'review' = 'sequential';
    let requiresMultipleAgents = false;

    if (messageLower.includes('collaborate') || messageLower.includes('work together')) {
      requiresMultipleAgents = true;
      pattern = 'parallel';
    }
    
    if (messageLower.includes('debate') || messageLower.includes('different perspectives')) {
      requiresMultipleAgents = true;
      pattern = 'debate';
    }

    if (messageLower.includes('review') || messageLower.includes('analyze')) {
      pattern = 'review';
    }

    // Check if multiple skills needed
    const topAgents = skillsAnalysis.topCandidates.slice(0, 2);
    if (topAgents.length > 1 && Math.abs(topAgents[0].suitability - topAgents[1].suitability) < 20) {
      requiresMultipleAgents = true;
    }

    return {
      pattern,
      requiresMultipleAgents,
      recommendedAgentCount: requiresMultipleAgents ? Math.min(3, skillsAnalysis.topCandidates.length) : 1
    };
  }

  /**
   * Select optimal agents based on analysis
   */
  private selectOptimalAgents(skillsAnalysis: any, collaborationNeeds: any): Agent[] {
    const candidateCount = collaborationNeeds.requiresMultipleAgents ? 
      collaborationNeeds.recommendedAgentCount : 1;

    const selectedAgentNames = skillsAnalysis.topCandidates
      .slice(0, candidateCount)
      .map((analysis: any) => analysis.agent);

    return selectedAgentNames
      .map((name: string) => this.registeredAgents.get(name))
      .filter((agent: Agent | undefined): agent is Agent => agent !== undefined);
  }

  /**
   * Identify safe interruption points in execution
   */
  private identifyInterruptionPoints(agents: Agent[], message: string): InterruptionPoint[] {
    return agents.map((agent, index) => ({
      stepIndex: index,
      agentName: agent.name,
      interruptionSafety: index === 0 ? 'safe' : 'warning', // First agent is always safe to interrupt
      contextPreservation: 0.8 - (index * 0.1) // Context preservation decreases with depth
    }));
  }

  /**
   * Estimate execution duration
   */
  private estimateExecutionDuration(agents: Agent[]): number {
    // Mock implementation - estimate based on agent count and complexity
    const baseTime = 30000; // 30 seconds base
    const agentTime = agents.length * 15000; // 15 seconds per agent
    return baseTime + agentTime;
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
   * Shutdown orchestrator gracefully
   */
  async shutdown(): Promise<void> {
    console.log(`[🎭 InteractiveOrchestrator] 🛑 Shutting down...`);
    
    this.userMonitor.stopMonitoring();
    this.activePlans.clear();
    
    console.log(`[🎭 InteractiveOrchestrator] ✅ Shutdown complete`);
  }
}