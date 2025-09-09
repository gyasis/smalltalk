/**
 * OrchestrationManager - Core SmallTalk orchestration coordinator
 * Manages different orchestration strategies and provides unified interface
 */

import { OrchestrationStrategy, OrchestrationContext, OrchestrationDecision } from './OrchestrationStrategy.js';
import { ReactiveChainOrchestrator } from './ReactiveChainOrchestrator.js';
import { TeamCollaborationOrchestrator } from './TeamCollaborationOrchestrator.js';
import { Agent } from '../agents/Agent.js';
import { ChatMessage } from '../types/index.js';

export interface OrchestrationConfig {
  defaultStrategy: 'single' | 'reactive' | 'team' | 'adaptive';
  enableReactiveChains: boolean;
  enableTeamCollaboration: boolean;
  llmConfig?: {
    provider?: string;
    model?: string;
    apiKey?: string;
  };
  strategicPrompting: boolean;
  contextPreservation: boolean;
}

export interface AgentCapabilities {
  expertise: string[];
  complexity: string;
  taskTypes: string[];
  tools: string[];
  contextAwareness: number;
  collaborationStyle: string;
}

export class OrchestrationManager {
  private strategies: Map<string, OrchestrationStrategy> = new Map();
  private config: OrchestrationConfig;
  private agentRegistry: Map<string, { agent: Agent; capabilities: AgentCapabilities }> = new Map();

  constructor(config: OrchestrationConfig) {
    this.config = config;
    this.initializeStrategies();
  }

  /**
   * Initialize orchestration strategies based on configuration
   */
  private initializeStrategies(): void {
    console.log('[OrchestrationManager] 🎼 Initializing orchestration strategies...');

    // Always available: Basic single agent strategy (handled by existing orchestrator)
    
    // Reactive Chain Orchestration
    if (this.config.enableReactiveChains) {
      const reactiveChain = new ReactiveChainOrchestrator(this.config.llmConfig);
      this.strategies.set('reactive', reactiveChain);
      console.log('[OrchestrationManager] 🔗 ReactiveChain strategy enabled');
    }

    // Team Collaboration Orchestration  
    if (this.config.enableTeamCollaboration) {
      const teamCollab = new TeamCollaborationOrchestrator(this.config.llmConfig);
      this.strategies.set('team', teamCollab);
      console.log('[OrchestrationManager] 👥 TeamCollaboration strategy enabled');
    }

    console.log(`[OrchestrationManager] ✅ Initialized ${this.strategies.size} orchestration strategies`);
  }

  /**
   * Register agent with capabilities
   */
  registerAgent(agent: Agent, capabilities: AgentCapabilities): void {
    this.agentRegistry.set(agent.name, { agent, capabilities });
    console.log(`[OrchestrationManager] 📝 Registered agent: ${agent.name}`);
  }

  /**
   * Main orchestration decision making
   */
  async orchestrate(
    message: string,
    userId: string,
    conversationHistory: ChatMessage[],
    currentAgent?: string
  ): Promise<OrchestrationDecision> {
    console.log(`[OrchestrationManager] 🎯 Orchestrating: "${message.substring(0, 100)}..."`);

    const context: OrchestrationContext = {
      userId,
      message,
      conversationHistory,
      currentAgent,
      availableAgents: Array.from(this.agentRegistry.values())
    };

    // Determine optimal strategy
    const strategy = await this.selectOptimalStrategy(context);
    console.log(`[OrchestrationManager] 🎼 Selected strategy: ${strategy}`);

    // Execute orchestration with selected strategy
    const orchestrator = this.strategies.get(strategy);
    if (orchestrator) {
      const decision = await orchestrator.orchestrate(context);
      decision.strategy = strategy as any; // Ensure strategy is set
      return decision;
    }

    // Fallback to basic single agent routing
    return this.getBasicRoutingDecision(context);
  }

