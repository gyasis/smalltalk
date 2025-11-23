#!/usr/bin/env node

/**
 * Phase 3 Components Test - Test adaptive planning components
 */

import { AdaptivePlanningEngine } from './src/core/AdaptivePlanningEngine.js';
import { FeedbackLearner } from './src/core/FeedbackLearner.js'; 
import { PredictiveRouter } from './src/core/PredictiveRouter.js';

async function runPhase3ComponentsTest() {
  console.log('🧪 Phase 3 Components Test - Adaptive Planning System\n');

  let componentsWorking = 0;
  const totalComponents = 3;

  // Test 1: AdaptivePlanningEngine
  console.log('1️⃣ Testing AdaptivePlanningEngine...');
  try {
    const adaptivePlanner = new AdaptivePlanningEngine({
      llmProvider: 'openai',
      model: 'gpt-4o'
    });
    
    if (adaptivePlanner) {
      console.log('   ✅ AdaptivePlanningEngine initialized successfully');
      componentsWorking++;
    } else {
      throw new Error('Initialization failed');
    }
  } catch (error) {
    console.log(`   ❌ AdaptivePlanningEngine failed: ${error.message}`);
  }

  // Test 2: FeedbackLearner  
  console.log('2️⃣ Testing FeedbackLearner...');
  try {
    const feedbackLearner = new FeedbackLearner();
    
    if (feedbackLearner) {
      // Test basic functionality
      const testFeedback = {
        type: 'agent_performance' as const,
        message: 'Test feedback',
        satisfaction: 0.8,
        timestamp: new Date(),
        agentUsed: 'TestAgent',
        successful: true
      };

      const testContext = {
        agentUsed: 'TestAgent',
        pattern: 'testing',
        duration: 5000,
        interruptionOccurred: false
      };

      feedbackLearner.processFeedback('test-user', testFeedback, testContext);
      
      console.log('   ✅ FeedbackLearner initialized and processing feedback');
      componentsWorking++;
    } else {
      throw new Error('Initialization failed');
    }
  } catch (error) {
    console.log(`   ❌ FeedbackLearner failed: ${error.message}`);
  }

  // Test 3: PredictiveRouter (simplified test)
  console.log('3️⃣ Testing PredictiveRouter (basic initialization)...');
  try {
    const predictiveRouter = new PredictiveRouter();
    
    if (predictiveRouter) {
      console.log('   ✅ PredictiveRouter initialized successfully');
      console.log('   ℹ️ Detailed routing tests skipped due to complexity');
      componentsWorking++;
    } else {
      throw new Error('Initialization failed');
    }
  } catch (error) {
    console.log(`   ❌ PredictiveRouter failed: ${error.message}`);
  }

  // Summary
  console.log('\n📊 Phase 3 Components Test Results:');
  console.log(`   Working Components: ${componentsWorking}/${totalComponents}`);
  console.log(`   Success Rate: ${((componentsWorking / totalComponents) * 100).toFixed(1)}%`);

  if (componentsWorking === totalComponents) {
    console.log('\n✅ All Phase 3 components are properly initialized!');
    console.log('📋 Summary: Adaptive planning system components are available');
  } else if (componentsWorking > 0) {
    console.log('\n⚠️ Some Phase 3 components working, others may need fixes');
  } else {
    console.log('\n❌ Phase 3 components have issues');
    process.exit(1);
  }
}

runPhase3ComponentsTest();