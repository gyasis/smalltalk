import {
  SmallTalk,
  CLIInterface,
  Agent,
  PromptTemplate,
  PlaygroundConfig
} from '../src/index.js';

// Playground configuration for web mode
export const playgroundConfig: PlaygroundConfig = {
  port: 3127,
  host: 'localhost',
  title: '🧠 RAG Research & Brainstorm Hub',
  description: 'Technical research and brainstorming with AI agents and RAG knowledge base',
  orchestrationMode: true,
  enableChatUI: true
};

async function createRAGResearchDemo() {
  const app = new SmallTalk({
    llmProvider: 'openai',
    model: 'gpt-4o-mini',
    debugMode: false,  // Hide internal orchestration messages
    useInteractiveOrchestration: true,  // Use Phase 1-3 Interactive Orchestration
    features: {
      realTimeMonitoring: true,         // Phase 1: Real-time monitoring
      adaptivePlanning: true,           // Phase 3: Adaptive planning
      predictiveRouting: true,          // Phase 3: Predictive routing
      feedbackLearning: true            // Phase 3: Continuous learning
    },
    mcpServers: ['deeplake-rag']  // Enable MCP DeepLake RAG integration
  });

  // Enable MCP DeepLake RAG server integration
  await app.enableMCP([
    {
      name: 'deeplake-rag',
      type: 'stdio',
      command: '/home/gyasis/Documents/code/hello-World/.venv/bin/python3',
      args: ['/home/gyasis/Documents/code/hello-World/main.py'],
      enabled: true
    }
  ]);

  console.log('🧠 RAG Research & Brainstorm Hub initialized with MCP DeepLake integration!');
  
  // Debug: Check MCP server connection and available tools
  const mcpClient = app.getMCPClient();
  if (mcpClient) {
    console.log('\n🔍 DEBUGGING MCP CONNECTION...');
    const connectedServers = mcpClient.getConnectedServers();
    console.log(`📊 Connected MCP Servers: ${connectedServers.length}`);
    connectedServers.forEach(server => {
      console.log(`  ✅ ${server}`);
    });
    
    // List available tools from all MCP servers
    try {
      const availableTools = await mcpClient.getAvailableTools();
      console.log(`\n🛠️  Available MCP Tools: ${availableTools.length}`);
      availableTools.forEach(tool => {
        console.log(`  🔧 ${tool.name} (${tool.description})`);
      });
    } catch (error) {
      console.log(`❌ Error listing MCP tools: ${error.message}`);
    }
    
    // List available prompts from all MCP servers
    try {
      const availablePrompts = await mcpClient.getAvailablePrompts();
      console.log(`\n📝 Available MCP Prompts: ${availablePrompts.length}`);
      availablePrompts.forEach(prompt => {
        console.log(`  📄 ${prompt.name} (${prompt.description})`);
      });
    } catch (error) {
      console.log(`❌ Error listing MCP prompts: ${error.message}`);
    }
    
    // Test: Try to call a DeepLake tool directly
    console.log('\n🧪 TESTING DEEPLAKE TOOL CALL...');
    try {
      const testResult = await mcpClient.executeTool('deeplake-rag', 'retrieve_context', {
        query: 'test query',
        n_results: '1'
      });
      console.log('✅ DeepLake tool call successful:', testResult);
    } catch (error) {
      console.log('❌ DeepLake tool call failed:', error.message);
    }
  }

  // RAG Agent - Primary knowledge retrieval and context gathering
  const ragAgent = new Agent({
    name: 'RAGAgent',
    personality: 'An intelligent research assistant that specializes in retrieving and contextualizing information from technical knowledge bases. Expert at making multiple targeted queries to gather comprehensive information about APIs, libraries, frameworks, and tutorials. Always provides rich context and cross-references related concepts.',
    temperature: 0.3,  // Lower temperature for precise retrieval
    maxTokens: 4000
  });

  // Brainstorm Agent - Creative ideation and solution exploration
  const brainstormAgent = new Agent({
    name: 'BrainstormAgent', 
    personality: 'A creative and innovative thinking partner who excels at generating ideas, exploring possibilities, and connecting concepts in novel ways. Takes technical information and expands it into actionable strategies, alternative approaches, and innovative solutions. Encourages experimentation and out-of-the-box thinking.',
    temperature: 0.9,  // Higher temperature for creative thinking
    maxTokens: 3500
  });

  // API Expert Agent - Deep API knowledge and integration expertise
  const apiExpertAgent = new Agent({
    name: 'APIExpertAgent',
    personality: 'A seasoned API architect and integration specialist with deep knowledge of REST, GraphQL, gRPC, and emerging API patterns. Expert at API design, authentication, rate limiting, versioning, and best practices. Provides detailed implementation guidance and troubleshooting for API-related challenges.',
    temperature: 0.4,  // Balanced for technical precision
    maxTokens: 3500
  });

  // Tutor Agent - Educational guidance and learning path creation
  const tutorAgent = new Agent({
    name: 'TutorAgent',
    personality: 'A patient and knowledgeable educator who excels at breaking down complex technical concepts into digestible learning paths. Creates structured tutorials, explains prerequisites, provides hands-on examples, and adapts teaching style to different skill levels. Always focuses on practical understanding and progressive skill building.',
    temperature: 0.6,  // Balanced for clear explanations
    maxTokens: 4000
  });

  // Engineer Agent - Implementation focus and technical architecture
  const engineerAgent = new Agent({
    name: 'EngineerAgent',
    personality: 'A pragmatic software engineer focused on implementation details, technical architecture, and production-ready solutions. Expert at evaluating technical feasibility, identifying potential issues, recommending best practices, and providing step-by-step implementation guidance. Always considers scalability, maintainability, and performance.',
    temperature: 0.5,  // Balanced for practical solutions
    maxTokens: 3500
  });

  // Research prompt templates
  const ragQueryTemplate: PromptTemplate = {
    name: 'rag_query',
    template: `Research Query: {{query}}
    
Search the knowledge base for information about: {{topic}}

{{#if specific_technologies}}Focus on these technologies: {{specific_technologies}}{{/if}}
{{#if use_case}}Use case context: {{use_case}}{{/if}}
{{#if skill_level}}Target skill level: {{skill_level}}{{/if}}

Retrieval Strategy:
1. Make multiple targeted searches to gather comprehensive information
2. Look for related APIs, libraries, and frameworks
3. Find relevant tutorials and documentation
4. Identify best practices and common patterns
5. Gather implementation examples and code snippets

Provide rich context and cross-reference related concepts from the knowledge base.`,
    variables: ['query', 'topic', 'specific_technologies', 'use_case', 'skill_level']
  };

  const brainstormTemplate: PromptTemplate = {
    name: 'brainstorm_session',
    template: `Brainstorming Session: {{topic}}

Context from RAG: {{rag_context}}

Brainstorming Focus Areas:
1. Creative approaches and alternative solutions
2. Innovative combinations of existing technologies
3. Potential challenges and mitigation strategies
4. Future-oriented considerations and emerging trends
5. Cross-domain applications and integrations

{{#if constraints}}Constraints to consider: {{constraints}}{{/if}}
{{#if goals}}Project goals: {{goals}}{{/if}}

Generate creative ideas, explore possibilities, and suggest novel approaches. Think beyond conventional solutions.`,
    variables: ['topic', 'rag_context', 'constraints', 'goals']
  };

  const apiExpertTemplate: PromptTemplate = {
    name: 'api_expert_analysis',
    template: `API Analysis Request: {{request}}

Technical Context: {{technical_context}}

API Expertise Areas:
1. API design patterns and best practices
2. Authentication and authorization strategies
3. Rate limiting and quota management
4. Versioning and backwards compatibility
5. Error handling and status codes
6. Documentation and developer experience
7. Performance optimization
8. Security considerations

{{#if api_type}}API Type: {{api_type}}{{/if}}
{{#if integration_requirements}}Integration Requirements: {{integration_requirements}}{{/if}}

Provide detailed technical guidance with practical implementation recommendations.`,
    variables: ['request', 'technical_context', 'api_type', 'integration_requirements']
  };

  const tutorTemplate: PromptTemplate = {
    name: 'learning_path',
    template: `Learning Path Creation: {{learning_goal}}

Student Context: {{student_context}}
Knowledge Base Resources: {{available_resources}}

Educational Structure:
1. Prerequisites and foundational knowledge
2. Progressive learning milestones
3. Hands-on exercises and projects
4. Common pitfalls and troubleshooting
5. Advanced topics and next steps
6. Recommended resources and tutorials

{{#if skill_level}}Current skill level: {{skill_level}}{{/if}}
{{#if time_frame}}Learning time frame: {{time_frame}}{{/if}}
{{#if preferred_style}}Learning style preference: {{preferred_style}}{{/if}}

Create a structured, practical learning path with actionable steps and clear progression.`,
    variables: ['learning_goal', 'student_context', 'available_resources', 'skill_level', 'time_frame', 'preferred_style']
  };

  const engineerTemplate: PromptTemplate = {
    name: 'implementation_plan',
    template: `Implementation Planning: {{project}}

Technical Requirements: {{requirements}}
Available Technologies: {{tech_stack}}

Engineering Considerations:
1. Technical architecture and design patterns
2. Implementation phases and milestones
3. Technology stack evaluation
4. Performance and scalability requirements
5. Testing strategies and quality assurance
6. Deployment and maintenance considerations
7. Risk assessment and mitigation

{{#if constraints}}Technical constraints: {{constraints}}{{/if}}
{{#if timeline}}Project timeline: {{timeline}}{{/if}}
{{#if team_size}}Team size: {{team_size}}{{/if}}

Provide practical implementation guidance with production-ready recommendations.`,
    variables: ['project', 'requirements', 'tech_stack', 'constraints', 'timeline', 'team_size']
  };

  // Set specialized templates
  ragAgent.setPromptTemplate('rag_query', ragQueryTemplate);
  brainstormAgent.setPromptTemplate('brainstorm_session', brainstormTemplate);
  apiExpertAgent.setPromptTemplate('api_expert_analysis', apiExpertTemplate);
  tutorAgent.setPromptTemplate('learning_path', tutorTemplate);
  engineerAgent.setPromptTemplate('implementation_plan', engineerTemplate);

  // ✅ NO MORE PROXY TOOLS! 
  // Agents now have direct access to MCP tools through the framework
  // The MCP tools will be automatically added to all agents by SmallTalk.enableMCP()

  // ✅ All MCP tools are automatically registered by SmallTalk.enableMCP()
  // No need for proxy tools - agents have direct access to:
  // - deeplake-rag:retrieve_context
  // - deeplake-rag:search_document_content  
  // - deeplake-rag:get_fuzzy_matching_titles
  // - deeplake-rag:get_document
  // - deeplake-rag:get_summary

  // Analysis and planning tools
  const technicalAnalyzer = {
    name: 'analyze_technical_feasibility',
    description: 'Analyze the technical feasibility of implementing a solution',
    parameters: {
      type: 'object',
      properties: {
        solution_description: { type: 'string', description: 'Description of the proposed solution' },
        requirements: { type: 'array', items: { type: 'string' }, description: 'Technical requirements' },
        constraints: { type: 'array', items: { type: 'string' }, description: 'Technical constraints' }
      },
      required: ['solution_description']
    },
    handler: async (params: any) => {
      const { solution_description, requirements = [], constraints = [] } = params;
      console.log(`[⚙️ Technical Analyzer] Analyzing feasibility: "${solution_description}"`);
      
      return `Technical Feasibility Analysis:

Solution: ${solution_description}

Feasibility Assessment:
- Implementation complexity: [Analysis]
- Resource requirements: [Analysis]  
- Technical challenges: [Analysis]
- Alternative approaches: [Analysis]
- Risk factors: [Analysis]

Requirements: ${requirements.join(', ')}
Constraints: ${constraints.join(', ')}`;
    }
  };

  const learningPathBuilder = {
    name: 'build_learning_path',
    description: 'Create a structured learning path for mastering a technology or concept',
    parameters: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Topic to create learning path for' },
        current_level: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'], description: 'Current skill level' },
        time_commitment: { type: 'string', description: 'Available time per week' },
        learning_goals: { type: 'array', items: { type: 'string' }, description: 'Specific learning objectives' }
      },
      required: ['topic', 'current_level']
    },
    handler: async (params: any) => {
      const { topic, current_level, time_commitment = 'flexible', learning_goals = [] } = params;
      console.log(`[🎓 Learning Path Builder] Creating path for: "${topic}" (level: ${current_level})`);
      
      return `Learning Path for "${topic}":

Current Level: ${current_level}
Time Commitment: ${time_commitment}

Learning Phases:
1. Foundation Building
2. Core Concepts Mastery
3. Practical Application
4. Advanced Techniques
5. Project Implementation

Goals: ${learning_goals.join(', ')}
Estimated Duration: [Based on commitment and goals]`;
    }
  };

  // Add specialized tools to appropriate agents
  // ✅ RAGAgent will get MCP tools automatically from SmallTalk.enableMCP()
  // All MCP tools (retrieve_context, search_document_content, etc.) will be available as:
  // - deeplake-rag:retrieve_context
  // - deeplake-rag:search_document_content
  // - deeplake-rag:get_fuzzy_matching_titles
  // - deeplake-rag:get_document
  // - deeplake-rag:get_summary

  apiExpertAgent.addTool(technicalAnalyzer);
  engineerAgent.addTool(technicalAnalyzer);
  tutorAgent.addTool(learningPathBuilder);
  // BrainstormAgent will also get MCP tools automatically

  // Add agents to framework with specialized capabilities
  app.addAgent(ragAgent, {
    expertise: ['research', 'information retrieval', 'knowledge synthesis', 'context gathering', 'documentation'],
    tools: ['deeplake-rag:retrieve_context', 'deeplake-rag:search_document_content'], // MCP tools added automatically
    personalityTraits: ['analytical', 'thorough', 'precise', 'methodical'],
    complexity: 'expert',
    taskTypes: ['research', 'retrieval', 'analysis'],
    contextAwareness: 0.95,
    collaborationStyle: 'collaborative'
  });

  app.addAgent(brainstormAgent, {
    expertise: ['creative thinking', 'ideation', 'innovation', 'problem solving', 'strategy'],
    tools: ['deeplake-rag:retrieve_context', 'deeplake-rag:search_document_content'], // MCP tools added automatically
    personalityTraits: ['creative', 'innovative', 'open-minded', 'lateral-thinking'],
    complexity: 'advanced',
    taskTypes: ['brainstorming', 'creative', 'strategy'],
    contextAwareness: 0.85,
    collaborationStyle: 'collaborative'
  });

  app.addAgent(apiExpertAgent, {
    expertise: ['API design', 'integration', 'web services', 'protocols', 'architecture'],
    tools: ['analyze_technical_feasibility'], // MCP tools added automatically
    personalityTraits: ['precise', 'systematic', 'detail-oriented', 'technical'],
    complexity: 'expert',
    taskTypes: ['api', 'integration', 'architecture'],
    contextAwareness: 0.9,
    collaborationStyle: 'leading'
  });

  app.addAgent(tutorAgent, {
    expertise: ['education', 'learning paths', 'tutorials', 'skill development', 'mentoring'],
    tools: ['build_learning_path'], // MCP tools added automatically
    personalityTraits: ['patient', 'encouraging', 'structured', 'adaptive'],
    complexity: 'advanced',
    taskTypes: ['education', 'tutorial', 'guidance'],
    contextAwareness: 0.88,
    collaborationStyle: 'supportive'
  });

  app.addAgent(engineerAgent, {
    expertise: ['software engineering', 'implementation', 'architecture', 'best practices', 'production systems'],
    tools: ['analyze_technical_feasibility'], // MCP tools added automatically
    personalityTraits: ['pragmatic', 'systematic', 'quality-focused', 'solution-oriented'],
    complexity: 'expert',
    taskTypes: ['implementation', 'engineering', 'architecture'],
    contextAwareness: 0.92,
    collaborationStyle: 'leading'
  });

  // Debug: Show what tools each agent has access to
  console.log('\n🤖 AGENT TOOLS DEBUG:');
  const agents = [ragAgent, brainstormAgent, apiExpertAgent, tutorAgent, engineerAgent];
  agents.forEach(agent => {
    const tools = agent.listTools();
    console.log(`\n📋 ${agent.name} tools (${tools.length}):`);
    if (tools.length > 0) {
      tools.forEach(tool => {
        console.log(`  🔧 ${tool}`);
      });
    } else {
      console.log(`  ⚠️  No tools available`);
    }
  });

  return app;
}

