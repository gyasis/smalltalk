#!/usr/bin/env node

import {
  SmallTalk,
  CLIInterface,
  Agent,
  AgentFactory,
  PromptTemplate,
  PlaygroundConfig
} from '../src/index.js';

// NEW: Playground configuration for `smalltalk playground` command
export const playgroundConfig: PlaygroundConfig = {
  port: 3126,
  host: 'localhost',
  title: '🌍 Language Learning Tutor',
  description: 'Advanced multi-agent language learning with intelligent tutor orchestration',
  orchestrationMode: true,  // ⭐ ENABLED for intelligent routing
  enableChatUI: true
};

async function createLanguageTutorApp() {
  const app = new SmallTalk({
    llmProvider: 'openai',
    model: 'gpt-4o-mini',
    debugMode: true,
    orchestration: true,  // ⭐ ENABLE intelligent agent orchestration
    
    // Advanced orchestration configuration for language learning
    orchestrationConfig: {
      strategy: 'educational',
      contextSensitivity: 0.9,        // High context awareness for learning progression
      switchThreshold: 0.7,           // Moderate threshold for agent switching
      maxSwitchesPerConversation: 8,  // Allow more switches for educational flow
      learningEnabled: true,          // Learn from user interactions
      
      // Language learning specific weights
      scoringWeights: {
        expertiseMatch: 0.35,         // Strong emphasis on expertise
        complexityMatch: 0.25,        // Consider learning level
        conversationContext: 0.25,    // Track learning progression  
        userProgress: 0.15            // Factor in user's learning journey
      },

      // Custom rules for language learning scenarios
      customRules: [
        {
          name: 'beginner_guidance',
          condition: (context, message) => {
            const beginnerKeywords = ['new', 'beginner', 'start', 'basic', 'first time'];
            return beginnerKeywords.some(keyword => 
              message.toLowerCase().includes(keyword)
            );
          },
          targetAgent: 'Professor',
          priority: 18,
          reason: 'Beginner needs structured guidance'
        },
        {
          name: 'conversation_practice',
          condition: (context, message) => {
            const conversationKeywords = ['practice', 'talk', 'chat', 'conversation', 'speak'];
            return conversationKeywords.some(keyword => 
              message.toLowerCase().includes(keyword)
            ) && !message.toLowerCase().includes('grammar');
          },
          targetAgent: 'ChatBuddy',
          priority: 16,
          reason: 'User wants conversation practice'
        },
        {
          name: 'grammar_questions',
          condition: (context, message) => {
            const grammarKeywords = ['grammar', 'rule', 'tense', 'conjugate', 'syntax', 'why'];
            return grammarKeywords.some(keyword => 
              message.toLowerCase().includes(keyword)
            );
          },
          targetAgent: 'GrammarGuru',
          priority: 17,
          reason: 'Grammar-specific question detected'
        },
        {
          name: 'pronunciation_help',
          condition: (context, message) => {
            const pronunciationKeywords = ['pronounce', 'sound', 'accent', 'speak', 'pronunciation'];
            return pronunciationKeywords.some(keyword => 
              message.toLowerCase().includes(keyword)
            );
          },
          targetAgent: 'SpeechCoach',
          priority: 16,
          reason: 'Pronunciation assistance needed'
        }
      ],

      // Educational handoff triggers
      handoffTriggers: {
        learningProgression: {
          enabled: true,
          description: 'Switch when user progresses to different learning phase',
          condition: (context) => {
            // Detect when user moves from basic to advanced concepts
            const recentMessages = context.messages.slice(-3);
            return recentMessages.some(msg => 
              msg.content.includes('advanced') || msg.content.includes('complex')
            );
          },
          targetAgent: 'Professor'
        },
        practiceToTheory: {
          enabled: true,
          description: 'Switch from practice to theory when user asks why',
          condition: (context) => {
            return context.lastMessage.includes('why') || 
                   context.lastMessage.includes('explain');
          },
          targetAgent: 'GrammarGuru'
        },
        theoryToPractice: {
          enabled: true,
          description: 'Switch from theory to practice after explanation',
          condition: (context) => {
            const lastAgent = context.lastAgentName;
            const messageCount = context.messages.length;
            return lastAgent === 'GrammarGuru' && messageCount % 3 === 0;
          },
          targetAgent: 'ChatBuddy'
        }
      }
    }
  });

  // Create specialized language learning agents
  const mainTutor = new Agent({
    name: 'Professor',
    personality: 'A patient, encouraging language professor who adapts to student levels and provides structured lessons',
    temperature: 0.7,
    maxTokens: 3000
  });

  const conversationPartner = new Agent({
    name: 'ChatBuddy',
    personality: 'A friendly native speaker who engages in natural conversations and gently corrects mistakes',
    temperature: 0.8,
    maxTokens: 2000
  });

  const grammarExpert = new Agent({
    name: 'GrammarGuru',
    personality: 'A precise grammar expert who explains rules clearly with examples and provides targeted exercises',
    temperature: 0.4,
    maxTokens: 2500
  });

  const pronunciationCoach = new Agent({
    name: 'SpeechCoach',
    personality: 'An enthusiastic pronunciation coach who provides phonetic guidance and speaking tips',
    temperature: 0.6,
    maxTokens: 2000
  });

  // Add custom prompt templates for language learning
  const lessonTemplate: PromptTemplate = {
    name: 'lesson_plan',
    template: `Create a {{level}} level {{language}} lesson on {{topic}}.

Structure:
1. Learning objectives (3-5 points)
2. Key vocabulary (8-10 words with definitions)
3. Grammar focus (if applicable)
4. Practice exercises (3-5 exercises)
5. Cultural context or tips

{{#if previous_lessons}}Building on previous lessons: {{previous_lessons}}{{/if}}

Make it engaging and interactive!`,
    variables: ['level', 'language', 'topic', 'previous_lessons']
  };

  const correctionTemplate: PromptTemplate = {
    name: 'gentle_correction',
    template: `The student wrote: "{{student_text}}"

Please:
1. Acknowledge what they did well
2. Gently correct any mistakes
3. Explain why the correction is needed
4. Provide the corrected version
5. Give an encouraging comment

Language: {{language}}
Student level: {{level}}
Be supportive and encouraging!`,
    variables: ['student_text', 'language', 'level']
  };

  const grammarTemplate: PromptTemplate = {
    name: 'grammar_explanation',
    template: `Explain {{grammar_topic}} in {{language}} for a {{level}} student.

Include:
1. Clear rule explanation
2. 3-5 examples with translations
3. Common mistakes to avoid
4. 2-3 practice sentences for the student to complete
5. Memory tips or mnemonics

{{#if context}}Context: {{context}}{{/if}}

Keep it clear and digestible!`,
    variables: ['grammar_topic', 'language', 'level', 'context']
  };

  const conversationTemplate: PromptTemplate = {
    name: 'conversation_starter',
    template: `Start a natural conversation in {{language}} about {{topic}}.

Guidelines:
- Use {{level}} appropriate vocabulary
- Ask engaging questions
- Respond naturally to student answers
- Gently incorporate new vocabulary
- {{#if scenario}}Scenario: {{scenario}}{{/if}}

Keep it fun and authentic!`,
    variables: ['language', 'topic', 'level', 'scenario']
  };

  // Set templates for each agent
  mainTutor.setPromptTemplate('lesson_plan', lessonTemplate);
  conversationPartner.setPromptTemplate('conversation_starter', conversationTemplate);
  conversationPartner.setPromptTemplate('gentle_correction', correctionTemplate);
  grammarExpert.setPromptTemplate('grammar_explanation', grammarTemplate);

  // Add language-specific tools
  const vocabularyTool = {
    name: 'vocabulary_quiz',
    description: 'Generate a vocabulary quiz for practice',
    parameters: {
      type: 'object',
      properties: {
        words: { type: 'array', items: { type: 'string' } },
        quiz_type: { type: 'string', enum: ['multiple_choice', 'fill_blank', 'translation'] },
        difficulty: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] }
      }
    },
    handler: async (params: any) => {
      const { words, quiz_type, difficulty } = params;
      return `Generated ${quiz_type} quiz for ${words.length} words at ${difficulty} level: ${words.join(', ')}`;
    }
  };

  const pronunciationTool = {
    name: 'phonetic_guide',
    description: 'Provide phonetic pronunciation guide',
    parameters: {
      type: 'object',
      properties: {
        word: { type: 'string' },
        language: { type: 'string' },
        accent: { type: 'string', enum: ['american', 'british', 'neutral'] }
      }
    },
    handler: async (params: any) => {
      const { word, language, accent } = params;
      return `Phonetic guide for "${word}" in ${language} (${accent} accent): [Generated IPA notation and pronunciation tips]`;
    }
  };

  const progressTool = {
    name: 'track_progress',
    description: 'Track student learning progress',
    parameters: {
      type: 'object',
      properties: {
        skill: { type: 'string', enum: ['vocabulary', 'grammar', 'speaking', 'listening', 'reading', 'writing'] },
        score: { type: 'number', minimum: 0, maximum: 100 },
        notes: { type: 'string' }
      }
    },
    handler: async (params: any) => {
      const { skill, score, notes } = params;
      return `Progress tracked: ${skill} - ${score}% (${notes})`;
    }
  };

  // Add tools to appropriate agents
  mainTutor.addTool(vocabularyTool);
  mainTutor.addTool(progressTool);
  pronunciationCoach.addTool(pronunciationTool);
  grammarExpert.addTool(vocabularyTool);

  // Add agents to framework with capabilities for intelligent orchestration
  app.addAgent(mainTutor, {
    expertise: ['language teaching', 'lesson planning', 'structured learning', 'beginner guidance'],
    complexity: 'intermediate',
    taskTypes: ['teaching', 'lesson_planning', 'structured_learning'],
    contextAwareness: 0.9,
    collaborationStyle: 'leading',
    personalityTraits: ['patient', 'encouraging', 'structured', 'adaptive'],
    tools: ['lesson_plan', 'vocabulary_quiz', 'track_progress'],
    preferredScenarios: ['beginner_questions', 'lesson_structure', 'learning_objectives']
  });

  app.addAgent(conversationPartner, {
    expertise: ['conversation practice', 'natural dialogue', 'language immersion', 'speaking practice'],
    complexity: 'basic',
    taskTypes: ['conversation', 'practice', 'speaking'],
    contextAwareness: 0.8,
    collaborationStyle: 'collaborative',
    personalityTraits: ['friendly', 'encouraging', 'natural', 'patient'],
    tools: ['conversation_starter', 'gentle_correction'],
    preferredScenarios: ['conversation_practice', 'speaking_help', 'natural_dialogue']
  });

  app.addAgent(grammarExpert, {
    expertise: ['grammar rules', 'syntax explanation', 'language structure', 'detailed analysis'],
    complexity: 'advanced',
    taskTypes: ['grammar', 'explanation', 'analysis'],
    contextAwareness: 0.9,
    collaborationStyle: 'supportive',
    personalityTraits: ['precise', 'detailed', 'analytical', 'clear'],
    tools: ['grammar_explanation', 'vocabulary_quiz'],
    preferredScenarios: ['grammar_questions', 'rule_explanations', 'syntax_help']
  });

  app.addAgent(pronunciationCoach, {
    expertise: ['pronunciation', 'phonetics', 'accent training', 'speaking skills'],
    complexity: 'intermediate',
    taskTypes: ['pronunciation', 'speaking', 'accent_training'],
    contextAwareness: 0.7,
    collaborationStyle: 'supportive',
    personalityTraits: ['enthusiastic', 'encouraging', 'precise', 'motivational'],
    tools: ['phonetic_guide'],
    preferredScenarios: ['pronunciation_help', 'accent_training', 'speaking_practice']
  });

  return app;
}

