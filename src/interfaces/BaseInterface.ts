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