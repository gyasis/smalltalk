# 🎯 SmallTalk Framework Documentation

> **The complete TypeScript framework for building intelligent LLM applications with automatic agent orchestration, seamless provider switching, and powerful integrations.**

## 🚀 What is SmallTalk?

SmallTalk is a production-ready framework that lets you build sophisticated AI applications in minutes, not months. Think of it as the **Rails for LLM applications** - opinionated, batteries-included, and developer-friendly.

### Core Philosophy
- **🎯 Intelligent Orchestration**: Automatic agent routing based on user intent and complexity
- **🎭 Agent-First**: Every interaction is powered by intelligent agents with distinct personalities
- **🔄 Provider Agnostic**: Switch between 200+ LLMs from 10+ providers seamlessly
- **🌐 Interface Flexible**: Deploy as CLI, web API, or full chat UI with zero config changes
- **🏭 Production Ready**: Built-in retry logic, error handling, monitoring, and analytics

---

## 🎪 What Can You Build?

### 🎓 **Educational Platforms**
```typescript
// Multi-agent language learning with specialized tutors
const languageTutor = new SmallTalk({
  agents: ['professor', 'chatBuddy', 'grammarGuru', 'speechCoach'],
  interface: 'web-chat'
});
```

### 🏥 **Medical Training Systems** 
```typescript
// Clinical education with expert instructors
const medicalTutor = new SmallTalk({
  agents: ['clinicalInstructor', 'patientSimulator', 'diagnosticHelper'],
  tools: ['medicalDatabase', 'imagingAnalysis']
});
```

### 💼 **Business Applications**
```typescript
// Multi-agent executive team for decision making
const businessTeam = new SmallTalk({
  agents: ['ceo', 'cto', 'marketingHead', 'analyst'],
  interface: 'cli',
  memory: 'persistent'
});
```

### 🛠️ **Developer Tools**
```typescript
// Code review and pair programming assistant
const devAssistant = new SmallTalk({
  agents: ['architect', 'reviewer', 'debugger'],
  tools: ['codeAnalysis', 'gitIntegration', 'testRunner']
});
```

---

## ⚡ Quick Start Showcase

### **30-Second Setup**
```bash
# Install and run - that's it!
npm install smalltalk
npx smalltalk create my-ai-app --template=language-tutor
cd my-ai-app && npm start
```

### **5-Minute Custom Agent**
```typescript
import { SmallTalk, Agent } from 'smalltalk';

// Create a specialized agent
const codeReviewer = new Agent({
  name: 'Senior Code Reviewer',
  personality: 'experienced, constructive, detail-oriented',
  expertise: ['TypeScript', 'React', 'Node.js'],
  tools: ['eslint', 'prettier', 'gitDiff']
});

// Launch your app
const app = new SmallTalk({
  agents: [codeReviewer],
  interface: 'web-chat'
});

app.start(); // Your AI code reviewer is live!
```

---

## 🌟 Key Features That Set Us Apart

### **🎯 Intelligent Agent Orchestration** ⭐ **NEW**
- **Automatic Routing**: AI-powered agent selection based on user intent and complexity
- **Smart Handoffs**: Seamless transitions between specialized agents
- **Context Awareness**: Orchestrator considers conversation history and user satisfaction
- **Custom Rules**: Define specific routing patterns for your domain

### **🤖 Advanced Agent System**
- **Personality-Driven**: Each agent has distinct personality, expertise, and behavior
- **Dynamic Tool Access**: Agents can call functions, APIs, and external services
- **Memory Management**: Context-aware conversations with smart truncation
- **Capability Matching**: Agents registered with expertise and skill levels

### **🔄 Universal LLM Integration**
- **200+ Models**: OpenAI, Anthropic, Gemini, Mistral, Groq, and more
- **Zero Vendor Lock-in**: Switch providers with a single config change
- **Advanced Features**: Streaming, JSON mode, vision, function calling
- **Cost Optimization**: Automatic model selection based on task complexity

