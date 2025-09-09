import {
  SmallTalk,
  Agent,
  CLIInterface,
  PlaygroundConfig
} from '../src/index.js';

// Playground configuration for `smalltalk playground` command
export const playgroundConfig: PlaygroundConfig = {
  port: 3126,
  host: 'localhost',
  title: '🧪 Simple Test',
  description: 'A simple test agent for CLI functionality',
  orchestrationMode: false,
  enableChatUI: true
};

async function createSimpleTestApp() {
  // Create a simple SmallTalk app
  const app = new SmallTalk({
    llmProvider: 'openai',
    model: 'gpt-4o-mini',
    debugMode: false
  });

  // Create a simple agent
  const testAgent = new Agent({
    name: 'TestBot',
    personality: 'A friendly test assistant'
  });

  // Add agent to app
  app.addAgent(testAgent);

  return app;
}

// Async initialization function for CLI usage
async function initializeApp() {
  const app = await createSimpleTestApp();
  
  // Add CLI interface for direct execution
  const cli = new CLIInterface();
  app.addInterface(cli);
  
  return app;
}

// Export factory function for CLI usage  
export default initializeApp;

// Backward compatibility - run if executed directly
// Check if this is the main module (ES module compatible)
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    // Check if we're in playground mode
    if (process.env.SMALLTALK_PLAYGROUND_MODE === 'true') {
      // Playground mode - set up web interface
      const app = await createSimpleTestApp();
      
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
      
      console.log('🧪 Simple Test - SmallTalk Framework');
      console.log('=====================================');
      console.log('✅ TestBot is ready for conversation!');
      console.log('Type your message and press Enter to chat.\n');
      
      app.start().catch((error) => {
        console.error('❌ Failed to start test:', error);
        process.exit(1);
      });
    }
  })();
}