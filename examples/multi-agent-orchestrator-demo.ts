import { SmallTalk, Agent } from 'smalltalk-ai';
import { CLIInterface } from 'smalltalk-ai';

// Advanced Multi-Agent Orchestrator Demo
// Demonstrates sophisticated turn-taking, context-aware routing, and seamless agent coordination

class ConversationOrchestrator {
  private conversationState: Map<string, ConversationState> = new Map();
  private agentPerformance: Map<string, AgentPerformance> = new Map();
  
  constructor(private smallTalk: SmallTalk) {
    this.initializeOrchestration();
  }
  
  private async initializeOrchestration() {
    // Set up orchestration event listeners
    this.smallTalk.on('message:received', this.handleMessageReceived.bind(this));
    this.smallTalk.on('agent:response', this.handleAgentResponse.bind(this));
    this.smallTalk.on('conversation:state:updated', this.handleStateUpdate.bind(this));
  }
  
  private async handleMessageReceived(data: { sessionId: string, message: string, user: string }) {
    const { sessionId, message, user } = data;
    
    // Get or create conversation state
    let state = this.conversationState.get(sessionId);
    if (!state) {
      state = this.createNewConversationState(sessionId, user);
      this.conversationState.set(sessionId, state);
    }
    
    // Update conversation state
    state.history.push({
      role: 'user',
      content: message,
      timestamp: Date.now(),
      metadata: { user }
    });
    
    // Analyze message and determine orchestration strategy
    const orchestrationDecision = await this.makeOrchestrationDecision(state, message);
    
    // Execute orchestration decision
    await this.executeOrchestrationDecision(sessionId, orchestrationDecision);
  }
  
  private async makeOrchestrationDecision(
    state: ConversationState, 
    message: string
  ): Promise<OrchestrationDecision> {
    
    // Build comprehensive orchestration prompt
    const orchestrationPrompt = `
## Multi-Agent Orchestration Decision

### Current Conversation State:
- **Session ID**: ${state.sessionId}
- **Turn Number**: ${state.history.length}
- **Current Agent**: ${state.currentAgent || 'none'}
- **User Intent**: ${JSON.stringify(state.userIntent)}
- **Conversation Complexity**: ${state.complexity}
- **User Satisfaction**: ${state.satisfaction}
- **Conversation Phase**: ${state.phase}

### Recent Conversation History:
${JSON.stringify(state.history.slice(-5))}

### User's Current Message:
"${message}"

### Available Agents:
${JSON.stringify(this.getAvailableAgents())}

### Agent Performance Data:
${JSON.stringify(this.getAgentPerformanceData())}

### Orchestration Decision Framework:

#### 1. Agent Selection Analysis:
- **Expertise Match**: Which agent's expertise best aligns with the current need?
- **Context Continuity**: Which agent can best maintain conversation flow?
- **User Satisfaction**: Which agent will best meet user expectations?
- **Performance History**: Which agent has performed best in similar situations?

#### 2. Turn-Taking Analysis:
- **Response Timing**: Should we respond immediately, quickly, or with delay?
- **Response Type**: Direct answer, clarification, collaboration, or handoff?
- **Conversation Flow**: Is this a natural continuation or topic shift?

#### 3. Context Transfer Analysis:
- **Required Information**: What context needs to be transferred?
- **User Preferences**: What user preferences should be maintained?
- **Conversation State**: What is the current conversation state?

### Required Response Format:
{
  "orchestrationDecision": {
    "selectedAgent": "agent_id",
    "confidence": 0.95,
    "reasoning": {
      "primaryReason": "Most relevant expertise for current need",
      "supportingFactors": ["factor1", "factor2"],
      "alternativesConsidered": [
        {
          "agent": "alternative_agent_id",
          "reasonRejected": "Less relevant expertise"
        }
      ]
    },
    "handoffStrategy": {
      "type": "seamless|explicit|collaborative",
      "contextTransfer": {
        "required": true,
        "keyPoints": ["critical information to transfer"],
        "userPreferences": ["user preferences to maintain"],
        "conversationState": "current state summary"
      },
      "instructions": "Specific instructions for the selected agent"
    },
    "expectedOutcome": {
      "responseType": "immediate|delayed|collaborative",
      "userExperience": "What the user should expect",
      "successMetrics": ["how to measure success"]
    }
  },
  "turnTakingDecision": {
    "shouldRespond": true,
    "responseTiming": {
      "type": "immediate|quick|delayed|collaborative",
      "delay": 0,
      "reason": "Natural conversation flow requires immediate response"
    },
    "responseStrategy": {
      "approach": "direct|collaborative|handoff|synthesis",
      "style": "conversational|formal|empathetic|analytical",
      "length": "brief|moderate|detailed|comprehensive",
      "tone": "helpful|urgent|patient|encouraging"
    }
  },
  "contextManagement": {
    "contextUpdates": {
      "newInformation": ["new facts discovered"],
      "userPreferences": ["preferences identified"],
      "taskProgress": "progress made on user's goal"
    },
    "contextPreservation": {
      "criticalContext": ["context that must be preserved"],
      "contextCompression": "how to compress context if needed"
    }
  },
  "monitoring": {
    "watchFor": ["user satisfaction", "conversation flow", "agent performance"],
    "escalationTriggers": ["user confusion", "agent conflict", "context loss"],
    "successMetrics": ["response relevance", "user engagement", "task progress"]
  }
}

### Quality Assurance Checklist:
- [ ] Agent selection is optimal for current need
- [ ] Context transfer will be smooth
- [ ] User expectations will be met
- [ ] Conversation flow will be maintained
- [ ] Performance metrics support this choice

Respond with valid JSON only.
`;

    try {
      const response = await this.smallTalk.chat(orchestrationPrompt, {
        mode: 'json',
        temperature: 0.3,
        maxTokens: 2000
      });
      
      return JSON.parse(response);
    } catch (error) {
      console.error('Orchestration decision failed:', error);
      return this.getFallbackDecision(state);
    }
  }
  
