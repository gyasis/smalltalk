import { EventEmitter } from 'events';
import { nanoid } from 'nanoid';
import {
  SmallTalkConfig,
  SmallTalkFramework,
  Agent,
  BaseInterface,
  MCPServerConfig,
  ChatSession,
  ChatMessage,
  FlowContext
} from '../types/index.js';
import { Chat } from './Chat.js';
import { Memory } from './Memory.js';
import { MCPClient } from './MCPClient.js';
import { OrchestratorAgent, AgentCapabilities, HandoffDecision } from '../agents/OrchestratorAgent.js';
import { InteractiveOrchestratorAgent, PlanExecutionEvent, StreamingResponse } from '../agents/InteractiveOrchestratorAgent.js';

export class SmallTalk extends EventEmitter implements SmallTalkFramework {
  private config: SmallTalkConfig;
  private agents: Map<string, Agent> = new Map();
  private interfaces: BaseInterface[] = [];
  private chat: Chat;
  private memory: Memory;
  private mcpClient?: MCPClient;
  private orchestrator: InteractiveOrchestratorAgent;
  private isRunning = false;
  private activeSessions: Map<string, ChatSession> = new Map();
  private currentAgents: Map<string, string> = new Map(); // userId -> agentName
  private orchestrationEnabled = true;
  private streamingEnabled = false;
  private interruptionEnabled = false;

  constructor(config: SmallTalkConfig = {}) {
    super();
    
    this.config = {
      llmProvider: 'openai',
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 2048,
      debugMode: false,
      orchestration: true,
      ...config
    };

    this.chat = new Chat(this.config);
    this.memory = new Memory({
      maxMessages: 100,
      truncationStrategy: 'sliding_window',
      contextSize: 4000
    });

    // Initialize interactive orchestrator
    this.orchestrator = new InteractiveOrchestratorAgent({
      ...this.config,
      maxAutoResponses: this.config.orchestrationConfig?.maxAutoResponses || 10
    });
    this.orchestrationEnabled = this.config.orchestration !== false;
    this.streamingEnabled = this.config.orchestrationConfig?.streamResponses || false;
    this.interruptionEnabled = this.config.orchestrationConfig?.enableInterruption || true;

    this.setupOrchestratorEventHandlers();

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.on('message', this.handleMessage.bind(this));
    this.on('agent_switch', this.handleAgentSwitch.bind(this));
    this.on('session_start', this.handleSessionStart.bind(this));
    this.on('session_end', this.handleSessionEnd.bind(this));
  }

  private setupOrchestratorEventHandlers(): void {
    // Listen to plan execution events
    this.orchestrator.on('plan_created', (event: PlanExecutionEvent) => {
      this.emit('plan_created', event);
      if (this.config.debugMode) {
        console.log(`[SmallTalk] 📋 Plan created: ${event.planId}`);
      }
    });

    this.orchestrator.on('step_started', (event: PlanExecutionEvent) => {
      this.emit('step_started', event);
      if (this.config.debugMode) {
        console.log(`[SmallTalk] ▶️  Step started: ${event.stepId} in plan ${event.planId}`);
      }
    });

    this.orchestrator.on('step_completed', (event: PlanExecutionEvent) => {
      this.emit('step_completed', event);
      if (this.config.debugMode) {
        console.log(`[SmallTalk] ✅ Step completed: ${event.stepId} in plan ${event.planId}`);
      }
    });

    this.orchestrator.on('user_interrupted', (event: PlanExecutionEvent) => {
      this.emit('user_interrupted', event);
      if (this.config.debugMode) {
        console.log(`[SmallTalk] ⏸️  User interrupted plan: ${event.planId}`);
      }
    });

    this.orchestrator.on('plan_completed', (event: PlanExecutionEvent) => {
      this.emit('plan_completed', event);
      if (this.config.debugMode) {
        console.log(`[SmallTalk] 🎉 Plan completed: ${event.planId}`);
      }
    });

    this.orchestrator.on('auto_response_limit_reached', (data) => {
      this.emit('auto_response_limit_reached', data);
      if (this.config.debugMode) {
        console.log(`[SmallTalk] 🛑 Auto-response limit reached for user: ${data.userId}`);
      }
    });

    // Setup streaming response handler
    if (this.streamingEnabled) {
      this.orchestrator.onStreamingResponse((response: StreamingResponse) => {
        this.handleStreamingResponse(response);
      });
    }
  }

