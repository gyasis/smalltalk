import { AgentConfig, ChatMessage, FlowContext, ToolDefinition, PromptTemplate } from '../../types/index.js';

// Mock Agent class that simulates core agent functionality
class MockAgent {
  public readonly name: string;
  public readonly config: AgentConfig;
  private tools: Map<string, ToolDefinition> = new Map();
  private promptTemplates: Map<string, PromptTemplate> = new Map();

  constructor(config: AgentConfig) {
    this.config = {
      temperature: 0.7,
      maxTokens: 2048,
      tools: [],
      mcpServers: [],
      promptTemplates: {},
      ...config
    };
    
    this.name = config.name;
    
    // Setup default prompt templates
    this.setupDefaultPrompts();
  }

  private setupDefaultPrompts(): void {
    const defaultSystemPrompt: PromptTemplate = {
      name: 'system',
      template: `You are {{agentName}}, an AI assistant.
{{#if personality}}{{personality}}{{/if}}
Please be helpful, accurate, and maintain your personality throughout the conversation.`,
      variables: ['agentName', 'personality']
    };

    this.promptTemplates.set('system', defaultSystemPrompt);
  }

  async generateResponse(message: string, context: FlowContext): Promise<string> {
    // Simulate response generation based on agent config
    const personalityResponse = this.getPersonalityBasedResponse(message);
    const toolsInfo = this.tools.size > 0 ? ` I have ${this.tools.size} tools available.` : '';
    
    return `${personalityResponse}${toolsInfo}`;
  }

  private getPersonalityBasedResponse(message: string): string {
    const personality = this.config.personality?.toLowerCase() || '';
    
    if (personality.includes('helpful')) {
      return `I'm here to help! You said: "${message}"`;
    } else if (personality.includes('creative')) {
      return `That's an interesting thought about "${message}". Let me think creatively about this...`;
    } else if (personality.includes('analytical')) {
      return `Let me analyze your message: "${message}". Here's my systematic approach...`;
    } else if (personality.includes('friendly')) {
      return `Hi there! Thanks for sharing: "${message}". I'm happy to chat!`;
    } else {
      return `You said: "${message}". I understand and am ready to assist.`;
    }
  }

  addTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  removeTool(name: string): boolean {
    return this.tools.delete(name);
  }

  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  listTools(): string[] {
    return Array.from(this.tools.keys());
  }

  setPromptTemplate(name: string, template: PromptTemplate): void {
    this.promptTemplates.set(name, template);
  }

  getPromptTemplate(name: string): PromptTemplate | undefined {
    return this.promptTemplates.get(name);
  }

  listPromptTemplates(): string[] {
    return Array.from(this.promptTemplates.keys());
  }

  getPersonality(): string | undefined {
    return this.config.personality;
  }

  getTemperature(): number {
    return this.config.temperature || 0.7;
  }

  getMaxTokens(): number {
    return this.config.maxTokens || 2048;
  }

  getSystemPrompt(): string | undefined {
    return this.config.systemPrompt;
  }

  updateConfig(updates: Partial<AgentConfig>): void {
    Object.assign(this.config, updates);
  }

  // Simulate prompt template rendering
  renderTemplate(templateName: string, variables: Record<string, any>): string {
    const template = this.promptTemplates.get(templateName);
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    let rendered = template.template;
    
    // Simple variable substitution for testing
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      rendered = rendered.replace(new RegExp(placeholder, 'g'), String(value));
    }

    // Handle conditional blocks (simplified)
    rendered = rendered.replace(/\{\{#if (\w+)\}\}(.*?)\{\{\/if\}\}/g, (match, variable, content) => {
      return variables[variable] ? content : '';
    });

    return rendered;
  }

