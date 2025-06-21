# 🤖 Building Intelligent Agents

**Learn how to create powerful AI agents with distinct personalities, specialized tools, and smart behaviors.**

## 🎯 What Makes a Great Agent?

### **The Agent Trinity**
Every effective SmallTalk agent combines three elements:

1. **🎭 Personality** - How the agent behaves and communicates
2. **🧠 Expertise** - What the agent knows and specializes in  
3. **🛠️ Tools** - What the agent can actually do in the world

---

## 🏗️ Agent Architecture

### **Basic Agent Structure**
```typescript
import { Agent } from 'smalltalk';

const myAgent = new Agent({
  // Identity
  name: 'Dr. Sarah Chen',
  personality: 'professional, empathetic, detail-oriented',
  
  // Knowledge
  expertise: ['cardiology', 'patient care', 'medical diagnostics'],
  
  // Behavior
  systemPrompt: `You are Dr. Sarah Chen, a cardiologist with 15 years of experience...`,
  
  // Capabilities
  tools: [heartRateAnalyzer, ecgInterpreter, patientHistoryLookup],
  
  // Memory
  memory: { maxMessages: 50, personalityConsistency: true }
});
```

### **Agent Lifecycle**
```typescript
// 1. Creation
const agent = new Agent(config);

// 2. Initialization
await agent.initialize();

// 3. Conversation
const response = await agent.chat(userMessage);

// 4. Tool Usage
const toolResult = await agent.useTool('analyze', data);

// 5. Memory Management
agent.updateMemory(conversation);
```

---

## 🎭 Personality Design

### **Personality Dimensions**
Define your agent's character across key dimensions:

```typescript
const personality = {
  // Communication Style
  tone: 'professional',           // casual, formal, friendly, professional
  verbosity: 'detailed',          // concise, moderate, detailed, verbose
  humor: 'subtle',               // none, dry, witty, playful, subtle
  
  // Emotional Traits
  empathy: 'high',               // low, moderate, high
  patience: 'very-high',         // low, moderate, high, very-high
  enthusiasm: 'moderate',        // low, moderate, high, infectious
  
  // Professional Traits
  precision: 'high',             // low, moderate, high, extreme
  creativity: 'moderate',        // low, moderate, high, innovative
  assertiveness: 'balanced',     // passive, balanced, confident, dominant
  
  // Cultural Traits
  formality: 'business-casual',  // informal, casual, business-casual, formal
  cultural_awareness: 'global',  // local, regional, national, global
  language_style: 'clear'        // simple, clear, academic, technical
};
```

### **Personality Examples**

**🎓 Academic Professor**
```typescript
const professor = new Agent({
  name: 'Professor Williams',
  personality: 'scholarly, patient, encouraging, methodical',
  systemPrompt: `You are Professor Williams, a distinguished academic who:
  
  🎯 Always explains concepts thoroughly with examples
  📚 Provides historical context and deeper insights  
  🤔 Asks probing questions to test understanding
  📝 Suggests further reading and practice exercises
  
  Your tone is warm but authoritative, like a favorite teacher.`,
  
  behaviorPatterns: {
    greeting: "Welcome to today's session! What shall we explore together?",
    explanation: "Let me break this down step by step...",
    encouragement: "Excellent question! That shows you're thinking deeply.",
    correction: "Not quite, but you're on the right track. Consider this..."
  }
});
```

**🏥 Medical Professional**
```typescript
const doctor = new Agent({
  name: 'Dr. Martinez',
  personality: 'caring, precise, reassuring, evidence-based',
  systemPrompt: `You are Dr. Martinez, a practicing physician who:
  
  🩺 Prioritizes patient safety and well-being above all
  📊 Bases recommendations on current medical evidence
  💬 Communicates complex medical information clearly
  🤝 Shows empathy while maintaining professional boundaries
  
  Always remind users that you provide information, not medical advice.`,
  
  behaviorPatterns: {
    assessment: "Let me understand your symptoms thoroughly...",
    explanation: "Based on current medical knowledge...",
    recommendation: "I'd suggest discussing this with your healthcare provider...",
    reassurance: "It's completely normal to have these concerns."
  }
});
```

**💼 Business Executive**
```typescript
const ceo = new Agent({
  name: 'Alexandra Stone',
  personality: 'decisive, strategic, inspiring, results-oriented',
  systemPrompt: `You are Alexandra Stone, a successful CEO who:
  
  📈 Focuses on strategic outcomes and business impact
  💡 Thinks several steps ahead and considers market dynamics
  🎯 Makes data-driven decisions with calculated risks
  👥 Inspires teams while holding them accountable
  
  Your communication is direct, confident, and action-oriented.`,
  
  behaviorPatterns: {
    analysis: "Looking at the market data and competitive landscape...",
    decision: "Based on our strategic objectives, I recommend...",
    motivation: "This is exactly the kind of challenge that separates leaders...",
    delegation: "I need you to own this initiative and drive results..."
  }
});
```

---

## 🧠 Expertise & Knowledge

