# SmallTalk Orchestration API Documentation

The SmallTalk orchestration system provides intelligent multi-agent collaboration through various coordination strategies. This API documentation covers all orchestration components, their interfaces, and practical usage patterns.

## Table of Contents

- [Overview](#overview)
- [Core Architecture](#core-architecture)
- [ReactiveChainOrchestrator](#reactivechainorchestrator)
- [TeamCollaborationOrchestrator](#teamcollaborationorchestrator) 
- [OrchestrationManager](#orchestrationmanager)
- [OrchestrationStrategy (Base Class)](#orchestrationstrategy-base-class)
- [Integration Guide](#integration-guide)
- [Complete API Reference](#complete-api-reference)
- [Examples](#examples)

## Overview

The SmallTalk orchestration system enables sophisticated multi-agent workflows through three primary strategies:

1. **ReactiveChainOrchestrator**: Sequential agent chains with evaluation-driven continuation (Agent1→Evaluate→Agent2→Evaluate→Agent3)
2. **TeamCollaborationOrchestrator**: Simultaneous multi-agent collaboration with different coordination patterns
3. **OrchestrationManager**: Unified coordination system that automatically selects the best strategy

### Key Features

- **Intelligent Strategy Selection**: Automatically chooses the best orchestration approach based on message complexity and agent capabilities
- **LLM-Powered Decision Making**: Uses sophisticated prompts to make orchestration decisions
- **Chain State Management**: Tracks multi-step agent sequences with evaluation checkpoints
- **Team Coordination**: Supports parallel, debate, consensus, and review collaboration patterns
- **Context Preservation**: maintains conversation context throughout orchestration flows

## Core Architecture

```typescript
// Core orchestration interfaces
interface OrchestrationContext {
  userId: string;
  message: string;
  conversationHistory: ChatMessage[];
  currentAgent?: string;
  availableAgents: Array<{
    agent: Agent;
    capabilities: AgentCapabilities;
  }>;
}

interface OrchestrationDecision {
  strategy: 'single' | 'chain' | 'team' | 'consensus' | 'specialized';
  primaryAgent: string;
  sequence?: Array<{
    agent: string;
    role: string;
    objective: string;
    contextToTransfer: Record<string, any>;
  }>;
  expectedFlow: string;
  confidence: number;
  reason: string;
  shouldContinueChain?: boolean;
  chainEvaluationPrompt?: string;
}
```

## ReactiveChainOrchestrator

The `ReactiveChainOrchestrator` implements sequential agent chains where each agent's response is evaluated to determine if the chain should continue and which agent should respond next.

### Purpose

Creates Agent1→Evaluate→Agent2→Evaluate→Agent3 reactive chains where:
- Each agent builds upon previous responses
- Orchestrator evaluates after each response using LLM analysis
- Chain continues until topic is fully addressed or evaluation determines completion
- Context is preserved and enhanced through the sequence

### Core Methods

#### Constructor

```typescript
constructor(llmConfig?: { 
  provider?: string; 
  model?: string; 
  apiKey?: string; 
})
```

**Parameters:**
- `llmConfig` (optional): LLM configuration for orchestration decisions
  - `provider`: LLM provider ('openai', 'anthropic', 'gemini', etc.)
  - `model`: Model name (e.g., 'gpt-4o-mini', 'claude-3-sonnet')
  - `apiKey`: API key (falls back to environment variables)

#### orchestrate()

```typescript
async orchestrate(context: OrchestrationContext): Promise<OrchestrationDecision>
```

Main orchestration decision making with sophisticated LLM analysis.

**Parameters:**
- `context`: Complete orchestration context including message, history, and available agents

**Returns:**
- `OrchestrationDecision`: Decision object containing strategy, agent selection, and sequence plan

**Example:**
```typescript
const orchestrator = new ReactiveChainOrchestrator({
  provider: 'openai',
  model: 'gpt-4o-mini'
});

const decision = await orchestrator.orchestrate({
  userId: 'user123',
  message: 'How should we approach this complex project?',
  conversationHistory: [...],
  availableAgents: [...agents]
});

console.log(decision);
// {
//   strategy: 'chain',
//   primaryAgent: 'TechLead',
//   sequence: [
//     { agent: 'TechLead', role: 'Technical analysis', objective: 'Assess technical feasibility' },
//     { agent: 'ProjectManager', role: 'Resource planning', objective: 'Plan execution strategy' },
//     { agent: 'CEO', role: 'Strategic approval', objective: 'Provide final strategic guidance' }
//   ],
//   expectedFlow: 'Technical analysis → Resource planning → Strategic approval',
//   confidence: 0.85,
//   reason: 'Complex project requiring sequential expertise building'
// }
```

#### evaluateChain()

```typescript
async evaluateChain(
  agentResponse: string,
  context: OrchestrationContext,
  chainState: ChainState
): Promise<ChainEvaluationResult>
```

Evaluates if chain should continue after an agent response.

**Parameters:**
- `agentResponse`: The response from the current agent
- `context`: Current orchestration context
- `chainState`: Current state of the chain

**Returns:**
- `ChainEvaluationResult`: Evaluation result with continuation decision

**Example:**
```typescript
const evaluation = await orchestrator.evaluateChain(
  "Based on my technical analysis, this project is feasible but will require significant database optimization.",
  context,
  chainState
);

console.log(evaluation);
// {
//   shouldContinue: true,
//   nextAgent: 'ProjectManager',
//   reason: 'Technical analysis complete, now need resource planning',
//   contextSummary: 'TechLead identified feasibility with database optimization needs',
//   isComplete: false
// }
```

### Chain State Management

#### ChainState Interface

```typescript
interface ChainState {
  sequence: Array<{
    agent: string;
    role: string;
    objective: string;
    response?: string;
    completed: boolean;
  }>;
  currentStep: number;
  conversationSummary: string;
  userQuery: string;
  isActive: boolean;
}
```

#### Utility Methods

```typescript
// Get active chain for user
getActiveChain(userId: string): ChainState | undefined

// Clear chain state for cleanup
clearChain(userId: string): void
```

### Example Usage Scenarios

#### Business Strategy Chain

```typescript
// Input: "What's our go-to-market strategy for the new product?"
// Output: CEO → MarketingLead → SalesChief chain

const context = {
  userId: 'business-user',
  message: "What's our go-to-market strategy for the new product?",
  conversationHistory: [],
  availableAgents: [ceo, marketingLead, salesChief]
};

const decision = await reactiveChain.orchestrate(context);
// Creates 3-step chain: Strategic overview → Marketing strategy → Sales execution
```

#### Technical Architecture Chain

```typescript
// Input: "How should we scale our backend to handle 10x traffic?"
// Output: TechLead → ProjectManager → CEO chain

const context = {
  userId: 'tech-user', 
  message: "How should we scale our backend to handle 10x traffic?",
  conversationHistory: [],
  availableAgents: [techLead, projectManager, ceo]
};

const decision = await reactiveChain.orchestrate(context);
// Creates chain: Technical assessment → Implementation planning → Strategic approval
```

## TeamCollaborationOrchestrator

The `TeamCollaborationOrchestrator` enables simultaneous multi-agent collaboration through different coordination patterns.

### Purpose

Implements simultaneous multi-agent collaboration with various coordination types:
- **Parallel**: Multiple agents respond independently, then synthesized
- **Debate**: Agents present different viewpoints for user consideration
- **Consensus**: Agents collaborate to reach unified agreement  
- **Review**: One agent proposes, others review and improve

### Core Methods

#### Constructor

```typescript
constructor(llmConfig?: { 
  provider?: string; 
  model?: string; 
  apiKey?: string; 
})
```

**Parameters:** Same as ReactiveChainOrchestrator

#### orchestrate()

```typescript
async orchestrate(context: OrchestrationContext): Promise<OrchestrationDecision>
```

Orchestrates team collaboration approach based on message analysis.

**Returns:**
- `OrchestrationDecision` with team collaboration strategy and participant assignments

**Example:**
```typescript
const teamOrchestrator = new TeamCollaborationOrchestrator();

const decision = await teamOrchestrator.orchestrate({
  userId: 'strategy-user',
  message: 'We need multiple perspectives on this product launch strategy',
  conversationHistory: [],
  availableAgents: [ceo, marketingLead, salesChief]
});

console.log(decision);
// {
//   strategy: 'team',
//   primaryAgent: 'CEO',
//   sequence: [
//     { agent: 'CEO', role: 'Strategic oversight', objective: 'Provide strategic direction' },
//     { agent: 'MarketingLead', role: 'Market positioning', objective: 'Define market approach' },
//     { agent: 'SalesChief', role: 'Revenue strategy', objective: 'Outline sales execution' }
//   ],
//   expectedFlow: 'Parallel team collaboration with strategic synthesis'
// }
```

### Collaboration Types and Patterns

#### Parallel Collaboration

Multiple agents contribute independently, responses are synthesized.

```typescript
// Best for: Comprehensive analysis requiring diverse expertise
// Example: "Analyze this business opportunity from all angles"
// Result: Marketing + Technical + Financial perspectives combined
```

#### Debate Collaboration  

Agents present contrasting viewpoints for user consideration.

```typescript
// Best for: Complex decisions with tradeoffs
// Example: "Should we build in-house or use a third-party solution?"
// Result: TechLead (build) vs ProjectManager (buy) perspectives
```

#### Consensus Collaboration

Agents work together to reach unified recommendation.

```typescript
// Best for: Decisions requiring team alignment
// Example: "What should our technology architecture be?"
// Result: TechLead + ProjectManager + CEO reaching consensus
```

#### Review Collaboration

One agent proposes, others review and improve the solution.

```typescript
// Best for: Solutions that need expert review
// Example: Technical design proposal that needs business validation
// Result: TechLead proposes → CEO + ProjectManager review and refine
```

### Team Composition Methods

#### createCollaborationPlan()

```typescript
createCollaborationPlan(
  agents: string[],
  collaborationType: 'parallel' | 'debate' | 'consensus' | 'review',
  context: OrchestrationContext
): TeamCollaborationPlan
```

Creates detailed collaboration plan with participant roles and expected outcomes.

**Example:**
```typescript
const plan = teamOrchestrator.createCollaborationPlan(
  ['CEO', 'MarketingLead', 'TechLead'],
  'parallel',
  context
);

console.log(plan);
// {
//   participants: [
//     { agent: 'CEO', role: 'Strategic oversight', perspective: 'High-level business impact', priority: 1 },
//     { agent: 'MarketingLead', role: 'Customer perspective', perspective: 'Market positioning', priority: 2 },
//     { agent: 'TechLead', role: 'Technical feasibility', perspective: 'Implementation viability', priority: 3 }
//   ],
//   collaborationType: 'parallel',
//   synthesisRequired: true,
//   expectedOutcome: 'Comprehensive response with 3 expert perspectives synthesized'
// }
```

### Example Usage Scenarios

#### Strategic Planning Team

```typescript
// Input: "What should our 2024 product roadmap prioritize?"
// Output: Parallel collaboration between CEO, MarketingLead, TechLead

const decision = await teamOrchestrator.orchestrate({
  userId: 'strategy-session',
  message: "What should our 2024 product roadmap prioritize?",
  conversationHistory: [],
  availableAgents: [ceo, marketingLead, techLead]
});
// Results in parallel strategy perspectives that get synthesized
```

#### Technical Decision Debate  

```typescript
// Input: "Should we use microservices or monolithic architecture?"
// Output: Debate between TechLead and ProjectManager perspectives

const decision = await teamOrchestrator.orchestrate({
  userId: 'tech-decision',
  message: "Should we use microservices or monolithic architecture?",
  conversationHistory: [],
  availableAgents: [techLead, projectManager]
});
// Results in debate format with contrasting architectural approaches
```

## OrchestrationManager

The `OrchestrationManager` serves as the unified orchestration coordinator that automatically selects the optimal strategy and manages multiple orchestration approaches.

### Purpose

- Unified orchestration coordinator across all strategies
- Intelligent strategy selection based on message analysis
- Agent capability registry and matching
- Configuration management for orchestration behavior

### Core Methods

#### Constructor

```typescript
constructor(config: OrchestrationConfig)
```

**Parameters:**
```typescript
interface OrchestrationConfig {
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
```

**Example:**
```typescript
const manager = new OrchestrationManager({
  defaultStrategy: 'adaptive',    // Automatically choose best strategy
  enableReactiveChains: true,     // Enable sequential agent chains
  enableTeamCollaboration: true,  // Enable team collaboration
  llmConfig: {
    provider: 'openai',
    model: 'gpt-4o-mini'
  },
  strategicPrompting: true,        // Use sophisticated prompts
  contextPreservation: true       // Maintain context across handoffs
});
```

#### registerAgent()

```typescript
registerAgent(agent: Agent, capabilities: AgentCapabilities): void
```

Registers agent with detailed capabilities for orchestration decisions.

**Parameters:**
- `agent`: Agent instance to register
- `capabilities`: Detailed capability specification

```typescript
interface AgentCapabilities {
  expertise: string[];
  complexity: string;
  taskTypes: string[];
  tools: string[];
  contextAwareness: number;
  collaborationStyle: string;
}
```

**Example:**
```typescript
manager.registerAgent(marketingLead, {
  expertise: ['marketing strategy', 'customer acquisition', 'brand positioning'],
  complexity: 'advanced',
  taskTypes: ['strategy', 'analysis', 'planning'],
  tools: ['marketAnalysis', 'customerSegmentation'],
  contextAwareness: 0.8,
  collaborationStyle: 'collaborative'
});
```

#### orchestrate()

```typescript
async orchestrate(
  message: string,
  userId: string,
  conversationHistory: ChatMessage[],
  currentAgent?: string
): Promise<OrchestrationDecision>
```

Main orchestration method that analyzes context and delegates to appropriate strategy.

**Parameters:**
- `message`: User message to orchestrate
- `userId`: User identifier for context tracking
- `conversationHistory`: Conversation history for context
- `currentAgent` (optional): Currently active agent

**Returns:**
- `OrchestrationDecision`: Complete orchestration decision with selected strategy

**Example:**
```typescript
const decision = await manager.orchestrate(
  "How should we approach this complex product launch strategy?",
  "user123",
  conversationHistory,
  "CurrentAgent"
);

console.log(decision);
// {
//   strategy: 'chain',           // Chose reactive chain strategy
//   primaryAgent: 'CEO',
//   sequence: [...],             // Multi-step chain sequence
//   expectedFlow: '...',
//   confidence: 0.85,
//   reason: 'Complex strategic topic requiring sequential expertise'
// }
```

### Strategy Selection Logic

#### Adaptive Strategy Selection

The `OrchestrationManager` analyzes messages to determine optimal strategy:

```typescript
// Message analysis factors:
interface MessageAnalysis {
  complexity: number;                    // 0-1 complexity score
  domains: string[];                     // Detected expertise domains
  requiresMultiplePerspectives: boolean; // Multiple viewpoints needed
  isStrategic: boolean;                  // Strategic decision indicator
  isCreative: boolean;                   // Creative task indicator
}

// Strategy selection rules:
// - Reactive Chain: complexity > 0.2 OR domains >= 2 OR strategic
// - Team Collaboration: requiresMultiplePerspectives AND (creative OR domains >= 3)
// - Single: Simple queries requiring one expert
```

#### Domain Detection Examples

```typescript
// Marketing domain
"customer acquisition strategy" → ['marketing']

// Technical + Strategic domains  
"scalable architecture for growth" → ['technical', 'strategic']

// Multi-domain complex topic
"product launch with technical and marketing considerations" → ['technical', 'marketing', 'strategic']
```

### Configuration Management

#### updateConfig()

```typescript
updateConfig(config: Partial<OrchestrationConfig>): void
```

Updates orchestration configuration and reinitializes strategies if needed.

**Example:**
```typescript
manager.updateConfig({
  defaultStrategy: 'team',           // Switch to team-first strategy
  enableReactiveChains: false,       // Disable chains temporarily
  llmConfig: {
    provider: 'anthropic',           // Switch LLM provider
    model: 'claude-3-sonnet'
  }
});
```

### Monitoring and Analytics

#### getStats()

```typescript
getStats(): {
  strategiesEnabled: number;
  agentsRegistered: number;
  configuration: OrchestrationConfig;
}
```

Returns orchestration system statistics.

**Example:**
```typescript
const stats = manager.getStats();
console.log(stats);
// {
//   strategiesEnabled: 2,              // ReactiveChain + TeamCollaboration
//   agentsRegistered: 4,               // Number of registered agents
//   configuration: { /* current config */ }
// }
```

#### getAvailableStrategies()

```typescript
getAvailableStrategies(): string[]
```

Returns list of currently enabled orchestration strategies.

#### getRegisteredAgents()

```typescript
getRegisteredAgents(): Array<{ agent: Agent; capabilities: AgentCapabilities }>
```

Returns all registered agents with their capabilities.

## OrchestrationStrategy (Base Class)

Abstract base class for all orchestration strategies providing common interfaces and utilities.

### Core Interface

```typescript
abstract class OrchestrationStrategy {
  protected name: string;
  
  constructor(name: string);
  
  // Must be implemented by subclasses
  abstract orchestrate(context: OrchestrationContext): Promise<OrchestrationDecision>;
  
  // Optional chain evaluation for strategies that support it
  evaluateChain?(
    agentResponse: string,
    context: OrchestrationContext,
    chainState: any
  ): Promise<ChainEvaluationResult>;
  
  // Utility methods available to all strategies
  protected generateChainContext(
    previousResponses: Array<{ agent: string; response: string }>,
    nextAgent: string,
    objective: string
  ): Record<string, any>;
  
  protected createOrchestrationPrompt(context: OrchestrationContext): string;
  
  getName(): string;
}
```

### Implementing Custom Strategies

Create custom orchestration strategies by extending the base class:

```typescript
class CustomOrchestrationStrategy extends OrchestrationStrategy {
  constructor() {
    super('CustomStrategy');
  }
  
  async orchestrate(context: OrchestrationContext): Promise<OrchestrationDecision> {
    // Custom orchestration logic
    return {
      strategy: 'specialized',
      primaryAgent: this.selectAgent(context),
      expectedFlow: 'Custom orchestration flow',
      confidence: 0.8,
      reason: 'Custom strategy reasoning'
    };
  }
  
  private selectAgent(context: OrchestrationContext): string {
    // Custom agent selection logic
    return context.availableAgents[0].agent.name;
  }
}

// Register with manager
const customStrategy = new CustomOrchestrationStrategy();
manager.strategies.set('custom', customStrategy);
```

### Utility Methods

#### generateChainContext()

```typescript
protected generateChainContext(
  previousResponses: Array<{ agent: string; response: string }>,
  nextAgent: string,
  objective: string
): Record<string, any>
```

Generates context object for next agent in chain, including conversation thread and continuity requirements.

#### createOrchestrationPrompt()

```typescript
protected createOrchestrationPrompt(context: OrchestrationContext): string
```

Creates sophisticated 1000-1500 token orchestration prompt with:
- Conversation context analysis
- Agent capability matrix
- Decision framework guidance
- Strategy selection criteria
- Quality assurance requirements

## Integration Guide

### Basic Setup

#### 1. Install and Configure SmallTalk

```typescript
import { SmallTalk } from 'smalltalk';
import { Agent } from 'smalltalk/agents';

const app = new SmallTalk({
  orchestration: true,           // Enable orchestration
  llmProvider: 'openai',
  model: 'gpt-4o-mini',
  debugMode: true               // See orchestration decisions
});
```

#### 2. Create Agents with Capabilities

```typescript
// Create specialized agents
const ceo = new Agent({
  name: 'CEO',
  personality: 'strategic, decisive, big-picture focused',
  expertise: ['business strategy', 'decision making', 'leadership']
});

const techLead = new Agent({
  name: 'TechLead', 
  personality: 'analytical, detail-oriented, solution-focused',
  expertise: ['software architecture', 'technical strategy', 'implementation']
});

// Define capabilities for orchestration
const ceoCapabilities = {
  expertise: ['business strategy', 'leadership', 'decision making'],
  complexity: 'expert',
  taskTypes: ['strategy', 'decision', 'leadership'],
  tools: ['strategicAnalysis'],
  contextAwareness: 0.9,
  collaborationStyle: 'leading'
};

const techCapabilities = {
  expertise: ['software architecture', 'technical implementation'],
  complexity: 'advanced', 
  taskTypes: ['technical', 'implementation', 'analysis'],
  tools: ['codeAnalysis', 'architectureDesign'],
  contextAwareness: 0.8,
  collaborationStyle: 'collaborative'
};
```

#### 3. Register Agents with Orchestration

```typescript
// Add agents with capabilities
app.addAgent(ceo, ceoCapabilities);
app.addAgent(techLead, techCapabilities);
```

#### 4. Configure Orchestration Strategies

```typescript
// Configure orchestration manager
const orchestrationConfig = {
  defaultStrategy: 'adaptive',        // Let system choose best strategy
  enableReactiveChains: true,         // Enable Agent1→Agent2→Agent3 chains
  enableTeamCollaboration: true,      // Enable parallel collaboration
  llmConfig: {
    provider: 'openai',
    model: 'gpt-4o-mini'
  },
  strategicPrompting: true,           // Use sophisticated prompts
  contextPreservation: true          // Maintain context across agents
};

app.setOrchestrationConfig(orchestrationConfig);
```

### Advanced Configuration

#### Custom Handoff Rules

```typescript
// Add domain-specific routing rules
app.addHandoffRule(
  (context, message) => message.includes('technical') || message.includes('architecture'),
  'TechLead',
  9  // High priority
);

app.addHandoffRule(
  (context, message) => message.includes('strategy') || message.includes('business'),
  'CEO',
  8
);
```

#### Strategy-Specific Configuration

```typescript
// Direct strategy access for advanced configuration
const manager = app.getOrchestrationManager();

// Get reactive chain orchestrator
const reactiveChain = manager.getStrategy('reactive') as ReactiveChainOrchestrator;

// Get team collaboration orchestrator  
const teamCollab = manager.getStrategy('team') as TeamCollaborationOrchestrator;

// Custom configuration...
```

### Event Monitoring

```typescript
// Monitor orchestration decisions
app.on('agent_handoff', (data) => {
  console.log(`🎯 Orchestration: ${data.fromAgent} → ${data.toAgent}`);
  console.log(`   Strategy: ${data.strategy}`);
  console.log(`   Reason: ${data.reason}`);
  console.log(`   Confidence: ${data.confidence}%`);
});

// Monitor chain progression  
app.on('chain_step_completed', (data) => {
  console.log(`✅ Chain Step: ${data.agent} completed`);
  console.log(`   Continuing: ${data.shouldContinue}`);
});

// Monitor team collaboration
app.on('team_collaboration_started', (data) => {
  console.log(`👥 Team Collaboration: ${data.participants.length} agents`);
  console.log(`   Type: ${data.collaborationType}`);
});
```

### Best Practices

#### Agent Capability Design

```typescript
// ✅ Good: Specific, non-overlapping capabilities
const designerCapabilities = {
  expertise: ['UI/UX design', 'user research', 'visual design'],
  complexity: 'advanced',
  taskTypes: ['creative', 'design', 'user-focused'],
  tools: ['designTools', 'userResearch'],
  contextAwareness: 0.7,
  collaborationStyle: 'collaborative'
};

// ❌ Avoid: Vague, overlapping capabilities  
const genericCapabilities = {
  expertise: ['general', 'various topics', 'helping'],
  complexity: 'intermediate',
  taskTypes: ['anything', 'general'],
  tools: [],
  contextAwareness: 0.5,
  collaborationStyle: 'generic'
};
```

#### Message Design for Orchestration

```typescript
// ✅ Good: Clear complexity and domain indicators
"How should we design a scalable microservices architecture for our e-commerce platform?"
// → Triggers reactive chain: TechLead → ProjectManager → CEO

"We need multiple perspectives on this product launch strategy"  
// → Triggers team collaboration: Marketing + Sales + Technical

// ❌ Avoid: Vague, unclear intent
"Help me with something"
// → Falls back to single agent routing
```

## Complete API Reference

### Interfaces

#### OrchestrationContext
```typescript
interface OrchestrationContext {
  userId: string;
  message: string;
  conversationHistory: ChatMessage[];
  currentAgent?: string;
  availableAgents: Array<{
    agent: Agent;
    capabilities: AgentCapabilities;
  }>;
}
```

#### OrchestrationDecision
```typescript
interface OrchestrationDecision {
  strategy: 'single' | 'chain' | 'team' | 'consensus' | 'specialized';
  primaryAgent: string;
  sequence?: Array<{
    agent: string;
    role: string;
    objective: string;
    contextToTransfer: Record<string, any>;
  }>;
  expectedFlow: string;
  confidence: number;
  reason: string;
  shouldContinueChain?: boolean;
  chainEvaluationPrompt?: string;
}
```

#### ChainEvaluationResult
```typescript
interface ChainEvaluationResult {
  shouldContinue: boolean;
  nextAgent?: string;
  reason: string;
  contextSummary: string;
  isComplete: boolean;
}
```

#### AgentCapabilities
```typescript
interface AgentCapabilities {
  expertise: string[];
  complexity: string;
  taskTypes: string[];
  tools: string[];
  contextAwareness: number;
  collaborationStyle: string;
}
```

#### OrchestrationConfig
```typescript
interface OrchestrationConfig {
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
```

### Classes

#### ReactiveChainOrchestrator

```typescript
class ReactiveChainOrchestrator extends OrchestrationStrategy {
  constructor(llmConfig?: LLMConfig);
  
  async orchestrate(context: OrchestrationContext): Promise<OrchestrationDecision>;
  
  async evaluateChain(
    agentResponse: string,
    context: OrchestrationContext,
    chainState: ChainState
  ): Promise<ChainEvaluationResult>;
  
  getActiveChain(userId: string): ChainState | undefined;
  
  clearChain(userId: string): void;
}
```

#### TeamCollaborationOrchestrator

```typescript
class TeamCollaborationOrchestrator extends OrchestrationStrategy {
  constructor(llmConfig?: LLMConfig);
  
  async orchestrate(context: OrchestrationContext): Promise<OrchestrationDecision>;
  
  createCollaborationPlan(
    agents: string[],
    collaborationType: 'parallel' | 'debate' | 'consensus' | 'review',
    context: OrchestrationContext
  ): TeamCollaborationPlan;
}
```

#### OrchestrationManager

```typescript
class OrchestrationManager {
  constructor(config: OrchestrationConfig);
  
  registerAgent(agent: Agent, capabilities: AgentCapabilities): void;
  
  async orchestrate(
    message: string,
    userId: string,
    conversationHistory: ChatMessage[],
    currentAgent?: string
  ): Promise<OrchestrationDecision>;
  
  updateConfig(config: Partial<OrchestrationConfig>): void;
  
  getAvailableStrategies(): string[];
  
  getStrategy(name: string): OrchestrationStrategy | undefined;
  
  getRegisteredAgents(): Array<{ agent: Agent; capabilities: AgentCapabilities }>;
  
  getStats(): {
    strategiesEnabled: number;
    agentsRegistered: number;
    configuration: OrchestrationConfig;
  };
}
```

### Events

The orchestration system emits various events for monitoring and analytics:

#### Orchestration Events
```typescript
// Agent handoff
app.on('agent_handoff', (data: {
  fromAgent: string;
  toAgent: string;
  strategy: string;
  reason: string;
  confidence: number;
  userId: string;
}) => {});

// Chain events
app.on('chain_started', (data: { chainId: string; userId: string; sequence: any[] }) => {});
app.on('chain_step_completed', (data: { chainId: string; agent: string; shouldContinue: boolean }) => {});
app.on('chain_completed', (data: { chainId: string; totalSteps: number }) => {});

// Team collaboration events
app.on('team_collaboration_started', (data: { participants: string[]; collaborationType: string }) => {});
app.on('team_response_synthesized', (data: { participants: string[]; synthesisMethod: string }) => {});
```

## Examples

### Complete Business Meeting Orchestration

```typescript
import { SmallTalk, Agent } from 'smalltalk';

// Create business meeting agents
const ceo = new Agent({
  name: 'CEO',
  personality: 'strategic, decisive, visionary',
  expertise: ['business strategy', 'leadership', 'vision']
});

const cto = new Agent({
  name: 'CTO',
  personality: 'technical, analytical, innovative',  
  expertise: ['technology strategy', 'architecture', 'innovation']
});

const cmo = new Agent({
  name: 'CMO',
  personality: 'customer-focused, creative, data-driven',
  expertise: ['marketing strategy', 'brand positioning', 'customer acquisition']
});

// Configure orchestrated meeting
const meetingApp = new SmallTalk({
  orchestration: true,
  llmProvider: 'openai',
  model: 'gpt-4o-mini'
});

// Add agents with business-specific capabilities
meetingApp.addAgent(ceo, {
  expertise: ['strategic planning', 'decision making', 'business vision'],
  complexity: 'expert',
  taskTypes: ['strategy', 'leadership', 'decision'],
  tools: ['strategicAnalysis', 'businessModeling'],
  contextAwareness: 0.9,
  collaborationStyle: 'leading'
});

meetingApp.addAgent(cto, {
  expertise: ['technology roadmap', 'technical architecture', 'innovation'],
  complexity: 'expert', 
  taskTypes: ['technical', 'strategic', 'innovation'],
  tools: ['technicalAnalysis', 'architectureDesign'],
  contextAwareness: 0.9,
  collaborationStyle: 'collaborative'
});

meetingApp.addAgent(cmo, {
  expertise: ['market strategy', 'customer insights', 'brand development'],
  complexity: 'expert',
  taskTypes: ['marketing', 'strategy', 'creative'],
  tools: ['marketResearch', 'brandAnalysis'],
  contextAwareness: 0.8,
  collaborationStyle: 'collaborative'
});

// Configure for complex business discussions
meetingApp.setOrchestrationConfig({
  defaultStrategy: 'adaptive',
  enableReactiveChains: true,
  enableTeamCollaboration: true,
  strategicPrompting: true,
  contextPreservation: true
});

await meetingApp.start();

// Example orchestrated business conversations:

// 1. Strategic Planning Chain
// "What should our 2024 growth strategy focus on?"
// → CEO (strategic overview) → CMO (market analysis) → CTO (technical enablement)

// 2. Team Collaboration  
// "We need all perspectives on this new product opportunity"
// → CEO + CMO + CTO (parallel analysis with synthesis)

// 3. Technical Decision Chain
// "How should we approach this technology modernization?"
// → CTO (technical strategy) → CEO (business impact) → CMO (customer impact)
```

### Educational Platform Orchestration

```typescript
import { SmallTalk, Agent } from 'smalltalk';

// Educational agents with different teaching approaches
const professor = new Agent({
  name: 'Professor',
  personality: 'academic, thorough, theoretical',
  expertise: ['computer science theory', 'algorithms', 'academic research']
});

const tutor = new Agent({
  name: 'Tutor',
  personality: 'patient, encouraging, practical',
  expertise: ['beginner support', 'practical examples', 'motivation']
});

const mentor = new Agent({
  name: 'Mentor',
  personality: 'experienced, industry-focused, career-oriented',
  expertise: ['industry experience', 'career guidance', 'real-world applications']
});

const educationApp = new SmallTalk({
  orchestration: true,
  llmProvider: 'openai',
  model: 'gpt-4o-mini'
});

// Educational capability definitions
educationApp.addAgent(professor, {
  expertise: ['theoretical foundations', 'algorithm analysis', 'academic concepts'],
  complexity: 'expert',
  taskTypes: ['educational', 'theoretical', 'analysis'],
  tools: ['academicExamples', 'theoreticalProofs'],
  contextAwareness: 0.9,
  collaborationStyle: 'leading'
});

educationApp.addAgent(tutor, {
  expertise: ['beginner concepts', 'step-by-step guidance', 'encouragement'],
  complexity: 'basic',
  taskTypes: ['educational', 'support', 'guidance'],
  tools: ['simpleExamples', 'progressTracking'],
  contextAwareness: 0.8,
  collaborationStyle: 'supportive'
});

educationApp.addAgent(mentor, {
  expertise: ['career guidance', 'industry insights', 'practical applications'],
  complexity: 'advanced',
  taskTypes: ['career', 'practical', 'guidance'],
  tools: ['industryExamples', 'careerAdvice'],
  contextAwareness: 0.7,
  collaborationStyle: 'collaborative'
});

// Educational routing rules
educationApp.addHandoffRule(
  (context, message) => message.includes('beginner') || message.includes('just started'),
  'Tutor',
  10
);

educationApp.addHandoffRule(
  (context, message) => message.includes('theory') || message.includes('algorithm'),
  'Professor', 
  8
);

educationApp.addHandoffRule(
  (context, message) => message.includes('career') || message.includes('industry'),
  'Mentor',
  7
);

await educationApp.start();

// Example educational orchestration:

// 1. Beginner Chain
// "I'm new to programming, where should I start?"
// → Tutor (encouragement) → Professor (foundations) → Mentor (career path)

// 2. Complex Theory Team
// "Explain sorting algorithms from multiple perspectives"  
// → Professor + Tutor + Mentor (theoretical + practical + career perspectives)

// 3. Career Planning Chain
// "How do I transition from student to professional developer?"
// → Mentor (industry insights) → Professor (skill gaps) → Tutor (learning plan)
```

### Technical Support Orchestration

```typescript
import { SmallTalk, Agent } from 'smalltalk';

// Technical support team with specialized roles
const l1Support = new Agent({
  name: 'L1 Support',
  personality: 'helpful, patient, systematic',
  expertise: ['basic troubleshooting', 'common issues', 'user guidance']
});

const l2Support = new Agent({
  name: 'L2 Support', 
  personality: 'analytical, detail-oriented, technical',
  expertise: ['advanced troubleshooting', 'system analysis', 'complex issues']
});

const engineer = new Agent({
  name: 'Engineer',
  personality: 'expert, solution-focused, innovative',
  expertise: ['system architecture', 'deep technical issues', 'custom solutions']
});

const supportApp = new SmallTalk({
  orchestration: true,
  llmProvider: 'openai',
  model: 'gpt-4o-mini'
});

// Support tier capabilities
supportApp.addAgent(l1Support, {
  expertise: ['basic issues', 'user guidance', 'standard procedures'],
  complexity: 'basic',
  taskTypes: ['support', 'guidance', 'troubleshooting'],
  tools: ['ticketSystem', 'knowledgeBase'],
  contextAwareness: 0.6,
  collaborationStyle: 'supportive'
});

supportApp.addAgent(l2Support, {
  expertise: ['complex troubleshooting', 'system analysis', 'escalated issues'],
  complexity: 'advanced',
  taskTypes: ['analysis', 'troubleshooting', 'investigation'],
  tools: ['diagnosticTools', 'systemAnalysis'],
  contextAwareness: 0.8,
  collaborationStyle: 'collaborative'
});

supportApp.addAgent(engineer, {
  expertise: ['architecture', 'custom solutions', 'system design'],
  complexity: 'expert',
  taskTypes: ['engineering', 'design', 'innovation'],
  tools: ['developmentTools', 'architectureDesign'],
  contextAwareness: 0.9,
  collaborationStyle: 'leading'
});

// Escalation rules
supportApp.addHandoffRule(
  (context, message) => message.includes('simple') || message.includes('basic'),
  'L1 Support',
  10
);

supportApp.addHandoffRule(
  (context, message) => message.includes('complex') || message.includes('system'),
  'L2 Support',
  8  
);

supportApp.addHandoffRule(
  (context, message) => message.includes('architecture') || message.includes('design'),
  'Engineer',
  9
);

await supportApp.start();

// Example support orchestration:

// 1. Escalation Chain
// "I'm having a complex system performance issue"  
// → L1 Support (initial triage) → L2 Support (analysis) → Engineer (solution)

// 2. Team Collaboration
// "We need multiple perspectives on this critical system failure"
// → L2 Support + Engineer (parallel technical analysis)

// 3. Solution Development Chain
// "This issue requires a custom solution"
// → Engineer (solution design) → L2 Support (implementation planning) → L1 Support (rollout)
```

---

## Summary

The SmallTalk orchestration system provides powerful multi-agent coordination capabilities through:

- **ReactiveChainOrchestrator**: Sequential agent chains with intelligent continuation evaluation
- **TeamCollaborationOrchestrator**: Parallel and collaborative multi-agent patterns
- **OrchestrationManager**: Unified coordination with adaptive strategy selection
- **Extensible Architecture**: Custom strategies through abstract base classes

Key benefits:
- **Intelligent Routing**: LLM-powered decision making for optimal agent selection
- **Context Preservation**: Maintains conversation flow across agent handoffs  
- **Flexible Strategies**: Support for sequential, parallel, and hybrid collaboration patterns
- **Real-time Adaptation**: Dynamic strategy selection based on message complexity
- **Comprehensive Monitoring**: Detailed events and analytics for orchestration tracking

The system enables sophisticated multi-agent workflows while maintaining simplicity for developers through high-level APIs and intelligent automation.