### **🎛️ Flexible Interfaces**
- **CLI Interface**: Rich terminal experience with colors and commands
- **Web API**: RESTful endpoints with WebSocket support
- **Web Chat UI**: Full-featured chat interface with file uploads
- **Programmatic**: Direct TypeScript/JavaScript integration

### **🔧 Production Features**
- **Error Handling**: Retry logic, fallback models, graceful degradation
- **Monitoring**: Token usage tracking, performance metrics, error logging
- **Security**: API key management, rate limiting, content filtering
- **Scalability**: Batch processing, concurrent requests, memory optimization

---

## 📚 Documentation Structure

### 🏁 **Getting Started**
- [Installation & Setup](./getting-started/installation.md)
- [**🖥️ SmallTalk CLI Reference**](./cli-reference.md) ⭐ **NEW v0.2.1**
- [Your First Agent](./getting-started/first-agent.md)
- [Configuration Guide](./getting-started/configuration.md)

### 📖 **Core Guides**
- [**🎯 Intelligent Orchestration**](./guides/orchestration.md) ⭐ **Essential Reading**
- [Building Agents](./guides/building-agents.md)
- [Interface Selection](./guides/interfaces.md) 
- [Tool Integration](./guides/tools.md)
- [Memory Management](./guides/memory.md)
- [Provider Setup](./guides/providers.md)
- [Deployment](./guides/deployment.md)

### 💡 **Examples**
- [**🎯 Orchestrator Demo**](./examples/orchestrator-demo.md) ⭐ **See It In Action**
- [Language Learning Tutor](./examples/language-tutor.md)
- [Medical Training System](./examples/medical-tutor.md)
- [Business Meeting Simulator](./examples/business-meeting.md)
- [Code Review Assistant](./examples/code-reviewer.md)
- [Customer Support Bot](./examples/customer-support.md)

### 📑 **API Reference**
- [SmallTalk Class](./api-reference/smalltalk.md)
- [Agent Class](./api-reference/agent.md)
- [**🎯 Orchestrator API**](./api-reference/orchestrator.md) ⭐ **New**
- [Interface System](./api-reference/interfaces.md)
- [Tools & Functions](./api-reference/tools.md)
- [Configuration Options](./api-reference/configuration.md)

---

## 🎯 Why Choose SmallTalk?

| Feature | SmallTalk | Other Frameworks |
|---------|-----------|------------------|
| **🎯 Agent Orchestration** | ✅ Automatic intelligent routing | ❌ Manual agent switching |
| **⚡ Setup Time** | ✅ 30 seconds | ❌ Hours/Days |
| **🔄 LLM Providers** | ✅ 200+ models, 10+ providers | ⚠️ 1-3 providers |
| **🌐 Interface Options** | ✅ CLI, Web API, Web Chat | ⚠️ Usually 1 option |
| **🎭 Agent System** | ✅ Built-in personalities & capabilities | ⚠️ Manual prompt engineering |
| **🏭 Production Ready** | ✅ Monitoring, retry, analytics | ❌ DIY everything |
| **📊 Intelligence** | ✅ Context-aware routing decisions | ❌ No smart routing |
| **📈 Learning Curve** | ✅ Minimal - framework handles complexity | ❌ Steep learning required |

---

## 🚀 Ready to Build?

**Choose your adventure:**

- 🏃‍♂️ **Quick Start**: [30-second setup](./getting-started/installation.md)
- 🎯 **See Orchestration**: [Orchestrator demo](./examples/orchestrator-demo.md) ⭐ **Must Try**
- 🎓 **Learn by Example**: [Language tutor walkthrough](./examples/language-tutor.md)
- 🛠️ **Deep Dive**: [Complete agent building guide](./guides/building-agents.md)
- 📖 **Orchestration Guide**: [Intelligent routing system](./guides/orchestration.md)
- 📖 **Full API**: [Complete reference documentation](./api-reference/README.md)

---

*Built with ❤️ for developers who want to focus on creating amazing AI experiences, not wrestling with infrastructure.*