// NEW: Async initialization function for CLI usage
async function initializeApp() {
  const app = await createLanguageTutorApp();
  
  // Create custom CLI interface for language learning
  const cli = new CLIInterface({
    type: 'cli',
    prompt: '🌍 ',
    colors: {
      user: '#3498db',
      assistant: '#2ecc71',
      system: '#f39c12',
      error: '#e74c3c'
    },
    showTimestamps: false,
    showAgentNames: true
  });

  app.addInterface(cli);
  return app;
}

// Export factory function for CLI usage  
export default initializeApp;

async function main(tutorApp: SmallTalk) {
  console.log('🌍 Language Tutor - SmallTalk Framework');
  console.log('=====================================');
  
  await tutorApp.start();

  console.log('\n✅ Language Learning Environment Ready!');
  console.log('\n🎓 Available Tutors:');
  console.log('• Professor - Main language tutor for structured lessons');
  console.log('• ChatBuddy - Conversation partner for practice');
  console.log('• GrammarGuru - Grammar expert for detailed explanations');
  console.log('• SpeechCoach - Pronunciation and speaking coach');
  
  console.log('\n📚 Commands:');
  console.log('• /agent Professor - Switch to main tutor');
  console.log('• /agent ChatBuddy - Practice conversations');
  console.log('• /agent GrammarGuru - Get grammar help');
  console.log('• /agent SpeechCoach - Work on pronunciation');
  console.log('• /help - Show all available commands');
  
  console.log('\n💡 Try saying:');
  console.log('• "I want to learn Spanish for beginners"');
  console.log('• "Explain the past tense in French"');
  console.log('• "Let\'s have a conversation about food in Italian"');
  console.log('• "How do I pronounce this German word: Schadenfreude"');
  console.log('\n');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Happy learning! Auf Wiedersehen! Au revoir! ¡Adiós!');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Language tutor error:', error);
  process.exit(1);
});

// Backward compatibility - run if executed directly (ES module compatible)
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    // Check if we're in playground mode
    if (process.env.SMALLTALK_PLAYGROUND_MODE === 'true') {
      // Playground mode - set up web interface
      const app = await createLanguageTutorApp();
      
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
      // CLI mode - run legacy mode
      async function runLegacyMode() {
        const tutorApp = await createLanguageTutorApp();
        
        // Create custom CLI interface for language learning
        const cli = new CLIInterface({
          type: 'cli',
          prompt: '🌍 ',
          colors: {
            user: '#3498db',
            assistant: '#2ecc71',
            system: '#f39c12',
            error: '#e74c3c'
          },
          showTimestamps: false,
          showAgentNames: true
        });

        tutorApp.addInterface(cli);
        await main(tutorApp);
      }

      // Run the language tutor
      runLegacyMode().catch((error) => {
        console.error('❌ Failed to start language tutor:', error);
        process.exit(1);
      });
    }
  })();
}