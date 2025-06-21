# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript/Node.js project focused on building LLM applications using PocketFlow.js framework and Token.js SDK. The project follows agentic coding principles where humans design high-level flows and AI agents implement the detailed code.

## Core Architecture

### Framework Stack
- **PocketFlow.js**: A minimalist 100-line LLM framework for Agents, Task Decomposition, RAG, etc.
- **Token.js**: Unified TypeScript SDK for 200+ LLMs from 10+ providers using OpenAI's format
- **TypeScript**: Primary development language

### Design Patterns
The project implements common LLM design patterns:
- **Agent**: Autonomous decision-making nodes
- **Workflow**: Sequential task chains 
- **RAG**: Retrieval Augmented Generation (offline indexing + online query)
- **Map Reduce**: Batch processing with map/reduce phases
- **Structured Output**: Enforced response formats (prefer YAML over JSON)

### Core Abstractions
- **Node**: Basic building block with `prep()` → `exec()` → `post()` lifecycle
- **Flow**: Orchestrates nodes through action-based transitions
- **Shared Store**: Global data structure for inter-node communication
- **Batch**: Process large inputs or multiple iterations
- **Parallel**: Concurrent execution for I/O-bound tasks

## Development Workflow

### Framework Architecture
SmallTalk is implemented as a complete importable framework with the following structure:
```
src/
├── core/             # Framework core classes
│   ├── SmallTalk.ts  # Main framework orchestrator
│   ├── Chat.ts       # Chat management
│   ├── Memory.ts     # Context/history management
│   └── MCPClient.ts  # MCP integration
├── agents/           # Agent system
│   ├── Agent.ts      # Base agent class
│   ├── AgentFactory.ts # Pre-built agent creation
│   └── PromptTemplateManager.ts # Template system
├── interfaces/       # Interface implementations
│   ├── BaseInterface.ts # Interface base class
│   └── CLIInterface.ts  # Command line interface
├── utils/            # Utilities
│   └── TokenJSWrapper.ts # Token.js LLM integration
└── types/            # TypeScript definitions
```

### Usage Pattern
SmallTalk follows an import-and-use pattern rather than PocketFlow's node-based approach:

```typescript
import { SmallTalk, Agent, CLIInterface } from 'smalltalk';

const app = new SmallTalk({ llmProvider: 'openai', model: 'gpt-4o' });
const agent = new Agent({ name: 'Helper', personality: 'friendly' });
app.addAgent(agent);
app.addInterface(new CLIInterface());
await app.start();
```

## LLM Integration

### Token.js Usage
All LLM calls should use Token.js for unified provider access:

```typescript
import { TokenJS } from 'token.js';

const tokenjs = new TokenJS();

async function callLlm(prompt: string): Promise<string> {
  const completion = await tokenjs.chat.completions.create({
    provider: 'openai',  // or anthropic, gemini, etc.
    model: 'gpt-4o',     // provider-specific model
    messages: [{ role: 'user', content: prompt }],
  });
  return completion.choices[0].message.content || '';
}
```

### Environment Variables
Configure API keys via environment variables:
```bash
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here
# See Token.js docs for full provider list
```

### Supported Features
Token.js supports streaming, function calling, JSON output, and image inputs across providers. Check feature compatibility table before using advanced features.

## Development Guidelines

### Code Organization
- Keep utility functions in separate files (one per API/function)
- Define shared types in `types.ts`
- Implement nodes with clear `prep()`, `exec()`, `post()` separation
- Use shared store for data, params only for identifiers

### Error Handling
- Nodes support automatic retries with `maxRetries` and `wait` parameters
- Implement `execFallback()` for graceful error handling
- Use "FAIL FAST" approach - avoid try/catch to identify weak points

### Performance
- Use `ParallelBatchNode` for I/O-bound tasks
- Be mindful of LLM rate limits when parallelizing
- Consider prompt caching and batching for optimization

### Structured Output
- Prefer YAML over JSON for LLM responses (easier escaping)
- Implement validation in node `exec()` methods
- Use TypeScript types for response structures

## Design Principles

- **Start Simple**: Begin with minimal solutions, iterate based on feedback
- **Design First**: Create high-level flow diagrams before implementation
- **Separation of Concerns**: Keep data (shared store) separate from compute (nodes)
- **Fail Fast**: Avoid complex error handling initially to identify issues
- **Context Management**: Provide relevant, minimal context to LLMs
- **Action Space**: Define clear, unambiguous action sets for agents

This project emphasizes collaboration between human system design and AI implementation, following the documented agentic coding principles throughout development.

## Version Management

### Package Version Updates
When updating the SmallTalk version in package.json, you MUST also update the corresponding package file:

**Current version file**: `/home/gyasis/Documents/code/smalltalk/smalltalk@0.2.3`

**Update process**:
1. Update version in `package.json` (e.g., from "0.2.3" to "0.2.4")
2. Rename the package file to match: `smalltalk@0.1.0` → `smalltalk@0.2.4`
3. Both files must stay in sync for proper version tracking

**Example**:
```bash
# When updating from v0.2.3 to v0.2.4:
# 1. Edit package.json: "version": "0.2.4"
# 2. Rename: mv smalltalk@0.2.3 smalltalk@0.2.4
```

This ensures version consistency across the project files.