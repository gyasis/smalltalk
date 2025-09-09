# 📚 SmallTalk API Reference

**Complete API documentation for the SmallTalk framework core class.**

---

## 🏗️ SmallTalk Class

The main orchestrator class that manages agents, interfaces, and the overall application lifecycle.

### **Constructor**

```typescript
new SmallTalk(config: SmallTalkConfig)
```

#### Parameters

```typescript
interface SmallTalkConfig {
  // Agent Configuration
  agents?: Agent[];
  defaultAgent?: string;
  agentFactory?: AgentFactory;
  
  // LLM Configuration  
  llmProvider?: string;           // 'openai' | 'anthropic' | 'gemini' | etc.
  model?: string;                 // Model name (e.g., 'gpt-4o-mini', 'claude-3-5-sonnet')
  temperature?: number;           // 0.0 to 2.0, controls randomness
  maxTokens?: number;             // Maximum tokens per response
  
  // Interface Configuration
  interface?: 'cli' | 'web-api' | 'web-chat';
  port?: number;                  // Port for web interfaces (default: 3000)
  host?: string;                  // Host address (default: 'localhost')
  
  // Memory Configuration
  memory?: {
    type: 'in-memory' | 'file' | 'redis';
    maxMessages?: number;
    truncationStrategy?: 'oldest' | 'smart' | 'summary';
    persistence?: boolean;
  };
  
  // Tool Configuration
  tools?: ToolDefinition[];
  mcpServers?: MCPServerConfig[];
  
  // Advanced Options
  debug?: boolean;
  logging?: 'none' | 'basic' | 'detailed';
  errorHandling?: 'strict' | 'graceful';
  rateLimiting?: {
    enabled: boolean;
    requestsPerMinute: number;
  };
}
```

#### Example

```typescript
const app = new SmallTalk({
  agents: [professor, chatBuddy],
  llmProvider: 'openai',
  model: 'gpt-4o-mini',
  interface: 'web-chat',
  memory: {
    type: 'file',
    maxMessages: 100,
    truncationStrategy: 'smart'
  },
  debug: true
});
```

---

## 📡 Core Methods

### **start()**

Initializes and starts the SmallTalk application.

```typescript
async start(): Promise<void>
```

#### Example

```typescript
await app.start();
// Application is now running and ready to accept interactions
```

#### Behavior
- Initializes all agents and their tools
- Sets up the selected interface (CLI, web API, or web chat)
- Establishes LLM connections
- Starts listening for user interactions

---

### **stop()**

Gracefully shuts down the application.

```typescript
async stop(): Promise<void>
```

#### Example

```typescript
await app.stop();
// All connections closed, resources cleaned up
```

#### Behavior
- Closes all active connections
- Saves persistent memory to storage
- Cleans up resources and event listeners
- Shuts down web servers (if applicable)

---

### **chat()**

Send a message and get a response from the current agent.

```typescript
async chat(
  message: string, 
  options?: ChatOptions
): Promise<ChatResponse>
```

#### Parameters

```typescript
interface ChatOptions {
  agentName?: string;             // Specific agent to use
  stream?: boolean;               // Enable streaming response
  tools?: string[];               // Limit available tools
  context?: Record<string, any>;  // Additional context
  userId?: string;                // User identifier for memory
}

interface ChatResponse {
  content: string;
  agentName: string;
  toolCalls?: ToolCall[];
  metadata: {
    tokensUsed: number;
    responseTime: number;
    confidence: number;
  };
}
```

#### Example

```typescript
const response = await app.chat("Explain quantum computing", {
  agentName: 'professor',
  stream: false
});

console.log(response.content);
// "Quantum computing is a revolutionary approach to computation..."
```

---

### **chatStream()**

Get a streaming response for real-time interactions.

```typescript
async chatStream(
  message: string,
  onChunk: (chunk: string) => void,
  options?: ChatOptions
): Promise<ChatResponse>
```

#### Example

```typescript
await app.chatStream(
  "Tell me a story",
  (chunk) => process.stdout.write(chunk), // Stream to console
  { agentName: 'storyteller' }
);
```

---

## 🤖 Agent Management

### **addAgent()**

Add a new agent to the application.

```typescript
addAgent(agent: Agent): void
```

#### Example

```typescript
const newAgent = new Agent({
  name: 'Code Reviewer',
  personality: 'thorough, constructive, experienced'
});

app.addAgent(newAgent);
```

---

### **removeAgent()**

Remove an agent from the application.

```typescript
removeAgent(agentName: string): boolean
```

#### Example

```typescript
const removed = app.removeAgent('old-agent');
console.log(removed); // true if agent was found and removed
```

---

### **getAgent()**

Retrieve a specific agent by name.

```typescript
getAgent(agentName: string): Agent | undefined
```

