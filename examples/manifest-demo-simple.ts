import { SmallTalk, CLIInterface } from '../src/index.js';
import { PlaygroundConfig } from '../src/types/index.js';

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

// Playground configuration for `smalltalk playground` command
export const playgroundConfig: PlaygroundConfig = {
  port: 3126,
  host: 'localhost',
  title: 'Simple Manifest Demo',
  description: 'Simple demonstration of loading agents from YAML and JSON manifest files',
  orchestrationMode: true,
  enableChatUI: true
};

// Async initialization function for playground mode
async function initializeApp() {
  const smalltalk = new SmallTalk({
    llmProvider: 'openai',
    model: 'gpt-4o',
    debugMode: true,
    orchestration: true
  });

  // Load agents from manifest files
  try {
    console.log('🎯 Loading agents from manifest files...');
    
    await smalltalk.addAgentFromFile('./examples/agents/data-analyst.yaml');
    await smalltalk.addAgentFromFile('./examples/agents/coding-assistant.json');
    await smalltalk.addAgentFromFile('./examples/agents/simple-helper.yaml');
    
    console.log('✅ All agents loaded successfully!');
    
    const agentNames = smalltalk.listAgents();
    console.log('📋 Available agents:', agentNames.join(', '));
    
  } catch (error) {
    console.error('❌ Error loading agents:', error);
  }

  return smalltalk;
}

export default initializeApp;

// ES module execution detection with playground mode support
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    if (process.env.SMALLTALK_PLAYGROUND_MODE === 'true') {
      // In playground mode, the framework handles initialization
      console.log('🎮 Simple Manifest Demo - Playground Mode');
    } else {
      // CLI mode - preserve existing logic with CLI interface
      const cli = new CLIInterface();
      app.addInterface(cli);
      await app.start();
    }
  })().catch(error => {
    console.error('Demo failed to start:', error);
    process.exit(1);
  });
}