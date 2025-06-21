export interface SmallTalkConfig {
  llmProvider?: string;
  model?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  debugMode?: boolean;
  orchestration?: boolean;
  orchestrationConfig?: {
    contextSensitivity?: number;
    switchThreshold?: number;
    satisfactionWeight?: number;
    maxSwitchesPerConversation?: number;
    learningRate?: number;
  };
}

export interface AgentConfig {
  name: string;
  personality?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: string[];
  mcpServers?: string[];
  promptTemplates?: Record<string, string>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'agent';
  content: string;
  timestamp: Date;
  agentName?: string;
  metadata?: Record<string, unknown>;
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  activeAgent?: string;
  context?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface InterfaceConfig {
  type: 'web' | 'cli' | 'custom';
  port?: number;
  host?: string;
  theme?: string;
  customStyles?: string;
}

export interface MCPServerConfig {
  name: string;
  type: 'stdio' | 'http';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (params: Record<string, unknown>) => Promise<unknown>;
}

export interface PromptTemplate {
  name: string;
  template: string;
  variables: string[];
  description?: string;
}

export interface MemoryConfig {
  maxMessages?: number;
  truncationStrategy?: 'sliding_window' | 'summarization' | 'hybrid';
  summaryModel?: string;
  contextSize?: number;
}

export interface AgentPersonality {
  name: string;
  description: string;
  traits: string[];
  communicationStyle: string;
  expertise: string[];
  examples?: string[];
}

export type EventCallback = (data: unknown) => void | Promise<void>;

export interface EventEmitter {
  on(event: string, callback: EventCallback): void;
  emit(event: string, data?: unknown): void;
  off(event: string, callback: EventCallback): void;
}

export interface BaseInterface {
  start(): Promise<void>;
  stop(): Promise<void>;
  sendMessage(message: ChatMessage): Promise<void>;
  onMessage(callback: (message: string) => Promise<string>): void;
}

export interface FlowContext {
  session: ChatSession;
  message: ChatMessage;
  agent?: Agent;
  tools?: ToolDefinition[];
  config: SmallTalkConfig;
}

export interface Agent {
  name: string;
  config: AgentConfig;
  generateResponse(message: string, context: FlowContext): Promise<string>;
  addTool(tool: ToolDefinition): void;
  setPromptTemplate(name: string, template: PromptTemplate): void;
}

export interface SmallTalkFramework {
  addAgent(agent: Agent): void;
  addInterface(iface: BaseInterface): void;
  enableMCP(servers: MCPServerConfig[]): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
}