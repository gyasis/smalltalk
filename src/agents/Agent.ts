import { EventEmitter } from 'events';
import { nanoid } from 'nanoid';
import fs from 'fs';
import path from 'path';
import {
  Agent as IAgent,
  AgentConfig,
  AgentPersonality,
  PromptTemplate,
  ToolDefinition,
  FlowContext,
  ChatMessage
} from '../types/index.js';
import { TokenJSWrapper } from '../utils/TokenJSWrapper.js';
import { PromptTemplateManager } from './PromptTemplateManager.js';

export class Agent extends EventEmitter implements IAgent {
  public readonly name: string;
  public readonly config: AgentConfig;
  private llmWrapper: TokenJSWrapper;
  private promptManager: PromptTemplateManager;
  private tools: Map<string, ToolDefinition> = new Map();
  private personality?: AgentPersonality;

  constructor(config: AgentConfig) {
    super();
    
    this.config = {
      temperature: 0.7,
      maxTokens: 2048,
      tools: [],
      mcpServers: [],
      promptTemplates: {},
      ...config
    };
    
    this.name = config.name;
    
    // Initialize prompt manager first
    this.promptManager = new PromptTemplateManager();
    
    // Initialize LLM wrapper with agent-specific settings
    this.llmWrapper = new TokenJSWrapper({
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens
    });
    
    // Load prompts from files if specified (after promptManager is ready)
    this.loadPromptsFromFiles();
    this.setupDefaultPrompts();
    
    // Load personality if provided
    if (config.personality) {
      this.loadPersonality(config.personality);
    }
  }

  private setupDefaultPrompts(): void {
    // Default system prompt template
    const defaultSystemPrompt: PromptTemplate = {
      name: 'system',
      template: `You are {{agentName}}, an AI assistant.
{{#if personality}}{{personality}}{{/if}}
{{#if expertise}}You specialize in: {{expertise}}.{{/if}}
{{#if communicationStyle}}Communication style: {{communicationStyle}}.{{/if}}

Please be helpful, accurate, and maintain your personality throughout the conversation.
{{#if tools}}Available tools: {{tools}}.{{/if}}`,
      variables: ['agentName', 'personality', 'expertise', 'communicationStyle', 'tools']
    };

    // Default response template
    const defaultResponsePrompt: PromptTemplate = {
      name: 'response',
      template: `{{#if context}}Previous context: {{context}}{{/if}}

User message: {{userMessage}}

Please respond as {{agentName}} maintaining your personality and expertise.
{{#if availableTools}}You can use these tools if needed: {{availableTools}}.{{/if}}`,
      variables: ['context', 'userMessage', 'agentName', 'availableTools']
    };

    this.promptManager.addTemplate(defaultSystemPrompt);
    this.promptManager.addTemplate(defaultResponsePrompt);
  }

  private loadPersonality(personalityOrString: string | AgentPersonality): void {
    if (typeof personalityOrString === 'string') {
      // Simple personality string
      this.personality = {
        name: this.name,
        description: personalityOrString,
        traits: [],
        communicationStyle: personalityOrString,
        expertise: []
      };
    } else {
      // Full personality object
      this.personality = personalityOrString;
    }

    this.emit('personality_loaded', this.personality);
  }

  private loadPromptsFromFiles(): void {
    // Load system prompt from file
    if (this.config.systemPromptFile) {
      try {
        const filePath = path.resolve(this.config.systemPromptFile);
        this.config.systemPrompt = fs.readFileSync(filePath, 'utf-8');
        if (this.config.systemPrompt) {
          const systemTemplate = this.promptManager.createTemplateFromString('system', this.config.systemPrompt);
          this.promptManager.addTemplate(systemTemplate);
        }
      } catch (error) {
        console.error(`[Agent:${this.name}] Error loading system prompt from ${this.config.systemPromptFile}:`, error);
      }
    }

    // Load prompt templates from files
    if (this.config.promptTemplateFiles) {
      if (!this.config.promptTemplates) {
        this.config.promptTemplates = {};
      }
      for (const [name, templatePath] of Object.entries(this.config.promptTemplateFiles)) {
        try {
          const filePath = path.resolve(templatePath);
          this.config.promptTemplates[name] = fs.readFileSync(filePath, 'utf-8');
          
          // Assuming the template is a simple string for now.
          // For complex templates with variables, we'd need a parsing mechanism.
          const loadedTemplate: PromptTemplate = {
            name,
            template: this.config.promptTemplates[name],
            variables: [] // Placeholder: real implementation would parse variables
          };
          this.setPromptTemplate(name, loadedTemplate);

        } catch (error) {
          console.error(`[Agent:${this.name}] Error loading prompt template '${name}' from ${templatePath}:`, error);
        }
      }
    }
  }

