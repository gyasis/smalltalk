<!--
  ============================================================================
  SYNC IMPACT REPORT
  ============================================================================
  Version Change: 1.0.0 → 1.1.0
  Date: 2025-11-23

  Modified Principles: Added Distributed Development Orchestration (Governance section)
  Added Sections:
    - Distributed Development Orchestration (under Governance)
      * Execution Strategy (Sequential vs Parallel)
      * File Locking Protocol (.specify/file-locks.json)
      * Unified State Tracking (Memory Bank + Git atomic sync)
      * Phase Boundaries (Production Robustness feature)

  Removed Sections: N/A

  Rationale for Amendment:
    - Addresses context window drift during complex multi-phase development
    - Prevents race conditions when using parallel sub-agents
    - Ensures immutable history via dual sync (Memory + Git)
    - Integrates with SpecKit TDD workflow (Red-Green-Refactor cycle)

  Templates Status:
    ✅ plan-template.md - Compatible (phase boundaries align with plan structure)
    ✅ spec-template.md - Compatible (user stories unchanged)
    ✅ tasks-template.md - Enhanced (parallel task execution now governed by file locks)
    ✅ constitution.md - Updated v1.1.0 (this file)

  Files Referenced:
    - .specify/file-locks.json (concurrency control)
    - memory-bank/activeContext.md (current work focus)
    - memory-bank/progress.md (milestone tracking)
    - memory-bank/systemPatterns.md (architectural changes)

  Follow-up TODOs:
    ✅ Remove standalone .specify/development-orchestration.json (integrated into constitution)
    ✅ Update memory-bank/systemPatterns.md with protocol documentation
    ✅ Update memory-bank/activeContext.md with Phase 1 completion status

  Commit Message Suggestion:
    docs: amend constitution v1.1.0 (distributed development orchestration protocol)

    - Add file locking system for parallel agent coordination
    - Define atomic sync requirements (Memory Bank + Git)
    - Specify phase boundaries for Production Robustness feature
    - Consolidate development orchestration into constitutional framework

    BREAKING: Developers using parallel agents must now follow file locking protocol
  ============================================================================
-->

# SmallTalk Framework Constitution

## Core Principles

### I. Framework-First Architecture

**SmallTalk is an importable TypeScript framework, not a node-based workflow system.**

**Non-Negotiable Rules**:
- All features MUST be exposed through importable classes/functions
- Public API MUST follow object-oriented patterns (SmallTalk, Agent, Interface classes)
- Core framework (src/core/) MUST NOT depend on specific implementations
- Agents MUST be composable via instantiation, not configuration files
- Framework initialization MUST be simple: `new SmallTalk()` → `addAgent()` → `start()`

**Rationale**: Users expect a "Rails for AI" experience - batteries included, opinionated structure, minimal boilerplate. Framework-first design enables easy composition, testing, and integration into existing TypeScript projects.

---

### II. Intelligent Orchestration (Core Differentiator)

**Multi-agent orchestration with automatic routing is SmallTalk's primary competitive advantage.**

**Non-Negotiable Rules**:
- Phase 1-3 Interactive Orchestration MUST remain the default experience
- Agent selection MUST be automatic and LLM-powered (not manual routing)
- Orchestration decisions MUST be logged and analyzable for improvement
- Agent handoffs MUST include confidence scores and reasoning
- Users MUST be able to override orchestration with manual agent selection

**Rationale**: Intelligent orchestration eliminates the "which agent should I use?" problem. Phase 1 (real-time monitoring) + Phase 2 (sophisticated routing) + Phase 3 (adaptive learning) create a self-improving system that gets smarter with usage.

---

### III. Universal LLM Integration

**SmallTalk MUST support 200+ models across 10+ providers via Token.js.**

**Non-Negotiable Rules**:
- ALL LLM calls MUST go through Token.js abstraction layer
- Provider switching MUST require ZERO code changes (config only)
- Features MUST degrade gracefully if unsupported by provider
- API keys MUST be environment-variable based (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)
- Token.js version MUST stay updated for latest provider support

**Rationale**: Vendor lock-in is unacceptable. Users must maintain freedom to switch providers based on cost, performance, or capabilities. Token.js provides the unified interface that makes this seamless.

