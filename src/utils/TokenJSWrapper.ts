import { TokenJS, ChatCompletionTool } from 'token.js';
import { ChatMessage, ToolDefinition, SmallTalkConfig } from '../types/index.js';

export interface LLMOptions {
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  tools?: ChatCompletionTool[];
  systemPrompt?: string;
}

export interface LLMResponse {
  content: string;
  toolCalls?: Array<{
    name: string;
    parameters: Record<string, unknown>;
  }>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class TokenJSWrapper {
  private tokenjs: TokenJS;
  private config: SmallTalkConfig;

  constructor(config: SmallTalkConfig) {
    this.config = config;
    this.tokenjs = new TokenJS();
  }

  public async generateResponse(
    messages: ChatMessage[],
    options: LLMOptions = {}
  ): Promise<LLMResponse> {
    const provider = options.provider || this.config.llmProvider || 'openai';
    const model = options.model || this.config.model || 'gpt-4o';
    const temperature = options.temperature ?? this.config.temperature ?? 0.7;
    const maxTokens = options.maxTokens || this.config.maxTokens || 2048;

    // Convert SmallTalk messages to TokenJS format
    const formattedMessages = this.formatMessages(messages, options.systemPrompt);

    try {
      const completion = await this.tokenjs.chat.completions.create({
        provider: provider as any,
        model: model as any,
        messages: formattedMessages,
        temperature,
        max_tokens: maxTokens,
        stream: options.stream || false,
        tools: options.tools,
        tool_choice: options.tools ? 'auto' : undefined,
      });

      if (options.stream) {
        throw new Error('Streaming responses not yet implemented in wrapper');
      }

      const choice = completion.choices[0];
      if (!choice) {
        throw new Error('No response generated from LLM');
      }

      const response: LLMResponse = {
        content: choice.message.content || '',
      };

      // Handle tool calls if present
      if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
        response.toolCalls = choice.message.tool_calls.map(toolCall => ({
          name: toolCall.function.name,
          parameters: typeof toolCall.function.arguments === 'string' 
            ? JSON.parse(toolCall.function.arguments)
            : toolCall.function.arguments
        }));
      }

      // Add usage information if available
      if (completion.usage) {
        response.usage = {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        };
      }

      return response;
    } catch (error) {
      console.error('[TokenJSWrapper] Error generating response:', error);
      throw new Error(`LLM generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public async generateStreamResponse(
    messages: ChatMessage[],
    options: LLMOptions = {},
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    const provider = options.provider || this.config.llmProvider || 'openai';
    const model = options.model || this.config.model || 'gpt-4o';
    const temperature = options.temperature ?? this.config.temperature ?? 0.7;
    const maxTokens = options.maxTokens || this.config.maxTokens || 2048;

    const formattedMessages = this.formatMessages(messages, options.systemPrompt);

    try {
      const stream = await this.tokenjs.chat.completions.create({
        provider: provider as any,
        model: model as any,
        messages: formattedMessages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
        tools: options.tools,
        tool_choice: options.tools ? 'auto' : undefined,
      });

      let fullContent = '';

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          fullContent += delta.content;
          if (onChunk) {
            onChunk(delta.content);
          }
        }
      }

      return fullContent;
    } catch (error) {
      console.error('[TokenJSWrapper] Error in stream generation:', error);
      throw new Error(`LLM stream generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public convertToolsToTokenJS(tools: ToolDefinition[]): ChatCompletionTool[] {
    return tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters as Record<string, unknown>,
      }
    }));
  }

  public async executeToolCall(
    toolCall: { name: string; parameters: Record<string, unknown> },
    availableTools: ToolDefinition[]
  ): Promise<unknown> {
    const tool = availableTools.find(t => t.name === toolCall.name);
    if (!tool) {
      throw new Error(`Tool '${toolCall.name}' not found`);
    }

    try {
      return await tool.handler(toolCall.parameters);
    } catch (error) {
      console.error(`[TokenJSWrapper] Tool execution error for '${toolCall.name}':`, error);
      throw new Error(`Tool '${toolCall.name}' execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private formatMessages(messages: ChatMessage[], systemPrompt?: string): Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }> {
    const formatted: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string;
    }> = [];

    // Add system prompt if provided
    if (systemPrompt) {
      formatted.push({
        role: 'system',
        content: systemPrompt
      });
    }

    // Convert messages
    for (const message of messages) {
      let role: 'system' | 'user' | 'assistant';
      
      switch (message.role) {
        case 'user':
          role = 'user';
          break;
        case 'assistant':
        case 'agent':
          role = 'assistant';
          break;
        case 'system':
          role = 'system';
          break;
        default:
          role = 'user'; // fallback
      }

      formatted.push({
        role,
        content: message.content
      });
    }

    return formatted;
  }

  public async testConnection(provider?: string, model?: string): Promise<boolean> {
    try {
      const testResponse = await this.generateResponse([
        {
          id: 'test',
          role: 'user',
          content: 'Hello',
          timestamp: new Date()
        }
      ], {
        provider: provider || this.config.llmProvider,
        model: model || this.config.model,
        maxTokens: 10
      });

      return testResponse.content.length > 0;
    } catch (error) {
      console.error('[TokenJSWrapper] Connection test failed:', error);
      return false;
    }
  }

  public getSupportedProviders(): string[] {
    return [
      'openai',
      'anthropic', 
      'gemini',
      'cohere',
      'mistral',
      'groq',
      'perplexity',
      'openrouter',
      'bedrock',
      'ai21'
    ];
  }

  public getProviderCapabilities(provider: string): {
    streaming: boolean;
    json: boolean;
    toolCalls: boolean;
    images: boolean;
  } {
    const capabilities: Record<string, { streaming: boolean; json: boolean; toolCalls: boolean; images: boolean }> = {
      openai: { streaming: true, json: true, toolCalls: true, images: true },
      anthropic: { streaming: true, json: true, toolCalls: true, images: true },
      bedrock: { streaming: true, json: true, toolCalls: true, images: true },
      mistral: { streaming: true, json: true, toolCalls: true, images: false },
      cohere: { streaming: true, json: false, toolCalls: true, images: false },
      ai21: { streaming: true, json: false, toolCalls: false, images: false },
      gemini: { streaming: true, json: true, toolCalls: true, images: true },
      groq: { streaming: true, json: true, toolCalls: false, images: false },
      perplexity: { streaming: true, json: false, toolCalls: false, images: false },
      openrouter: { streaming: true, json: true, toolCalls: true, images: true }
    };

    return capabilities[provider] || { streaming: false, json: false, toolCalls: false, images: false };
  }

  public getProviderModels(provider: string): string[] {
    // This would ideally come from Token.js itself
    // For now, providing common models for each provider
    const providerModels: Record<string, string[]> = {
      openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
      anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
      gemini: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'],
      cohere: ['command-r-plus', 'command-r', 'command'],
      mistral: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'],
      groq: ['llama3-8b-8192', 'llama3-70b-8192', 'mixtral-8x7b-32768'],
      perplexity: ['llama-3.1-sonar-small-128k-online', 'llama-3.1-sonar-large-128k-online'],
      openrouter: ['openai/gpt-4o', 'anthropic/claude-3-5-sonnet', 'meta-llama/llama-3.1-8b-instruct'],
      bedrock: ['anthropic.claude-3-sonnet-20240229-v1:0', 'anthropic.claude-3-haiku-20240307-v1:0'],
      ai21: ['jamba-instruct', 'j2-ultra', 'j2-mid']
    };

    return providerModels[provider] || [];
  }

  // 🚀 NEW: Token.js Advanced Features

  public extendModel(
    provider: string,
    modelName: string,
    featureSupport: string | {
      streaming?: boolean;
      json?: boolean;
      toolCalls?: boolean;
      images?: boolean;
    }
  ): void {
    try {
      this.tokenjs.extendModelList(provider, modelName, featureSupport);
      console.log(`[TokenJSWrapper] Extended model: ${provider}:${modelName}`);
    } catch (error) {
      console.error(`[TokenJSWrapper] Failed to extend model ${provider}:${modelName}:`, error);
    }
  }

  public async generateWithJSONMode(
    messages: ChatMessage[],
    options: LLMOptions = {},
    schema?: Record<string, unknown>
  ): Promise<any> {
    const provider = options.provider || this.config.llmProvider || 'openai';
    const model = options.model || this.config.model || 'gpt-4o';
    const temperature = options.temperature ?? this.config.temperature ?? 0.7;
    const maxTokens = options.maxTokens || this.config.maxTokens || 2048;

    const formattedMessages = this.formatMessages(messages, options.systemPrompt);

    try {
      const completion = await this.tokenjs.chat.completions.create({
        provider: provider as any,
        model: model as any,
        messages: formattedMessages,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        ...(schema && { response_schema: schema })
      });

      const choice = completion.choices[0];
      if (!choice) {
        throw new Error('No response generated from LLM');
      }

      return JSON.parse(choice.message.content || '{}');
    } catch (error) {
      console.error('[TokenJSWrapper] JSON mode generation failed:', error);
      if (error instanceof Error && error.message.includes('JSON')) {
        return { error: 'Invalid JSON response', rawContent: error.message };
      }
      throw new Error(`JSON mode generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public async generateWithImages(
    messages: ChatMessage[],
    imageInputs: Array<{ url?: string; base64?: string; detail?: 'low' | 'high' | 'auto' }>,
    options: LLMOptions = {}
  ): Promise<LLMResponse> {
    const provider = options.provider || this.config.llmProvider || 'openai';
    const model = options.model || this.config.model || 'gpt-4o';
    const temperature = options.temperature ?? this.config.temperature ?? 0.7;
    const maxTokens = options.maxTokens || this.config.maxTokens || 2048;

    // Validate provider supports images
    const imageCapableProviders = ['openai', 'anthropic', 'bedrock', 'gemini', 'openrouter'];
    if (!imageCapableProviders.includes(provider)) {
      throw new Error(`Provider '${provider}' does not support image inputs`);
    }

    // Format messages with images for Token.js vision models
    const formattedMessages = messages.map((msg, index) => {
      if (msg.role === 'user' && index === messages.length - 1 && imageInputs.length > 0) {
        // Add images to the last user message
        const content = [
          { type: 'text', text: msg.content }
        ];

        imageInputs.forEach(img => {
          if (img.url) {
            content.push({
              type: 'image_url',
              image_url: {
                url: img.url,
                detail: img.detail || 'auto'
              }
            });
          } else if (img.base64) {
            content.push({
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${img.base64}`,
                detail: img.detail || 'auto'
              }
            });
          }
        });

        return {
          role: msg.role,
          content
        };
      }
      
      return {
        role: msg.role,
        content: msg.content
      };
    });

    try {
      const completion = await this.tokenjs.chat.completions.create({
        provider: provider as any,
        model: model as any,
        messages: formattedMessages as any,
        temperature,
        max_tokens: maxTokens,
        tools: options.tools,
        tool_choice: options.tools ? 'auto' : undefined,
      });

      const choice = completion.choices[0];
      if (!choice) {
        throw new Error('No response generated from vision model');
      }

      const response: LLMResponse = {
        content: choice.message.content || '',
      };

      // Handle tool calls if present
      if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
        response.toolCalls = choice.message.tool_calls.map(toolCall => ({
          name: toolCall.function.name,
          parameters: typeof toolCall.function.arguments === 'string' 
            ? JSON.parse(toolCall.function.arguments)
            : toolCall.function.arguments
        }));
      }

      // Add usage information if available
      if (completion.usage) {
        response.usage = {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        };
      }

      return response;
    } catch (error) {
      console.error('[TokenJSWrapper] Vision generation failed:', error);
      throw new Error(`Vision generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public getTokenJSInstance(): TokenJS {
    return this.tokenjs;
  }

  public updateConfig(newConfig: Partial<SmallTalkConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // 🔧 Token.js Model Management
  public async validateModel(provider: string, model: string): Promise<boolean> {
    try {
      const testResponse = await this.tokenjs.chat.completions.create({
        provider: provider as any,
        model: model as any,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1
      });
      return !!testResponse.choices[0];
    } catch (error) {
      console.warn(`[TokenJSWrapper] Model validation failed for ${provider}:${model}:`, error);
      return false;
    }
  }

  public async generateWithRetry(
    messages: ChatMessage[],
    options: LLMOptions = {},
    maxRetries: number = 3
  ): Promise<LLMResponse> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.generateResponse(messages, options);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`[TokenJSWrapper] Attempt ${attempt}/${maxRetries} failed:`, lastError.message);
        
        if (attempt < maxRetries) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }
    
    throw new Error(`All ${maxRetries} attempts failed. Last error: ${lastError?.message}`);
  }

  public async batchGenerate(
    requests: Array<{ messages: ChatMessage[]; options?: LLMOptions }>,
    concurrency: number = 3
  ): Promise<LLMResponse[]> {
    const results: LLMResponse[] = [];
    
    for (let i = 0; i < requests.length; i += concurrency) {
      const batch = requests.slice(i, i + concurrency);
      const batchPromises = batch.map(request => 
        this.generateResponse(request.messages, request.options || {})
      );
      
      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      } catch (error) {
        console.error(`[TokenJSWrapper] Batch ${Math.floor(i / concurrency) + 1} failed:`, error);
        // Fill with error responses
        batch.forEach(() => {
          results.push({
            content: '',
            toolCalls: [],
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
          });
        });
      }
    }
    
    return results;
  }

  // 📊 Token.js Monitoring & Analytics
  public async getModelInfo(provider: string, model: string): Promise<{
    contextLength?: number;
    inputCostPer1k?: number;
    outputCostPer1k?: number;
    capabilities: { streaming: boolean; json: boolean; toolCalls: boolean; images: boolean };
  }> {
    const capabilities = this.getProviderCapabilities(provider);
    
    // This would ideally come from Token.js model registry
    // For now, providing common model info
    const modelInfo: Record<string, any> = {
      'gpt-4o': { contextLength: 128000, inputCostPer1k: 0.005, outputCostPer1k: 0.015 },
      'gpt-4o-mini': { contextLength: 128000, inputCostPer1k: 0.00015, outputCostPer1k: 0.0006 },
      'claude-3-5-sonnet-20241022': { contextLength: 200000, inputCostPer1k: 0.003, outputCostPer1k: 0.015 },
      'claude-3-5-haiku-20241022': { contextLength: 200000, inputCostPer1k: 0.0008, outputCostPer1k: 0.004 },
      'gemini-1.5-pro': { contextLength: 2000000, inputCostPer1k: 0.0035, outputCostPer1k: 0.0105 },
      'gemini-1.5-flash': { contextLength: 1000000, inputCostPer1k: 0.000075, outputCostPer1k: 0.0003 }
    };
    
    return {
      ...modelInfo[model],
      capabilities
    };
  }
}