#!/usr/bin/env node

import {
  SmallTalk,
  WebInterface,
  createWebAPI,
  createAgent
} from '../src/index.js';

async function main() {
  console.log('🌐 SmallTalk Web API Server');
  console.log('===========================');

  // Create the SmallTalk framework
  const app = new SmallTalk({
    llmProvider: 'openai',
    model: 'gpt-4o',
    debugMode: true
  });

  // Add some agents
  const helper = createAgent('Assistant', 'A helpful general-purpose AI assistant');
  const coder = createAgent('Coder', 'A programming expert who helps with code', {
    temperature: 0.3
  });

  app.addAgent(helper);
  app.addAgent(coder);

  // Create API-only web interface (no HTML frontend)
  const webAPI = createWebAPI({
    port: 3000,
    host: 'localhost'
  });

  app.addInterface(webAPI);

  // Start the framework
  await app.start();

  console.log('\n✅ SmallTalk Web API Server is running!');
  console.log('\n🔗 API Endpoints:');
  console.log('• GET  http://localhost:3000/api/status - Server status');
  console.log('• GET  http://localhost:3000/api/agents - List available agents');
  console.log('• POST http://localhost:3000/api/chat - Send chat message');
  
  console.log('\n💻 Example API Calls:');
  console.log('\n1. Check status:');
  console.log('   curl http://localhost:3000/api/status');
  
  console.log('\n2. Send message:');
  console.log('   curl -X POST http://localhost:3000/api/chat \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log('     -d \'{"message": "Hello, can you help me?"}\'');
  
  console.log('\n3. Switch agent and send message:');
  console.log('   curl -X POST http://localhost:3000/api/chat \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log('     -d \'{"message": "/agent Coder"}\'');
  
  console.log('\n🔌 WebSocket Connection:');
  console.log('   Connect to ws://localhost:3000 for real-time chat');
  
  console.log('\n📝 WebSocket Events:');
  console.log('• Emit: "chat_message" with {message: "your message"}');
  console.log('• Listen: "message_response" for AI responses');
  console.log('• Listen: "welcome" for connection confirmation');

  console.log('\n🛑 Press Ctrl+C to stop the server\n');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down API server...');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('❌ API server error:', error);
  process.exit(1);
});

// Run the API server
main().catch((error) => {
  console.error('❌ Failed to start API server:', error);
  process.exit(1);
});