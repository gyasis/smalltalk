import { EventEmitter } from 'events';
import { nanoid } from 'nanoid';
import { OrchestratorAgent, AgentCapabilities, HandoffDecision } from './OrchestratorAgent.js';
import { Agent } from './Agent.js';
import {
  SmallTalkConfig,
  ChatMessage,
  ExecutionPlan,
  PlanStep,
  InterruptionContext,
  ToolDefinition
} from '../types/index.js';

export interface PlanExecutionEvent {
  type: 'plan_created' | 'plan_started' | 'step_started' | 'step_completed' | 'plan_paused' | 'plan_resumed' | 'plan_completed' | 'plan_failed' | 'user_interrupted';
  planId: string;
  stepId?: string;
  timestamp: Date;
  data?: any;
}

export interface StreamingResponse {
  messageId: string;
  chunk: string;
  isComplete: boolean;
  agentName: string;
  stepId?: string;
  planId?: string;
}

export class InteractiveOrchestratorAgent extends OrchestratorAgent {
  private activePlans: Map<string, ExecutionPlan> = new Map();
  private executionQueue: Array<{ planId: string; sessionId: string; userId: string }> = [];
  private isExecuting = false;
  private streamingCallbacks: Array<(response: StreamingResponse) => void> = [];
  private interruptionCallbacks: Array<(context: InterruptionContext) => void> = [];
  private maxAutoResponses: number = 10;
  private autoResponseCount: Map<string, number> = new Map();

