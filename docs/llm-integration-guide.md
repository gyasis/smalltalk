# SmallTalk Framework - LLM Integration Guide

**Target Audience**: LLMs/AI Agents building web applications  
**Purpose**: Technical reference for integrating SmallTalk as a component into web applications

---

## 🎯 Framework Overview

SmallTalk is a TypeScript framework for building intelligent LLM applications with automatic agent orchestration. It can be integrated as a component into existing web applications to provide AI chat capabilities.

### Core Architecture Components

```typescript
// Core classes and their relationships
SmallTalk (Main Framework)
├── OrchestratorAgent (Intelligent Routing)
├── Memory (History & Context Management)  
├── Chat (Conversation Management)
├── Agent[] (Multiple AI Agents)
└── Interface (CLI/Web/API)
```

---

## 🔧 Programmatic API Integration

### Basic Framework Setup

```typescript
import { SmallTalk, Agent, WebChatInterface } from 'smalltalk';

// 1. Create framework instance
const smalltalk = new SmallTalk({
  llmProvider: 'openai',           // or 'anthropic', 'gemini', etc.
  model: 'gpt-4o-mini',                 // provider-specific model
  orchestration: true,             // Enable intelligent agent routing
  debugMode: false,                // Production setting
  maxTokens: 4000,                 // Response length limit
  temperature: 0.7                 // Creativity level
});

// 2. Create specialized agents
const supportAgent = new Agent({
  name: 'SupportAgent',
  personality: 'helpful, professional, solution-focused',
  expertise: ['customer service', 'troubleshooting', 'account management'],
  systemPrompt: 'You are a customer support specialist...',
  tools: [
    {
      name: 'searchKnowledgeBase',
      description: 'Search internal knowledge base for solutions',
      parameters: { query: 'string', category: 'string' },
      handler: async (params) => {
        // Your knowledge base integration
        return await knowledgeBase.search(params.query, params.category);
      }
    }
  ]
});

// 3. Register agent with capabilities for orchestration
smalltalk.addAgent(supportAgent, {
  expertise: ['customer service', 'troubleshooting'],
  complexity: 'intermediate',
  taskTypes: ['support', 'assistance'],
  contextAwareness: 0.9,
  collaborationStyle: 'supportive'
});

// 4. Export configured instance for use in components
export default smalltalk;
```

### Agent Orchestration System

The orchestrator automatically routes conversations to the most suitable agent based on:

```typescript
// Orchestration scoring factors
interface OrchestrationContext {
  userMessage: string;             // Current user input
  conversationHistory: Message[]; // Previous messages
  userIntent: string[];           // Detected intentions
  complexity: number;             // Message complexity (0-1)
  topicSimilarity: number;        // Relevance to agent expertise
  userSatisfaction: number;       // Previous interaction quality
}

// Agent capability matching
interface AgentCapabilities {
  expertise: string[];            // Knowledge domains
  complexity: 'basic' | 'intermediate' | 'advanced';
  taskTypes: string[];           // Types of tasks agent handles
  tools: Tool[];                 // Available functions/APIs
  personalityTraits: string[];   // Behavioral characteristics
  contextAwareness: number;      // How well agent uses context (0-1)
  collaborationStyle: 'independent' | 'collaborative' | 'supportive' | 'leading';
}

// Orchestrator selection process
const orchestrator = smalltalk.getOrchestrator();
const selectedAgent = await orchestrator.selectAgent({
  message: userInput,
  context: conversationHistory,
  availableAgents: registeredAgents,
  selectionStrategy: 'best_match' // or 'round_robin', 'weighted'
});
```

### Memory & History Management

```typescript
// SmallTalk memory system manages context automatically
interface MemoryConfig {
  maxTokens: number;              // Total context window
  maxMessages: number;            // Message count limit
  strategy: 'sliding_window' | 'summarization' | 'selective_retention';
  importance_threshold: number;   // Keep messages above this score
  summarization_trigger: number;  // When to summarize (token count)
}

// Configure memory management
smalltalk.configureMemory({
  maxTokens: 8000,
  maxMessages: 50,
  strategy: 'selective_retention',
  importance_threshold: 0.6,
  summarization_trigger: 7000
});

// Access conversation history
const history = smalltalk.getConversationHistory(sessionId);
const context = smalltalk.getContextSummary(sessionId);

// Manual memory operations
await smalltalk.addToMemory(sessionId, {
  role: 'user',
  content: 'User message',
  timestamp: new Date(),
  importance: 0.8
});

await smalltalk.clearMemory(sessionId);
await smalltalk.exportMemory(sessionId); // For backup/analysis
```

