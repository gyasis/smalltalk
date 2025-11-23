/**
 * 🎯 SmallTalk Orchestrator Demo
 * 
 * This example demonstrates the intelligent agent orchestration system that
 * automatically routes conversations to the most suitable agent based on
 * user intent, topic complexity, and agent capabilities.
 * 
 * Enhanced with Interactive Orchestrator features:
 * - Multi-step plan generation and execution
 * - Real-time response streaming
 * - User intervention during plan execution
 * - Advanced history management strategies
 */

import { SmallTalk } from '../src/core/SmallTalk.js';
import { Agent } from '../src/agents/Agent.js';
import { CLIInterface } from '../src/interfaces/CLIInterface.js';
import { AgentCapabilities } from '../src/agents/OrchestratorAgent.js';
import { PlaygroundConfig } from '../src/types/index.js';

// Playground configuration for web mode
export const playgroundConfig: PlaygroundConfig = {
  port: 3126,
  host: 'localhost',
  title: '🎯 SmallTalk Orchestrator Demo',
  description: 'Advanced multi-agent orchestration with intelligent routing and plan execution',
  orchestrationMode: true,
  enableChatUI: true
};

// 🎓 Create specialized agents with distinct capabilities
const professor = new Agent({
  name: 'Professor Williams',
  personality: 'academic, thorough, patient, encouraging',
  expertise: ['computer science', 'algorithms', 'data structures', 'theory'],
  systemPrompt: `You are Professor Williams, a computer science professor who loves teaching complex topics with clear examples and theoretical depth.
  
  🎯 Your teaching style:
  - Break down complex concepts step by step
  - Provide academic context and theory
  - Use formal explanations with examples
  - Encourage deeper understanding
  - Reference academic sources when helpful`,
  
  tools: [
    {
      name: 'generateAcademicExample',
      description: 'Generate detailed academic examples for complex concepts',
      parameters: {
        type: 'object',
        properties: {
          concept: { type: 'string', description: 'The concept to explain' },
          level: { type: 'string', enum: ['undergraduate', 'graduate', 'PhD'] }
        },
        required: ['concept']
      },
      handler: async ({ concept, level = 'undergraduate' }) => {
        return {
          concept,
          level,
          example: `Academic example for ${concept} at ${level} level`,
          references: ['Academic Source 1', 'Academic Source 2'],
          exercises: [`Exercise 1 for ${concept}`, `Exercise 2 for ${concept}`]
        };
      }
    }
  ]
});

const developer = new Agent({
  name: 'Senior Developer',
  personality: 'practical, experienced, direct, solution-oriented',
  expertise: ['software development', 'debugging', 'best practices', 'code review'],
  systemPrompt: `You are a Senior Developer with 10+ years of experience building production systems.
  
  🛠️ Your approach:
  - Focus on practical, working solutions
  - Share real-world experience and gotchas
  - Provide code examples and best practices
  - Help debug and troubleshoot issues
  - Think about scalability and maintainability`,
  
  tools: [
    {
      name: 'analyzeCode',
      description: 'Analyze code for issues and improvements',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Code to analyze' },
          language: { type: 'string', description: 'Programming language' }
        },
        required: ['code']
      },
      handler: async ({ code, language = 'javascript' }) => {
        return {
          issues: ['Potential issue 1', 'Potential issue 2'],
          suggestions: ['Improvement 1', 'Improvement 2'],
          bestPractices: ['Best practice 1', 'Best practice 2'],
          language
        };
      }
    }
  ]
});

