# Event Bus/Message Broker Library Recommendation

**Date**: 2025-11-23
**Context**: SmallTalk Framework - Agent Communication Architecture
**Decision**: Event-driven architecture for inter-agent messaging

---

## Executive Summary

**Recommendation**: Implement a **custom EventEmitter extending Node.js native EventEmitter** with event persistence wrapper

**Rationale**: This approach provides the optimal balance of performance, type safety, zero dependencies, and complete control over persistence/replay functionality required for SmallTalk's agent communication needs.

---

## Requirements Analysis

| Requirement | Priority | Rationale |
|------------|----------|-----------|
| Lightweight (minimal dependencies) | **CRITICAL** | Framework library must minimize bloat for consumers |
| Topic-based subscriptions | **HIGH** | Agent communication requires event routing by topic |
| Event persistence capability | **HIGH** | Debugging, replay, and audit trail functionality |
| TypeScript-native support | **HIGH** | Framework is TypeScript-first |
| <10ms propagation latency | **MEDIUM** | In-process communication should be near-instant |
| Event replay/history | **MEDIUM** | Time-travel debugging and agent conversation reconstruction |

---

## Evaluation Matrix

### 1. tseep (Fastest Performance)

**Specifications**:
- Size: 381 bytes
- Performance: 89,030,882 ops/sec (12x faster than EventEmitter3)
- Dependencies: Zero
- TypeScript: Native, fully typed