  public addAgent(agent: Agent, capabilities?: AgentCapabilities): void {
    this.agents.set(agent.name, agent);
    
    // Register with orchestrator if capabilities provided
    if (capabilities && this.orchestrationEnabled) {
      this.orchestrator.registerAgent(agent, capabilities);
    } else if (this.orchestrationEnabled) {
      // Infer capabilities from agent properties
      const inferredCapabilities = this.inferAgentCapabilities(agent);
      this.orchestrator.registerAgent(agent, inferredCapabilities);
    }
    
    this.emit('agent_added', { name: agent.name, config: agent.config, capabilities });
    
    if (this.config.debugMode) {
      console.log(`[SmallTalk] Agent '${agent.name}' added to framework`);
    }
  }

  public removeAgent(name: string): boolean {
    const removed = this.agents.delete(name);
    if (removed) {
      this.emit('agent_removed', { name });
      
      if (this.config.debugMode) {
        console.log(`[SmallTalk] Agent '${name}' removed from framework`);
      }
    }
    return removed;
  }

  public getAgent(name: string): Agent | undefined {
    return this.agents.get(name);
  }

  public listAgents(): string[] {
    return Array.from(this.agents.keys());
  }

  public getAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  public addInterface(iface: BaseInterface): void {
    this.interfaces.push(iface);
    
    // Set framework reference so interface can access agents
    iface.setFramework(this);
    
    // Set up message handling for this interface
    iface.onMessage(async (message: string) => {
      return await this.processMessage(message);
    });

    this.emit('interface_added', { type: iface.constructor.name });
    
    if (this.config.debugMode) {
      console.log(`[SmallTalk] Interface '${iface.constructor.name}' added to framework`);
    }
  }

  public async enableMCP(servers: MCPServerConfig[]): Promise<void> {
    this.mcpClient = new MCPClient();
    
    for (const serverConfig of servers) {
      try {
        await this.mcpClient.connect(serverConfig);
        
        if (this.config.debugMode) {
          console.log(`[SmallTalk] Connected to MCP server: ${serverConfig.name}`);
        }
      } catch (error) {
        console.error(`[SmallTalk] Failed to connect to MCP server ${serverConfig.name}:`, error);
      }
    }

    // Make MCP tools available to all agents
    const tools = this.mcpClient.getAvailableTools();
    for (const agent of this.agents.values()) {
      for (const tool of tools) {
        agent.addTool(tool);
      }
    }

    this.emit('mcp_enabled', { servers: servers.map(s => s.name) });
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('SmallTalk framework is already running');
    }

    // Start all interfaces
    for (const iface of this.interfaces) {
      try {
        await iface.start();
        
        if (this.config.debugMode) {
          console.log(`[SmallTalk] Interface '${iface.constructor.name}' started`);
        }
      } catch (error) {
        console.error(`[SmallTalk] Failed to start interface '${iface.constructor.name}':`, error);
      }
    }

    this.isRunning = true;
    this.emit('framework_started', { config: this.config });
    
    if (this.config.debugMode) {
      console.log('[SmallTalk] Framework started successfully');
      console.log(`[SmallTalk] Available agents: ${this.listAgents().join(', ')}`);
    }
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    // Stop all interfaces
    for (const iface of this.interfaces) {
      try {
        await iface.stop();
        
        if (this.config.debugMode) {
          console.log(`[SmallTalk] Interface '${iface.constructor.name}' stopped`);
        }
      } catch (error) {
        console.error(`[SmallTalk] Failed to stop interface '${iface.constructor.name}':`, error);
      }
    }

    // Disconnect MCP client
    if (this.mcpClient) {
      await this.mcpClient.disconnect();
    }

    this.isRunning = false;
    this.emit('framework_stopped');
    
