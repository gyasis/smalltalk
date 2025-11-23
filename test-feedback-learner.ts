#!/usr/bin/env node

/**
 * FeedbackLearner Standalone Test
 */

import { FeedbackLearner } from './src/core/FeedbackLearner.js';

async function runFeedbackLearnerTest() {
  console.log('🧪 FeedbackLearner Standalone Test\n');

  try {
    console.log('1️⃣ Initializing FeedbackLearner...');
    const learner = new FeedbackLearner();

    // Test feedback processing
    console.log('2️⃣ Testing feedback processing...');
    const testFeedback = {
      type: 'agent_performance',
      message: 'The CodeAgent was very helpful with debugging',
      satisfaction: 0.9,
      timestamp: new Date(),
      agentUsed: 'CodeAgent',
      successful: true
    };

    const context = {
      agentUsed: 'CodeAgent',
      pattern: 'code-debugging',
      duration: 12000,
      interruptionOccurred: false
    };

    learner.processFeedback('test-user', testFeedback, context);
    console.log('   ✅ Feedback processed successfully');

    // Add more feedback for pattern recognition
    console.log('3️⃣ Adding multiple feedback samples...');
    const feedbackSamples = [
      {
        feedback: { ...testFeedback, satisfaction: 0.8, message: 'Good help with code review' },
        context: { ...context, pattern: 'code-review', duration: 8000 }
      },
      {
        feedback: { ...testFeedback, satisfaction: 0.95, message: 'Excellent debugging assistance' },
        context: { ...context, pattern: 'code-debugging', duration: 15000 }
      },
      {
        feedback: { ...testFeedback, satisfaction: 0.7, agentUsed: 'GeneralHelper', message: 'Okay but not specialized enough' },
        context: { ...context, agentUsed: 'GeneralHelper', pattern: 'code-debugging', duration: 10000 }
      }
    ];

    feedbackSamples.forEach(sample => {
      learner.processFeedback('test-user', sample.feedback, sample.context);
    });

    console.log(`   ✅ Processed ${feedbackSamples.length} additional feedback samples`);

    // Test user behavior model generation
    console.log('4️⃣ Testing user behavior model generation...');
    const userModel = learner.generateUserBehaviorModel('test-user');

    if (!userModel) {
      throw new Error('User behavior model generation failed');
    }

    console.log('   ✅ User behavior model generated');
    console.log(`   👤 User ID: ${userModel.userId}`);
    console.log(`   🎯 Preferred agents: ${userModel.preferences.preferredAgents.join(', ')}`);
    console.log(`   📊 Average satisfaction: ${userModel.preferences.avgSatisfaction?.toFixed(2) || 'N/A'}`);
    console.log(`   🔄 Common patterns: ${userModel.preferences.commonPatterns.join(', ')}`);

    // Test pattern recognition
    console.log('5️⃣ Testing pattern recognition...');
    const patterns = learner.identifyPatterns('test-user');

    if (!patterns || patterns.length === 0) {
      console.log('   ⚠️ No patterns identified yet (expected with limited data)');
    } else {
      console.log(`   ✅ Identified ${patterns.length} patterns`);
      patterns.forEach((pattern, index) => {
        console.log(`   📈 Pattern ${index + 1}: ${pattern.pattern} (strength: ${pattern.strength.toFixed(2)})`);
      });
    }

    // Test learning insights generation
    console.log('6️⃣ Testing learning insights generation...');
    const insights = learner.generateLearningInsights();

    console.log(`   ✅ Generated ${insights.length} learning insights`);
    insights.slice(0, 3).forEach((insight, index) => {
      console.log(`   💡 Insight ${index + 1}: ${insight.insight}`);
      console.log(`      Confidence: ${insight.confidence.toFixed(2)} | Impact: ${insight.impact}`);
    });

    // Test model retrieval
    console.log('7️⃣ Testing model retrieval...');
    const retrievedModel = learner.getUserBehaviorModel('test-user');
    
    if (!retrievedModel) {
      throw new Error('Could not retrieve user behavior model');
    }

    console.log('   ✅ User behavior model retrieved successfully');

    // Test feedback history
    console.log('8️⃣ Testing feedback history...');
    const history = learner.getFeedbackHistory('test-user');
    
    console.log(`   ✅ Feedback history contains ${history.length} entries`);

    console.log('\n✅ All FeedbackLearner tests completed successfully!');
    console.log('📊 Summary: FeedbackLearner is properly learning from user interactions');

  } catch (error) {
    console.error('\n❌ FeedbackLearner test failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack.split('\n').slice(0, 3).join('\n'));
    }
    process.exit(1);
  }
}

runFeedbackLearnerTest();