---

### IV. Test-First Development (TDD Mandatory)

**Tests are written BEFORE implementation, must FAIL before code is written, then PASS after.**

**Non-Negotiable Rules**:
- Red-Green-Refactor cycle strictly enforced
- Contract tests MUST validate API contracts (inputs/outputs)
- Integration tests MUST verify agent interactions and orchestration
- Tests MUST be runnable independently and in parallel
- NO production code without corresponding failing test first

**Rationale**: SmallTalk's orchestration system is complex - multiple agents, LLM calls, state management. TDD ensures correctness, prevents regressions, and serves as living documentation.

---

### V. Interface Flexibility

**Users choose their preferred interaction mode: CLI, Web API, or Web Chat.**

**Non-Negotiable Rules**:
- CLI MUST work with zero configuration: `smalltalk examples/script.ts`
- Web Playground MUST support all examples with `smalltalk playground <script>`
- Web API MUST expose RESTful endpoints + WebSocket support
- Interface selection MUST NOT affect agent behavior or orchestration
- New interfaces MUST implement BaseInterface contract

**Rationale**: Different use cases demand different interfaces. Developers want CLI for testing, web chat for demos, and APIs for integration. SmallTalk must accommodate all without forcing users into a single paradigm.

---

## Development Standards

### Code Organization

**Strict separation of concerns across framework layers**:
- `src/core/` - Framework orchestration (SmallTalk, Chat, Memory, MCPClient)
- `src/agents/` - Agent system (Agent, AgentFactory, PromptTemplateManager)
- `src/interfaces/` - Interface implementations (BaseInterface, CLIInterface, WebInterface)
- `src/utils/` - Utilities (TokenJSWrapper for LLM integration)
- `src/types/` - TypeScript type definitions

**Rules**:
- Core MUST NOT import from agents or interfaces
- Agents MUST NOT import from interfaces
- Interfaces MAY import from core and agents
- Utils MUST be pure, stateless helper functions
- Types MUST be shared across all layers

---

### Error Handling & Observability

**SmallTalk MUST be debuggable and production-ready**:
- ALL errors MUST include context (agent name, message ID, timestamp)
- LLM call failures MUST retry with exponential backoff
- Orchestration decisions MUST be logged with reasoning
- Performance metrics MUST be capturable (handoff count, confidence scores)
- Debug mode MUST expose full orchestration decision tree

---

### Breaking Changes & Versioning

**MAJOR.MINOR.PATCH semantic versioning**:
- **MAJOR**: Breaking API changes (e.g., SmallTalk constructor signature)
- **MINOR**: New features backward compatible (e.g., new Agent capabilities)
- **PATCH**: Bug fixes and performance improvements

**Migration Path Required**:
- Breaking changes MUST include migration guide
- Deprecation warnings MUST precede removal by 1 MINOR version
- Example scripts MUST be updated with each MAJOR/MINOR release

---

## Quality & Security Requirements

### Security Standards

**SmallTalk handles sensitive data (API keys, user conversations)**:
- API keys MUST be environment variables, NEVER hardcoded
- User conversation history MUST be opt-in, with clear data retention policy
- MCP server connections MUST validate permissions before tool execution
- Agent prompts MUST sanitize user input to prevent prompt injection
- Audit logs MUST track agent actions for security review

### Performance Constraints

**SmallTalk MUST remain performant at scale**:
- Orchestration decision latency: <100ms for agent selection
- Memory footprint: <200MB for typical 4-agent configuration
- Concurrent users: Support 1000+ connections with Web interface
- LLM rate limits: Respect provider limits with backoff strategies

---

## Governance

### Amendment Process

**This constitution supersedes all other development practices.**

**To amend**:
1. Propose change with justification in GitHub discussion
2. Demonstrate why existing principle insufficient
3. Provide migration path for affected code
4. Gain maintainer approval before updating constitution.md

### Compliance Review

**All pull requests MUST**:
- Verify alignment with Core Principles I-V
- Include tests (if code changes)
- Update documentation (if public API changes)
- Pass linting and TypeScript strict checks

