import { EventEmitter } from 'events';
import { Agent } from '../agents/Agent.js';
import { RealTimeUserMonitor, UserInterruption } from './RealTimeUserMonitor.js';

export interface ExecutionPlan {
  id: string;
  selectedAgents: Agent[];
  executionSequence: AgentStep[];
  collaborationPattern?: 'sequential' | 'parallel' | 'debate' | 'review';
  interruptionPoints: InterruptionPoint[];
  userIntent: string;
  context: ExecutionContext;
}

export interface AgentStep {
  agentName: string;
  action: string;
  parameters: Record<string, unknown>;
  expectedOutput: string;
  canInterrupt: boolean;
  priority: number;
}

export interface InterruptionPoint {
  stepIndex: number;
  agentName: string;
  interruptionSafety: 'safe' | 'warning' | 'dangerous';
  contextPreservation: number; // 0-1 score
}

export interface ExecutionContext {
  sessionId: string;
  userId: string;
  conversationHistory: any[];
  currentTopic: string;
  userGoals: string[];
}

export interface ExecutionState {
  plan: ExecutionPlan;
  currentStep: number;
  sessionId: string;
  userId: string;
  startTime: Date;
  isInterruptible: boolean;
  status: 'running' | 'paused' | 'interrupted' | 'completed' | 'failed';
  pausedAt?: Date;
  resumedAt?: Date;
  interruptionHistory: UserInterruption[];
}

export interface StreamChunk {
  agentName: string;
  chunk: string;
  sessionId: string;
  canInterrupt: boolean;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export class InterruptionException extends Error {
  constructor(
    message: string,
    public interruption: UserInterruption,
    public executionState: ExecutionState
  ) {
    super(message);
    this.name = 'InterruptionException';
  }
}

/**
 * InterruptibleExecutor - Core execution engine for interactive orchestration
 * 
 * Capabilities:
 * - Execute agent sequences with real-time streaming
 * - Handle user interruptions during agent execution
 * - Pause/resume execution mid-stream
 * - Context preservation across interruptions
 * - Adaptive plan updates based on user steering
 */
export class InterruptibleExecutor extends EventEmitter {
  private currentExecution: ExecutionState | null = null;
  private userMonitor: RealTimeUserMonitor;
  private streamBuffer: Map<string, string[]> = new Map();
  private executionHistory: ExecutionState[] = [];

  constructor(userMonitor: RealTimeUserMonitor) {
    super();
    this.userMonitor = userMonitor;
    
    // Listen for user interruptions
    this.userMonitor.on('user-interruption', this.handleInterruption.bind(this));
    this.userMonitor.on('user-input', this.handleUserInput.bind(this));
    
    console.log('[⚡ InterruptibleExecutor] Initialized with streaming and interruption capabilities');
  }

  /**
   * Execute a plan with full interruption and streaming support
   */
  async executeWithInterruption(plan: ExecutionPlan): Promise<ExecutionState> {
    console.log(`[⚡ InterruptibleExecutor] 🚀 Starting execution for plan: ${plan.id}`);
    
    this.currentExecution = {
      plan,
      currentStep: 0,
      sessionId: plan.context.sessionId,
      userId: plan.context.userId,
      startTime: new Date(),
      isInterruptible: true,
      status: 'running',
      interruptionHistory: []
    };

    // Start real-time monitoring
    this.userMonitor.startMonitoring(plan.context.sessionId);

    try {
      // Execute plan steps with interruption awareness
      await this.executeSequence();
      
      this.currentExecution.status = 'completed';
      console.log(`[⚡ InterruptibleExecutor] ✅ Execution completed for plan: ${plan.id}`);
      
    } catch (error) {
      this.currentExecution.status = 'failed';
      
      if (error instanceof InterruptionException) {
        console.log(`[⚡ InterruptibleExecutor] 🔄 Execution interrupted: ${error.message}`);
        await this.handlePlannedInterruption(error);
      } else {
        console.error(`[⚡ InterruptibleExecutor] ❌ Execution failed:`, error);
        throw error;
      }
    } finally {
      // Clean up monitoring
      this.userMonitor.stopMonitoring(plan.context.sessionId);
      
      // Archive execution state
      this.executionHistory.push({ ...this.currentExecution });
      
      const finalState = this.currentExecution;
      this.currentExecution = null;
      
      return finalState;
    }
  }