  private async executeOrchestrationDecision(
    sessionId: string, 
    decision: OrchestrationDecision
  ): Promise<void> {
    
    const state = this.conversationState.get(sessionId);
    if (!state) return;
    
    // Update conversation state
    state.currentAgent = decision.orchestrationDecision.selectedAgent;
    state.lastOrchestrationDecision = decision;
    
    // Prepare context transfer
    const contextTransfer = this.prepareContextTransfer(state, decision);
    
    // Route message to selected agent
    await this.routeToAgent(sessionId, decision, contextTransfer);
    
    // Update performance metrics
    this.updatePerformanceMetrics(decision);
    
    // Log orchestration decision
    console.log(`🎯 Orchestration Decision: ${decision.orchestrationDecision.selectedAgent}`);
    console.log(`   Confidence: ${decision.orchestrationDecision.confidence}`);
    console.log(`   Reasoning: ${decision.orchestrationDecision.reasoning.primaryReason}`);
  }
  
  private prepareContextTransfer(
    state: ConversationState, 
    decision: OrchestrationDecision
  ): ContextTransfer {
    
    return {
      conversationSummary: this.summarizeConversation(state.history),
      userIntent: state.userIntent,
      keyInformation: {
        facts: this.extractFacts(state.history),
        preferences: state.userPreferences,
        constraints: state.constraints
      },
      conversationState: {
        currentTopic: state.currentTopic,
        pendingTasks: state.pendingTasks,
        userSatisfaction: state.satisfaction
      },
      handoffInstructions: decision.orchestrationDecision.handoffStrategy.instructions
    };
  }
  
