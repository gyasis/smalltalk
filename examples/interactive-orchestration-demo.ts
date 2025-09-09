import {
  InteractiveOrchestrator,
  Agent,
  AgentFactory
} from '../src/index.js';

/**
 * Interactive Orchestration Demo - Phase 1
 * 
 * Demonstrates:
 * - Real-time user monitoring with interruption detection
 * - Streaming agent execution with pause capabilities  
 * - Basic interruption handling (stop, redirect, agent switch)
 * - Heavy agent skills analysis and routing
 */
async function createInteractiveOrchestrationDemo() {
  console.log('🎭 Interactive Orchestration Demo - Phase 1');
  console.log('=' .repeat(60));

  // Initialize interactive orchestrator
  const orchestrator = new InteractiveOrchestrator({
    llmProvider: 'openai',
    model: 'gpt-4o-mini',
    debugMode: true,
    interruptionSensitivity: 'medium',
    allowAgentSwitching: true,
    enablePlanRedirection: true
  });

  // Create business agents with capabilities
  const ceo = AgentFactory.createSimple('CEO', 
    'Strategic business leader focused on high-level decisions, market opportunities, and company vision. Expert in ROI, scalability, and competitive advantage.',
    {
      temperature: 0.8,
      maxTokens: 3000
    }
  );

  const techLead = AgentFactory.createSimple('TechLead',
    'Technical expert who evaluates feasibility, architecture, and implementation details. Specialist in scalability, security, and development timelines.',
    {
      temperature: 0.6,
      maxTokens: 3500
    }
  );

  const marketingLead = AgentFactory.createSimple('MarketingLead',
    'Creative marketing expert who understands customer behavior, brand positioning, and digital marketing strategies. Data-driven but creative.',
    {
      temperature: 0.9,
      maxTokens: 3500  
    }
  );

  const salesChief = AgentFactory.createSimple('SalesChief',
    'Results-oriented sales professional who understands customer needs, market demands, and revenue generation. Focuses on practical implementation.',
    {
      temperature: 0.7,
      maxTokens: 3000
    }
  );

  // Register agents for orchestration
  orchestrator.registerAgent(ceo);
  orchestrator.registerAgent(techLead);
  orchestrator.registerAgent(marketingLead);
  orchestrator.registerAgent(salesChief);

  // Setup event listeners
  orchestrator.on('response-chunk', (chunk) => {
    // Real-time streaming output
    // process.stdout.write(`[${chunk.agentName}] ${chunk.chunk}`);
  });

  orchestrator.on('execution-paused', (data) => {
    console.log(`\n⏸️ EXECUTION PAUSED at step ${data.currentStep + 1}`);
    console.log(`💡 You can resume, redirect, or switch agents`);
  });

  orchestrator.on('plan-updated', (data) => {
    console.log(`\n🔄 PLAN UPDATED: ${data.reason}`);
    console.log(`📝 New direction: ${data.newDirection}`);
  });

  orchestrator.on('agent-switched', (data) => {
    console.log(`\n🔄 AGENT SWITCHED: ${data.fromAgent} → ${data.toAgent}`);
  });

  return orchestrator;
}

async function runDemo() {
  try {
    const orchestrator = await createInteractiveOrchestrationDemo();

    console.log('\n🚀 Starting Interactive Orchestration Demo');
    console.log('\n💡 INTERRUPTION COMMANDS:');
    console.log('   • "stop" or "pause" - Pause execution');
    console.log('   • "redirect" or "change" - Change direction');
    console.log('   • "@AgentName" - Switch to specific agent');
    console.log('   • "new direction" - Start fresh plan');
    console.log('   • Any question starting with "why/what/how" for clarification');
    console.log('\n📋 Demo Scenarios:');
    console.log('   1. Complex business analysis (triggers collaboration)');
    console.log('   2. Technical architecture review (single agent)');
    console.log('   3. Marketing strategy development (multiple perspectives)');

    console.log('\n' + '='.repeat(60));
    console.log('🎯 DEMO SCENARIO: Complex Business Analysis');
    console.log('='.repeat(60));

    // Demo 1: Complex business request that should trigger collaboration
    console.log('\n📝 User Request: "We want to launch a new SaaS product for small businesses. I need a comprehensive analysis covering technical feasibility, market opportunities, sales strategy, and go-to-market approach."');
    
    const result1 = await orchestrator.orchestrate(
      'We want to launch a new SaaS product for small businesses. I need a comprehensive analysis covering technical feasibility, market opportunities, sales strategy, and go-to-market approach.',
      'demo-session-1',
      'demo-user',
      []
    );

    console.log(`\n✅ Demo 1 completed with status: ${result1.status}`);
    console.log(`📊 Agents involved: ${result1.plan.selectedAgents.map(a => a.name).join(', ')}`);
    console.log(`🕒 Duration: ${result1.startTime ? Date.now() - result1.startTime.getTime() : 0}ms`);
    console.log(`🚨 Interruptions: ${result1.interruptionHistory.length}`);

    console.log('\n' + '='.repeat(60));
    console.log('🎯 DEMO SCENARIO: Technical Architecture Review');
    console.log('='.repeat(60));

    // Demo 2: Technical request that should route to TechLead
    console.log('\n📝 User Request: "Review the technical architecture for our microservices backend and recommend improvements for scalability."');
    
    const result2 = await orchestrator.orchestrate(
      'Review the technical architecture for our microservices backend and recommend improvements for scalability.',
      'demo-session-2', 
      'demo-user',
      []
    );

    console.log(`\n✅ Demo 2 completed with status: ${result2.status}`);
    console.log(`📊 Agents involved: ${result2.plan.selectedAgents.map(a => a.name).join(', ')}`);

    console.log('\n' + '='.repeat(60));
    console.log('📈 ORCHESTRATOR STATISTICS');
    console.log('='.repeat(60));
    
    const stats = orchestrator.getStatistics();
    console.log(`🤖 Registered Agents: ${stats.registeredAgents}`);
    console.log(`📋 Active Plans: ${stats.activePlans}`);
    console.log(`👂 Monitoring Active: ${stats.isMonitoring}`);
    console.log(`📊 Current Execution: ${stats.currentExecution ? 'Running' : 'None'}`);

    // Cleanup
    await orchestrator.shutdown();
    
    console.log('\n🎉 Interactive Orchestration Demo completed successfully!');
    console.log('✨ Phase 1 capabilities demonstrated:');
    console.log('   ✅ Real-time user monitoring with interruption detection');
    console.log('   ✅ Streaming agent execution with pause capabilities');
    console.log('   ✅ Basic interruption handling (stop, redirect, agent switch)');
    console.log('   ✅ Heavy agent skills analysis and optimal routing');
    console.log('   ✅ Always-aware orchestrator with continuous monitoring');

  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo().catch((error) => {
    console.error('💥 Unhandled error in demo:', error);
    process.exit(1);
  });
}

export default runDemo;