import {
  SmallTalk,
  CLIInterface,
  Agent,
  PromptTemplate,
  PlaygroundConfig
} from '../src/index.js';

// Playground configuration for web mode
export const playgroundConfig: PlaygroundConfig = {
  port: 3126,
  host: 'localhost',
  title: '🏥 Medical Education Tutor',
  description: 'Comprehensive medical education environment with specialized medical experts',
  orchestrationMode: true,
  enableChatUI: true
};

async function createMedicalTutorApp() {
  const app = new SmallTalk({
    llmProvider: 'openai',
    model: 'gpt-4o',
    debugMode: true,
    orchestration: true
  });

  // Create specialized medical education agents
  const clinicalInstructor = new Agent({
    name: 'DrMedTeach',
    personality: 'An experienced clinical instructor who provides evidence-based medical education with case-based learning. Always emphasizes patient safety and clinical reasoning.',
    temperature: 0.3, // Lower temperature for medical accuracy
    maxTokens: 4000
  });

  const anatomyExpert = new Agent({
    name: 'AnatomyPro',
    personality: 'A detailed anatomy expert who explains structures, functions, and relationships with clear descriptions and mnemonics. Makes complex anatomy memorable.',
    temperature: 0.4,
    maxTokens: 3500
  });

  const pharmacologyGuide = new Agent({
    name: 'PharmGuide',
    personality: 'A pharmacology specialist who explains drug mechanisms, interactions, and clinical applications. Always includes safety considerations and monitoring.',
    temperature: 0.2, // Very precise for drug information
    maxTokens: 3500
  });

  const diagnosticsExpert = new Agent({
    name: 'DiagnosticDoc',
    personality: 'A diagnostic reasoning expert who teaches systematic approaches to diagnosis, differential diagnosis, and clinical decision-making.',
    temperature: 0.3,
    maxTokens: 4000
  });

  const examPrep = new Agent({
    name: 'ExamMentor',
    personality: 'A supportive exam preparation mentor who creates practice questions, explains answers, and provides study strategies for medical exams.',
    temperature: 0.5,
    maxTokens: 3000
  });

  // Medical education prompt templates
  const caseStudyTemplate: PromptTemplate = {
    name: 'case_study',
    template: `Create a clinical case study for {{specialty}} at {{level}} level.

Case Scenario:
- Patient demographics and chief complaint
- History of present illness
- Past medical history, medications, allergies
- Physical examination findings
- Initial vital signs

Educational Focus: {{focus_topic}}
{{#if learning_objectives}}Learning Objectives: {{learning_objectives}}{{/if}}

Include:
1. Differential diagnosis considerations
2. Recommended diagnostic workup
3. Treatment approach
4. Patient education points
5. Follow-up considerations

⚠️ Include disclaimer: "This is for educational purposes only and not actual medical advice."`,
    variables: ['specialty', 'level', 'focus_topic', 'learning_objectives']
  };

  const anatomyTemplate: PromptTemplate = {
    name: 'anatomy_lesson',
    template: `Explain the anatomy of {{structure}} for {{level}} medical students.

Cover:
1. Anatomical location and boundaries
2. Gross anatomy and structure
3. Histology (if relevant)
4. Physiological function
5. Clinical correlations
6. Common pathology affecting this structure
7. Memory aids or mnemonics

{{#if related_structures}}Related structures: {{related_structures}}{{/if}}
{{#if clinical_context}}Clinical context: {{clinical_context}}{{/if}}

Use clear medical terminology with explanations.`,
    variables: ['structure', 'level', 'related_structures', 'clinical_context']
  };

  const pharmacologyTemplate: PromptTemplate = {
    name: 'drug_profile',
    template: `Provide a comprehensive drug profile for {{drug_name}} ({{drug_class}}).

Include:
1. Mechanism of action
2. Pharmacokinetics (ADME)
3. Clinical indications
4. Dosing and administration
5. Contraindications and precautions
6. Adverse effects and monitoring
7. Drug interactions
8. Patient counseling points

{{#if clinical_scenario}}Clinical scenario: {{clinical_scenario}}{{/if}}

⚠️ Always verify current prescribing information and guidelines.`,
    variables: ['drug_name', 'drug_class', 'clinical_scenario']
  };

  const diagnosticTemplate: PromptTemplate = {
    name: 'diagnostic_approach',
    template: `Teach the diagnostic approach for {{chief_complaint}} or {{condition}}.

Structure:
1. Key history questions to ask
2. Essential physical examination components
3. Red flags to watch for
4. Initial diagnostic workup
5. Differential diagnosis framework
6. Clinical decision-making process
7. When to refer or escalate

{{#if patient_population}}Patient population: {{patient_population}}{{/if}}
{{#if setting}}Clinical setting: {{setting}}{{/if}}

Emphasize systematic thinking and patient safety.`,
    variables: ['chief_complaint', 'condition', 'patient_population', 'setting']
  };

  const examQuestionTemplate: PromptTemplate = {
    name: 'exam_question',
    template: `Create a {{question_type}} question for {{exam_type}} about {{topic}}.

Question format:
- Clear, concise stem
- {{#if multiple_choice}}Four plausible options (A-D){{/if}}
- {{#if case_based}}Brief clinical vignette{{/if}}

Educational level: {{level}}
Difficulty: {{difficulty}}

Include:
1. The question
2. Correct answer with explanation
3. Why other options are incorrect
4. Key learning points
5. Related concepts to review

Focus on clinical reasoning rather than memorization.`,
    variables: ['question_type', 'exam_type', 'topic', 'level', 'difficulty', 'multiple_choice', 'case_based']
  };

  // Set templates for each agent
  clinicalInstructor.setPromptTemplate('case_study', caseStudyTemplate);
  clinicalInstructor.setPromptTemplate('diagnostic_approach', diagnosticTemplate);
  anatomyExpert.setPromptTemplate('anatomy_lesson', anatomyTemplate);
  pharmacologyGuide.setPromptTemplate('drug_profile', pharmacologyTemplate);
  diagnosticsExpert.setPromptTemplate('diagnostic_approach', diagnosticTemplate);
  examPrep.setPromptTemplate('exam_question', examQuestionTemplate);

  // Medical education tools
  const diagnosisChecker = {
    name: 'differential_diagnosis',
    description: 'Generate differential diagnosis for symptoms',
    parameters: {
      type: 'object',
      properties: {
        chief_complaint: { type: 'string' },
        age: { type: 'number' },
        gender: { type: 'string', enum: ['male', 'female', 'other'] },
        key_symptoms: { type: 'array', items: { type: 'string' } },
        duration: { type: 'string' }
      }
    },
    handler: async (params: any) => {
      const { chief_complaint, age, gender, key_symptoms, duration } = params;
      return `Differential diagnosis for ${age}yo ${gender} with ${chief_complaint}: 
Key symptoms: ${key_symptoms.join(', ')}
Duration: ${duration}
[Generated educational differential diagnosis list with likelihood and reasoning]
⚠️ For educational purposes only`;
    }
  };

  const drugInteractionChecker = {
    name: 'drug_interactions',
    description: 'Check for drug interactions and contraindications',
    parameters: {
      type: 'object',
      properties: {
        medications: { type: 'array', items: { type: 'string' } },
        patient_conditions: { type: 'array', items: { type: 'string' } },
        allergies: { type: 'array', items: { type: 'string' } }
      }
    },
    handler: async (params: any) => {
      const { medications, patient_conditions, allergies } = params;
      return `Drug interaction analysis:
Medications: ${medications.join(', ')}
Conditions: ${patient_conditions.join(', ')}
Allergies: ${allergies.join(', ')}
[Educational analysis of potential interactions and considerations]
⚠️ Always verify with current clinical resources`;
    }
  };

  const labInterpretation = {
    name: 'lab_interpretation',
    description: 'Interpret laboratory values in clinical context',
    parameters: {
      type: 'object',
      properties: {
        lab_values: { type: 'object' },
        clinical_context: { type: 'string' },
        patient_age: { type: 'number' },
        patient_gender: { type: 'string' }
      }
    },
    handler: async (params: any) => {
      const { lab_values, clinical_context, patient_age, patient_gender } = params;
      return `Lab interpretation for ${patient_age}yo ${patient_gender}:
Values: ${JSON.stringify(lab_values)}
Clinical context: ${clinical_context}
[Educational interpretation with normal ranges, significance, and follow-up recommendations]
⚠️ Educational purposes - verify reference ranges`;
    }
  };

  const studyPlanGenerator = {
    name: 'study_plan',
    description: 'Generate personalized study plan for medical topics',
    parameters: {
      type: 'object',
      properties: {
        topics: { type: 'array', items: { type: 'string' } },
        timeline: { type: 'string' },
        exam_type: { type: 'string' },
        study_style: { type: 'string', enum: ['visual', 'auditory', 'kinesthetic', 'mixed'] }
      }
    },
    handler: async (params: any) => {
      const { topics, timeline, exam_type, study_style } = params;
      return `Personalized study plan:
Topics: ${topics.join(', ')}
Timeline: ${timeline}
Exam: ${exam_type}
Learning style: ${study_style}
[Generated structured study schedule with resources and milestones]`;
    }
  };

  // Add tools to appropriate agents
  clinicalInstructor.addTool(diagnosisChecker);
  clinicalInstructor.addTool(labInterpretation);
  pharmacologyGuide.addTool(drugInteractionChecker);
  diagnosticsExpert.addTool(diagnosisChecker);
  diagnosticsExpert.addTool(labInterpretation);
  examPrep.addTool(studyPlanGenerator);

  // Add agents to framework with capabilities for intelligent orchestration
  app.addAgent(clinicalInstructor, {
    expertise: ['clinical medicine', 'case studies', 'patient safety', 'clinical reasoning', 'evidence-based medicine'],
    complexity: 'expert',
    taskTypes: ['clinical', 'educational', 'case-based'],
    contextAwareness: 0.95,
    collaborationStyle: 'instructional'
  });

  app.addAgent(anatomyExpert, {
    expertise: ['anatomy', 'physiology', 'structures', 'functions', 'mnemonics'],
    complexity: 'advanced',
    taskTypes: ['educational', 'anatomical', 'structural'],
    contextAwareness: 0.85,
    collaborationStyle: 'detailed'
  });

  app.addAgent(pharmacologyGuide, {
    expertise: ['pharmacology', 'drug mechanisms', 'drug interactions', 'drug safety', 'therapeutics'],
    complexity: 'expert',
    taskTypes: ['pharmacological', 'safety', 'therapeutic'],
    contextAwareness: 0.9,
    collaborationStyle: 'precise'
  });

  app.addAgent(diagnosticsExpert, {
    expertise: ['diagnosis', 'differential diagnosis', 'clinical decision making', 'diagnostic reasoning'],
    complexity: 'expert',
    taskTypes: ['diagnostic', 'analytical', 'clinical'],
    contextAwareness: 0.9,
    collaborationStyle: 'systematic'
  });

  app.addAgent(examPrep, {
    expertise: ['exam preparation', 'practice questions', 'study strategies', 'USMLE', 'medical exams'],
    complexity: 'advanced',
    taskTypes: ['educational', 'assessment', 'preparation'],
    contextAwareness: 0.8,
    collaborationStyle: 'supportive'
  });

  return app;
}

