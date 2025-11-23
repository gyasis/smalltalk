# 🧠 RAG Research & Brainstorm Hub

**Advanced multi-agent research platform with MCP DeepLake integration for technical knowledge retrieval and intelligent collaboration.**

> **The Ultimate Research Environment**: Combines specialized AI agents with a powerful knowledge base to provide comprehensive research, creative brainstorming, and technical implementation guidance.

---

## 🌟 Overview

The RAG Research & Brainstorm Hub is a sophisticated demonstration of SmallTalk's capabilities, featuring 5 specialized agents that work together with a MCP DeepLake knowledge base to provide comprehensive technical research and guidance.

### **🎯 Key Features**

- **🔍 Advanced RAG Integration**: Real DeepLake vector database with semantic search
- **🤖 5 Specialized Agents**: Each with unique expertise and collaboration styles  
- **🧠 Phase 1-3 Interactive Orchestration**: Intelligent agent routing and learning
- **🔄 Multi-Query RAG**: Automatically breaks down complex queries for comprehensive results
- **📚 Knowledge Base**: Technical documentation, APIs, tutorials, and best practices
- **⚡ Real-time Collaboration**: Agents work together to synthesize knowledge

---

## 🚀 Quick Start

**⚡ Want to get started immediately? Check out the [Quick Start Guide](./rag-research-quick-start.md)!**

### **Prerequisites**

1. **Python Environment** for MCP DeepLake server
2. **OpenAI API Key** (or other LLM provider)
3. **DeepLake RAG Server** configured and running

### **Installation & Setup**

```bash
# 1. Install SmallTalk globally
npm install -g smalltalk-ai

# 2. Set up environment variables
export OPENAI_API_KEY=your_openai_key_here

# 3. Configure DeepLake MCP server path in the demo file
# Edit examples/rag-research-demo.ts line 37-39 with your Python path

# 4. Run the demo
smalltalk examples/rag-research-demo.ts
```

### **Web Playground Mode**

```bash
# Launch interactive web interface
smalltalk playground examples/rag-research-demo.ts

# Custom port
smalltalk playground examples/rag-research-demo.ts --port 4000
```

**Output:**
```
🌐 Web Interface: http://localhost:3127
📋 🧠 RAG Research & Brainstorm Hub
📝 Technical research and brainstorming with AI agents and RAG knowledge base
```

---

## 🤖 Specialized Agent Team

### **🔍 RAGAgent - Knowledge Retrieval Specialist**

**Primary Role**: Information retrieval and context gathering from technical knowledge bases.

**Capabilities**:
- Semantic search across documentation and tutorials
- Multi-query RAG for complex research topics
- Document-specific search with fuzzy matching
- Knowledge base exploration and related topic discovery
- Rich context synthesis and cross-referencing

**Temperature**: 0.3 (Precise retrieval focus)  
**Max Tokens**: 4000

**Specialized Tools**:
- `rag_search`: Semantic similarity search
- `rag_document_search`: Search within specific documents
- `rag_summary`: Summarized overviews
- `multi_query_rag_search`: Complex query decomposition
- `explore_related_topics`: Knowledge base exploration

### **💡 BrainstormAgent - Creative Innovation Catalyst**

**Primary Role**: Creative ideation, innovation, and solution exploration.

**Capabilities**:
- Generate creative approaches and alternative solutions
- Innovative technology combinations and integrations
- Challenge identification and mitigation strategies
- Future-oriented thinking and emerging trends analysis
- Cross-domain applications and novel approaches

**Temperature**: 0.9 (High creativity)  
**Max Tokens**: 3500

**Specialized Tools**:
- `explore_related_topics`: Creative knowledge connections

### **🔧 APIExpertAgent - Integration Architecture Master**

**Primary Role**: API design, integration patterns, and web service expertise.

**Capabilities**:
- API design patterns and best practices
- Authentication and authorization strategies
- Rate limiting and quota management
- Versioning and backwards compatibility
- Error handling and status codes
- Documentation and developer experience
- Performance optimization and security

**Temperature**: 0.4 (Technical precision)  
**Max Tokens**: 3500

**Specialized Tools**:
- `analyze_technical_feasibility`: Solution analysis

### **🎓 TutorAgent - Educational Guide & Mentor**

**Primary Role**: Learning path creation and educational guidance.

**Capabilities**:
- Break down complex concepts into digestible paths
- Create structured tutorials and learning progressions
- Explain prerequisites and foundational knowledge
- Provide hands-on examples and practical exercises
- Adapt teaching style to different skill levels
- Progressive skill building methodologies