const tutor = new Agent({
  name: 'Friendly Tutor',
  personality: 'encouraging, patient, supportive, beginner-friendly',
  expertise: ['basic programming', 'learning support', 'motivation'],
  systemPrompt: `You are a Friendly Tutor who specializes in helping beginners learn programming.
  
  🌟 Your teaching style:
  - Use simple, encouraging language
  - Break things down into small steps
  - Celebrate small wins and progress
  - Provide lots of encouragement
  - Make learning feel fun and achievable`,
  
  tools: [
    {
      name: 'createBeginnerExercise',
      description: 'Create beginner-friendly programming exercises',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'Programming topic' },
          difficulty: { type: 'string', enum: ['very-easy', 'easy', 'medium'] }
        },
        required: ['topic']
      },
      handler: async ({ topic, difficulty = 'easy' }) => {
        return {
          exercise: `Beginner exercise for ${topic}`,
          hints: ['Hint 1', 'Hint 2', 'Hint 3'],
          solution: `Solution for ${topic} exercise`,
          encouragement: 'You can do this! Take it step by step.'
        };
      }
    }
  ]
});

const consultant = new Agent({
  name: 'Technical Consultant',
  personality: 'strategic, analytical, business-focused, decisive',
  expertise: ['system architecture', 'technical strategy', 'scalability', 'performance'],
  systemPrompt: `You are a Technical Consultant who helps organizations make strategic technology decisions.
  
  🎯 Your expertise:
  - System architecture and design patterns
  - Technology strategy and roadmaps
  - Performance optimization and scalability
  - Risk assessment and mitigation
  - Cost-benefit analysis of technical decisions`,
  
  tools: [
    {
      name: 'architecturalRecommendation',
      description: 'Provide architectural recommendations for systems',
      parameters: {
        type: 'object',
        properties: {
          requirements: { type: 'string', description: 'System requirements' },
          scale: { type: 'string', enum: ['small', 'medium', 'large', 'enterprise'] }
        },
        required: ['requirements']
      },
      handler: async ({ requirements, scale = 'medium' }) => {
        return {
          architecture: `Recommended architecture for ${scale} scale`,
          technologies: ['Tech 1', 'Tech 2', 'Tech 3'],
          tradeoffs: ['Tradeoff 1', 'Tradeoff 2'],
          risks: ['Risk 1', 'Risk 2'],
          timeline: `Estimated timeline for ${scale} implementation`
        };
      }
    }
  ]
});

// Define agent capabilities for the orchestrator
const agentCapabilities: Record<string, AgentCapabilities> = {
  'Professor Williams': {
    expertise: ['computer science', 'algorithms', 'data structures', 'theory', 'academic research'],
    tools: ['generateAcademicExample'],
    personalityTraits: ['academic', 'thorough', 'patient', 'encouraging'],
    taskTypes: ['educational', 'theoretical', 'explanation'],
    complexity: 'expert',
    contextAwareness: 0.9,
    collaborationStyle: 'leading'
  },
  
  'Senior Developer': {
    expertise: ['software development', 'debugging', 'best practices', 'code review'],
    tools: ['analyzeCode'],
    personalityTraits: ['practical', 'experienced', 'direct', 'solution-oriented'],
    taskTypes: ['problem', 'implementation', 'debugging'],
    complexity: 'advanced',
    contextAwareness: 0.8,
    collaborationStyle: 'collaborative'
  },
  
  'Friendly Tutor': {
    expertise: ['basic programming', 'learning support', 'motivation', 'beginner guidance'],
    tools: ['createBeginnerExercise'],
    personalityTraits: ['encouraging', 'patient', 'supportive', 'beginner-friendly'],
    taskTypes: ['educational', 'assistance', 'motivation'],
    complexity: 'basic',
    contextAwareness: 0.7,
    collaborationStyle: 'supportive'
  },
  
  'Technical Consultant': {
    expertise: ['system architecture', 'technical strategy', 'scalability', 'performance'],
    tools: ['architecturalRecommendation'],
    personalityTraits: ['strategic', 'analytical', 'business-focused', 'decisive'],
    taskTypes: ['analysis', 'strategy', 'architecture'],
    complexity: 'expert',
    contextAwareness: 0.9,
    collaborationStyle: 'leading'
  }
};

