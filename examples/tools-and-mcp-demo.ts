/**
 * 🛠️ SmallTalk Tools & MCP Integration Demo
 *
 * This comprehensive example demonstrates how SmallTalk agents can leverage both:
 * 1. Custom Tools - Functions you define directly in your application
 * 2. MCP Servers - External services that provide tools via Model Context Protocol
 *
 * This creates a powerful hybrid approach where agents have access to both 
 * local capabilities and external services.
 */

import { SmallTalk } from '../src/core/SmallTalk.js';
import { Agent } from '../src/agents/Agent.js';
import { CLIInterface } from '../src/interfaces/CLIInterface.js';
import { PlaygroundConfig } from '../src/types/index.js';
import { promises as fs } from 'fs';
import path from 'path';

// Playground configuration
export const playgroundConfig: PlaygroundConfig = {
  port: 3127,
  host: 'localhost',
  title: '🛠️ SmallTalk Tools & MCP Demo',
  description: 'Comprehensive demonstration of custom tools and MCP server integration',
  orchestrationMode: true,
  enableChatUI: true
};

// ===============================
// CUSTOM TOOLS DEFINITIONS
// ===============================

// 1. Calculator Tool - Local computation
const calculatorTool = {
  name: 'calculate',
  description: 'Perform mathematical calculations and analysis',
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'Mathematical expression to evaluate (e.g., "2 + 3 * 4", "sqrt(16)", "sin(pi/2)")'
      },
      precision: {
        type: 'number',
        description: 'Number of decimal places for result',
        default: 2
      }
    },
    required: ['expression']
  },
  handler: async ({ expression, precision = 2 }) => {
    try {
      // Enhanced calculator with more math functions
      const mathContext = {
        sin: Math.sin, cos: Math.cos, tan: Math.tan,
        sqrt: Math.sqrt, pow: Math.pow, log: Math.log,
        pi: Math.PI, e: Math.E,
        abs: Math.abs, floor: Math.floor, ceil: Math.ceil, round: Math.round
      };

      // Create safe evaluation function
      const func = new Function('context', `
        with (context) {
          return ${expression};
        }
      `);

      const result = func(mathContext);
      const roundedResult = Number(result.toFixed(precision));

      return {
        expression,
        result: roundedResult,
        precision,
        type: typeof result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        expression,
        error: `Invalid expression: ${error.message}`,
        success: false
      };
    }
  }
};

// 2. Project Analysis Tool - Local file system analysis
const projectAnalysisTool = {
  name: 'analyzeProject',
  description: 'Analyze project structure, dependencies, and metrics',
  parameters: {
    type: 'object',
    properties: {
      analysisType: {
        type: 'string',
        enum: ['structure', 'dependencies', 'metrics', 'full'],
        description: 'Type of analysis to perform'
      },
      directory: {
        type: 'string',
        description: 'Directory to analyze (relative to project root)',
        default: '.'
      }
    },
    required: ['analysisType']
  },
  handler: async ({ analysisType, directory = '.' }) => {
    try {
      const targetDir = path.resolve(process.cwd(), directory);
      
      // Security check
      if (!targetDir.startsWith(process.cwd())) {
        throw new Error('Access denied: Directory outside project scope');
      }

      const analysis = {
        directory,
        analysisType,
        timestamp: new Date().toISOString(),
        results: {}
      };

      switch (analysisType) {
        case 'structure':
          analysis.results = await analyzeProjectStructure(targetDir);
          break;
        case 'dependencies':
          analysis.results = await analyzeDependencies(targetDir);
          break;
        case 'metrics':
          analysis.results = await analyzeProjectMetrics(targetDir);
          break;
        case 'full':
          analysis.results = {
            structure: await analyzeProjectStructure(targetDir),
            dependencies: await analyzeDependencies(targetDir),
            metrics: await analyzeProjectMetrics(targetDir)
          };
          break;
      }

      return analysis;
    } catch (error) {
      return {
        analysisType,
        directory,
        error: error.message,
        success: false
      };
    }
  }
};

