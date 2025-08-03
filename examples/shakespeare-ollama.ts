import { SmallTalk, Agent, CLIInterface } from 'smalltalk';

// Set the OpenAI base URL to point to our remote Ollama instance
// This tells Token.js to use Ollama's OpenAI-compatible API instead of OpenAI's servers
process.env.OPENAI_BASE_URL = 'http://192.168.1.160:11434/v1';

/**
 * An example demonstrating how to connect to a local LLM running via Ollama.
 * This agent will adopt the personality of a Shakespearean bard.
 *
 * TO RUN THIS EXAMPLE:
 * 1. Make sure you have Ollama installed and running.
 *    (Download from https://ollama.com)
 *
 * 2. Pull a model for Ollama to use. We recommend llama3:
 *    `ollama run llama3`
 *
 * 3. Run this script from your terminal:
 *    `npx smalltalk examples/shakespeare-ollama.ts`
 */

// Define the Shakespearean persona in a detailed system prompt.
// This gives the LLM clear instructions on how to behave.
const shakespeareanSystemPrompt = `
Thou art a Shakespearean bard, a wordsmith of the highest calibre. Thy name is Will.
All thine responses must be penned in the grandiloquent style of William Shakespeare.
Speaketh thou only in Early Modern English.
Employ flowery language, dramatic flair, and iambic pentameter where thou canst.
Refer to modern concepts only through the lens of thy 16th-century worldview.
For example, a "computer" might be a "magical scrying glass" or a "tome of infinite knowledge."
A "car" might be a "horseless carriage of roaring thunder."
Maintain this persona without fail, forsooth!
`;

// Create an agent specifically configured to use your local Ollama instance.
const shakespeareanAgent = new Agent({
  name: 'Will the Bard',
  
  // The system prompt is the most important part for defining the personality.
  systemPrompt: shakespeareanSystemPrompt,
  
  // The model name must match one you have downloaded with `ollama run`.
  // We will use the exact model name from your Ollama instance.
  model: 'mistral:latest',
});

// Initialize the SmallTalk application with Ollama configuration.
// Note: Using 'openai' provider since Ollama is OpenAI-compatible
const app = new SmallTalk({
  llmProvider: 'openai',
  model: 'mistral',
});

// Create and add the CLI interface.
const cliInterface = new CLIInterface();
app.addInterface(cliInterface);

// Add our Shakespearean agent to the application.
app.addAgent(shakespeareanAgent);

// Use the simple Command-Line Interface for interaction.

// An async function to properly start the application.
async function main() {
  console.log("Hark! The stage is set. The Globe Theatre awaits thine inquiry.");
  console.log("Connecting to thy local Ollama... Prithee, stand by.");
  
  try {
    await app.start();
    console.log("\nSuccess! Will the Bard is ready. What dost thou wish to ask?");
  } catch (error) {
    console.error("\nAlas, a plague upon this venture! The connection hath failed.", error);
    console.error("Pray, ensure Ollama is running on http://192.168.1.160:11434 and the model 'mistral:latest' is available.");
  }
}

// Run the main function to start the chat.
main();
