# 🌐 SmallTalk Playground Configuration Guide

Complete guide to configuring SmallTalk scripts for playground mode with dynamic port support.

---

## 📋 Overview

The SmallTalk playground mode provides a rich web interface for your AI applications. To ensure your scripts work seamlessly with both CLI and playground modes, they must follow the **Universal Configuration Pattern**.

### **Current Status (All Examples Updated ✅)**

All 11 SmallTalk example files have been updated to support the universal pattern with dynamic port configuration:

**✅ FULLY COMPLIANT (3 files):**
- `simple-test.ts` (Port 3002)
- `language-tutor.ts` (Port 4001) 
- `orchestrator-demo.ts` (Port 4002)

**✅ NEWLY UPDATED (8 files):**
- `basic-chat.ts` (Port 3000)
- `business-meeting.ts` (Port 4003)
- `medical-tutor.ts` (Port 4004)
- `web-api-server.ts` (Port 3001)
- `interactive-orchestrator-demo.ts` (Port 4005)
- `web-chat-ui.ts` (Port 4006)
- `manifest-demo-simple.ts` (Port 4007)
- `manifest-demo.ts` (Port 4008)

---

## 🎯 Universal Configuration Pattern

### **Required Components**

Every SmallTalk script must include these 5 components for full CLI and playground compatibility:

#### **1. PlaygroundConfig Export**
```typescript
export const playgroundConfig: PlaygroundConfig = {
  port: 3126,                    // Default port (avoiding conflicts with 3000)
  host: 'localhost',             // Host address
  title: '🎓 My Application',     // Web UI title
  description: 'App description', // Web UI description
  orchestrationMode: false,      // Enable orchestration features
  enableChatUI: true            // Enable chat interface
};
```

#### **2. Async Factory Function**
```typescript
async function initializeApp() {
  const app = await createMyApp();
  
  // Add CLI interface for direct execution
  const cli = new CLIInterface();
  app.addInterface(cli);
  
  return app;
}

// Export factory function for CLI usage
export default initializeApp;
```

#### **3. ES Module Detection**
```typescript
if (import.meta.url === `file://${process.argv[1]}`) {
  // Execution logic here
}
```

#### **4. Playground Mode Detection**
```typescript
if (process.env.SMALLTALK_PLAYGROUND_MODE === 'true') {
  // Playground mode setup
} else {
  // CLI mode setup
}
```

#### **5. Dynamic Port Configuration**
```typescript
// Dynamic port configuration - prioritize environment variables from CLI
const port = process.env.SMALLTALK_PLAYGROUND_PORT 
  ? parseInt(process.env.SMALLTALK_PLAYGROUND_PORT) 
  : (playgroundConfig.port || 3000);
const host = process.env.SMALLTALK_PLAYGROUND_HOST || playgroundConfig.host || 'localhost';
```

---

## 🔧 Complete Template

Here's the complete template that all SmallTalk scripts should follow:

```typescript
import { 
  SmallTalk, 
  Agent, 
  CLIInterface, 
  PlaygroundConfig 
} from 'smalltalk';

// 1. REQUIRED: Playground configuration
export const playgroundConfig: PlaygroundConfig = {
  port: 3126,                    // Default port (change as needed)
  host: 'localhost',
  title: '🎯 My SmallTalk App',
  description: 'Description of what this app does',
  orchestrationMode: false,      // Set to true for advanced features
  enableChatUI: true
};

// 2. Create your app function
async function createMyApp() {
  const app = new SmallTalk({
    llmProvider: 'openai',
    model: 'gpt-4o',
    debugMode: false
  });

  // Add your agents
  const agent = new Agent({
    name: 'Assistant',
    personality: 'helpful and knowledgeable'
  });
  
  app.addAgent(agent);
  return app;
}

// 3. REQUIRED: Async initialization function for CLI usage
async function initializeApp() {
  const app = await createMyApp();
  
  // Add CLI interface for direct execution
  const cli = new CLIInterface();
  app.addInterface(cli);
  
  return app;
}