**Temperature**: 0.6 (Balanced explanations)  
**Max Tokens**: 4000

**Specialized Tools**:
- `build_learning_path`: Structured learning progression

### **⚙️ EngineerAgent - Implementation & Production Systems**

**Primary Role**: Technical implementation and production-ready solutions.

**Capabilities**:
- Technical architecture and design patterns
- Implementation phases and milestone planning
- Technology stack evaluation and recommendations
- Performance and scalability requirements
- Testing strategies and quality assurance
- Deployment and maintenance considerations
- Risk assessment and mitigation strategies

**Temperature**: 0.5 (Balanced practicality)  
**Max Tokens**: 3500

**Specialized Tools**:
- `analyze_technical_feasibility`: Implementation analysis

---

## 🔍 MCP DeepLake Integration

### **Technical Architecture**

The demo integrates with a MCP DeepLake server to provide real-time access to a technical knowledge base:

```typescript
// MCP Server Configuration
await app.enableMCP([{
  name: 'deeplake-rag',
  command: '/path/to/python3',
  args: ['/path/to/deeplake_server/main.py'],
  enabled: true
}]);
```

### **Available RAG Tools**

#### **🔍 Basic Search**: `rag_search`
```typescript
{
  query: "PyTorch neural networks",
  n_results: "5",
  recency_weight: 0.0  // 0.0 = standard similarity, 0.3 = recent emphasis
}
```

#### **📄 Document Search**: `rag_document_search`  
```typescript
{
  document_title: "PyTorch Tutorial",
  query: "training loops",
  n_results: 3,
  similarity_threshold: 70  // 0-100 fuzzy matching score
}
```

#### **📋 Summary Search**: `rag_summary`
```typescript
{
  query: "machine learning deployment",
  n_results: "3"  // Returns concatenated summaries
}
```

#### **🎯 Multi-Query RAG**: `multi_query_rag_search`
```typescript
{
  main_query: "Build a machine learning project using PyTorch and specific libraries",
  sub_queries: [  // Auto-generated if not provided
    "PyTorch installation and setup",
    "PyTorch neural network architecture", 
    "PyTorch training loop and optimization",
    "PyTorch data loading and preprocessing",
    "PyTorch model deployment and inference"
  ]
}
```

#### **🌐 Knowledge Explorer**: `explore_related_topics`
```typescript
{
  base_topic: "React components",
  n_results: 5,
  similarity_threshold: 60
}
```

### **Knowledge Base Contents**

The DeepLake knowledge base contains:

- **📚 API Documentation**: REST, GraphQL, SDK references
- **🔧 Framework Tutorials**: React, Vue, Angular, PyTorch, TensorFlow
- **📖 Technical Articles**: Best practices, case studies, patterns
- **💻 Code Examples**: Implementation samples, snippets
- **🏗️ Architecture Guides**: System design, microservices, deployment

---

## 💡 Example Research Queries

### **🔬 Machine Learning Research**
```
"How do I build a machine learning project using PyTorch and specific libraries for computer vision?"
```

**Expected Flow**:
1. **RAGAgent** performs multi-query RAG search
2. **EngineerAgent** analyzes technical implementation requirements
3. **TutorAgent** creates structured learning path
4. **BrainstormAgent** explores innovative approaches

### **🌐 API Integration Research**
```
"Research REST API authentication patterns and best practices for microservices"
```

**Expected Flow**:
1. **RAGAgent** searches API documentation and patterns
2. **APIExpertAgent** provides detailed technical guidance
3. **EngineerAgent** evaluates production considerations
4. **TutorAgent** explains security concepts step-by-step

### **📚 Learning Path Creation**
```
"Create a comprehensive learning path for mastering React and modern web development"
```

**Expected Flow**:
1. **RAGAgent** gathers React tutorials and documentation
2. **TutorAgent** structures progressive learning milestones
3. **EngineerAgent** adds practical project considerations
4. **BrainstormAgent** suggests innovative learning approaches

### **🚀 Innovation Brainstorming**
```
"Brainstorm innovative approaches for real-time data processing with modern tools"
```

**Expected Flow**:
1. **RAGAgent** researches current data processing technologies
2. **BrainstormAgent** generates creative solution approaches
3. **APIExpertAgent** evaluates integration possibilities
4. **EngineerAgent** assesses technical feasibility

---

## ⚡ Phase 1-3 Interactive Orchestration Features