---

## 🌐 Web Component Integration

### React Component Integration

```typescript
// SmallTalkChat.tsx - React component
import React, { useEffect, useRef, useState } from 'react';
import { SmallTalk, WebChatInterface } from 'smalltalk';

interface SmallTalkChatProps {
  agents: Agent[];
  config?: SmallTalkConfig;
  onMessage?: (message: ChatMessage) => void;
  sessionId?: string;
  height?: string;
  width?: string;
}

export const SmallTalkChat: React.FC<SmallTalkChatProps> = ({
  agents,
  config = {},
  onMessage,
  sessionId = 'default',
  height = '500px',
  width = '100%'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [smalltalk, setSmallTalk] = useState<SmallTalk | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeSmallTalk();
  }, []);

  const initializeSmallTalk = async () => {
    try {
      // Create SmallTalk instance
      const st = new SmallTalk({
        llmProvider: config.llmProvider || 'openai',
        model: config.model || 'gpt-4o-mini',
        orchestration: true,
        sessionId,
        ...config
      });

      // Add agents
      agents.forEach(agent => st.addAgent(agent));

      // Create embedded web interface
      const webInterface = new WebChatInterface({
        embedded: true,                    // Important: embedded mode
        container: containerRef.current,   // DOM container
        height,
        width,
        showHeader: false,                 // Integrate with your UI
        enableFileUpload: true,
        enableVoiceInput: false,
        theme: 'light',                    // or 'dark', 'auto'
        onMessage: (msg) => {
          onMessage?.(msg);
        }
      });

      st.addInterface(webInterface);
      await st.start();
      
      setSmallTalk(st);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to initialize SmallTalk:', error);
      setIsLoading(false);
    }
  };

  return (
    <div 
      ref={containerRef}
      style={{ height, width, border: '1px solid #ddd', borderRadius: '8px' }}
    >
      {isLoading && <div>Loading SmallTalk...</div>}
    </div>
  );
};

// Usage in your React app
const MyApp = () => {
  const agents = [
    new Agent({
      name: 'Assistant',
      personality: 'helpful and knowledgeable'
    })
  ];

  return (
    <div>
      <h1>My Web App</h1>
      <SmallTalkChat 
        agents={agents}
        config={{ llmProvider: 'openai', model: 'gpt-4o-mini' }}
        onMessage={(msg) => console.log('New message:', msg)}
        height="400px"
      />
    </div>
  );
};
```

### Vanilla JavaScript Integration

```typescript
// For non-React applications
class SmallTalkWidget {
  private smalltalk: SmallTalk;
  private container: HTMLElement;

  constructor(containerId: string, config: SmallTalkConfig) {
    this.container = document.getElementById(containerId);
    this.initializeWidget(config);
  }

  private async initializeWidget(config: SmallTalkConfig) {
    // Create SmallTalk instance
    this.smalltalk = new SmallTalk({
      llmProvider: config.llmProvider,
      model: config.model,
      orchestration: true
    });

    // Add your agents
    config.agents?.forEach(agentConfig => {
      const agent = new Agent(agentConfig);
      this.smalltalk.addAgent(agent);
    });

    // Create embedded interface
    const webInterface = new WebChatInterface({
      embedded: true,
      container: this.container,
      height: config.height || '400px',
      width: config.width || '100%',
      theme: config.theme || 'light'
    });

    this.smalltalk.addInterface(webInterface);
    await this.smalltalk.start();
  }

  // Public API methods
  public async sendMessage(message: string, sessionId?: string): Promise<string> {
    return await this.smalltalk.chat(message, sessionId);
  }

  public getHistory(sessionId?: string): ChatMessage[] {
    return this.smalltalk.getConversationHistory(sessionId);
  }

  public async clearChat(sessionId?: string): Promise<void> {
    await this.smalltalk.clearMemory(sessionId);
  }

  public destroy(): void {
    this.smalltalk.stop();
  }
}

// Usage
const widget = new SmallTalkWidget('chat-container', {
  llmProvider: 'openai',
  model: 'gpt-4o-mini',
  agents: [
    {
      name: 'Support',
      personality: 'helpful customer support agent'
    }
  ]
});
```

