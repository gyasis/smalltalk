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
    maxAutoResponses?: number;
    enableInterruption?: boolean;
    streamResponses?: boolean;
  };
  historyManagement?: HistoryManagementConfig;
}

export interface AgentConfig {
  name: string;
  model?: string;
  personality?: string;
  systemPrompt?: string;
  systemPromptFile?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: string[];
  mcpServers?: string[];
  promptTemplates?: Record<string, string>;
  promptTemplateFiles?: Record<string, string>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'agent';
  content: string;
  timestamp: Date;
  agentName?: string;
  metadata?: Record<string, unknown>;
  streaming?: boolean;
  planId?: string;
  stepId?: string;
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

export interface HistoryManagementConfig {
  strategy: 'full' | 'sliding_window' | 'summarization' | 'hybrid' | 'vector_retrieval';
  maxMessages?: number;
  slidingWindowSize?: number;
  summaryModel?: string;
  summaryInterval?: number;
  contextSize?: number;
  vectorStoreConfig?: {
    provider: string;
    model: string;
    chunkSize: number;
    overlapSize: number;
  };
}

export interface ExecutionPlan {
  id: string;
  steps: PlanStep[];
  currentStepIndex: number;
  status: 'pending' | 'executing' | 'paused' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  userIntent: string;
  expectedOutcome: string;
  metadata?: Record<string, unknown>;
}

export interface PlanStep {
  id: string;
  agentName: string;
  action: string;
  parameters: Record<string, unknown>;
  expectedOutput: string;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  output?: string;
  error?: string;
}

export interface InterruptionContext {
  planId: string;
  currentStepIndex: number;
  userMessage: string;
  timestamp: Date;
  sessionId: string;
  userId: string;
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
  setFramework(framework: any): void;
  onStreamingMessage?(callback: (chunk: string, messageId: string) => void): void;
  onInterruption?(callback: (message: string) => void): void;
  supportStreaming?: boolean;
  supportInterruption?: boolean;
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

// CLI Execution Model Types
export interface PlaygroundConfig {
  port?: number;
  host?: string;
  cors?: any;
  orchestrationMode?: boolean;
  enableChatUI?: boolean;
  title?: string;
  description?: string;
}

// Agent Manifest Types
export interface AgentManifest {
  config: AgentConfig;
  capabilities?: AgentCapabilities;
  metadata?: AgentManifestMetadata;
}

export interface AgentCapabilities {
  expertise?: string[];
  tools?: string[];
  personalityTraits?: string[];
  taskTypes?: string[];
  complexity?: 'basic' | 'intermediate' | 'advanced' | 'expert';
  contextAwareness?: number;
  collaborationStyle?: string;
}

export interface AgentManifestMetadata {
  version?: string;
  author?: string;
  description?: string;
  tags?: string[];
  created?: string;
  updated?: string;
}

export interface ManifestValidationError {
  field: string;
  message: string;
  value?: any;
}