# SmallTalk Framework Requirements

## 📋 System Requirements

### Node.js Version
- **Node.js 18+** (for ES modules and latest features)
- **npm 8+** or **yarn 1.22+** or **pnpm 7+**

### Operating System
- **Linux** (recommended)
- **macOS** 
- **Windows** (with WSL recommended)

## 📦 Dependencies

### Core Dependencies (Required)
```json
{
  "express": "^4.18.2",
  "socket.io": "^4.7.2", 
  "nanoid": "^5.0.1",
  "chalk": "^5.3.0",
  "commander": "^11.1.0",
  "yaml": "^2.3.2",
  "lodash": "^4.17.21"
}
```

### LLM Integration (Required)
**Token.js handles ALL LLM providers internally** - no need for individual SDKs:

```bash
# Just install Token.js - it supports 200+ LLMs from 10+ providers
npm install token.js

# ❌ DON'T install these - Token.js handles them internally:
# npm install openai @anthropic-ai/sdk @google/generative-ai
```

### MCP Integration (Optional)
```bash
# Official MCP SDK
npm install @modelcontextprotocol/sdk

# If not available, MCP features will be disabled
```

### Development Dependencies
```json
{
  "@types/node": "^20.8.0",
  "@types/express": "^4.17.18",
  "@types/lodash": "^4.14.199",
  "typescript": "^5.2.2",
  "tsx": "^3.14.0",
  "eslint": "^8.50.0",
  "@typescript-eslint/eslint-plugin": "^6.7.4"
}
```

## 🚀 Installation Options

### Option 1: Full Installation (Recommended)
```bash
# Clone/download SmallTalk framework
git clone <repository-url>
cd smalltalk

# Install all dependencies
npm install

# Run examples
npm run examples
```

### Option 2: Minimal Installation
```bash
# Install only core dependencies
npm install express socket.io nanoid chalk commander yaml lodash

# Install TypeScript for development
npm install -D typescript tsx @types/node

# Install LLM SDK of choice
npm install openai  # or @anthropic-ai/sdk, etc.
```

### Option 3: Custom Installation
Pick and choose based on your needs:

```bash
# CLI only (no web interfaces)
npm install chalk commander nanoid

# Web API only (no CLI)  
npm install express socket.io nanoid

# Full web chat
npm install express socket.io nanoid chalk
```

## 🔧 Environment Variables

### Required for LLM Integration
```bash
# Choose your preferred LLM provider(s)
OPENAI_API_KEY=your_openai_key
# OR
ANTHROPIC_API_KEY=your_anthropic_key  
# OR
GEMINI_API_KEY=your_gemini_key
```

### Optional Configuration
```bash
SMALLTALK_DEBUG=true
SMALLTALK_DEFAULT_PROVIDER=openai
SMALLTALK_DEFAULT_MODEL=gpt-4o
```

## ⚠️ Known Issues & Alternatives

### If Token.js is not available:
Replace Token.js wrapper with direct LLM SDK calls:

```typescript
// Instead of Token.js
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function callLLM(prompt: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }]
  });
  return response.choices[0].message.content;
}
```

### If PocketFlow is not available:
SmallTalk implements its own flow management, so PocketFlow dependency can be removed.

### If MCP SDK is not available:
MCP features will be disabled, but core chat functionality remains.

## 🧪 Testing Your Installation

### Quick Test
```bash
# Test core framework
npm run example:basic

# Test web interface  
npm run example:web-api

# Test full web chat
npm run example:web-chat
```

### Verify Dependencies
```bash
# Check all dependencies are installed
npm list

# Check for missing packages
npm audit
```

## 🔄 Fallback Options

If any dependencies fail to install:

1. **Remove problematic dependencies** from package.json
2. **Use alternative packages** (e.g., axios instead of custom HTTP clients)
3. **Disable optional features** (e.g., MCP integration)
4. **Use direct SDK calls** instead of wrapper libraries

## 📞 Support

If you encounter dependency issues:

1. Check Node.js version: `node --version` (should be 18+)
2. Clear npm cache: `npm cache clean --force`
3. Delete node_modules and reinstall: `rm -rf node_modules && npm install`
4. Use yarn as alternative: `yarn install`
5. Report issues with your system info and error messages

The framework is designed to be modular - you can start with basic features and add more dependencies as needed!