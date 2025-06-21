# 🚀 Installation & Setup

Get up and running with SmallTalk in under 30 seconds.

## ⚡ Quick Start

### **Option 1: NPM Package (Recommended)**
```bash
# Install SmallTalk
npm install smalltalk

# Create your first AI app
npx create-smalltalk my-ai-app --template=basic
cd my-ai-app

# Set your API key and start
echo "OPENAI_API_KEY=your_key_here" > .env
npm start
```

### **Option 2: Clone & Build**
```bash
# Clone the repository
git clone https://github.com/your-org/smalltalk.git
cd smalltalk

# Install dependencies
npm install

# Run examples
npm run examples
```

---

## 🔧 Prerequisites

### **System Requirements**
- **Node.js 18+** (for ES modules and latest features)
- **npm 8+**, **yarn 1.22+**, or **pnpm 7+**
- **Operating System**: Linux, macOS, or Windows (WSL recommended)

### **API Keys** (Choose one or more)
```bash
# OpenAI (Recommended for beginners)
OPENAI_API_KEY=sk-...

# Anthropic (Great for reasoning)
ANTHROPIC_API_KEY=sk-ant-...

# Google Gemini (Excellent for multimodal)
GEMINI_API_KEY=AI...

# Others supported: Mistral, Cohere, Groq, Perplexity, etc.
```

---

## 📋 Installation Options

### **Core Framework Only**
Perfect if you want to build custom integrations:
```bash
npm install smalltalk
# Includes: agents, core framework, basic interfaces
```

### **Web Development Bundle**
Includes web server and chat UI:
```bash
npm install smalltalk express socket.io
# Includes: everything + web server + real-time chat
```

### **Full Development Suite**
Everything including development tools:
```bash
npm install smalltalk typescript tsx @types/node
# Includes: everything + TypeScript + development tools
```

---

## 🎯 Project Templates

### **Basic Chat**
Simple CLI chatbot with one agent:
```bash
npx create-smalltalk my-chat --template=basic
```

### **Language Tutor**
Multi-agent language learning system:
```bash
npx create-smalltalk my-tutor --template=language-tutor
```

### **Web Chat UI**
Full-featured web chat interface:
```bash
npx create-smalltalk my-webchat --template=web-chat
```

### **Business Meeting**
Multi-agent business simulation:
```bash
npx create-smalltalk my-meeting --template=business-meeting
```

---

## ⚙️ Configuration

### **Environment Variables**
Create a `.env` file in your project root:

```bash
# LLM Provider (choose one)
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GEMINI_API_KEY=your_gemini_key

# SmallTalk Configuration
SMALLTALK_DEFAULT_PROVIDER=openai
SMALLTALK_DEFAULT_MODEL=gpt-4o
SMALLTALK_DEBUG=true

# Optional: Interface Configuration
SMALLTALK_PORT=3000
SMALLTALK_HOST=localhost
```

### **Configuration File**
Create `smalltalk.config.js` for advanced settings:

```typescript
export default {
  // LLM Settings
  llmProvider: 'openai',
  model: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 2048,

  // Interface Settings
  interface: 'cli', // 'cli' | 'web-api' | 'web-chat'
  port: 3000,

  // Agent Settings
  agents: {
    default: {
      personality: 'helpful, knowledgeable, friendly',
      maxMemory: 10,
      tools: []
    }
  },

  // Memory Settings
  memory: {
    type: 'in-memory', // 'in-memory' | 'file' | 'redis'
    maxMessages: 50,
    truncationStrategy: 'smart'
  }
};
```

---

## ✅ Verify Installation

### **Test Core Framework**
```bash
# Run basic example
npm run example:basic

# Expected output:
# 🤖 SmallTalk Framework v0.1.0
# 🎭 Loaded agent: Assistant
# 💬 Starting CLI interface...
# > Hello! I'm your AI assistant. How can I help?
```

### **Test Web Interface**
```bash
# Start web server
npm run example:web-chat

# Expected output:
# 🌐 SmallTalk web interface running on http://localhost:3000
# 📡 WebSocket server ready for real-time chat
```

### **Test LLM Connection**
```typescript
import { SmallTalk } from 'smalltalk';

const app = new SmallTalk();
await app.testConnection(); // Should return true
```

---

## 🔧 Troubleshooting

### **Common Issues**

**"Cannot find module 'token.js'"**
```bash
# Token.js is optional - install it for LLM support
npm install token.js
```

**"API key not found"**
```bash
# Make sure .env file exists and has the right key
echo "OPENAI_API_KEY=your_key_here" > .env
```

**"Port 3000 already in use"**
```bash
# Change port in config or kill existing process
export SMALLTALK_PORT=3001
# or
lsof -ti:3000 | xargs kill
```

**"Permission denied" on Linux/Mac**
```bash
# Fix file permissions
chmod +x node_modules/.bin/smalltalk
```

### **System-Specific Setup**

**Windows (WSL recommended)**
```bash
# Install WSL first, then:
wsl --install Ubuntu
wsl
# Continue with Linux instructions
```

**macOS**
```bash
# Install Node.js via Homebrew
brew install node
# Continue with standard instructions
```

**Linux**
```bash
# Install Node.js via package manager
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
# Continue with standard instructions
```

---

## 🎯 Next Steps

**✅ Installation complete!** Now you can:

1. **🏃‍♂️ [Create Your First Agent](./first-agent.md)** - Build a custom AI assistant
2. **🎛️ [Explore Interfaces](../guides/interfaces.md)** - CLI, Web API, or Chat UI
3. **🤖 [Browse Examples](../examples/README.md)** - See what's possible
4. **⚙️ [Advanced Configuration](./configuration.md)** - Fine-tune your setup

---

**Need help?** Check our [troubleshooting guide](../guides/troubleshooting.md) or [open an issue](https://github.com/your-org/smalltalk/issues).