// 4. REQUIRED: Export factory function for CLI commands
export default initializeApp;

// 5. REQUIRED: ES module execution detection with playground mode
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    // Check if we're in playground mode
    if (process.env.SMALLTALK_PLAYGROUND_MODE === 'true') {
      // Playground mode - set up web interface
      const app = await createMyApp();
      
      const { WebChatInterface } = await import('../src/index.js');
      
      // Dynamic port configuration - prioritize environment variables from CLI
      const port = process.env.SMALLTALK_PLAYGROUND_PORT 
        ? parseInt(process.env.SMALLTALK_PLAYGROUND_PORT) 
        : (playgroundConfig.port || 3126);
      const host = process.env.SMALLTALK_PLAYGROUND_HOST || playgroundConfig.host || 'localhost';
      
      const webChat = new WebChatInterface({
        port,
        host,
        cors: { origin: '*' },
        orchestrationMode: playgroundConfig.orchestrationMode || false,
        enableChatUI: playgroundConfig.enableChatUI !== false,
        title: playgroundConfig.title,
        description: playgroundConfig.description,
        type: 'web'
      });
      
      app.addInterface(webChat);
      
      console.log('✅ Starting SmallTalk Playground...');
      console.log(`🌐 Web Interface: http://${host}:${port}`);
      if (playgroundConfig.title) console.log(`📋 Title: ${playgroundConfig.title}`);
      if (playgroundConfig.description) console.log(`📝 Description: ${playgroundConfig.description}`);
      console.log();
      console.log('Press Ctrl+C to stop the server');
      
      await app.start();
    } else {
      // CLI mode
      const app = await initializeApp();
      
      // Your CLI-specific setup and messaging here
      console.log('🎯 Starting My SmallTalk App...');
      console.log('✅ Ready for interaction!');
      
      await app.start();
    }
  })();
}
```

---

## 🔥 Dynamic Port Configuration

The playground mode now supports **truly dynamic port configuration** that allows you to override any file-based configuration:

### **Usage Examples**
```bash
# Use default port from playgroundConfig
smalltalk playground examples/language-tutor.ts

# Override with custom port (dynamic)
smalltalk playground examples/language-tutor.ts --port 5000

# Works with any port number
smalltalk playground examples/orchestrator-demo.ts --port 8080

