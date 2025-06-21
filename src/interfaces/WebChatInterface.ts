import path from 'path';
import { fileURLToPath } from 'url';
import { WebInterface, WebConfig } from './WebInterface.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface WebChatConfig extends WebConfig {
  enableChatUI?: boolean;
  customStaticPath?: string;
}

/**
 * WebChatInterface - A complete web chat interface with HTML frontend
 * This extends WebInterface to include the full chat UI
 */
export class WebChatInterface extends WebInterface {
  private chatConfig: WebChatConfig;

  constructor(config: WebChatConfig = { type: 'web' }) {
    const chatConfig = {
      enableChatUI: true,
      staticPath: path.join(__dirname, '../../interfaces/web'),
      ...config
    };

    super(chatConfig);
    this.chatConfig = chatConfig;
  }

  public async start(): Promise<void> {
    await super.start();
    
    if (this.chatConfig.enableChatUI) {
      this.log('info', `Web Chat UI available at http://${this.chatConfig.host}:${this.chatConfig.port}`);
      this.log('info', 'Full HTML chat interface with agent switching and real-time messaging');
    }
  }

  public getUIUrl(): string {
    return `http://${this.chatConfig.host}:${this.chatConfig.port}`;
  }
}