  private async routeToAgent(
    sessionId: string, 
    decision: OrchestrationDecision, 
    contextTransfer: ContextTransfer
  ): Promise<void> {
    
    const agentId = decision.orchestrationDecision.selectedAgent;
    const agent = this.smallTalk.getAgent(agentId);
    
    if (!agent) {
      console.error(`Agent ${agentId} not found`);
      return;
    }
    
    // Build agent-specific prompt with context transfer
    const agentPrompt = `
## Context-Aware Agent Response

### Context Transfer:
${JSON.stringify(contextTransfer)}

### Current User Message:
"${this.getCurrentUserMessage(sessionId)}"

### Your Role:
You are ${agent.name}, a ${agent.personality} agent with expertise in ${agent.expertise.join(', ')}.

### Context Continuity:
- Build upon previous agent's work seamlessly
- Acknowledge context and previous contributions
- Maintain conversation continuity
- Add value through your specific expertise
- Prepare for potential handoff to other agents

### Response Guidelines:
- **Style**: ${decision.turnTakingDecision.responseStrategy.style}
- **Length**: ${decision.turnTakingDecision.responseStrategy.length}
- **Tone**: ${decision.turnTakingDecision.responseStrategy.tone}
- **Approach**: ${decision.turnTakingDecision.responseStrategy.approach}

### Response Format:
{
  "response": "Your response to the user",
  "collaborationNotes": "Notes for other agents",
  "handoffReadiness": "ready|needsMoreInfo|complete",
  "suggestedNextAgent": "agent_id or null",
  "contextUpdates": {
    "newInformation": ["new facts discovered"],
    "userPreferences": ["preferences identified"],
    "taskProgress": "progress made on user's goal"
  }
}

### Collaboration Principles:
- Acknowledge previous work: "Building on what was discussed..."
- Add unique value: "From my perspective as a ${agent.name}..."
- Maintain continuity: "Continuing our discussion about..."
- Prepare handoffs: "This might be better handled by..."

Respond with valid JSON only.
`;

    try {
      const response = await this.smallTalk.chat(agentPrompt, {
        agent: agentId,
        mode: 'json',
        temperature: 0.7
      });
      
      const agentResponse = JSON.parse(response);
      
      // Update conversation state with agent response
      this.updateConversationState(sessionId, agentResponse);
      
      // Send response to user
      await this.sendResponseToUser(sessionId, agentResponse.response);
      
    } catch (error) {
      console.error('Agent response failed:', error);
      await this.handleAgentError(sessionId, error);
    }
  }
  
  private updateConversationState(sessionId: string, agentResponse: any): void {
    const state = this.conversationState.get(sessionId);
    if (!state) return;
    
    // Add agent response to history
    state.history.push({
      role: 'assistant',
      content: agentResponse.response,
      timestamp: Date.now(),
      metadata: {
        agent: state.currentAgent,
        collaborationNotes: agentResponse.collaborationNotes,
        contextUpdates: agentResponse.contextUpdates
      }
    });
    
    // Update context based on agent response
    if (agentResponse.contextUpdates) {
      this.updateContextFromAgentResponse(state, agentResponse.contextUpdates);
    }
    
    // Update conversation phase
    state.phase = this.determineConversationPhase(state);
    
    // Update complexity and satisfaction
    state.complexity = this.calculateComplexity(state);
    state.satisfaction = this.calculateSatisfaction(state);
  }
  
  private async sendResponseToUser(sessionId: string, response: string): Promise<void> {
    // Send response through SmallTalk interface
    await this.smallTalk.sendMessage(sessionId, response);
  }
  
  // Utility methods
  private createNewConversationState(sessionId: string, user: string): ConversationState {
    return {
      sessionId,
      user,
      history: [],
      currentAgent: null,
      userIntent: { primary: 'unknown', secondary: [], confidence: 0 },
      complexity: 0.5,
      satisfaction: 0.5,
      phase: 'opening',
      userPreferences: [],
      constraints: [],
      currentTopic: null,
      pendingTasks: [],
      lastOrchestrationDecision: null,
      metadata: {}
    };
  }
  
  private getAvailableAgents(): Agent[] {
    return this.smallTalk.getAgents();
  }
  
  private getAgentPerformanceData(): any {
    return Object.fromEntries(this.agentPerformance);
  }
  
  private getCurrentUserMessage(sessionId: string): string {
    const state = this.conversationState.get(sessionId);
    if (!state || state.history.length === 0) return '';
    
    const lastUserMessage = state.history
      .filter(msg => msg.role === 'user')
      .pop();
    
    return lastUserMessage?.content || '';
  }
  
  private summarizeConversation(history: Message[]): string {
    // Implement conversation summarization logic
    return history.map(msg => `${msg.role}: ${msg.content}`).join('\n');
  }
  
  private extractFacts(history: Message[]): string[] {
    // Implement fact extraction logic
    return [];
  }
  
  private determineConversationPhase(state: ConversationState): ConversationPhase {
    // Implement phase determination logic
    return 'exploration';
  }
  
  private calculateComplexity(state: ConversationState): number {
    // Implement complexity calculation logic
    return 0.5;
  }
  
  private calculateSatisfaction(state: ConversationState): number {
    // Implement satisfaction calculation logic
    return 0.5;
  }
  
