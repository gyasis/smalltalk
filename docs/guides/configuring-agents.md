# Guide: Configuring Agents with Different LLMs

In SmallTalk, you have the flexibility to assign different Large Language Models (LLMs) to different agents within the same application. This powerful feature allows you to optimize for cost, speed, and capability, using the best model for each specific task.

For example, you can use a fast, inexpensive model for simple, high-frequency tasks like routing user queries, while reserving a powerful, state-of-the-art model for complex reasoning or code generation.

---

### The Core Concept: Global vs. Per-Agent Configuration

The model is configured in two places:

1.  **Global `SmallTalk` Config:** This is the default model that all agents will use unless specified otherwise. It's set when you instantiate your `SmallTalk` application.
2.  **Per-Agent `AgentConfig`:** You can override the global model for a specific agent by providing a `model` property in its configuration object when you create it.

If an agent's config does **not** have a `model` property, it automatically falls back to using the global model from the main `SmallTalk` instance.

### How to Configure

#### 1. Setting the Global (Default) Model

You set the default model in the `SmallTalk` constructor. This is the model that will be used by any agent that doesn't have its own model specified.

```typescript
import { SmallTalk } from 'smalltalk';

const app = new SmallTalk({
  llmProvider: 'openai',
  model: 'gpt-3.5-turbo', // The default for all agents
  // ... other configs
});
```

#### 2. Overriding the Model for a Specific Agent

To assign a different model to an agent, add the `model` property to its configuration object during creation. The `createAgent` and `AgentFactory` methods all support this.

Let's create two agents: a "Router" that uses the cheap default model, and an "Analyst" that uses the more powerful GPT-4o.

```typescript
import { SmallTalk, createAgent, AgentFactory } from 'smalltalk';

// The default model is gpt-3.5-turbo
const app = new SmallTalk({
  model: 'gpt-3.5-turbo',
});

// This agent will use the default model: 'gpt-3.5-turbo'
const routerAgent = createAgent(
  'RouterAgent',
  'I am a simple agent that routes user requests.'
  // No model property, so it uses the default.
);

// This agent gets a powerful, specific model
const analystAgent = createAgent(
  'AnalystAgent',
  'I am an expert data analyst for complex tasks.',
  {
    model: 'gpt-4o-mini', // Override the default model
    temperature: 0.2,
  }
);

app.addAgent(routerAgent);
app.addAgent(analystAgent);

export default app;
```
When `analystAgent` is asked to generate a response, it will use `gpt-4o-mini`. When `routerAgent` is asked, it will use `gpt-3.5-turbo`.

---

### Full Example: A Playground-Compatible Script

Here is a complete, runnable example that you can use with the `smalltalk` CLI. It defines a default model and then creates two agents: one using the default and one with a specific override.

**File: `./examples/multi-model-demo.ts`**

```typescript
import { SmallTalk, createAgent, PlaygroundConfig } from 'smalltalk';

// This config makes the script runnable with `smalltalk playground`
export const playgroundConfig: PlaygroundConfig = {
  port: 4005,
  title: 'Multi-Model Agent Demo',
};

// 1. Configure the SmallTalk app with a cost-effective default model.
const app = new SmallTalk({
  llmProvider: 'openai',
  model: 'gpt-3.5-turbo', // Default model for speed and cost
  debugMode: true,
});

// 2. Create a "Gatekeeper" agent.
// It does not specify a model, so it will use the default 'gpt-3.5-turbo'.
const gatekeeper = createAgent(
  'Gatekeeper',
  'You are a helpful assistant who first greets the user and then asks if they need simple or complex help. Based on their answer, you will hand off to the correct agent.',
  {
    temperature: 0.8,
  }
);

// 3. Create a "DeepThinker" agent with a powerful model.
// We override the model to use 'gpt-4o-mini' for complex tasks.
const deepThinker = createAgent(
  'DeepThinker',
  'You are a powerful, creative, and analytical AI that handles complex user requests with deep thought and detailed explanations.',
  {
    model: 'gpt-4o-mini', // Use a more powerful model for this agent
    temperature: 0.5,
  }
);

// 4. Add agents to the app
app.addAgent(gatekeeper);
app.addAgent(deepThinker);

// 5. Export the app instance for the CLI
export default app;
```

#### How to Run This Example:

You can run this script using either the standard CLI or the web playground:

**To run in your terminal:**
```bash
smalltalk ./examples/multi-model-demo.ts
```

**To run in the web playground:**
```bash
smalltalk playground ./examples/multi-model-demo.ts
```

---

### Best Practices & Use Cases

*   **Cost Management:** Use cheaper models like `gpt-3.5-turbo` or smaller open models for routine tasks such as simple chat, data extraction, or routing. This can significantly reduce operational costs.
*   **Performance Optimization:** For tasks that require complex reasoning, deep analysis, or high-quality content generation (e.g., writing code, analyzing a legal document), assign a state-of-the-art model like `gpt-4o-mini` or `claude-3-opus`.
*   **Speed:** For user-facing interactions where response time is critical, a smaller, faster model might provide a better user experience than a larger, slower one.
*   **Specialized Agents:** Some models excel at specific tasks. You might have one agent using a model fine-tuned for function calling, and another using a model known for its creative writing abilities. 