### **Defining Expertise Areas**
```typescript
const expertise = {
  // Primary Domains
  primary: ['software architecture', 'distributed systems', 'cloud computing'],
  
  // Secondary Knowledge
  secondary: ['DevOps', 'security', 'performance optimization'],
  
  // Experience Level
  experience: {
    level: 'senior',           // junior, mid, senior, expert, thought-leader
    years: 12,
    domains: ['fintech', 'healthcare', 'e-commerce']
  },
  
  // Specializations
  specializations: [
    'microservices architecture',
    'event-driven systems', 
    'real-time data processing'
  ],
  
  // Current Knowledge Cutoff
  knowledgeCutoff: '2024-01',
  
  // Learning Preferences
  learningStyle: 'practical-examples',  // theoretical, practical-examples, hands-on
  teachingStyle: 'socratic'            // direct, socratic, collaborative
};
```

### **Knowledge Integration Patterns**

**🔄 Layered Knowledge**
```typescript
const architecturalExpert = new Agent({
  expertise: {
    foundational: ['computer science', 'mathematics', 'systems thinking'],
    core: ['software design', 'system architecture', 'distributed computing'],
    specialized: ['event sourcing', 'CQRS', 'domain-driven design'],
    emerging: ['serverless', 'edge computing', 'quantum-ready architectures']
  },
  
  knowledgeDepth: {
    'software design': 'expert',
    'distributed systems': 'expert', 
    'quantum computing': 'aware',
    'blockchain': 'intermediate'
  }
});
```

**📚 Contextual Knowledge Application**
```typescript
const contextualExpert = new Agent({
  name: 'Senior Architect',
  tools: [
    {
      name: 'applyExpertise',
      handler: async ({ question, context }) => {
        const relevantKnowledge = await this.selectRelevantExpertise(question);
        const contextualAnswer = await this.adaptToContext(relevantKnowledge, context);
        return this.formatExpertResponse(contextualAnswer);
      }
    }
  ]
});
```

---

## 🛠️ Tool Integration

### **Tool Categories**

**🔍 Information Tools**
```typescript
const informationTools = [
  {
    name: 'searchKnowledgeBase',
    description: 'Search internal knowledge base for specific information',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        domain: { type: 'string', enum: ['technical', 'business', 'medical'] }
      }
    },
    handler: async ({ query, domain }) => {
      return await knowledgeBase.search(query, domain);
    }
  }
];
```

**⚡ Action Tools**
```typescript
const actionTools = [
  {
    name: 'scheduleAppointment',
    description: 'Schedule a new appointment or meeting',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', format: 'date' },
        duration: { type: 'number', description: 'Duration in minutes' },
        participants: { type: 'array', items: { type: 'string' } }
      }
    },
    handler: async ({ date, duration, participants }) => {
      return await calendar.schedule({ date, duration, participants });
    }
  }
];
```

**📊 Analysis Tools**
```typescript
const analysisTools = [
  {
    name: 'analyzeCode',
    description: 'Analyze code for quality, security, and performance issues',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code to analyze' },
        language: { type: 'string', description: 'Programming language' },
        analysisType: { type: 'string', enum: ['quality', 'security', 'performance', 'all'] }
      }
    },
    handler: async ({ code, language, analysisType }) => {
      const results = await codeAnalyzer.analyze(code, language, analysisType);
      return {
        issues: results.issues,
        suggestions: results.suggestions,
        metrics: results.metrics,
        confidence: results.confidence
      };
    }
  }
];
```

### **Advanced Tool Patterns**

**🔗 Tool Chaining**
```typescript
const workflowAgent = new Agent({
  tools: [
    {
      name: 'processDocument',
      handler: async ({ document }) => {
        // Chain multiple tools together
        const extracted = await this.useTool('extractText', { document });
        const analyzed = await this.useTool('analyzeText', { text: extracted.text });
        const summary = await this.useTool('summarize', { analysis: analyzed });
        
        return {
          originalDocument: document,
          extractedText: extracted.text,
          analysis: analyzed,
          summary: summary
        };
      }
    }
  ]
});
```

**🎯 Conditional Tool Usage**
```typescript
const smartAgent = new Agent({
  tools: [
    {
      name: 'intelligentResponse',
      handler: async ({ question, context }) => {
        // Decide which tools to use based on the question
        if (question.includes('code')) {
          return await this.useTool('analyzeCode', { code: context.code });
        } else if (question.includes('schedule')) {
          return await this.useTool('checkCalendar', { date: context.date });
        } else if (question.includes('data')) {
          return await this.useTool('queryDatabase', { query: context.query });
        }
        
        // Default to knowledge-based response
        return await this.generateResponse(question);
      }
    }
  ]
});
```

---

## 🧠 Memory Management

### **Memory Types**

**📝 Conversation Memory**
```typescript
const conversationMemory = {
  type: 'conversation',
  maxMessages: 50,
  truncationStrategy: 'smart',  // 'oldest', 'smart', 'summary'
  keyMoments: true,            // Remember important moments
  emotionalContext: true       // Track emotional state
};
```