  private updateContextFromAgentResponse(state: ConversationState, updates: any): void {
    // Implement context update logic
  }
  
  private updatePerformanceMetrics(decision: OrchestrationDecision): void {
    // Implement performance tracking logic
  }
  
  private getFallbackDecision(state: ConversationState): OrchestrationDecision {
    // Implement fallback decision logic
    return {
      orchestrationDecision: {
        selectedAgent: 'default-agent',
        confidence: 0.5,
        reasoning: { primaryReason: 'Fallback decision', supportingFactors: [], alternativesConsidered: [] },
        handoffStrategy: { type: 'seamless', contextTransfer: { required: false, keyPoints: [], userPreferences: [], conversationState: '' }, instructions: '' },
        expectedOutcome: { responseType: 'immediate', userExperience: 'Standard response', successMetrics: [] }
      },
      turnTakingDecision: {
        shouldRespond: true,
        responseTiming: { type: 'immediate', delay: 0, reason: 'Fallback' },
        responseStrategy: { approach: 'direct', style: 'conversational', length: 'moderate', tone: 'helpful' }
      },
      contextManagement: { contextUpdates: { newInformation: [], userPreferences: [], taskProgress: '' }, contextPreservation: { criticalContext: [], contextCompression: '' } },
      monitoring: { watchFor: [], escalationTriggers: [], successMetrics: [] }
    };
  }
  
  private async handleAgentResponse(data: any): Promise<void> {
    // Handle agent response events
  }
  
  private async handleStateUpdate(data: any): Promise<void> {
    // Handle conversation state updates
  }
  
  private async handleAgentError(sessionId: string, error: any): Promise<void> {
    // Handle agent errors gracefully
    console.error(`Agent error in session ${sessionId}:`, error);
    await this.sendResponseToUser(sessionId, "I apologize, but I encountered an error. Let me try to help you in a different way.");
  }
}

