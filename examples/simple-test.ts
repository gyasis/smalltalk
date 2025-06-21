#!/usr/bin/env node

import {
  SmallTalk,
  Agent,
  PlaygroundConfig
} from '../src/index.js';

// NEW: Playground configuration for `smalltalk playground` command
export const playgroundConfig: PlaygroundConfig = {
  port: 4002,
  host: 'localhost',
  title: '🧪 Simple Test',
  description: 'A simple test agent for CLI functionality',
  orchestrationMode: false,
  enableChatUI: true
};

// Create a simple SmallTalk app
const app = new SmallTalk({
  llmProvider: 'openai',
  model: 'gpt-4o',
  debugMode: false
});

// Create a simple agent
const testAgent = new Agent({
  name: 'TestBot',
  personality: 'A friendly test assistant'
});

// Add agent to app
app.addAgent(testAgent);

// NEW: Export for `smalltalk` commands
export default app;

// LEGACY: Backward compatibility for `npx tsx` execution
if (require.main === module) {
  const { CLIInterface } = require('../src/index.js');
  
  async function runTest() {
    console.log('🧪 Simple Test - SmallTalk Framework');
    console.log('=====================================');
    
    const cli = new CLIInterface({
      type: 'cli',
      prompt: '> ',
      showTimestamps: false
    });

    app.addInterface(cli);
    await app.start();
  }

  runTest().catch((error) => {
    console.error('❌ Failed to start test:', error);
    process.exit(1);
  });
}