# Production Robustness Implementation Tasks

**Feature**: Production Robustness Enhancements
**Branch**: `001-production-robustness`
**Generated**: 2025-11-23
**Status**: Phase 1 Complete - Ready for TDD Implementation

This document provides a comprehensive, dependency-ordered task breakdown for implementing all 5 user stories with strict Test-Driven Development (TDD) workflow.

---

## Executive Summary

**Total Tasks**: 126 across 8 phases
**Implementation Pattern**: Red-Green-Refactor TDD cycle
**Completion Criteria**: All 56 functional requirements (FR-001 to FR-056) implemented with passing tests

### Task Breakdown

| Phase | Description | Tasks | Duration | Priority |
|-------|-------------|-------|----------|----------|
| 1 | Setup | 8 | 2 hours | P0 |
| 2 | Foundational | 18 | 1 day | P0 |
| 3 | US1 - Session Persistence | 22 | 2 days | P1 |
| 4 | US2 - Agent Health | 20 | 2 days | P1 |
| 5 | US3 - Event-Driven | 24 | 2 days | P2 |
| 6 | US4 - Group Collaboration | 16 | 1.5 days | P2 |
| 7 | US5 - Externalized State | 10 | 1 day | P3 |
| 8 | Polish & Cross-Cutting | 8 | 1 day | P3 |
| **Total** | | **126** | **~2 weeks** | |

---

## Task Organization Principles

### TDD Workflow (Mandatory)

**Red-Green-Refactor Cycle**:
1. **RED**: Write failing test first
2. **GREEN**: Write minimal code to pass
3. **REFACTOR**: Improve quality while keeping tests green

**Rules**:
- ❌ NO production code without failing test
- ✅ Contract tests validate API contracts
- ✅ Tests runnable independently

### File Locking Protocol

Before any task:
```bash
# Check .specify/file-locks.json
# If unlocked: Add lock entry
# After verification: Release lock → Update Memory Bank → Git commit
```

---

## Phase 1: Setup (8 tasks, 2 hours)

### 1.1: Project Structure
- Create directories: `src/core/`, `src/persistence/`, `tests/contract/`, `tests/integration/`, `tests/unit/`
- Verify `src/types/robustness.ts` exists

### 1.2: Install Dependencies
- Jest, zlib types, nanoid
- Verify: `npx tsc --noEmit`

### 1.3: Jest Configuration
- ES modules support
- Coverage: 80% threshold
- Test patterns: `tests/**/*.test.ts`

### 1.4: Environment Configuration
- `.env.example` with FR-051 variables
- `src/config/environment.ts`

### 1.5: Data Directories
- `data/{sessions,agent-state,events}/`
- Permissions: 700

### 1.6: TypeScript Path Aliases
- `@core/*`, `@persistence/*`, `@types/*`

### 1.7: Logging Infrastructure
- `src/utils/logger.ts`
- Structured JSON (FR-045)
- Correlation IDs

### 1.8: Metrics Infrastructure
- `src/utils/metrics.ts`
- Prometheus format (FR-043)

---

## Phase 2: Foundational (18 tasks, 1 day)

### 2.1-2.4: StorageAdapter Contract Tests
- **RED**: Lifecycle, session ops, batch/KV, performance/stats
- **Target**: Contract test suite complete

### 2.5-2.8: FileStorageAdapter
- **GREEN**: Implement to pass contract tests
- **FR**: FR-001 to FR-005, FR-034a (chmod 600)
- **Features**: JSON files, gzip compression >100KB, atomic writes

### 2.9-2.12: InMemoryStorageAdapter
- **GREEN**: Testing utility
- **Features**: Map-based, <1ms operations

### 2.13-2.16: SessionSerializer Tests
- **RED**: JSON serialization, size/trimming, error handling, integration
- **FR**: FR-002, FR-009a

### 2.17: StorageAdapter Factory
- Create adapters by type ('file', 'memory', 'redis', 'postgres')

### 2.18: Phase 2 Verification
- All contract tests pass (100%)
- Coverage >80%
- Zero TypeScript errors

**Parallel Opportunities**:
- Tasks 2.1-2.4: Contract tests (4 parallel)
- Tasks 2.5-2.8 + 2.9-2.12: Adapters (2 parallel)
- Tasks 2.13-2.16: Serializer tests (independent)

---

## Phase 3: US1 - Session Persistence (22 tasks, 2 days)

**User Story**: Session Persistence and Recovery
**FR**: FR-001 to FR-005