### **🎯 Phase 1: Real-Time Monitoring**
- Live user behavior analysis and intent detection
- Context-aware interaction tracking
- Dynamic plan adjustment based on user needs

### **🧠 Phase 2: Sophisticated Agent Analysis**
- LLM-powered skills matching and capability evaluation
- Advanced collaboration pattern recognition
- Optimal agent selection for complex queries

### **🚀 Phase 3: Adaptive Learning & Prediction**
- Continuous learning from user interactions and feedback
- Predictive routing optimization with behavioral modeling
- Dynamic plan adaptation using LLM reasoning

### **Example Orchestration Flow**

```typescript
// User: "I'm a beginner, how do I start with PyTorch?"
// 🎯 Phase 1: Detects learning intent + beginner level
// 🧠 Phase 2: Analyzes TutorAgent teaching capabilities 
// 🚀 Phase 3: Applies learned preferences for structured guidance
// → Routes to: TutorAgent

// User: "Now I need to optimize this for production deployment"
// 🎯 Phase 1: Monitors complexity shift to production focus
// 🧠 Phase 2: Advanced skills matching for deployment expertise
// 🚀 Phase 3: Predictive model suggests EngineerAgent (96% confidence)
// → Routes to: EngineerAgent

// User: "What are some creative alternatives to this approach?"
// 🎯 Phase 1: Detects creative ideation request
// 🧠 Phase 2: Matches BrainstormAgent's innovation capabilities
// 🚀 Phase 3: Learns user values creative exploration
// → Routes to: BrainstormAgent
```

---

## 🔧 Configuration & Customization

### **MCP Server Setup**

Update the MCP server configuration in the demo:

```typescript
await app.enableMCP([{
  name: 'deeplake-rag',
  command: '/your/python/path',              // Update this
  args: ['/your/deeplake/server/main.py'],   // Update this
  enabled: true
}]);
```

### **Agent Customization**

Modify agent personalities and capabilities:

```typescript
const ragAgent = new Agent({
  name: 'RAGAgent',
  personality: 'Your custom personality...',
  temperature: 0.3,  // Adjust for creativity vs precision
  maxTokens: 4000    // Adjust response length
});
```

### **Knowledge Base Focus**

Customize the knowledge base queries for your domain:

```typescript
// Custom sub-queries for domain-specific research
if (main_query.toLowerCase().includes('your_domain')) {
  queries = [
    'Your domain specific query 1',
    'Your domain specific query 2',
    // ...
  ];
}
```

### **Orchestration Settings**

Fine-tune the orchestration system:

```typescript
const app = new SmallTalk({
  useInteractiveOrchestration: true,
  features: {
    realTimeMonitoring: true,     // Phase 1
    adaptivePlanning: true,       // Phase 3
    predictiveRouting: true,      // Phase 3 
    feedbackLearning: true        // Phase 3
  },
  // Adjust LLM settings
  model: 'gpt-4o',               // Or gpt-4o-mini, claude-3-5-sonnet
  temperature: 0.7               // Global temperature
});
```

---

## 📊 Advanced Features

### **🔍 Multi-Call RAG Retrieval**

The demo automatically performs multiple targeted searches for complex queries:

```typescript
// Single query: "PyTorch machine learning project"
// Automatically becomes:
const searches = [
  "PyTorch installation and setup",
  "PyTorch neural network architecture", 
  "PyTorch training loop and optimization",
  "PyTorch data loading and preprocessing",
  "PyTorch model deployment and inference"
];
// Each search retrieves 3-5 relevant documents
```

### **🧠 Intelligent Knowledge Synthesis**

Agents collaborate to synthesize information:

1. **RAGAgent** gathers comprehensive technical context
2. **Specialized agents** apply their expertise to the research
3. **Interactive orchestration** routes between agents based on user needs
4. **Learning system** improves future routing decisions

### **📚 Context-Aware Research**

The system maintains context across agent switches:

- Previous research queries inform new searches
- Agent personalities adapt to user skill level
- Learning system improves recommendations over time
- Knowledge base exploration builds on previous discoveries

---

## 🚀 Running the Demo

### **CLI Mode**

```bash
smalltalk examples/rag-research-demo.ts
```

**Features**:
- Rich terminal interface with colors and formatting
- Agent switching commands (`/agent RAGAgent`)
- Real-time orchestration feedback
- Debug information for understanding agent routing

### **Web Playground Mode**

```bash
smalltalk playground examples/rag-research-demo.ts
```

