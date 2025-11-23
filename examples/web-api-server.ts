import {
  SmallTalk,
  WebInterface,
  createAgent,
  PlaygroundConfig
} from '../src/index.js';

// Playground configuration for web mode (API-only, no chat UI)
export const playgroundConfig: PlaygroundConfig = {
  port: 3126,
  host: 'localhost',
  title: '🌐 SmallTalk Web API',
  description: 'RESTful API server with WebSocket support for agent interactions',
  orchestrationMode: false,
  enableChatUI: false // API-only mode
};

async function createWebAPIServer() {
  // Create the SmallTalk framework with Phase 1-3 Interactive Orchestration
  const app = new SmallTalk({
    llmProvider: 'openai',
    model: 'gpt-4o-mini',
    debugMode: true,
    useInteractiveOrchestration: true,  // 🚀 NEW: Use Phase 1-3 Interactive Orchestration
    features: {
      realTimeMonitoring: true,         // Phase 1: Real-time monitoring
      adaptivePlanning: true,           // Phase 3: Adaptive planning
      predictiveRouting: true,          // Phase 3: Predictive routing
      feedbackLearning: true            // Phase 3: Continuous learning
    }
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
    port: 3126,
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

async function initializeApp() {
  const app = await createWebAPIServer();
  return app;
}

export default initializeApp;

if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    if (process.env.SMALLTALK_PLAYGROUND_MODE === 'true') {
      // Playground mode - set up web interface
      const app = await createWebAPIServer();
      
      const { WebChatInterface } = await import('../src/index.js');
      
      // Dynamic port configuration
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
      console.log('🌐 SmallTalk Web API Server');
      console.log('============================');
      console.log('✅ API server ready!');
      console.log('Available agents:', app.listAgents().join(', '));
      
      console.log('\n🔌 WebSocket Connection:');
      console.log('   Connect to ws://localhost:3126 for real-time chat');
      
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
  })();
}