// Type definitions
interface ConversationState {
  sessionId: string;
  user: string;
  history: Message[];
  currentAgent: string | null;
  userIntent: UserIntent;
  complexity: number;
  satisfaction: number;
  phase: ConversationPhase;
  userPreferences: string[];
  constraints: string[];
  currentTopic: string | null;
  pendingTasks: string[];
  lastOrchestrationDecision: OrchestrationDecision | null;
  metadata: Record<string, any>;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface UserIntent {
  primary: string;
  secondary: string[];
  confidence: number;
}

type ConversationPhase = 'opening' | 'exploration' | 'problem-solving' | 'resolution' | 'closing';

interface OrchestrationDecision {
  orchestrationDecision: {
    selectedAgent: string;
    confidence: number;
    reasoning: {
      primaryReason: string;
      supportingFactors: string[];
      alternativesConsidered: Array<{
        agent: string;
        reasonRejected: string;
      }>;
    };
    handoffStrategy: {
      type: 'seamless' | 'explicit' | 'collaborative';
      contextTransfer: {
        required: boolean;
        keyPoints: string[];
        userPreferences: string[];
        conversationState: string;
      };
      instructions: string;
    };
    expectedOutcome: {
      responseType: 'immediate' | 'delayed' | 'collaborative';
      userExperience: string;
      successMetrics: string[];
    };
  };
  turnTakingDecision: {
    shouldRespond: boolean;
    responseTiming: {
      type: 'immediate' | 'quick' | 'delayed' | 'collaborative';
      delay: number;
      reason: string;
    };
    responseStrategy: {
      approach: 'direct' | 'collaborative' | 'handoff' | 'synthesis';
      style: 'conversational' | 'formal' | 'empathetic' | 'analytical';
      length: 'brief' | 'moderate' | 'detailed' | 'comprehensive';
      tone: 'helpful' | 'urgent' | 'patient' | 'encouraging';
    };
  };
  contextManagement: {
    contextUpdates: {
      newInformation: string[];
      userPreferences: string[];
      taskProgress: string;
    };
    contextPreservation: {
      criticalContext: string[];
      contextCompression: string;
    };
  };
  monitoring: {
    watchFor: string[];
    escalationTriggers: string[];
    successMetrics: string[];
  };
}

interface ContextTransfer {
  conversationSummary: string;
  userIntent: UserIntent;
  keyInformation: {
    facts: string[];
    preferences: string[];
    constraints: string[];
  };
  conversationState: {
    currentTopic: string | null;
    pendingTasks: string[];
    userSatisfaction: number;
  };
  handoffInstructions: string;
}

interface AgentPerformance {
  responseQuality: number;
  userSatisfaction: number;
  taskCompletionRate: number;
  responseTime: number;
  contextRetention: number;
}

// Create the SmallTalk application with advanced orchestration
const app = new SmallTalk({
  llmProvider: 'openai',
  model: 'gpt-4o-mini',
  orchestration: true,
  debugMode: true
});

// Create specialized agents
const researchAgent = new Agent({
  name: 'Research Assistant',
  personality: 'thorough, analytical, detail-oriented',
  expertise: ['research', 'analysis', 'data gathering', 'fact-checking'],
  systemPrompt: `You are a Research Assistant with expertise in gathering and analyzing information. 
  You excel at finding relevant data, verifying facts, and providing comprehensive analysis. 
  You work well with other agents by providing detailed research and supporting evidence.`
});

const codingAgent = new Agent({
  name: 'Senior Developer',
  personality: 'practical, experienced, solution-focused',
  expertise: ['programming', 'software architecture', 'debugging', 'best practices'],
  systemPrompt: `You are a Senior Developer with extensive experience in software development. 
  You excel at writing clean code, solving complex problems, and providing practical solutions. 
  You work well with other agents by implementing solutions and providing technical guidance.`
});

const businessAgent = new Agent({
  name: 'Business Analyst',
  personality: 'strategic, analytical, business-focused',
  expertise: ['business analysis', 'strategy', 'market research', 'decision making'],
  systemPrompt: `You are a Business Analyst with expertise in business strategy and analysis. 
  You excel at understanding business requirements, analyzing markets, and making strategic recommendations. 
  You work well with other agents by providing business context and strategic insights.`
});

const designAgent = new Agent({
  name: 'UX Designer',
  personality: 'creative, user-focused, empathetic',
  expertise: ['user experience', 'interface design', 'user research', 'usability'],
  systemPrompt: `You are a UX Designer with expertise in user experience and interface design. 
  You excel at understanding user needs, creating intuitive designs, and improving usability. 
  You work well with other agents by providing user-centered perspectives and design insights.`
});

// Add agents to SmallTalk
app.addAgent(researchAgent);
app.addAgent(codingAgent);
app.addAgent(businessAgent);
app.addAgent(designAgent);

// Initialize the conversation orchestrator
const orchestrator = new ConversationOrchestrator(app);

// Add CLI interface
app.addInterface(new CLIInterface({
  prompt: '🎯 Multi-Agent Orchestrator: ',
  colors: true,
  commands: {
    '/agents': 'Show available agents',
    '/orchestration': 'Show orchestration status',
    '/context': 'Show current conversation context',
    '/performance': 'Show agent performance metrics'
  }
}));

// Export for CLI usage
export default app;

// Playground configuration
export const playgroundConfig = {
  port: 4002,
  host: 'localhost',
  title: '🎯 Multi-Agent Conversation Orchestrator',
  description: 'Advanced orchestration with intelligent turn-taking and context-aware routing',
  orchestrationMode: true,
  enableChatUI: true
};

// Universal pattern for ES modules with playground support
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    if (process.env.SMALLTALK_PLAYGROUND_MODE === 'true') {
      console.log('🌐 Starting Multi-Agent Orchestrator Playground...');
      console.log('🎯 Advanced orchestration with intelligent turn-taking');
      console.log('🤖 Multiple specialized agents with seamless coordination');
    } else {
      console.log('🎯 Multi-Agent Conversation Orchestrator');
      console.log('=====================================');
      console.log('🤖 Available Agents:');
      console.log('   • Research Assistant - Research and analysis');
      console.log('   • Senior Developer - Programming and technical solutions');
      console.log('   • Business Analyst - Business strategy and analysis');
      console.log('   • UX Designer - User experience and design');
      console.log('');
      console.log('💡 Try these orchestrated conversations:');
      console.log('   • "I need to build a web app for my business"');
      console.log('   • "Research the latest trends in AI and create a business plan"');
      console.log('   • "Design a user-friendly interface for a complex system"');
      console.log('   • "Debug this code and improve the user experience"');
      console.log('');
      console.log('🎯 The orchestrator will automatically route your messages to the most appropriate agent!');
    }
    
    await app.start();
  })();
}