#### Example

```typescript
const professor = app.getAgent('Professor Williams');
if (professor) {
  console.log(professor.personality);
}
```

---

### **listAgents()**

Get all available agents.

```typescript
listAgents(): Agent[]
```

#### Example

```typescript
const allAgents = app.listAgents();
allAgents.forEach(agent => {
  console.log(`${agent.name}: ${agent.expertise.join(', ')}`);
});
```

---

### **switchAgent()**

Switch to a different agent for subsequent interactions.

```typescript
switchAgent(agentName: string): boolean
```

#### Example

```typescript
const switched = app.switchAgent('Grammar Guru');
console.log(switched); // true if agent exists and switch was successful
```

---

## 🛠️ Tool Management

### **addTool()**

Add a new tool to the application.

```typescript
addTool(tool: ToolDefinition): void
```

#### Parameters

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  parameters: JSONSchema;
  handler: (params: any) => Promise<any>;
  agentAccess?: string[];        // Which agents can use this tool
  rateLimits?: {
    perMinute: number;
    perHour: number;
  };
}
```

#### Example

```typescript
app.addTool({
  name: 'weatherLookup',
  description: 'Get current weather for a location',
  parameters: {
    type: 'object',
    properties: {
      location: { type: 'string', description: 'City name' }
    },
    required: ['location']
  },
  handler: async ({ location }) => {
    const weather = await weatherAPI.getCurrent(location);
    return weather;
  }
});
```

---

### **removeTool()**

Remove a tool from the application.

```typescript
removeTool(toolName: string): boolean
```

---

### **listTools()**

Get all available tools.

```typescript
listTools(): ToolDefinition[]
```

---

## 💾 Memory Management

### **getMemory()**

Retrieve conversation memory for a user or session.

```typescript
getMemory(userId?: string): Memory
```

#### Example

```typescript
const userMemory = app.getMemory('user123');
console.log(userMemory.messages.length); // Number of stored messages
```

---

### **clearMemory()**

Clear conversation memory.

```typescript
clearMemory(userId?: string): void
```

#### Example

```typescript
// Clear specific user's memory
app.clearMemory('user123');

// Clear all memory
app.clearMemory();
```

---

### **saveMemory()**

Manually save memory to persistent storage.

```typescript
async saveMemory(userId?: string): Promise<void>
```

---

### **loadMemory()**

Load memory from persistent storage.

```typescript
async loadMemory(userId?: string): Promise<void>
```

---

## 🔧 Configuration Management

### **updateConfig()**

Update application configuration at runtime.

```typescript
updateConfig(newConfig: Partial<SmallTalkConfig>): void
```

#### Example

```typescript
app.updateConfig({
  llmProvider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  temperature: 0.8
});
```

---

### **getConfig()**

Get current configuration.

```typescript
getConfig(): SmallTalkConfig
```

---

### **resetConfig()**

Reset configuration to default values.

```typescript
resetConfig(): void
```

---

## 🌐 Interface Management

### **setInterface()**

Change the interface type at runtime.

```typescript
async setInterface(type: 'cli' | 'web-api' | 'web-chat'): Promise<void>
```

#### Example

```typescript
// Switch from CLI to web interface
await app.setInterface('web-chat');
```

---

### **getInterface()**

Get the current interface instance.

```typescript
getInterface(): BaseInterface
```

---

## 📊 Monitoring & Analytics

### **getStats()**

Get application statistics and metrics.

```typescript
getStats(): ApplicationStats
```

#### Returns

```typescript
interface ApplicationStats {
  conversations: {
    total: number;
    active: number;
    averageLength: number;
  };
  agents: {
    totalAgents: number;
    mostUsed: string;
    averageResponseTime: number;
  };
  llm: {
    totalTokens: number;
    totalCost: number;
    averageTokensPerResponse: number;
  };
  tools: {
    totalCalls: number;
    mostUsed: string;
    successRate: number;
  };
  uptime: number;
}
```

#### Example

```typescript
const stats = app.getStats();
console.log(`Total conversations: ${stats.conversations.total}`);
console.log(`Most used agent: ${stats.agents.mostUsed}`);
console.log(`Total cost: $${stats.llm.totalCost.toFixed(2)}`);
```

---

### **exportLogs()**

Export application logs for analysis.

```typescript
async exportLogs(
  format: 'json' | 'csv' | 'txt',
  timeRange?: { start: Date; end: Date }
): Promise<string>
```

---

## 🔍 Testing & Debugging

### **testConnection()**

Test LLM provider connection.

```typescript
async testConnection(): Promise<boolean>
```

#### Example

```typescript
const isConnected = await app.testConnection();
console.log(isConnected ? 'LLM connected' : 'Connection failed');
```

---

### **validateAgent()**

Validate an agent's configuration.

```typescript
validateAgent(agent: Agent): ValidationResult
```

#### Returns

```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}
```

---

### **debugMode()**

Enable or disable debug mode.

```typescript
debugMode(enabled: boolean): void
```

#### Example

```typescript
app.debugMode(true);  // Enable detailed logging
app.debugMode(false); // Disable debug output
```

---

## 🎯 Event System

### **on()**

Listen for application events.

```typescript
on(event: string, callback: Function): void
```

#### Available Events

```typescript
// Conversation Events
app.on('message:received', (message, userId) => { });
app.on('message:sent', (response, agentName) => { });
app.on('conversation:started', (userId) => { });
app.on('conversation:ended', (userId) => { });