  constructor(config: SmallTalkConfig & { maxAutoResponses?: number } = {}) {
    super(config);
    
    this.maxAutoResponses = config.maxAutoResponses || 10;

    // Add planning tools
    const planningTools: ToolDefinition[] = [
      {
        name: 'createExecutionPlan',
        description: 'Create a multi-step execution plan for complex user requests',
        parameters: {
          type: 'object',
          properties: {
            userIntent: { type: 'string', description: 'User\'s main intent or goal' },
            steps: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  agentName: { type: 'string', description: 'Agent to execute this step' },
                  action: { type: 'string', description: 'Action for the agent to perform' },
                  parameters: { type: 'object', description: 'Parameters for the action' },
                  expectedOutput: { type: 'string', description: 'Expected outcome of this step' }
                },
                required: ['agentName', 'action', 'expectedOutput']
              }
            },
            expectedOutcome: { type: 'string', description: 'Overall expected outcome' }
          },
          required: ['userIntent', 'steps', 'expectedOutcome']
        },
        handler: this.createExecutionPlan.bind(this)
      },
      {
        name: 'executeNextStep',
        description: 'Execute the next step in an active plan',
        parameters: {
          type: 'object',
          properties: {
            planId: { type: 'string', description: 'ID of the plan to execute' },
            sessionId: { type: 'string', description: 'Session ID' },
            userId: { type: 'string', description: 'User ID' }
          },
          required: ['planId', 'sessionId', 'userId']
        },
        handler: this.executeNextStep.bind(this)
      },
      {
        name: 'pausePlan',
        description: 'Pause execution of a plan for user intervention',
        parameters: {
          type: 'object',
          properties: {
            planId: { type: 'string', description: 'ID of the plan to pause' },
            reason: { type: 'string', description: 'Reason for pausing' }
          },
          required: ['planId']
        },
        handler: this.pausePlan.bind(this)
      },
      {
        name: 'modifyPlan',
        description: 'Modify an existing plan based on user feedback',
        parameters: {
          type: 'object',
          properties: {
            planId: { type: 'string', description: 'ID of the plan to modify' },
            userFeedback: { type: 'string', description: 'User feedback for modifications' },
            modifications: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  stepIndex: { type: 'number', description: 'Index of step to modify' },
                  action: { type: 'string', description: 'Type of modification: add, remove, modify' },
                  newStep: { type: 'object', description: 'New step data if adding/modifying' }
                }
              }
            }
          },
          required: ['planId', 'userFeedback']
        },
        handler: this.modifyPlan.bind(this)
      }
    ];

    planningTools.forEach(tool => this.addTool(tool));
  }

  // Enhanced orchestration with plan generation
  public async orchestrateWithPlan(
    message: string,
    userId: string,
    sessionId: string,
    currentAgent?: string
  ): Promise<{ handoff?: HandoffDecision; plan?: ExecutionPlan; shouldExecute: boolean }> {
    try {
      // Check if this is an interruption during plan execution
      const activePlan = this.getActivePlanForUser(userId);
      if (activePlan && activePlan.status === 'executing') {
        await this.handleUserInterruption(activePlan.id, message, userId, sessionId);
        return { shouldExecute: false };
      }

      // Check auto-response limit
      const responseCount = this.autoResponseCount.get(userId) || 0;
      if (responseCount >= this.maxAutoResponses) {
        this.emit('auto_response_limit_reached', { userId, count: responseCount });
        return { shouldExecute: false };
      }

      // Analyze if this requires a multi-step plan
      const needsPlan = await this.shouldCreatePlan(message, userId);
      
      if (needsPlan) {
        // Create execution plan
        const plan = await this.createExecutionPlan({
          userIntent: message,
          steps: await this.generatePlanSteps(message, userId),
          expectedOutcome: await this.predictPlanOutcome(message)
        });

        this.emit('plan_created', {
          type: 'plan_created',
          planId: plan.id,
          timestamp: new Date(),
          data: { plan, userId, sessionId }
        });

        return { plan, shouldExecute: true };
      } else {
        // Use standard orchestration for simple requests
        const handoff = await this.orchestrate(message, userId, currentAgent);
        return { handoff, shouldExecute: true };
      }
    } catch (error) {
      console.error('[InteractiveOrchestrator] Error during orchestration:', error);
      return { shouldExecute: false };
    }
  }

  // Execute a plan step-by-step with streaming
  public async executePlan(
    planId: string,
    sessionId: string,
    userId: string,
    onStreamingResponse?: (response: StreamingResponse) => void
  ): Promise<boolean> {
    const plan = this.activePlans.get(planId);
    if (!plan) {
      throw new Error(`Plan ${planId} not found`);
    }

    if (onStreamingResponse) {
      this.streamingCallbacks.push(onStreamingResponse);
    }

    plan.status = 'executing';
    this.isExecuting = true;

    this.emit('plan_started', {
      type: 'plan_started',
      planId,
      timestamp: new Date(),
      data: { sessionId, userId }
    });

    try {
      while (plan.currentStepIndex < plan.steps.length) {
        // Check for interruption (status can change during execution)
        if ((plan.status as string) === 'paused') {
          this.emit('plan_paused', {
            type: 'plan_paused',
            planId,
            timestamp: new Date()
          });
          return false;
        }

        const step = plan.steps[plan.currentStepIndex];
        const success = await this.executeStep(step, planId, sessionId, userId);
        
        if (!success) {
          plan.status = 'failed';
          this.emit('plan_failed', {
            type: 'plan_failed',
            planId,
            stepId: step.id,
            timestamp: new Date()
          });
          return false;
        }

        plan.currentStepIndex++;
        
        // Increment auto-response count
        const currentCount = this.autoResponseCount.get(userId) || 0;
        this.autoResponseCount.set(userId, currentCount + 1);
      }

      plan.status = 'completed';
      plan.updatedAt = new Date();
      
      this.emit('plan_completed', {
        type: 'plan_completed',
        planId,
        timestamp: new Date()
      });

      return true;
    } catch (error) {
      plan.status = 'failed';
      console.error(`[InteractiveOrchestrator] Plan execution failed:`, error);
      return false;
    } finally {
      this.isExecuting = false;
    }
  }

  private async executeStep(
    step: PlanStep,
    planId: string,
    sessionId: string,
    userId: string
  ): Promise<boolean> {
    step.status = 'executing';
    step.startedAt = new Date();

    this.emit('step_started', {
      type: 'step_started',
      planId,
      stepId: step.id,
      timestamp: new Date(),
      data: { step }
    });

    try {
      const agent = (this as any).agentRegistry.get(step.agentName)?.agent;
      if (!agent) {
        throw new Error(`Agent ${step.agentName} not found`);
      }

      // Execute the step with the agent
      const response = await this.executeAgentAction(agent, step, sessionId, userId);
      
      step.output = response;
      step.status = 'completed';
      step.completedAt = new Date();

      // Stream the response
      this.streamResponse({
        messageId: nanoid(),
        chunk: response,
        isComplete: true,
        agentName: step.agentName,
        stepId: step.id,
        planId
      });

      // Emit agent response for immediate display
      this.emit('agent_response', {
        type: 'agent_response',
        planId,
        stepId: step.id,
        agentName: step.agentName,
        response: response,
        timestamp: new Date()
      });

      this.emit('step_completed', {
        type: 'step_completed',
        planId,
        stepId: step.id,
        timestamp: new Date(),
        data: { step, response }
      });

      return true;
    } catch (error) {
      step.status = 'failed';
      step.error = error instanceof Error ? error.message : String(error);
      step.completedAt = new Date();
      return false;
    }
  }

  private async executeAgentAction(
    agent: Agent,
    step: PlanStep,
    sessionId: string,
    userId: string
  ): Promise<string> {
    // Create a mock context for the agent
    const context = {
      session: { id: sessionId, messages: [], createdAt: new Date(), updatedAt: new Date() },
      message: {
        id: nanoid(),
        role: 'user' as const,
        content: step.action,
        timestamp: new Date(),
        stepId: step.id,
        planId: step.id
      },
      agent,
      tools: [],
      config: {}
    };

    return await agent.generateResponse(step.action, context);
  }

  private streamResponse(response: StreamingResponse): void {
    this.streamingCallbacks.forEach(callback => {
      try {
        callback(response);
      } catch (error) {
        console.error('[InteractiveOrchestrator] Error in streaming callback:', error);
      }
    });
  }

  // Handle user interruption during plan execution
  private async handleUserInterruption(
    planId: string,
    message: string,
    userId: string,
    sessionId: string
  ): Promise<void> {
    const plan = this.activePlans.get(planId);
    if (!plan) return;

    const interruptionContext: InterruptionContext = {
      planId,
      currentStepIndex: plan.currentStepIndex,
      userMessage: message,
      timestamp: new Date(),
      sessionId,
      userId
    };

    // Pause current execution
    plan.status = 'paused';
    
    this.emit('user_interrupted', {
      type: 'user_interrupted',
      planId,
      timestamp: new Date(),
      data: { message, currentStep: plan.currentStepIndex }
    });

    // Analyze interruption and decide how to proceed
    const shouldModifyPlan = await this.analyzeInterruption(message, plan);
    
    if (shouldModifyPlan) {
      await this.replanBasedOnInterruption(plan, message, userId);
    }

    // Reset auto-response count on user intervention
    this.autoResponseCount.set(userId, 0);
  }

  private async analyzeInterruption(message: string, plan: ExecutionPlan): Promise<boolean> {
    // Simple analysis - check for correction/modification keywords
    const modificationKeywords = ['stop', 'wait', 'change', 'modify', 'different', 'instead', 'wrong', 'correct'];
    const messageLower = message.toLowerCase();
    
    return modificationKeywords.some(keyword => messageLower.includes(keyword));
  }

  private async replanBasedOnInterruption(
    plan: ExecutionPlan,
    userFeedback: string,
    userId: string
  ): Promise<void> {
    try {
      // Generate new plan steps based on user feedback
      const newSteps = await this.generateRevisedPlanSteps(plan, userFeedback, userId);
      
      // Update the plan
      plan.steps = [
        ...plan.steps.slice(0, plan.currentStepIndex), // Keep completed steps
        ...newSteps // Replace remaining steps
      ];
      
      plan.updatedAt = new Date();
      plan.status = 'pending'; // Ready to resume
      
      this.emit('plan_modified', {
        planId: plan.id,
        userFeedback,
        newStepsCount: newSteps.length,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('[InteractiveOrchestrator] Error during replanning:', error);
    }
  }

  // Plan creation and management
  private async createExecutionPlan(params: Record<string, unknown>): Promise<ExecutionPlan> {
    const { userIntent, steps, expectedOutcome } = params as {
      userIntent: string;
      steps: Partial<PlanStep>[];
      expectedOutcome: string;
    };

    const planId = nanoid();
    const plan: ExecutionPlan = {
      id: planId,
      steps: steps.map((step, index) => ({
        id: nanoid(),
        agentName: step.agentName || 'default',
        action: step.action || '',
        parameters: step.parameters || {},
        expectedOutput: step.expectedOutput || '',
        status: 'pending'
      })),
      currentStepIndex: 0,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      userIntent,
      expectedOutcome
    };

    this.activePlans.set(planId, plan);
    return plan;
  }

  private async executeNextStep(params: Record<string, unknown>): Promise<boolean> {
    const { planId, sessionId, userId } = params as {
      planId: string;
      sessionId: string;
      userId: string;
    };

    return await this.executePlan(planId, sessionId, userId);
  }

  private async pausePlan(params: Record<string, unknown>): Promise<void> {
    const { planId, reason } = params as { planId: string; reason?: string };
    
    const plan = this.activePlans.get(planId);
    if (plan) {
      plan.status = 'paused';
      plan.updatedAt = new Date();
    }
  }

  private async modifyPlan(params: Record<string, unknown>): Promise<void> {
    const { planId, userFeedback } = params as {
      planId: string;
      userFeedback: string;
    };

    const plan = this.activePlans.get(planId);
    if (plan) {
      await this.replanBasedOnInterruption(plan, userFeedback, 'user');
    }
  }

  // Plan analysis methods
  private async shouldCreatePlan(message: string, userId: string): Promise<boolean> {
    // Simple heuristic - check for complexity indicators
    const complexityIndicators = [
      'step by step', 'first...then', 'after that', 'introduce yourselves',
      'everyone', 'all agents', 'each agent', 'one by one', 'sequential'
    ];
    
    const messageLower = message.toLowerCase();
    const hasComplexityIndicator = complexityIndicators.some(indicator => 
      messageLower.includes(indicator)
    );

    // Also consider if multiple agents are available
    const agentCount = (this as any).agentRegistry.size;
    
    return hasComplexityIndicator && agentCount > 1;
  }

  private async generatePlanSteps(message: string, userId: string): Promise<Partial<PlanStep>[]> {
    const availableAgents = this.getAvailableAgents();
    
    // For "introduce yourselves" scenario
    if (message.toLowerCase().includes('introduce')) {
      return availableAgents.map(agent => ({
        agentName: agent.name,
        action: `Introduce yourself as ${agent.name}. Share your expertise and how you can help users.`,
        expectedOutput: `A friendly introduction from ${agent.name} explaining their role and capabilities`
      }));
    }

    // Default: create steps for each agent to contribute
    return availableAgents.slice(0, 3).map(agent => ({
      agentName: agent.name,
      action: `Help with the user's request: "${message}"`,
      expectedOutput: `A helpful response from ${agent.name} addressing the user's needs`
    }));
  }

  private async generateRevisedPlanSteps(
    originalPlan: ExecutionPlan,
    userFeedback: string,
    userId: string
  ): Promise<PlanStep[]> {
    // Simple revision - if user corrects an agent, modify that agent's remaining steps
    const remainingSteps = originalPlan.steps.slice(originalPlan.currentStepIndex);
    
    return remainingSteps.map(step => ({
      ...step,
      id: nanoid(), // New ID for revised step
      action: `${step.action}\n\nUser feedback to consider: "${userFeedback}"`,
      status: 'pending' as const
    }));
  }

  private async predictPlanOutcome(message: string): Promise<string> {
    if (message.toLowerCase().includes('introduce')) {
      return 'All agents will have introduced themselves, providing the user with a clear understanding of available capabilities.';
    }
    
    return 'The user\'s request will be addressed through coordinated agent responses.';
  }

  // Utility methods
  public getActivePlanForUser(userId: string): ExecutionPlan | undefined {
    for (const plan of this.activePlans.values()) {
      if (plan.status === 'executing' || plan.status === 'paused') {
        return plan;
      }
    }
    return undefined;
  }

  public getAllPlans(): ExecutionPlan[] {
    return Array.from(this.activePlans.values());
  }

  public getPlan(planId: string): ExecutionPlan | undefined {
    return this.activePlans.get(planId);
  }

  public deletePlan(planId: string): boolean {
    return this.activePlans.delete(planId);
  }

  public onStreamingResponse(callback: (response: StreamingResponse) => void): void {
    this.streamingCallbacks.push(callback);
  }

  public onInterruption(callback: (context: InterruptionContext) => void): void {
    this.interruptionCallbacks.push(callback);
  }

  public resetAutoResponseCount(userId: string): void {
    this.autoResponseCount.set(userId, 0);
  }

  public getAutoResponseCount(userId: string): number {
    return this.autoResponseCount.get(userId) || 0;
  }

  public updateMaxAutoResponses(max: number): void {
    this.maxAutoResponses = max;
  }

  public getStats() {
    return {
      ...super.getStats(),
      activePlans: this.activePlans.size,
      isExecuting: this.isExecuting,
      maxAutoResponses: this.maxAutoResponses,
      queueLength: this.executionQueue.length
    };
  }
}