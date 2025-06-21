import { Agent } from './Agent.js';
import {
  AgentConfig,
  AgentPersonality,
  PromptTemplate,
  ToolDefinition
} from '../types/index.js';

export class AgentFactory {
  private static presetPersonalities: Map<string, AgentPersonality> = new Map([
    ['helpful', {
      name: 'Helpful Assistant',
      description: 'A friendly and helpful AI assistant focused on providing accurate information and assistance.',
      traits: ['friendly', 'helpful', 'patient', 'informative'],
      communicationStyle: 'Clear, concise, and supportive',
      expertise: ['general knowledge', 'problem solving', 'explanations']
    }],
    ['coding', {
      name: 'Coding Expert',
      description: 'A programming expert that provides code solutions, debugging help, and technical guidance.',
      traits: ['analytical', 'precise', 'thorough', 'logical'],
      communicationStyle: 'Technical but accessible, with clear code examples',
      expertise: ['programming', 'debugging', 'software architecture', 'best practices']
    }],
    ['creative', {
      name: 'Creative Writer',
      description: 'A creative assistant specializing in writing, storytelling, and creative content generation.',
      traits: ['imaginative', 'expressive', 'inspiring', 'artistic'],
      communicationStyle: 'Engaging, vivid, and emotionally resonant',
      expertise: ['creative writing', 'storytelling', 'content creation', 'brainstorming']
    }],
    ['analytical', {
      name: 'Data Analyst',
      description: 'An analytical expert focused on data interpretation, research, and logical problem-solving.',
      traits: ['methodical', 'objective', 'detail-oriented', 'systematic'],
      communicationStyle: 'Structured, evidence-based, and precise',
      expertise: ['data analysis', 'research', 'statistics', 'logical reasoning']
    }],
    ['casual', {
      name: 'Casual Buddy',
      description: 'A relaxed, conversational AI that chats in a friendly, informal manner.',
      traits: ['casual', 'friendly', 'relatable', 'easygoing'],
      communicationStyle: 'Informal, conversational, with humor and personality',
      expertise: ['general conversation', 'casual advice', 'entertainment']
    }],
    ['teacher', {
      name: 'Patient Teacher',
      description: 'An educational assistant focused on teaching and explaining concepts clearly.',
      traits: ['patient', 'encouraging', 'thorough', 'supportive'],
      communicationStyle: 'Clear explanations with examples and encouragement',
      expertise: ['education', 'explanations', 'tutoring', 'learning support']
    }]
  ]);

  public static createAgent(config: AgentConfig): Agent {
    return new Agent(config);
  }

  public static createFromPreset(
    name: string, 
    presetName: string, 
    overrides: Partial<AgentConfig> = {}
  ): Agent {
    const personality = this.presetPersonalities.get(presetName);
    if (!personality) {
      throw new Error(`Preset personality '${presetName}' not found. Available presets: ${this.getAvailablePresets().join(', ')}`);
    }

    const config: AgentConfig = {
      name,
      personality: personality.description,
      temperature: 0.7,
      maxTokens: 2048,
      ...overrides
    };

    const agent = new Agent(config);
    agent.setPersonality(personality);

    return agent;
  }

  public static createSimple(
    name: string,
    personality: string,
    options: {
      temperature?: number;
      maxTokens?: number;
      tools?: string[];
      expertise?: string[];
    } = {}
  ): Agent {
    const agentPersonality: AgentPersonality = {
      name,
      description: personality,
      traits: [],
      communicationStyle: personality,
      expertise: options.expertise || []
    };

    const config: AgentConfig = {
      name,
      personality,
      temperature: options.temperature || 0.7,
      maxTokens: options.maxTokens || 2048,
      tools: options.tools || []
    };

    const agent = new Agent(config);
    agent.setPersonality(agentPersonality);

    return agent;
  }