  // Method to simulate tool execution
  async executeTool(toolName: string, parameters: Record<string, unknown>): Promise<unknown> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found`);
    }

    return await tool.handler(parameters);
  }

  // Get agent capabilities for testing
  getCapabilities(): {
    toolCount: number;
    templateCount: number;
    hasPersonality: boolean;
    hasSystemPrompt: boolean;
  } {
    return {
      toolCount: this.tools.size,
      templateCount: this.promptTemplates.size,
      hasPersonality: !!this.config.personality,
      hasSystemPrompt: !!this.config.systemPrompt
    };
  }
}

describe('Agent - Core Functionality', () => {
  let agent: MockAgent;
  let sampleContext: FlowContext;

  beforeEach(() => {
    const config: AgentConfig = {
      name: 'TestAgent',
      personality: 'helpful and friendly',
      systemPrompt: 'You are a test assistant.',
      temperature: 0.8,
      maxTokens: 1024
    };

    agent = new MockAgent(config);

    sampleContext = {
      session: {
        id: 'test-session',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      message: {
        id: 'test-msg',
        role: 'user',
        content: 'Hello',
        timestamp: new Date()
      },
      tools: [],
      config: { llmProvider: 'openai', model: 'gpt-4o-mini' }
    };
  });

  describe('Initialization', () => {
    it('should initialize with basic config', () => {
      expect(agent.name).toBe('TestAgent');
      expect(agent.config.name).toBe('TestAgent');
      expect(agent.config.personality).toBe('helpful and friendly');
      expect(agent.config.systemPrompt).toBe('You are a test assistant.');
      expect(agent.config.temperature).toBe(0.8);
      expect(agent.config.maxTokens).toBe(1024);
    });

    it('should initialize with default values', () => {
      const minimalAgent = new MockAgent({ name: 'MinimalAgent' });
      
      expect(minimalAgent.name).toBe('MinimalAgent');
      expect(minimalAgent.config.temperature).toBe(0.7);
      expect(minimalAgent.config.maxTokens).toBe(2048);
      expect(minimalAgent.config.tools).toEqual([]);
      expect(minimalAgent.config.mcpServers).toEqual([]);
    });

    it('should setup default prompt templates', () => {
      const templates = agent.listPromptTemplates();
      expect(templates).toContain('system');
      
      const systemTemplate = agent.getPromptTemplate('system');
      expect(systemTemplate).toBeDefined();
      expect(systemTemplate?.variables).toContain('agentName');
      expect(systemTemplate?.variables).toContain('personality');
    });
  });

  describe('Response Generation', () => {
    it('should generate helpful responses', async () => {
      const response = await agent.generateResponse('I need help', sampleContext);
      
      expect(response).toContain('I\'m here to help!');
      expect(response).toContain('I need help');
    });

    it('should generate creative responses', async () => {
      agent.updateConfig({ personality: 'creative and innovative' });
      
      const response = await agent.generateResponse('Tell me a story', sampleContext);
      
      expect(response).toContain('interesting thought');
      expect(response).toContain('creatively');
    });

    it('should generate analytical responses', async () => {
      agent.updateConfig({ personality: 'analytical and precise' });
      
      const response = await agent.generateResponse('Analyze this data', sampleContext);
      
      expect(response).toContain('analyze');
      expect(response).toContain('systematic approach');
    });

    it('should generate friendly responses', async () => {
      agent.updateConfig({ personality: 'friendly and warm' });
      
      const response = await agent.generateResponse('Good morning!', sampleContext);
      
      expect(response).toContain('Hi there!');
      expect(response).toContain('happy to chat');
    });

    it('should handle default personality', async () => {
      agent.updateConfig({ personality: undefined });
      
      const response = await agent.generateResponse('Default test', sampleContext);
      
      expect(response).toContain('I understand');
      expect(response).toContain('ready to assist');
    });

    it('should include tool information in responses', async () => {
      const mockTool: ToolDefinition = {
        name: 'test_tool',
        description: 'A test tool',
        parameters: {},
        handler: jest.fn()
      };

      agent.addTool(mockTool);
      
      const response = await agent.generateResponse('What can you do?', sampleContext);
      
      expect(response).toContain('1 tools available');
    });
  });

  describe('Tool Management', () => {
    const sampleTool: ToolDefinition = {
      name: 'calculator',
      description: 'Perform calculations',
      parameters: {
        type: 'object',
        properties: {
          expression: { type: 'string' }
        }
      },
      handler: jest.fn().mockResolvedValue({ result: 42 })
    };

    it('should add tools successfully', () => {
      agent.addTool(sampleTool);
      
      expect(agent.listTools()).toContain('calculator');
      expect(agent.getTool('calculator')).toBe(sampleTool);
    });

    it('should remove tools successfully', () => {
      agent.addTool(sampleTool);
      const removed = agent.removeTool('calculator');
      
      expect(removed).toBe(true);
      expect(agent.listTools()).not.toContain('calculator');
      expect(agent.getTool('calculator')).toBeUndefined();
    });

    it('should return false when removing non-existent tool', () => {
      const removed = agent.removeTool('nonexistent');
      expect(removed).toBe(false);
    });

    it('should list all tools', () => {
      const tool1: ToolDefinition = { name: 'tool1', description: 'Tool 1', parameters: {}, handler: jest.fn() };
      const tool2: ToolDefinition = { name: 'tool2', description: 'Tool 2', parameters: {}, handler: jest.fn() };
      
      agent.addTool(tool1);
      agent.addTool(tool2);
      
      const tools = agent.listTools();
      expect(tools).toHaveLength(2);
      expect(tools).toContain('tool1');
      expect(tools).toContain('tool2');
    });

    it('should execute tools', async () => {
      agent.addTool(sampleTool);
      
      const result = await agent.executeTool('calculator', { expression: '2 + 2' });
      
      expect(sampleTool.handler).toHaveBeenCalledWith({ expression: '2 + 2' });
      expect(result).toEqual({ result: 42 });
    });

    it('should handle tool execution errors', async () => {
      await expect(agent.executeTool('nonexistent', {}))
        .rejects.toThrow("Tool 'nonexistent' not found");
    });
  });

  describe('Prompt Template Management', () => {
    const customTemplate: PromptTemplate = {
      name: 'greeting',
      template: 'Hello {{name}}, welcome to {{system}}!',
      variables: ['name', 'system'],
      description: 'A greeting template'
    };

    it('should add prompt templates', () => {
      agent.setPromptTemplate('greeting', customTemplate);
      
      expect(agent.listPromptTemplates()).toContain('greeting');
      expect(agent.getPromptTemplate('greeting')).toBe(customTemplate);
    });

    it('should list all prompt templates', () => {
      agent.setPromptTemplate('custom', customTemplate);
      
      const templates = agent.listPromptTemplates();
      expect(templates).toContain('system'); // default template
      expect(templates).toContain('custom');
    });

    it('should render templates with variables', () => {
      agent.setPromptTemplate('greeting', customTemplate);
      
      const rendered = agent.renderTemplate('greeting', {
        name: 'Alice',
        system: 'SmallTalk'
      });
      
      expect(rendered).toBe('Hello Alice, welcome to SmallTalk!');
    });

    it('should handle conditional blocks in templates', () => {
      const conditionalTemplate: PromptTemplate = {
        name: 'conditional',
        template: 'Hello {{name}}{{#if title}}, {{title}}{{/if}}!',
        variables: ['name', 'title']
      };
      
      agent.setPromptTemplate('conditional', conditionalTemplate);
      
      const withTitle = agent.renderTemplate('conditional', {
        name: 'Dr. Smith',
        title: 'PhD'
      });
      expect(withTitle).toBe('Hello Dr. Smith, PhD!');
      
      const withoutTitle = agent.renderTemplate('conditional', {
        name: 'John',
        title: ''
      });
      expect(withoutTitle).toBe('Hello John!');
    });

    it('should throw error for missing templates', () => {
      expect(() => {
        agent.renderTemplate('nonexistent', {});
      }).toThrow("Template 'nonexistent' not found");
    });
  });

  describe('Configuration Management', () => {
    it('should get personality', () => {
      expect(agent.getPersonality()).toBe('helpful and friendly');
    });

    it('should get temperature', () => {
      expect(agent.getTemperature()).toBe(0.8);
    });

    it('should get max tokens', () => {
      expect(agent.getMaxTokens()).toBe(1024);
    });

    it('should get system prompt', () => {
      expect(agent.getSystemPrompt()).toBe('You are a test assistant.');
    });

    it('should update configuration', () => {
      agent.updateConfig({
        temperature: 0.5,
        personality: 'analytical and precise'
      });
      
      expect(agent.getTemperature()).toBe(0.5);
      expect(agent.getPersonality()).toBe('analytical and precise');
    });

    it('should handle default temperature', () => {
      const defaultAgent = new MockAgent({ name: 'DefaultAgent' });
      expect(defaultAgent.getTemperature()).toBe(0.7);
    });

    it('should handle default max tokens', () => {
      const defaultAgent = new MockAgent({ name: 'DefaultAgent' });
      expect(defaultAgent.getMaxTokens()).toBe(2048);
    });
  });

  describe('Agent Capabilities', () => {
    it('should report capabilities correctly', () => {
      const capabilities = agent.getCapabilities();
      
      expect(capabilities.toolCount).toBe(0);
      expect(capabilities.templateCount).toBe(1); // system template
      expect(capabilities.hasPersonality).toBe(true);
      expect(capabilities.hasSystemPrompt).toBe(true);
    });

    it('should update capabilities when tools are added', () => {
      const tool: ToolDefinition = {
        name: 'test_tool',
        description: 'Test',
        parameters: {},
        handler: jest.fn()
      };
      
      agent.addTool(tool);
      
      const capabilities = agent.getCapabilities();
      expect(capabilities.toolCount).toBe(1);
    });

    it('should handle agents without personality', () => {
      const basicAgent = new MockAgent({ name: 'BasicAgent' });
      const capabilities = basicAgent.getCapabilities();
      
      expect(capabilities.hasPersonality).toBe(false);
      expect(capabilities.hasSystemPrompt).toBe(false);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle multi-tool agent', async () => {
      const weatherTool: ToolDefinition = {
        name: 'weather',
        description: 'Get weather',
        parameters: {},
        handler: jest.fn().mockResolvedValue({ temp: 20 })
      };
      
      const calculatorTool: ToolDefinition = {
        name: 'calculator',
        description: 'Calculate',
        parameters: {},
        handler: jest.fn().mockResolvedValue({ result: 100 })
      };
      
      agent.addTool(weatherTool);
      agent.addTool(calculatorTool);
      
      const response = await agent.generateResponse('What can you do?', sampleContext);
      expect(response).toContain('2 tools available');
      
      const tools = agent.listTools();
      expect(tools).toContain('weather');
      expect(tools).toContain('calculator');
    });

    it('should handle multiple prompt templates', () => {
      const greetingTemplate: PromptTemplate = {
        name: 'greeting',
        template: 'Hello {{name}}!',
        variables: ['name']
      };
      
      const farewellTemplate: PromptTemplate = {
        name: 'farewell',
        template: 'Goodbye {{name}}, see you later!',
        variables: ['name']
      };
      
      agent.setPromptTemplate('greeting', greetingTemplate);
      agent.setPromptTemplate('farewell', farewellTemplate);
      
      const greeting = agent.renderTemplate('greeting', { name: 'Alice' });
      const farewell = agent.renderTemplate('farewell', { name: 'Alice' });
      
      expect(greeting).toBe('Hello Alice!');
      expect(farewell).toBe('Goodbye Alice, see you later!');
    });

    it('should handle complex configuration updates', () => {
      const initialConfig = { ...agent.config };
      
      agent.updateConfig({
        temperature: 0.2,
        maxTokens: 4096,
        personality: 'very analytical and systematic',
        model: 'gpt-4-turbo'
      });
      
      expect(agent.config.temperature).toBe(0.2);
      expect(agent.config.maxTokens).toBe(4096);
      expect(agent.config.personality).toBe('very analytical and systematic');
      expect(agent.config.model).toBe('gpt-4-turbo');
      
      // Original name should remain unchanged
      expect(agent.config.name).toBe(initialConfig.name);
    });
  });

  describe('Error Handling', () => {
    it('should handle tool execution failures gracefully', async () => {
      const faultyTool: ToolDefinition = {
        name: 'faulty',
        description: 'Faulty tool',
        parameters: {},
        handler: jest.fn().mockRejectedValue(new Error('Tool failure'))
      };
      
      agent.addTool(faultyTool);
      
      await expect(agent.executeTool('faulty', {}))
        .rejects.toThrow('Tool failure');
    });

    it('should handle missing template variables gracefully', () => {
      const template: PromptTemplate = {
        name: 'incomplete',
        template: 'Hello {{name}}, you are {{age}} years old',
        variables: ['name', 'age']
      };
      
      agent.setPromptTemplate('incomplete', template);
      
      // Should not throw, just leave unreplaced placeholders
      const rendered = agent.renderTemplate('incomplete', { name: 'Alice' });
      expect(rendered).toContain('Alice');
      expect(rendered).toContain('{{age}}'); // unreplaced
    });
  });
});