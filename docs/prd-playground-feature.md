# PRD: The SmallTalk Standardized Execution Model

**Title:** A Standardized Execution Model for SmallTalk Scripts (`cli` vs `playground`).

---

### 1. Overview & Problem Statement

Currently, testing agent behavior requires developers to write significant boilerplate code to set up an interface (`CLIInterface` or `WebChatInterface`). Furthermore, our examples are run with inconsistent commands (`npx tsx`, etc.), creating a confusing developer experience.

We need a single, unified way to run *any* agent script. The developer should be able to write their agent logic in a single file and then choose to run it in a standard command-line interface or a rich web "Playground" with a simple, consistent command.

### 2. Goals & Objectives

*   **Primary Goal:** To provide a zero-configuration way to run any agent script in two modes: a default CLI mode and an optional web "Playground" mode.
*   **Standardization:** Consolidate all script execution under a single `smalltalk` command.
*   **Developer Experience:** Completely separate agent logic from interface presentation. The user provides the agents; SmallTalk provides the interface.
*   **Clarity:** A script intended for the web playground must explicitly contain a `playgroundConfig` object, otherwise the command will fail with a helpful error.

### 3. Scope

#### In-Scope:
*   A default CLI command: `smalltalk <filePath>`.
*   A web UI command: `smalltalk playground <filePath>`.
*   The `playground` command will require the target script to export a `playgroundConfig` object.
*   Automatic interface instantiation, server lifecycle, and event wiring based on the command used.
*   Refactoring all existing examples and documentation to use this new model.

#### Out-of-Scope:
*   Advanced debugging features like step-through execution or breakpoints.

### 4. Personas & User Stories

*   **Persona:** Alex, a developer using the SmallTalk library.

*   **User Stories:**
    *   "As Alex, I want to run `smalltalk my-agent.ts` to quickly test its logic in my terminal."
    *   "As Alex, when I want a UI, I can add a `playgroundConfig` to my file and run `smalltalk playground my-agent.ts` to get a web UI without changing any other code."
    *   "As Alex, if I run `playground` on a file without the config, I want the tool to tell me exactly what I need to add."

### 5. Requirements & Features

#### 5.1. CLI Commands

*   **`smalltalk <filePath> [args...]`**:
    *   This is the default command for CLI interaction.
    *   It will programmatically instantiate and run a `CLIInterface`.
*   **`smalltalk playground <filePath> [args...]`**:
    *   This command executes the script with the web "Playground" interface.
    *   It will fail if the target script does not export a `playgroundConfig` object.

#### 5.2. User Agent Script Contract

A script becomes compatible with the SmallTalk execution model by adhering to this contract:

1.  **Default Export:** It MUST `export default` a configured `SmallTalk` instance. This is the core agent logic.
2.  **Playground Configuration:** To be used with the `playground` command, it MUST also `export const playgroundConfig = { ... }`. This acts as a "decorator," explicitly marking the file as web-compatible and providing UI-specific settings.

The user script should **never** instantiate an `Interface` or call `app.start()`.

**Example Playground-Compatible Script (`./examples/language-tutor.ts`):**
```typescript
import { SmallTalk, AgentFactory, PlaygroundConfig } from 'smalltalk';

// This configuration makes the script compatible with `smalltalk playground`
export const playgroundConfig: PlaygroundConfig = {
  port: 4001,
  host: 'localhost',
};

// The default export is the core application logic
const app = new SmallTalk({
  llmProvider: 'openai',
  model: 'gpt-4o',
});

const tutor = AgentFactory.createLanguageTutor('Spanish');
app.addAgent(tutor);

export default app;
```
This single file can now be run in two ways:
*   `smalltalk ./examples/language-tutor.ts` (runs in CLI)
*   `smalltalk playground ./examples/language-tutor.ts` (runs in Web UI on port 4001)

If `playgroundConfig` were omitted, the `playground` command would fail with a helpful error message.

#### 5.3. Playground Web UI

*   The UI will be a generic, reusable version of the existing `web-chat-ui`.
*   It will display the chat history, user input fields, and agent status.
*   If orchestration is enabled in the user's script, the UI must display the real-time plan and step execution, just as it does today.
*   All existing UI features (Markdown rendering, session management, etc.) will be retained.

#### 5.4. Execution Workflow

1.  Developer runs `smalltalk <file>` or `smalltalk playground <file>`.
2.  The command boots up.
3.  It dynamically imports the module from the specified file path.
4.  It checks for the `default` export (the `SmallTalk` instance). If it's missing, it fails.
5.  **If `playground` command was used:**
    *   It also checks for the named export `playgroundConfig`.
    *   If `playgroundConfig` is missing, it exits with an error explaining that the config must be exported to use the playground.
    *   It uses the config to instantiate and run the `WebChatInterface`.
6.  **If default command was used:**
    *   It instantiates and runs the `CLIInterface`.
7.  It calls `app.start()`.

### 6. High-Level Technical Approach

1.  **CLI Enhancement:** Modify the CLI entry point (`package.json` `bin` and the main script) to recognize the new `playground` command. We can use a library like `yargs` or `commander` to parse arguments.
2.  **Playground Module:** Create a new module, e.g., `src/playground.ts`, that contains the logic for the `playground` command.
3.  **Dynamic Import:** This module will use `await import(filePath)` to load the user's script.
4.  **UI Abstraction:** The existing `WebChatInterface` and its associated HTML/JS/CSS files (`interfaces/web/*`) will be used as the foundation for the Playground UI. The logic inside `web-chat-ui.ts` for setting up the interface and its event listeners will be moved into the new `playground` module.
5.  **Refactoring:** The existing `examples/web-chat-ui.ts` will be refactored to follow the new, simpler pattern, serving as the primary example of how to write a Playground-compatible script. Other examples should also be updated.

### 7. Success Metrics

*   **Standardization:** All `examples/*.ts` files and documentation are updated to use the `smalltalk` and `smalltalk playground` commands.
*   **Clarity:** The `playgroundConfig` requirement proves effective at guiding users.
*   **Developer Feedback:** Positive feedback on the simplicity and consistency of the new execution model.
*   **Feature Velocity:** New agent ideas can be prototyped and shared visually or in the CLI in minutes. 