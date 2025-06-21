# PRD: Unified Agent Configuration

**Title:** A Unified, Flexible Model for Agent Configuration

---

### 1. Guiding Philosophy: Simplicity and Power

An effective framework must be easy to use for simple tasks while providing the power needed for complex ones. This document outlines a dual approach to agent configuration that embraces this philosophy.

*   **For quick development, testing, and simple agents:** Configuration should be done **in-code**. This is the fastest and most flexible way to get started.
*   **For production, complex agents, and reusable personas:** Configuration can be externalized into **Agent Manifest** files. This is an optional, more structured approach for maintainability.

The framework will treat both methods as first-class citizens, allowing developers to choose the right approach for their needs, or even mix and match within the same project.

### 2. The Two Paths to Configuration

#### Path A: In-Code Configuration (The Simple Path)

This is the default and recommended way for most initial development. It relies on the existing `createAgent` and `addAgent` methods.

*   **How it works:** Developers create an agent instance and its capabilities object directly in their TypeScript file. This is fast, explicit, and keeps all the logic in one place.
*   **When to use it:**
    *   Rapidly prototyping a new agent.
    *   Creating simple, single-purpose agents.
    *   Writing examples and documentation.
    *   When you prefer to keep all logic within the `.ts` file.

**Example:**
```typescript
import { SmallTalk, createAgent } from 'smalltalk';
const app = new SmallTalk();

// Agent is defined and configured directly in the code.
const simpleAgent = createAgent(
  'Helper', 
  'A friendly assistant.'
);

// Capabilities for orchestration are also defined in-code.
const capabilities = {
  expertise: ['general conversation'],
  complexity: 'basic',
};

// The two are combined at registration. Simple and clear.
app.addAgent(simpleAgent, capabilities);

export default app;
```

#### Path B: File-Based Manifests (The Powerful Path)

This is an **optional** method for managing more complex agents or for teams that want to separate agent personas from application logic.

*   **How it works:** A developer defines an agent in a single YAML or JSON "manifest" file, which includes both its `config` and `capabilities`. They then load it with a new `app.addAgentFromFile(filePath)` method.
*   **When to use it:**
    *   When an agent's configuration (prompts, capabilities) becomes very large and clutters the source code.
    *   For production environments where you want to modify agent personas without redeploying code.
    *   To create a library of reusable, version-controlled agent personas.

**Example Manifest File: `./agents/analyst.yaml`**
```yaml
# This file defines the AnalystBot agent.
config:
  name: "AnalystBot"
  model: "gpt-4o"
  systemPromptFile: "./prompts/analyst_system_prompt.md"
capabilities:
  expertise: ["data analysis", "statistics"]
  complexity: "advanced"
```

**Example Usage:**
```typescript
import { SmallTalk } from 'smalltalk';
const app = new SmallTalk();

// The entire agent definition is loaded from a single file.
await app.addAgentFromFile('./agents/analyst.yaml');

export default app;
```

### 3. Required Code Changes (Minimal)

To support this dual approach, we only need to introduce the *new, optional* file-based method. The simple, in-code path will remain unchanged.

1.  **Create `addAgentFromFile(filePath: string)`:**
    *   This new method will be added to the `SmallTalk` class in `src/core/SmallTalk.ts`.
    *   It will read and parse the specified YAML or JSON file.
    *   It will internally call `new Agent(manifest.config)` and `this.addAgent(agent, manifest.capabilities)`.
    *   This implementation is self-contained and does not alter any existing methods.

2.  **No Changes to Existing Methods:**
    *   `createAgent(...)` remains the same.
    *   `addAgent(agent, capabilities?)` remains the same. The simplicity of the current workflow is preserved.

### 4. User Experience

A developer can start with the simple, in-code approach. If their agent's configuration grows in complexity, they have a clear and easy migration path:

1.  Move the in-code `AgentConfig` object into the `config:` section of a new `.yaml` file.
2.  Move the in-code `AgentCapabilities` object into the `capabilities:` section of that same file.
3.  Replace the `createAgent()` and `addAgent()` calls with a single `await addAgentFromFile(...)` call.

This design provides a gentle learning curve while offering a powerful solution for advanced use cases.

### 5. Success Metrics

*   **Flexibility:** Developers feel empowered to choose the configuration method that best suits their immediate needs.
*   **Clarity:** The distinction between the in-code and file-based approaches is clear and well-documented.
*   **Low Barrier to Entry:** New users can get started with the simple in-code method without needing to learn about the manifest file structure.
*   **Maintainability:** Power users adopt the manifest system for complex projects and find it improves their workflow.