// 3. Data Processing Tool - Transform and analyze data
const dataProcessingTool = {
  name: 'processData',
  description: 'Process and transform data with various operations',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['parse', 'filter', 'aggregate', 'transform', 'validate'],
        description: 'Data processing operation'
      },
      data: {
        type: 'string',
        description: 'Data to process (JSON string or CSV format)'
      },
      options: {
        type: 'object',
        description: 'Processing options (varies by operation)',
        properties: {
          format: { type: 'string', enum: ['json', 'csv'] },
          filterKey: { type: 'string' },
          filterValue: { type: 'string' },
          aggregateField: { type: 'string' },
          aggregateMethod: { type: 'string', enum: ['sum', 'avg', 'count', 'min', 'max'] }
        }
      }
    },
    required: ['operation', 'data']
  },
  handler: async ({ operation, data, options = {} }) => {
    try {
      let parsedData;

      // Parse input data
      if (options.format === 'csv') {
        parsedData = parseCSV(data);
      } else {
        parsedData = JSON.parse(data);
      }

      let result;

      switch (operation) {
        case 'parse':
          result = { parsed: parsedData, count: Array.isArray(parsedData) ? parsedData.length : 1 };
          break;

        case 'filter':
          if (!Array.isArray(parsedData)) throw new Error('Filter requires array data');
          result = parsedData.filter(item => 
            item[options.filterKey] === options.filterValue
          );
          break;

        case 'aggregate':
          if (!Array.isArray(parsedData)) throw new Error('Aggregate requires array data');
          result = aggregateData(parsedData, options.aggregateField, options.aggregateMethod);
          break;

        case 'transform':
          result = transformData(parsedData, options);
          break;

        case 'validate':
          result = validateData(parsedData, options);
          break;

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }

      return {
        operation,
        success: true,
        inputCount: Array.isArray(parsedData) ? parsedData.length : 1,
        outputCount: Array.isArray(result) ? result.length : 1,
        result,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        operation,
        error: error.message,
        success: false
      };
    }
  }
};

// ===============================
// MCP SERVER CONFIGURATIONS
// ===============================

const mcpServerConfigs = [
  // Context7 - Real-time documentation
  {
    name: 'context7',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@upstash/context7-mcp@latest'],
    description: 'Real-time library documentation server'
  },
  
  // Filesystem - File operations (if available)
  {
    name: 'filesystem',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
    description: 'File system operations server'
  },

  // Web Search - Brave search (requires API key)
  ...(process.env.BRAVE_API_KEY ? [{
    name: 'brave-search',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    env: { BRAVE_API_KEY: process.env.BRAVE_API_KEY },
    description: 'Web search capabilities'
  }] : []),

  // GitHub integration (requires token)
  ...(process.env.GITHUB_TOKEN ? [{
    name: 'github',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN },
    description: 'GitHub repository management'
  }] : [])
];

// ===============================
// AGENT DEFINITIONS
// ===============================

// Full Stack Developer - Uses both custom tools and MCP servers
const fullStackDeveloper = new Agent({
  name: 'Full Stack Developer',
  personality: 'experienced, practical, thorough, up-to-date',
  expertise: ['web development', 'project analysis', 'documentation', 'best practices'],
  systemPrompt: `You are a Full Stack Developer with access to both local tools and external services:

  🔧 CUSTOM TOOLS:
  - calculate: Mathematical computations and algorithm analysis
  - analyzeProject: Project structure and dependency analysis
  - processData: Data transformation and analysis

  🌐 MCP SERVERS:
  - context7: Real-time library documentation and examples
  - filesystem: File operations and management
  - brave-search: Web search for current information
  - github: Repository management and operations

  🎯 YOUR APPROACH:
  1. Use analyzeProject to understand codebases
  2. Use context7 for latest API documentation
  3. Use calculate for performance and complexity analysis
  4. Use processData for configuration and data files
  5. Use filesystem for reading/writing project files
  6. Use brave-search for researching best practices
  7. Use github for repository operations

  Always explain which tools you're using and why. Combine local analysis with up-to-date documentation.`,

  tools: [calculatorTool, projectAnalysisTool, dataProcessingTool]
});

// Research Data Analyst - Focuses on data analysis and research
const dataAnalyst = new Agent({
  name: 'Research Data Analyst',
  personality: 'analytical, thorough, detail-oriented, methodical',
  expertise: ['data analysis', 'research', 'statistics', 'reporting'],
  systemPrompt: `You are a Research Data Analyst with comprehensive analysis capabilities:

  📊 ANALYSIS TOOLS:
  - calculate: Statistical calculations and mathematical analysis
  - processData: Data cleaning, transformation, and aggregation
  - analyzeProject: Code and project metrics analysis

  🔍 RESEARCH TOOLS:
  - context7: Latest documentation for data science libraries
  - brave-search: Current research and industry trends
  - filesystem: Data file management and processing

  📋 WORKFLOW:
  1. Analyze data structure and quality
  2. Research current methodologies and best practices
  3. Apply appropriate statistical methods
  4. Generate comprehensive reports with visualizations
  5. Validate findings against current literature

  Focus on data-driven insights and evidence-based conclusions.`,

  tools: [calculatorTool, dataProcessingTool, projectAnalysisTool]
});

