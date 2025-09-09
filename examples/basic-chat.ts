import { 
  SmallTalk, 
  CLIInterface, 
  AgentFactory,
  createAgent,
  PlaygroundConfig
} from '../src/index.js';

// Playground configuration for web mode
export const playgroundConfig: PlaygroundConfig = {
  port: 3126,
  host: 'localhost',
  title: '💬 Basic Chat Demo',
  description: 'Multi-agent chat with Helper, CodeBot, and Writer',
  orchestrationMode: true,
  enableChatUI: true
};

async function createBasicChatApp() {
  // Create the SmallTalk framework instance with orchestration
  const app = new SmallTalk({
    llmProvider: 'openai',
    model: 'gpt-4o-mini',
    debugMode: true,
    orchestration: true
  });

  // Create agents with capabilities for better orchestration
  const helpfulAgent = createAgent(
    'Helper',
    'A friendly and helpful assistant who loves to help solve problems and answer questions clearly.',
    { temperature: 0.7 }
  );

  const codingAgent = AgentFactory.createCodingAssistant(
    'CodeBot',
    ['javascript', 'typescript', 'python']
  );

  const creativeAgent = AgentFactory.createWritingAssistant(
    'Writer',
    'creative'
  );

  // Add agents with capabilities for intelligent orchestration
  app.addAgent(helpfulAgent, {
    expertise: ['general conversation', 'problem solving', 'questions'],
    complexity: 'basic',
    taskTypes: ['assistance', 'conversation'],
    contextAwareness: 0.8,
    collaborationStyle: 'supportive'
  });

  app.addAgent(codingAgent, {
    expertise: ['javascript', 'typescript', 'python', 'programming', 'debugging'],
    complexity: 'advanced',
    taskTypes: ['coding', 'debugging', 'code review'],
    contextAwareness: 0.9,
    collaborationStyle: 'technical'
  });

  app.addAgent(creativeAgent, {
    expertise: ['writing', 'content creation', 'storytelling', 'editing'],
    complexity: 'intermediate',
    taskTypes: ['creative', 'writing', 'content'],
    contextAwareness: 0.8,
    collaborationStyle: 'creative'
  });

  return app;
}

// Async initialization function for CLI usage
async function initializeApp() {
  const app = await createBasicChatApp();
  
  // Add CLI interface for direct execution
  const cli = new CLIInterface();
  app.addInterface(cli);
  
  return app;
}

// Export factory function for CLI usage  
export default initializeApp;

// Backward compatibility - run if executed directly (ES module compatible)
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    // Check if we're in playground mode
    if (process.env.SMALLTALK_PLAYGROUND_MODE === 'true') {
      // Playground mode - set up web interface
      const app = await createBasicChatApp();
      
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
      
      console.log('🚀 Starting Basic Chat Demo...');
      console.log('✅ SmallTalk is ready!');
      console.log('Available agents:', app.listAgents().join(', '));
      console.log('🎯 Orchestration enabled - agents will be selected intelligently');
      console.log('Type "/agent <name>" to switch agents manually');
      console.log('Type "/help" for more commands\n');
      
      app.start().catch((error) => {
        console.error('❌ Failed to start SmallTalk:', error);
        process.exit(1);
      });
    }
  })();
}