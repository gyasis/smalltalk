# 🎯 SmallTalk Framework

**The complete TypeScript framework for building intelligent LLM applications with automatic agent orchestration, seamless provider switching, and powerful integrations.**

> **Think Rails for AI**: Opinionated, batteries-included, production-ready framework that lets you build sophisticated AI applications in minutes, not months.

[![npm version](https://img.shields.io/npm/v/smalltalk)](https://www.npmjs.com/package/smalltalk)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🌟 What Makes SmallTalk Special?

### **🎯 Intelligent Agent Orchestration**
SmallTalk automatically routes conversations to the perfect agent based on user intent, complexity, and expertise. No more manual agent switching!

```typescript
// User asks: "I'm a beginner, how do I debug JavaScript?"
// 🎯 Orchestrator → Routes to Beginner Tutor (detected learning intent + complexity)

// User asks: "Design a system for 1M concurrent users"  
// 🎯 Orchestrator → Routes to System Architect (detected scale + architecture)
```

### **🔄 Universal LLM Support**
Switch between 200+ models from 10+ providers with zero code changes. OpenAI, Anthropic, Gemini, Mistral, Groq, and more.

### **🎭 Agent-First Architecture** 
Every interaction is powered by intelligent agents with distinct personalities, specialized tools, and context awareness.

---

## ⚡ Quick Start (30 seconds)

### **Option 1: Create from Template**
```bash
npx create-smalltalk my-ai-app --template=language-tutor
cd my-ai-app
echo "OPENAI_API_KEY=your_key" > .env
npm start
```

### **Option 2: Build Your Own**
```bash
npm install smalltalk
```

```typescript
import { SmallTalk, Agent } from 'smalltalk';

// Create intelligent agents
const tutor = new Agent({
  name: 'Friendly Tutor',
  personality: 'patient, encouraging, beginner-friendly',
  expertise: ['teaching', 'programming basics', 'motivation']
});

const expert = new Agent({
  name: 'Senior Architect', 
  personality: 'analytical, experienced, strategic',
  expertise: ['system design', 'scalability', 'best practices']
});

// Create orchestrated application
const app = new SmallTalk({
  orchestration: true,  // 🎯 Enable intelligent routing
  llmProvider: 'openai',
  model: 'gpt-4o'
});

// Register agents with capabilities
app.addAgent(tutor, {
  complexity: 'basic',
  taskTypes: ['educational', 'assistance'],
  expertise: ['teaching', 'programming basics']
});

app.addAgent(expert, {
  complexity: 'expert', 
  taskTypes: ['architecture', 'strategy'],
  expertise: ['system design', 'scalability']
});

await app.start();
// 🎉 Your intelligent AI system is live!
```

---

## 🎪 What Can You Build?

### **🎓 Educational Platforms**
```typescript
// Multi-agent language learning with orchestrated tutors
const languageApp = new SmallTalk({
  agents: [professor, chatBuddy, grammarGuru, speechCoach],
  orchestration: true,
  interface: 'web-chat'
});
```

### **🏥 Medical Training Systems**
```typescript
// Clinical education with specialized instructors
const medicalApp = new SmallTalk({
  agents: [clinicalInstructor, patientSimulator, diagnosticHelper],
  tools: [medicalDatabase, imagingAnalysis],
  orchestration: true
});
```

### **💼 Business Applications**
```typescript
// Multi-agent executive team for decision making
const businessApp = new SmallTalk({
  agents: [ceo, cto, marketingHead, analyst],
  orchestration: { 
    enabled: true,
    strategy: 'business-focused'
  }
});
```

---

## 🎯 Intelligent Orchestration in Action

### **🧠 How It Works**
```typescript
// 1. User message arrives
"I'm stuck debugging this React component"

// 2. Orchestrator analyzes intent
Intent: ["problem_solving", "help_request"]
Topic: "React debugging"
Complexity: 0.6 (intermediate)
User_level: "intermediate" (inferred)

// 3. Scores available agents
Senior Developer: 0.92 (expert in debugging + React)
Beginner Tutor: 0.34 (too basic for intermediate)
Architect: 0.67 (relevant but not specific)

// 4. Routes to best match
🎯 Selected: Senior Developer
Reason: "Best match for React debugging with intermediate complexity"
Confidence: 92%
```

### **⚡ Automatic Agent Switching**
```typescript
// Conversation flows seamlessly between specialized agents
app.on('agent_handoff', (data) => {
  console.log(`🎯 ${data.fromAgent} → ${data.toAgent}`);
  console.log(`   Reason: ${data.reason}`);
  console.log(`   Confidence: ${data.confidence}%`);
});

// Example conversation:
// User: "I'm new to programming"        → Beginner Tutor
// User: "Now I need to scale to 1M users" → System Architect  
// User: "This is confusing, explain simply" → Beginner Tutor
```

---

## 🌟 Core Features

### **🤖 Agent System**
Create intelligent agents with personalities, expertise, and tools:

```typescript
const agent = new Agent({
  name: 'Code Reviewer',
  personality: 'thorough, constructive, experienced',
  expertise: ['code quality', 'best practices', 'security'],
  systemPrompt: `You are a senior code reviewer who...`,
  
  tools: [
    {
      name: 'analyzeCode',
      description: 'Analyze code for issues and improvements',
      handler: async ({ code, language }) => {
        return {
          issues: await codeAnalyzer.findIssues(code),
          suggestions: await codeAnalyzer.getSuggestions(code),
          security: await securityScanner.scan(code)
        };
      }
    }
  ]
});
```

### **🔄 Universal LLM Integration**
Switch providers effortlessly with Token.js:

```typescript
// Works with 200+ models from 10+ providers
const app = new SmallTalk({
  llmProvider: 'anthropic',        // anthropic, openai, gemini, etc.
  model: 'claude-3-5-sonnet-20241022',
  temperature: 0.7
});

// Advanced features supported across providers
await app.chat("Generate JSON schema", { 
  mode: 'json',
  schema: { type: 'object', properties: {...} }
});

await app.chat("Analyze this image", {
  images: ['data:image/jpeg;base64,...'],
  detail: 'high'
});
```

### **🎛️ Flexible Interfaces**

**CLI Interface** - Rich terminal experience:
```typescript
const cli = new CLIInterface({
  prompt: '🤖 ',
  colors: true,
  commands: {
    '/switch <agent>': 'Switch to specific agent',
    '/orchestration on|off': 'Toggle orchestration',
    '/stats': 'Show orchestration stats'
  }
});
```

**Web Chat Interface** - Full-featured UI:
```typescript
const webChat = new WebChatInterface({
  port: 3000,
  features: {
    fileUploads: true,
    voiceInput: true,
    agentSwitching: true,
    realTimeTyping: true
  }
});
```

**Web API** - RESTful endpoints:
```typescript
const api = new WebAPIInterface({
  endpoints: [
    'POST /chat',
    'GET /agents', 
    'POST /orchestrate',
    'WebSocket /live'
  ]
});
```

### **🔧 MCP Integration**
Connect to external tools and data sources:

```typescript
await app.enableMCP([
  {
    name: 'filesystem',
    type: 'stdio',
    command: 'mcp-server-filesystem',
    args: ['/workspace']
  },
  {
    name: 'database',
    type: 'http',
    url: 'http://localhost:8080/mcp'
  }
]);

// MCP tools are automatically available to all agents
```

---

## 🎯 Orchestration Strategies

### **🏫 Educational Platform**
```typescript
const educationalApp = new SmallTalk({
  orchestration: {
    strategy: 'educational',
    rules: [
      { pattern: 'beginner|new|start', agent: 'Tutor', priority: 10 },
      { pattern: 'theory|concept|explain', agent: 'Professor', priority: 8 },
      { pattern: 'practice|exercise|code', agent: 'Lab Assistant', priority: 7 }
    ]
  }
});
```

### **💼 Business Support**
```typescript
const businessApp = new SmallTalk({
  orchestration: {
    strategy: 'business',
    contextWeights: {
      complexity: 0.4,
      urgency: 0.3,
      expertise_match: 0.3
    }
  }
});
```

### **🔧 Development Team**
```typescript
const devApp = new SmallTalk({
  orchestration: {
    strategy: 'development',
    phases: {
      planning: 'Tech Lead',
      coding: 'Senior Developer', 
      review: 'Code Reviewer',
      testing: 'QA Engineer',
      deployment: 'DevOps Specialist'
    }
  }
});
```

---

## 📊 Monitoring & Analytics

### **📈 Real-time Orchestration Stats**
```typescript
const stats = app.getOrchestrationStats();
console.log(stats);

// Output:
{
  enabled: true,
  totalAgents: 4,
  handoffsToday: 47,
  averageConfidence: 0.87,
  topPerformingAgent: 'Senior Developer',
  userSatisfaction: 0.92,
  currentAssignments: {
    'user123': 'Beginner Tutor',
    'user456': 'System Architect'
  }
}
```

### **🎯 Performance Tracking**
```typescript
app.on('agent_handoff', (data) => {
  analytics.track('handoff', {
    from: data.fromAgent,
    to: data.toAgent,
    reason: data.reason,
    confidence: data.confidence,
    userSatisfaction: data.context.satisfaction
  });
});
```

---

## 📚 Complete Examples

### **Language Learning Platform**
```bash
npm run example:language-tutor
```
Multi-agent language learning with Professor, Chat Buddy, Grammar Guru, and Speech Coach.

### **Medical Training System**
```bash
npm run example:medical-tutor
```
Clinical education platform with specialized medical instructors and diagnostic tools.

### **Business Meeting Simulator**
```bash
npm run example:business-meeting
```
Multi-agent executive team for strategic decision making and analysis.

### **Orchestrator Demo**
```bash
npm run example:orchestrator-demo
```
Interactive demo showing intelligent agent routing in real-time.

---

## 🔧 Advanced Configuration

### **Environment Setup**
```bash
# LLM Provider API Keys (choose one or more)
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GEMINI_API_KEY=your_gemini_key

# SmallTalk Configuration
SMALLTALK_DEFAULT_PROVIDER=openai
SMALLTALK_DEFAULT_MODEL=gpt-4o
SMALLTALK_DEBUG=true
SMALLTALK_ORCHESTRATION=true
```

### **Advanced Orchestration**
```typescript
const app = new SmallTalk({
  orchestration: {
    enabled: true,
    contextSensitivity: 0.8,
    switchThreshold: 0.6,
    maxSwitchesPerConversation: 5,
    learningRate: 0.1,
    
    customRules: [
      {
        condition: (context, message) => {
          return message.includes('urgent') && context.userTier === 'premium';
        },
        targetAgent: 'Priority Support',
        priority: 20
      }
    ]
  }
});
```

---

## 📖 Documentation

### **🏁 Getting Started**
- [Installation & Setup](./docs/getting-started/installation.md)
- [Your First Agent](./docs/getting-started/first-agent.md)
- [Configuration Guide](./docs/getting-started/configuration.md)

### **📘 Guides**
- [**🎯 Intelligent Orchestration**](./docs/guides/orchestration.md) - **Core feature guide**
- [Building Agents](./docs/guides/building-agents.md)
- [Interface Selection](./docs/guides/interfaces.md)
- [Tool Integration](./docs/guides/tools.md)
- [Memory Management](./docs/guides/memory.md)
- [Provider Setup](./docs/guides/providers.md)

### **💡 Examples**
- [Language Learning Tutor](./docs/examples/language-tutor.md)
- [Medical Training System](./docs/examples/medical-tutor.md)
- [Business Meeting Simulator](./docs/examples/business-meeting.md)
- [Orchestrator Demo](./docs/examples/orchestrator-demo.md)

### **📑 API Reference**
- [SmallTalk Class](./docs/api-reference/smalltalk.md)
- [Agent Class](./docs/api-reference/agent.md)
- [Orchestrator](./docs/api-reference/orchestrator.md)
- [Interfaces](./docs/api-reference/interfaces.md)

---

## 🚀 Why Choose SmallTalk?

| Feature | SmallTalk | Other Frameworks |
|---------|-----------|------------------|
| **🎯 Intelligent Orchestration** | ✅ Automatic agent routing | ❌ Manual switching |
| **🔄 LLM Providers** | ✅ 200+ models, 10+ providers | ⚠️ 1-3 providers |
| **🎭 Agent System** | ✅ Built-in personalities & tools | ⚠️ Manual prompt engineering |
| **🌐 Interface Options** | ✅ CLI, Web API, Web Chat | ⚠️ Usually 1 option |
| **⚡ Setup Time** | ✅ 30 seconds | ❌ Hours/Days |
| **🏭 Production Ready** | ✅ Monitoring, retry, scaling | ❌ DIY everything |
| **📊 Analytics** | ✅ Built-in orchestration metrics | ❌ No insights |

---

## 🛠️ Development

### **Building from Source**
```bash
git clone https://github.com/your-org/smalltalk.git
cd smalltalk
npm install
npm run build
```

### **Running Examples**
```bash
# Core examples
npm run example:basic           # Basic agent chat
npm run example:orchestrator    # Orchestration demo
npm run example:language        # Language tutor
npm run example:medical         # Medical training
npm run example:business        # Business meeting

# Interface examples  
npm run example:web-api         # Web API server
npm run example:web-chat        # Full web chat UI
npm run example:cli             # Rich CLI interface
```

### **Testing**
```bash
npm test                        # Run all tests
npm run test:orchestration     # Test orchestration system
npm run test:integration       # Integration tests
npm run test:coverage          # Coverage report
```

---

## 📦 Architecture

```
smalltalk/
├── src/
│   ├── core/                  # Framework core
│   │   ├── SmallTalk.ts      # Main orchestrator
│   │   ├── Chat.ts           # Chat management
│   │   └── Memory.ts         # Context management
│   ├── agents/               # Agent system
│   │   ├── Agent.ts          # Base agent class
│   │   ├── OrchestratorAgent.ts  # 🎯 Intelligent routing
│   │   └── AgentFactory.ts   # Agent creation utilities
│   ├── interfaces/           # Interface implementations
│   │   ├── CLIInterface.ts   # Terminal interface
│   │   ├── WebInterface.ts   # Web API
│   │   └── WebChatInterface.ts # Full web chat
│   ├── utils/               # Utilities
│   │   └── TokenJSWrapper.ts # LLM integration
│   └── types/               # TypeScript definitions
├── examples/                # Complete examples
├── docs/                   # Documentation
└── interfaces/             # Pre-built UI components
```

---

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Install** dependencies (`npm install`)
4. **Run** tests (`npm test`)
5. **Commit** your changes (`git commit -m 'Add amazing feature'`)
6. **Push** to the branch (`git push origin feature/amazing-feature`)
7. **Open** a Pull Request

### **Development Guidelines**
- Write TypeScript with strict typing
- Add tests for new features
- Update documentation
- Follow existing code style
- Test orchestration scenarios

---

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

---

## 🔗 Related Projects

- [**Token.js**](https://docs.tokenjs.ai/) - Unified LLM SDK (200+ models)
- [**PocketFlow.js**](https://pocketflow.dev/) - Minimalist LLM framework inspiration
- [**Model Context Protocol**](https://modelcontextprotocol.io/) - MCP specification

---

## 🆘 Support & Community

- 📖 **[Complete Documentation](./docs/README.md)**
- 🎯 **[Orchestration Guide](./docs/guides/orchestration.md)** - Core feature
- 🐛 **[Issue Tracker](https://github.com/your-org/smalltalk/issues)**
- 💬 **[Discussions](https://github.com/your-org/smalltalk/discussions)**
- 📧 **[Email Support](mailto:support@smalltalk.dev)**

---

## 🎉 Get Started Now!

```bash
# 30-second setup
npx create-smalltalk my-ai-app --template=orchestrator-demo
cd my-ai-app
echo "OPENAI_API_KEY=your_key" > .env
npm start

# Watch intelligent agent orchestration in action! 🎯
```

---

**Built with ❤️ for developers who want to create amazing AI experiences, not wrestle with infrastructure.**

**🎯 The orchestrator ensures every user gets connected to the perfect agent for their needs!** ✨