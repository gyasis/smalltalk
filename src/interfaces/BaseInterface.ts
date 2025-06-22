import { EventEmitter } from 'events';
import {
  BaseInterface as IBaseInterface,
  ChatMessage,
  InterfaceConfig
} from '../types/index.js';

export abstract class BaseInterface extends EventEmitter implements IBaseInterface {
  protected config: InterfaceConfig;
  protected isRunning = false;
  protected messageHandler?: (message: string) => Promise<string>;
  protected streamingMessageHandler?: (chunk: string, messageId: string) => void;
  protected interruptionHandler?: (message: string) => void;
  protected framework?: any;
  public supportStreaming: boolean = false;
  public supportInterruption: boolean = false;

  constructor(config: InterfaceConfig) {
    super();
    this.config = config;
  }

  public abstract start(): Promise<void>;
  public abstract stop(): Promise<void>;
  public abstract sendMessage(message: ChatMessage): Promise<void>;

  public onMessage(callback: (message: string) => Promise<string>): void {
    this.messageHandler = callback;
  }

  public onStreamingMessage?(callback: (chunk: string, messageId: string) => void): void {
    this.streamingMessageHandler = callback;
  }

  public onInterruption?(callback: (message: string) => void): void {
    this.interruptionHandler = callback;
  }

  public displayAgentResponse?(event: any): void {
    // Optional method for displaying agent responses during plan execution
    // Interfaces can implement this to show individual agent outputs
  }

  protected async handleIncomingMessage(content: string): Promise<string> {
    if (!this.messageHandler) {
      return 'No message handler configured';
    }

    try {
      return await this.messageHandler(content);
    } catch (error) {
      const errorMessage = `Error processing message: ${error instanceof Error ? error.message : String(error)}`;
      console.error('[BaseInterface]', errorMessage);
      return errorMessage;
    }
  }

  protected handleStreamingMessage(chunk: string, messageId: string): void {
    if (this.streamingMessageHandler) {
      this.streamingMessageHandler(chunk, messageId);
    }
    this.emit('streaming_message', { chunk, messageId });
  }

  protected handleInterruption(message: string): void {
    if (this.interruptionHandler) {
      this.interruptionHandler(message);
    }
    this.emit('interruption', { message });
  }

  public getConfig(): Readonly<InterfaceConfig> {
    return Object.freeze({ ...this.config });
  }

  public updateConfig(newConfig: Partial<InterfaceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('config_updated', this.config);
  }

  public isActive(): boolean {
    return this.isRunning;
  }

  public setFramework(framework: any): void {
    this.framework = framework;
  }

  protected log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.constructor.name}]`;
    
    switch (level) {
      case 'info':
        console.log(`${prefix} ${message}`, data || '');
        break;
      case 'warn':
        console.warn(`${prefix} ${message}`, data || '');
        break;
      case 'error':
        console.error(`${prefix} ${message}`, data || '');
        break;
    }
  }
}