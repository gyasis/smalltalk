# 🖥️ SmallTalk CLI Reference (v0.2.1)

Complete guide to the SmallTalk unified command-line interface.

---

## 📋 Overview

The SmallTalk CLI provides a unified way to run any SmallTalk script without boilerplate code. Simply export your configured `SmallTalk` instance and run it with a single command.

### **Key Benefits**
- ✅ **Zero Boilerplate**: No interface setup required
- ✅ **Consistent Commands**: Same `smalltalk` command for everything  
- ✅ **Smart Validation**: Helpful error messages and suggestions
- ✅ **Backward Compatible**: All existing scripts work unchanged
- ✅ **Global Access**: Install once, use anywhere

---

## 🚀 Installation

### **Global Installation (Recommended)**
```bash
npm install -g smalltalk
smalltalk --version
```

### **Local Installation**
```bash
npm install smalltalk
npx smalltalk --version
```

### **Development Installation**
```bash
git clone https://github.com/your-org/smalltalk.git
cd smalltalk
npm install
npm link  # Makes `smalltalk` available globally
```

---

## 📖 Commands

### **`smalltalk <file> [options]`**
Run a SmallTalk script in CLI mode.

**Usage:**
```bash
smalltalk examples/language-tutor.ts
smalltalk src/my-agent.ts --verbose
smalltalk scripts/chatbot.js --port 3001
```

**Options:**
- `-v, --verbose`: Enable detailed logging
- `-p, --port <number>`: Port for web-enabled CLI mode (default: 3000)
- `--help`: Show command help

**Example Output:**
```
🎯 SmallTalk CLI Mode
Running: examples/simple-test.ts
✅ Starting SmallTalk CLI...
🗣️  SmallTalk CLI Interface
> Hello! How can I help you today?
```

### **`smalltalk playground <file> [options]`**
Run a SmallTalk script in web playground mode.

**Usage:**
```bash
smalltalk playground examples/language-tutor.ts
smalltalk playground src/my-agent.ts --port 4000
smalltalk playground scripts/chatbot.js --host 0.0.0.0 --verbose
```

**Options:**
- `-p, --port <number>`: Web server port (overrides config)
- `-h, --host <string>`: Web server host (default: localhost) 
- `-v, --verbose`: Enable detailed logging
- `--help`: Show command help

**Example Output:**
```
🌐 SmallTalk Playground Mode
Running: examples/language-tutor.ts
✅ Starting SmallTalk Playground...
🌐 Web Interface: http://localhost:4001
📋 Title: 🌍 Language Learning Tutor
🎯 Orchestration mode enabled
```

### **`smalltalk help`**
Show detailed help information.

```bash
smalltalk help
```

**Output:**
```
🎯 SmallTalk - LLM Agent Framework

Usage:
  smalltalk <file>              Run script in CLI mode
  smalltalk playground <file>   Run script in web playground mode

Examples:
  smalltalk examples/language-tutor.ts
  smalltalk playground examples/language-tutor.ts
  smalltalk playground examples/orchestrator-demo.ts --port 4000

Requirements:
• CLI mode: Script must export a SmallTalk instance as default export
• Playground mode: Script must also export a playgroundConfig object

For more information, visit: https://github.com/your-org/smalltalk
```

### **`smalltalk --version`**
Show version information.

```bash
smalltalk --version
# Output: 0.2.1
```

---

## 📝 Script Requirements

### **CLI Mode Requirements**

Your script must export a configured `SmallTalk` instance as the default export:

```typescript
import { SmallTalk, Agent } from 'smalltalk';

// Create and configure your app
const app = new SmallTalk({
  llmProvider: 'openai',
  model: 'gpt-4o',
  debugMode: false
});

// Add your agents
const assistant = new Agent({
  name: 'Assistant',
  personality: 'helpful and knowledgeable'
});
app.addAgent(assistant);

// REQUIRED: Export for CLI commands
export default app;
```

### **Playground Mode Requirements**

For playground mode, you must also export a `playgroundConfig` object:

```typescript
import { SmallTalk, Agent, PlaygroundConfig } from 'smalltalk';

// Create your SmallTalk app (same as above)
const app = new SmallTalk({ /* ... */ });

// REQUIRED: Playground configuration
export const playgroundConfig: PlaygroundConfig = {
  port: 4001,
  host: 'localhost',
  title: '🎓 My AI Assistant',
  description: 'Helpful AI assistant for learning',
  orchestrationMode: false,
  enableChatUI: true
};

// REQUIRED: Export app for CLI commands
export default app;
```

### **Backward Compatibility**

Existing scripts continue to work unchanged:

```typescript
// This still works with `npx tsx`
const app = new SmallTalk();
const cli = new CLIInterface();
app.addInterface(cli);
await app.start();

// But also supports new CLI if you add:
export default app;
```

---

## ⚙️ Configuration

### **PlaygroundConfig Interface**

```typescript
interface PlaygroundConfig {
  port?: number;                 // Web server port (default: 3000)
  host?: string;                 // Web server host (default: 'localhost')
  title?: string;                // Web UI title
  description?: string;          // Web UI description
  orchestrationMode?: boolean;   // Enable orchestration features
  enableChatUI?: boolean;        // Enable chat interface (default: true)
  cors?: any;                    // CORS configuration
}
```

### **Example Configurations**

**Basic Chat:**
```typescript
export const playgroundConfig = {
  port: 3000,
  host: 'localhost',
  title: 'Basic Chatbot'
};
```

**Language Learning Platform:**
```typescript
export const playgroundConfig = {
  port: 4001,
  host: '0.0.0.0',
  title: '🌍 Language Learning Platform',
  description: 'Multi-agent language learning with Professor, ChatBuddy, and more',
  orchestrationMode: true,
  enableChatUI: true
};
```

**Business Meeting Simulator:**
```typescript
export const playgroundConfig = {
  port: 5000,
  title: '💼 Business Meeting Simulator',
  description: 'Multi-agent business decision making',
  orchestrationMode: true,
  cors: { origin: '*' }
};
```

---

## 🚨 Error Handling

### **Missing Default Export**
```bash
$ smalltalk examples/broken-script.ts
❌ Error: Script must export a SmallTalk instance as default export.

Example:
  const app = new SmallTalk({ ... });
  app.addAgent(myAgent);
  export default app;

For backward compatibility, you can also use:
  npx tsx examples/broken-script.ts
```

**Solution:**
```typescript
// Add this to your script
export default app;
```

### **Missing Playground Config**
```bash
$ smalltalk playground examples/missing-config.ts
❌ Error: Playground mode requires a 'playgroundConfig' export.

Add this to your script:
  export const playgroundConfig = {
    port: 3000,
    host: 'localhost'
  };

Or use CLI mode instead: smalltalk examples/missing-config.ts
```

**Solution:**
```typescript
// Add this to your script
export const playgroundConfig = {
  port: 3000,
  host: 'localhost'
};
```

### **Invalid SmallTalk Instance**
```bash
$ smalltalk examples/wrong-export.ts
❌ Error: Default export must be a SmallTalk instance.
Found: object

Make sure to export your configured SmallTalk instance:
  export default app;
```

**Solution:**
```typescript
// Make sure you're exporting the SmallTalk instance, not a config object
const app = new SmallTalk({ /* ... */ });
export default app; // ✅ Correct

// Not this:
export default { /* config */ }; // ❌ Wrong
```

### **File Not Found**
```bash
$ smalltalk examples/nonexistent.ts
❌ Error: File not found: examples/nonexistent.ts

Make sure the file exists and the path is correct.
Current working directory: /home/user/my-project
```

### **TypeScript Import Error**
```bash
$ smalltalk examples/script.ts
❌ Error: Unknown file extension ".ts" for /path/to/script.ts
```

**Solutions:**
```bash
# 1. Use tsx for development
npm install -g tsx
tsx examples/script.ts

# 2. Use built JavaScript
npm run build
smalltalk dist/examples/script.js

# 3. Use npm scripts (recommended for development)
npm run smalltalk:script
```

