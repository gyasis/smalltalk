# SmallTalk API Integration Guide

This comprehensive guide covers all available API endpoints, WebSocket events, and integration patterns for connecting SmallTalk to external platforms and applications.

## Overview

SmallTalk provides three interface modes for integration:

1. **API-Only Mode** - Pure REST API + WebSocket (no UI)
2. **Full Web Mode** - Complete chat interface + API
3. **Hybrid Mode** - Custom configuration mixing both

## REST API Endpoints

### Base Configuration

```javascript
import { SmallTalk, WebInterface } from 'smalltalk-ai';

const app = new SmallTalk({
  llmProvider: 'openai',
  model: 'gpt-4o',
  orchestration: true
});

// API-only server
const webAPI = new WebInterface({
  port: 3126,
  host: 'localhost',
  apiOnly: true,  // No HTML interface
  cors: {
    origin: "*",
    credentials: true
  }
});

app.addInterface(webAPI);
await app.start();
```

### Core Endpoints

#### `GET /` - Server Information
Returns server status and available endpoints.

**Response:**
```json
{
  "message": "SmallTalk API Server",
  "endpoints": ["/api/status", "/api/agents", "/api/chat"],
  "websocket": true
}
```

#### `GET /api/status` - Server Status
Get current server status and connection info.

**Response:**
```json
{
  "status": "running",
  "interface": "web",
  "mode": "api-only",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "connectedClients": 3
}
```

#### `GET /api/agents` - Available Agents
Get list of all available agents and their capabilities.

**Response:**
```json
{
  "agents": [
    {
      "id": "Assistant",
      "name": "Assistant", 
      "personality": "A helpful general-purpose AI assistant",
      "expertise": ["general assistance", "questions"],
      "isActive": true
    },
    {
      "id": "Coder",
      "name": "Coder",
      "personality": "A programming expert who helps with code",
      "expertise": ["programming", "debugging"],
      "isActive": true
    }
  ]
}
```

#### `POST /api/chat` - Send Message
Send a message and receive AI response via HTTP.

**Request:**
```json
{
  "message": "Hello, can you help me with JavaScript?",
  "sessionId": "user-123" // optional
}
```

**Response:**
```json
{
  "response": "I'd be happy to help you with JavaScript! What specific topic or problem are you working on?",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "sessionId": "user-123"
}
```

**Error Response:**
```json
{
  "error": "Failed to process message",
  "details": "Message is required"
}
```

### Orchestration Endpoints (WebChatInterface)

When `orchestrationMode: true` is enabled, additional endpoints become available:

#### `GET /api/plans` - Active Plans
Get all active execution plans.

```json
{
  "plans": [
    {
      "id": "plan-123",
      "status": "running",
      "steps": [...],
      "currentStep": 2
    }
  ]
}
```

#### `POST /api/plans/:planId/pause` - Pause Plan
Pause a running execution plan.

#### `POST /api/plans/:planId/resume` - Resume Plan
Resume a paused execution plan.

#### `GET /api/orchestration` - Orchestration Stats
Get orchestration statistics and performance metrics.

```json
{
  "enabled": true,
  "totalAgents": 4,
  "handoffsToday": 47,
  "averageConfidence": 0.87,
  "topPerformingAgent": "Senior Developer"
}
```

## WebSocket Integration

WebSocket provides real-time bidirectional communication on the same port as the HTTP server.

### Connection

```javascript
const socket = io('ws://localhost:3126');

socket.on('connect', () => {
  console.log('Connected to SmallTalk');
});
```

### Events You Can Emit

#### `chat_message` - Send Message
Send a chat message to the AI.

```javascript
socket.emit('chat_message', {
  message: "What's the weather like?",
  sessionId: "user-123" // optional
});
```

#### `agent_switch` - Switch Agent
Request to switch to a specific agent.

```javascript
socket.emit('agent_switch', {
  agentName: "Coder"
});
```

#### Orchestration Events (if enabled)
```javascript
// Pause an execution plan
socket.emit('pause_plan', { planId: 'plan-123' });

// Resume a plan
socket.emit('resume_plan', { planId: 'plan-123' });

// Interrupt current execution
socket.emit('interrupt_plan', { planId: 'plan-123' });

// Get active plans
socket.emit('get_plans');
```

