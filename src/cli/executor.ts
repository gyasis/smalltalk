import { resolve, extname } from 'path';
import { pathToFileURL } from 'url';
import { spawn } from 'child_process';
import chalk from 'chalk';
import { SmallTalk } from '../core/SmallTalk.js';
import { CLIInterface } from '../interfaces/CLIInterface.js';

export interface ExecutionOptions {
  mode: 'cli' | 'playground';
  verbose?: boolean;
  port?: string;
  [key: string]: any;
}

export async function executeScript(filePath: string, options: ExecutionOptions): Promise<void> {
  const resolvedPath = resolve(filePath);
  
  if (options.verbose) {
    console.log(chalk.gray(`Resolving path: ${resolvedPath}`));
  }

  // Check if it's a TypeScript file
  const ext = extname(resolvedPath);
  if (ext === '.ts') {
    // For TypeScript files, delegate to tsx
    return executeWithTsx(resolvedPath, options);
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
        `Script must export a SmallTalk instance as default export.\n\n` +
        `Example:\n` +
        `  const app = new SmallTalk({ ... });\n` +
        `  app.addAgent(myAgent);\n` +
        `  export default app;\n\n` +
        `For backward compatibility, you can also use:\n` +
        `  npx tsx ${filePath}`
      );
    }

    const app = module.default;

    // Validate that it's a SmallTalk instance
    if (!(app instanceof SmallTalk)) {
      throw new Error(
        `Default export must be a SmallTalk instance.\n` +
        `Found: ${typeof app}\n\n` +
        `Make sure to export your configured SmallTalk instance:\n` +
        `  export default app;`
      );
    }

    // Check if the script already has interfaces or has been started
    if (hasBeenConfigured(app)) {
      if (options.verbose) {
        console.log(chalk.yellow('⚠️  Script appears to be already configured for direct execution.'));
        console.log(chalk.yellow('   This is normal for backward compatibility.'));
      }
    }

    // Create and add CLI interface
    const cli = new CLIInterface({
      type: 'cli',
      prompt: '> ',
      colors: {
        user: 'cyan',
        assistant: 'green',
        system: 'yellow'
      },
      showTimestamps: false
    });

    // Add interface and start
    app.addInterface(cli);
    
    console.log(chalk.green('✅ Starting SmallTalk CLI...'));
    if (options.verbose) {
      console.log(chalk.gray('Interface configured, calling app.start()'));
    }

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
    }
    
    throw error;
  }
}

/**
 * Check if the SmallTalk instance has already been configured
 * This helps with backward compatibility detection
 */
function hasBeenConfigured(app: SmallTalk): boolean {
  try {
    // Check if interfaces have been added or if app has been started
    // This is a heuristic to detect scripts that were designed for direct execution
    const interfaces = (app as any).interfaces;
    return interfaces && interfaces.length > 0;
  } catch {
    return false;
  }
}

/**
 * Execute TypeScript files using tsx
 */
async function executeWithTsx(filePath: string, options: ExecutionOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    if (options.verbose) {
      console.log(chalk.gray(`Executing TypeScript file with tsx: ${filePath}`));
    }

    const child = spawn('npx', ['tsx', filePath], {
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });

    child.on('error', (error) => {
      if (error.message.includes('ENOENT')) {
        reject(new Error(
          `tsx not found. Please ensure tsx is installed:\n` +
          `  npm install -g tsx\n` +
          `Or run directly: npx tsx ${filePath}`
        ));
      } else {
        reject(error);
      }
    });
  });
}