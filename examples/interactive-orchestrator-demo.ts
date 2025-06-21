#!/usr/bin/env node

/**
 * Interactive Orchestrator Demo
 * 
 * This example demonstrates the advanced orchestrator features from PRD v4.0:
 * - Dynamic plan generation and execution
 * - Real-time response streaming
 * - User intervention and dynamic re-planning
 * - Intelligent history management
 * - Configurable auto-response limits
 */

import { SmallTalk } from '../src/core/SmallTalk.js';
import { Agent } from '../src/agents/Agent.js';
import { CLIInterface } from '../src/interfaces/CLIInterface.js';
import { AgentCapabilities } from '../src/agents/OrchestratorAgent.js';

// Create specialized agents with different capabilities
const dataAnalystAgent = new Agent({
  name: 'DataAnalyst',
  personality: 'I am a data analysis expert. I excel at examining data patterns, creating insights, and providing statistical analysis. I approach problems methodically and provide evidence-based conclusions.',
  expertise: ['data analysis', 'statistics', 'visualization', 'research']
});

const creativeCopywriterAgent = new Agent({
  name: 'CreativeCopywriter', 
  personality: 'I am a creative copywriter and content strategist. I specialize in crafting compelling narratives, engaging marketing copy, and creative content that resonates with audiences.',
  expertise: ['writing', 'marketing', 'content creation', 'storytelling', 'branding']
});

const techConsultantAgent = new Agent({
  name: 'TechConsultant',
  personality: 'I am a technical consultant with expertise in software architecture, system design, and technology strategy. I help solve complex technical challenges and provide strategic technology guidance.',
  expertise: ['software architecture', 'system design', 'technology strategy', 'problem solving', 'consulting']
});

// Define agent capabilities for the orchestrator
const dataAnalystCapabilities: AgentCapabilities = {
  expertise: ['data analysis', 'statistics', 'research', 'visualization'],
  tools: ['data_analysis', 'charts', 'statistical_tests'],
  personalityTraits: ['analytical', 'methodical', 'evidence-based'],
  taskTypes: ['analysis', 'research', 'problem'],
  complexity: 'advanced',
  contextAwareness: 0.9,
  collaborationStyle: 'supportive'
};

const creativeCopywriterCapabilities: AgentCapabilities = {
  expertise: ['writing', 'content creation', 'marketing', 'storytelling'],
  tools: ['content_generation', 'style_guide', 'brand_voice'],
  personalityTraits: ['creative', 'engaging', 'audience-focused'],
  taskTypes: ['creative', 'communication', 'content'],
  complexity: 'intermediate',
  contextAwareness: 0.8,
  collaborationStyle: 'collaborative'
};

const techConsultantCapabilities: AgentCapabilities = {
  expertise: ['software architecture', 'system design', 'technology strategy'],
  tools: ['architecture_review', 'system_analysis', 'tech_recommendations'],
  personalityTraits: ['strategic', 'technical', 'solution-oriented'],
  taskTypes: ['problem', 'consultation', 'technical'],
  complexity: 'expert',
  contextAwareness: 0.95,
  collaborationStyle: 'leading'
};