**Complexity justification required if**:
- Adding new abstraction layer (e.g., new core/ module)
- Introducing third-party framework dependency
- Changing orchestration algorithm fundamentals

### Distributed Development Orchestration

**Strategic Intent**: Maximize coding velocity and intelligence density while minimizing Context Window Drift.

**Core Rationale**:
1. **Token Efficiency**: Offload independent tasks to sub-agents to preserve main context window
2. **Data Integrity**: Prevent race conditions via strict file locking (parallel agents are blind to each other)
3. **Immutable History**: Sync Memory Bank + Git simultaneously to prevent 'context amnesia'

#### Execution Strategy

**Sequential Main Thread** (Foundation Work):
- **When**: Foundational architecture where Step B relies on Step A
- **Examples**: Interface definitions, type system foundations, core contracts
- **Action**: Execute linearly in main context for architectural coherence

**Swarm Mode Parallel** (Isolated Work):
- **When**: Contextually isolated tasks (unit tests, independent modules, documentation)
- **Examples**: Multiple test suites, independent adapter implementations, parallel bug fixes
- **Action**: Spawn Task tool with specialized agents (python-pro, test-automator, etc.)
- **Benefits**: Reduces main context load, enables true parallelism

#### File Locking Protocol

**Pre-Flight Check**:
- Agents MUST declare file targets before work: "🔒 Claiming lock on [file_path]"
- Check `.specify/file-locks.json` for active locks

**The Lock** (Maintained in `.specify/file-locks.json`):
```json
{
  "active_locks": [{
    "file_path": "/absolute/path/to/file.ts",
    "agent_id": "agent-identifier",
    "agent_type": "python-pro",
    "task_description": "Brief task description",
    "locked_at": "ISO 8601 timestamp",
    "expected_completion": "ISO 8601 timestamp"
  }]
}
```

**Rules**:
- If file_target locked by Agent A, Agent B is FORBIDDEN from modifying it
- Agent B must WAIT or REASSIGN to different file
- Prevents merge conflicts and race conditions

**Release**:
- Lock released only after task verification: "✅ Releasing lock on [file_path] - tests passing"
- Entry moved to `lock_history` with verification status

#### Unified State Tracking (HARD CONSTRAINT)

**Trigger Events**:
1. Sequential Milestone Completion (main thread completes foundation)
2. Parallel Swarm Merge (all sub-agents complete and locks released)

**Required Atomic Actions** (Do NOT proceed without sync):
1. **Memory Bank Update**:
   - `memory-bank/activeContext.md` (current work focus)
   - `memory-bank/progress.md` (what works, what's left)
   - `memory-bank/systemPatterns.md` (if architectural changes)

2. **Git Commit**:
   ```
   feat|fix|test|docs: <description>

   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude <noreply@anthropic.com>
   ```

**Phase Boundaries for Production Robustness**:
- Phase 0 → Phase 1: Research complete, design ready
- Phase 1 → Phase 2: Contracts complete, tests ready
- Phase 2 → Phase 3: Tests passing, implementation ready
- Phase 3 → Phase 4: Adapters complete, integration ready
- Phase 4 → Phase 5: Core components complete, advanced features ready
- Phase 5 → Phase 6: All features complete, deployment ready

**Parallel Opportunities**:
- Contract tests (StorageAdapter, SessionManager, EventBus - different files)
- Adapter implementations (FileStorage, InMemoryStorage, RedisStorage - independent)
- Advanced components (AgentHealthMonitor, EventBus, GroupConversationManager - isolated)

**Sequential Dependencies**:
- SessionManager requires StorageAdapter implementations
- All phases require Phase 1 contracts

---

### Runtime Development Guidance

For day-to-day development guidance and best practices, consult `/CLAUDE.md`.

The constitution defines WHAT we build and WHY. CLAUDE.md defines HOW we build it.

The distributed orchestration section defines HOW we coordinate parallel development.

---

**Version**: 1.1.0 | **Ratified**: 2025-11-22 | **Last Amended**: 2025-11-23
**Amendment**: Added Distributed Development Orchestration protocol (Section: Governance → Distributed Development Orchestration)