// DevOps Engineer - Infrastructure and automation focused
const devOpsEngineer = new Agent({
  name: 'DevOps Engineer',
  personality: 'systematic, reliable, automation-focused, proactive',
  expertise: ['infrastructure', 'automation', 'monitoring', 'deployment'],
  systemPrompt: `You are a DevOps Engineer with infrastructure and automation tools:

  🛠️ INFRASTRUCTURE TOOLS:
  - analyzeProject: System architecture and dependency analysis
  - calculate: Resource planning and capacity calculations
  - processData: Configuration file processing and validation

  🔗 INTEGRATION TOOLS:
  - github: Repository management and CI/CD operations
  - filesystem: Configuration and script management
  - context7: Latest DevOps tool documentation

  🎯 FOCUS AREAS:
  1. Infrastructure as Code (IaC)
  2. Automated deployment pipelines
  3. Monitoring and alerting systems
  4. Security and compliance
  5. Performance optimization
  6. Cost optimization

  Emphasize automation, reliability, and best practices in all recommendations.`,

  tools: [calculatorTool, projectAnalysisTool, dataProcessingTool]
});

// ===============================
// HELPER FUNCTIONS
// ===============================

async function analyzeProjectStructure(directory: string) {
  const structure = {
    directories: [],
    files: [],
    extensions: {},
    totalSize: 0
  };

  async function scan(dir: string, depth = 0) {
    if (depth > 3) return; // Limit recursion depth

    try {
      const items = await fs.readdir(dir);
      
      for (const item of items) {
        if (item.startsWith('.')) continue; // Skip hidden files
        
        const fullPath = path.join(dir, item);
        const stats = await fs.stat(fullPath);
        const relativePath = path.relative(directory, fullPath);

        if (stats.isDirectory()) {
          structure.directories.push(relativePath);
          await scan(fullPath, depth + 1);
        } else {
          const ext = path.extname(item).toLowerCase();
          structure.files.push(relativePath);
          structure.extensions[ext] = (structure.extensions[ext] || 0) + 1;
          structure.totalSize += stats.size;
        }
      }
    } catch (error) {
      // Skip inaccessible directories
    }
  }

  await scan(directory);
  return structure;
}

async function analyzeDependencies(directory: string) {
  const dependencies = {
    packageJson: null,
    nodeModules: false,
    lockFiles: []
  };

  try {
    // Check for package.json
    const packageJsonPath = path.join(directory, 'package.json');
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      dependencies.packageJson = {
        name: packageJson.name,
        version: packageJson.version,
        dependencies: Object.keys(packageJson.dependencies || {}),
        devDependencies: Object.keys(packageJson.devDependencies || {}),
        scripts: Object.keys(packageJson.scripts || {})
      };
    } catch {
      // No package.json
    }

    // Check for node_modules
    try {
      await fs.access(path.join(directory, 'node_modules'));
      dependencies.nodeModules = true;
    } catch {
      // No node_modules
    }

    // Check for lock files
    const lockFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
    for (const lockFile of lockFiles) {
      try {
        await fs.access(path.join(directory, lockFile));
        dependencies.lockFiles.push(lockFile);
      } catch {
        // Lock file not found
      }
    }
  } catch (error) {
    // Handle errors
  }

  return dependencies;
}

async function analyzeProjectMetrics(directory: string) {
  const metrics = {
    codeFiles: 0,
    totalLines: 0,
    languages: {},
    configFiles: 0,
    testFiles: 0
  };

  const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.go', '.rs'];
  const configExtensions = ['.json', '.yaml', '.yml', '.toml', '.ini', '.conf'];
  const testPatterns = ['.test.', '.spec.', 'test/', 'tests/', '__tests__/'];

  async function analyzeFile(filePath: string) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n').length;
      const ext = path.extname(filePath).toLowerCase();
      const fileName = path.basename(filePath).toLowerCase();

      if (codeExtensions.includes(ext)) {
        metrics.codeFiles++;
        metrics.totalLines += lines;
        metrics.languages[ext] = (metrics.languages[ext] || 0) + 1;
      }

      if (configExtensions.includes(ext)) {
        metrics.configFiles++;
      }

      if (testPatterns.some(pattern => fileName.includes(pattern) || filePath.includes(pattern))) {
        metrics.testFiles++;
      }
    } catch (error) {
      // Skip files that can't be read
    }
  }

  // Analyze files
  const structure = await analyzeProjectStructure(directory);
  for (const file of structure.files) {
    await analyzeFile(path.join(directory, file));
  }

  return metrics;
}