### Events You Can Listen To

#### `welcome` - Connection Confirmed
Received when first connecting.

```javascript
socket.on('welcome', (data) => {
  console.log(data.message); // "Connected to SmallTalk"
  console.log(data.timestamp);
});
```

#### `message_received` - User Message Echo
Confirmation that your message was received.

```javascript
socket.on('message_received', (message) => {
  console.log('Message sent:', message.content);
});
```

#### `message_response` - AI Response
The AI's response to your message.

```javascript
socket.on('message_response', (message) => {
  console.log('AI Response:', message.content);
  console.log('Agent:', message.agentName);
});
```

#### `agents_updated` - Agent List Update
Receive updated agent list when changes occur.

```javascript
socket.on('agents_updated', (data) => {
  console.log('Available agents:', data.agents);
});
```

#### `agent_switched` - Agent Switch Confirmation
Confirmation of agent switching.

```javascript
socket.on('agent_switched', (data) => {
  console.log('Switched to:', data.agentName);
});
```

#### `error` - Error Handling
Receive error messages.

```javascript
socket.on('error', (error) => {
  console.error('Error:', error.message);
});
```

#### Orchestration Events
```javascript
// Real-time plan updates
socket.on('plan_updated', (plan) => {
  console.log('Plan status:', plan.status);
});

// Streaming responses (if supported)
socket.on('streaming_response', (chunk) => {
  console.log('Response chunk:', chunk.content);
});

// Plan execution events
socket.on('plan_started', (data) => {
  console.log('Plan started:', data.planId);
});

socket.on('plan_completed', (data) => {
  console.log('Plan completed:', data.planId);
});
```

## Integration Examples

### Node.js/Express Integration

```javascript
import express from 'express';
import { SmallTalk, WebInterface } from 'smalltalk-ai';

const expressApp = express();
const port = 3001;

// Create SmallTalk instance
const smalltalk = new SmallTalk({
  llmProvider: 'openai',
  model: 'gpt-4o'
});

// Add agents
smalltalk.addAgent(helper);
smalltalk.addAgent(coder);

// Start SmallTalk API on different port
const smalltalkAPI = new WebInterface({
  port: 3126,
  apiOnly: true
});
smalltalk.addInterface(smalltalkAPI);
await smalltalk.start();

// Your Express routes
expressApp.get('/my-route', async (req, res) => {
  // Call SmallTalk API
  const response = await fetch('http://localhost:3126/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: req.query.question,
      sessionId: req.sessionID
    })
  });
  
  const aiResponse = await response.json();
  res.json(aiResponse);
});

expressApp.listen(port);
```

### React/Frontend Integration

```javascript
// React hook for SmallTalk integration
import { useState, useEffect } from 'react';
import io from 'socket.io-client';

function useSmallTalk(serverUrl = 'http://localhost:3126') {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [agents, setAgents] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const newSocket = io(serverUrl);
    
    newSocket.on('connect', () => {
      setIsConnected(true);
    });
    
    newSocket.on('welcome', (data) => {
      console.log('Connected to SmallTalk:', data.message);
    });
    
    newSocket.on('message_response', (message) => {
      setMessages(prev => [...prev, message]);
    });
    
    newSocket.on('agents_updated', (data) => {
      setAgents(data.agents);
    });
    
    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });
    
    setSocket(newSocket);
    
    return () => newSocket.close();
  }, [serverUrl]);

  const sendMessage = (message, sessionId) => {
    if (socket && isConnected) {
      socket.emit('chat_message', { message, sessionId });
    }
  };

  const switchAgent = (agentName) => {
    if (socket && isConnected) {
      socket.emit('agent_switch', { agentName });
    }
  };

  return {
    sendMessage,
    switchAgent,
    messages,
    agents,
    isConnected
  };
}

// Usage in component
function ChatComponent() {
  const { sendMessage, messages, agents, isConnected } = useSmallTalk();
  
  const handleSend = (text) => {
    sendMessage(text, 'user-123');
  };
  
  return (
    <div>
      <div>Status: {isConnected ? 'Connected' : 'Disconnected'}</div>
      {/* Chat UI here */}
    </div>
  );
}
```

