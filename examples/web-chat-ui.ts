#!/usr/bin/env node

import {
  SmallTalk,
  WebChatInterface,
  createWebChat,
  AgentFactory,
  createAgent
} from '../src/index.js';
import { InteractiveOrchestratorAgent } from '../src/agents/InteractiveOrchestratorAgent.js';
import { AgentCapabilities } from '../src/agents/OrchestratorAgent.js';
import { PlaygroundConfig } from '../src/types/index.js';

async function main() {
  console.log('🌐 SmallTalk Web Chat UI with Interactive Orchestration');
  console.log('=========================================================');

  // Get orchestration mode from command line args
  const useOrchestration = process.argv.includes('--orchestration') || process.argv.includes('-o');
  const port = parseInt(process.argv.find(arg => arg.startsWith('--port='))?.split('=')[1] || '3045');

  console.log(`🎯 Orchestration Mode: ${useOrchestration ? 'Enabled' : 'Disabled'}`);
  console.log(`🔌 Port: ${port}`);

  // Create the SmallTalk framework with enhanced configuration
  const app = new SmallTalk({
    llmProvider: 'openai',
    model: 'gpt-4o-mini',
    debugMode: true,
    orchestration: useOrchestration,
    orchestrationConfig: {
      maxAutoResponses: 8,
      enableInterruption: true,
      streamResponses: true,
      contextSensitivity: 0.8
    },
    historyManagement: {
      strategy: 'hybrid',
      maxMessages: 40,
      slidingWindowSize: 20,
      summaryInterval: 12
    }
  });

  // Create diverse agents for web chat
  const helper = createAgent(
    'Helper', 
    'A friendly and helpful assistant who loves to chat and help with any questions. I excel at general conversation, providing information, and assisting with everyday tasks.',
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
    'A data analysis expert who helps with statistics, visualization, and insights. I specialize in interpreting data, creating charts, and providing analytical insights.',
    { temperature: 0.4 }
  );

  const consultant = createAgent(
    'TechConsultant',
    'A technical consultant specializing in system architecture, technology strategy, and engineering best practices. I help with technical decision-making and system design.',
    { temperature: 0.6 }
  );

  // Define agent capabilities for orchestration
  const agentCapabilities: Record<string, AgentCapabilities> = {
    'Helper': {
      expertise: ['general assistance', 'conversation', 'information', 'support'],
      tools: [],
      personalityTraits: ['friendly', 'helpful', 'patient', 'encouraging'],
      taskTypes: ['conversation', 'assistance', 'information'],
      complexity: 'basic',
      contextAwareness: 0.7,
      collaborationStyle: 'supportive'
    },
    'CodeBot': {
      expertise: ['javascript', 'typescript', 'python', 'react', 'programming', 'debugging'],
      tools: ['code_analysis', 'syntax_check', 'debugging'],
      personalityTraits: ['technical', 'precise', 'helpful', 'detail-oriented'],
      taskTypes: ['programming', 'debugging', 'code-review'],
      complexity: 'advanced',
      contextAwareness: 0.8,
      collaborationStyle: 'collaborative'
    },
    'WriteBot': {
      expertise: ['creative writing', 'content creation', 'storytelling', 'copywriting'],
      tools: ['content_generation', 'style_analysis'],
      personalityTraits: ['creative', 'imaginative', 'expressive', 'artistic'],
      taskTypes: ['creative', 'writing', 'content'],
      complexity: 'intermediate',
      contextAwareness: 0.75,
      collaborationStyle: 'collaborative'
    },
    'DataAnalyst': {
      expertise: ['statistics', 'data science', 'charts', 'analysis', 'visualization'],
      tools: ['data_analysis', 'statistical_tests', 'visualization'],
      personalityTraits: ['analytical', 'methodical', 'precise', 'insightful'],
      taskTypes: ['analysis', 'research', 'data'],
      complexity: 'advanced',
      contextAwareness: 0.9,
      collaborationStyle: 'leading'
    },
    'TechConsultant': {
      expertise: ['system architecture', 'technology strategy', 'engineering', 'scalability'],
      tools: ['architecture_review', 'tech_assessment', 'performance_analysis'],
      personalityTraits: ['strategic', 'experienced', 'decisive', 'forward-thinking'],
      taskTypes: ['consultation', 'architecture', 'strategy'],
      complexity: 'expert',
      contextAwareness: 0.95,
      collaborationStyle: 'leading'
    }
  };

  // Add agents to framework
  if (useOrchestration) {
    // Add agents with capabilities for orchestration
    app.addAgent(helper, agentCapabilities['Helper']);
    app.addAgent(coder, agentCapabilities['CodeBot']);
    app.addAgent(writer, agentCapabilities['WriteBot']);
    app.addAgent(analyst, agentCapabilities['DataAnalyst']);
    app.addAgent(consultant, agentCapabilities['TechConsultant']);
  } else {
    // Add agents without orchestration (simple mode)
    app.addAgent(helper);
    app.addAgent(coder);
    app.addAgent(writer);
    app.addAgent(analyst);
    app.addAgent(consultant);
  }

  // Create enhanced web chat interface with full HTML UI
  const webChat = createWebChat({
    port,
    host: 'localhost',
    enableChatUI: true,
    orchestrationMode: useOrchestration
  });

  app.addInterface(webChat);

  // Start the framework
  await app.start();

  // Set up event listeners for orchestration
  if (useOrchestration) {
    app.on('plan_created', (event) => {
      webChat.broadcastPlanEvent(event);
      console.log(`📋 Plan created: ${event.planId.slice(0, 8)}...`);
    });

    app.on('step_started', (event) => {
      webChat.broadcastPlanEvent(event);
      console.log(`▶️  Step: ${event.data?.step?.agentName}`);
    });

    app.on('step_completed', (event) => {
      webChat.broadcastPlanEvent(event);
      console.log(`✅ Step completed`);
    });

    app.on('plan_completed', (event) => {
      webChat.broadcastPlanEvent(event);
      console.log(`🎉 Plan completed: ${event.planId.slice(0, 8)}...`);
    });

    app.on('user_interrupted', (event) => {
      webChat.broadcastPlanEvent(event);
      console.log(`⚡ Plan interrupted by user`);
    });

    app.on('auto_response_limit_reached', (data) => {
      webChat.broadcastNotification({
        type: 'warning',
        message: 'Auto-response limit reached. Please provide input to continue.',
        userId: data.userId
      });
    });

    app.on('streaming_response', (response) => {
      webChat.broadcastStreamingResponse(response);
    });
  }

  console.log('\n✅ SmallTalk Web Chat UI is ready!');
  console.log('\n🌐 Open your browser and go to:');
  console.log(`   ${webChat.getUIUrl()}`);
  
  console.log('\n🤖 Available Agents in Web UI:');
  console.log('• Helper - General-purpose friendly assistant');
  console.log('• CodeBot - Programming expert (JS, TS, Python, React)');
  console.log('• WriteBot - Creative writing assistant');
  console.log('• DataAnalyst - Data analysis and statistics expert');
  console.log('• TechConsultant - System architecture and strategy expert');
  
  console.log(`\n🎨 Web Chat Features ${useOrchestration ? '(with Orchestration)' : '(Simple Mode)'}:`);
  console.log('• Real-time messaging with WebSocket');
  console.log('• Agent switching with visual interface');
  console.log('• Markdown rendering and code highlighting');
  console.log('• Chat export/import functionality');
  console.log('• Mobile-responsive design');
  console.log('• Session statistics and management');
  
  if (useOrchestration) {
    console.log('• 🎯 Interactive Plan Execution');
    console.log('• 📡 Real-time Response Streaming');
    console.log('• ⚡ User Interruption Support');
    console.log('• 🧠 Intelligent History Management');
    console.log('• 🔄 Dynamic Re-planning');
  }
  
  console.log('\n💡 Try these in the web chat:');
  if (useOrchestration) {
    console.log('• "Please introduce yourselves" (creates multi-step plan)');
    console.log('• "Help me build a web app with data analysis" (complex multi-agent task)');
    console.log('• During plan execution, send a message to interrupt and redirect');
    console.log('• Watch real-time streaming of agent responses');
    console.log('• Use plan management controls in the UI');
  } else {
    console.log('• "Help me write a creative story about space"');
    console.log('• "Switch to CodeBot and help me debug this React component"');
    console.log('• "Analyze this sales data and create visualizations"');
    console.log('• Use /agent <name> to switch agents');
  }
  console.log('• Use /help for more commands');

  console.log('\n🔗 Also Available:');
  console.log(`• API endpoint: http://localhost:${port}/api/chat`);
  console.log(`• WebSocket: ws://localhost:${port}`);
  console.log(`• Status: http://localhost:${port}/api/status`);
  if (useOrchestration) {
    console.log(`• Plans API: http://localhost:${port}/api/plans`);
    console.log(`• Orchestration API: http://localhost:${port}/api/orchestration`);
  }

  console.log('\n👥 Usage:');
  console.log('   npm run web-chat              # Simple mode');
  console.log('   npm run web-chat -- -o        # With orchestration');
  console.log('   npm run web-chat -- --port=3000  # Custom port');

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

// Playground configuration for `smalltalk playground` command
export const playgroundConfig: PlaygroundConfig = {
  port: 3126,
  host: 'localhost',
  title: 'Web Chat UI with Interactive Orchestration',
  description: 'Full-featured web chat interface with multiple specialized agents and orchestration support',
  orchestrationMode: true,
  enableChatUI: true
};

// Async initialization function for playground mode
async function initializeApp() {
  const useOrchestration = true; // Default to orchestration in playground mode
  const port = 3126; // Use playground config port

  const app = new SmallTalk({
    llmProvider: 'openai',
    model: 'gpt-4o-mini',
    debugMode: true,
    orchestration: useOrchestration,
    orchestrationConfig: {
      maxAutoResponses: 8,
      enableInterruption: true,
      streamResponses: true,
      contextSensitivity: 0.8
    },
    historyManagement: {
      strategy: 'hybrid',
      maxMessages: 40,
      slidingWindowSize: 20,
      summaryInterval: 12
    }
  });

  // Create and add agents
  const helper = createAgent(
    'Helper',
    'A friendly and helpful assistant who loves to chat and help with any questions. I excel at general conversation, providing information, and assisting with everyday tasks.',
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
    'A data analysis expert who helps with statistics, visualization, and insights. I specialize in interpreting data, creating charts, and providing analytical insights.',
    { temperature: 0.4 }
  );

  const consultant = createAgent(
    'TechConsultant',
    'A technical consultant specializing in system architecture, technology strategy, and engineering best practices. I help with technical decision-making and system design.',
    { temperature: 0.6 }
  );

  // Define agent capabilities for orchestration
  const agentCapabilities: Record<string, AgentCapabilities> = {
    'Helper': {
      expertise: ['general assistance', 'conversation', 'information', 'support'],
      tools: [],
      personalityTraits: ['friendly', 'helpful', 'patient', 'encouraging'],
      taskTypes: ['conversation', 'assistance', 'information'],
      complexity: 'basic',
      contextAwareness: 0.7,
      collaborationStyle: 'supportive'
    },
    'CodeBot': {
      expertise: ['javascript', 'typescript', 'python', 'react', 'programming', 'debugging'],
      tools: ['code_analysis', 'syntax_check', 'debugging'],
      personalityTraits: ['technical', 'precise', 'helpful', 'detail-oriented'],
      taskTypes: ['programming', 'debugging', 'code-review'],
      complexity: 'advanced',
      contextAwareness: 0.8,
      collaborationStyle: 'collaborative'
    },
    'WriteBot': {
      expertise: ['creative writing', 'content creation', 'storytelling', 'copywriting'],
      tools: ['content_generation', 'style_analysis'],
      personalityTraits: ['creative', 'imaginative', 'expressive', 'artistic'],
      taskTypes: ['creative', 'writing', 'content'],
      complexity: 'intermediate',
      contextAwareness: 0.75,
      collaborationStyle: 'collaborative'
    },
    'DataAnalyst': {
      expertise: ['statistics', 'data science', 'charts', 'analysis', 'visualization'],
      tools: ['data_analysis', 'statistical_tests', 'visualization'],
      personalityTraits: ['analytical', 'methodical', 'precise', 'insightful'],
      taskTypes: ['analysis', 'research', 'data'],
      complexity: 'advanced',
      contextAwareness: 0.9,
      collaborationStyle: 'leading'
    },
    'TechConsultant': {
      expertise: ['system architecture', 'technology strategy', 'engineering', 'scalability'],
      tools: ['architecture_review', 'tech_assessment', 'performance_analysis'],
      personalityTraits: ['strategic', 'experienced', 'decisive', 'forward-thinking'],
      taskTypes: ['consultation', 'architecture', 'strategy'],
      complexity: 'expert',
      contextAwareness: 0.95,
      collaborationStyle: 'leading'
    }
  };

  // Add agents with capabilities for orchestration
  app.addAgent(helper, agentCapabilities['Helper']);
  app.addAgent(coder, agentCapabilities['CodeBot']);
  app.addAgent(writer, agentCapabilities['WriteBot']);
  app.addAgent(analyst, agentCapabilities['DataAnalyst']);
  app.addAgent(consultant, agentCapabilities['TechConsultant']);

  return app;
}

export default initializeApp;

// ES module execution detection with playground mode support
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    if (process.env.SMALLTALK_PLAYGROUND_MODE === 'true') {
      // In playground mode, the framework handles initialization
      console.log('🎮 Web Chat UI - Playground Mode');
    } else {
      // CLI mode - run the original main function
      await main();
    }
  })().catch((error) => {
    console.error('❌ Failed to start web chat server:', error);
    process.exit(1);
  });
}