import {
  SmallTalk,
  WebInterface,
  createAgent,
  PlaygroundConfig
} from '../src/index.js';

// Playground configuration for web mode (API-only, no chat UI)
export const playgroundConfig: PlaygroundConfig = {
  port: 3001,
  host: 'localhost',
  title: '🌐 SmallTalk Web API',
  description: 'RESTful API server with WebSocket support for agent interactions',
  orchestrationMode: false,
  enableChatUI: false // API-only mode
};

async function createWebAPIServer() {
  // Create the SmallTalk framework with orchestration
  const app = new SmallTalk({
    llmProvider: 'openai',
    model: 'gpt-4o',
    debugMode: true,
    orchestration: true
  });

  // Add agents with capabilities
  const helper = createAgent('Assistant', 'A helpful general-purpose AI assistant');
  const coder = createAgent('Coder', 'A programming expert who helps with code', {
    temperature: 0.3
  });

  app.addAgent(helper, {
    expertise: ['general assistance', 'questions', 'help'],
    complexity: 'basic',
    taskTypes: ['assistance', 'conversation'],
    contextAwareness: 0.8,
    collaborationStyle: 'helpful'
  });

  app.addAgent(coder, {
    expertise: ['programming', 'coding', 'debugging', 'software development'],
    complexity: 'advanced',
    taskTypes: ['coding', 'debugging', 'technical'],
    contextAwareness: 0.9,
    collaborationStyle: 'technical'
  });

  // Create API-only web interface (no HTML frontend)
  const webAPI = new WebInterface({
    port: 3000,
    host: 'localhost'
  });

  app.addInterface(webAPI);

  return app;
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

// Create the app instance
const app = await createWebAPIServer();

// Export for CLI usage
export default app;

// Backward compatibility - run if executed directly
if (require.main === module) {
  console.log('🌐 SmallTalk Web API Server');
  console.log('============================');
  console.log('✅ API server ready!');
  console.log('Available agents:', app.listAgents().join(', '));
  
  console.log('\n🔌 WebSocket Connection:');
  console.log('   Connect to ws://localhost:3000 for real-time chat');
  
  console.log('\n📝 WebSocket Events:');
  console.log('• Emit: "chat_message" with {message: "your message"}');
  console.log('• Listen: "message_response" for AI responses');
  console.log('• Listen: "welcome" for connection confirmation');

  console.log('\n🛑 Press Ctrl+C to stop the server\n');
  
  app.start().catch((error) => {
    console.error('❌ Failed to start API server:', error);
    process.exit(1);
  });
}