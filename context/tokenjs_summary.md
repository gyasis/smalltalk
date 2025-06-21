# Token.js Summary

This document provides a comprehensive overview of the Token.js repository, including its purpose, features, and instructions for usage and contribution.

## What is Token.js?

Token.js is a free and open-source TypeScript SDK that allows developers to integrate with over 200 Large Language Models (LLMs) from more than 10 different providers using a single, unified API that mirrors OpenAI's format. A key feature of Token.js is that it runs entirely on the client-side, meaning there is no need for a proxy server, which can simplify deployment and improve privacy.

Think of it as a universal remote for LLMs; you use one consistent interface to interact with many different models, and Token.js handles the translation to each provider's specific format behind the scenes.

## Core Features

*   **Unified Interface**: Utilizes OpenAI's request and response format, making it easy to switch between different models and providers.
*   **Broad Provider Support**: Supports major providers like OpenAI, Anthropic, AWS Bedrock, Cohere, Google Gemini, Groq, Mistral, Perplexity, and OpenRouter. It also supports any provider with an OpenAI-compatible API.
*   **Rich Functionality**: Supports modern LLM features including:
    *   **Streaming**: Receive responses in real-time as they are generated.
    *   **Function Calling / Tools**: Allow the LLM to call functions you define in your code.
    *   **JSON Output**: Enforce that the model's output is valid JSON.
    *   **Image Input (Vision)**: Provide images as input to compatible multimodal models.
*   **Client-Side Operation**: All API calls are made directly from the client to the LLM provider, with no intermediary server required.
*   **Extensible**: You can add support for new or custom models that are not yet in the predefined list using the `extendModelList` method.

## Instructions for Use

### 1. Installation

Install the package using your preferred package manager:

```bash
npm install token.js
# or
pnpm install token.js
# or
yarn add token.js
```

### 2. Setup API Keys

Token.js recommends using environment variables to configure your API keys for the different providers.

```bash
# OpenAI
OPENAI_API_KEY=your_key_here
# Anthropic
ANTHROPIC_API_KEY=your_key_here
# Cohere
COHERE_API_KEY=your_key_here
# Google Gemini
GEMINI_API_KEY=your_key_here
# Groq
GROQ_API_KEY=your_key_here
# Mistral
MISTRAL_API_KEY=your_key_here
# Perplexity
PERPLEXITY_API_KEY=your_key_here
# OpenRouter
OPENROUTER_API_KEY=your_key_here
# AWS Bedrock
AWS_REGION_NAME=your_aws_region
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
```

### 3. Basic Usage

Here is a simple example of how to make a chat completion call:

```typescript
import { TokenJS } from 'token.js';

// Create the Token.js client
const tokenjs = new TokenJS();

async function main() {
  // Create a model response
  const completion = await tokenjs.chat.completions.create({
    // Specify the provider and model
    provider: 'openai',
    model: 'gpt-4o',
    // Define your message
    messages: [
      {
        role: 'user',
        content: 'Hello!',
      },
    ],
  });
  console.log(completion.choices[0]);
}

main();
```

### 4. Special Features & Advanced Usage

#### Streaming Responses
To get a response as a stream of chunks, set the `stream` property to `true`. This is useful for creating real-time, typewriter-like effects.

```typescript
import { TokenJS } from 'token.js';

const tokenjs = new TokenJS();

async function streamExample() {
  const result = await tokenjs.chat.completions.create({
    stream: true,
    provider: 'openai',
    model: 'gpt-4o',
    messages: [{ role: 'user', content: `Tell me about yourself.` }],
  });

  for await (const part of result) {
    process.stdout.write(part.choices[0]?.delta?.content || '');
  }
}

streamExample();
```

#### Function Calling (Tools)
Define a set of tools that the LLM can call. The model will return a `tool_calls` object in its response if it decides to use one of your functions.

```typescript
import { TokenJS, ChatCompletionTool } from 'token.js';

const tokenjs = new TokenJS();

async function functionCallExample() {
  const tools: ChatCompletionTool[] = [
    {
      type: 'function',
      function: {
        name: 'get_current_weather',
        description: 'Get the current weather in a given location',
        parameters: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'The city and state, e.g. San Francisco, CA',
            },
          },
          required: ['location'],
        },
      },
    },
  ];

  const result = await tokenjs.chat.completions.create({
    provider: 'gemini',
    model: 'gemini-1.5-pro',
    messages: [{ role: 'user', content: `What's the weather like in Boston?` }],
    tools: tools,
    tool_choice: 'auto', // 'auto' lets the model decide, or you can force a tool call.
  });

  console.log(result.choices[0].message.tool_calls);
}

functionCallExample();
```

## How to Contribute

Contributions to Token.js are welcome. Here is a summary of the process:

### 1. Areas of Contribution
*   **Reporting Issues**: If you find a bug or have a feature request, open an issue on GitHub.
*   **Fixing Issues**: You can help by fixing issues, especially those tagged as "good first issue".
*   **Supporting New Providers**: It's recommended to open an issue first to discuss the implementation with the maintainers.

### 2. Development Setup

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/token-js/token-js.git
    ```
2.  **Install dependencies**:
    ```bash
    cd token-js && pnpm install
    ```
3.  **Run tests**:
    ```bash
    pnpm test
    ```
4.  **Lint your code**:
    ```bash
    pnpm lint:fix
    ```
5.  **Update documentation** (if you modify the models list):
    ```bash
    pnpm docs:update
    ```
6.  **Add a changeset** (to trigger a new release):
    ```bash
    pnpm changeset
    ```

After following these steps, you can open a pull request.