  public async generateResponse(message: string, context: FlowContext): Promise<string> {
    try {
      const systemPrompt = this.buildSystemPrompt();
      const contextMessages = this.prepareContextMessages(context, message);

      const availableTools = Array.from(this.tools.values());

      const response = await this.llmWrapper.generateResponse(
        contextMessages,
        {
          systemPrompt,
          temperature: this.config.temperature,
          maxTokens: this.config.maxTokens,
          tools: this.llmWrapper.convertToolsToTokenJS(availableTools)
        }
      );

      // Handle tool calls if present
      if (response.toolCalls && response.toolCalls.length > 0) {
        return await this.handleToolCalls(response.toolCalls, response.content, context);
      }

      this.emit('response_generated', {
        agentName: this.name,
        message,
        response: response.content,
        context: context.session.id,
        sessionId: context.session.id,
        userId: (context as any).userId || 'default',
        userMessage: message
      });

      return response.content;
    } catch (error) {
      const errorMessage = `Error generating response: ${error instanceof Error ? error.message : String(error)}`;
      this.emit('error', { agentName: this.name, error: errorMessage, context: context.session.id });
      throw error;
    }
  }

  private buildSystemPrompt(): string {
    const variables = {
      agentName: this.name,
      personality: this.personality?.description || this.config.personality,
      expertise: this.personality?.expertise?.join(', ') || '',
      communicationStyle: this.personality?.communicationStyle || '',
      tools: Array.from(this.tools.keys()).join(', ')
    };

    return this.promptManager.renderTemplate('system', variables);
  }

  private prepareContextMessages(context: FlowContext, userMessage: string): ChatMessage[] {
    // Get recent messages from session
    const recentMessages = context.session.messages.slice(-10); // Last 10 messages for context
    
    // Check if this is a handoff situation (different agent than last message)
    const lastMessage = recentMessages[recentMessages.length - 1];
    const isHandoff = lastMessage && lastMessage.agentName && lastMessage.agentName !== this.name;
    
    // If this is a handoff, add context about the conversation history
    const contextualMessages = [...recentMessages];
    if (isHandoff) {
      const handoffContextMessage: ChatMessage = {
        id: nanoid(),
        role: 'system',
        content: `Previous conversation context: The user has been interacting with ${lastMessage.agentName}. Please review the conversation history above and maintain continuity with previous responses while applying your unique expertise to help the user.`,
        timestamp: new Date()
      };
      contextualMessages.push(handoffContextMessage);
    }
    
    // Add current user message
    const currentMessage: ChatMessage = {
      id: nanoid(),
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    };

    return [...contextualMessages, currentMessage];
  }

