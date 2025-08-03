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

      // Post-execution analysis with internal deliberation
      await this.postExecutionAnalysis(plan, sessionId, userId);

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

  /**
   * Post-execution analysis with internal deliberation rounds
   * Analyzes plan execution, verifies completion, and determines next actions
   */
  private async postExecutionAnalysis(plan: ExecutionPlan, sessionId: string, userId: string): Promise<void> {
    try {
      // Step 1: Comprehensive Plan Verification
      const planVerification = this.verifyPlanCompletion(plan);
      
      // Step 2: Internal Deliberation Rounds
      const analysis = await this.conductInternalDeliberation(plan, planVerification);
      
      // Step 3: Decision and Response Generation
      await this.generateIntelligentResponse(plan, analysis, sessionId, userId);
      
    } catch (error) {
      console.error('[Orchestrator] Post-execution analysis failed:', error);
      // Fallback to basic completion message
      this.emit('analysis_response', {
        type: 'analysis_response',
        planId: plan.id,
        response: '✅ Plan completed with some analysis limitations.',
        nextAction: 'user_input_required',
        timestamp: new Date()
      });
    }
  }

  /**
   * Verify that all plan tasks were executed and each step completed successfully
   */
  private verifyPlanCompletion(plan: ExecutionPlan): {
    allStepsCompleted: boolean;
    completedSteps: number;
    totalSteps: number;
    failedSteps: any[];
    stepSummaries: any[];
  } {
    const failedSteps = plan.steps.filter(step => step.status === 'failed');
    const completedSteps = plan.steps.filter(step => step.status === 'completed');
    
    const stepSummaries = plan.steps.map(step => ({
      id: step.id,
      agentName: step.agentName,
      action: step.action.substring(0, 100) + '...',
      status: step.status,
      output: step.output ? step.output.substring(0, 200) + '...' : 'No output',
      executionTime: step.completedAt ? 
        (step.completedAt.getTime() - (step.startedAt?.getTime() || 0)) : 0
    }));

    return {
      allStepsCompleted: failedSteps.length === 0 && completedSteps.length === plan.steps.length,
      completedSteps: completedSteps.length,
      totalSteps: plan.steps.length,
      failedSteps,
      stepSummaries
    };
  }

  /**
   * Conduct internal deliberation rounds to analyze execution and determine next steps
   */
  private async conductInternalDeliberation(plan: ExecutionPlan, verification: any): Promise<any> {
    // Internal Round 1: What did we accomplish?
    const accomplishments = await this.analyzeAccomplishments(plan, verification);
    
    // Internal Round 2: Are the user's goals met?
    const goalAssessment = await this.assessGoalCompletion(plan, accomplishments);
    
    // Internal Round 3: What should happen next?
    const nextActionDecision = await this.determineNextAction(plan, goalAssessment);
    
    return {
      accomplishments,
      goalAssessment,
      nextActionDecision,
      verification
    };
  }

  /**
   * Internal Round 1: Analyze what was accomplished during plan execution
   */
  private async analyzeAccomplishments(plan: ExecutionPlan, verification: any): Promise<any> {
    const prompt = `
INTERNAL ANALYSIS - ROUND 1: ACCOMPLISHMENT REVIEW

Plan Objective: ${plan.expectedOutcome}
Original User Request: ${plan.userIntent}

Execution Summary:
- Total Steps: ${verification.totalSteps}
- Completed Steps: ${verification.completedSteps}
- Failed Steps: ${verification.failedSteps.length}

Step-by-Step Results:
${verification.stepSummaries.map((step: any, index: number) => 
  `${index + 1}. ${step.agentName}: ${step.action}
     Status: ${step.status}
     Output: ${step.output}`
).join('\n')}

ANALYZE: What concrete accomplishments were achieved? What specific value was delivered?
Be factual and specific. Focus on actual outcomes, not process.
`;

    try {
      const analysis = await this.generateResponse(prompt, {
        session: { 
          id: 'analysis', 
          messages: [], 
          createdAt: new Date(), 
          updatedAt: new Date() 
        },
        message: { 
          id: 'analysis-prompt', 
          role: 'system', 
          content: prompt, 
          timestamp: new Date() 
        },
        config: {}
      });
      return {
        rawAnalysis: analysis,
        keyAccomplishments: this.extractKeyPoints(analysis),
        deliveredValue: this.assessDeliveredValue(verification.stepSummaries)
      };
    } catch (error) {
      return {
        rawAnalysis: 'Analysis failed - using fallback assessment',
        keyAccomplishments: verification.stepSummaries.map((s: any) => `${s.agentName} completed: ${s.action}`),
        deliveredValue: verification.allStepsCompleted ? 'high' : 'partial'
      };
    }
  }

  /**
   * Internal Round 2: Assess if user's goals were met
   */
  private async assessGoalCompletion(plan: ExecutionPlan, accomplishments: any): Promise<any> {
    const prompt = `
INTERNAL ANALYSIS - ROUND 2: GOAL COMPLETION ASSESSMENT

Original User Request: "${plan.userIntent}"
Plan Objective: "${plan.expectedOutcome}"

What We Accomplished:
${accomplishments.keyAccomplishments.join('\n')}

Delivered Value Level: ${accomplishments.deliveredValue}

CRITICAL ASSESSMENT:
1. Did we fully address the user's original request?
2. Are there gaps or missing elements?
3. Would the user be satisfied with these results?
4. What questions or needs might remain?

Provide a direct YES/NO assessment with reasoning.
`;

    try {
      const assessment = await this.generateResponse(prompt, {
        session: { 
          id: 'analysis', 
          messages: [], 
          createdAt: new Date(), 
          updatedAt: new Date() 
        },
        message: { 
          id: 'analysis-prompt', 
          role: 'system', 
          content: prompt, 
          timestamp: new Date() 
        },
        config: {}
      });
      return {
        rawAssessment: assessment,
        isComplete: assessment.toLowerCase().includes('yes') && !assessment.toLowerCase().includes('but'),
        satisfactionLevel: this.assessSatisfactionLevel(assessment),
        identifiedGaps: this.extractGaps(assessment)
      };
    } catch (error) {
      return {
        rawAssessment: 'Assessment failed - using conservative estimate',
        isComplete: false,
        satisfactionLevel: 'uncertain',
        identifiedGaps: ['Unable to assess completion due to analysis error']
      };
    }
  }

  /**
   * Internal Round 3: Determine what should happen next
   */
  private async determineNextAction(plan: ExecutionPlan, goalAssessment: any): Promise<any> {
    const prompt = `
INTERNAL ANALYSIS - ROUND 3: NEXT ACTION DECISION

Goal Completion Status: ${goalAssessment.isComplete ? 'COMPLETE' : 'INCOMPLETE'}
User Satisfaction Level: ${goalAssessment.satisfactionLevel}
Identified Gaps: ${goalAssessment.identifiedGaps.join(', ')}

Original Request: "${plan.userIntent}"

DECISION MATRIX:
If goals are complete and satisfaction is high: Return intelligent summary to user
If goals are incomplete: Generate follow-up plan to address gaps
If unclear: Return summary and ask for user guidance

Based on the analysis above, what should happen next?
Choose ONE action and explain:
1. RETURN_SUMMARY - Provide intelligent summary and return control to user
2. GENERATE_FOLLOWUP - Create new plan to address remaining needs
3. ASK_GUIDANCE - Summarize and request user direction

Decision: [ACTION] because [REASONING]
`;

    try {
      const decision = await this.generateResponse(prompt, {
        session: { 
          id: 'analysis', 
          messages: [], 
          createdAt: new Date(), 
          updatedAt: new Date() 
        },
        message: { 
          id: 'analysis-prompt', 
          role: 'system', 
          content: prompt, 
          timestamp: new Date() 
        },
        config: {}
      });
      const action = this.extractDecision(decision);
      
      return {
        rawDecision: decision,
        chosenAction: action,
        reasoning: this.extractReasoning(decision),
        confidence: this.assessDecisionConfidence(decision)
      };
    } catch (error) {
      return {
        rawDecision: 'Decision failed - defaulting to summary',
        chosenAction: 'RETURN_SUMMARY',
        reasoning: 'Internal decision analysis failed, defaulting to safe option',
        confidence: 'low'
      };
    }
  }

  /**
   * Generate intelligent response based on analysis and emit to interfaces
   */
  private async generateIntelligentResponse(plan: ExecutionPlan, analysis: any, sessionId: string, userId: string): Promise<void> {
    const { accomplishments, goalAssessment, nextActionDecision } = analysis;
    
    let response = '';
    let nextAction = 'user_input_required';
    
    switch (nextActionDecision.chosenAction) {
      case 'RETURN_SUMMARY':
        response = await this.generateCompletionSummary(plan, accomplishments, goalAssessment);
        nextAction = 'user_input_required';
        break;
        
      case 'GENERATE_FOLLOWUP':
        response = await this.generateFollowupPlan(plan, goalAssessment.identifiedGaps);
        nextAction = 'followup_plan_generated';
        break;
        
      case 'ASK_GUIDANCE':
      default:
        response = await this.generateGuidanceRequest(plan, accomplishments, goalAssessment);
        nextAction = 'user_guidance_requested';
        break;
    }

    // Emit the intelligent response
    this.emit('analysis_response', {
      type: 'analysis_response',
      planId: plan.id,
      response,
      nextAction,
      analysis: {
        accomplishments: accomplishments.keyAccomplishments,
        isComplete: goalAssessment.isComplete,
        decision: nextActionDecision.chosenAction,
        reasoning: nextActionDecision.reasoning
      },
      timestamp: new Date()
    });
  }

  // Helper methods for analysis
  private extractKeyPoints(analysis: string): string[] {
    const lines = analysis.split('\n').filter(line => line.trim().length > 0);
    return lines.slice(0, 5); // Top 5 key points
  }

  private assessDeliveredValue(stepSummaries: any[]): string {
    const completedSteps = stepSummaries.filter(s => s.status === 'completed');
    const ratio = completedSteps.length / stepSummaries.length;
    return ratio >= 0.9 ? 'high' : ratio >= 0.7 ? 'medium' : 'low';
  }

  private assessSatisfactionLevel(assessment: string): string {
    const lower = assessment.toLowerCase();
    if (lower.includes('fully satisfied') || lower.includes('excellent')) return 'high';
    if (lower.includes('satisfied') || lower.includes('good')) return 'medium';
    if (lower.includes('partially') || lower.includes('gaps')) return 'low';
    return 'uncertain';
  }

  private extractGaps(assessment: string): string[] {
    const gapIndicators = ['missing', 'gap', 'incomplete', 'need', 'lacking', 'should'];
    const lines = assessment.split('\n');
    return lines.filter(line => 
      gapIndicators.some(indicator => line.toLowerCase().includes(indicator))
    ).slice(0, 3);
  }

  private extractDecision(decision: string): string {
    if (decision.includes('RETURN_SUMMARY')) return 'RETURN_SUMMARY';
    if (decision.includes('GENERATE_FOLLOWUP')) return 'GENERATE_FOLLOWUP';
    return 'ASK_GUIDANCE';
  }

  private extractReasoning(decision: string): string {
    const match = decision.match(/because\s+(.+)/i);
    return match ? match[1].trim() : 'No specific reasoning provided';
  }

  private assessDecisionConfidence(decision: string): string {
    const lower = decision.toLowerCase();
    if (lower.includes('clearly') || lower.includes('obviously')) return 'high';
    if (lower.includes('likely') || lower.includes('probably')) return 'medium';
    return 'low';
  }

  private async generateCompletionSummary(plan: ExecutionPlan, accomplishments: any, goalAssessment: any): Promise<string> {
    const prompt = `
Generate a concise, intelligent completion summary for the user.

Original Request: "${plan.userIntent}"
Key Accomplishments: ${accomplishments.keyAccomplishments.join(', ')}
Goal Status: ${goalAssessment.isComplete ? 'Complete' : 'Mostly Complete'}

Create a summary that:
1. Clearly states what was accomplished
2. Highlights the main outcomes/value delivered
3. Suggests natural next steps or asks what the user wants to do next

Keep it conversational and helpful, not robotic.
`;
    
    try {
      return await this.generateResponse(prompt, {
        session: { 
          id: 'analysis', 
          messages: [], 
          createdAt: new Date(), 
          updatedAt: new Date() 
        },
        message: { 
          id: 'analysis-prompt', 
          role: 'system', 
          content: prompt, 
          timestamp: new Date() 
        },
        config: {}
      });
    } catch (error) {
      return `✅ Task completed successfully. ${accomplishments.keyAccomplishments.join('. ')}. What would you like to do next?`;
    }
  }

  private async generateFollowupPlan(plan: ExecutionPlan, gaps: string[]): Promise<string> {
    // For now, return a message indicating follow-up is needed
    // In the future, this could actually generate and execute a new plan
    return `✅ Initial objectives completed. I've identified some areas that could benefit from additional attention: ${gaps.join(', ')}. Shall I create a follow-up plan to address these areas?`;
  }

  private async generateGuidanceRequest(plan: ExecutionPlan, accomplishments: any, goalAssessment: any): Promise<string> {
    const prompt = `
The user asked: "${plan.userIntent}"
We accomplished: ${accomplishments.keyAccomplishments.join(', ')}
Status: ${goalAssessment.isComplete ? 'Goals met' : 'Some gaps remain'}

Generate a response that summarizes what was done and asks the user for guidance on next steps.
Be specific about what was accomplished and what options they have.
`;
    
    try {
      return await this.generateResponse(prompt, {
        session: { 
          id: 'analysis', 
          messages: [], 
          createdAt: new Date(), 
          updatedAt: new Date() 
        },
        message: { 
          id: 'analysis-prompt', 
          role: 'system', 
          content: prompt, 
          timestamp: new Date() 
        },
        config: {}
      });
    } catch (error) {
      return `✅ I've completed the requested tasks. Here's what was accomplished: ${accomplishments.keyAccomplishments.join(', ')}. What would you like to focus on next?`;
    }
  }
}