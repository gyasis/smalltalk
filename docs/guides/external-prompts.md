# Guide: Using External Prompts

Hardcoding prompts directly in your source code can be inflexible. SmallTalk allows you to externalize your prompts into separate files, making them easier to manage, reuse, and edit without changing your agent's code.

This is especially useful for large, complex prompts or for collaborating with non-developers who may need to edit prompt text.

---

### How It Works

You can specify file paths for your prompts directly in the `AgentConfig` when you create an agent. The framework will automatically read these files and configure the agent accordingly.

This is supported for both the main `systemPrompt` and for individual `promptTemplates`.

*   `systemPromptFile`: A single file path for the agent's system prompt.
*   `promptTemplateFiles`: A dictionary mapping a template name to its file path.

If both a file path (e.g., `systemPromptFile`) and a direct string (e.g., `systemPrompt`) are provided for the same prompt, **the content from the file will take precedence.**

---

### 1. Externalizing the System Prompt

This is the most common use case. It allows you to keep your agent's core directive in a separate text file.

**Step 1: Create the prompt file.**

**File: `./prompts/analyst_system_prompt.md`**
```markdown
You are a world-class data analyst. Your name is AnalystBot.

You are precise, methodical, and you always back up your claims with data. When asked to analyze something, you will provide a step-by-step breakdown of your process before delivering the final conclusion. You are friendly but formal.
```

**Step 2: Configure the agent to use the file.**

In your agent script, use the `systemPromptFile` property in the agent's configuration.

**File: `./examples/external-prompt-demo.ts`**
```typescript
import { SmallTalk, createAgent, PlaygroundConfig } from 'smalltalk';

export const playgroundConfig: PlaygroundConfig = {
  port: 4006,
  title: 'External Prompts Demo',
};

const app = new SmallTalk({ model: 'gpt-4o-mini' });

// This agent's personality is loaded from an external file.
const analystAgent = createAgent(
  'AnalystBot',
  'I am an analyst.', // This personality is a fallback and will be overridden by the system prompt.
  {
    // Point to the external file for the system prompt
    systemPromptFile: './prompts/analyst_system_prompt.md',
  }
);

app.addAgent(analystAgent);

export default app;
```

When you run this script, `AnalystBot` will use the detailed instructions from `analyst_system_prompt.md` as its core identity.

---

### 2. Externalizing Prompt Templates

You can also load a set of named prompt templates from files. This is useful for defining specific tasks or tools for an agent.

**Step 1: Create the template files.**

**File: `./prompts/summarize_template.txt`**
```
Please summarize the following text in {{word_count}} words:

{{text_to_summarize}}
```

**File: `./prompts/translate_template.txt`**
```
Translate the following text to {{language}}.

Original text: "{{text_to_translate}}"
```

**Step 2: Configure the agent to use the template files.**

Use the `promptTemplateFiles` property, which takes an object where keys are the template names and values are the file paths.

```typescript
// ... inside your agent script ...

const utilityAgent = createAgent(
  'UtilityBot',
  'I am a helpful bot with several tools.',
  {
    promptTemplateFiles: {
      summarize: './prompts/summarize_template.txt',
      translate: './prompts/translate_template.txt',
    }
  }
);

app.addAgent(utilityAgent);
```

You can now use these templates by name within your application logic. The `Agent` class does not yet automatically parse the `{{variable}}` names from the templates, so you will have to provide them when you render the template. (This is a known limitation that may be addressed in a future update).

---

### Best Practices

*   **Organize Your Prompts:** Keep your prompts in a dedicated directory, like `/prompts`, to keep your project tidy.
*   **Use Descriptive Filenames:** Name your prompt files clearly based on the agent and its purpose (e.g., `agent_coder_review_template.md`).
*   **Version Control:** Since your prompts are now text files, you can track changes to them using Git just like your source code. This is a major advantage for maintaining and improving agent behavior over time.
*   **Path Resolution:** Paths are resolved relative to the current working directory where you run the `smalltalk` command. It's often safest to use relative paths from your project root. 