  /**
   * Select optimal orchestration strategy
   */
  private async selectOptimalStrategy(context: OrchestrationContext): Promise<string> {
    // If default strategy is specified and available, use it
    if (this.config.defaultStrategy !== 'adaptive' && this.strategies.has(this.config.defaultStrategy)) {
      return this.config.defaultStrategy;
    }

    // Adaptive strategy selection based on message characteristics
    const messageAnalysis = this.analyzeMessage(context.message);

    // Check for reactive chain triggers
    if (this.config.enableReactiveChains && this.shouldUseReactiveChain(messageAnalysis)) {
      return 'reactive';
    }

    // Check for team collaboration triggers
    if (this.config.enableTeamCollaboration && this.shouldUseTeamCollaboration(messageAnalysis)) {
      return 'team';
    }

    // Default to reactive if available, otherwise basic routing
    if (this.strategies.has('reactive')) {
      return 'reactive';
    }

    return 'single';
  }

  /**
   * Analyze message characteristics for strategy selection
   */
  private analyzeMessage(message: string): {
    complexity: number;
    domains: string[];
    requiresMultiplePerspectives: boolean;
    isStrategic: boolean;
    isCreative: boolean;
  } {
    const lowerMessage = message.toLowerCase();
    
    // Domain detection
    const domains: string[] = [];
    if (lowerMessage.includes('market') || lowerMessage.includes('customer')) domains.push('marketing');
    if (lowerMessage.includes('tech') || lowerMessage.includes('develop') || lowerMessage.includes('implement')) domains.push('technical');
    if (lowerMessage.includes('strategy') || lowerMessage.includes('vision') || lowerMessage.includes('direction')) domains.push('strategic');
    if (lowerMessage.includes('sales') || lowerMessage.includes('revenue') || lowerMessage.includes('customer')) domains.push('sales');
    if (lowerMessage.includes('budget') || lowerMessage.includes('cost') || lowerMessage.includes('financial')) domains.push('financial');

    // Complexity indicators
    const complexityIndicators = [
      'how would we', 'what should we', 'multiple', 'various', 'different',
      'comprehensive', 'strategy', 'approach', 'plan', 'consider'
    ];
    const complexity = complexityIndicators.filter(indicator => lowerMessage.includes(indicator)).length / complexityIndicators.length;

    return {
      complexity,
      domains,
      requiresMultiplePerspectives: domains.length > 1 || complexity > 0.3,
      isStrategic: lowerMessage.includes('strategy') || lowerMessage.includes('strategic') || lowerMessage.includes('vision'),
      isCreative: lowerMessage.includes('creative') || lowerMessage.includes('brainstorm') || lowerMessage.includes('innovative')
    };
  }

  /**
   * Determine if reactive chain should be used
   */
  private shouldUseReactiveChain(analysis: any): boolean {
    return analysis.complexity > 0.2 || 
           analysis.domains.length >= 2 ||
           analysis.isStrategic;
  }

  /**
   * Determine if team collaboration should be used  
   */
  private shouldUseTeamCollaboration(analysis: any): boolean {
    return analysis.requiresMultiplePerspectives && 
           (analysis.isCreative || analysis.domains.length >= 3);
  }

  /**
   * Basic routing fallback decision
   */
  private getBasicRoutingDecision(context: OrchestrationContext): OrchestrationDecision {
    // Simple agent selection based on first available
    const primaryAgent = context.availableAgents[0]?.agent.name || 'DefaultAgent';
    
    return {
      strategy: 'single',
      primaryAgent,
      expectedFlow: 'Single agent response',
      confidence: 0.6,
      reason: 'Basic routing fallback'
    };
  }

  /**
   * Get available strategies
   */
  getAvailableStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Get strategy instance
   */
  getStrategy(name: string): OrchestrationStrategy | undefined {
    return this.strategies.get(name);
  }

  /**
   * Get registered agents
   */
  getRegisteredAgents(): Array<{ agent: Agent; capabilities: AgentCapabilities }> {
    return Array.from(this.agentRegistry.values());
  }

  /**
   * Update orchestration configuration
   */
  updateConfig(config: Partial<OrchestrationConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[OrchestrationManager] ⚙️ Configuration updated');
    
    // Reinitialize strategies if needed
    if (config.enableReactiveChains !== undefined || config.enableTeamCollaboration !== undefined) {
      this.strategies.clear();
      this.initializeStrategies();
    }
  }

  /**
   * Get orchestration statistics
   */
  getStats(): {
    strategiesEnabled: number;
    agentsRegistered: number;
    configuration: OrchestrationConfig;
  } {
    return {
      strategiesEnabled: this.strategies.size,
      agentsRegistered: this.agentRegistry.size,
      configuration: this.config
    };
  }
}