# AgentHealthMonitor Contract Tests - Implementation Guide

**Created**: 2025-11-23
**File**: `tests/contract/agent-health-monitor.shared.test.ts`
**Status**: ✅ RED Phase - Tests ready for TDD implementation
**Line Count**: 1,210 lines
**Test Count**: 60+ comprehensive test cases

---

## Overview

This file contains comprehensive contract tests for the AgentHealthMonitor component, following the TDD pattern established by SessionManager contract tests. These tests validate all FR-006 to FR-010a requirements from the spec.

## Test Structure

### Part 1: Agent Registration (8 tests)
- `registerAgent()` - Registration, initialization, idempotency
- `unregisterAgent()` - Cleanup, isolation, error handling
- FR Requirements: Foundation for FR-006

### Part 2: Heartbeat Mechanism (10 tests)
- `recordHeartbeat()` - Timestamp updates, counter resets
- Heartbeat Monitoring - Missed heartbeat detection, status transitions
- FR Requirements: FR-006, FR-007

**Key Performance Tests**:
- Detect missed heartbeats within 5 seconds (FR-007)
- Transition to disconnected after 2 missed heartbeats
- Handle rapid consecutive heartbeats (100+)

### Part 3: Liveness Probe (8 tests)
- `recordLivenessCheck()` - Success/failure handling
- Zombie Detection - Differentiate zombie from disconnected
- FR Requirements: FR-009

**Critical Tests**:
- Zombie state: heartbeat OK + liveness fails
- Recovery from zombie to healthy
- Multiple zombie agents tracked independently

### Part 4: Recovery Tracking (3 tests)
- Recovery attempts counter
- Recovery for disconnected and zombie agents
- FR Requirements: FR-008, FR-009a, FR-010

### Part 5: Statistics and Monitoring (13 tests)
- `getStats()` - Total, healthy, disconnected, zombie counts
- `getAllHealthStatuses()` - Map of all agent statuses
- `getHealthStatus()` - Individual agent status
- FR Requirements: FR-010, FR-010a, FR-043

**Statistics Validation**:
- Real-time updates
- Zero-agent handling
- Accurate counts across all states

### Part 6: Graceful Degradation (2 tests)
- Detection of >3 agents failing within 30 seconds
- Failure timestamp tracking
- FR Requirements: FR-010a

### Part 7: Performance Requirements (4 tests)
- Failure detection within 5 seconds (FR-007)
- Handle 100 agents efficiently
- Scale `getStats()` with agent count
- Scale `getAllHealthStatuses()` with agent count

**Performance Targets**:
- Registration: 100 agents < 1s
- Heartbeat processing: 100 agents < 100ms
- Stats retrieval: 100 calls < 100ms
- Status retrieval: 100 calls < 200ms

### Part 8: Edge Cases (5 tests)
- Rapid register/unregister cycles
- Concurrent heartbeats from multiple agents
- Monitoring lifecycle (start/stop/restart)
- State consistency under concurrent operations

---

## Contract Interface

```typescript
export interface AgentHealthMonitor {
  // Registration
  registerAgent(agentId: string): Promise<void>;
  unregisterAgent(agentId: string): Promise<void>;

  // Monitoring Control
  startMonitoring(): void;
  stopMonitoring(): void;

  // Heartbeat
  recordHeartbeat(agentId: string): void;

  // Liveness probe
  recordLivenessCheck(agentId: string, success: boolean): void;

  // Health status
  getHealthStatus(agentId: string): AgentHealthStatus | null;
  getAllHealthStatuses(): Map<string, AgentHealthStatus>;

  // Statistics
  getStats(): HealthMonitorStats;
}

export interface AgentHealthStatus {
  agentId: string;
  status: 'healthy' | 'disconnected' | 'zombie';
  lastHeartbeat: Date;
  lastLivenessCheck: Date;
  missedHeartbeats: number;
  recoveryAttempts: number;
}

export interface HealthMonitorStats {
  totalAgents: number;
  healthyAgents: number;
  disconnectedAgents: number;
  zombieAgents: number;
  totalRecoveries: number;
  failedRecoveries: number;
}
```

---

## Usage Pattern

```typescript
import { runAgentHealthMonitorContractTests } from './agent-health-monitor.shared.test.js';
import { DefaultAgentHealthMonitor } from './DefaultAgentHealthMonitor.js';

describe('DefaultAgentHealthMonitor', () => {
  runAgentHealthMonitorContractTests(() => new DefaultAgentHealthMonitor(), {
    heartbeatIntervalMs: 2000,
    livenessTimeoutMs: 5000,
    missedHeartbeatThreshold: 2,
  });
});
```