async function runInteractiveOrchestratorDemo() {
  console.log('🚀 Starting Interactive Orchestrator Demo...');
  
  // Initialize SmallTalk with advanced configuration
  const smalltalk = new SmallTalk({
    llmProvider: 'openai',
    model: 'gpt-4o',
    temperature: 0.7,
    debugMode: true,
    orchestration: true,
    orchestrationConfig: {
      maxAutoResponses: 5,
      enableInterruption: true,
      streamResponses: true,
      contextSensitivity: 0.8,
      switchThreshold: 0.7
    },
    historyManagement: {
      strategy: 'hybrid',
      maxMessages: 30,
      slidingWindowSize: 15,
      summaryInterval: 8,
      contextSize: 4000
    }
  });

  // Add agents with their capabilities
  smalltalk.addAgent(dataAnalystAgent, dataAnalystCapabilities);
  smalltalk.addAgent(creativeCopywriterAgent, creativeCopywriterCapabilities);
  smalltalk.addAgent(techConsultantAgent, techConsultantCapabilities);

  // Create enhanced CLI interface
  const cli = new CLIInterface({
    type: 'cli',
    prompt: '🗣️  ',
    colors: {
      user: '#00BFFF',
      assistant: '#32CD32', 
      system: '#FFD700',
      error: '#FF6347'
    },
    showTimestamps: true,
    showAgentNames: true
  });

  // Add custom commands for plan management
  cli.registerCommand('pause_plan', async (args) => {
    if (args.length > 0) {
      const planId = args[0];
      const success = smalltalk.pausePlan(planId);
      console.log(success ? `Plan ${planId} paused` : `Plan ${planId} not found`);
    }
  });

  cli.registerCommand('resume_plan', async (args) => {
    if (args.length > 0) {
      const planId = args[0];
      const success = await smalltalk.resumePlan(planId, 'cli-session', 'demo-user');
      console.log(success ? `Plan ${planId} resumed` : `Plan ${planId} could not be resumed`);
    }
  });

  cli.registerCommand('list_plans', async () => {
    const plans = smalltalk.getActivePlans();
    if (plans.length === 0) {
      console.log('No active plans');
    } else {
      console.log('Active Plans:');
      plans.forEach(plan => {
        console.log(`- ${plan.id.slice(0, 8)}: ${plan.userIntent} (${plan.status})`);
      });
    }
  });

  cli.registerCommand('status', async () => {
    const stats = smalltalk.getStats();
    console.log('🔍 System Status:');
    console.log(`Agents: ${stats.agentCount}`);
    console.log(`Active Sessions: ${stats.activeSessionCount}`);
    console.log(`Orchestration: ${stats.orchestrationStats.enabled ? 'Enabled' : 'Disabled'}`);
    console.log(`Active Plans: ${stats.orchestrationStats.activePlans}`);
    console.log(`History Strategy: ${stats.memoryStats.historyStrategy}`);
    console.log(`Streaming: ${stats.streamingEnabled ? 'Enabled' : 'Disabled'}`);
    console.log(`Interruption: ${stats.interruptionEnabled ? 'Enabled' : 'Disabled'}`);
  });

  // Set up event listeners for plan execution events
  smalltalk.on('plan_created', (event) => {
    cli.displayPlanEvent(event);
  });

  smalltalk.on('step_started', (event) => {
    cli.displayPlanEvent(event);
  });

  smalltalk.on('step_completed', (event) => {
    cli.displayPlanEvent(event);
  });

  smalltalk.on('plan_completed', (event) => {
    cli.displayPlanEvent(event);
  });

  smalltalk.on('user_interrupted', (event) => {
    cli.displayPlanEvent(event);
  });

  smalltalk.on('auto_response_limit_reached', (data) => {
    console.log(`⚠️  Auto-response limit reached for user ${data.userId}. Please provide input to continue.`);
  });

  // Add interface and start
  smalltalk.addInterface(cli);
  
  try {
    await smalltalk.start();
    
    console.log('\n🎉 Interactive Orchestrator Demo is running!');
    console.log('\n💡 Try these scenarios to see advanced features:');
    console.log('   1. "Please introduce yourselves" - Creates a multi-step plan');
    console.log('   2. During execution, type a message to interrupt and redirect');
    console.log('   3. Use /pause <plan_id> and /resume <plan_id> to control execution');
    console.log('   4. Watch real-time streaming of agent responses');
    console.log('   5. Long conversations will trigger intelligent history management');
    console.log('   6. After 5 automatic responses, manual input will be required');
    console.log('\n🗣️  Start chatting below...\n');
    
  } catch (error) {
    console.error('Failed to start SmallTalk:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down Interactive Orchestrator Demo...');
  process.exit(0);
});

// Run the demo
runInteractiveOrchestratorDemo().catch(error => {
  console.error('Demo failed to start:', error);
  process.exit(1);
});