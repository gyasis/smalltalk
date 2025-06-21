import { SmallTalk, CLIInterface } from '../src/index.js';

// Simple manifest demo without top-level await for CLI compatibility
const app = new SmallTalk({
  llmProvider: 'openai',
  model: 'gpt-4o',
  debugMode: true,
  orchestration: true
});

// Load agents using traditional approach with promise handling
(async () => {
  try {
    console.log('🎯 Loading agents from manifest files...\n');
    
    // Load individual agents from manifest files
    await app.addAgentFromFile('./examples/agents/data-analyst.yaml');
    await app.addAgentFromFile('./examples/agents/coding-assistant.json');
    await app.addAgentFromFile('./examples/agents/simple-helper.yaml');
    
    console.log('✅ All agents loaded successfully!\n');
    
    // List loaded agents
    console.log('📋 Available agents:');
    const agentNames = app.listAgents();
    agentNames.forEach(name => console.log(`  • ${name}`));
    console.log();
    
  } catch (error) {
    console.error('❌ Error loading agents:', error);
  }
})();

// Add CLI interface
const cli = new CLIInterface();
app.addInterface(cli);

// Export for CLI usage
export default app;