async function createOrchestratorDemo() {
  console.log('🎯 SmallTalk Orchestrator Demo');
  console.log('=====================================');
  console.log('');
  
  // Create SmallTalk instance with Phase 1-3 Interactive Orchestration enabled
  const app = new SmallTalk({
    llmProvider: 'openai',
    model: 'gpt-4o-mini',
    useInteractiveOrchestration: true,  // 🚀 NEW: Use Phase 1-3 Interactive Orchestration
    features: {
      realTimeMonitoring: true,         // Phase 1: Real-time monitoring
      adaptivePlanning: true,           // Phase 3: Adaptive planning
      predictiveRouting: true,          // Phase 3: Predictive routing
      feedbackLearning: true            // Phase 3: Continuous learning
    },
    debugMode: true
  });

  // Add all agents with their capabilities
  app.addAgent(professor, agentCapabilities['Professor Williams']);
  app.addAgent(developer, agentCapabilities['Senior Developer']);
  app.addAgent(tutor, agentCapabilities['Friendly Tutor']);
  app.addAgent(consultant, agentCapabilities['Technical Consultant']);

  // Add CLI interface
  const cli = new CLIInterface({
    prompt: '🎯 You: ',
    colors: true,
    historySize: 100
  });
  app.addInterface(cli);

  // Add custom handoff rules for demonstration
  app.addHandoffRule(
    (context, message) => message.toLowerCase().includes('beginner') || message.toLowerCase().includes('just started'),
    'Friendly Tutor',
    10 // High priority
  );

  app.addHandoffRule(
    (context, message) => message.toLowerCase().includes('architecture') || message.toLowerCase().includes('system design'),
    'Technical Consultant',
    8
  );

  app.addHandoffRule(
    (context, message) => message.toLowerCase().includes('bug') || message.toLowerCase().includes('debug'),
    'Senior Developer',
    7
  );

  // Set up event listeners to show orchestration in action
  app.on('agent_handoff', (data) => {
    console.log(`\n🎯 ORCHESTRATOR: Switching from "${data.fromAgent || 'none'}" to "${data.toAgent}"`);
    console.log(`   Reason: ${data.reason}`);
    console.log(`   Confidence: ${(data.confidence * 100).toFixed(0)}%\n`);
  });

  app.on('message_processed', (data) => {
    if (data.orchestrated) {
      console.log(`💡 This response was orchestrated automatically!\n`);
    }
  });

  // Enhanced event listeners for plan execution
  app.on('plan_created', (event) => {
    console.log(`\n📋 Plan created: ${event.planId.slice(0, 8)}...`);
  });

  app.on('step_started', (event) => {
    if (event.data?.step) {
      console.log(`▶️  Step: ${event.data.step.agentName} - ${event.data.step.action.slice(0, 50)}...`);
    }
  });

  app.on('step_completed', (event) => {
    console.log(`✅ Step completed`);
  });

  app.on('plan_completed', (event) => {
    console.log(`\n🎉 Plan completed: ${event.planId.slice(0, 8)}...`);
  });

  app.on('user_interrupted', (event) => {
    console.log(`\n⚡ Plan paused for user input`);
  });

  app.on('auto_response_limit_reached', (data) => {
    console.log(`\n⚠️  Auto-response limit reached. Please provide input to continue.`);
  });

  // Add enhanced CLI command handlers
  cli.registerCommand('stats', () => {
    const stats = app.getOrchestrationStats();
    console.log('\n📋 Orchestration Stats:');
    console.log(`   Enabled: ${stats.enabled}`);
    console.log(`   Total Agents: ${stats.totalAgents}`);
    console.log(`   Active Plans: ${stats.activePlans || 0}`);
    console.log(`   Current Assignments:`, stats.currentAgentAssignments);
    console.log('');
  });

  cli.registerCommand('plans', () => {
    const plans = app.getActivePlans();
    if (plans.length === 0) {
      console.log('\n📜 No active plans');
    } else {
      console.log('\n📜 Active Plans:');
      plans.forEach(plan => {
        console.log(`   • ${plan.id.slice(0, 8)}: ${plan.userIntent} (${plan.status})`);
      });
    }
    console.log('');
  });

  cli.registerCommand('pause', async (args) => {
    if (args.length > 0) {
      const planId = args[0];
      const success = app.pausePlan(planId);
      console.log(success ? `\n⏸️  Plan ${planId.slice(0, 8)} paused` : `\n❌ Plan ${planId} not found`);
    } else {
      console.log('\n⚠️  Usage: /pause <plan_id>');
    }
  });

  cli.registerCommand('resume', async (args) => {
    if (args.length > 0) {
      const planId = args[0];
      const success = await app.resumePlan(planId, 'demo-session', 'demo-user');
      console.log(success ? `\n▶️  Plan ${planId.slice(0, 8)} resumed` : `\n❌ Plan ${planId} could not be resumed`);
    } else {
      console.log('\n⚠️  Usage: /resume <plan_id>');
    }
  });

  cli.registerCommand('status', () => {
    const stats = app.getStats();
    console.log('\n🔍 System Status:');
    console.log(`   Agents: ${stats.agentCount}`);
    console.log(`   Active Sessions: ${stats.activeSessionCount}`);
    console.log(`   Orchestration: ${stats.orchestrationStats?.enabled ? 'Enabled' : 'Disabled'}`);
    console.log(`   Streaming: ${stats.streamingEnabled ? 'Enabled' : 'Disabled'}`);
    console.log(`   Interruption: ${stats.interruptionEnabled ? 'Enabled' : 'Disabled'}`);
    console.log(`   History Strategy: ${stats.memoryStats?.historyStrategy || 'N/A'}`);
    console.log('');
  });

  return app;
}