**👤 Personal Memory**
```typescript
const personalMemory = {
  type: 'personal',
  userProfile: {
    preferences: {},
    history: [],
    expertise: '',
    communication_style: ''
  },
  persistence: 'file',         // 'memory', 'file', 'database'
  encryption: true
};
```

**📚 Knowledge Memory**
```typescript
const knowledgeMemory = {
  type: 'knowledge',
  factStorage: 'vector-db',
  updateStrategy: 'incremental',
  sources: ['conversation', 'tools', 'external-apis'],
  validation: true
};
```

### **Smart Memory Patterns**

**🎯 Context-Aware Retrieval**
```typescript
class SmartMemory {
  async retrieveRelevant(currentContext) {
    const relevantMemories = await this.vectorSearch(currentContext);
    const contextualMemories = await this.filterByContext(relevantMemories);
    const recentMemories = await this.getRecent(5);
    
    return this.merge(contextualMemories, recentMemories);
  }
  
  async storeWithContext(memory, context) {
    const enrichedMemory = {
      ...memory,
      context: context,
      timestamp: new Date(),
      importance: this.calculateImportance(memory),
      emotional_context: this.extractEmotions(memory)
    };
    
    await this.store(enrichedMemory);
  }
}
```

---

## 🎯 Agent Coordination

### **Multi-Agent Patterns**

**🤝 Collaborative Agents**
```typescript
const collaborativeTeam = {
  leader: researchLead,
  specialists: [dataAnalyst, marketExpert, techArchitect],
  
  async collaborate(task) {
    // Leader coordinates the work
    const workBreakdown = await this.leader.planWork(task);
    
    // Specialists work in parallel
    const results = await Promise.all(
      workBreakdown.map(work => 
        this.getSpecialist(work.domain).execute(work)
      )
    );
    
    // Leader synthesizes results
    return await this.leader.synthesize(results);
  }
};
```

**🔄 Sequential Handoffs**
```typescript
const sequentialWorkflow = {
  agents: [requirementsAnalyst, architect, developer, tester],
  
  async processRequest(request) {
    let currentWork = request;
    
    for (const agent of this.agents) {
      currentWork = await agent.process(currentWork);
      // Each agent builds on the previous agent's work
    }
    
    return currentWork;
  }
};
```

---

## 📊 Agent Analytics

### **Performance Metrics**
```typescript
const agentMetrics = {
  // Conversation Quality
  responseRelevance: 0.92,
  userSatisfaction: 0.88,
  taskCompletion: 0.95,
  
  // Tool Usage
  toolAccuracy: 0.94,
  toolEfficiency: 0.87,
  appropriateToolSelection: 0.91,
  
  // Personality Consistency
  personalityAlignment: 0.96,
  toneConsistency: 0.93,
  expertiseAccuracy: 0.89
};
```

### **Continuous Improvement**
```typescript
class AgentOptimizer {
  async analyzePerformance(agent, conversations) {
    const metrics = await this.calculateMetrics(conversations);
    const improvements = await this.identifyImprovements(metrics);
    
    return {
      currentPerformance: metrics,
      suggestedImprovements: improvements,
      updatedConfiguration: this.generateConfig(improvements)
    };
  }
  
  async adaptAgent(agent, feedback) {
    // Automatically adjust agent parameters based on feedback
    const adjustments = await this.calculateAdjustments(feedback);
    return await agent.updateConfiguration(adjustments);
  }
}
```

---

## 🎯 Best Practices

### **✅ Do's**
- **Start Simple**: Begin with basic personality and add complexity gradually
- **Test Extensively**: Validate personality consistency across many conversations  
- **Monitor Performance**: Track how well agents meet user needs
- **Iterate Based on Feedback**: Continuously improve based on real usage
- **Document Personality**: Maintain clear documentation of agent characteristics

### **❌ Don'ts**
- **Don't Overload**: Avoid giving agents too many contradictory traits
- **Don't Ignore Context**: Always consider the conversation context
- **Don't Forget Boundaries**: Clearly define what agents can and cannot do
- **Don't Skip Testing**: Personality quirks often only emerge with extensive testing
- **Don't Make Assumptions**: Let user feedback guide agent development

---

## 🚀 Next Steps

**🎉 You're now ready to build amazing agents!**

**Ready to deploy?**
- **🌐 [Interface Integration](./interfaces.md)** - Connect to CLI, web, or API
- **🔧 [Tool Development](./tools.md)** - Build custom capabilities
- **💾 [Memory Systems](./memory.md)** - Advanced memory management
- **📊 [Analytics](./analytics.md)** - Monitor and improve performance

**See agents in action:**
- **🎓 [Language Tutor Example](../examples/language-tutor.md)**
- **🏥 [Medical Training Example](../examples/medical-tutor.md)**
- **💼 [Business Meeting Example](../examples/business-meeting.md)**

---

**Your intelligent agents await!** 🤖✨