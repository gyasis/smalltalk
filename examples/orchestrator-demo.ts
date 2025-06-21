#!/usr/bin/env tsx

/**
 * 🎯 SmallTalk Orchestrator Demo
 * 
 * This example demonstrates the intelligent agent orchestration system that
 * automatically routes conversations to the most suitable agent based on
 * user intent, topic complexity, and agent capabilities.
 */

import { SmallTalk } from '../src/core/SmallTalk.js';
import { Agent } from '../src/agents/Agent.js';
import { CLIInterface } from '../src/interfaces/CLIInterface.js';
import { AgentCapabilities } from '../src/agents/OrchestratorAgent.js';

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

async function demonstrateOrchestration() {
  console.log('🎯 SmallTalk Orchestrator Demo');
  console.log('=====================================');
  console.log('');
  
  // Create SmallTalk instance with orchestration enabled
  const app = new SmallTalk({
    llmProvider: 'openai',
    model: 'gpt-4o',
    orchestration: true,
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

  // Start the application
  await app.start();

  console.log('🤖 Available Agents:');
  app.listAgents().forEach(agentName => {
    const agent = app.getAgent(agentName);
    console.log(`   • ${agentName}: ${agent?.config.expertise?.join(', ')}`);
  });

  console.log('\n🎯 Orchestration Features:');
  console.log('   • Automatic agent selection based on user intent');
  console.log('   • Smart handoffs when expertise changes');
  console.log('   • Custom handoff rules for specific patterns');
  console.log('   • Context-aware routing decisions');

  console.log('\n📝 Try these example messages to see orchestration:');
  console.log('   • "I\'m a beginner, how do I start programming?"');
  console.log('   • "Explain the theory behind quick sort algorithm"');
  console.log('   • "I have a bug in my JavaScript code"');
  console.log('   • "What architecture should I use for a large-scale system?"');
  console.log('   • "How do binary search trees work?"');

  console.log('\n🎛️ Commands:');
  console.log('   • /orchestration on|off - Enable/disable orchestration');
  console.log('   • /agent <name> - Manually switch to specific agent');
  console.log('   • /stats - Show orchestration statistics');
  console.log('   • /quit - Exit the demo');

  // Add CLI command handlers
  cli.addCommand('stats', () => {
    const stats = app.getOrchestrationStats();
    console.log('\n📊 Orchestration Stats:');
    console.log(`   Enabled: ${stats.enabled}`);
    console.log(`   Total Agents: ${stats.totalAgents}`);
    console.log(`   Current Assignments:`, stats.currentAgentAssignments);
    console.log('');
    return Promise.resolve('Stats displayed above.');
  });

  console.log('\n🚀 Orchestrator is ready! Start chatting to see intelligent agent routing in action.');
  console.log('Type your message and watch the orchestrator choose the best agent for you!\n');
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateOrchestration().catch(console.error);
}

export { demonstrateOrchestration };