async function initializeApp() {
  const app = await createOrchestratorDemo();
  return app;
}

export default initializeApp;

// Backward compatibility - run if executed directly (ES module compatible)
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    // Check if we're in playground mode
    if (process.env.SMALLTALK_PLAYGROUND_MODE === 'true') {
      // Playground mode - set up web interface
      const app = await createOrchestratorDemo();
      
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
      console.log('🎯 SmallTalk Orchestrator Demo - Phase 1-3 Interactive Orchestration');
      console.log('======================================================================');
      console.log('✅ Interactive Orchestrator is ready! Phase 1-3 capabilities enabled.');
      console.log('🧠 Features: Real-time monitoring, adaptive planning, predictive routing & continuous learning');
      
      console.log('\n🤖 Available Agents:');
      app.listAgents().forEach(agentName => {
        const agent = app.getAgent(agentName);
        console.log(`   • ${agentName}: ${agent?.config.expertise?.join(', ')}`);
      });

      console.log('\n🎯 Interactive Orchestration Features:');
      console.log('   • Adaptive agent selection with continuous learning');
      console.log('   • Real-time user behavior monitoring and plan adjustment');
      console.log('   • Predictive routing based on historical patterns');
      console.log('   • Multi-step plan generation and execution');
      console.log('   • Real-time response streaming');
      console.log('   • User intervention during plan execution');

      console.log('\n📝 Try these example messages to see orchestration:');
      console.log('   • "I\'m a beginner, how do I start programming?"');
      console.log('   • "Explain the theory behind quick sort algorithm"');
      console.log('   • "I have a bug in my JavaScript code"');
      console.log('   • "What architecture should I use for a large-scale system?"');
      console.log('   • "Please introduce yourselves" (creates multi-step plan)');

      console.log('\n🎛️ Enhanced Commands:');
      console.log('   • /stats - Show orchestration statistics');
      console.log('   • /plans - List active execution plans');
      console.log('   • /pause <plan_id> - Pause plan execution');
      console.log('   • /resume <plan_id> - Resume paused plan');
      console.log('   • /status - Show system status');

      console.log('\n🚀 Start chatting to see intelligent agent routing in action!');
      console.log('Type your message and watch the orchestrator choose the best agent for you!\n');
      
      app.start().catch(console.error);
    }
  })();
}