  /**
   * Execute the agent sequence with streaming and interruption checks
   */
  private async executeSequence(): Promise<void> {
    const { plan } = this.currentExecution!;
    
    for (let stepIndex = 0; stepIndex < plan.selectedAgents.length; stepIndex++) {
      this.currentExecution!.currentStep = stepIndex;
      const agent = plan.selectedAgents[stepIndex];
      const step = plan.executionSequence[stepIndex];
      
      console.log(`[⚡ InterruptibleExecutor] 🎭 Executing step ${stepIndex + 1}/${plan.selectedAgents.length}: ${agent.name}`);
      
      // Check if we should continue (user might have interrupted)
      if (!this.shouldContinueExecution()) {
        throw new InterruptionException(
          'Execution halted by user interruption',
          this.currentExecution!.interruptionHistory[this.currentExecution!.interruptionHistory.length - 1],
          this.currentExecution!
        );
      }

      // Execute agent with streaming and interruption awareness
      await this.executeAgentWithInterruption(agent, step);
      
      // Check interruption points
      const interruptionPoint = plan.interruptionPoints.find(ip => ip.stepIndex === stepIndex);
      if (interruptionPoint && interruptionPoint.interruptionSafety === 'safe') {
        // Pause briefly at safe interruption points
        await this.sleep(100);
      }
    }
  }

  /**
   * Execute a single agent with streaming and interruption support
   */
  private async executeAgentWithInterruption(agent: Agent, step: AgentStep): Promise<void> {
    const sessionId = this.currentExecution!.sessionId;
    
    try {
      // Create context for agent execution
      const agentContext = this.buildAgentContext(agent, step);
      
      // Get streaming response from agent
      const stream = this.generateAgentStream(agent, agentContext);
      
      // Process stream with interruption awareness
      await this.processStreamWithInterruption(stream, agent.name, sessionId);
      
    } catch (error) {
      console.error(`[⚡ InterruptibleExecutor] ❌ Agent ${agent.name} execution failed:`, error);
      throw error;
    }
  }

  /**
   * Process agent response stream with real-time interruption checking
   */
  private async processStreamWithInterruption(
    stream: AsyncIterable<string>,
    agentName: string,
    sessionId: string
  ): Promise<void> {
    const bufferKey = `${sessionId}-${agentName}`;
    this.streamBuffer.set(bufferKey, []);
    
    for await (const chunk of stream) {
      // Check for interruption before processing each chunk
      if (this.isInterrupted()) {
        console.log(`[⚡ InterruptibleExecutor] 🛑 Stream interrupted during ${agentName} response`);
        throw new InterruptionException(
          'User interrupted during streaming',
          this.currentExecution!.interruptionHistory[this.currentExecution!.interruptionHistory.length - 1],
          this.currentExecution!
        );
      }
      
      // Buffer the chunk
      this.streamBuffer.get(bufferKey)!.push(chunk);
      
      // Emit chunk to listeners (UI, logging, etc.)
      this.emitStreamChunk(agentName, chunk, sessionId);
      
      // Small delay to allow interruption processing
      await this.sleep(10);
    }
    
    // Stream completed successfully
    console.log(`[⚡ InterruptibleExecutor] ✅ Stream completed for ${agentName}`);
  }

  /**
   * Generate streaming response from agent (mock implementation)
   */
  private async* generateAgentStream(agent: Agent, context: any): AsyncIterable<string> {
    // Mock implementation - in real system, this would call agent.generateResponseStream()
    const mockResponse = `This is a response from ${agent.name} regarding your request. I'm analyzing the situation and providing my expertise...`;
    const words = mockResponse.split(' ');
    
    for (const word of words) {
      yield word + ' ';
      await this.sleep(50); // Simulate streaming delay
    }
  }

  /**
   * Emit stream chunk to listeners
   */
  private emitStreamChunk(agentName: string, chunk: string, sessionId: string): void {
    const streamChunk: StreamChunk = {
      agentName,
      chunk,
      sessionId,
      canInterrupt: this.currentExecution?.isInterruptible || false,
      timestamp: new Date(),
      metadata: {
        currentStep: this.currentExecution?.currentStep,
        totalSteps: this.currentExecution?.plan.selectedAgents.length
      }
    };

    this.emit('stream-chunk', streamChunk);
    
    // Also emit to console for debugging
    process.stdout.write(`[${agentName}] ${chunk}`);
  }

  /**
   * Handle user interruption during execution
   */
  private async handleInterruption(interruption: UserInterruption): Promise<void> {
    if (!this.currentExecution || !this.currentExecution.isInterruptible) {
      console.log(`[⚡ InterruptibleExecutor] ⚠️ Ignoring interruption - no interruptible execution active`);
      return;
    }

    console.log(`[⚡ InterruptibleExecutor] 🚨 Processing interruption: ${interruption.type}`);
    
    // Add to interruption history
    this.currentExecution.interruptionHistory.push(interruption);
    
    // Handle different types of interruptions
    switch (interruption.type) {
      case 'STOP':
      case 'PAUSE':
        await this.pauseCurrentExecution();
        break;
        
      case 'REDIRECT':
        await this.handleRedirection(interruption);
        break;
        
      case 'AGENT_SWITCH':
        await this.handleAgentSwitch(interruption);
        break;
        
      case 'NEW_PLAN':
        await this.handleNewPlan(interruption);
        break;
        
      case 'CLARIFICATION':
        await this.handleClarification(interruption);
        break;
    }
  }

