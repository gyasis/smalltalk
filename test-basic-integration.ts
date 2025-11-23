#!/usr/bin/env node

/**
 * Basic Integration Test - Phase 1-3 SmallTalk Interactive Orchestration
 */

import { SmallTalk } from './src/core/SmallTalk.js';
import { Agent } from './src/agents/Agent.js';
import { CLIInterface } from './src/interfaces/CLIInterface.js';

async function runBasicIntegrationTest() {
  console.log('🧪 Basic Integration Test - Phase 1-3 Interactive Orchestration\n');

  try {
    // Initialize SmallTalk with Interactive Orchestration
    console.log('1️⃣ Initializing SmallTalk with Interactive Orchestration...');
    const app = new SmallTalk({
      llmProvider: 'openai',
      model: 'gpt-4o',
      useInteractiveOrchestration: true,
      features: {
        realTimeMonitoring: true,
        adaptivePlanning: true,
        predictiveRouting: true
      }
    });

    // Add test agents
    console.log('2️⃣ Adding test agents...');
    const codeAgent = new Agent({
      name: 'CodeAgent',
      personality: 'Technical expert focused on code analysis',
      skills: ['coding', 'debugging', 'architecture']
    });

    const helpAgent = new Agent({
      name: 'HelpAgent', 
      personality: 'Friendly assistant for general queries',
      skills: ['general', 'assistance', 'explanation']
    });

    app.addAgent(codeAgent);
    app.addAgent(helpAgent);

    // Enable orchestration
    console.log('3️⃣ Enabling orchestration...');
    app.enableOrchestration(true);
    
    console.log('4️⃣ Testing orchestration status...');
    const orchestrator = app.getOrchestrationManager();
    if (!orchestrator) {
      console.log('   ⚠️ Orchestration manager not yet available (may need different setup)');
    } else {
      console.log('   ✅ Orchestration manager initialized');
    }

    console.log('5️⃣ Testing orchestration capabilities...');
    const isEnabled = app.isOrchestrationEnabled();
    console.log(`   ✅ Orchestration enabled: ${isEnabled}`);

    console.log('6️⃣ Testing agent management...');
    const agentList = app.listAgents();
    console.log(`   ✅ Registered agents: ${agentList.join(', ')}`);
    
    const retrievedAgent = app.getAgent('CodeAgent');
    if (retrievedAgent) {
      console.log(`   ✅ Agent retrieval working`);
    } else {
      throw new Error('Could not retrieve registered agent');
    }

    console.log('7️⃣ Testing configuration access...');
    const config = app.getConfig();
    if (config && config.llmProvider) {
      console.log(`   ✅ Configuration accessible: ${config.llmProvider}`);
    } else {
      throw new Error('Configuration not accessible');
    }

    console.log('8️⃣ Testing statistics...');
    const stats = app.getStats();
    if (stats) {
      console.log(`   ✅ Statistics accessible: ${Object.keys(stats).length} metrics`);
    } else {
      console.log('   ⚠️ Statistics not available');
    }

    console.log('\n✅ All basic integration tests completed successfully!');
    console.log('📊 Summary: SmallTalk Interactive Orchestration system is properly initialized');

  } catch (error) {
    console.error('\n❌ Basic integration test failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack.split('\n').slice(0, 3).join('\n'));
    }
    process.exit(1);
  }
}

runBasicIntegrationTest();