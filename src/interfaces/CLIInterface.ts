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

    switch (cmd.toLowerCase()) {
      case 'help':
        this.displayHelp();
        break;

      case 'quit':
      case 'exit':
        console.log(chalk.yellow('Goodbye!'));
        await this.stop();
        process.exit(0);
        break;

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

  private displayMessage(message: ChatMessage): void {
    const timestamp = this.cliConfig.showTimestamps 
      ? chalk.gray(`[${message.timestamp.toLocaleTimeString()}] `)
      : '';
    
    const agentName = this.cliConfig.showAgentNames && message.agentName
      ? chalk.magenta(`[${message.agentName}] `)
      : '';

    let colorFn: chalk.Chalk;
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
}