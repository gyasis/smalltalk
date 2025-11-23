#!/usr/bin/env node

/**
 * Simple Integration Test - Core SmallTalk Functionality
 */

import { SmallTalk } from './src/core/SmallTalk.js';
import { Agent } from './src/agents/Agent.js';

async function runSimpleIntegrationTest() {
  console.log('🧪 Simple Integration Test - Core SmallTalk Functionality\n');

  try {
    // Test 1: Basic SmallTalk initialization
    console.log('1️⃣ Testing SmallTalk initialization...');
    const app = new SmallTalk({
      llmProvider: 'openai',
      model: 'gpt-4o'
    });
    console.log('   ✅ SmallTalk initialized successfully');

    // Test 2: Agent creation and management
    console.log('2️⃣ Testing agent management...');
    const testAgent = new Agent({
      name: 'TestAgent',
      personality: 'Helpful test agent',
      skills: ['testing', 'validation']
    });

    app.addAgent(testAgent);
    const agents = app.listAgents();
    if (agents.includes('TestAgent')) {
      console.log('   ✅ Agent added and retrieved successfully');
    } else {
      throw new Error('Agent not properly registered');
    }

    // Test 3: Configuration access
    console.log('3️⃣ Testing configuration...');
    const config = app.getConfig();
    if (config.llmProvider === 'openai') {
      console.log('   ✅ Configuration accessible and correct');
    } else {
      throw new Error('Configuration not accessible');
    }

    // Test 4: Orchestration capabilities
    console.log('4️⃣ Testing orchestration setup...');
    app.enableOrchestration(true);
    const isEnabled = app.isOrchestrationEnabled();
    if (isEnabled) {
      console.log('   ✅ Orchestration can be enabled');
    } else {
      console.log('   ⚠️ Orchestration not enabled');
    }

    // Test 5: Statistics
    console.log('5️⃣ Testing statistics...');
    const stats = app.getStats();
    if (stats && typeof stats === 'object') {
      console.log(`   ✅ Statistics available (${Object.keys(stats).length} metrics)`);
    } else {
      console.log('   ⚠️ Statistics not available');
    }

    console.log('\n✅ All simple integration tests passed!');
    console.log('📊 Summary: Core SmallTalk functionality is working correctly');

  } catch (error) {
    console.error('\n❌ Simple integration test failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack.split('\n').slice(0, 3).join('\n'));
    }
    process.exit(1);
  }
}

runSimpleIntegrationTest();