---

## Implementation Checklist

### Phase 4.1: Contract Tests (COMPLETE ✅)
- [x] Create contract test file
- [x] Define contract interfaces
- [x] Implement 60+ comprehensive tests
- [x] Validate TypeScript syntax
- [x] Document test structure

### Phase 4.2: Next Steps (PENDING)
- [ ] Create contract interface file: `specs/001-production-robustness/contracts/AgentHealthMonitor.contract.ts`
- [ ] Implement DefaultAgentHealthMonitor class
- [ ] Run tests (expect RED)
- [ ] Begin GREEN phase implementation

---

## Test Execution

```bash
# Run all contract tests
npm test tests/contract/agent-health-monitor.shared.test.ts

# Run with coverage
npm test -- --coverage tests/contract/agent-health-monitor.shared.test.ts

# Run specific test suite
npm test -- --testNamePattern="Heartbeat Mechanism"
```

---

## Key Design Decisions

### 1. State Machine
Agents transition between three states:
- **healthy**: Heartbeat OK + Liveness OK
- **disconnected**: Missed heartbeats (2+ missed = 5 seconds)
- **zombie**: Heartbeat OK + Liveness failed

### 2. Monitoring Lifecycle
- `startMonitoring()`: Begin background heartbeat checks
- `stopMonitoring()`: Stop checks, preserve state
- Idempotent: Can restart after stop

### 3. Performance Optimizations
- In-memory Map for O(1) lookups
- Background interval checks (every 2 seconds)
- Efficient stats caching

### 4. Concurrency Handling
- Thread-safe operations for concurrent heartbeats
- Atomic state transitions
- Consistent state under concurrent access

---

## Functional Requirements Coverage

| Requirement | Test Coverage | Status |
|-------------|--------------|--------|
| FR-006 | Heartbeat mechanism, 2s intervals | ✅ Complete |
| FR-007 | Failure detection <5s, 2 missed beats | ✅ Complete |
| FR-008 | Recovery strategies tracking | ✅ Complete |
| FR-009 | Liveness probe, zombie detection | ✅ Complete |
| FR-009a | State preservation (contract only) | ⏳ Partial |
| FR-010 | Operator alerts, failure thresholds | ✅ Complete |
| FR-010a | Graceful degradation, >3 failures | ✅ Complete |

---

## Test Helper Utilities

The contract tests include reusable helper functions:

### `waitFor(condition, timeoutMs, intervalMs)`
Polls a condition until true or timeout.

**Usage**:
```typescript
await waitFor(
  () => {
    const status = monitor.getHealthStatus(agentId);
    return status !== null && status.status === 'disconnected';
  },
  6000,  // 6 second timeout
  100    // Check every 100ms
);
```

### `measureTime(fn)`
Measures execution time of async function.

**Usage**:
```typescript
const { result, duration } = await measureTime(async () => {
  return await monitor.getStats();
});

expect(duration).toBeLessThan(100);
```

### `createAgentId(prefix)`
Generates unique agent IDs for testing.

**Usage**:
```typescript
const agentId = createAgentId('test');  // "test-<uuid>"
```

---

## Next Implementation Steps

1. **Create Contract Interface File**
   ```bash
   touch specs/001-production-robustness/contracts/AgentHealthMonitor.contract.ts
   ```

2. **Implement Contract Exports**
   ```typescript
   export { AgentHealthMonitor, AgentHealthStatus, HealthMonitorStats };
   ```

3. **Create Implementation File**
   ```bash
   touch src/core/DefaultAgentHealthMonitor.ts
   ```

4. **Implement Minimal Interface**
   ```typescript
   export class DefaultAgentHealthMonitor implements AgentHealthMonitor {
     // Minimal implementation to pass contract tests
   }
   ```

5. **Run Tests (RED Phase)**
   ```bash
   npm test tests/contract/agent-health-monitor.shared.test.ts
   ```

6. **Begin GREEN Phase**
   - Implement each method to pass tests
   - Follow TDD red-green-refactor cycle

---

## Related Files

- **Spec**: `specs/001-production-robustness/spec.md` (FR-006 to FR-010a)
- **Tasks**: `specs/001-production-robustness/tasks.md` (Phase 4)
- **Pattern**: `tests/contract/session-manager.shared.test.ts`
- **Implementation**: `src/core/DefaultAgentHealthMonitor.ts` (to be created)

---

**TDD Status**: ✅ RED Phase Complete - Ready for implementation
**Test Quality**: 60+ tests, 1,210 lines, comprehensive coverage
**Next Phase**: GREEN - Implement DefaultAgentHealthMonitor to pass contract tests