async function initializeApp() {
  const app = await createMedicalTutorApp();
  // Add CLI interface
  const cli = new CLIInterface();
  app.addInterface(cli);
  return app;
}

export default initializeApp;

if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    if (process.env.SMALLTALK_PLAYGROUND_MODE === 'true') {
      // Playground mode - set up web interface
      const app = await createMedicalTutorApp();
      
      const { WebChatInterface } = await import('../src/index.js');
      
      // Dynamic port configuration
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
      // CLI mode
      const app = await initializeApp();
      console.log('🏥 Medical Tutor - SmallTalk Framework');
      console.log('=====================================');
      console.log('✅ Medical Education Environment Ready!');
      console.log('🎯 Intelligent orchestration enabled - the right expert will be selected for your questions');
      
      console.log('\n👨‍⚕️ Available Medical Experts:');
      console.log('• DrMedTeach - Clinical instructor for case-based learning');
      console.log('• AnatomyPro - Anatomy expert with detailed explanations');
      console.log('• PharmGuide - Pharmacology specialist for drug information');
      console.log('• DiagnosticDoc - Diagnostic reasoning and clinical thinking');
      console.log('• ExamMentor - Exam preparation and practice questions');
      
      console.log('\n💡 Try asking:');
      console.log('• "Create a cardiology case study for a 3rd year student"');
      console.log('• "Explain the anatomy of the heart with clinical correlations"');
      console.log('• "Tell me about metformin pharmacology"');
      console.log('• "How do I approach a patient with chest pain?"');
      console.log('• "Give me a USMLE-style question about diabetes"');
      
      console.log('\n🎯 Features:');
      console.log('• Intelligent expert selection based on your medical questions');
      console.log('• Use /agent <name> to speak with specific medical experts');
      console.log('• Specialized medical tools for drug lookup and diagnosis');
      console.log('• Evidence-based medical education content');
      
      console.log('\n⚠️  DISCLAIMER: All content is for educational purposes only.');
      console.log('This is not medical advice. Always verify information with current clinical resources.\n');
      
      app.start().catch((error) => {
        console.error('❌ Failed to start medical tutor:', error);
        process.exit(1);
      });
    }
  })();
}