# Perfect for development conflicts
smalltalk playground examples/simple-test.ts --port 3005
```

### **How It Works**
1. **CLI Parser**: Correctly parses `--port` argument from command line
2. **Environment Variables**: Passes `SMALLTALK_PLAYGROUND_PORT` to spawned process
3. **Priority Order**: Environment variable → playgroundConfig → default (3000)
4. **Real-time Override**: Takes effect immediately, no file changes needed

### **Benefits**
- ✅ **No Port Conflicts**: Change ports instantly when default is busy
- ✅ **Development Friendly**: Run multiple instances on different ports
- ✅ **CI/CD Compatible**: Override ports in deployment environments
- ✅ **Team Collaboration**: Different developers can use different ports

---

## 📊 Port Assignments

All SmallTalk examples now use the same default port to avoid conflicts with common development ports:

| Example File | Default Port | Title |
|-------------|-------------|-------|
| `basic-chat.ts` | 3126 | 🚀 Basic Multi-Agent Chat |
| `web-api-server.ts` | 3126 | 🌐 SmallTalk Web API Server |
| `simple-test.ts` | 3126 | 🧪 Simple Test |
| `language-tutor.ts` | 3126 | 🌍 Language Learning Tutor |
| `orchestrator-demo.ts` | 3126 | 🎯 SmallTalk Orchestrator Demo |
| `business-meeting.ts` | 3126 | 💼 Business Meeting Simulator |
| `medical-tutor.ts` | 3126 | 🏥 Medical Education Tutor |
| `interactive-orchestrator-demo.ts` | 3126 | Interactive Orchestrator Demo |
| `web-chat-ui.ts` | 3126 | Web Chat UI with Interactive Orchestration |
| `manifest-demo-simple.ts` | 3126 | Simple Manifest Demo |
| `manifest-demo.ts` | 3126 | Advanced Manifest Demo |

**Override any port:**
```bash
smalltalk playground examples/any-file.ts --port YOUR_PORT
```

---

## ✅ Verification Checklist

Use this checklist to ensure your SmallTalk script follows the universal pattern:

### **Required Exports**
- [ ] `export const playgroundConfig: PlaygroundConfig = { ... }`
- [ ] `export default initializeApp;` (where initializeApp is async)

### **Required Functions**
- [ ] `async function createMyApp()` - Core app creation
- [ ] `async function initializeApp()` - CLI interface setup

### **Required Execution Logic**
- [ ] `if (import.meta.url === \`file://${process.argv[1]}\`)` - ES module detection
- [ ] `if (process.env.SMALLTALK_PLAYGROUND_MODE === 'true')` - Playground detection
- [ ] Dynamic port configuration reading environment variables
- [ ] WebChatInterface setup for playground mode
- [ ] CLI mode fallback with existing logic

### **Required Configuration**
- [ ] Unique port number (not conflicting with other examples)
- [ ] Meaningful title and description
- [ ] Appropriate orchestrationMode setting
- [ ] `enableChatUI: true` for web interface

### **Testing**
- [ ] `smalltalk examples/my-file.ts` works (CLI mode)
- [ ] `smalltalk playground examples/my-file.ts` works (Playground mode)
- [ ] `smalltalk playground examples/my-file.ts --port 5000` works (Dynamic port)
- [ ] Direct execution `tsx examples/my-file.ts` still works (Backward compatibility)

---

## 🚨 Common Issues & Solutions

### **Missing PlaygroundConfig**
```bash
❌ Error: Playground mode requires a 'playgroundConfig' export.
```
**Solution:** Add `export const playgroundConfig = { ... }` to your file.

### **Wrong Default Export**
```bash
❌ Error: Default export must be a SmallTalk instance.
```
**Solution:** Export an async function, not the SmallTalk instance directly.

### **ES Module Detection Error**
```bash
❌ Error: require is not defined in ES module scope
```
**Solution:** Replace `require.main === module` with `import.meta.url === \`file://${process.argv[1]}\``.

### **Port Configuration Not Working**
```bash
# Still using wrong port despite --port argument
```
**Solution:** Ensure dynamic port configuration reads environment variables correctly.

### **TypeScript Import Errors**
```bash
❌ Error: Cannot find module 'PlaygroundConfig'
```
**Solution:** Import from correct path: `import { PlaygroundConfig } from 'smalltalk';`

---

## 🎯 Best Practices

### **Port Selection**
- Use unique ports for each example (avoid conflicts)
- Use port ranges: 3000-3099 for basic apps, 4000-4099 for advanced apps
- Document your port usage in comments

### **Configuration**
- Set `orchestrationMode: true` for multi-agent applications
- Use descriptive titles and descriptions
- Include emojis in titles for visual distinction

### **Error Handling**
- Preserve existing CLI mode error handling
- Add validation for environment variables if needed
- Provide helpful console messages

### **Development**
- Test both CLI and playground modes
- Verify dynamic port override works
- Ensure backward compatibility with direct execution

---

## 📚 Related Documentation

- [CLI Reference](./cli-reference.md) - Complete CLI command documentation
- [Getting Started](./getting-started/installation.md) - Initial setup guide
- [Building Agents](./guides/building-agents.md) - Agent creation guide
- [Orchestration](./guides/orchestration.md) - Advanced orchestration features

---

## 🆘 Need Help?

- 📖 [Complete Documentation](../README.md)
- 🐛 [Report Issues](https://github.com/your-org/smalltalk/issues)
- 💬 [Community Discussion](https://github.com/your-org/smalltalk/discussions)

---

**Ready to create playground-compatible SmallTalk scripts?**

Use the template above and follow the verification checklist to ensure your scripts work perfectly with both CLI and playground modes! 🚀