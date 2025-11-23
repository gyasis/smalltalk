#!/usr/bin/env node

/**
 * PredictiveRouter Standalone Test
 */

import { PredictiveRouter } from './src/core/PredictiveRouter.js';
import { Agent } from './src/agents/Agent.js';

async function runPredictiveRouterTest() {
  console.log('🧪 PredictiveRouter Standalone Test\n');

  try {
    console.log('1️⃣ Initializing PredictiveRouter...');
    const router = new PredictiveRouter();

    // Create test agents
    console.log('2️⃣ Creating test agents...');
    const agents = [
      new Agent({
        name: 'CodeExpert',
        skills: ['coding', 'debugging', 'architecture'],
        personality: 'Technical specialist'
      }),
      new Agent({
        name: 'DataAnalyst', 
        skills: ['data', 'analysis', 'visualization'],
        personality: 'Data-focused expert'
      }),
      new Agent({
        name: 'GeneralHelper',
        skills: ['general', 'assistance', 'explanation'],
        personality: 'Helpful assistant'
      })
    ];

    // Mock skills analyses
    const skillsAnalyses = [
      { agentName: 'CodeExpert', matchScore: 0.9, reasoning: 'Perfect match for coding tasks' },
      { agentName: 'DataAnalyst', matchScore: 0.3, reasoning: 'Limited relevance to coding' },
      { agentName: 'GeneralHelper', matchScore: 0.6, reasoning: 'Can provide general help' }
    ];

    // Mock user behavior model
    const userModel = {
      userId: 'test-user',
      preferences: {
        preferredAgents: ['CodeExpert'],
        avgSessionLength: 15,
        commonPatterns: ['code-review', 'debugging']
      },
      satisfactionHistory: [0.9, 0.8, 0.95],
      interruptionPatterns: []
    };

    console.log('3️⃣ Testing predictive routing...');
    const prediction = router.predictOptimalRoute(
      "Help me debug this TypeScript function",
      'test-user',
      agents,
      skillsAnalyses,
      userModel,
      []
    );

    if (!prediction) {
      throw new Error('Prediction failed to generate');
    }

    console.log(`   ✅ Prediction generated`);
    console.log(`   🎯 Recommended agent: ${prediction.recommendedAgent}`);
    console.log(`   📊 Confidence: ${prediction.confidence}`);
    console.log(`   🤔 Reasoning: ${prediction.reasoning}`);

    // Test feature extraction
    console.log('4️⃣ Testing feature extraction...');
    const features = router.extractFeatures(
      "Complex data processing task with visualization needs",
      'test-user',
      userModel,
      []
    );

    if (!features) {
      throw new Error('Feature extraction failed');
    }

    console.log(`   ✅ Features extracted successfully`);
    console.log(`   📏 Feature count: ${Object.keys(features).length}`);

    // Test model prediction
    console.log('5️⃣ Testing ML model prediction...');
    const modelPrediction = router.predictWithModel(features, agents);
    
    if (!modelPrediction) {
      throw new Error('Model prediction failed');
    }

    console.log(`   ✅ Model prediction completed`);
    console.log(`   🎯 Predicted agent: ${modelPrediction.predictedAgent}`);
    console.log(`   📊 Confidence: ${modelPrediction.confidence.toFixed(3)}`);

    // Test optimization scoring
    console.log('6️⃣ Testing optimization scoring...');
    const optimizationScore = router.calculateOptimizationScore(
      agents[0],
      'test-user',
      skillsAnalyses[0],
      userModel
    );

    console.log(`   ✅ Optimization score calculated: ${optimizationScore.toFixed(3)}`);

    console.log('\n✅ All PredictiveRouter tests completed successfully!');
    console.log('📊 Summary: PredictiveRouter is functioning correctly with ML-inspired predictions');

  } catch (error) {
    console.error('\n❌ PredictiveRouter test failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack.split('\n').slice(0, 3).join('\n'));
    }
    process.exit(1);
  }
}

runPredictiveRouterTest();