async function initializeApp() {
  const app = await createRAGResearchDemo();
  const cli = new CLIInterface();
  app.addInterface(cli);
  return app;
}

export default initializeApp;

if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    if (process.env.SMALLTALK_PLAYGROUND_MODE === 'true') {
      // Playground mode - set up web interface
      const app = await createRAGResearchDemo();
      
      const { WebChatInterface } = await import('../src/index.js');
      
      const port = process.env.SMALLTALK_PLAYGROUND_PORT 
        ? parseInt(process.env.SMALLTALK_PLAYGROUND_PORT) 
        : (playgroundConfig.port || 3127);
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
      
      console.log('✅ Starting RAG Research & Brainstorm Hub...');
      console.log(`🌐 Web Interface: http://${host}:${port}`);
      console.log(`📋 ${playgroundConfig.title}`);
      console.log(`📝 ${playgroundConfig.description}`);
      console.log();
      console.log('Press Ctrl+C to stop the server');
      
      await app.start();
    } else {
      // CLI mode
      const app = await initializeApp();
      console.log('🧠 RAG Research & Brainstorm Hub - SmallTalk Framework');
      console.log('=========================================================');
      console.log('✅ RAG Research Environment Ready with MCP DeepLake Integration!');
      console.log('🎯 Phase 1-3 Interactive Orchestration enabled with intelligent agent selection');
      console.log('🔍 DeepLake RAG server configured for technical knowledge retrieval');
      
      console.log('\n🤖 Specialized Research Team:');
      console.log('• RAGAgent - Knowledge retrieval and context gathering from technical database');
      console.log('• BrainstormAgent - Creative ideation and innovative solution exploration');  
      console.log('• APIExpertAgent - API design, integration, and architecture expertise');
      console.log('• TutorAgent - Learning paths, tutorials, and educational guidance');
      console.log('• EngineerAgent - Implementation focus and production-ready solutions');
      
      console.log('\n💡 Example Research Queries:');
      console.log('• "How do I build a machine learning project using PyTorch and specific libraries?"');
      console.log('• "Research REST API authentication patterns and best practices"');
      console.log('• "Create a learning path for mastering React and modern web development"');
      console.log('• "Brainstorm innovative approaches for real-time data processing"');
      console.log('• "Analyze the technical feasibility of implementing GraphQL federation"');
      console.log('• "Find tutorials and examples for building microservices with Docker"');
      
      console.log('\n🔍 RAG Knowledge Base Contains:');
      console.log('• API documentation and integration guides');
      console.log('• Library tutorials and framework examples');
      console.log('• Technical articles and case studies');
      console.log('• Code samples and implementation patterns');
      console.log('• Best practices and architectural guidance');
      
      console.log('\n🚀 Advanced Features:');
      console.log('• Multi-call RAG retrieval for complex queries');
      console.log('• Intelligent agent collaboration and knowledge synthesis');  
      console.log('• Context-aware research and personalized recommendations');
      console.log('• Real-time learning from user interactions and feedback');
      console.log('• Adaptive planning based on query complexity and user needs');
      console.log('\n');
      
      app.start().catch((error) => {
        console.error('❌ Failed to start RAG research demo:', error);
        process.exit(1);
      });
    }
  })();
}