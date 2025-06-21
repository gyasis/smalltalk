# PRD: The SmallTalk Agent Playground

**Title:** A generic "Playground" command to visually run, test, and debug any SmallTalk agent script.

---

### 1. Overview & Problem Statement

Currently, testing and visualizing agent behavior requires developers to write significant boilerplate code. Each new example, like `examples/web-chat-ui.ts`, must manually create a `SmallTalk` instance, define agents, set up a `WebChatInterface`, and handle the server lifecycle and event wiring. This process is repetitive, time-consuming, and mixes agent logic with UI presentation concerns.

This friction discourages rapid prototyping and makes debugging a purely console-based affair unless the developer invests in building a custom UI for their specific test case. We need a way to instantly visualize *any* agent script in a rich, interactive web UI without forcing the developer to write any UI-specific code.

### 2. Goals & Objectives

*   **Primary Goal:** To provide a zero-configuration, command-line-driven tool that launches a web-based "Playground" for any agent script.
*   **Developer Experience:** Drastically simplify the process of testing and debugging agents by separating agent logic from UI presentation.
*   **Rapid Prototyping:** Enable developers to go from a simple agent script to a fully interactive web demo in seconds.
*   **Code Reusability:** Eliminate redundant UI setup code across all example and test scripts. The Playground will provide the UI, and the user will provide only the agent logic.

### 3. Scope

#### In-Scope:
*   A new CLI command: `smalltalk playground <filePath>`.
*   The command will launch a generic, pre-built web UI for chat and orchestration visualization.
*   The UI will be capable of connecting to the `SmallTalk` instance defined in the user-provided script.
*   The system will handle all WebSocket connections, event broadcasting, and server lifecycle management automatically.
*   The Playground will support all existing `SmallTalk` features, including multi-agent orchestration, event streaming, and user interruptions.

#### Out-of-Scope:
*   A full-fledged, production-grade chat application. The Playground is a developer tool.
*   Advanced debugging features like step-through execution, breakpoints, or variable inspection (these could be future enhancements).
*   Custom styling or UI configurations per-project. The Playground will have one standard interface.

### 4. Personas & User Stories

*   **Persona:** Alex, a developer using the SmallTalk library to build a new multi-agent system.

*   **User Stories:**
    *   "As Alex, I want to run my `my-cool-agent.ts` script in a visual chat interface so that I can easily test its responses and behavior without writing any HTML or server code."
    *   "As Alex, I want to see the orchestration plan and agent steps execute in real-time in the UI so that I can debug the flow of my multi-agent system."
    *   "As Alex, I want to be able to just focus on writing my agent's logic and capabilities, and have the library provide the visualization for me automatically."

### 5. Requirements & Features

#### 5.1. CLI Command: `smalltalk playground`

*   The command shall be registered as part of the `smalltalk` executable.
*   It must accept a mandatory file path as an argument (e.g., `smalltalk playground ./examples/my-agents.ts`).
*   It should accept optional arguments for configuration, such as `--port <number>`.
*   The command will be responsible for starting the web server and the user's `SmallTalk` instance.

#### 5.2. User Agent Script Requirements

*   To be "Playground-compatible," a user's TypeScript file must meet one simple contract: it must export a configured `SmallTalk` instance as its default export.
*   The user script is responsible *only* for:
    1.  Instantiating `SmallTalk`.
    2.  Configuring the instance (LLM, orchestration, memory, etc.).
    3.  Creating and adding agents.
*   The user script should **not** instantiate any `Interface` (like `WebChatInterface`) or call `app.start()`.

**Example User Script (`./examples/language-tutor-playground.ts`):**
```typescript
import { SmallTalk, AgentFactory } from 'smalltalk';

// 1. Create and configure the SmallTalk app
const app = new SmallTalk({
  llmProvider: 'openai',
  model: 'gpt-4o',
  orchestration: false,
});

// 2. Create agents
const tutor = AgentFactory.createLanguageTutor('Spanish');
const student = AgentFactory.createLanguageStudent();

// 3. Add agents to the app
app.addAgent(tutor);
app.addAgent(student);

// 4. Export the configured instance
export default app;
```

#### 5.3. Playground Web UI

*   The UI will be a generic, reusable version of the existing `web-chat-ui`.
*   It will display the chat history, user input fields, and agent status.
*   If orchestration is enabled in the user's script, the UI must display the real-time plan and step execution, just as it does today.
*   All existing UI features (Markdown rendering, session management, etc.) will be retained.

#### 5.4. Execution Workflow

1.  Developer runs `smalltalk playground ./examples/my-script.ts`.
2.  The `playground` command boots up.
3.  It dynamically imports the `SmallTalk` instance from `./examples/my-script.ts`.
4.  It programmatically creates a new `WebChatInterface` instance (the Playground UI server).
5.  It adds this interface to the user's imported `SmallTalk` instance (`app.addInterface(playgroundInterface)`).
6.  It wires up all necessary event listeners between the `app` and the `playgroundInterface` to ensure the UI is updated on events (`plan_created`, `streaming_response`, etc.).
7.  It calls `app.start()`.
8.  It logs the URL to the console (e.g., `Playground is running at http://localhost:3045`) and optionally opens it in the user's default browser.
9.  The user can now interact with their agents via the web UI.

### 6. High-Level Technical Approach

1.  **CLI Enhancement:** Modify the CLI entry point (`package.json` `bin` and the main script) to recognize the new `playground` command. We can use a library like `yargs` or `commander` to parse arguments.
2.  **Playground Module:** Create a new module, e.g., `src/playground.ts`, that contains the logic for the `playground` command.
3.  **Dynamic Import:** This module will use `await import(filePath)` to load the user's script.
4.  **UI Abstraction:** The existing `WebChatInterface` and its associated HTML/JS/CSS files (`interfaces/web/*`) will be used as the foundation for the Playground UI. The logic inside `web-chat-ui.ts` for setting up the interface and its event listeners will be moved into the new `playground` module.
5.  **Refactoring:** The existing `examples/web-chat-ui.ts` will be refactored to follow the new, simpler pattern, serving as the primary example of how to write a Playground-compatible script. Other examples should also be updated.

### 7. Success Metrics

*   **Adoption:** All new and existing example scripts are refactored to use the `playground` command, removing >50% of the lines of code from each.
*   **Developer Feedback:** Positive feedback from developers that the new workflow is significantly faster and easier for testing and debugging.
*   **Feature Velocity:** New agent ideas can be prototyped and shared visually in minutes rather than hours. 