**Features**:
- Interactive web chat interface
- Visual agent switching indicators
- Real-time typing indicators
- File upload support (if enabled)
- Mobile-responsive design

### **Example Session Output**

```
🧠 RAG Research & Brainstorm Hub - SmallTalk Framework
=========================================================
✅ RAG Research Environment Ready with MCP DeepLake Integration!
🎯 Phase 1-3 Interactive Orchestration enabled with intelligent agent selection
🔍 DeepLake RAG server configured for technical knowledge retrieval

🤖 Specialized Research Team:
• RAGAgent - Knowledge retrieval and context gathering from technical database
• BrainstormAgent - Creative ideation and innovative solution exploration  
• APIExpertAgent - API design, integration, and architecture expertise
• TutorAgent - Learning paths, tutorials, and educational guidance
• EngineerAgent - Implementation focus and production-ready solutions

💡 Example Research Queries:
• "How do I build a machine learning project using PyTorch and specific libraries?"
• "Research REST API authentication patterns and best practices"
• "Create a learning path for mastering React and modern web development"
• "Brainstorm innovative approaches for real-time data processing"
• "Analyze the technical feasibility of implementing GraphQL federation"
• "Find tutorials and examples for building microservices with Docker"

🔍 RAG Knowledge Base Contains:
• API documentation and integration guides
• Library tutorials and framework examples
• Technical articles and case studies
• Code samples and implementation patterns
• Best practices and architectural guidance

🚀 Advanced Features:
• Multi-call RAG retrieval for complex queries
• Intelligent agent collaboration and knowledge synthesis  
• Context-aware research and personalized recommendations
• Real-time learning from user interactions and feedback
• Adaptive planning based on query complexity and user needs

🗣️  SmallTalk RAG Research Interface
> 
```

---

## 🔧 Troubleshooting

### **Common Issues**

**MCP Server Connection Failed**
```bash
# Check Python path and DeepLake server
python3 /path/to/deeplake_server/main.py

# Update paths in demo configuration
# Line 37-39 in rag-research-demo.ts
```

**No RAG Results**
```bash
# Verify DeepLake database is populated
# Check MCP server logs for errors
# Ensure semantic similarity threshold isn't too high
```

**Agent Not Switching**
```bash
# Verify orchestration is enabled
# Check agent expertise matches query intent
# Lower switching threshold in configuration
```

**API Key Issues**
```bash
# Set environment variable
export OPENAI_API_KEY=your_key_here

# Or create .env file
echo "OPENAI_API_KEY=your_key" > .env
```

### **Performance Optimization**

**For Large Knowledge Bases**:
```typescript
// Adjust retrieval parameters
const ragSearch = {
  parameters: {
    n_results: '3',        // Reduce for faster search
    recency_weight: 0.1    // Add slight recency bias
  }
};
```

**For Limited API Usage**:
```typescript
// Use smaller model for cost optimization
const app = new SmallTalk({
  model: 'gpt-4o-mini',  // Instead of gpt-4o
  temperature: 0.7
});
```

---

## 🎯 Use Cases

### **🔬 Research & Development Teams**
- Technical feasibility analysis
- Competitive technology research
- Innovation brainstorming sessions
- Architecture decision support

### **📚 Educational Platforms** 
- Personalized learning path creation
- Technical concept explanation
- Hands-on tutorial generation
- Progressive skill assessment

### **🏢 Enterprise Consulting**
- Solution architecture recommendations
- Technology stack evaluation
- Implementation strategy planning
- Risk assessment and mitigation

### **💼 Product Development**
- Feature brainstorming and ideation
- Technical implementation planning
- API design and integration strategy
- User experience optimization

---

## 🚀 Next Steps

1. **Customize the Knowledge Base**: Add your domain-specific documentation
2. **Extend Agent Capabilities**: Add specialized tools and integrations
3. **Fine-tune Orchestration**: Adjust routing rules for your use cases
4. **Build Custom Interfaces**: Create domain-specific UI components
5. **Scale the System**: Deploy with load balancing and caching

---

## 📖 Related Documentation

- [SmallTalk Framework Overview](../README.md)
- [Intelligent Orchestration Guide](../guides/orchestration.md)
- [MCP Server Integration](../mcp-server-integration.md)
- [Building Custom Agents](../guides/building-agents.md)
- [CLI Reference](../cli-reference.md)

---

**🎯 The RAG Research & Brainstorm Hub demonstrates the full power of SmallTalk's multi-agent orchestration combined with real-world knowledge integration - perfect for any research-intensive application!** ✨