---

## 🔌 REST API Integration

### Standalone API Server

```typescript
// api-server.ts - Standalone SmallTalk API
import express from 'express';
import cors from 'cors';
import { SmallTalk, Agent } from 'smalltalk';

const app = express();
app.use(cors());
app.use(express.json());

// Initialize SmallTalk
const smalltalk = new SmallTalk({
  llmProvider: 'openai',
  model: 'gpt-4o-mini',
  orchestration: true
});

// Add agents
const agents = [
  new Agent({
    name: 'GeneralAssistant',
    personality: 'helpful and knowledgeable general assistant'
  }),
  new Agent({
    name: 'TechnicalSupport', 
    personality: 'technical expert focused on problem-solving'
  })
];

agents.forEach(agent => smalltalk.addAgent(agent));

// API Endpoints
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId = 'default', userId } = req.body;
    
    const response = await smalltalk.chat(message, sessionId, {
      userId,
      metadata: req.body.metadata
    });
    
    res.json({
      success: true,
      response: response.content,
      agentName: response.agentName,
      sessionId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/agents', (req, res) => {
  const agentList = smalltalk.listAgents().map(name => ({
    name,
    agent: smalltalk.getAgent(name),
    capabilities: smalltalk.getAgentCapabilities(name)
  }));
  
  res.json(agentList);
});

app.get('/api/history/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const history = smalltalk.getConversationHistory(sessionId);
  res.json(history);
});

app.delete('/api/history/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  await smalltalk.clearMemory(sessionId);
  res.json({ success: true });
});

app.get('/api/orchestration/stats', (req, res) => {
  const stats = smalltalk.getOrchestrationStats();
  res.json(stats);
});

app.listen(3000, () => {
  console.log('SmallTalk API server running on port 3000');
});
```

### API Client Integration

```typescript
// SmallTalk API client for frontend applications
class SmallTalkAPI {
  private baseUrl: string;
  private sessionId: string;

  constructor(baseUrl: string, sessionId?: string) {
    this.baseUrl = baseUrl;
    this.sessionId = sessionId || this.generateSessionId();
  }

  async sendMessage(message: string, options?: {
    agentName?: string;
    metadata?: any;
  }): Promise<ChatResponse> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        sessionId: this.sessionId,
        agentName: options?.agentName,
        metadata: options?.metadata
      })
    });
    
    return await response.json();
  }

  async getHistory(): Promise<ChatMessage[]> {
    const response = await fetch(`${this.baseUrl}/api/history/${this.sessionId}`);
    return await response.json();
  }

  async clearHistory(): Promise<void> {
    await fetch(`${this.baseUrl}/api/history/${this.sessionId}`, {
      method: 'DELETE'
    });
  }

  async getAvailableAgents(): Promise<AgentInfo[]> {
    const response = await fetch(`${this.baseUrl}/api/agents`);
    return await response.json();
  }

  private generateSessionId(): string {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

// Usage in frontend
const smalltalkAPI = new SmallTalkAPI('http://localhost:3000');

// Send message and get response
const response = await smalltalkAPI.sendMessage('Hello, I need help with my account');
console.log(response.response); // AI response
console.log(response.agentName); // Which agent responded
```

---

## 🎛️ Advanced Orchestration Configuration

### Custom Orchestration Rules

