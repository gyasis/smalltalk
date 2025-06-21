#!/usr/bin/env node

import { 
  SmallTalk, 
  CLIInterface, 
  AgentFactory,
  createAgent,
  createCLI 
} from '../src/index.js';

async function main() {
  // Create the SmallTalk framework instance
  const app = new SmallTalk({
    llmProvider: 'openai',
    model: 'gpt-4o',
    debugMode: true
  });

  // Create some agents with different personalities
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

  // Add agents to the framework
  app.addAgent(helpfulAgent);
  app.addAgent(codingAgent);
  app.addAgent(creativeAgent);

  // Create and add CLI interface
  const cli = createCLI({
    prompt: '💬 ',
    showTimestamps: false,
    colors: {
      user: '#00FFFF',
      assistant: '#00FF00',
      system: '#FFFF00'
    }
  });

  app.addInterface(cli);

  // Start the framework
  console.log('🚀 Starting SmallTalk framework...');
  await app.start();

  console.log('\n✅ SmallTalk is ready!');
  console.log('Available agents:', app.listAgents().join(', '));
  console.log('Type "/agent <name>" to switch agents');
  console.log('Type "/help" for more commands\n');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down SmallTalk...');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

// Run the example
main().catch((error) => {
  console.error('❌ Failed to start SmallTalk:', error);
  process.exit(1);
});