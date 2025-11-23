import { EventEmitter } from 'events';
import { nanoid } from 'nanoid';
import { readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import {
  SmallTalkConfig,
  SmallTalkFramework,
  BaseInterface,
  MCPServerConfig,
  ChatSession,
  ChatMessage,
  FlowContext,
  AgentManifest
} from '../types/index.js';
import { Agent } from '../agents/Agent.js';
import { Chat } from './Chat.js';
import { Memory } from './Memory.js';
import { MCPClient } from './MCPClient.js';
import { OrchestratorAgent, HandoffDecision, AgentCapabilities } from '../agents/OrchestratorAgent.js';
import { InteractiveOrchestratorAgent, PlanExecutionEvent, StreamingResponse } from '../agents/InteractiveOrchestratorAgent.js';
import { OrchestrationManager, OrchestrationConfig } from './OrchestrationManager.js';
import { ManifestParser } from '../utils/ManifestParser.js';
import { Agent as AgentClass } from '../agents/Agent.js';

export class SmallTalk extends EventEmitter implements SmallTalkFramework {
  private config: SmallTalkConfig;
  private agents: Map<string, Agent> = new Map();
  private interfaces: BaseInterface[] = [];
  private chat: Chat;
  private memory: Memory;
  private mcpClient?: MCPClient;
  private orchestrator: InteractiveOrchestratorAgent;
  private orchestrationManager?: OrchestrationManager;
  private isRunning = false;
  private activeSessions: Map<string, ChatSession> = new Map();
  private currentAgents: Map<string, string> = new Map(); // userId -> agentName
  private orchestrationEnabled = true;
  private streamingEnabled = false;
  private interruptionEnabled = false;
  private lastAnalysisResponse: string | null = null;

  constructor(config: SmallTalkConfig = {}) {
    super();
    
    this.config = {
      llmProvider: 'openai',
      model: 'gpt-4o-mini',
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

    this.orchestrator.on('agent_response', (event: any) => {
      // Monitor agent responses for limitations and trigger handoffs if needed
      this.monitorAgentResponse(event);
      
      // Forward agent responses to interfaces for immediate display
      this.interfaces.forEach(iface => {
        if (typeof (iface as any).displayAgentResponse === 'function') {
          (iface as any).displayAgentResponse(event);
        }
      });
      this.emit('agent_response', event);
    });

    this.orchestrator.on('analysis_response', (event: any) => {
      // Store the analysis response to return to user
      this.lastAnalysisResponse = event.response;
      this.emit('analysis_response', event);
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
    
    // Bridge agent events to orchestrator for monitoring
    agent.on('response_generated', (event: any) => {
      // Forward to orchestrator as 'agent_response' for monitoring
      this.orchestrator.emit('agent_response', event);
    });
    
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

  /**
   * Add agent from manifest file (YAML or JSON)
   */
  public async addAgentFromFile(filePath: string): Promise<Agent> {
    try {
      const parser = new ManifestParser();
      const manifest = parser.parseManifestFile(filePath);
      
      // Create agent from manifest config
      const agent = new AgentClass(manifest.config);
      
      // Add agent with capabilities if provided
      this.addAgent(agent, manifest.capabilities as AgentCapabilities);
      
      this.emit('agent_loaded_from_file', { 
        filePath, 
        agentName: agent.name, 
        manifest 
      });
      
      if (this.config.debugMode) {
        console.log(`[SmallTalk] Agent '${agent.name}' loaded from manifest: ${filePath}`);
      }
      
      return agent;
    } catch (error) {
      const errorMessage = `Failed to load agent from file ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
      
      if (this.config.debugMode) {
        console.error(`[SmallTalk] ${errorMessage}`);
      }
      
      throw new Error(errorMessage);
    }
  }

  /**
   * Load all agents from a directory containing manifest files
   */
  public async loadAgentsFromDirectory(dirPath: string, pattern?: RegExp): Promise<Agent[]> {
    const defaultPattern = /\.(yaml|yml|json)$/i;
    const filePattern = pattern || defaultPattern;
    const loadedAgents: Agent[] = [];
    const errors: string[] = [];
    
    try {
      const files = readdirSync(dirPath);
      const manifestFiles = files.filter(file => {
        const fullPath = join(dirPath, file);
        return statSync(fullPath).isFile() && filePattern.test(file);
      });
      
      if (manifestFiles.length === 0) {
        if (this.config.debugMode) {
          console.log(`[SmallTalk] No manifest files found in directory: ${dirPath}`);
        }
        return loadedAgents;
      }
      
      // Load each manifest file
      for (const file of manifestFiles) {
        try {
          const filePath = join(dirPath, file);
          const agent = await this.addAgentFromFile(filePath);
          loadedAgents.push(agent);
        } catch (error) {
          const errorMessage = `Failed to load ${file}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMessage);
          
          if (this.config.debugMode) {
            console.error(`[SmallTalk] ${errorMessage}`);
          }
        }
      }
      
      this.emit('agents_loaded_from_directory', { 
        dirPath, 
        loadedCount: loadedAgents.length,
        errorCount: errors.length,
        agentNames: loadedAgents.map(a => a.name)
      });
      
      if (this.config.debugMode) {
        console.log(`[SmallTalk] Loaded ${loadedAgents.length} agents from directory: ${dirPath}`);
        if (errors.length > 0) {
          console.log(`[SmallTalk] ${errors.length} files failed to load`);
        }
      }
      
      // If there were errors but some agents loaded successfully, log the errors but don't throw
      if (errors.length > 0 && loadedAgents.length === 0) {
        throw new Error(`Failed to load any agents from directory ${dirPath}:\n${errors.join('\n')}`);
      }
      
      return loadedAgents;
    } catch (error) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        throw new Error(`Directory not found: ${dirPath}`);
      }
      throw error;
    }
  }

  /**
   * Create agent manifest template file
   */
  public static createAgentManifestTemplate(agentName: string, format: 'yaml' | 'json' = 'yaml'): string {
    const template = ManifestParser.createTemplate(agentName);
    return format === 'yaml' ? ManifestParser.toYaml(template) : ManifestParser.toJson(template);
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
    const tools = await this.mcpClient.getAvailableTools();
    for (const agent of this.agents.values()) {
      for (const tool of tools) {
        agent.addTool(tool);
      }
    }

    this.emit('mcp_enabled', { servers: servers.map(s => s.name) });
  }

  public getMCPClient(): MCPClient {
    if (!this.mcpClient) {
      throw new Error('MCP client is not initialized. Please call enableMCP() first.');
    }
    return this.mcpClient;
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
    const agentMatch = content.match(/^\/agent\s+([\w-]+)/);
    if (agentMatch) {
      const agentName = agentMatch[1];
      if (this.agents.has(agentName)) {
        session.activeAgent = agentName;
        this.currentAgents.set(effectiveUserId, agentName);
        return `Switched to agent: ${agentName}`;
      } else {
        const availableAgents = this.listAgents();
        const suggestions = availableAgents.filter(name => 
          name.toLowerCase().includes(agentName.toLowerCase()) ||
          agentName.toLowerCase().includes(name.toLowerCase())
        );
        
        let errorMessage = `Agent '${agentName}' not found.`;
        
        if (suggestions.length > 0) {
          errorMessage += ` Did you mean: ${suggestions.join(', ')}?`;
        }
        
        errorMessage += ` Available agents: ${availableAgents.join(', ')}`;
        errorMessage += `\n💡 Tip: Agent names can contain letters, numbers, hyphens (-), and underscores (_)`;
        
        return errorMessage;
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
            // Return the intelligent analysis response if available
            const response = this.lastAnalysisResponse || '✅ Plan completed successfully.';
            this.lastAnalysisResponse = null; // Clear for next plan
            return response;
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
      tools: this.mcpClient ? await this.mcpClient.getAvailableTools() : [],
      config: this.config,
      mcpClient: this.mcpClient
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

  /**
   * Set advanced orchestration manager for reactive chains and team collaboration
   */
  public setOrchestrationManager(manager: OrchestrationManager): void {
    this.orchestrationManager = manager;
    if (this.config.debugMode) {
      console.log(`[SmallTalk] 🎼 Advanced orchestration manager configured`);
    }
  }

  /**
   * Get the advanced orchestration manager
   */
  public getOrchestrationManager(): OrchestrationManager | undefined {
    return this.orchestrationManager;
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

  /**
   * Monitor agent responses and trigger intelligent handoffs when limitations are detected
   */
  private async monitorAgentResponse(event: any): Promise<void> {
    if (!this.orchestrationEnabled || !event.response || !event.agentName) {
      return;
    }

    const response = event.response.toLowerCase();
    const currentAgent = event.agentName;
    const userId = event.userId || 'default';
    const sessionId = event.sessionId;

    // Detect when an agent admits limitations or information access issues
    const limitationPatterns = [
      "i don't have access to",
      "i can't access",
      "i don't have real-time",
      "i cannot retrieve",
      "i'm not able to look up",
      "i don't have current",
      "beyond my knowledge cutoff",
      "i cannot browse",
      "i don't have the ability to search"
    ];

    const needsInformation = limitationPatterns.some(pattern => response.includes(pattern));

    // Check if user is asking for information retrieval
    const lastUserMessage = event.userMessage?.toLowerCase() || '';
    const informationRequests = [
      'pull', 'search', 'find', 'look up', 'retrieve', 'get documentation', 
      'research', 'what does', 'latest', 'current', 'recent'
    ];
    const isInformationRequest = informationRequests.some(pattern => lastUserMessage.includes(pattern));

    if (needsInformation || (isInformationRequest && currentAgent !== 'RAGAgent')) {
      if (this.config.debugMode) {
        console.log(`[SmallTalk] 🎯 Parent Orchestrator: Detected information access limitation from ${currentAgent}`);
        if (needsInformation) console.log(`[SmallTalk] 🚨 Agent limitation detected: needs external information`);
        if (isInformationRequest) console.log(`[SmallTalk] 📋 Information request detected: should use RAGAgent`);
      }

      // Check if RAGAgent is available and has tools
      const ragAgent = this.agents.get('RAGAgent');
      if (ragAgent && ragAgent.listTools().length > 0) {
        if (this.config.debugMode) {
          console.log(`[SmallTalk] 🔄 Parent Orchestrator: Suggesting handoff to RAGAgent (${ragAgent.listTools().length} tools available)`);
        }

        // Force handoff to RAGAgent
        this.currentAgents.set(userId, 'RAGAgent');
        
        // Emit intervention event
        this.emit('orchestrator_intervention', {
          reason: needsInformation ? 'agent_limitation_detected' : 'information_request_detected',
          fromAgent: currentAgent,
          toAgent: 'RAGAgent',
          userId,
          sessionId,
          triggerResponse: event.response,
          userMessage: lastUserMessage
        });

        // Create a helpful intervention message
        let interventionMessage = '';
        if (needsInformation) {
          interventionMessage = `🎯 *Orchestrator*: I notice ${currentAgent} doesn't have access to external information. Let me hand this to RAGAgent who can search our knowledge base for current information.`;
        } else {
          interventionMessage = `🎯 *Orchestrator*: This looks like a research request. Let me connect you with RAGAgent who has access to our technical knowledge base.`;
        }

        // Log the intervention
        if (this.config.debugMode) {
          console.log(`[SmallTalk] ${interventionMessage}`);
        }

        // Store intervention for potential follow-up
        this.emit('intervention_message', {
          message: interventionMessage,
          userId,
          sessionId,
          timestamp: new Date()
        });
      }
    }
  }

  // Helper method to infer agent capabilities from agent properties
  private inferAgentCapabilities(agent: Agent): AgentCapabilities {
    const config = agent.config;
    
    // Enhanced expertise extraction from multiple sources
    const expertise: string[] = [];
    
    // Analyze agent name for domain expertise
    const name = config.name.toLowerCase();
    const nameExpertise = this.extractExpertiseFromName(name);
    expertise.push(...nameExpertise);
    
    // Analyze personality for detailed expertise
    const personality = config.personality?.toLowerCase() || '';
    const personalityExpertise = this.extractExpertiseFromPersonality(personality);
    expertise.push(...personalityExpertise);
    
    // Analyze tools for technical capabilities
    const tools = config.tools || [];
    const toolExpertise = this.extractExpertiseFromTools(tools as any[]);
    expertise.push(...toolExpertise);
    
    // Remove duplicates and ensure minimum expertise
    const uniqueExpertise = [...new Set(expertise)];
    if (uniqueExpertise.length === 0) {
      uniqueExpertise.push('general assistance');
    }
    
    // Enhanced task type inference
    const taskTypes = this.inferTaskTypes(name, personality, uniqueExpertise);
    
    // Smart complexity assessment
    const complexity = this.assessAgentComplexity(uniqueExpertise, personality, tools.length);
    
    // Context awareness based on role and expertise
    const contextAwareness = this.calculateContextAwareness(uniqueExpertise, personality);
    
    // Collaboration style from personality analysis
    const collaborationStyle = this.inferCollaborationStyle(personality, name);

    if (this.config.debugMode) {
      console.log(`[SmallTalk] 🧠 Inferred capabilities for ${config.name}:`);
      console.log(`[SmallTalk]   📚 Expertise: ${uniqueExpertise.join(', ')}`);
      console.log(`[SmallTalk]   🎯 Task Types: ${taskTypes.join(', ')}`);
      console.log(`[SmallTalk]   🏆 Complexity: ${complexity}`);
      console.log(`[SmallTalk]   🧠 Context Awareness: ${contextAwareness}`);
      console.log(`[SmallTalk]   🤝 Style: ${collaborationStyle}`);
    }

    return {
      expertise: uniqueExpertise,
      tools: tools.filter(tool => tool != null).map(tool => typeof tool === 'string' ? tool : String(tool)),
      personalityTraits: this.extractPersonalityTraits(personality),
      taskTypes,
      complexity,
      contextAwareness,
      collaborationStyle
    };
  }

  private extractExpertiseFromName(name: string): string[] {
    const expertise: string[] = [];
    
    // Business role mapping
    const roleMap = {
      'ceo': ['strategy', 'leadership', 'vision', 'decision making', 'business development'],
      'marketing': ['marketing', 'branding', 'digital marketing', 'customer behavior', 'campaigns'],
      'tech': ['technical', 'architecture', 'development', 'feasibility', 'technology'],
      'sales': ['sales', 'revenue', 'customer needs', 'negotiation', 'market demands'],
      'research': ['research', 'analysis', 'data', 'insights', 'competitive intelligence'],
      'project': ['project management', 'planning', 'coordination', 'timelines', 'risk management'],
      'finance': ['finance', 'budgeting', 'roi', 'financial analysis', 'cost management'],
      'lead': ['leadership', 'management', 'coordination', 'team management'],
      'manager': ['management', 'planning', 'coordination', 'leadership'],
      'director': ['strategic planning', 'leadership', 'vision', 'management'],
      'analyst': ['analysis', 'research', 'data analysis', 'insights'],
      'advisor': ['consultation', 'expertise', 'guidance', 'strategic advice']
    };
    
    // Check for role keywords in name
    for (const [role, skills] of Object.entries(roleMap)) {
      if (name.includes(role)) {
        expertise.push(...skills);
      }
    }
    
    // General skill keywords
    const skillKeywords = {
      'code': ['programming', 'development', 'coding'],
      'dev': ['development', 'programming', 'technical'],
      'write': ['writing', 'content creation', 'communication'],
      'creative': ['creativity', 'design', 'innovation'],
      'helper': ['assistance', 'support', 'guidance'],
      'assist': ['assistance', 'support', 'help'],
      'pro': ['professional', 'expert', 'advanced'],
      'chief': ['leadership', 'management', 'strategic']
    };
    
    for (const [keyword, skills] of Object.entries(skillKeywords)) {
      if (name.includes(keyword)) {
        expertise.push(...skills);
      }
    }
    
    return expertise;
  }

  private extractExpertiseFromPersonality(personality: string): string[] {
    const expertise: string[] = [];
    
    // Skill and domain extraction patterns
    const patterns = {
      'strategic': ['strategy', 'planning', 'vision'],
      'technical': ['technology', 'technical analysis', 'implementation'],
      'creative': ['creativity', 'innovation', 'design thinking'],
      'analytical': ['analysis', 'data analysis', 'research'],
      'marketing': ['marketing', 'branding', 'customer behavior'],
      'financial': ['finance', 'budgeting', 'cost analysis'],
      'leadership': ['leadership', 'management', 'team coordination'],
      'research': ['research', 'investigation', 'competitive analysis'],
      'sales': ['sales', 'customer relations', 'revenue generation'],
      'project': ['project management', 'coordination', 'planning'],
      'customer': ['customer service', 'client relations', 'user experience'],
      'data': ['data analysis', 'insights', 'metrics'],
      'business': ['business strategy', 'operations', 'development'],
      'educational': ['teaching', 'training', 'knowledge transfer'],
      'consulting': ['advisory', 'consultation', 'expertise']
    };
    
    for (const [pattern, skills] of Object.entries(patterns)) {
      if (personality.includes(pattern)) {
        expertise.push(...skills);
      }
    }
    
    // Extract specific business domains mentioned
    const domains = ['roi', 'scalability', 'competitive advantage', 'market opportunities', 
                    'brand positioning', 'digital marketing', 'architecture', 'feasibility',
                    'security', 'development timelines', 'customer value', 'revenue', 
                    'market research', 'trend identification', 'risk management'];
    
    for (const domain of domains) {
      if (personality.includes(domain)) {
        expertise.push(domain);
      }
    }
    
    return expertise;
  }

  private extractExpertiseFromTools(tools: any[]): string[] {
    const expertise: string[] = [];
    
    for (const tool of tools) {
      const toolName = typeof tool === 'string' ? tool : tool.name || '';
      const toolDesc = typeof tool === 'object' ? tool.description || '' : '';
      
      // Tool-based expertise mapping
      const toolMap: Record<string, string[]> = {
        'competitor_analysis': ['competitive intelligence', 'market analysis'],
        'market_sizing': ['market research', 'market analysis', 'business intelligence'],
        'budget_calculator': ['financial analysis', 'budgeting', 'cost management'],
        'risk_assessment': ['risk management', 'analysis', 'strategic planning'],
        'swot_analysis': ['strategic analysis', 'business strategy', 'competitive analysis']
      };
      
      const toolKey = toolName.toLowerCase();
      if (toolMap[toolKey]) {
        expertise.push(...toolMap[toolKey]);
      }
      
      // Extract expertise from tool descriptions
      if (toolDesc.includes('analysis')) expertise.push('analysis');
      if (toolDesc.includes('financial')) expertise.push('financial analysis');
      if (toolDesc.includes('market')) expertise.push('market research');
      if (toolDesc.includes('strategy')) expertise.push('strategic planning');
      if (toolDesc.includes('data')) expertise.push('data analysis');
    }
    
    return expertise;
  }

  private inferTaskTypes(name: string, personality: string, expertise: string[]): string[] {
    const taskTypes: string[] = [];
    
    // Task type inference from role and expertise
    const taskMapping = {
      'strategy': ['strategic', 'leadership', 'vision', 'planning'],
      'analysis': ['research', 'data', 'analysis', 'insights'],
      'creative': ['creative', 'design', 'content', 'innovation'],
      'technical': ['technical', 'development', 'architecture', 'implementation'],
      'sales': ['sales', 'customer', 'revenue', 'negotiation'],
      'marketing': ['marketing', 'branding', 'campaigns', 'promotion'],
      'financial': ['financial', 'budget', 'cost', 'roi'],
      'planning': ['project', 'planning', 'coordination', 'management'],
      'educational': ['teaching', 'training', 'educational', 'guidance'],
      'consultation': ['advisory', 'consultation', 'expertise']
    };
    
    const allText = `${name} ${personality} ${expertise.join(' ')}`.toLowerCase();
    
    for (const [taskType, keywords] of Object.entries(taskMapping)) {
      if (keywords.some(keyword => allText.includes(keyword))) {
        taskTypes.push(taskType);
      }
    }
    
    // Problem-solving task type
    if (expertise.some(exp => exp.includes('problem') || exp.includes('debug') || exp.includes('troubleshoot'))) {
      taskTypes.push('problem');
    }
    
    // Default to conversation if no specific types found
    if (taskTypes.length === 0) {
      taskTypes.push('conversation');
    }
    
    return [...new Set(taskTypes)];
  }

  private assessAgentComplexity(
    expertise: string[], 
    personality: string, 
    toolCount: number
  ): 'basic' | 'intermediate' | 'advanced' | 'expert' {
    let complexity = 0;
    
    // Expertise depth (40% of score)
    complexity += (expertise.length / 10) * 0.4; // Max 10 expertise areas
    
    // Advanced keywords in personality (30% of score)
    const advancedKeywords = ['strategic', 'expert', 'advanced', 'complex', 'sophisticated', 'comprehensive'];
    const advancedCount = advancedKeywords.filter(keyword => personality.includes(keyword)).length;
    complexity += (advancedCount / advancedKeywords.length) * 0.3;
    
    // Tool availability (20% of score)
    complexity += Math.min(toolCount / 5, 1) * 0.2; // Max 5 tools
    
    // Leadership/senior role indicators (10% of score)
    const seniorKeywords = ['lead', 'director', 'chief', 'head', 'senior', 'principal'];
    const seniorIndicator = seniorKeywords.some(keyword => personality.includes(keyword)) ? 1 : 0;
    complexity += seniorIndicator * 0.1;
    
    // Convert to categories
    if (complexity >= 0.8) return 'expert';
    if (complexity >= 0.6) return 'advanced';
    if (complexity >= 0.3) return 'intermediate';
    return 'basic';
  }

  private calculateContextAwareness(expertise: string[], personality: string): number {
    let awareness = 0.5; // Base level
    
    // Research and analytical roles have higher context awareness
    const analyticalSkills = ['research', 'analysis', 'data', 'insights', 'competitive intelligence'];
    const analyticalCount = expertise.filter(exp => 
      analyticalSkills.some(skill => exp.includes(skill))
    ).length;
    awareness += (analyticalCount / analyticalSkills.length) * 0.3;
    
    // Strategic roles need high context awareness
    if (expertise.some(exp => exp.includes('strategy') || exp.includes('strategic'))) {
      awareness += 0.2;
    }
    
    // Detail-oriented personalities
    if (personality.includes('detail') || personality.includes('thorough') || personality.includes('methodical')) {
      awareness += 0.1;
    }
    
    return Math.min(awareness, 1.0);
  }

  private inferCollaborationStyle(personality: string, name: string): 'independent' | 'collaborative' | 'supportive' | 'leading' {
    // Leadership indicators
    if (name.includes('ceo') || name.includes('director') || name.includes('chief') || name.includes('lead')) {
      return 'leading';
    }
    
    // Support role indicators
    if (personality.includes('support') || personality.includes('assist') || personality.includes('help')) {
      return 'supportive';
    }
    
    // Independent work indicators
    if (personality.includes('independent') || personality.includes('autonomous') || personality.includes('self-directed')) {
      return 'independent';
    }
    
    // Default to collaborative
    return 'collaborative';
  }

  private extractPersonalityTraits(personality: string): string[] {
    const traits: string[] = [];
    
    // Common personality trait patterns
    const traitPatterns = [
      'strategic', 'creative', 'analytical', 'detail-oriented', 'results-oriented',
      'data-driven', 'methodical', 'thorough', 'innovative', 'collaborative',
      'supportive', 'helpful', 'expert', 'professional', 'organized',
      'focused', 'decisive', 'flexible', 'proactive', 'efficient'
    ];
    
    for (const trait of traitPatterns) {
      if (personality.includes(trait)) {
        traits.push(trait);
      }
    }
    
    // Extract custom traits from personality description
    const sentences = personality.split(/[.!?]+/);
    for (const sentence of sentences) {
      const words = sentence.trim().split(/\s+/);
      if (words.length <= 3 && words.length > 0) {
        // Short phrases might be traits
        const potentialTrait = words.join(' ').toLowerCase().trim();
        if (potentialTrait.length > 0 && !traits.includes(potentialTrait)) {
          traits.push(potentialTrait);
        }
      }
    }
    
    return traits.slice(0, 8); // Limit to most relevant traits
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
      if ((iface as any).handleStreamingResponse) {
        (iface as any).handleStreamingResponse(response.chunk, response.messageId);
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