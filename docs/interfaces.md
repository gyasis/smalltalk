# SmallTalk Interface Guide

SmallTalk provides multiple interface options to suit different use cases, from command-line tools to web APIs to full HTML chat applications.

## 🖥️ Interface Types

### 1. CLI Interface
**Best for**: Development, debugging, server environments, command-line tools

```typescript
import { CLIInterface, createCLI } from 'smalltalk';

// Basic CLI
const cli = createCLI({
  prompt: '💬 ',
  showTimestamps: true,
  colors: {
    user: '#00FFFF',
    assistant: '#00FF00'
  }
});

app.addInterface(cli);
```

**Features:**
- Rich terminal colors and formatting
- Agent switching with `/agent <name>`
- Command history and shortcuts
- Markdown rendering in terminal
- Code syntax highlighting
- Real-time typing experience

### 2. Web API Interface  
**Best for**: API integrations, headless servers, custom frontends, mobile apps

```typescript
import { WebInterface, createWebAPI } from 'smalltalk';

// API-only server (no HTML)
const webAPI = createWebAPI({
  port: 3000,
  apiOnly: true  // No static files served
});

app.addInterface(webAPI);
```

**Features:**
- RESTful API endpoints
- WebSocket real-time communication
- JSON request/response format
- CORS support for cross-origin requests
- No HTML interface - pure API

**API Endpoints:**
- `GET /api/status` - Server health and info
- `GET /api/agents` - List available agents  
- `POST /api/chat` - Send messages (HTTP alternative to WebSocket)

**WebSocket Events:**
- `chat_message` - Send message to AI
- `message_response` - Receive AI response
- `agent_switch` - Switch active agent

### 3. Web Chat Interface
**Best for**: User-facing applications, demos, prototyping, full chat experiences

```typescript
import { WebChatInterface, createWebChat } from 'smalltalk';

// Full web chat with HTML UI
const webChat = createWebChat({
  port: 3000,
  enableStaticFiles: true  // Serves HTML/CSS/JS
});

app.addInterface(webChat);
```

**Features:**
- Complete HTML chat interface
- Real-time messaging with WebSocket
- Agent switching with visual UI
- Markdown and code highlighting
- Chat export/import functionality
- Mobile-responsive design
- Session statistics
- Built on the style guide provided

## 🔧 Configuration Options

### CLI Configuration
```typescript
interface CLIConfig {
  prompt?: string;           // Command prompt (default: '> ')
  colors?: {                 // Terminal colors
    user?: string;
    assistant?: string;
    system?: string;
    error?: string;
  };
  showTimestamps?: boolean;  // Show message timestamps
  showAgentNames?: boolean;  // Show agent names in output
}
```

### Web API Configuration
```typescript
interface WebConfig {
  port?: number;             // Server port (default: 3000)
  host?: string;             // Server host (default: 'localhost')
  apiOnly?: boolean;         // API-only mode (no static files)
  cors?: {                   // CORS settings
    origin?: string | string[];
    credentials?: boolean;
  };
}
```

### Web Chat Configuration
```typescript
interface WebChatConfig extends WebConfig {
  enableStaticFiles?: boolean;  // Serve HTML interface
  customStaticPath?: string;    // Custom static files path
}
```

## 🚀 Usage Examples

### CLI Application
```bash
npm run example:basic
# Interactive terminal chat with agent switching
```

### API Server  
```bash
npm run example:web-api
# Then use curl or any HTTP client:
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello AI!"}'
```

### Web Chat Application
```bash
npm run example:web-chat
# Open browser to http://localhost:3000
# Full HTML chat interface with agent switching
```

## 🔀 Mixing Interfaces

You can run multiple interfaces simultaneously:

```typescript
const app = new SmallTalk();

// Add CLI for development/debugging
app.addInterface(createCLI());

// Add web API for integrations  
app.addInterface(createWebAPI({ port: 3000 }));

// Add web chat for users
app.addInterface(createWebChat({ port: 3001 }));

await app.start();
// Now accessible via terminal AND web API AND web UI
```

## 🛠️ Custom Interfaces

Create your own interface by extending `BaseInterface`:

```typescript
import { BaseInterface, ChatMessage } from 'smalltalk';

class DiscordInterface extends BaseInterface {
  async start() {
    // Initialize Discord bot
  }

  async sendMessage(message: ChatMessage) {
    // Send to Discord channel
  }

  async stop() {
    // Cleanup Discord connection
  }
}

// Use your custom interface
app.addInterface(new DiscordInterface());
```

## 📊 Interface Comparison

| Feature | CLI | Web API | Web Chat |
|---------|-----|---------|----------|
| **Use Case** | Development, servers | Integrations, mobile | End users, demos |
| **User Experience** | Terminal-based | Programmatic | Web browser |
| **Real-time** | ✅ Interactive | ✅ WebSocket | ✅ WebSocket + UI |
| **Agent Switching** | Commands | API calls | Visual buttons |
| **Deployment** | Any server | Any server | Web server |
| **Custom Frontend** | N/A | ✅ Build your own | 🔧 Modify provided |
| **Mobile Friendly** | N/A | ✅ API | ✅ Responsive |

## 🎯 When to Use Each

### Use CLI Interface When:
- Building command-line tools
- Development and debugging
- Server administration
- Scripting and automation
- No GUI needed

### Use Web API Interface When:
- Building mobile apps
- Integrating with existing systems
- Creating custom frontends
- Microservices architecture
- Need programmatic access

### Use Web Chat Interface When:  
- Building user-facing applications
- Prototyping chat experiences
- Demonstrating capabilities
- Need immediate web UI
- Want full-featured chat

The choice depends on your specific use case, technical requirements, and user experience goals. SmallTalk's flexible interface system lets you pick the right tool for each job!