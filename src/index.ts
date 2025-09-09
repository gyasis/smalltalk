import { SmallTalk } from './core/SmallTalk.js';
import { AgentFactory } from './agents/AgentFactory.js';
import { Agent } from './agents/Agent.js';
import { CLIInterface } from './interfaces/CLIInterface.js';
import { WebInterface } from './interfaces/WebInterface.js';
import { WebChatInterface } from './interfaces/WebChatInterface.js';

// Core framework exports
export { SmallTalk } from './core/SmallTalk.js';
export { Chat } from './core/Chat.js';
export { Memory } from './core/Memory.js';
export { MCPClient } from './core/MCPClient.js';

// Orchestration system exports
export { OrchestrationManager } from './core/OrchestrationManager.js';
export { OrchestrationStrategy } from './core/OrchestrationStrategy.js';
export { ReactiveChainOrchestrator } from './core/ReactiveChainOrchestrator.js';
export { TeamCollaborationOrchestrator } from './core/TeamCollaborationOrchestrator.js';

// Agent system exports
export { Agent } from './agents/Agent.js';
export { AgentFactory } from './agents/AgentFactory.js';
export { PromptTemplateManager } from './agents/PromptTemplateManager.js';
export { OrchestratorAgent } from './agents/OrchestratorAgent.js';
export { EnhancedOrchestratorAgent } from './agents/EnhancedOrchestratorAgent.js';
export { InteractiveOrchestratorAgent } from './agents/InteractiveOrchestratorAgent.js';

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
  HistoryManagementConfig,
  ExecutionPlan,
  PlanStep,
  InterruptionContext,
  FlowContext,
  BaseInterface as IBaseInterface,
  Agent as IAgent,
  SmallTalkFramework,
  PlaygroundConfig
} from './types/index.js';

// Orchestration type exports
export type {
  OrchestrationContext,
  OrchestrationDecision,
  ChainEvaluationResult
} from './core/OrchestrationStrategy.js';
export type {
  ChainState
} from './core/ReactiveChainOrchestrator.js';
export type {
  TeamCollaborationPlan
} from './core/TeamCollaborationOrchestrator.js';
export type {
  OrchestrationConfig,
  AgentCapabilities as OrchestrationAgentCapabilities
} from './core/OrchestrationManager.js';

// Re-export commonly used interfaces for convenience
export type { CLIConfig } from './interfaces/CLIInterface.js';
export type { WebChatConfig, PlanEvent, StreamingResponse, NotificationMessage } from './interfaces/WebChatInterface.js';
export type { LLMOptions, LLMResponse } from './utils/TokenJSWrapper.js';
export type { MCPResource, MCPPrompt } from './core/MCPClient.js';
export type { AgentCapabilities, HandoffDecision } from './agents/OrchestratorAgent.js';

// Framework version
export const VERSION = '0.2.0';

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
  orchestrationMode?: boolean;
  enableChatUI?: boolean;
}): WebChatInterface {
  return new WebChatInterface({
    type: 'web',
    enableStaticFiles: true,
    enableChatUI: true,
    orchestrationMode: false,
    ...config
  });
}

// Default export for CommonJS compatibility
export default SmallTalk;