```typescript
// Advanced orchestration configuration
smalltalk.configureOrchestration({
  strategy: 'hybrid',                    // 'simple', 'weighted', 'ml_based', 'hybrid'
  contextSensitivity: 0.8,             // How much to consider conversation context
  switchThreshold: 0.6,                // Confidence threshold for agent switching
  maxSwitchesPerConversation: 5,       // Prevent excessive switching
  learningEnabled: true,               // Learn from user feedback
  
  // Custom scoring weights
  scoringWeights: {
    expertiseMatch: 0.4,               // Agent expertise relevance
    complexityMatch: 0.3,              // Task complexity alignment
    conversationContext: 0.2,          // Previous conversation context
    userPreference: 0.1                // User's preferred agents
  },

  // Custom selection rules
  customRules: [
    {
      name: 'urgent_escalation',
      condition: (context, message) => {
        return message.toLowerCase().includes('urgent') && 
               context.userTier === 'premium';
      },
      targetAgent: 'SeniorSupport',
      priority: 20,
      bypassScoring: true
    },
    {
      name: 'technical_routing',
      condition: (context, message) => {
        const techKeywords = ['api', 'code', 'bug', 'error', 'technical'];
        return techKeywords.some(keyword => 
          message.toLowerCase().includes(keyword)
        );
      },
      targetAgent: 'TechnicalExpert',
      priority: 15
    }
  ],

  // Handoff triggers
  handoffTriggers: {
    userFrustration: {
      enabled: true,
      threshold: 0.7,                   // Frustration level (0-1)
      targetAgent: 'SeniorAgent'
    },
    taskComplexityExceeded: {
      enabled: true,
      threshold: 0.8,                   // Complexity threshold
      escalationPath: ['SpecialistAgent', 'ExpertAgent']
    },
    conversationLength: {
      enabled: true,
      maxMessages: 20,                  // Auto-escalate after N messages
      targetAgent: 'SupervisorAgent'
    }
  }
});
```

### Real-time Orchestration Monitoring

```typescript
// Monitor orchestration decisions in real-time
smalltalk.on('agent_selected', (event) => {
  console.log('Agent selected:', {
    selectedAgent: event.agentName,
    confidence: event.confidence,
    reason: event.reason,
    alternatives: event.alternatives,
    processingTime: event.processingTimeMs
  });
});

smalltalk.on('agent_handoff', (event) => {
  console.log('Agent handoff:', {
    fromAgent: event.fromAgent,
    toAgent: event.toAgent,
    reason: event.reason,
    userSatisfaction: event.userSatisfaction,
    conversationContext: event.context
  });
});

smalltalk.on('orchestration_error', (event) => {
  console.error('Orchestration error:', {
    error: event.error,
    fallbackAgent: event.fallbackAgent,
    recoveryAction: event.recoveryAction
  });
});

// Get real-time stats
const stats = smalltalk.getOrchestrationStats();
/*
{
  enabled: true,
  totalRequests: 1247,
  totalHandoffs: 89,
  averageConfidence: 0.87,
  topPerformingAgent: 'TechnicalSupport',
  handoffReasons: {
    'complexity_exceeded': 34,
    'user_frustration': 12,
    'expertise_mismatch': 23,
    'manual_request': 20
  },
  performanceMetrics: {
    averageResponseTime: 1200,
    userSatisfactionScore: 0.91,
    resolutionRate: 0.84
  }
}
*/
```

---

## 🔒 Security & Production Considerations

### API Key Management

```typescript
// Secure configuration
const smalltalk = new SmallTalk({
  llmProvider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,    // Use environment variables
  model: 'gpt-4o-mini',
  
  // Security settings
  security: {
    rateLimiting: {
      maxRequestsPerMinute: 60,
      maxRequestsPerHour: 1000,
      maxTokensPerDay: 100000
    },
    contentFiltering: {
      enabled: true,
      blockedPatterns: [/harmful_pattern/gi],
      moderationAPI: true                 // Use OpenAI moderation
    },
    sessionManagement: {
      maxSessionDuration: 3600000,        // 1 hour in ms
      cleanupInterval: 300000,            // 5 minutes
      encryptSessions: true
    }
  }
});
```

### Error Handling & Fallbacks

```typescript
// Robust error handling
smalltalk.configureFallbacks({
  primaryModel: 'gpt-4o-mini',
  fallbackModels: ['gpt-3.5-turbo', 'claude-3-sonnet'],
  
  retryConfig: {
    maxRetries: 3,
    backoffStrategy: 'exponential',
    baseDelay: 1000
  },
  
  errorHandling: {
    onAPIError: async (error, context) => {
      // Log error, notify monitoring system
      console.error('SmallTalk API Error:', error);
      
      // Return graceful fallback response
      return {
        content: "I'm experiencing technical difficulties. Please try again in a moment.",
        agentName: 'SystemAgent',
        error: true
      };
    },
    
    onOrchestrationError: async (error, availableAgents) => {
      // Fallback to first available agent
      return availableAgents[0];
    }
  }
});
```

