import { OrchestratorAgent, AgentCapabilities, HandoffDecision } from './OrchestratorAgent.js';
import { SmallTalkConfig } from '../types/index.js';
import { Agent } from './Agent.js';

export class EnhancedOrchestratorAgent extends OrchestratorAgent {
  private lastRoutingDecision: any = null;
  private routingHistory: Array<{
    timestamp: Date;
    message: string;
    selectedAgent: string;
    reason: string;
    confidence: number;
    alternatives: Array<{ agent: string; score: number }>;
  }> = [];

  constructor(config: SmallTalkConfig & Partial<import('../types/index.js').AgentConfig> = {}) {
    super(config);
    
    // Enable verbose logging for orchestration decisions
    this.enableVerboseLogging();
  }

  private enableVerboseLogging(): void {
    console.log('[🎭 EnhancedOrchestrator] Initialized with verbose logging enabled');
  }

  public async orchestrate(
    message: string,
    userId: string,
    currentAgent?: string
  ): Promise<HandoffDecision | null> {
    console.log('\n' + '='.repeat(80));
    console.log('[🎭 EnhancedOrchestrator] 🚀 ORCHESTRATION REQUEST RECEIVED');
    console.log('='.repeat(80));
    console.log(`[🎭 EnhancedOrchestrator] 📝 User Message: "${message}"`);
    console.log(`[🎭 EnhancedOrchestrator] 👤 User ID: ${userId}`);
    console.log(`[🎭 EnhancedOrchestrator] 🤖 Current Agent: ${currentAgent || 'None'}`);
    console.log('[🎭 EnhancedOrchestrator] 📊 Available Agents:', this.getAvailableAgents().map(a => a.name).join(', '));
    console.log('-'.repeat(80));
    
    try {
      // Always route, even if no current agent
      const shouldRoute = true; // Always proactively route
      
      console.log('[🎭 EnhancedOrchestrator] 🔍 ANALYZING MESSAGE...');
      
      // Get conversation context
      const context = this.getConversationContext(userId);
      console.log(`[🎭 EnhancedOrchestrator] 📚 Context: Topic="${context.currentTopic}", Intent="${context.userIntent}", Urgency="${context.urgency}"`);
      
      // Analyze the user's message
      const intent = await this.analyzeUserIntent({ message, context });
      console.log('[🎭 EnhancedOrchestrator] 🎯 INTENT ANALYSIS:');
      console.log(`  • Primary Intent: ${intent.primaryIntent}`);
      console.log(`  • Topic: ${intent.topic}`);
      console.log(`  • Complexity: ${(intent.complexity * 100).toFixed(0)}%`);
      console.log(`  • Urgency: ${intent.urgency}`);
      console.log(`  • Task Type: ${intent.taskType}`);
      console.log(`  • Required Expertise: [${intent.requiredExpertise.join(', ')}]`);
      
      // Update conversation context
      this.updateConversationContext(userId, intent, message);
      
      // Always select the best agent for this message
      console.log('\n[🎭 EnhancedOrchestrator] 🤔 SELECTING BEST AGENT...');
      
      const bestAgent = await this.selectBestAgent({
        intent: intent.primaryIntent,
        complexity: intent.complexity,
        topic: intent.topic,
        urgency: intent.urgency
      });
      
      console.log('[🎭 EnhancedOrchestrator] ✅ SELECTION COMPLETE:');
      console.log(`  • Selected: ${bestAgent.agentName}`);
      console.log(`  • Confidence: ${(bestAgent.confidence * 100).toFixed(0)}%`);
      console.log(`  • Reason: ${bestAgent.reason}`);
      if (bestAgent.fallback) {
        console.log(`  • Fallback: ${bestAgent.fallback}`);
      }
      
      // Check if we need to switch agents
      const needsSwitch = bestAgent.agentName !== currentAgent;
      
      if (needsSwitch) {
        console.log(`[🎭 EnhancedOrchestrator] 🔄 AGENT SWITCH NEEDED: ${currentAgent || 'None'} → ${bestAgent.agentName}`);
      } else {
        console.log(`[🎭 EnhancedOrchestrator] ✅ STAYING WITH CURRENT AGENT: ${bestAgent.agentName}`);
      }
      
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
      
      // Store routing decision for history
      this.lastRoutingDecision = {
        timestamp: new Date(),
        message,
        selectedAgent: bestAgent.agentName,
        reason: bestAgent.reason,
        confidence: bestAgent.confidence,
        intent,
        context
      };
      
      this.routingHistory.push({
        timestamp: new Date(),
        message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
        selectedAgent: bestAgent.agentName,
        reason: bestAgent.reason,
        confidence: bestAgent.confidence,
        alternatives: [] // Could be populated with other candidates
      });
      
      console.log('[🎭 EnhancedOrchestrator] 📋 HANDOFF PLAN CREATED');
      console.log(`  • Target Agent: ${handoffPlan.targetAgent}`);
      console.log(`  • Expected Outcome: ${handoffPlan.expectedOutcome}`);
      console.log('='.repeat(80) + '\n');
      
      // Emit event for UI to display
      this.emit('orchestration_decision', {
        userId,
        message,
        selectedAgent: bestAgent.agentName,
        reason: bestAgent.reason,
        confidence: bestAgent.confidence,
        intent,
        timestamp: new Date()
      });
      
      return handoffPlan;
      
    } catch (error) {
      console.error('[🎭 EnhancedOrchestrator] ❌ ERROR during orchestration:', error);
      console.log('='.repeat(80) + '\n');
      
      // Fallback to first available agent
      const agents = this.getAvailableAgents();
      if (agents.length > 0) {
        const fallbackAgent = agents[0].name;
        console.log(`[🎭 EnhancedOrchestrator] 🔧 Falling back to: ${fallbackAgent}`);
        
        return {
          targetAgent: fallbackAgent,
          reason: 'Fallback due to orchestration error',
          confidence: 0.3,
          contextToTransfer: {},
          expectedOutcome: 'Basic assistance'
        };
      }
      
      return null;
    }
  }

  // Override to always trigger routing
  protected async shouldHandoff(intent: any, context: any, currentAgent?: string): Promise<boolean> {
    // Always return true to force routing decision - this ensures every message gets analyzed and routed
    console.log('[🎭 EnhancedOrchestrator] 🔄 Always routing messages for optimal agent selection');
    return true;
  }

  // Get routing history for debugging
  public getRoutingHistory(): typeof this.routingHistory {
    return this.routingHistory;
  }

  // Get last routing decision details
  public getLastRoutingDecision(): any {
    return this.lastRoutingDecision;
  }

  // Enhanced agent registration with detailed logging
  public registerAgent(agent: Agent, capabilities: AgentCapabilities): void {
    super.registerAgent(agent, capabilities);
    
    console.log('[🎭 EnhancedOrchestrator] 🎯 Agent Registered:');
    console.log(`  • Name: ${agent.name}`);
    console.log(`  • Expertise: [${capabilities.expertise.join(', ')}]`);
    console.log(`  • Complexity: ${capabilities.complexity}`);
    console.log(`  • Task Types: [${capabilities.taskTypes?.join(', ') || 'general'}]`);
    console.log(`  • Context Awareness: ${(capabilities.contextAwareness * 100).toFixed(0)}%`);
    console.log(`  • Collaboration Style: ${capabilities.collaborationStyle || 'independent'}`);
  }
}