    if (this.config.debugMode) {
      console.log('[SmallTalk] Framework stopped');
    }
  }

  public createSession(sessionId?: string): string {
    const id = sessionId || nanoid();
    const session: ChatSession = {
      id,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.activeSessions.set(id, session);
    this.emit('session_created', { sessionId: id });
    
    return id;
  }

  public getSession(sessionId: string): ChatSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  public deleteSession(sessionId: string): boolean {
    const deleted = this.activeSessions.delete(sessionId);
    if (deleted) {
      this.emit('session_deleted', { sessionId });
    }
    return deleted;
  }

  private async processMessage(content: string, sessionId?: string, userId?: string): Promise<string> {
    const session = sessionId ? this.getSession(sessionId) : this.createTempSession();
    if (!session) {
      throw new Error('Session not found');
    }

    const effectiveUserId = userId || sessionId || 'default';

    // Create user message
    const userMessage: ChatMessage = {
      id: nanoid(),
      role: 'user',
      content,
      timestamp: new Date()
    };

    session.messages.push(userMessage);
    session.updatedAt = new Date();

    // Check for agent switching commands
    const agentMatch = content.match(/^\/agent\s+(\w+)/);
    if (agentMatch) {
      const agentName = agentMatch[1];
      if (this.agents.has(agentName)) {
        session.activeAgent = agentName;
        this.currentAgents.set(effectiveUserId, agentName);
        return `Switched to agent: ${agentName}`;
      } else {
        return `Agent '${agentName}' not found. Available agents: ${this.listAgents().join(', ')}`;
      }
    }

    // Check for orchestration commands
    if (content.match(/^\/orchestration\s+(on|off)/)) {
      const command = content.match(/^\/orchestration\s+(on|off)/)?.[1];
      this.orchestrationEnabled = command === 'on';
      return `Orchestration ${this.orchestrationEnabled ? 'enabled' : 'disabled'}`;
    }

    let selectedAgentName: string;
    let handoffReason: string | null = null;

    // Use interactive orchestrator for enhanced planning and execution
    if (this.orchestrationEnabled && this.agents.size > 1) {
      try {
        const currentAgent = this.currentAgents.get(effectiveUserId) || session.activeAgent;
        const orchestrationResult = await this.orchestrator.orchestrateWithPlan(
          content, 
          effectiveUserId, 
          session.id, 
          currentAgent
        );
        
        if (!orchestrationResult.shouldExecute) {
          // Auto-response limit reached or other constraint
          return 'I\'ve reached the maximum number of automatic responses. Please let me know if you\'d like me to continue.';
        }

        if (orchestrationResult.plan) {
          // Execute the plan step by step
          const planExecuted = await this.orchestrator.executePlan(
            orchestrationResult.plan.id,
            session.id,
            effectiveUserId,
            this.streamingEnabled ? (response) => this.handleStreamingResponse(response) : undefined
          );
          
          if (planExecuted) {
            return 'Plan executed successfully. All agents have completed their tasks.';
          } else {
            return 'Plan execution was paused or failed. Please provide guidance to continue.';
          }
        } else if (orchestrationResult.handoff) {
          // Standard handoff
          selectedAgentName = orchestrationResult.handoff.targetAgent;
          handoffReason = orchestrationResult.handoff.reason;
          
          // Update current agent tracking
          this.currentAgents.set(effectiveUserId, selectedAgentName);
          session.activeAgent = selectedAgentName;
          
          this.emit('agent_handoff', {
            userId: effectiveUserId,
            fromAgent: currentAgent,
            toAgent: selectedAgentName,
            reason: handoffReason,
            confidence: orchestrationResult.handoff.confidence
          });
          
          if (this.config.debugMode) {
            console.log(`[SmallTalk] 🎯 Orchestrator: ${handoffReason}`);
          }
        } else {
          // Stay with current agent
          selectedAgentName = currentAgent || this.listAgents()[0];
        }
      } catch (error) {
        console.error('[SmallTalk] Interactive orchestration error:', error);
        // Fallback to current or first available agent
        selectedAgentName = this.currentAgents.get(effectiveUserId) || session.activeAgent || this.listAgents()[0];
      }
    } else {
      // Use current agent or default to first available
      selectedAgentName = this.currentAgents.get(effectiveUserId) || session.activeAgent || this.listAgents()[0];
    }

    const agent = selectedAgentName ? this.agents.get(selectedAgentName) : undefined;

    if (!agent) {
      return 'No agents available. Please add an agent to the framework.';
    }

    // Prepare context for agent
    const context: FlowContext = {
      session,
      message: userMessage,
      agent,
      tools: this.mcpClient?.getAvailableTools() || [],
      config: this.config
    };

    // Use enhanced history management
    const managedMessages = await this.memory.manageHistory(session.messages);
    const managedSession = { ...session, messages: managedMessages };
    const managedContext = { ...context, session: managedSession };

    // Generate response from agent
    try {
      let response = await agent.generateResponse(content, managedContext);
      
      // Add handoff explanation if orchestrator switched agents
      if (handoffReason && this.config.debugMode) {
        response = `🤖 *${agent.name}*: ${response}`;
      }
      
      // Create assistant message
      const assistantMessage: ChatMessage = {
        id: nanoid(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        agentName: agent.name
      };

      session.messages.push(assistantMessage);
      session.updatedAt = new Date();

      this.emit('message_processed', {
        sessionId: session.id,
        userMessage,
        assistantMessage,
        agentName: agent.name,
        orchestrated: !!handoffReason
      });

      return response;
    } catch (error) {
      const errorMessage = `Error generating response: ${error instanceof Error ? error.message : String(error)}`;
      
      if (this.config.debugMode) {
        console.error('[SmallTalk] Agent response error:', error);
      }

      return errorMessage;
    }
  }

  private createTempSession(): ChatSession {
    return {
      id: nanoid(),
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private async handleMessage(data: { content: string; sessionId?: string }): Promise<void> {
    try {
      await this.processMessage(data.content, data.sessionId);
    } catch (error) {
      console.error('[SmallTalk] Message handling error:', error);
    }
  }

  private handleAgentSwitch(data: { sessionId: string; agentName: string }): void {
    const session = this.getSession(data.sessionId);
    if (session && this.agents.has(data.agentName)) {
      session.activeAgent = data.agentName;
      session.updatedAt = new Date();
      
      if (this.config.debugMode) {
        console.log(`[SmallTalk] Session ${data.sessionId} switched to agent: ${data.agentName}`);
      }
    }
  }

  private handleSessionStart(data: { sessionId: string }): void {
    if (this.config.debugMode) {
      console.log(`[SmallTalk] Session started: ${data.sessionId}`);
    }
  }

  private handleSessionEnd(data: { sessionId: string }): void {
    this.deleteSession(data.sessionId);
    
    if (this.config.debugMode) {
      console.log(`[SmallTalk] Session ended: ${data.sessionId}`);
    }
  }

  // 🎯 Orchestration Methods
  
  public enableOrchestration(enabled: boolean = true): void {
    this.orchestrationEnabled = enabled;
    if (this.config.debugMode) {
      console.log(`[SmallTalk] Orchestration ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  public isOrchestrationEnabled(): boolean {
    return this.orchestrationEnabled;
  }

  public addHandoffRule(
    condition: (context: any, message: string) => boolean,
    targetAgent: string,
    priority: number = 0
  ): void {
    this.orchestrator.addHandoffRule(condition, targetAgent, priority);
  }

  public getOrchestrationStats(): any {
    return {
      enabled: this.orchestrationEnabled,
      totalAgents: this.agents.size,
      availableAgents: this.orchestrator.getAvailableAgents(),
      currentAgentAssignments: Object.fromEntries(this.currentAgents.entries())
    };
  }

  public getCurrentAgent(userId: string): string | undefined {
    return this.currentAgents.get(userId);
  }

  public forceAgentSwitch(userId: string, agentName: string): boolean {
    if (!this.agents.has(agentName)) {
      return false;
    }
    
    this.currentAgents.set(userId, agentName);
    // Reset auto-response count on manual switch
    this.orchestrator.resetAutoResponseCount(userId);
    
    this.emit('agent_forced_switch', { userId, agentName });
    
    if (this.config.debugMode) {
      console.log(`[SmallTalk] Forced agent switch for user ${userId} to ${agentName}`);
    }
    
    return true;
  }

  // Helper method to infer agent capabilities from agent properties
  private inferAgentCapabilities(agent: Agent): AgentCapabilities {
    const config = agent.config;
    
    // Extract expertise from agent properties
    const expertise = config.expertise || [];
    
    // Infer task types from personality and expertise
    const taskTypes: string[] = [];
    const personality = config.personality?.toLowerCase() || '';
    
    if (personality.includes('helpful') || personality.includes('supportive')) {
      taskTypes.push('assistance');
    }
    if (personality.includes('creative') || personality.includes('innovative')) {
      taskTypes.push('creative');
    }
    if (personality.includes('analytical') || personality.includes('precise')) {
      taskTypes.push('analysis');
    }
    if (personality.includes('educational') || personality.includes('teaching')) {
      taskTypes.push('educational');
    }
    if (expertise.some(exp => exp.includes('problem') || exp.includes('debug'))) {
      taskTypes.push('problem');
    }
    
    // Default to conversation if no specific task types identified
    if (taskTypes.length === 0) {
      taskTypes.push('conversation');
    }

    // Infer complexity level from expertise depth
    let complexity: 'basic' | 'intermediate' | 'advanced' | 'expert' = 'intermediate';
    if (expertise.length >= 5) {
      complexity = 'expert';
    } else if (expertise.length >= 3) {
      complexity = 'advanced';
    } else if (expertise.length <= 1) {
      complexity = 'basic';
    }

    // Get tool names
    const tools = config.tools?.map(tool => tool.name) || [];

    return {
      expertise,
      tools,
      personalityTraits: personality.split(',').map(trait => trait.trim()),
      taskTypes,
      complexity,
      contextAwareness: 0.8, // Default reasonable value
      collaborationStyle: 'collaborative' // Default style
    };
  }

  // Utility methods for framework management
  public getConfig(): Readonly<SmallTalkConfig> {
    return Object.freeze({ ...this.config });
  }

  public updateConfig(newConfig: Partial<SmallTalkConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('config_updated', { config: this.config });
  }

  // Enhanced streaming and interruption methods
  private handleStreamingResponse(response: StreamingResponse): void {
    // Broadcast streaming response to all interfaces that support it
    this.interfaces.forEach(iface => {
      if (iface.onStreamingMessage) {
        iface.onStreamingMessage(response.chunk, response.messageId);
      }
    });
    
    this.emit('streaming_response', response);
  }

  public enableStreaming(enabled: boolean = true): void {
    this.streamingEnabled = enabled;
    if (this.config.debugMode) {
      console.log(`[SmallTalk] Streaming ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  public enableInterruption(enabled: boolean = true): void {
    this.interruptionEnabled = enabled;
    if (this.config.debugMode) {
      console.log(`[SmallTalk] Interruption ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  public getActivePlans(): any[] {
    return this.orchestrator.getAllPlans();
  }

  public getPlan(planId: string): any {
    return this.orchestrator.getPlan(planId);
  }

  public pausePlan(planId: string): boolean {
    const plan = this.orchestrator.getPlan(planId);
    if (plan) {
      plan.status = 'paused';
      return true;
    }
    return false;
  }

  public resumePlan(planId: string, sessionId: string, userId: string): Promise<boolean> {
    const plan = this.orchestrator.getPlan(planId);
    if (plan && plan.status === 'paused') {
      plan.status = 'pending';
      return this.orchestrator.executePlan(planId, sessionId, userId);
    }
    return Promise.resolve(false);
  }

  public updateMaxAutoResponses(max: number): void {
    this.orchestrator.updateMaxAutoResponses(max);
  }

  public resetAutoResponseCount(userId: string): void {
    this.orchestrator.resetAutoResponseCount(userId);
  }

  public getAutoResponseCount(userId: string): number {
    return this.orchestrator.getAutoResponseCount(userId);
  }

  public getStats(): {
    agentCount: number;
    interfaceCount: number;
    activeSessionCount: number;
    isRunning: boolean;
    mcpEnabled: boolean;
    orchestrationStats: any;
    memoryStats: any;
    streamingEnabled: boolean;
    interruptionEnabled: boolean;
  } {
    return {
      agentCount: this.agents.size,
      interfaceCount: this.interfaces.length,
      activeSessionCount: this.activeSessions.size,
      isRunning: this.isRunning,
      mcpEnabled: !!this.mcpClient,
      orchestrationStats: this.orchestrator.getStats(),
      memoryStats: this.memory.getStats(),
      streamingEnabled: this.streamingEnabled,
      interruptionEnabled: this.interruptionEnabled
    };
  }
}