// Agent Events  
app.on('agent:switched', (fromAgent, toAgent) => { });
app.on('agent:error', (agentName, error) => { });

// Tool Events
app.on('tool:called', (toolName, params) => { });
app.on('tool:completed', (toolName, result) => { });
app.on('tool:error', (toolName, error) => { });

// System Events
app.on('started', () => { });
app.on('stopped', () => { });
app.on('error', (error) => { });
```

#### Example

```typescript
app.on('message:received', (message, userId) => {
  console.log(`User ${userId} said: ${message}`);
});

app.on('tool:called', (toolName, params) => {
  console.log(`Tool ${toolName} called with:`, params);
});
```

---

### **emit()**

Emit custom events.

```typescript
emit(event: string, ...args: any[]): void
```

---

### **off()**

Remove event listeners.

```typescript
off(event: string, callback?: Function): void
```

---

## ⚡ Utility Methods

### **version()**

Get the SmallTalk framework version.

```typescript
static version(): string
```

#### Example

```typescript
console.log(SmallTalk.version()); // "0.1.0"
```

---

### **health()**

Get application health status.

```typescript
health(): HealthStatus
```

#### Returns

```typescript
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    llm: boolean;
    memory: boolean;
    interface: boolean;
    tools: boolean;
  };
  uptime: number;
  lastError?: string;
}
```

---

### **backup()**

Create a backup of the application state.

```typescript
async backup(): Promise<string>
```

#### Returns

Base64 encoded backup string that can be restored later.

---

### **restore()**

Restore application state from backup.

```typescript
async restore(backupData: string): Promise<void>
```

---

## 🔗 Advanced Integration

### **middleware()**

Add middleware for request/response processing.

```typescript
middleware(fn: MiddlewareFunction): void
```

#### Example

```typescript
app.middleware(async (message, context, next) => {
  // Log all incoming messages
  console.log(`[${new Date().toISOString()}] ${message}`);
  
  // Modify the message
  const modifiedMessage = message.toLowerCase();
  
  // Continue to the next middleware/agent
  const response = await next(modifiedMessage, context);
  
  // Modify the response
  return response.toUpperCase();
});
```

---

### **plugin()**

Add plugins for extended functionality.

```typescript
plugin(plugin: SmallTalkPlugin): void
```

#### Example

```typescript
const analyticsPlugin = {
  name: 'Analytics',
  install: (app) => {
    app.on('message:sent', (response) => {
      analytics.track('message_sent', { 
        length: response.length,
        agent: response.agentName 
      });
    });
  }
};

app.plugin(analyticsPlugin);
```

---

## 🎯 Complete Example

```typescript
import { SmallTalk, Agent } from 'smalltalk';

// Create agents
const teacher = new Agent({
  name: 'Teacher',
  personality: 'patient, encouraging, knowledgeable',
  expertise: ['education', 'learning'],
  tools: [exerciseGenerator, progressTracker]
});

// Configure application
const app = new SmallTalk({
  agents: [teacher],
  llmProvider: 'openai',
  model: 'gpt-4o-mini',
  interface: 'web-chat',
  memory: {
    type: 'file',
    maxMessages: 100
  },
  debug: true
});

// Add event listeners
app.on('conversation:started', (userId) => {
  console.log(`New conversation started with user ${userId}`);
});

app.on('tool:called', (toolName, params) => {
  console.log(`Tool ${toolName} called:`, params);
});

// Start the application
await app.start();
console.log('SmallTalk application is running!');

// Example interaction
const response = await app.chat("Help me learn about photosynthesis");
console.log(response.content);

// Get statistics
const stats = app.getStats();
console.log('Usage stats:', stats);
```

---

**🎉 You now have complete control over the SmallTalk framework!**

**Next steps:**
- **🤖 [Agent API Reference](./agent.md)** - Deep dive into Agent class
- **🛠️ [Tools API Reference](./tools.md)** - Build custom tools
- **🌐 [Interface API Reference](./interfaces.md)** - Customize interfaces
- **💾 [Memory API Reference](./memory.md)** - Advanced memory management