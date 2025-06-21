#!/usr/bin/env node

import {
  SmallTalk,
  CLIInterface,
  Agent,
  PromptTemplate,
  MCPClient
} from '../src/index.js';

async function createBusinessMeetingApp() {
  const app = new SmallTalk({
    llmProvider: 'openai',
    model: 'gpt-4o',
    debugMode: true
  });

  // Create specialized business agents for different roles
  const ceo = new Agent({
    name: 'CEO',
    personality: 'A strategic business leader focused on high-level decisions, market opportunities, and company vision. Thinks about ROI, scalability, and competitive advantage.',
    temperature: 0.8,
    maxTokens: 3000
  });

  const marketingDirector = new Agent({
    name: 'MarketingLead',
    personality: 'A creative marketing expert who understands customer behavior, brand positioning, and digital marketing strategies. Data-driven but creative in approach.',
    temperature: 0.9,
    maxTokens: 3500
  });

  const techLead = new Agent({
    name: 'TechLead',
    personality: 'A technical expert who evaluates feasibility, architecture, and implementation details. Considers scalability, security, and development timelines.',
    temperature: 0.6,
    maxTokens: 3500
  });

  const salesDirector = new Agent({
    name: 'SalesChief',
    personality: 'A results-oriented sales professional who understands customer needs, market demands, and revenue generation. Focuses on practical implementation and customer value.',
    temperature: 0.7,
    maxTokens: 3000
  });

  const researchAnalyst = new Agent({
    name: 'ResearchPro',
    personality: 'A thorough research analyst who provides data-driven insights, market research, competitive analysis, and trend identification. Methodical and detail-oriented.',
    temperature: 0.4,
    maxTokens: 4000
  });

  const projectManager = new Agent({
    name: 'ProjectManager',
    personality: 'An organized project coordinator who focuses on timelines, resource allocation, risk management, and cross-team collaboration. Keeps everyone on track.',
    temperature: 0.5,
    maxTokens: 3000
  });

  const financialAdvisor = new Agent({
    name: 'FinanceAdvisor',
    personality: 'A financial expert who analyzes costs, budgets, ROI projections, and financial risks. Provides realistic financial assessments and recommendations.',
    temperature: 0.3,
    maxTokens: 3000
  });

  // Business meeting prompt templates
  const businessAnalysisTemplate: PromptTemplate = {
    name: 'business_analysis',
    template: `Analyze the business opportunity: {{opportunity}}

From your perspective as {{role}}, consider:

1. Key opportunities and benefits
2. Potential challenges and risks
3. Resource requirements
4. Timeline considerations
5. Success metrics
6. Your specific recommendations

Context: {{context}}
Budget range: {{budget}}
Timeline: {{timeline}}

Provide actionable insights from your expertise area.`,
    variables: ['opportunity', 'role', 'context', 'budget', 'timeline']
  };

  const marketResearchTemplate: PromptTemplate = {
    name: 'market_research',
    template: `Conduct market research analysis for: {{product_or_service}}

Target market: {{target_market}}
Industry: {{industry}}
Geographic scope: {{geography}}

Research areas:
1. Market size and growth potential
2. Target customer demographics and behavior
3. Competitive landscape analysis
4. Market trends and opportunities
5. Pricing strategies and models
6. Go-to-market recommendations
7. Risk factors and challenges

{{#if specific_questions}}Specific research questions: {{specific_questions}}{{/if}}

Provide data-driven insights and actionable recommendations.`,
    variables: ['product_or_service', 'target_market', 'industry', 'geography', 'specific_questions']
  };

  const marketingStrategyTemplate: PromptTemplate = {
    name: 'marketing_strategy',
    template: `Develop a marketing strategy for: {{product_or_service}}

Target audience: {{target_audience}}
Budget: {{budget}}
Timeline: {{timeline}}
Goals: {{goals}}

Strategy components:
1. Brand positioning and messaging
2. Channel strategy (digital, traditional, etc.)
3. Content marketing approach
4. Customer acquisition funnel
5. Metrics and KPIs
6. Campaign timeline and milestones
7. Budget allocation recommendations

{{#if competitive_context}}Competitive context: {{competitive_context}}{{/if}}
{{#if constraints}}Constraints: {{constraints}}{{/if}}

Focus on measurable, achievable outcomes.`,
    variables: ['product_or_service', 'target_audience', 'budget', 'timeline', 'goals', 'competitive_context', 'constraints']
  };

  const techFeasibilityTemplate: PromptTemplate = {
    name: 'tech_feasibility',
    template: `Assess technical feasibility for: {{project}}

Requirements:
{{requirements}}

Evaluation criteria:
1. Technical architecture and approach
2. Technology stack recommendations
3. Development timeline and phases
4. Resource requirements (team, tools, infrastructure)
5. Scalability considerations
6. Security and compliance requirements
7. Integration challenges
8. Risk assessment and mitigation
9. Alternative approaches

Budget: {{budget}}
Timeline: {{timeline}}
{{#if existing_systems}}Existing systems: {{existing_systems}}{{/if}}

Provide realistic assessment with implementation roadmap.`,
    variables: ['project', 'requirements', 'budget', 'timeline', 'existing_systems']
  };

  const projectPlanTemplate: PromptTemplate = {
    name: 'project_plan',
    template: `Create a project plan for: {{project_name}}

Project scope: {{scope}}
Timeline: {{timeline}}
Budget: {{budget}}
Team size: {{team_size}}

Plan components:
1. Project phases and milestones
2. Task breakdown and dependencies
3. Resource allocation and roles
4. Risk assessment and mitigation
5. Communication plan
6. Quality assurance approach
7. Success criteria and metrics
8. Contingency planning

{{#if constraints}}Constraints: {{constraints}}{{/if}}
{{#if stakeholders}}Key stakeholders: {{stakeholders}}{{/if}}

Focus on realistic, actionable project structure.`,
    variables: ['project_name', 'scope', 'timeline', 'budget', 'team_size', 'constraints', 'stakeholders']
  };

  // Set templates for each agent
  ceo.setPromptTemplate('business_analysis', businessAnalysisTemplate);
  marketingDirector.setPromptTemplate('marketing_strategy', marketingStrategyTemplate);
  techLead.setPromptTemplate('tech_feasibility', techFeasibilityTemplate);
  researchAnalyst.setPromptTemplate('market_research', marketResearchTemplate);
  projectManager.setPromptTemplate('project_plan', projectPlanTemplate);

  // Business tools
  const competitorAnalysis = {
    name: 'competitor_analysis',
    description: 'Analyze competitors in the market',
    parameters: {
      type: 'object',
      properties: {
        industry: { type: 'string' },
        competitors: { type: 'array', items: { type: 'string' } },
        analysis_type: { type: 'string', enum: ['pricing', 'features', 'marketing', 'financial', 'comprehensive'] }
      }
    },
    handler: async (params: any) => {
      const { industry, competitors, analysis_type } = params;
      return `Competitor Analysis (${analysis_type}):
Industry: ${industry}
Competitors: ${competitors.join(', ')}
[Generated competitive analysis with strengths, weaknesses, market positioning, and strategic insights]`;
    }
  };

  const marketSizing = {
    name: 'market_sizing',
    description: 'Calculate total addressable market (TAM), serviceable addressable market (SAM), and serviceable obtainable market (SOM)',
    parameters: {
      type: 'object',
      properties: {
        product_category: { type: 'string' },
        target_geography: { type: 'string' },
        customer_segments: { type: 'array', items: { type: 'string' } }
      }
    },
    handler: async (params: any) => {
      const { product_category, target_geography, customer_segments } = params;
      return `Market Sizing Analysis:
Product: ${product_category}
Geography: ${target_geography}
Segments: ${customer_segments.join(', ')}
[Generated TAM/SAM/SOM analysis with market size estimates and growth projections]`;
    }
  };

  const budgetCalculator = {
    name: 'budget_calculator',
    description: 'Calculate project costs and ROI projections',
    parameters: {
      type: 'object',
      properties: {
        project_type: { type: 'string' },
        duration_months: { type: 'number' },
        team_size: { type: 'number' },
        additional_costs: { type: 'array', items: { type: 'string' } }
      }
    },
    handler: async (params: any) => {
      const { project_type, duration_months, team_size, additional_costs } = params;
      return `Budget Calculation:
Project: ${project_type}
Duration: ${duration_months} months
Team: ${team_size} people
Additional costs: ${additional_costs.join(', ')}
[Generated cost breakdown, timeline, and ROI projections]`;
    }
  };

  const riskAssessment = {
    name: 'risk_assessment',
    description: 'Assess business and project risks',
    parameters: {
      type: 'object',
      properties: {
        project_description: { type: 'string' },
        risk_categories: { type: 'array', items: { type: 'string' } },
        impact_level: { type: 'string', enum: ['low', 'medium', 'high'] }
      }
    },
    handler: async (params: any) => {
      const { project_description, risk_categories, impact_level } = params;
      return `Risk Assessment:
Project: ${project_description}
Categories: ${risk_categories.join(', ')}
Impact Level: ${impact_level}
[Generated risk matrix with probability, impact, and mitigation strategies]`;
    }
  };

  const swotAnalysis = {
    name: 'swot_analysis',
    description: 'Generate SWOT analysis (Strengths, Weaknesses, Opportunities, Threats)',
    parameters: {
      type: 'object',
      properties: {
        business_context: { type: 'string' },
        company_size: { type: 'string' },
        industry: { type: 'string' },
        market_position: { type: 'string' }
      }
    },
    handler: async (params: any) => {
      const { business_context, company_size, industry, market_position } = params;
      return `SWOT Analysis:
Context: ${business_context}
Company: ${company_size} in ${industry}
Position: ${market_position}
[Generated comprehensive SWOT with strategic implications and action items]`;
    }
  };

  // Add tools to appropriate agents
  researchAnalyst.addTool(competitorAnalysis);
  researchAnalyst.addTool(marketSizing);
  researchAnalyst.addTool(swotAnalysis);
  financialAdvisor.addTool(budgetCalculator);
  financialAdvisor.addTool(riskAssessment);
  projectManager.addTool(riskAssessment);
  projectManager.addTool(budgetCalculator);
  ceo.addTool(swotAnalysis);
  marketingDirector.addTool(competitorAnalysis);

  // Add agents to framework
  app.addAgent(ceo);
  app.addAgent(marketingDirector);
  app.addAgent(techLead);
  app.addAgent(salesDirector);
  app.addAgent(researchAnalyst);
  app.addAgent(projectManager);
  app.addAgent(financialAdvisor);

  // Create business meeting CLI interface
  const cli = new CLIInterface({
    type: 'cli',
    prompt: '💼 ',
    colors: {
      user: '#2980b9',
      assistant: '#27ae60',
      system: '#f39c12',
      error: '#e74c3c'
    },
    showTimestamps: true,
    showAgentNames: true
  });

  app.addInterface(cli);

  return app;
}

