# SmallTalk - LLM Quick Reference

**For AI Agents Building Web Applications**

---

## 🎯 Core Integration Patterns

### 1. React Component (Most Common)
```typescript
import { SmallTalk, Agent, WebChatInterface } from 'smalltalk';

const ChatComponent = ({ agents, config }) => {
  const containerRef = useRef();
  
  useEffect(() => {
    const st = new SmallTalk({
      llmProvider: 'openai',
      model: 'gpt-4o-mini',
      orchestration: true
    });
    
    agents.forEach(agent => st.addAgent(agent));
    
    const webInterface = new WebChatInterface({
      embedded: true,
      container: containerRef.current
    });
    
    st.addInterface(webInterface);
    st.start();
  }, []);
  
  return <div ref={containerRef} />;
};
```

### 2. REST API Server
```typescript
app.post('/api/chat', async (req, res) => {
  const { message, sessionId } = req.body;
  const response = await smalltalk.chat(message, sessionId);
  res.json({ response: response.content, agentName: response.agentName });
});
```

### 3. Vanilla JavaScript Widget
```typescript
const widget = new SmallTalkWidget('container-id', {
  llmProvider: 'openai',
  agents: [{ name: 'Assistant', personality: 'helpful' }]
});
```

---

## 🧠 Agent Creation

```typescript
const agent = new Agent({
  name: 'CustomerSupport',
  personality: 'helpful, professional, solution-focused',
  expertise: ['support', 'troubleshooting'],
  tools: [
    {
      name: 'searchKB',
      parameters: { query: 'string' },
      handler: async ({ query }) => await knowledgeBase.search(query)
    }
  ]
});

// Register with orchestrator
smalltalk.addAgent(agent, {
  expertise: ['customer service'],
  complexity: 'intermediate',
  taskTypes: ['support', 'assistance']
});
```

---

## 🎛️ Orchestration

```typescript
// Auto-routing based on:
// - User intent
// - Message complexity  
// - Agent expertise
// - Conversation context

smalltalk.configureOrchestration({
  strategy: 'hybrid',
  contextSensitivity: 0.8,
  customRules: [
    {
      condition: (ctx, msg) => msg.includes('urgent'),
      targetAgent: 'SeniorSupport',
      priority: 20
    }
  ]
});
```

---

## 💾 Memory Management

```typescript
// Automatic context management
smalltalk.configureMemory({
  maxTokens: 8000,
  strategy: 'selective_retention',
  summarization_trigger: 7000
});

// Access conversation history
const history = smalltalk.getConversationHistory(sessionId);
```

---

## 🔌 Key APIs

| Method | Purpose | Example |
|--------|---------|---------|
| `smalltalk.chat(message, sessionId)` | Send message, get AI response | `await st.chat("Hello", "user123")` |
| `smalltalk.addAgent(agent, capabilities)` | Register agent with orchestrator | `st.addAgent(agent, { expertise: ["support"] })` |
| `smalltalk.getConversationHistory(sessionId)` | Get chat history | `const history = st.getConversationHistory("user123")` |
| `smalltalk.getOrchestrationStats()` | Get routing analytics | `const stats = st.getOrchestrationStats()` |
| `smalltalk.clearMemory(sessionId)` | Clear conversation | `await st.clearMemory("user123")` |

---

## 🚀 Quick Start Template

```typescript
// Complete integration template
import { SmallTalk, Agent } from 'smalltalk';

// 1. Create framework
const smalltalk = new SmallTalk({
  llmProvider: 'openai',
  model: 'gpt-4o-mini',
  orchestration: true
});

// 2. Create agents
const supportAgent = new Agent({
  name: 'Support',
  personality: 'helpful customer support specialist'
});

// 3. Register agents
smalltalk.addAgent(supportAgent, {
  expertise: ['customer service'],
  complexity: 'intermediate'
});

// 4. For React: Use as component
const ChatWidget = () => (
  <SmallTalkChat 
    agents={[supportAgent]}
    config={{ llmProvider: 'openai' }}
  />
);

// 5. For API: Create endpoint
app.post('/chat', async (req, res) => {
  const response = await smalltalk.chat(req.body.message, req.body.sessionId);
  res.json(response);
});
```

---

## 🎯 Use Cases

- **Customer Support**: Multi-agent support with escalation
- **E-commerce**: Product recommendations + order support  
- **SaaS Help**: Feature guidance + troubleshooting
- **Educational**: Multiple tutoring specialists
- **Content**: Writing + editing + research agents

---

**See [LLM Integration Guide](./llm-integration-guide.md) for complete technical details.**