  private async handleToolCalls(
    toolCalls: Array<{ name: string; parameters: Record<string, unknown> }>, 
    originalResponse: string,
    context: FlowContext
  ): Promise<string> {
    const toolResults: string[] = [];

    for (const toolCall of toolCalls) {
      try {
        let result = await this.llmWrapper.executeToolCall(toolCall, Array.from(this.tools.values()));

        // Check if the result is an MCP tool call delegation
        if (result && typeof result === 'object' && 'tool_name' in result && typeof result.tool_name === 'string' && result.tool_name.startsWith('mcp__')) {
          if (context.mcpClient) {
            const mcpToolName = result.tool_name as string;
            const mcpParameters = ((result as any).parameters || {}) as Record<string, unknown>;
            
            const [_, serverName, toolName] = mcpToolName.split('__');

            if (serverName && toolName) {
              try {
                console.log(`[Agent:${this.name}] Calling MCP tool: ${serverName}.${toolName}`);
                result = await context.mcpClient.executeTool(serverName, toolName, mcpParameters);
              } catch (mcpError) {
                throw new Error(`MCP tool call failed: ${mcpError instanceof Error ? mcpError.message : String(mcpError)}`);
              }
            } else {
              throw new Error(`Invalid MCP tool name format: ${mcpToolName}`);
            }
          } else {
            throw new Error('MCP client is not available to handle MCP tool call.');
          }
        }
        
        toolResults.push(`${toolCall.name}: ${JSON.stringify(result)}`);
        
        this.emit('tool_executed', {
          agentName: this.name,
          toolName: toolCall.name,
          parameters: toolCall.parameters,
          result,
          context: context.session.id
        });
      } catch (error) {
        const errorMsg = `Tool ${toolCall.name} failed: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`[Agent:${this.name}] Tool Error for '${toolCall.name}':`, error);
        toolResults.push(errorMsg);
        
        this.emit('tool_error', {
          agentName: this.name,
          toolName: toolCall.name,
          error: errorMsg,
          context: context.session.id
        });
      }
    }

    // Generate final response incorporating tool results
    const finalPrompt = `${originalResponse}\n\nTool execution results:\n${toolResults.join('\n')}\n\nPlease provide a complete response incorporating these tool results.`;

    const finalResponse = await this.llmWrapper.generateResponse([
      {
        id: nanoid(),
        role: 'user',
        content: finalPrompt,
        timestamp: new Date()
      }
    ], {
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens
    });

    return finalResponse.content;
  }

  public addTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
    this.emit('tool_added', { agentName: this.name, toolName: tool.name });
  }

  public removeTool(toolName: string): boolean {
    const removed = this.tools.delete(toolName);
    if (removed) {
      this.emit('tool_removed', { agentName: this.name, toolName });
    }
    return removed;
  }

  public getTool(toolName: string): ToolDefinition | undefined {
    return this.tools.get(toolName);
  }

  public listTools(): string[] {
    return Array.from(this.tools.keys());
  }

  public setPromptTemplate(name: string, template: PromptTemplate): void {
    this.promptManager.addTemplate(template);
    this.emit('template_added', { agentName: this.name, templateName: name });
  }

  public getPromptTemplate(name: string): PromptTemplate | undefined {
    return this.promptManager.getTemplate(name);
  }

  public setPersonality(personality: AgentPersonality): void {
    this.personality = personality;
    this.emit('personality_updated', { agentName: this.name, personality });
  }

  public getPersonality(): AgentPersonality | undefined {
    return this.personality;
  }

  public updateConfig(newConfig: Partial<AgentConfig>): void {
    Object.assign(this.config, newConfig);
    
    // Update LLM wrapper if temperature or maxTokens changed
    if (newConfig.temperature !== undefined || newConfig.maxTokens !== undefined) {
      this.llmWrapper.updateConfig({
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens
      });
    }

    this.emit('config_updated', { agentName: this.name, config: this.config });
  }

  public clone(newName: string, configOverrides: Partial<AgentConfig> = {}): Agent {
    const clonedConfig: AgentConfig = {
      ...this.config,
      ...configOverrides,
      name: newName
    };

    const clonedAgent = new Agent(clonedConfig);

    // Copy tools
    for (const tool of this.tools.values()) {
      clonedAgent.addTool(tool);
    }

    // Copy personality
    if (this.personality) {
      clonedAgent.setPersonality({ ...this.personality, name: newName });
    }

    // Copy custom prompt templates
    const templates = this.promptManager.listTemplates();
    for (const templateName of templates) {
      const template = this.promptManager.getTemplate(templateName);
      if (template && !['system', 'response'].includes(templateName)) {
        clonedAgent.setPromptTemplate(templateName, template);
      }
    }

    this.emit('agent_cloned', {
      originalName: this.name,
      clonedName: newName,
      config: clonedConfig
    });

    return clonedAgent;
  }

  public getStats(): {
    name: string;
    toolCount: number;
    templateCount: number;
    hasPersonality: boolean;
    config: AgentConfig;
  } {
    return {
      name: this.name,
      toolCount: this.tools.size,
      templateCount: this.promptManager.listTemplates().length,
      hasPersonality: !!this.personality,
      config: { ...this.config }
    };
  }

  public toJSON(): {
    name: string;
    config: AgentConfig;
    personality?: AgentPersonality;
    tools: string[];
    templates: string[];
  } {
    return {
      name: this.name,
      config: this.config,
      personality: this.personality,
      tools: this.listTools(),
      templates: this.promptManager.listTemplates()
    };
  }
}