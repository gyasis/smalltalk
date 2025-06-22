import * as readline from 'readline';
import chalk from 'chalk';
import { BaseInterface } from './BaseInterface.js';
import { ChatMessage, InterfaceConfig } from '../types/index.js';

export interface CLIConfig extends InterfaceConfig {
  prompt?: string;
  colors?: {
    user?: string;
    assistant?: string;
    system?: string;
    error?: string;
  };
  showTimestamps?: boolean;
  showAgentNames?: boolean;
}

export class CLIInterface extends BaseInterface {
  private rl?: readline.Interface;
  private cliConfig: CLIConfig;
  private customCommandHandlers: Map<string, (args: string[], rawCommand: string) => Promise<void> | void> = new Map();
  private streamingBuffer: Map<string, string> = new Map();
  private isProcessingInput = false;

  constructor(config: CLIConfig = { type: 'cli' }) {
    super(config);
    
    this.cliConfig = {
      prompt: '> ',
      colors: {
        user: 'cyan',
        assistant: 'green',
        system: 'yellow',
        error: 'red'
      },
      showTimestamps: false,
      showAgentNames: true,
      ...config
    };
    
    // Enable streaming and interruption support
    this.supportStreaming = true;
    this.supportInterruption = true;
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.cliConfig.prompt
    });

    this.setupReadlineHandlers();
    this.displayWelcome();
    this.isRunning = true;
    
    this.log('info', 'CLI interface started');
    this.emit('interface_started');
    
    this.rl.prompt();
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    if (this.rl) {
      this.rl.close();
      this.rl = undefined;
    }

    this.isRunning = false;
    this.log('info', 'CLI interface stopped');
    this.emit('interface_stopped');
  }

  public async sendMessage(message: ChatMessage): Promise<void> {
    this.displayMessage(message);
  }

  private setupReadlineHandlers(): void {
    if (!this.rl) return;

    this.rl.on('line', async (input: string) => {
      const trimmed = input.trim();
      
      if (trimmed === '') {
        this.rl!.prompt();
        return;
      }

      // Handle special commands
      if (trimmed.startsWith('/')) {
        await this.handleCommand(trimmed);
        this.rl!.prompt();
        return;
      }

      // Display user message
      this.displayMessage({
        id: 'user-input',
        role: 'user',
        content: trimmed,
        timestamp: new Date()
      });

      // Process message and display response
      try {
        const response = await this.handleIncomingMessage(trimmed);
        
        this.displayMessage({
          id: 'assistant-response',
          role: 'assistant',
          content: response,
          timestamp: new Date()
        });
      } catch (error) {
        this.displayError(`Failed to process message: ${error instanceof Error ? error.message : String(error)}`);
      }

      this.rl!.prompt();
    });

    this.rl.on('SIGINT', () => {
      console.log(chalk.yellow('\nGracefully shutting down...'));
      this.stop().then(() => process.exit(0));
    });

    this.rl.on('close', () => {
      console.log(chalk.yellow('Goodbye!'));
      this.stop();
    });
  }

  private async handleCommand(command: string): Promise<void> {
    const [cmd, ...args] = command.slice(1).split(' ');
    // Custom command handlers take precedence
    const customHandler = this.customCommandHandlers.get(cmd.toLowerCase());
    if (customHandler) {
      await customHandler(args, command);
      return;
    }
    switch (cmd.toLowerCase()) {
      case 'help':
        this.displayHelp();
        break;
      case 'quit':
      case 'exit':
        console.log(chalk.yellow('Goodbye!'));
        await this.stop();
        process.exit(0);
      case 'clear':
        console.clear();
        this.displayWelcome();
        break;
      case 'agent':
        if (args.length === 0) {
          console.log(chalk.yellow('Usage: /agent <agent_name>'));
        } else {
          const agentName = args[0];
          const response = await this.handleIncomingMessage(`/agent ${agentName}`);
          console.log(chalk.green(response));
        }
        break;
      case 'config':
        this.displayConfig();
        break;
      case 'timestamp':
        this.cliConfig.showTimestamps = !this.cliConfig.showTimestamps;
        console.log(chalk.yellow(`Timestamps ${this.cliConfig.showTimestamps ? 'enabled' : 'disabled'}`));
        break;
      default:
        console.log(chalk.red(`Unknown command: ${cmd}. Type /help for available commands.`));
    }
  }

  /**
   * Register a custom command for the CLI interface (e.g., `/stats`).
   * Handler receives (args: string[], rawCommand: string)
   */
  public registerCommand(cmd: string, handler: (args: string[], command: string) => Promise<void> | void) {
    this.customCommandHandlers.set(cmd.toLowerCase(), handler);
  }

  private displayMessage(message: ChatMessage): void {
    const timestamp = this.cliConfig.showTimestamps 
      ? chalk.gray(`[${message.timestamp.toLocaleTimeString()}] `)
      : '';
    
    const agentName = this.cliConfig.showAgentNames && message.agentName
      ? chalk.magenta(`[${message.agentName}] `)
      : '';

    let colorFn: typeof chalk;
    let prefix: string;

    switch (message.role) {
      case 'user':
        colorFn = chalk.hex(this.cliConfig.colors?.user || '#00FFFF');
        prefix = 'You';
        break;
      case 'assistant':
      case 'agent':
        colorFn = chalk.hex(this.cliConfig.colors?.assistant || '#00FF00');
        prefix = message.agentName || 'Assistant';
        break;
      case 'system':
        colorFn = chalk.hex(this.cliConfig.colors?.system || '#FFFF00');
        prefix = 'System';
        break;
      default:
        colorFn = chalk.white;
        prefix = 'Unknown';
    }

    const formattedContent = this.formatContent(message.content);
    console.log(`${timestamp}${agentName}${colorFn.bold(prefix + ':')} ${formattedContent}`);
  }

  private formatContent(content: string): string {
    // Handle code blocks
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let formatted = content.replace(codeBlockRegex, (match, language, code) => {
      const lang = language ? chalk.gray(`[${language}]`) : '';
      return `\n${lang}\n${chalk.bgBlack(code.trim())}\n`;
    });

    // Handle inline code
    const inlineCodeRegex = /`([^`]+)`/g;
    formatted = formatted.replace(inlineCodeRegex, (match, code) => {
      return chalk.bgGray.black(code);
    });

    return formatted;
  }

  private displayError(message: string): void {
    const errorColor = chalk.hex(this.cliConfig.colors?.error || '#FF0000');
    console.log(errorColor.bold('Error: ') + errorColor(message));
  }

  private displayWelcome(): void {
    console.log(chalk.bold.blue('🗣️  SmallTalk CLI Interface'));
    console.log(chalk.gray('Type your message and press Enter to chat.'));
    console.log(chalk.gray('Type /help for available commands.'));
    console.log(chalk.gray('─'.repeat(50)));
  }

  private displayHelp(): void {
    console.log(chalk.bold.yellow('\nAvailable Commands:'));
    console.log(chalk.cyan('/help') + '           - Show this help message');
    console.log(chalk.cyan('/agent <name>') + '   - Switch to a specific agent');
    console.log(chalk.cyan('/clear') + '          - Clear the screen');
    console.log(chalk.cyan('/config') + '         - Show current configuration');
    console.log(chalk.cyan('/timestamp') + '      - Toggle timestamp display');
    console.log(chalk.cyan('/quit, /exit') + '    - Exit the application');
    console.log(chalk.gray('─'.repeat(50)));
  }

  private displayConfig(): void {
    console.log(chalk.bold.yellow('\nCurrent Configuration:'));
    console.log(chalk.cyan('Interface:') + '      CLI');
    console.log(chalk.cyan('Prompt:') + '         ' + this.cliConfig.prompt);
    console.log(chalk.cyan('Timestamps:') + '     ' + (this.cliConfig.showTimestamps ? 'Enabled' : 'Disabled'));
    console.log(chalk.cyan('Agent Names:') + '    ' + (this.cliConfig.showAgentNames ? 'Enabled' : 'Disabled'));
    console.log(chalk.gray('─'.repeat(50)));
  }

  public setPrompt(newPrompt: string): void {
    this.cliConfig.prompt = newPrompt;
    if (this.rl) {
      this.rl.setPrompt(newPrompt);
    }
  }

  public toggleTimestamps(): void {
    this.cliConfig.showTimestamps = !this.cliConfig.showTimestamps;
  }

  public toggleAgentNames(): void {
    this.cliConfig.showAgentNames = !this.cliConfig.showAgentNames;
  }

  public setColors(colors: Partial<CLIConfig['colors']>): void {
    this.cliConfig.colors = { ...this.cliConfig.colors, ...colors };
  }

  // Enhanced streaming support
  public onStreamingMessage(callback: (chunk: string, messageId: string) => void): void {
    this.streamingMessageHandler = callback;
    
    // Override the default behavior to handle real-time streaming
    this.streamingMessageHandler = (chunk: string, messageId: string) => {
      if (!this.streamingBuffer.has(messageId)) {
        this.streamingBuffer.set(messageId, '');
        // Start new streaming message
        process.stdout.write(chalk.green.bold('Assistant: '));
      }
      
      // Append chunk to buffer and display
      const currentBuffer = this.streamingBuffer.get(messageId) || '';
      this.streamingBuffer.set(messageId, currentBuffer + chunk);
      process.stdout.write(chunk);
      
      // Check if message is complete (this would need to be indicated by the streaming system)
      // For now, we'll end the line after a reasonable pause
      if (callback) {
        callback(chunk, messageId);
      }
    };
  }

  public onInterruption(callback: (message: string) => void): void {
    this.interruptionHandler = callback;
  }

  public displayPlanEvent(event: any): void {
    switch (event.type) {
      case 'plan_created':
        console.log(chalk.blue(`\n📋 New plan created: ${event.planId.slice(0, 8)}...`));
        break;
      case 'step_started':
        if (event.data?.step) {
          console.log(chalk.blue(`▶️  Step: ${event.data.step.agentName} - ${event.data.step.action.slice(0, 50)}...`));
        }
        break;
      case 'step_completed':
        console.log(chalk.green(`✅ Step completed`));
        break;
      case 'plan_completed':
        console.log(chalk.green(`\n🎉 Plan completed: ${event.planId.slice(0, 8)}...`));
        break;
      case 'user_interrupted':
        console.log(chalk.yellow(`\n⚡ Plan paused for user input`));
        break;
      case 'plan_paused':
        console.log(chalk.yellow(`\n⏸️  Plan paused: ${event.planId.slice(0, 8)}...`));
        break;
    }
  }

  public displayAgentResponse(event: any): void {
    // Display individual agent responses during plan execution
    if (event.type === 'agent_response' && event.response) {
      const agentName = event.agentName || 'Agent';
      const timestamp = this.cliConfig.showTimestamps ? 
        chalk.gray(`[${new Date().toLocaleTimeString()}] `) : '';
      
      // Display the agent response with proper formatting
      console.log(`\n${timestamp}🤖 ${chalk.green(agentName)}: ${event.response}`);
    }
  }
}