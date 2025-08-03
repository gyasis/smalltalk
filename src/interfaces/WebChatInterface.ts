import path from 'path';
import { fileURLToPath } from 'url';
import { WebInterface, WebConfig } from './WebInterface.js';
import { ChatMessage } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface WebChatConfig extends WebConfig {
  enableChatUI?: boolean;
  customStaticPath?: string;
  orchestrationMode?: boolean;
}

export interface PlanEvent {
  type: string;
  planId: string;
  stepId?: string;
  timestamp: Date;
  data?: any;
}

export interface StreamingResponse {
  messageId: string;
  chunk: string;
  isComplete: boolean;
  agentName: string;
  stepId?: string;
  planId?: string;
}

export interface NotificationMessage {
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  userId?: string;
  timestamp?: Date;
}

/**
 * WebChatInterface - A complete web chat interface with HTML frontend
 * This extends WebInterface to include the full chat UI with orchestration support
 */
export class WebChatInterface extends WebInterface {
  private chatConfig: WebChatConfig;
  private streamingEnabled: boolean;
  private originalConsole: {
    log: typeof console.log;
    error: typeof console.error;
    warn: typeof console.warn;
    info: typeof console.info;
  };

  constructor(config: WebChatConfig = { type: 'web' }) {
    const chatConfig = {
      enableChatUI: true,
      enableStaticFiles: true,
      staticPath: path.join(__dirname, '../../interfaces/web'),
      orchestrationMode: false,
      ...config
    };

    super(chatConfig);
    this.chatConfig = chatConfig;
    this.streamingEnabled = chatConfig.orchestrationMode || false;
    
    // Enable streaming and interruption support if orchestration is enabled
    this.supportStreaming = this.streamingEnabled;
    this.supportInterruption = this.streamingEnabled;
    
    // Store original console methods
    this.originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info
    };
  }

  protected setupExpress(): void {
    super.setupExpress();
    
    if (this.chatConfig?.orchestrationMode) {
      this.setupOrchestrationEndpoints();
    }
  }

  private setupOrchestrationEndpoints(): void {
    // Plans API endpoint
    this.app.get('/api/plans', (req, res) => {
      try {
        const plans = this.framework?.getActivePlans?.() || [];
        res.json({ plans });
      } catch (error) {
        res.status(500).json({ error: 'Failed to get plans' });
      }
    });

    // Plan control endpoints
    this.app.post('/api/plans/:planId/pause', (req, res) => {
      try {
        const { planId } = req.params;
        const success = this.framework?.pausePlan?.(planId);
        res.json({ success: !!success, planId });
      } catch (error) {
        res.status(500).json({ error: 'Failed to pause plan' });
      }
    });

    this.app.post('/api/plans/:planId/resume', async (req, res) => {
      try {
        const { planId } = req.params;
        const { sessionId, userId } = req.body;
        const success = await this.framework?.resumePlan?.(planId, sessionId || 'web-session', userId || 'web-user');
        res.json({ success: !!success, planId });
      } catch (error) {
        res.status(500).json({ error: 'Failed to resume plan' });
      }
    });

    // Orchestration status endpoint
    this.app.get('/api/orchestration', (req, res) => {
      try {
        const stats = this.framework?.getStats?.();
        res.json({ 
          orchestrationEnabled: this.chatConfig?.orchestrationMode,
          stats: stats?.orchestrationStats || {},
          memoryStats: stats?.memoryStats || {},
          streamingEnabled: this.streamingEnabled
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to get orchestration status' });
      }
    });
  }

  public async start(): Promise<void> {
    await super.start();
    
    // Set up console interception for playground mode
    this.setupConsoleInterception();
    
    if (this.chatConfig?.enableChatUI) {
      const mode = this.chatConfig?.orchestrationMode ? 'with Interactive Orchestration' : 'Simple Mode';
      this.log('info', `Web Chat UI available at http://${this.chatConfig?.host}:${this.chatConfig?.port}`);
      this.log('info', `Full HTML chat interface ${mode}`);
      
      if (this.chatConfig?.orchestrationMode) {
        this.log('info', 'Enhanced features: Plan execution, streaming, interruption support');
      }
    }
  }

  public getUIUrl(): string {
    return `http://${this.chatConfig?.host || 'localhost'}:${this.chatConfig?.port || 3126}`;
  }

  // Enhanced methods for orchestration
  public broadcastPlanEvent(event: PlanEvent): void {
    this.io.emit('plan_event', {
      ...event,
      timestamp: event.timestamp.toISOString()
    });
  }

  public broadcastStreamingResponse(response: StreamingResponse): void {
    if (!this.streamingEnabled) return;
    
    this.io.emit('streaming_response', response);
  }

  public broadcastNotification(notification: NotificationMessage): void {
    this.io.emit('notification', {
      ...notification,
      timestamp: notification.timestamp || new Date()
    });
  }

  public isOrchestrationEnabled(): boolean {
    return this.chatConfig?.orchestrationMode || false;
  }

  // Override sendMessage to support streaming
  public async sendMessage(message: ChatMessage): Promise<void> {
    if (message.streaming && this.streamingEnabled) {
      // Handle streaming message
      this.broadcastStreamingResponse({
        messageId: message.id,
        chunk: message.content,
        isComplete: true,
        agentName: message.agentName || 'assistant',
        stepId: message.stepId,
        planId: message.planId
      });
    } else {
      // Regular message
      this.io.emit('new_message', message);
    }
  }

  // Streaming support implementation
  public onStreamingMessage(callback: (chunk: string, messageId: string) => void): void {
    this.streamingMessageHandler = (chunk: string, messageId: string) => {
      this.broadcastStreamingResponse({
        messageId,
        chunk,
        isComplete: false,
        agentName: 'assistant'
      });
      
      if (callback) {
        callback(chunk, messageId);
      }
    };
  }

  public onInterruption(callback: (message: string) => void): void {
    this.interruptionHandler = callback;
  }

  protected setupSocketIO(): void {
    super.setupSocketIO();
    
    // Add orchestration-specific socket handlers
    if (this.chatConfig?.orchestrationMode) {
      this.io.on('connection', (socket) => {
        // Send orchestration status to new clients
        socket.emit('orchestration_status', {
          enabled: this.chatConfig?.orchestrationMode,
          streamingEnabled: this.streamingEnabled,
          timestamp: new Date().toISOString()
        });

        // Handle plan control from client
        socket.on('pause_plan', (data) => {
          const { planId } = data;
          const success = this.framework?.pausePlan?.(planId);
          socket.emit('plan_paused', { success, planId });
        });

        socket.on('resume_plan', async (data) => {
          const { planId, sessionId, userId } = data;
          const success = await this.framework?.resumePlan?.(planId, sessionId || socket.id, userId || 'web-user');
          socket.emit('plan_resumed', { success, planId });
        });

        // Handle interruption
        socket.on('interrupt_plan', (data) => {
          const { message, planId } = data;
          this.handleInterruption(message);
          socket.emit('interruption_sent', { planId, message });
        });

        // Request current plans
        socket.on('get_plans', () => {
          const plans = this.framework?.getActivePlans?.() || [];
          socket.emit('plans_update', { plans });
        });
      });
    }
  }

  // Console Interception Methods
  private setupConsoleInterception(): void {
    const self = this;
    
    // Intercept console.log
    console.log = (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      
      self.originalConsole.log(...args);
      self.broadcastConsoleLog(new Date().toISOString(), 'Console', message, 'info');
    };

    // Intercept console.error
    console.error = (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      
      self.originalConsole.error(...args);
      self.broadcastConsoleLog(new Date().toISOString(), 'Console', message, 'error');
    };

    // Intercept console.warn
    console.warn = (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      
      self.originalConsole.warn(...args);
      self.broadcastConsoleLog(new Date().toISOString(), 'Console', message, 'warn');
    };

    // Intercept console.info
    console.info = (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      
      self.originalConsole.info(...args);
      self.broadcastConsoleLog(new Date().toISOString(), 'Console', message, 'info');
    };
  }

  private broadcastConsoleLog(timestamp: string, source: string, message: string, level: string): void {
    this.io.emit('console_log', {
      timestamp,
      source,
      message,
      level
    });
  }

  private restoreConsole(): void {
    console.log = this.originalConsole.log;
    console.error = this.originalConsole.error;
    console.warn = this.originalConsole.warn;
    console.info = this.originalConsole.info;
  }

  public displayAgentResponse(event: any): void {
    // Display individual agent responses during plan execution in the web UI
    if (event.type === 'agent_response' && event.response) {
      const message: ChatMessage = {
        id: `plan-${event.planId}-step-${event.stepId}`,
        role: 'assistant',
        content: event.response,
        timestamp: new Date(),
        agentName: event.agentName || 'Agent'
      };
      
      // Broadcast to all connected clients
      this.io.emit('message_response', message);
    }
  }

  public async stop(): Promise<void> {
    // Restore original console methods before stopping
    this.restoreConsole();
    await super.stop();
  }
}