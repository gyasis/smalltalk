import { SmallTalk, CLIInterface } from '../src/index.js';

async function createManifestDemo() {
  // Example demonstrating the new manifest-based agent configuration
  const app = new SmallTalk({
    llmProvider: 'openai',
    model: 'gpt-4o',
    debugMode: true,
    orchestration: true
  });

  // Load individual agents from manifest files
  console.log('🎯 Loading agents from manifest files...\n');

  try {
    // Load data analyst from YAML manifest
    await app.addAgentFromFile('./examples/agents/data-analyst.yaml');
    
    // Load coding assistant from JSON manifest
    await app.addAgentFromFile('./examples/agents/coding-assistant.json');
    
    // Load simple helper from YAML manifest
    await app.addAgentFromFile('./examples/agents/simple-helper.yaml');

    console.log('✅ Individual agents loaded successfully!\n');
  } catch (error) {
    console.error('❌ Error loading individual agents:', error);
  }

  // Alternative: Load all agents from directory (will have duplicates from above)
  try {
    console.log('🎯 Demonstrating directory loading...\n');
    
    // This would load all YAML and JSON files from the agents directory
    // Note: We already loaded these above, so this is just for demonstration
    const directoryAgents = await app.loadAgentsFromDirectory('./examples/agents/');
    
    console.log(`✅ Directory scan found ${directoryAgents.length} manifest files!\n`);
  } catch (error) {
    console.error('❌ Error loading agents from directory:', error);
  }

  // List all loaded agents
  console.log('📋 Available agents:');
  const agentNames = app.listAgents();
  agentNames.forEach(name => console.log(`  • ${name}`));
  console.log();

  // Add CLI interface for testing
  const cli = new CLIInterface();
  app.addInterface(cli);

  return app;
}

// Create the app instance for CLI usage
const manifestApp = await createManifestDemo();
export default manifestApp;

// Backward compatibility - run if executed directly
if (require.main === module) {
  createManifestDemo().then(app => app.start()).catch(console.error);
}