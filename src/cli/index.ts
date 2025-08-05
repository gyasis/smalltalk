#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { executeScript } from './executor.js';
import { executePlayground } from './playground.js';

// Get version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packagePath = join(__dirname, '../../package.json');
const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
const version = packageJson.version;

const program = new Command();

program
  .name('smalltalk')
  .description('A unified CLI tool for running SmallTalk agent scripts')
  .version(version);

// Default command: smalltalk <file> [args...]
program
  .argument('<file>', 'Path to the SmallTalk script file')
  .option('-v, --verbose', 'Enable verbose output')
  .action(async (file: string, options: any) => {
    try {
      console.log(chalk.blue('🎯 SmallTalk CLI Mode'));
      console.log(chalk.gray(`Running: ${file}`));
      await executeScript(file, { mode: 'cli', ...options });
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Playground command: smalltalk playground <file> [args...]
program
  .command('playground')
  .argument('<file>', 'Path to the SmallTalk script file')
  .option('-p, --port <number>', 'Port number for the web interface')
  .option('-h, --host <string>', 'Host address for the web interface', 'localhost')
  .option('-v, --verbose', 'Enable verbose output')
  .description('Run the script in web playground mode')
  .action(async (file: string, options: any) => {
    try {
      console.log(chalk.green('🌐 SmallTalk Playground Mode'));
      console.log(chalk.gray(`Running: ${file}`));
      await executePlayground(file, options);
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Help command
program
  .command('help')
  .description('Show help information')
  .action(() => {
    console.log(chalk.blue('🎯 SmallTalk - LLM Agent Framework'));
    console.log();
    console.log('Usage:');
    console.log('  smalltalk <file>              Run script in CLI mode');
    console.log('  smalltalk playground <file>   Run script in web playground mode');
    console.log();
    console.log('Examples:');
    console.log('  smalltalk examples/language-tutor.ts');
    console.log('  smalltalk playground examples/language-tutor.ts');
    console.log('  smalltalk playground examples/orchestrator-demo.ts --port 4000');
    console.log();
    console.log('Requirements:');
    console.log('• CLI mode: Script must export a SmallTalk instance as default export');
    console.log('• Playground mode: Script must also export a playgroundConfig object');
    console.log();
    console.log('Agent Commands:');
    console.log('• /agent <name> - Switch to specific agent (supports hyphens and underscores)');
    console.log('• Examples: /agent orchestrator, /agent research-assistant, /agent code_reviewer');
    console.log();
    console.log('For more information, visit: https://github.com/your-org/smalltalk');
  });

// Global error handler
process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('❌ Unhandled rejection at:'), promise, chalk.red('reason:'), reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error(chalk.red('❌ Uncaught exception:'), error);
  process.exit(1);
});

// Parse and execute
program.parse(process.argv);

// If no arguments provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}