async function main() {
  console.log('💼 Business Meeting - SmallTalk Framework');
  console.log('=========================================');
  
  const app = await createBusinessMeetingApp();
  await app.start();

  console.log('\n✅ Business Meeting Environment Ready!');
  console.log('\n👥 Executive Team Available:');
  console.log('• CEO - Strategic leadership and high-level decisions');
  console.log('• MarketingLead - Marketing strategy and brand positioning');
  console.log('• TechLead - Technical feasibility and implementation');
  console.log('• SalesChief - Sales strategy and customer value');
  console.log('• ResearchPro - Market research and competitive analysis');
  console.log('• ProjectManager - Project planning and coordination');
  console.log('• FinanceAdvisor - Financial analysis and budgeting');
  
  console.log('\n🗣️ Commands:');
  console.log('• /agent CEO - Strategic decisions and vision');
  console.log('• /agent MarketingLead - Marketing and branding');
  console.log('• /agent TechLead - Technical architecture and feasibility');
  console.log('• /agent SalesChief - Sales strategy and customer focus');
  console.log('• /agent ResearchPro - Market research and analysis');
  console.log('• /agent ProjectManager - Project planning and execution');
  console.log('• /agent FinanceAdvisor - Financial planning and ROI');
  
  console.log('\n💡 Business Scenarios to Try:');
  console.log('• "We want to launch a new mobile app for food delivery"');
  console.log('• "Analyze the market for AI-powered customer service tools"');
  console.log('• "Create a marketing strategy for our SaaS product launch"');
  console.log('• "Assess technical feasibility of blockchain integration"');
  console.log('• "Develop a go-to-market plan for our new feature"');
  console.log('• "Research competitors in the fintech space"');
  console.log('• "Plan a website redesign project with $50k budget"');
  
  console.log('\n🎯 Meeting Formats:');
  console.log('• Switch between agents to get different perspectives');
  console.log('• Present a business challenge and gather expert opinions');
  console.log('• Use agents\' specialized tools for analysis and planning');
  console.log('• Build comprehensive business strategies collaboratively');
  console.log('\n');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Meeting adjourned! Great collaboration, team!');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Business meeting error:', error);
  process.exit(1);
});

// Run the business meeting
main().catch((error) => {
  console.error('❌ Failed to start business meeting:', error);
  process.exit(1);
});