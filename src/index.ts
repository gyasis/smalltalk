// Core framework exports
export { SmallTalk } from './core/SmallTalk.js';
export { Chat } from './core/Chat.js';
export { Memory } from './core/Memory.js';
export { MCPClient } from './core/MCPClient.js';

// Agent system exports
export { Agent } from './agents/Agent.js';
export { AgentFactory } from './agents/AgentFactory.js';
export { PromptTemplateManager } from './agents/PromptTemplateManager.js';

// Interface exports
export { BaseInterface } from './interfaces/BaseInterface.js';
export { CLIInterface } from './interfaces/CLIInterface.js';
export { WebInterface } from './interfaces/WebInterface.js';
export { WebChatInterface } from './interfaces/WebChatInterface.js';

// Utility exports
export { TokenJSWrapper } from './utils/TokenJSWrapper.js';

// Type exports
export type {
  SmallTalkConfig,
  AgentConfig,
  AgentPersonality,
  ChatMessage,
  ChatSession,
  InterfaceConfig,
  MCPServerConfig,
  ToolDefinition,
  PromptTemplate,
  MemoryConfig,
  FlowContext,
  BaseInterface as IBaseInterface,
  Agent as IAgent,
  SmallTalkFramework
} from './types/index.js';

// Re-export commonly used interfaces for convenience
export type { CLIConfig } from './interfaces/CLIInterface.js';
export type { LLMOptions, LLMResponse } from './utils/TokenJSWrapper.js';
export type { MCPResource, MCPPrompt } from './core/MCPClient.js';

// Framework version
export const VERSION = '0.1.0';

// Quick start helper function
export function createSmallTalk(config?: {
  llmProvider?: string;
  model?: string;
  apiKey?: string;
  debugMode?: boolean;
}): SmallTalk {
  return new SmallTalk(config);
}

// Agent creation helpers
export function createAgent(name: string, personality: string, options?: {
  temperature?: number;
  maxTokens?: number;
  tools?: string[];
}): Agent {
  return AgentFactory.createSimple(name, personality, options);
}

export function createCodingAgent(name?: string, languages?: string[]): Agent {
  return AgentFactory.createCodingAssistant(name, languages);
}

export function createWritingAgent(
  name?: string, 
  style?: 'creative' | 'technical' | 'academic' | 'casual'
): Agent {
  return AgentFactory.createWritingAssistant(name, style);
}

// Interface creation helpers
export function createCLI(config?: {
  prompt?: string;
  colors?: Record<string, string>;
  showTimestamps?: boolean;
}): CLIInterface {
  return new CLIInterface({
    type: 'cli',
    ...config
  });
}

// Web interface helpers
export function createWebAPI(config?: {
  port?: number;
  host?: string;
  cors?: any;
}): WebInterface {
  return new WebInterface({
    type: 'web',
    apiOnly: true,
    ...config
  });
}

export function createWebChat(config?: {
  port?: number;
  host?: string;
  cors?: any;
}): WebChatInterface {
  return new WebChatInterface({
    type: 'web',
    enableStaticFiles: true,
    ...config
  });
}

// Default export for CommonJS compatibility
export default SmallTalk;