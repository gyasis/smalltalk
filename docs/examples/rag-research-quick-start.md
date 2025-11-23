# 🚀 RAG Research Demo - Quick Start

**Get the RAG Research & Brainstorm Hub running in under 5 minutes!**

## ⚡ Instant Setup

### **1. Prerequisites Check**
```bash
# Verify Node.js version
node --version  # Should be 18+

# Check if SmallTalk is installed
smalltalk --version  # Or install: npm install -g smalltalk-ai
```

### **2. Environment Setup**
```bash
# Set your LLM provider API key
export OPENAI_API_KEY=your_openai_key_here

# Optional: Configure default settings
export SMALLTALK_DEFAULT_MODEL=gpt-4o-mini  # For cost optimization
```

### **3. Launch the Demo**

**CLI Mode (Fastest):**
```bash
smalltalk examples/rag-research-demo.ts
```

**Web Interface (Recommended):**
```bash
smalltalk playground examples/rag-research-demo.ts
```

**Expected Output:**
```
🧠 RAG Research & Brainstorm Hub initialized with MCP DeepLake integration!
🎯 Phase 1-3 Interactive Orchestration enabled with intelligent agent selection
🔍 DeepLake RAG server configured for technical knowledge retrieval

🤖 Specialized Research Team:
• RAGAgent - Knowledge retrieval and context gathering
• BrainstormAgent - Creative ideation and solution exploration  
• APIExpertAgent - API design and integration expertise
• TutorAgent - Learning paths and educational guidance
• EngineerAgent - Implementation and production systems

🗣️  SmallTalk RAG Research Interface
> 
```

## 💡 Try These Queries

**🔬 Machine Learning Research:**
```
How do I build a machine learning project using PyTorch and specific libraries for computer vision?
```

**🌐 API Design:**
```
Research REST API authentication patterns and best practices for microservices
```

**📚 Learning Path:**
```
Create a comprehensive learning path for mastering React and modern web development
```

**🚀 Innovation Brainstorming:**
```
Brainstorm innovative approaches for real-time data processing with modern tools
```

## 🤖 Agent Commands

Switch between specialized agents during conversation:

```bash
/agent RAGAgent           # Knowledge retrieval specialist
/agent BrainstormAgent    # Creative innovation catalyst  
/agent APIExpertAgent     # Integration architecture master
/agent TutorAgent         # Educational guide & mentor
/agent EngineerAgent      # Implementation & production systems

/help                     # Show all commands
/clear                    # Clear screen
/quit                     # Exit
```

## 🔧 MCP DeepLake Configuration

**If MCP server connection fails:**

1. **Update Python path** in `examples/rag-research-demo.ts` (lines 37-39):
```typescript
command: '/your/python/path',              // Update this
args: ['/your/deeplake_server/main.py'],   // Update this
```

2. **Verify DeepLake server** is running:
```bash
python3 /path/to/deeplake_server/main.py
```

3. **Run without MCP** (demo will work with reduced functionality):
```typescript
// Comment out MCP configuration temporarily
// await app.enableMCP([...]);
```

## 🎯 What You'll See

**Intelligent Agent Routing:**
- System automatically selects the best agent for your query
- Seamless handoffs between specialized experts
- Real-time learning from your interactions

**Advanced RAG Features:**
- Multi-query search breaks down complex questions
- Knowledge base exploration and related topic discovery
- Document-specific search with fuzzy matching
- Summarized overviews from multiple sources

**Phase 1-3 Orchestration:**
- Phase 1: Real-time monitoring of your needs
- Phase 2: Sophisticated agent capability analysis
- Phase 3: Adaptive learning and predictive routing

## 🌐 Web Interface Features

When using `smalltalk playground`:

- **Real-time Chat**: Instant responses with typing indicators
- **Agent Switching**: Visual indicators of active agent
- **Rich Formatting**: Code syntax highlighting, markdown support
- **Mobile Responsive**: Works on phones, tablets, desktops
- **File Uploads**: Attach documents for analysis (if enabled)

**Access at:** `http://localhost:3127` (or custom port)

## 🔍 Advanced Features

**Multi-Query RAG Example:**
```
Query: "Build a machine learning project using PyTorch"

Automatically becomes:
→ "PyTorch installation and setup"
→ "PyTorch neural network architecture" 
→ "PyTorch training loop optimization"
→ "PyTorch data loading preprocessing"
→ "PyTorch model deployment inference"
```

**Knowledge Base Exploration:**
```
> explore_related_topics: "React components"
→ Finds: "React hooks", "React testing", "React performance"
```

**Document Search:**
```
> rag_document_search: "PyTorch Tutorial", "training loops"
→ Searches specifically within PyTorch documentation
```

## 🚨 Troubleshooting

**Common Issues & Solutions:**

| Issue | Solution |
|-------|----------|
| **MCP Connection Failed** | Update Python path in demo config |
| **No API Key** | Set `OPENAI_API_KEY` environment variable |
| **Port Already in Use** | Add `--port 3001` to change port |
| **Agent Not Switching** | Try explicit switching with `/agent AgentName` |

**Debug Mode:**
```bash
# Enable detailed logging
SMALLTALK_DEBUG=true smalltalk examples/rag-research-demo.ts
```

## 🎯 Success Indicators

✅ **Working correctly if you see:**
- MCP DeepLake server connected successfully
- All 5 agents registered and available
- Orchestration system enabled with Phase 1-3 features
- RAG searches returning relevant results
- Intelligent agent switching based on query type

❌ **Issues if you see:**
- MCP connection timeouts or errors
- Agents not responding to queries
- No orchestration activity in logs
- API key errors or rate limiting

## 📖 Next Steps

1. **[📚 Complete Documentation](./rag-research-demo.md)** - Full feature guide
2. **[🔧 MCP Integration](../mcp-server-integration.md#deeplake-rag-integration)** - Setup details
3. **[🎯 Orchestration Guide](../guides/orchestration.md)** - How routing works
4. **[🤖 Building Agents](../guides/building-agents.md)** - Create custom agents

---

**🧠 Happy researching with your AI-powered knowledge team!** ✨