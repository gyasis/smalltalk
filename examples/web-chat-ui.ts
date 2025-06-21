#!/usr/bin/env node

import {
  SmallTalk,
  WebChatInterface,
  createWebChat,
  AgentFactory,
  createAgent
} from '../src/index.js';

async function main() {
  console.log('🌐 SmallTalk Web Chat UI');
  console.log('========================');

  // Create the SmallTalk framework
  const app = new SmallTalk({
    llmProvider: 'openai',
    model: 'gpt-4o',
    debugMode: true
  });

  // Create diverse agents for web chat
  const helper = createAgent(
    'Helper', 
    'A friendly and helpful assistant who loves to chat and help with any questions',
    { temperature: 0.8 }
  );

  const coder = AgentFactory.createCodingAssistant(
    'CodeBot',
    ['javascript', 'typescript', 'python', 'react']
  );

  const writer = AgentFactory.createWritingAssistant(
    'WriteBot',
    'creative'
  );

  const analyst = createAgent(
    'DataAnalyst',
    'A data analysis expert who helps with statistics, visualization, and insights',
    { 
      temperature: 0.4,
      expertise: ['statistics', 'data science', 'charts', 'analysis']
    }
  );

  // Add agents to framework
  app.addAgent(helper);
  app.addAgent(coder);
  app.addAgent(writer);
  app.addAgent(analyst);

  // Create web chat interface with full HTML UI
  const webChat = createWebChat({
    port: 3000,
    host: 'localhost'
  });

  app.addInterface(webChat);

  // Start the framework
  await app.start();

  console.log('\n✅ SmallTalk Web Chat UI is ready!');
  console.log('\n🌐 Open your browser and go to:');
  console.log(`   ${webChat.getUIUrl()}`);
  
  console.log('\n🤖 Available Agents in Web UI:');
  console.log('• Helper - General-purpose friendly assistant');
  console.log('• CodeBot - Programming expert (JS, TS, Python, React)');
  console.log('• WriteBot - Creative writing assistant');
  console.log('• DataAnalyst - Data analysis and statistics expert');
  
  console.log('\n🎨 Web Chat Features:');
  console.log('• Real-time messaging with WebSocket');
  console.log('• Agent switching with visual interface');
  console.log('• Markdown rendering and code highlighting');
  console.log('• Chat export/import functionality');
  console.log('• Mobile-responsive design');
  console.log('• Session statistics and management');
  
  console.log('\n💡 Try these in the web chat:');
  console.log('• "Help me write a creative story about space"');
  console.log('• "Switch to CodeBot and help me debug this React component"');
  console.log('• "Analyze this sales data and create visualizations"');
  console.log('• Use /agent <name> to switch agents');
  console.log('• Use /help for more commands');

  console.log('\n🔗 Also Available:');
  console.log('• API endpoint: http://localhost:3000/api/chat');
  console.log('• WebSocket: ws://localhost:3000');
  console.log('• Status: http://localhost:3000/api/status');

  console.log('\n🛑 Press Ctrl+C to stop the server\n');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down web chat server...');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Web chat server error:', error);
  process.exit(1);
});

// Run the web chat server
main().catch((error) => {
  console.error('❌ Failed to start web chat server:', error);
  process.exit(1);
});