### Python Integration

```python
import requests
import socketio

class SmallTalkClient:
    def __init__(self, base_url='http://localhost:3126'):
        self.base_url = base_url
        self.sio = socketio.Client()
        
        # Set up event handlers
        self.sio.on('connect', self.on_connect)
        self.sio.on('welcome', self.on_welcome)
        self.sio.on('message_response', self.on_message_response)
    
    def connect(self):
        self.sio.connect(self.base_url)
    
    def send_message_http(self, message, session_id=None):
        """Send message via HTTP POST"""
        response = requests.post(f'{self.base_url}/api/chat', json={
            'message': message,
            'sessionId': session_id
        })
        return response.json()
    
    def send_message_ws(self, message, session_id=None):
        """Send message via WebSocket"""
        self.sio.emit('chat_message', {
            'message': message,
            'sessionId': session_id
        })
    
    def get_agents(self):
        """Get available agents"""
        response = requests.get(f'{self.base_url}/api/agents')
        return response.json()
    
    def get_status(self):
        """Get server status"""
        response = requests.get(f'{self.base_url}/api/status')
        return response.json()
    
    def on_connect(self):
        print("Connected to SmallTalk")
    
    def on_welcome(self, data):
        print(f"Welcome: {data['message']}")
    
    def on_message_response(self, data):
        print(f"AI: {data['content']}")

# Usage
client = SmallTalkClient()
client.connect()

# HTTP method
response = client.send_message_http("Hello, can you help me?")
print(response['response'])

# WebSocket method
client.send_message_ws("What's the weather like?")
```

### cURL Examples

```bash
# Get server status
curl http://localhost:3126/api/status

# Get available agents
curl http://localhost:3126/api/agents

# Send a message
curl -X POST http://localhost:3126/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, world!", "sessionId": "test-123"}'

# Get orchestration stats (if enabled)
curl http://localhost:3126/api/orchestration

# Get active plans (if orchestration enabled)  
curl http://localhost:3126/api/plans
```

## Configuration Options

### WebInterface Configuration

```javascript
const webConfig = {
  port: 3126,
  host: 'localhost',
  
  // Static files (for full web mode)
  enableStaticFiles: false,  // true for HTML chat UI
  staticPath: './custom-ui',
  
  // API mode
  apiOnly: true,  // true = API only, false = include HTML UI
  
  // CORS settings
  cors: {
    origin: ["http://localhost:3126", "https://myapp.com"],
    credentials: true
  }
};
```

### WebChatInterface Configuration (Extended)

```javascript
const chatConfig = {
  // All WebInterface options plus:
  enableChatUI: true,
  orchestrationMode: true,  // Enables plan management
  customStaticPath: './my-ui'
};
```

## Error Handling

### HTTP Errors
```javascript
// 400 Bad Request
{
  "error": "Message is required"
}

// 500 Internal Server Error  
{
  "error": "Failed to process message",
  "details": "OpenAI API key not configured"
}
```

### WebSocket Errors
```javascript
socket.on('error', (error) => {
  console.error('WebSocket error:', error.message);
  // Handle reconnection logic here
});
```

## Security Considerations

### CORS Configuration
```javascript
const webAPI = new WebInterface({
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ["https://myapp.com"] 
      : "*",
    credentials: true
  }
});
```

### Rate Limiting (Manual Implementation)
```javascript
// Add rate limiting middleware if needed
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Apply to API routes
webAPI.app.use('/api/', limiter);
```

### Authentication Example
```javascript
// Add authentication middleware
webAPI.app.use('/api/', (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.SMALLTALK_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

## Production Deployment

### Environment Variables
```bash
# LLM Configuration
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key

# SmallTalk Configuration  
SMALLTALK_DEFAULT_PROVIDER=openai
SMALLTALK_DEFAULT_MODEL=gpt-4o
SMALLTALK_API_KEY=your_custom_api_key

# Server Configuration
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/your-server.js"]
```

### Process Management
```javascript
// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await app.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await app.stop();
  process.exit(0);
});
```

This comprehensive API documentation covers everything needed to integrate SmallTalk with external platforms, from simple HTTP calls to complex real-time WebSocket applications.