**Pros**:
- ✅ Unmatched performance - [89M ops/sec in Sep 2024 benchmarks](https://github.com/Morglod/tseep/blob/master/benchmarks/results.sep26-2024.md)
- ✅ Smallest bundle size (381 bytes)
- ✅ Zero dependencies
- ✅ Full TypeScript support with typed event maps
- ✅ Implements NodeJS.EventEmitter standard

**Cons**:
- ❌ No built-in persistence/replay
- ❌ Uses optimization tricks (passes 5+ args, avoids spread) that may affect debugging
- ❌ Less mature ecosystem (fewer GitHub stars/downloads vs EventEmitter3)
- ⚠️ Performance comes from optimization hacks that bypass standard patterns

**Verdict**: Overkill for agent communication. The 12x performance gain is unnecessary for event-driven architecture where I/O dominates, and optimization tricks may complicate debugging.

**Sources**:
- [tseep GitHub](https://github.com/Morglod/tseep)
- [September 2024 Benchmarks](https://github.com/Morglod/tseep/blob/master/benchmarks/results.sep26-2024.md)

---

### 2. EventEmitter3 (Popular Choice)

**Specifications**:
- Size: ~2KB minified
- Performance: 5,698,255 ops/sec (24% faster than EventEmitter2)
- Dependencies: Zero
- TypeScript: Excellent support via @types/eventemitter3

**Pros**:
- ✅ Zero dependencies
- ✅ Excellent performance - [5.7M ops/sec in Nov 2024 benchmarks](https://npmtrends.com/event-emitter-vs-eventemitter2-vs-eventemitter3-vs-eventemitter4-vs-events)
- ✅ Battle-tested (widely used in production)
- ✅ Strong TypeScript support
- ✅ Small footprint (2KB)
- ✅ Micro-optimized for various code paths

**Cons**:
- ❌ No built-in persistence/replay
- ❌ No native TypeScript implementation (uses @types)
- ⚠️ Still requires wrapper for persistence/history

**Verdict**: Strong contender. Proven reliability and performance without over-optimization. Requires custom persistence wrapper.

**Sources**:
- [EventEmitter3 npm](https://www.npmjs.com/package/eventemitter3)
- [EventEmitter3 vs EventEmitter2 benchmarks](https://npmtrends.com/event-emitter-vs-eventemitter2-vs-eventemitter3-vs-eventemitter4-vs-events)
- [Performance comparison](https://github.com/primus/eventemitter3/tree/master/benchmarks)

---

### 3. EventEmitter2 (Feature-Rich)

**Specifications**:
- Size: ~3KB minified
- Performance: 4,588,433 ops/sec
- Dependencies: Zero
- TypeScript: Good support via @types

**Pros**:
- ✅ Wildcard event patterns (`agent.*`, `message.**`)
- ✅ Namespace support
- ✅ Advanced features (max listeners, new listener notifications)
- ✅ Zero dependencies

**Cons**:
- ❌ Slower than EventEmitter3 (24% performance penalty)
- ❌ Larger bundle (3KB vs 2KB)
- ❌ No built-in persistence
- ⚠️ Feature-rich but we don't need wildcards/namespaces for agent communication

**Verdict**: Over-engineered for our use case. Wildcard patterns add complexity without clear benefit.

**Sources**:
- [npm comparison](https://npm-compare.com/event-emitter,eventemitter2,eventemitter3,mitt,tiny-emitter)

---

### 4. Custom EventEmitter (Recommended)

**Specifications**:
- Size: ~1-2KB (base EventEmitter) + 500 bytes (persistence wrapper)
- Performance: Native EventEmitter (~10M ops/sec for simple emit)
- Dependencies: Zero (extends Node.js built-in)
- TypeScript: Full control with strict typing

**Pros**:
- ✅ **Zero dependencies** - Extends Node.js built-in EventEmitter
- ✅ **Complete control** over persistence/replay implementation
- ✅ **Type-safe** with TypeScript generics (event map pattern)
- ✅ **Minimal bundle impact** - No external library
- ✅ **Event history** designed for SmallTalk's specific needs
- ✅ **Debuggability** - Direct access to persistence logic
- ✅ **Flexible** - Can add features incrementally

**Cons**:
- ⚠️ Requires implementation effort (~200 LOC)
- ⚠️ Need to maintain persistence logic

**Implementation Approach**:

```typescript
import { EventEmitter } from 'events';

interface EventMap {
  [eventName: string]: (...args: any[]) => void;
}

interface StoredEvent {
  id: string;
  topic: string;
  payload: any;
  timestamp: number;
  metadata?: Record<string, any>;
}

class SmallTalkEventBus<TEvents extends EventMap = EventMap> extends EventEmitter {
  private eventHistory: StoredEvent[] = [];
  private maxHistorySize: number = 1000;
  private persistenceEnabled: boolean = true;

  emit<K extends keyof TEvents>(
    topic: K,
    ...args: Parameters<TEvents[K]>
  ): boolean {
    // Store event if persistence enabled
    if (this.persistenceEnabled) {
      this.storeEvent(topic as string, args);
    }

    return super.emit(topic as string, ...args);
  }

  on<K extends keyof TEvents>(
    topic: K,
    listener: TEvents[K]
  ): this {
    return super.on(topic as string, listener as any);
  }

  once<K extends keyof TEvents>(
    topic: K,
    listener: TEvents[K]
  ): this {
    return super.once(topic as string, listener as any);
  }

  private storeEvent(topic: string, payload: any[]): void {
    const event: StoredEvent = {
      id: nanoid(),
      topic,
      payload,
      timestamp: Date.now(),
    };

    this.eventHistory.push(event);

    // Prevent unbounded growth
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  // Replay events matching filter
  replay(filter?: {
    topic?: string;
    since?: number;
    until?: number;
  }): void {
    let events = this.eventHistory;

    if (filter?.topic) {
      events = events.filter(e => e.topic === filter.topic);
    }

    if (filter?.since) {
      events = events.filter(e => e.timestamp >= filter.since);
    }

    if (filter?.until) {
      events = events.filter(e => e.timestamp <= filter.until);
    }

    events.forEach(event => {
      super.emit(event.topic, ...event.payload);
    });
  }

  // Get event history (read-only)
  getHistory(filter?: { topic?: string }): ReadonlyArray<StoredEvent> {
    if (!filter?.topic) {
      return this.eventHistory;
    }
    return this.eventHistory.filter(e => e.topic === filter.topic);
  }

  // Clear history (useful for testing)
  clearHistory(): void {
    this.eventHistory = [];
  }

  // Enable/disable persistence
  setPersistence(enabled: boolean): void {
    this.persistenceEnabled = enabled;
  }
}

// Usage with type safety
interface AgentEvents {
  'agent:message': (agentId: string, message: string) => void;
  'agent:join': (agentId: string) => void;
  'agent:leave': (agentId: string) => void;
  'conversation:start': (conversationId: string) => void;
  'conversation:end': (conversationId: string) => void;
}

const eventBus = new SmallTalkEventBus<AgentEvents>();

// Type-safe emit
eventBus.emit('agent:message', 'agent-1', 'Hello!');

// Type-safe subscription
eventBus.on('agent:message', (agentId, message) => {
  console.log(`${agentId}: ${message}`);
});

// Replay last 5 minutes of agent messages
eventBus.replay({
  topic: 'agent:message',
  since: Date.now() - 5 * 60 * 1000
});
```

**Verdict**: **RECOMMENDED**. Provides exactly what SmallTalk needs with zero external dependencies.

**Sources**:
- [Build Your Own Event Emitter](https://dev.to/codewithjohnson/build-your-own-event-emitter-10l8)
- [TypeScript Event Emitter Patterns](https://basarat.gitbook.io/typescript/main-1/typed-event)
- [Advanced TypeScript EventEmitter Usage](https://dev.to/ritikbanger/event-emitter-with-typescript-advanced-usage-328c)

---

### 5. mitt (Ultra-Lightweight)

**Specifications**:
- Size: 200 bytes (!)
- Performance: Fast but unbenched vs EventEmitter3
- Dependencies: Zero
- TypeScript: Native TypeScript

**Pros**:
- ✅ Incredibly small (200 bytes)
- ✅ Zero dependencies
- ✅ TypeScript-native
- ✅ Functional API (no `this` context issues)

**Cons**:
- ❌ No built-in persistence
- ❌ Missing features (no `once()`, limited API)
- ❌ Functional pattern doesn't align with SmallTalk's OOP architecture

**Verdict**: Too minimalist. Missing key features like `once()` that agents may need.

**Sources**:
- [mitt GitHub](https://github.com/developit/mitt)

---

### 6. Redis Pub/Sub (External Dependency)

**Specifications**:
- Size: ~250KB (redis client)
- Latency: 1-5ms (network + Redis)
- Dependencies: Redis server + client library
- TypeScript: Good support

**Pros**:
- ✅ Built-in persistence (Redis AOF/RDB)
- ✅ Pub/sub pattern
- ✅ Scalable to distributed systems

**Cons**:
- ❌ **External dependency** (Redis server required)
- ❌ **Network latency** (violates <10ms requirement for local events)
- ❌ **Heavy dependency** (250KB client + server infrastructure)
- ❌ Overkill for in-process agent communication

**Verdict**: Rejected. Introduces unnecessary complexity and latency for in-process events.

---

### 7. RabbitMQ Client (Enterprise Solution)

**Specifications**:
- Size: ~500KB (amqplib client)
- Latency: 5-15ms (network + broker)
- Dependencies: RabbitMQ server + client library

**Pros**:
- ✅ Enterprise-grade persistence
- ✅ Advanced routing (topic exchanges)
- ✅ Guaranteed delivery

**Cons**:
- ❌ **Massive external dependency** (RabbitMQ server)
- ❌ **Significant latency** (violates <10ms requirement)
- ❌ **Heavy client library** (500KB+)
- ❌ Complete overkill for in-process communication

**Verdict**: Rejected. Designed for distributed systems, not in-process agent communication.

---

## Final Recommendation

### Chosen Solution: Custom EventEmitter

**Library/Approach**: Custom TypeScript class extending Node.js native EventEmitter with persistence wrapper

**Rationale**:

1. **Zero Dependencies**: Extends built-in Node.js EventEmitter - no external packages required
2. **Complete Control**: Full ownership of persistence/replay logic tailored to SmallTalk's needs
3. **Type Safety**: TypeScript generics with event map pattern provide compile-time safety
4. **Performance**: Native EventEmitter performance (~10M ops/sec) far exceeds requirements
5. **Minimal Bloat**: ~200 LOC implementation vs 2-500KB external libraries
6. **Debuggability**: Direct access to persistence logic without diving into third-party code
7. **Flexibility**: Can evolve persistence strategy (in-memory → disk → database) without changing API

**Trade-offs Considered**:

| Alternative | Why Not Chosen |
|------------|---------------|
| **tseep** | Performance overkill (89M vs 10M ops/sec unnecessary), optimization tricks complicate debugging |
| **EventEmitter3** | Good option but still requires custom persistence wrapper - why add dependency? |
| **EventEmitter2** | Feature bloat (wildcards/namespaces unused), slower than alternatives |
| **mitt** | Too minimal (missing `once()`, etc.), functional API doesn't fit SmallTalk architecture |
| **Redis/RabbitMQ** | External infrastructure violates "lightweight" requirement, adds latency |

---

## Implementation Plan

### Phase 1: Core Event Bus (Week 1)
- [ ] Create `SmallTalkEventBus` class extending EventEmitter
- [ ] Implement TypeScript event map generics
- [ ] Add type-safe `emit()`, `on()`, `once()` wrappers
- [ ] Write unit tests for basic pub/sub functionality

### Phase 2: Persistence Layer (Week 1-2)
- [ ] Implement in-memory event history (circular buffer)
- [ ] Add `replay()` method with filtering (topic, time range)
- [ ] Add `getHistory()` for read-only access
- [ ] Implement `clearHistory()` for testing
- [ ] Add persistence enable/disable toggle

### Phase 3: Advanced Features (Week 2-3)
- [ ] Add event metadata support (agent ID, conversation ID, etc.)
- [ ] Implement snapshot mechanism (save/restore state)
- [ ] Add event filtering/search capabilities
- [ ] Create debugging utilities (event timeline visualization)

### Phase 4: Integration (Week 3-4)
- [ ] Integrate event bus into SmallTalk core
- [ ] Update Agent class to use event bus for communication
- [ ] Add conversation replay feature to CLI interface
- [ ] Document event API for framework consumers

---

## Performance Characteristics

Based on research and Node.js EventEmitter benchmarks:

| Metric | Expected Performance |
|--------|---------------------|
| **Event Propagation** | <1ms (in-process, synchronous) |
| **Emit Rate** | ~10M ops/sec (native EventEmitter) |
| **Memory Overhead** | ~100 bytes per stored event (1000 events = 100KB) |
| **History Storage** | Configurable max (default: 1000 events) |
| **Replay Speed** | ~1M events/sec (re-emit from array) |

All metrics far exceed the <10ms latency requirement.

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **Memory Growth** | Medium | Circular buffer with max size, configurable persistence toggle |
| **Maintenance Burden** | Low | Simple implementation (~200 LOC), well-understood pattern |
| **Type Safety** | Low | TypeScript generics enforce compile-time event contracts |
| **Performance** | Very Low | Native EventEmitter exceeds requirements by 1000x |

---

## Alternative Scenarios

If future requirements change:

| Scenario | Recommended Alternative |
|----------|------------------------|
| **Need distributed agents** (multi-process) | Redis Pub/Sub or NATS.io |
| **Want battle-tested library** | EventEmitter3 + custom persistence wrapper |
| **Need maximum performance** | tseep + custom persistence wrapper |
| **Prefer functional style** | mitt + custom persistence wrapper |

Current recommendation remains valid for in-process, single-framework use case.

---

## Dependencies Introduced

**Production Dependencies**: None (uses Node.js built-in EventEmitter)

**Development Dependencies**: None (standard TypeScript, Jest for testing)

**Optional Enhancements**:
- `nanoid` (already in project) - Event ID generation
- `yaml` (already in project) - Event history serialization

---

## References

### Performance Benchmarks
- [EventEmitter3 vs EventEmitter2 Performance](https://npmtrends.com/event-emitter-vs-eventemitter2-vs-eventemitter3-vs-eventemitter4-vs-events)
- [tseep September 2024 Benchmarks](https://github.com/Morglod/tseep/blob/master/benchmarks/results.sep26-2024.md)
- [npm Event Emitter Comparison](https://npm-compare.com/eventemitter3,mitt,nanoevents,tiny-emitter)

### TypeScript Patterns
- [Build Your Own Event Emitter](https://dev.to/codewithjohnson/build-your-own-event-emitter-10l8)
- [TypeScript Event Emitter Deep Dive](https://basarat.gitbook.io/typescript/main-1/typed-event)
- [Advanced EventEmitter Usage](https://dev.to/ritikbanger/event-emitter-with-typescript-advanced-usage-328c)
- [TypeScript Event Emitter Patterns](https://rjzaworski.com/2019/10/event-emitters-in-typescript)

### Event Sourcing & Persistence
- [Event Sourcing Pattern](https://microservices.io/patterns/data/event-sourcing.html)
- [Event Replay Patterns](https://sebastiandedeyne.com/replaying-events/)
- [Azure Event Sourcing Architecture](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing)

### Library Documentation
- [EventEmitter3 GitHub](https://github.com/primus/eventemitter3)
- [tseep GitHub](https://github.com/Morglod/tseep)
- [mitt GitHub](https://github.com/developit/mitt)
- [Node.js EventEmitter API](https://nodejs.org/api/events.html)

---

## Appendix: Code Example

See implementation approach section above for full TypeScript example demonstrating:
- Type-safe event map interface
- Custom EventEmitter class with persistence
- Event history storage and retrieval
- Replay functionality with filtering
- Usage patterns with SmallTalk agent events

---

**Decision Status**: Recommended for Implementation
**Next Steps**: Review with team, proceed to Phase 1 implementation
**Review Date**: 2025-12-01 (after initial implementation)