function parseCSV(csvData: string) {
  const lines = csvData.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });
    return obj;
  });
}

function aggregateData(data: any[], field: string, method: string) {
  const values = data.map(item => parseFloat(item[field])).filter(v => !isNaN(v));
  
  switch (method) {
    case 'sum': return values.reduce((a, b) => a + b, 0);
    case 'avg': return values.reduce((a, b) => a + b, 0) / values.length;
    case 'count': return values.length;
    case 'min': return Math.min(...values);
    case 'max': return Math.max(...values);
    default: return null;
  }
}

function transformData(data: any, options: any) {
  // Simple transformation example
  if (Array.isArray(data)) {
    return data.map(item => ({
      ...item,
      _transformed: true,
      _timestamp: new Date().toISOString()
    }));
  }
  return { ...data, _transformed: true, _timestamp: new Date().toISOString() };
}

function validateData(data: any, options: any) {
  const validation = {
    isValid: true,
    errors: [],
    warnings: [],
    summary: {}
  };

  if (Array.isArray(data)) {
    validation.summary.totalRecords = data.length;
    validation.summary.hasEmptyValues = data.some(item => 
      Object.values(item).some(value => value === '' || value === null || value === undefined)
    );
  }

  return validation;
}

// ===============================
// MAIN APPLICATION SETUP
// ===============================

async function createToolsAndMCPDemo() {
  console.log('🛠️ Initializing SmallTalk Tools & MCP Demo');
  console.log('============================================');

  // Create SmallTalk instance
  const app = new SmallTalk({
    llmProvider: 'openai',
    model: 'gpt-4o',
    orchestration: true,
    debugMode: true
  });

  // Initialize MCP servers
  console.log('\n🔌 Connecting to MCP Servers...');
  let connectedServers = 0;
  let totalServers = mcpServerConfigs.length;

  for (const serverConfig of mcpServerConfigs) {
    try {
      await app.addMCPServer(serverConfig);
      console.log(`✅ Connected: ${serverConfig.name} - ${serverConfig.description}`);
      connectedServers++;
    } catch (error) {
      console.log(`⚠️  Failed: ${serverConfig.name} - ${error.message}`);
    }
  }

  console.log(`\n📊 MCP Status: ${connectedServers}/${totalServers} servers connected`);

  // Add agents
  app.addAgent(fullStackDeveloper);
  app.addAgent(dataAnalyst);
  app.addAgent(devOpsEngineer);

  // Add CLI interface
  const cli = new CLIInterface({
    prompt: '🛠️  Tools & MCP Demo: ',
    colors: true,
    historySize: 100
  });
  app.addInterface(cli);

  // Enhanced event listeners
  app.on('tool_executed', (data) => {
    console.log(`\n🔧 Custom Tool: ${data.toolName} (${data.agentName})`);
    if (data.result?.error) {
      console.log(`   ❌ Error: ${data.result.error}`);
    } else {
      console.log(`   ✅ Success`);
    }
  });

  app.on('mcp_tool_executed', (data) => {
    console.log(`\n🌐 MCP Tool: ${data.serverName}:${data.toolName} (${data.agentName})`);
  });

  app.on('agent_handoff', (data) => {
    console.log(`\n🎯 Agent Switch: ${data.fromAgent || 'none'} → ${data.toAgent}`);
    console.log(`   Reason: ${data.reason} (${(data.confidence * 100).toFixed(0)}% confidence)`);
  });

  // CLI Commands
  cli.registerCommand('tools', () => {
    console.log('\n🔧 Available Custom Tools:');
    console.log('   • calculate: Mathematical computations');
    console.log('   • analyzeProject: Project structure analysis');
    console.log('   • processData: Data transformation and analysis');
    
    const mcpStats = app.getMCPStats();
    if (mcpStats.connectedServers > 0) {
      console.log(`\n🌐 Connected MCP Servers: ${mcpStats.serverNames.join(', ')}`);
      console.log(`   Total MCP Tools: ${mcpStats.totalTools || 'Unknown'}`);
    }
    console.log('');
  });

  cli.registerCommand('analyze', async () => {
    console.log('\n📊 Running project analysis...');
    try {
      const result = await projectAnalysisTool.handler({ 
        analysisType: 'full', 
        directory: '.' 
      });
      
      console.log(`   Files: ${result.results.structure?.files?.length || 0}`);
      console.log(`   Directories: ${result.results.structure?.directories?.length || 0}`);
      console.log(`   Dependencies: ${result.results.dependencies?.packageJson?.dependencies?.length || 0}`);
      console.log(`   Code Files: ${result.results.metrics?.codeFiles || 0}`);
      console.log(`   Total Lines: ${result.results.metrics?.totalLines || 0}`);
    } catch (error) {
      console.log(`   ❌ Analysis failed: ${error.message}`);
    }
    console.log('');
  });

  cli.registerCommand('mcp', () => {
    const stats = app.getMCPStats();
    console.log('\n🌐 MCP Server Status:');
    console.log(`   Connected: ${stats.connectedServers}`);
    console.log(`   Servers: ${stats.serverNames.join(', ') || 'None'}`);
    console.log(`   Available: ${stats.isConnected ? 'Yes' : 'No'}`);
    console.log('');
  });

  return app;
}