  public static createCodingAssistant(
    name: string = 'CodeHelper',
    languages: string[] = ['javascript', 'typescript', 'python'],
    overrides: Partial<AgentConfig> = {}
  ): Agent {
    const config: AgentConfig = {
      name,
      personality: `A helpful coding assistant specialized in ${languages.join(', ')}. I provide clean code solutions, explain programming concepts, and help debug issues.`,
      temperature: 0.3, // Lower temperature for more consistent code
      maxTokens: 3000, // More tokens for code examples
      ...overrides
    };

    const personality: AgentPersonality = {
      name,
      description: config.personality!,
      traits: ['precise', 'helpful', 'logical', 'thorough'],
      communicationStyle: 'Clear and technical with well-commented code examples',
      expertise: ['programming', ...languages, 'debugging', 'best practices']
    };

    const agent = new Agent(config);
    agent.setPersonality(personality);

    // Add coding-specific prompt templates
    const codeReviewTemplate: PromptTemplate = {
      name: 'code_review',
      template: `Please review the following {{language}} code and provide feedback:

\`\`\`{{language}}
{{code}}
\`\`\`

Focus on:
- Code quality and readability
- Potential bugs or issues
- Performance improvements
- Best practices
{{#if specific_concerns}}- {{specific_concerns}}{{/if}}`,
      variables: ['language', 'code', 'specific_concerns']
    };

    const debugTemplate: PromptTemplate = {
      name: 'debug_help',
      template: `I need help debugging this {{language}} code:

\`\`\`{{language}}
{{code}}
\`\`\`

{{#if error_message}}Error message: {{error_message}}{{/if}}
{{#if expected_behavior}}Expected behavior: {{expected_behavior}}{{/if}}
{{#if actual_behavior}}Actual behavior: {{actual_behavior}}{{/if}}

Please help identify and fix the issue.`,
      variables: ['language', 'code', 'error_message', 'expected_behavior', 'actual_behavior']
    };

    agent.setPromptTemplate('code_review', codeReviewTemplate);
    agent.setPromptTemplate('debug_help', debugTemplate);

    return agent;
  }

  public static createWritingAssistant(
    name: string = 'Writer',
    style: 'creative' | 'technical' | 'academic' | 'casual' = 'creative',
    overrides: Partial<AgentConfig> = {}
  ): Agent {
    const styleDescriptions = {
      creative: 'imaginative and engaging with vivid descriptions',
      technical: 'clear, precise, and structured for technical documentation',
      academic: 'formal, well-researched, and citation-focused',
      casual: 'conversational, friendly, and approachable'
    };

    const config: AgentConfig = {
      name,
      personality: `A writing assistant that specializes in ${style} writing. I help with ${styleDescriptions[style]} content.`,
      temperature: style === 'creative' ? 0.8 : 0.6,
      maxTokens: 3000,
      ...overrides
    };

    const personality: AgentPersonality = {
      name,
      description: config.personality!,
      traits: style === 'creative' ? ['imaginative', 'expressive', 'inspiring'] : 
             style === 'technical' ? ['precise', 'clear', 'systematic'] :
             style === 'academic' ? ['scholarly', 'thorough', 'analytical'] :
             ['friendly', 'relatable', 'engaging'],
      communicationStyle: styleDescriptions[style],
      expertise: ['writing', 'editing', 'content creation', `${style} writing`]
    };

    const agent = new Agent(config);
    agent.setPersonality(personality);

    return agent;
  }

  public static createCustomAgent(
    name: string,
    builder: (agent: Agent) => Agent
  ): Agent {
    const baseConfig: AgentConfig = {
      name,
      personality: `A custom AI assistant named ${name}`,
      temperature: 0.7,
      maxTokens: 2048
    };

    const agent = new Agent(baseConfig);
    return builder(agent);
  }

  public static getAvailablePresets(): string[] {
    return Array.from(this.presetPersonalities.keys());
  }

  public static getPresetPersonality(presetName: string): AgentPersonality | undefined {
    return this.presetPersonalities.get(presetName);
  }

  public static addPresetPersonality(name: string, personality: AgentPersonality): void {
    this.presetPersonalities.set(name, personality);
  }

  public static removePresetPersonality(name: string): boolean {
    return this.presetPersonalities.delete(name);
  }

  public static createAgentTeam(configs: Array<{
    name: string;
    preset?: string;
    personality?: string;
    config?: Partial<AgentConfig>;
  }>): Agent[] {
    return configs.map(({ name, preset, personality, config = {} }) => {
      if (preset) {
        return this.createFromPreset(name, preset, config);
      } else if (personality) {
        return this.createSimple(name, personality, config);
      } else {
        throw new Error(`Agent '${name}' must specify either 'preset' or 'personality'`);
      }
    });
  }

  public static cloneAgent(
    originalAgent: Agent, 
    newName: string, 
    modifications: {
      personality?: Partial<AgentPersonality>;
      config?: Partial<AgentConfig>;
      additionalTools?: ToolDefinition[];
      additionalTemplates?: PromptTemplate[];
    } = {}
  ): Agent {
    // Clone the original agent
    const cloned = originalAgent.clone(newName, modifications.config);

    // Apply personality modifications
    if (modifications.personality) {
      const currentPersonality = cloned.getPersonality();
      if (currentPersonality) {
        const modifiedPersonality = { ...currentPersonality, ...modifications.personality };
        cloned.setPersonality(modifiedPersonality);
      }
    }

    // Add additional tools
    if (modifications.additionalTools) {
      modifications.additionalTools.forEach(tool => cloned.addTool(tool));
    }

    // Add additional templates
    if (modifications.additionalTemplates) {
      modifications.additionalTemplates.forEach(template => 
        cloned.setPromptTemplate(template.name, template)
      );
    }

    return cloned;
  }
}