### 3.1: SessionManager Contract
- **RED**: Create, save, restore tests
- **GREEN**: Implement with StorageAdapter DI
- **FR**: UUID v4, retry logic (FR-002a)

### 3.2: State Management
- **FR**: FR-004, FR-004a
- State transitions: active → idle → expired
- Background cleanup (5 minutes)

### 3.3: Listing and Filtering
- State filter, pagination, timestamp filter

### 3.4: Conversation History
- **FR**: FR-003
- Message append, ordering, persistence

### 3.5: Agent State Management
- **FR**: FR-003
- Map<agentId, AgentState>

### 3.6: Optimistic Locking
- **FR**: FR-005
- Version conflicts, retry (3x, 100ms backoff), last-write-wins

### 3.7: Statistics and Metrics
- **FR**: FR-037, FR-038, FR-043
- session_count gauge, stats caching

### 3.8: Retry and Error Handling
- **FR**: FR-002a, FR-002b
- Retry: 1s, 5s, 30s backoff
- Background saves every 60s
- CRITICAL alert after 5 minutes

### 3.9: Performance Optimization
- **SC**: SC-007 (100ms), SC-009 (50ms)
- LRU cache for recent sessions

### 3.10: Integration Tests
- Lifecycle, concurrent access, expiration, large sessions (1000+ messages), crash recovery, stress test (100 sessions)

---

## Phase 4: US2 - Agent Health (20 tasks, 2 days)

**User Story**: Agent Disconnection Detection and Recovery
**FR**: FR-006 to FR-010

### 4.1: AgentHealthMonitor Contract
- **FR**: FR-006
- Register, unregister, start/stop monitoring

### 4.2: Heartbeat Mechanism
- **FR**: FR-006, FR-007
- Poll every 2s, detect failures within 5s, 2 missed beats → disconnected

### 4.3: Activity Tracking
- **FR**: FR-009 (liveness probe)
- Zombie detection (heartbeat OK, liveness fails)

### 4.4: Recovery Strategies
- **FR**: FR-008, FR-009a
- restart, replace, alert
- State save/restore
- 90% auto-recovery (SC-004)

### 4.5: Event Replay During Recovery
- **FR**: FR-009a, FR-016a
- Query EventBus for missed events
- Idempotent replay, chronological order
- >50% failure → degraded state

### 4.6: Health Statistics
- **FR**: FR-010, FR-043
- agent_health_status gauge
- Heartbeat/recovery counters

### 4.7: Graceful Degradation
- **FR**: FR-010a
- >3 agents fail in 30s → degradation mode
- Pause new sessions, reduce limit 100→50
- Recovery every 60s, exit <2 failed for 120s

### 4.8: Integration Tests
- Complete lifecycle, heartbeat failure, zombie detection, state preservation, degradation, stress test (50 agents)

---

## Phase 5: US3 - Event-Driven (24 tasks, 2 days)

**User Story**: Event-Driven Agent Communication
**FR**: FR-011 to FR-016

### 5.1: EventBus Contract
- **FR**: FR-011, FR-012
- Publish-subscribe, wildcard topics ('agent:*')

### 5.2: At-Least-Once Delivery
- **FR**: FR-011a
- Processed event registry (Map<subscriberId, Set<eventId>>)
- LRU eviction (10,000 entries), hourly cleanup

### 5.3: Latency Optimization
- **FR**: FR-013, **SC**: SC-008 (10ms p95)
- Latency measurement, violations logged
- CRITICAL alert if p95 >10ms for 5 minutes

### 5.4: Event Persistence
- **FR**: FR-014
- Append-only log (JSONL format)
- `data/events/<topic>.log`
- Retention: 24 hours (configurable)
- Hourly cleanup

### 5.5: Event Replay
- **FR**: FR-014, **SC**: SC-011 (200ms)
- Filtering: time, priority, topics, limit
- Read JSONL, streaming for large logs

### 5.6: Replay Policies
- **FR**: FR-016a, FR-016b, FR-016c
- none, full, critical-only (default)
- YAML config support

### 5.7: Statistics and Metrics
- **FR**: FR-015, FR-043
- event_throughput counter
- event_propagation_latency_ms histogram (p50, p95, p99)

### 5.8: Integration Tests
- Complete flow, persistence/replay, at-least-once, policies, cleanup, stress test (10k events/sec)

---

## Phase 6: US4 - Group Collaboration (16 tasks, 1.5 days)

**User Story**: Group Conversation Collaboration
**FR**: FR-017 to FR-021

### 6.1: GroupConversationManager Contract
- **FR**: FR-017, FR-019
- 2-10 agents (FR-036), shared context

