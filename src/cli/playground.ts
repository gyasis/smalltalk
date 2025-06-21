import { resolve } from 'path';
import { pathToFileURL } from 'url';
import chalk from 'chalk';
import { SmallTalk } from '../core/SmallTalk.js';
import { WebChatInterface } from '../interfaces/WebChatInterface.js';
import { PlaygroundConfig } from '../types/index.js';

export interface PlaygroundOptions {
  port?: string;
  host?: string;
  verbose?: boolean;
  [key: string]: any;
}

export async function executePlayground(filePath: string, options: PlaygroundOptions): Promise<void> {
  const resolvedPath = resolve(filePath);
  
  if (options.verbose) {
    console.log(chalk.gray(`Resolving path: ${resolvedPath}`));
  }

  try {
    // Convert file path to URL for dynamic import
    const fileUrl = pathToFileURL(resolvedPath).href;
    
    if (options.verbose) {
      console.log(chalk.gray(`Importing module: ${fileUrl}`));
    }

    // Dynamic import the user's script
    const module = await import(fileUrl);
    
    // Check for default export (SmallTalk instance)
    if (!module.default) {
      throw new Error(
        `Script must export a SmallTalk instance as default export for playground mode.\n\n` +
        `Example:\n` +
        `  const app = new SmallTalk({ ... });\n` +
        `  app.addAgent(myAgent);\n` +
        `  export default app;\n\n` +
        `For CLI mode, use: smalltalk ${filePath}`
      );
    }

    // Check for playgroundConfig export
    if (!module.playgroundConfig) {
      throw new Error(
        `Playground mode requires a 'playgroundConfig' export.\n\n` +
        `Add this to your script:\n` +
        `  export const playgroundConfig = {\n` +
        `    port: 3000,\n` +
        `    host: 'localhost'\n` +
        `  };\n\n` +
        `Or use CLI mode instead: smalltalk ${filePath}`
      );
    }

    const app = module.default;
    const config: PlaygroundConfig = module.playgroundConfig;

    // Validate that it's a SmallTalk instance
    if (!(app instanceof SmallTalk)) {
      throw new Error(
        `Default export must be a SmallTalk instance.\n` +
        `Found: ${typeof app}\n\n` +
        `Make sure to export your configured SmallTalk instance:\n` +
        `  export default app;`
      );
    }

    // Merge configuration (CLI options override config file)
    const finalConfig = {
      port: parseInt(options.port || config.port?.toString() || '3000'),
      host: options.host || config.host || 'localhost',
      orchestrationMode: config.orchestrationMode || false,
      enableChatUI: config.enableChatUI !== false, // default to true
      enableStaticFiles: true,
      cors: config.cors,
      title: config.title,
      description: config.description,
      type: 'web' as const
    };

    if (options.verbose) {
      console.log(chalk.gray('Configuration:'), finalConfig);
    }

    // Create and add WebChat interface
    const webChat = new WebChatInterface(finalConfig);

    // Add interface and start
    app.addInterface(webChat);
    
    console.log(chalk.green('✅ Starting SmallTalk Playground...'));
    console.log(chalk.blue(`🌐 Web Interface: http://${finalConfig.host}:${finalConfig.port}`));
    
    if (config.title) {
      console.log(chalk.gray(`📋 Title: ${config.title}`));
    }
    if (config.description) {
      console.log(chalk.gray(`📝 Description: ${config.description}`));
    }
    
    if (finalConfig.orchestrationMode) {
      console.log(chalk.yellow('🎯 Orchestration mode enabled'));
    }

    console.log();
    console.log(chalk.gray('Press Ctrl+C to stop the server'));

    await app.start();

  } catch (error) {
    if (error instanceof Error) {
      // Check if it's a module not found error
      if (error.message.includes('Cannot resolve module')) {
        throw new Error(
          `File not found: ${filePath}\n\n` +
          `Make sure the file exists and the path is correct.\n` +
          `Current working directory: ${process.cwd()}`
        );
      }
      
      // Check if it's an import error
      if (error.message.includes('SyntaxError') || error.message.includes('import')) {
        throw new Error(
          `Error importing script: ${error.message}\n\n` +
          `Make sure the script is valid TypeScript/JavaScript.\n` +
          `For direct execution, use: npx tsx ${filePath}`
        );
      }

      // Check for port binding errors
      if (error.message.includes('EADDRINUSE')) {
        const port = error.message.match(/port (\d+)/)?.[1] || 'unknown';
        throw new Error(
          `Port ${port} is already in use.\n\n` +
          `Try a different port:\n` +
          `  smalltalk playground ${filePath} --port 3001\n\n` +
          `Or update your playgroundConfig:\n` +
          `  export const playgroundConfig = { port: 3001 };`
        );
      }
    }
    
    throw error;
  }
}

/**
 * Validate playground configuration
 */
export function validatePlaygroundConfig(config: any): PlaygroundConfig {
  if (typeof config !== 'object' || config === null) {
    throw new Error('playgroundConfig must be an object');
  }

  const validated: PlaygroundConfig = {};

  if (config.port !== undefined) {
    const port = parseInt(config.port);
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error('playgroundConfig.port must be a valid port number (1-65535)');
    }
    validated.port = port;
  }

  if (config.host !== undefined) {
    if (typeof config.host !== 'string') {
      throw new Error('playgroundConfig.host must be a string');
    }
    validated.host = config.host;
  }

  if (config.orchestrationMode !== undefined) {
    validated.orchestrationMode = Boolean(config.orchestrationMode);
  }

  if (config.enableChatUI !== undefined) {
    validated.enableChatUI = Boolean(config.enableChatUI);
  }

  if (config.title !== undefined) {
    if (typeof config.title !== 'string') {
      throw new Error('playgroundConfig.title must be a string');
    }
    validated.title = config.title;
  }

  if (config.description !== undefined) {
    if (typeof config.description !== 'string') {
      throw new Error('playgroundConfig.description must be a string');
    }
    validated.description = config.description;
  }

  return validated;
}