import { 
  SmallTalk, 
  CLIInterface, 
  AgentFactory,
  createAgent,
  PlaygroundConfig
} from '../src/index.js';

// Playground configuration for web mode
export const playgroundConfig: PlaygroundConfig = {
  port: 4000,
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
    model: 'gpt-4o',
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

// Create the app instance
const app = await createBasicChatApp();

// Add CLI interface for direct execution
const cli = new CLIInterface();
app.addInterface(cli);

// Export for CLI usage
export default app;

// Backward compatibility - run if executed directly
if (require.main === module) {
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