// Export for SmallTalk CLI
async function initializeApp() {
  return await createToolsAndMCPDemo();
}

export default initializeApp;

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    // Check if we're in playground mode
    if (process.env.SMALLTALK_PLAYGROUND_MODE === 'true') {
      const app = await createToolsAndMCPDemo();
      
      const { WebChatInterface } = await import('../src/index.js');
      
      const port = process.env.SMALLTALK_PLAYGROUND_PORT 
        ? parseInt(process.env.SMALLTALK_PLAYGROUND_PORT) 
        : playgroundConfig.port || 3127;
      const host = process.env.SMALLTALK_PLAYGROUND_HOST || playgroundConfig.host || 'localhost';
      
      const webChat = new WebChatInterface({
        port,
        host,
        cors: { origin: '*' },
        orchestrationMode: playgroundConfig.orchestrationMode || false,
        enableChatUI: playgroundConfig.enableChatUI !== false,
        title: playgroundConfig.title,
        description: playgroundConfig.description
      });
      
      app.addInterface(webChat);
      
      console.log('\n🚀 Starting Tools & MCP Playground...');
      console.log(`🌐 Web Interface: http://${host}:${port}`);
      console.log(`📋 Title: ${playgroundConfig.title}`);
      console.log(`📝 Description: ${playgroundConfig.description}`);
      
      await app.start();
    } else {
      // CLI mode
      const app = await initializeApp();
      
      console.log('\n🎯 SmallTalk Tools & MCP Integration Demo');
      console.log('==========================================');
      
      console.log('\n🤖 Available Agents:');
      app.listAgents().forEach(agentName => {
        const agent = app.getAgent(agentName);
        console.log(`   • ${agentName}: ${agent?.config.expertise?.join(', ')}`);
      });

      console.log('\n💡 Example Queries:');
      console.log('   🧮 CALCULATIONS:');
      console.log('     • "Calculate the compound interest: 1000 * pow(1.05, 10)"');
      console.log('     • "What\'s the time complexity of quicksort?"');
      
      console.log('\n   📊 PROJECT ANALYSIS:');
      console.log('     • "Analyze this project structure and dependencies"');
      console.log('     • "What are the code metrics for this project?"');
      
      console.log('\n   🔍 RESEARCH & DOCUMENTATION:');
      console.log('     • "Look up the latest React 18 concurrent features"');
      console.log('     • "Search for Node.js performance best practices"');
      
      console.log('\n   📁 DATA PROCESSING:');
      console.log('     • "Process this CSV data and calculate averages"');
      console.log('     • "Transform this JSON data and validate it"');

      console.log('\n🎛️ Available Commands:');
      console.log('   • /tools - Show available tools and MCP servers');
      console.log('   • /analyze - Quick project analysis');
      console.log('   • /mcp - MCP server status');
      console.log('   • /stats - System statistics');

      console.log('\n🚀 Ready! Try combining custom tools with MCP server capabilities!');
      
      await app.start();
    }
  })().catch(console.error);
}