### 6.2: Round-Robin Speaker Selection
- **FR**: FR-018
- Speaker queue, rotation, lastSpeakerId tracking

### 6.3: LLM-Based Speaker Selection
- **FR**: FR-018, FR-015
- Context analysis, capability matching
- <100ms p95, fallback to round-robin

### 6.4: Priority-Based Speaker Selection
- **FR**: FR-018
- Highest priority, ties → round-robin, throttling

### 6.5: Speaker Selection Throttling
- **FR**: FR-020
- Max 3 consecutive turns, cooldown (1 turn)
- Override for critical events

### 6.6: Workflow State Management
- **FR**: FR-021
- Task queue, completion status, persistence

### 6.7: Integration Tests
- Complete flow, all 3 strategies, shared context, workflow state, performance (10 agents, <100ms), stress test

**Parallel Opportunities**:
- Tasks 6.2-6.4: Speaker selection strategies (3 parallel)

---

## Phase 7: US5 - Externalized State (10 tasks, 1 day)

**User Story**: Externalized State Management
**FR**: FR-022 to FR-026

### 7.1-7.3: RedisStorageAdapter
- **GREEN**: Pass all contract tests
- Redis hashes (session:<id>), TTL, pipelining
- Key-value with Redis strings

### 7.4-7.6: PostgresStorageAdapter
- **GREEN**: Pass all contract tests
- SQL schema (sessions, kv tables), prepared statements
- Optimistic locking (version column), transactions

### 7.7: Storage Adapter Comparison
- Performance comparison across all adapters
- Feature parity validation

**Parallel Opportunities**:
- Tasks 7.1-7.3 + 7.4-7.6: Both adapters (2 parallel)

---

## Phase 8: Polish & Cross-Cutting (8 tasks, 1 day)

### 8.1: Health and Readiness Endpoints
- **FR**: FR-052, FR-053
- GET /health (status JSON)
- GET /ready (200 or 503)

### 8.2: Prometheus Metrics Endpoint
- **FR**: FR-043
- GET /metrics (Prometheus format)
- All required metrics

### 8.3: Graceful Shutdown
- **FR**: FR-054
- SIGTERM → 5-step shutdown
- <60 seconds total

### 8.4: Docker Configuration
- **FR**: FR-050
- Dockerfile (multi-stage)
- docker-compose.yml (app, redis, postgres)

### 8.5: Deployment Documentation
- **FR**: FR-055
- Docker setup, environment variables, monitoring, backup/restore

### 8.6: Example Application
- `examples/production-robustness-demo.ts`
- All 5 user stories demonstrated

### 8.7: Integration Test Suite
- End-to-end (100 concurrent sessions)
- All user stories working together

### 8.8: Final Verification
- 100% test pass rate
- >80% coverage
- All 56 FRs implemented
- All 30 success criteria met
- Zero TypeScript errors
- Production-ready

---

## Parallel Execution Opportunities

### High-Value Parallelization

**Phase 2**:
- Contract tests (4 parallel)
- Adapters (2 parallel)
- Serializer tests (independent)
- **Benefit**: 4x speedup

**Phase 3-5**:
- SessionManager, AgentHealthMonitor, EventBus
- **Benefit**: 3x speedup

**Phase 6**:
- Speaker selection strategies (3 parallel)
- **Benefit**: 3x speedup

**Phase 7**:
- Redis and Postgres adapters (2 parallel)
- **Benefit**: 2x speedup

**Overall**: 20-30% time reduction with parallelization

---

## Distributed Development Protocol

### Pre-Flight Check
```bash
# 1. Check .specify/file-locks.json
# 2. If unlocked: Add lock entry
# 3. After verification: Release lock
```

### Task Completion
```bash
# 1. Move lock to history
# 2. Update Memory Bank (activeContext.md, progress.md)
# 3. Atomic Git commit
```

### Phase Boundary (HARD CONSTRAINT)
```bash
# DO NOT proceed without:
# 1. Memory Bank update
# 2. Git commit
```

---

## Success Metrics

- **Test Coverage**: 100% pass rate, >80% code coverage
- **Requirements**: All 56 FRs implemented
- **Success Criteria**: All 30 criteria met
- **Performance**: SC-007 (100ms), SC-009 (50ms), SC-008 (10ms), SC-011 (200ms)
- **Quality**: Zero TypeScript errors
- **Deployment**: Docker, documentation, example app

---

**Next Action**: Begin Phase 2, Task 2.1 (StorageAdapter Contract Tests - Lifecycle)