### **Port Already in Use**
```bash
$ smalltalk playground examples/script.ts
❌ Error: Port 3000 is already in use.

Try a different port:
  smalltalk playground examples/script.ts --port 3001

Or update your playgroundConfig:
  export const playgroundConfig = { port: 3001 };
```

---

## 🔄 Migration Guide

### **From npm Scripts to CLI**

**Before:**
```json
{
  "scripts": {
    "start": "tsx src/main.ts",
    "dev": "tsx src/main.ts",
    "web": "tsx examples/web-chat-ui.ts"
  }
}
```

**After:**
```json
{
  "scripts": {
    "start": "smalltalk src/main.ts",
    "dev": "smalltalk src/main.ts --verbose", 
    "web": "smalltalk playground src/main.ts",
    "legacy:start": "tsx src/main.ts"
  }
}
```

### **From Interface Setup to Export**

**Before:**
```typescript
// examples/old-way.ts
import { SmallTalk, CLIInterface } from 'smalltalk';

const app = new SmallTalk();
const cli = new CLIInterface();
app.addInterface(cli);
await app.start();
```

**After:**
```typescript
// examples/new-way.ts
import { SmallTalk } from 'smalltalk';

const app = new SmallTalk();
export default app; // That's it!
```

**Run it:**
```bash
# Before
npm run start

# After
smalltalk examples/new-way.ts
```

---

## 🎯 Best Practices

### **Script Organization**
```typescript
// ✅ Recommended structure
import { SmallTalk, Agent, PlaygroundConfig } from 'smalltalk';

// 1. Configuration
export const playgroundConfig: PlaygroundConfig = {
  port: 4000,
  title: 'My App'
};

// 2. App setup
const app = new SmallTalk({
  llmProvider: 'openai',
  model: 'gpt-4o'
});

// 3. Agent creation
const agent = new Agent({
  name: 'Assistant',
  personality: 'helpful'
});

// 4. Assembly
app.addAgent(agent);

// 5. Export
export default app;
```

### **Environment Configuration**
```typescript
// Use environment variables for sensitive data
const app = new SmallTalk({
  llmProvider: process.env.LLM_PROVIDER || 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.LLM_MODEL || 'gpt-4o'
});

export const playgroundConfig = {
  port: parseInt(process.env.PORT || '3000'),
  host: process.env.HOST || 'localhost'
};
```

### **Error Handling**
```typescript
// Add validation for better error messages
if (!process.env.OPENAI_API_KEY) {
  throw new Error(
    'OPENAI_API_KEY environment variable is required.\n' +
    'Set it with: export OPENAI_API_KEY="your-key-here"'
  );
}
```

---

## 🔮 Future Features (v0.3.0)

- **Direct TypeScript Support**: Native `.ts` file execution
- **Config File Support**: `smalltalk.config.js` auto-loading
- **Plugin System**: Custom CLI extensions
- **Interactive Mode**: `smalltalk init` project scaffolding
- **Remote Scripts**: `smalltalk https://example.com/script.ts`

---

## 🆘 Troubleshooting

**Command not found: smalltalk**
```bash
# Install globally
npm install -g smalltalk

# Or use npx
npx smalltalk --help

# Check installation
which smalltalk
```

**Module import errors**
```bash
# Make sure dependencies are installed
npm install

# Check Node.js version (18+ required)
node --version
```

**Permission denied**
```bash
# Fix permissions (Linux/Mac)
chmod +x $(which smalltalk)

# Or run with sudo (not recommended)
sudo smalltalk examples/script.ts
```

**Need help?** 
- 📖 [Documentation](../README.md)
- 🐛 [Report Issues](https://github.com/your-org/smalltalk/issues)
- 💬 [Community Discussion](https://github.com/your-org/smalltalk/discussions)

---

**Ready to get started?**

```bash
npm install -g smalltalk
smalltalk examples/simple-test.ts
```