---

## 📊 Usage Examples for Web Integration

### E-commerce Customer Support

```typescript
// E-commerce focused configuration
const ecommerceChat = new SmallTalk({
  llmProvider: 'openai',
  model: 'gpt-4o-mini',
  orchestration: true
});

// Specialized e-commerce agents
const agents = [
  new Agent({
    name: 'ProductExpert',
    personality: 'knowledgeable about products, helpful with recommendations',
    tools: [
      {
        name: 'searchProducts',
        handler: async ({ query, category, priceRange }) => {
          return await productDatabase.search(query, { category, priceRange });
        }
      },
      {
        name: 'checkInventory',
        handler: async ({ productId }) => {
          return await inventory.check(productId);
        }
      }
    ]
  }),
  
  new Agent({
    name: 'OrderSupport',
    personality: 'efficient order management specialist',
    tools: [
      {
        name: 'trackOrder',
        handler: async ({ orderId }) => {
          return await orderSystem.getStatus(orderId);
        }
      },
      {
        name: 'processReturn',
        handler: async ({ orderId, reason }) => {
          return await returnSystem.initiate(orderId, reason);
        }
      }
    ]
  })
];

agents.forEach(agent => ecommerceChat.addAgent(agent));

// Usage in checkout page
const CheckoutSupport = () => {
  return (
    <SmallTalkChat
      agents={agents}
      config={{
        llmProvider: 'openai',
        model: 'gpt-4o-mini',
        context: {
          page: 'checkout',
          userCart: getCurrentCart(),
          userAccount: getUserAccount()
        }
      }}
      onMessage={(msg) => {
        // Track support interactions
        analytics.track('support_interaction', {
          page: 'checkout',
          agentName: msg.agentName,
          resolved: msg.metadata?.resolved
        });
      }}
    />
  );
};
```

### SaaS Application Help

```typescript
// SaaS help assistant configuration
const saasHelper = new SmallTalk({
  llmProvider: 'anthropic',
  model: 'claude-3-sonnet',
  orchestration: true
});

const helpAgents = [
  new Agent({
    name: 'FeatureGuide',
    personality: 'expert at explaining software features and workflows',
    tools: [
      {
        name: 'getFeatureDoc',
        handler: async ({ featureName }) => {
          return await documentation.getFeature(featureName);
        }
      },
      {
        name: 'generateWorkflow',
        handler: async ({ goal, userRole }) => {
          return await workflowGenerator.create(goal, userRole);
        }
      }
    ]
  }),
  
  new Agent({
    name: 'TroubleshootingExpert',
    personality: 'systematic problem solver, great at debugging issues',
    tools: [
      {
        name: 'checkUserLogs',
        handler: async ({ userId, timeRange }) => {
          return await logAnalyzer.getUserLogs(userId, timeRange);
        }
      },
      {
        name: 'runDiagnostics',
        handler: async ({ issue }) => {
          return await diagnostics.run(issue);
        }
      }
    ]
  })
];

// Integrate into your SaaS dashboard
const DashboardHelp = ({ currentUser, currentPage }) => {
  return (
    <SmallTalkChat
      agents={helpAgents}
      config={{
        context: {
          user: currentUser,
          page: currentPage,
          userTier: currentUser.subscriptionTier,
          features: currentUser.availableFeatures
        }
      }}
      sessionId={`help_${currentUser.id}`}
      height="300px"
    />
  );
};
```

---

## 🚀 Deployment & Scaling

### Containerized Deployment

```dockerfile
# Dockerfile for SmallTalk API service
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

ENV NODE_ENV=production
ENV SMALLTALK_LOG_LEVEL=info

CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  smalltalk-api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
      
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - smalltalk-api
```

This comprehensive guide provides LLMs with all the technical details needed to integrate SmallTalk into web applications, including API usage, orchestration configuration, memory management, and real-world implementation examples.