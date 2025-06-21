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
  port: 4001,
  host: 'localhost',
  title: '🌍 Language Learning Tutor',
  description: 'Multi-agent language learning environment with Professor, ChatBuddy, GrammarGuru, and SpeechCoach',
  orchestrationMode: false,
  enableChatUI: true
};

async function createLanguageTutorApp() {
  const app = new SmallTalk({
    llmProvider: 'openai',
    model: 'gpt-4o',
    debugMode: true
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

  // Add agents to framework
  app.addAgent(mainTutor);
  app.addAgent(conversationPartner);
  app.addAgent(grammarExpert);
  app.addAgent(pronunciationCoach);

  return app;
}

// NEW: Create and export the configured app for `smalltalk` commands
const app = createLanguageTutorApp();
export default app;

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

// LEGACY: Backward compatibility for `npx tsx` execution
if (require.main === module) {
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