  /**
   * Handle non-interruption user input
   */
  private handleUserInput(input: any): void {
    // Store user input for context
    console.log(`[⚡ InterruptibleExecutor] 📝 User input: "${input.message}"`);
  }

  /**
   * Pause current execution
   */
  private async pauseCurrentExecution(): Promise<void> {
    if (!this.currentExecution) return;
    
    this.currentExecution.status = 'paused';
    this.currentExecution.pausedAt = new Date();
    
    console.log(`[⚡ InterruptibleExecutor] ⏸️ Execution paused at step ${this.currentExecution.currentStep + 1}`);
    
    this.emit('execution-paused', {
      planId: this.currentExecution.plan.id,
      pausedAt: this.currentExecution.pausedAt,
      currentStep: this.currentExecution.currentStep
    });
  }

  /**
   * Handle redirection request
   */
  private async handleRedirection(interruption: UserInterruption): Promise<void> {
    console.log(`[⚡ InterruptibleExecutor] 🔄 Handling redirection: "${interruption.newDirection}"`);
    
    this.emit('redirection-requested', {
      planId: this.currentExecution!.plan.id,
      currentStep: this.currentExecution!.currentStep,
      newDirection: interruption.newDirection,
      originalPlan: this.currentExecution!.plan
    });
  }

  /**
   * Handle agent switch request
   */
  private async handleAgentSwitch(interruption: UserInterruption): Promise<void> {
    console.log(`[⚡ InterruptibleExecutor] 🔄 Handling agent switch to: ${interruption.targetAgent}`);
    
    this.emit('agent-switch-requested', {
      planId: this.currentExecution!.plan.id,
      currentStep: this.currentExecution!.currentStep,
      targetAgent: interruption.targetAgent,
      currentAgent: this.currentExecution!.plan.selectedAgents[this.currentExecution!.currentStep]?.name
    });
  }

  /**
   * Handle new plan request
   */
  private async handleNewPlan(interruption: UserInterruption): Promise<void> {
    console.log(`[⚡ InterruptibleExecutor] 🆕 Handling new plan request`);
    
    this.emit('new-plan-requested', {
      planId: this.currentExecution!.plan.id,
      currentStep: this.currentExecution!.currentStep,
      reason: interruption.message
    });
  }

  /**
   * Handle clarification request
   */
  private async handleClarification(interruption: UserInterruption): Promise<void> {
    console.log(`[⚡ InterruptibleExecutor] ❓ Handling clarification: "${interruption.message}"`);
    
    this.emit('clarification-requested', {
      planId: this.currentExecution!.plan.id,
      currentStep: this.currentExecution!.currentStep,
      question: interruption.message
    });
  }

  /**
   * Handle planned interruption (thrown as exception)
   */
  private async handlePlannedInterruption(error: InterruptionException): Promise<void> {
    console.log(`[⚡ InterruptibleExecutor] 🔄 Handling planned interruption: ${error.message}`);
    
    this.emit('planned-interruption', {
      planId: error.executionState.plan.id,
      interruption: error.interruption,
      executionState: error.executionState
    });
  }

  /**
   * Check if execution should continue
   */
  private shouldContinueExecution(): boolean {
    if (!this.currentExecution) return false;
    
    return (
      this.currentExecution.status === 'running' &&
      this.currentExecution.isInterruptible
    );
  }

  /**
   * Check if execution is currently interrupted
   */
  private isInterrupted(): boolean {
    return (
      this.currentExecution?.status === 'interrupted' ||
      this.currentExecution?.status === 'paused'
    );
  }

  /**
   * Build context for agent execution
   */
  private buildAgentContext(agent: Agent, step: AgentStep): any {
    return {
      agent: agent.name,
      step,
      executionState: this.currentExecution,
      conversationHistory: this.currentExecution!.plan.context.conversationHistory,
      userGoals: this.currentExecution!.plan.context.userGoals
    };
  }

  /**
   * Resume paused execution
   */
  async resumeExecution(): Promise<void> {
    if (!this.currentExecution || this.currentExecution.status !== 'paused') {
      throw new Error('No paused execution to resume');
    }

    this.currentExecution.status = 'running';
    this.currentExecution.resumedAt = new Date();
    
    console.log(`[⚡ InterruptibleExecutor] ▶️ Resuming execution at step ${this.currentExecution.currentStep + 1}`);
    
    this.emit('execution-resumed', {
      planId: this.currentExecution.plan.id,
      resumedAt: this.currentExecution.resumedAt,
      currentStep: this.currentExecution.currentStep
    });
  }

  /**
   * Get current execution state
   */
  getCurrentExecution(): ExecutionState | null {
    return this.currentExecution ? { ...this.currentExecution } : null;
  }

  /**
   * Get execution history
   */
  getExecutionHistory(): ExecutionState[] {
    return [...this.executionHistory];
  }

  /**
   * Utility sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}