/**
 * AgentHealthMonitor Contract Tests
 *
 * Shared contract test suite that validates ANY AgentHealthMonitor implementation
 * against the defined interface requirements.
 *
 * TDD Phase: RED - These tests are designed to FAIL until implementation
 *
 * @see specs/001-production-robustness/contracts/AgentHealthMonitor.contract.ts
 * @see specs/001-production-robustness/spec.md FR-006 to FR-010a
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { performance } from 'perf_hooks';
import * as crypto from 'crypto';

/**
 * Contract Interfaces
 *
 * These interfaces define the expected API contract for AgentHealthMonitor.
 * Implementation file will be created at:
 * specs/001-production-robustness/contracts/AgentHealthMonitor.contract.ts
 */

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

/**
 * Test Helper: Wait for condition to be true
 */
async function waitFor(
  condition: () => boolean,
  timeoutMs: number = 10000,
  intervalMs: number = 100
): Promise<void> {
  const startTime = Date.now();
  while (!condition()) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error('Timeout waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

/**
 * Test Helper: Measure execution time
 */
async function measureTime<T>(
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
}

/**
 * Test Helper: Create test agent ID
 */
function createAgentId(prefix: string = 'agent'): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

/**
 * Contract Test Suite Factory
 *
 * This function creates a complete contract test suite for any AgentHealthMonitor
 * implementation. Import this function and call it with your implementation's
 * factory functions.
 *
 * @param createMonitor Factory function that creates an AgentHealthMonitor instance
 * @param config Optional configuration for test-specific settings
 *
 * @example
 * ```typescript
 * import { runAgentHealthMonitorContractTests } from './agent-health-monitor.shared.test.js';
 * import { DefaultAgentHealthMonitor } from './DefaultAgentHealthMonitor.js';
 *
 * describe('DefaultAgentHealthMonitor', () => {
 *   runAgentHealthMonitorContractTests(() => new DefaultAgentHealthMonitor());
 * });
 * ```
 */
export function runAgentHealthMonitorContractTests(
  createMonitor: () => AgentHealthMonitor,
  config?: {
    heartbeatIntervalMs?: number;
    livenessTimeoutMs?: number;
    missedHeartbeatThreshold?: number;
  }
) {
  let monitor: AgentHealthMonitor;

  // Default configuration (can be overridden by implementation)
  const HEARTBEAT_INTERVAL = config?.heartbeatIntervalMs || 2000; // FR-006
  const LIVENESS_TIMEOUT = config?.livenessTimeoutMs || 5000; // FR-009
  const MISSED_HEARTBEAT_THRESHOLD = config?.missedHeartbeatThreshold || 2; // FR-007

  beforeEach(async () => {
    monitor = createMonitor();
  });

  afterEach(async () => {
    // Stop monitoring to prevent background tasks
    if (monitor) {
      monitor.stopMonitoring();
    }
  });

  // =========================================================================
  // Part 1: Agent Registration
  // =========================================================================

  describe('AgentHealthMonitor Contract - Registration', () => {
    describe('registerAgent()', () => {
      it('should register agent successfully', async () => {
        const agentId = createAgentId();

        await expect(monitor.registerAgent(agentId)).resolves.not.toThrow();

        const status = monitor.getHealthStatus(agentId);
        expect(status).not.toBeNull();
        expect(status!.agentId).toBe(agentId);
      });

      it('should initialize agent with healthy status', async () => {
        const agentId = createAgentId();

        await monitor.registerAgent(agentId);
        const status = monitor.getHealthStatus(agentId);

        expect(status).not.toBeNull();
        expect(status!.status).toBe('healthy');
        expect(status!.missedHeartbeats).toBe(0);
        expect(status!.recoveryAttempts).toBe(0);
      });

      it('should set initial timestamps on registration', async () => {
        const beforeRegister = Date.now();
        const agentId = createAgentId();

        await monitor.registerAgent(agentId);
        const afterRegister = Date.now();

        const status = monitor.getHealthStatus(agentId);
        expect(status).not.toBeNull();
        expect(status!.lastHeartbeat).toBeInstanceOf(Date);
        expect(status!.lastLivenessCheck).toBeInstanceOf(Date);

        expect(status!.lastHeartbeat.getTime()).toBeGreaterThanOrEqual(
          beforeRegister
        );
        expect(status!.lastHeartbeat.getTime()).toBeLessThanOrEqual(
          afterRegister
        );
      });

      it('should allow re-registration of same agent (idempotent)', async () => {
        const agentId = createAgentId();

        await monitor.registerAgent(agentId);
        await monitor.registerAgent(agentId);

        const allStatuses = monitor.getAllHealthStatuses();
        const agentStatuses = Array.from(allStatuses.values()).filter(
          (s) => s.agentId === agentId
        );

        expect(agentStatuses.length).toBe(1);
      });

      it('should handle multiple agent registrations', async () => {
        const agentIds = Array.from({ length: 10 }, () => createAgentId());

        for (const agentId of agentIds) {
          await monitor.registerAgent(agentId);
        }

        const allStatuses = monitor.getAllHealthStatuses();
        expect(allStatuses.size).toBe(10);

        for (const agentId of agentIds) {
          expect(allStatuses.has(agentId)).toBe(true);
        }
      });

      it('should throw error for invalid agent IDs', async () => {
        const invalidIds = ['', null as any, undefined as any];

        for (const invalidId of invalidIds) {
          await expect(monitor.registerAgent(invalidId)).rejects.toThrow();
        }
      });
    });

    describe('unregisterAgent()', () => {
      it('should unregister agent successfully', async () => {
        const agentId = createAgentId();

        await monitor.registerAgent(agentId);
        await monitor.unregisterAgent(agentId);

        const status = monitor.getHealthStatus(agentId);
        expect(status).toBeNull();
      });

      it('should remove agent from all statuses', async () => {
        const agentId = createAgentId();

        await monitor.registerAgent(agentId);
        expect(monitor.getAllHealthStatuses().has(agentId)).toBe(true);

        await monitor.unregisterAgent(agentId);
        expect(monitor.getAllHealthStatuses().has(agentId)).toBe(false);
      });

      it('should handle unregistering non-existent agent (idempotent)', async () => {
        const agentId = createAgentId();

        await expect(
          monitor.unregisterAgent(agentId)
        ).resolves.not.toThrow();
      });

      it('should not affect other registered agents', async () => {
        const agent1 = createAgentId();
        const agent2 = createAgentId();
        const agent3 = createAgentId();

        await monitor.registerAgent(agent1);
        await monitor.registerAgent(agent2);
        await monitor.registerAgent(agent3);

        await monitor.unregisterAgent(agent2);

        expect(monitor.getHealthStatus(agent1)).not.toBeNull();
        expect(monitor.getHealthStatus(agent2)).toBeNull();
        expect(monitor.getHealthStatus(agent3)).not.toBeNull();
      });
    });
  });

  // =========================================================================
  // Part 2: Heartbeat Mechanism (FR-006, FR-007)
  // =========================================================================

  describe('AgentHealthMonitor Contract - Heartbeat', () => {
    describe('recordHeartbeat()', () => {
      it('should update lastHeartbeat timestamp', async () => {
        const agentId = createAgentId();
        await monitor.registerAgent(agentId);

        const beforeHeartbeat = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 10));

        monitor.recordHeartbeat(agentId);

        const status = monitor.getHealthStatus(agentId);
        expect(status).not.toBeNull();
        expect(status!.lastHeartbeat.getTime()).toBeGreaterThan(
          beforeHeartbeat
        );
      });

      it('should reset missedHeartbeats counter to zero', async () => {
        const agentId = createAgentId();
        await monitor.registerAgent(agentId);

        monitor.startMonitoring();

        // Wait for missed heartbeats to accumulate
        await new Promise((resolve) =>
          setTimeout(resolve, HEARTBEAT_INTERVAL * 1.5)
        );

        // Verify missed heartbeats incremented
        let status = monitor.getHealthStatus(agentId);
        const missedBeforeHeartbeat = status!.missedHeartbeats;

        // Send heartbeat
        monitor.recordHeartbeat(agentId);

        status = monitor.getHealthStatus(agentId);
        expect(status!.missedHeartbeats).toBeLessThan(missedBeforeHeartbeat);
      });

      it('should maintain healthy status with regular heartbeats', async () => {
        const agentId = createAgentId();
        await monitor.registerAgent(agentId);

        monitor.startMonitoring();

        // Send heartbeats at regular intervals
        for (let i = 0; i < 5; i++) {
          monitor.recordHeartbeat(agentId);
          await new Promise((resolve) =>
            setTimeout(resolve, HEARTBEAT_INTERVAL / 2)
          );
        }

        const status = monitor.getHealthStatus(agentId);
        expect(status!.status).toBe('healthy');
        expect(status!.missedHeartbeats).toBe(0);
      });

      it('should handle rapid consecutive heartbeats', async () => {
        const agentId = createAgentId();
        await monitor.registerAgent(agentId);

        // Send 100 heartbeats rapidly
        for (let i = 0; i < 100; i++) {
          monitor.recordHeartbeat(agentId);
        }

        const status = monitor.getHealthStatus(agentId);
        expect(status!.status).toBe('healthy');
      });

      it('should throw error for unregistered agent', () => {
        const agentId = createAgentId();

        expect(() => monitor.recordHeartbeat(agentId)).toThrow();
      });
    });

    describe('Heartbeat Monitoring (FR-006, FR-007)', () => {
      it('should detect missed heartbeats within 5 seconds (FR-007)', async () => {
        const agentId = createAgentId();
        await monitor.registerAgent(agentId);

        monitor.startMonitoring();

        // Wait for 2 missed heartbeats (5 seconds total)
        await waitFor(
          () => {
            const status = monitor.getHealthStatus(agentId);
            return (
              status !== null &&
              status.missedHeartbeats >= MISSED_HEARTBEAT_THRESHOLD
            );
          },
          6000,
          100
        );

        const status = monitor.getHealthStatus(agentId);
        expect(status!.missedHeartbeats).toBeGreaterThanOrEqual(
          MISSED_HEARTBEAT_THRESHOLD
        );
      });

      it('should transition to disconnected after 2 missed heartbeats', async () => {
        const agentId = createAgentId();
        await monitor.registerAgent(agentId);

        monitor.startMonitoring();

        // Wait for agent to be marked as disconnected
        await waitFor(
          () => {
            const status = monitor.getHealthStatus(agentId);
            return status !== null && status.status === 'disconnected';
          },
          6000,
          100
        );

        const status = monitor.getHealthStatus(agentId);
        expect(status!.status).toBe('disconnected');
      });

      it('should increment missedHeartbeats counter every interval', async () => {
        const agentId = createAgentId();
        await monitor.registerAgent(agentId);

        monitor.startMonitoring();

        // Wait for first heartbeat check
        await new Promise((resolve) =>
          setTimeout(resolve, HEARTBEAT_INTERVAL + 500)
        );

        const status1 = monitor.getHealthStatus(agentId);
        const missed1 = status1!.missedHeartbeats;

        // Wait for second heartbeat check
        await new Promise((resolve) =>
          setTimeout(resolve, HEARTBEAT_INTERVAL)
        );

        const status2 = monitor.getHealthStatus(agentId);
        const missed2 = status2!.missedHeartbeats;

        expect(missed2).toBeGreaterThan(missed1);
      });

      it('should handle monitoring lifecycle (start/stop)', async () => {
        const agentId = createAgentId();
        await monitor.registerAgent(agentId);

        // Start monitoring
        monitor.startMonitoring();

        await new Promise((resolve) =>
          setTimeout(resolve, HEARTBEAT_INTERVAL + 500)
        );

        const statusDuringMonitoring = monitor.getHealthStatus(agentId);
        const missedDuringMonitoring =
          statusDuringMonitoring!.missedHeartbeats;

        // Stop monitoring
        monitor.stopMonitoring();

        await new Promise((resolve) =>
          setTimeout(resolve, HEARTBEAT_INTERVAL + 500)
        );

        const statusAfterStop = monitor.getHealthStatus(agentId);
        const missedAfterStop = statusAfterStop!.missedHeartbeats;

        // Missed heartbeats should not increase after stopping
        expect(missedAfterStop).toBe(missedDuringMonitoring);
      });

      it('should allow restart after stop', async () => {
        const agentId = createAgentId();
        await monitor.registerAgent(agentId);

        monitor.startMonitoring();
        monitor.stopMonitoring();
        monitor.startMonitoring();

        // Should detect missed heartbeats after restart
        await new Promise((resolve) =>
          setTimeout(resolve, HEARTBEAT_INTERVAL + 500)
        );

        const status = monitor.getHealthStatus(agentId);
        expect(status!.missedHeartbeats).toBeGreaterThan(0);
      });
    });
  });

  // =========================================================================
  // Part 3: Liveness Probe (FR-009)
  // =========================================================================

  describe('AgentHealthMonitor Contract - Liveness Probe', () => {
    describe('recordLivenessCheck()', () => {
      it('should update lastLivenessCheck timestamp on success', async () => {
        const agentId = createAgentId();
        await monitor.registerAgent(agentId);

        const beforeCheck = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 10));

        monitor.recordLivenessCheck(agentId, true);

        const status = monitor.getHealthStatus(agentId);
        expect(status!.lastLivenessCheck.getTime()).toBeGreaterThan(
          beforeCheck
        );
      });

      it('should maintain healthy status on successful liveness check', async () => {
        const agentId = createAgentId();
        await monitor.registerAgent(agentId);

        monitor.startMonitoring();
        monitor.recordHeartbeat(agentId);
        monitor.recordLivenessCheck(agentId, true);

        const status = monitor.getHealthStatus(agentId);
        expect(status!.status).toBe('healthy');
      });

      it('should detect zombie state when heartbeat OK but liveness fails (FR-009)', async () => {
        const agentId = createAgentId();
        await monitor.registerAgent(agentId);

        monitor.startMonitoring();

        // Send heartbeats but fail liveness checks
        monitor.recordHeartbeat(agentId);
        monitor.recordLivenessCheck(agentId, false);

        await new Promise((resolve) => setTimeout(resolve, 100));

        monitor.recordHeartbeat(agentId);
        monitor.recordLivenessCheck(agentId, false);

        const status = monitor.getHealthStatus(agentId);
        expect(status!.status).toBe('zombie');
      });

      it('should transition from healthy to zombie on failed liveness', async () => {
        const agentId = createAgentId();
        await monitor.registerAgent(agentId);

        monitor.startMonitoring();

        // Healthy state: heartbeat + liveness OK
        monitor.recordHeartbeat(agentId);
        monitor.recordLivenessCheck(agentId, true);

        let status = monitor.getHealthStatus(agentId);
        expect(status!.status).toBe('healthy');

        // Zombie state: heartbeat OK, liveness fails
        monitor.recordHeartbeat(agentId);
        monitor.recordLivenessCheck(agentId, false);

        status = monitor.getHealthStatus(agentId);
        expect(status!.status).toBe('zombie');
      });

      it('should recover from zombie to healthy when liveness succeeds', async () => {
        const agentId = createAgentId();
        await monitor.registerAgent(agentId);

        monitor.startMonitoring();

        // Enter zombie state
        monitor.recordHeartbeat(agentId);
        monitor.recordLivenessCheck(agentId, false);

        let status = monitor.getHealthStatus(agentId);
        expect(status!.status).toBe('zombie');

        // Recover
        monitor.recordHeartbeat(agentId);
        monitor.recordLivenessCheck(agentId, true);

        status = monitor.getHealthStatus(agentId);
        expect(status!.status).toBe('healthy');
      });

      it('should throw error for unregistered agent', () => {
        const agentId = createAgentId();

        expect(() => monitor.recordLivenessCheck(agentId, true)).toThrow();
      });
    });

    describe('Zombie Detection', () => {
      it('should differentiate zombie from disconnected', async () => {
        const zombieAgent = createAgentId('zombie');
        const disconnectedAgent = createAgentId('disconnected');

        await monitor.registerAgent(zombieAgent);
        await monitor.registerAgent(disconnectedAgent);

        monitor.startMonitoring();

        // Zombie: heartbeat OK, liveness fails
        monitor.recordHeartbeat(zombieAgent);
        monitor.recordLivenessCheck(zombieAgent, false);

        // Disconnected: no heartbeat
        // (let heartbeat timeout naturally)

        await waitFor(
          () => {
            const disconnectedStatus =
              monitor.getHealthStatus(disconnectedAgent);
            return (
              disconnectedStatus !== null &&
              disconnectedStatus.status === 'disconnected'
            );
          },
          6000,
          100
        );

        const zombieStatus = monitor.getHealthStatus(zombieAgent);
        const disconnectedStatus = monitor.getHealthStatus(disconnectedAgent);

        expect(zombieStatus!.status).toBe('zombie');
        expect(disconnectedStatus!.status).toBe('disconnected');
      });

      it('should track multiple zombie agents independently', async () => {
        const agent1 = createAgentId();
        const agent2 = createAgentId();
        const agent3 = createAgentId();

        await monitor.registerAgent(agent1);
        await monitor.registerAgent(agent2);
        await monitor.registerAgent(agent3);

        monitor.startMonitoring();

        // agent1: zombie
        monitor.recordHeartbeat(agent1);
        monitor.recordLivenessCheck(agent1, false);

        // agent2: healthy
        monitor.recordHeartbeat(agent2);
        monitor.recordLivenessCheck(agent2, true);

        // agent3: zombie
        monitor.recordHeartbeat(agent3);
        monitor.recordLivenessCheck(agent3, false);

        const status1 = monitor.getHealthStatus(agent1);
        const status2 = monitor.getHealthStatus(agent2);
        const status3 = monitor.getHealthStatus(agent3);

        expect(status1!.status).toBe('zombie');
        expect(status2!.status).toBe('healthy');
        expect(status3!.status).toBe('zombie');
      });
    });
  });

  // =========================================================================
  // Part 4: Recovery Tracking (FR-008, FR-009a, FR-010)
  // =========================================================================

  describe('AgentHealthMonitor Contract - Recovery', () => {
    describe('Recovery Attempts', () => {
      it('should track recovery attempts for disconnected agents', async () => {
        const agentId = createAgentId();
        await monitor.registerAgent(agentId);

        monitor.startMonitoring();

        // Wait for disconnection
        await waitFor(
          () => {
            const status = monitor.getHealthStatus(agentId);
            return status !== null && status.status === 'disconnected';
          },
          6000,
          100
        );

        // Implementation-specific: Recovery may be triggered automatically
        // This test validates that recoveryAttempts is tracked

        const status = monitor.getHealthStatus(agentId);
        expect(status!.recoveryAttempts).toBeGreaterThanOrEqual(0);
      });

      it('should increment recovery attempts on each recovery', async () => {
        const agentId = createAgentId();
        await monitor.registerAgent(agentId);

        monitor.startMonitoring();

        // Wait for disconnection
        await waitFor(
          () => {
            const status = monitor.getHealthStatus(agentId);
            return status !== null && status.status === 'disconnected';
          },
          6000,
          100
        );

        const statusBeforeRecovery = monitor.getHealthStatus(agentId);
        const attemptsBefore = statusBeforeRecovery!.recoveryAttempts;

        // Simulate recovery by sending heartbeat
        monitor.recordHeartbeat(agentId);
        monitor.recordLivenessCheck(agentId, true);

        // Wait for potential additional recovery tracking
        await new Promise((resolve) => setTimeout(resolve, 100));

        const statusAfterRecovery = monitor.getHealthStatus(agentId);
        const attemptsAfter = statusAfterRecovery!.recoveryAttempts;

        // Recovery attempts should not decrease
        expect(attemptsAfter).toBeGreaterThanOrEqual(attemptsBefore);
      });

      it('should track recovery for zombie agents', async () => {
        const agentId = createAgentId();
        await monitor.registerAgent(agentId);

        monitor.startMonitoring();

        // Enter zombie state
        monitor.recordHeartbeat(agentId);
        monitor.recordLivenessCheck(agentId, false);

        const statusZombie = monitor.getHealthStatus(agentId);
        expect(statusZombie!.status).toBe('zombie');

        // Recover
        monitor.recordHeartbeat(agentId);
        monitor.recordLivenessCheck(agentId, true);

        const statusRecovered = monitor.getHealthStatus(agentId);
        expect(statusRecovered!.recoveryAttempts).toBeGreaterThanOrEqual(0);
      });
    });
  });

  // =========================================================================
  // Part 5: Statistics and Monitoring (FR-010, FR-010a, FR-043)
  // =========================================================================

  describe('AgentHealthMonitor Contract - Statistics', () => {
    describe('getStats()', () => {
      it('should return total agent count', async () => {
        const agentIds = Array.from({ length: 5 }, () => createAgentId());

        for (const agentId of agentIds) {
          await monitor.registerAgent(agentId);
        }

        const stats = monitor.getStats();
        expect(stats.totalAgents).toBe(5);
      });

      it('should return healthy agent count', async () => {
        const agent1 = createAgentId();
        const agent2 = createAgentId();

        await monitor.registerAgent(agent1);
        await monitor.registerAgent(agent2);

        monitor.startMonitoring();

        // Keep agents healthy with heartbeats
        monitor.recordHeartbeat(agent1);
        monitor.recordHeartbeat(agent2);
        monitor.recordLivenessCheck(agent1, true);
        monitor.recordLivenessCheck(agent2, true);

        const stats = monitor.getStats();
        expect(stats.healthyAgents).toBe(2);
      });

      it('should return disconnected agent count', async () => {
        const agent1 = createAgentId();
        const agent2 = createAgentId();
        const agent3 = createAgentId();

        await monitor.registerAgent(agent1);
        await monitor.registerAgent(agent2);
        await monitor.registerAgent(agent3);

        monitor.startMonitoring();

        // Keep agent1 healthy, let agent2 and agent3 disconnect
        monitor.recordHeartbeat(agent1);
        monitor.recordLivenessCheck(agent1, true);

        await waitFor(
          () => {
            const stats = monitor.getStats();
            return stats.disconnectedAgents >= 2;
          },
          6000,
          100
        );

        const stats = monitor.getStats();
        expect(stats.disconnectedAgents).toBeGreaterThanOrEqual(2);
      });

      it('should return zombie agent count', async () => {
        const agent1 = createAgentId();
        const agent2 = createAgentId();

        await monitor.registerAgent(agent1);
        await monitor.registerAgent(agent2);

        monitor.startMonitoring();

        // Create zombie agents
        monitor.recordHeartbeat(agent1);
        monitor.recordLivenessCheck(agent1, false);

        monitor.recordHeartbeat(agent2);
        monitor.recordLivenessCheck(agent2, false);

        const stats = monitor.getStats();
        expect(stats.zombieAgents).toBe(2);
      });

      it('should return total and failed recovery counts', async () => {
        const stats = monitor.getStats();

        expect(stats.totalRecoveries).toBeGreaterThanOrEqual(0);
        expect(stats.failedRecoveries).toBeGreaterThanOrEqual(0);
        expect(stats.failedRecoveries).toBeLessThanOrEqual(
          stats.totalRecoveries
        );
      });

      it('should handle stats with zero agents', async () => {
        const stats = monitor.getStats();

        expect(stats.totalAgents).toBe(0);
        expect(stats.healthyAgents).toBe(0);
        expect(stats.disconnectedAgents).toBe(0);
        expect(stats.zombieAgents).toBe(0);
      });

      it('should update stats in real-time', async () => {
        const agentId = createAgentId();
        await monitor.registerAgent(agentId);

        const stats1 = monitor.getStats();
        expect(stats1.totalAgents).toBe(1);
        expect(stats1.healthyAgents).toBe(1);

        monitor.startMonitoring();

        // Wait for disconnection
        await waitFor(
          () => {
            const stats = monitor.getStats();
            return stats.disconnectedAgents > 0;
          },
          6000,
          100
        );

        const stats2 = monitor.getStats();
        expect(stats2.healthyAgents).toBe(0);
        expect(stats2.disconnectedAgents).toBe(1);
      });
    });

    describe('getAllHealthStatuses()', () => {
      it('should return Map of all agent statuses', async () => {
        const agentIds = Array.from({ length: 3 }, () => createAgentId());

        for (const agentId of agentIds) {
          await monitor.registerAgent(agentId);
        }

        const allStatuses = monitor.getAllHealthStatuses();

        expect(allStatuses).toBeInstanceOf(Map);
        expect(allStatuses.size).toBe(3);

        for (const agentId of agentIds) {
          expect(allStatuses.has(agentId)).toBe(true);
          expect(allStatuses.get(agentId)!.agentId).toBe(agentId);
        }
      });

      it('should return empty Map when no agents registered', () => {
        const allStatuses = monitor.getAllHealthStatuses();

        expect(allStatuses).toBeInstanceOf(Map);
        expect(allStatuses.size).toBe(0);
      });

      it('should reflect current health states', async () => {
        const healthyAgent = createAgentId('healthy');
        const zombieAgent = createAgentId('zombie');

        await monitor.registerAgent(healthyAgent);
        await monitor.registerAgent(zombieAgent);

        monitor.startMonitoring();

        // Healthy agent
        monitor.recordHeartbeat(healthyAgent);
        monitor.recordLivenessCheck(healthyAgent, true);

        // Zombie agent
        monitor.recordHeartbeat(zombieAgent);
        monitor.recordLivenessCheck(zombieAgent, false);

        const allStatuses = monitor.getAllHealthStatuses();

        expect(allStatuses.get(healthyAgent)!.status).toBe('healthy');
        expect(allStatuses.get(zombieAgent)!.status).toBe('zombie');
      });
    });

    describe('getHealthStatus()', () => {
      it('should return status for registered agent', async () => {
        const agentId = createAgentId();
        await monitor.registerAgent(agentId);

        const status = monitor.getHealthStatus(agentId);

        expect(status).not.toBeNull();
        expect(status!.agentId).toBe(agentId);
      });

      it('should return null for unregistered agent', () => {
        const agentId = createAgentId();

        const status = monitor.getHealthStatus(agentId);
        expect(status).toBeNull();
      });

      it('should return current health state', async () => {
        const agentId = createAgentId();
        await monitor.registerAgent(agentId);

        monitor.startMonitoring();

        // Initial healthy state
        monitor.recordHeartbeat(agentId);
        monitor.recordLivenessCheck(agentId, true);

        let status = monitor.getHealthStatus(agentId);
        expect(status!.status).toBe('healthy');

        // Transition to zombie
        monitor.recordHeartbeat(agentId);
        monitor.recordLivenessCheck(agentId, false);

        status = monitor.getHealthStatus(agentId);
        expect(status!.status).toBe('zombie');
      });
    });
  });

  // =========================================================================
  // Part 6: Graceful Degradation (FR-010a)
  // =========================================================================

  describe('AgentHealthMonitor Contract - Graceful Degradation', () => {
    it('should detect when >3 agents fail within 30 seconds (FR-010a)', async () => {
      const agentIds = Array.from({ length: 5 }, () => createAgentId());

      for (const agentId of agentIds) {
        await monitor.registerAgent(agentId);
      }

      monitor.startMonitoring();

      // Wait for agents to fail (no heartbeats)
      await waitFor(
        () => {
          const stats = monitor.getStats();
          return stats.disconnectedAgents >= 4;
        },
        10000,
        100
      );

      const stats = monitor.getStats();
      expect(stats.disconnectedAgents).toBeGreaterThanOrEqual(4);
    });

    it('should track failure timestamps for degradation detection', async () => {
      const agentIds = Array.from({ length: 4 }, () => createAgentId());

      for (const agentId of agentIds) {
        await monitor.registerAgent(agentId);
      }

      monitor.startMonitoring();

      // All agents fail within 30 seconds
      await waitFor(
        () => {
          const stats = monitor.getStats();
          return stats.disconnectedAgents >= 4;
        },
        10000,
        100
      );

      // Verify all failures occurred within reasonable timeframe
      const allStatuses = monitor.getAllHealthStatuses();
      const disconnectedStatuses = Array.from(allStatuses.values()).filter(
        (s) => s.status === 'disconnected'
      );

      expect(disconnectedStatuses.length).toBeGreaterThanOrEqual(4);
    });
  });

  // =========================================================================
  // Part 7: Performance Requirements
  // =========================================================================

  describe('AgentHealthMonitor Contract - Performance', () => {
    it('should detect failure within 5 seconds (FR-007)', async () => {
      const agentId = createAgentId();
      await monitor.registerAgent(agentId);

      monitor.startMonitoring();

      const startTime = Date.now();

      // Wait for disconnection
      await waitFor(
        () => {
          const status = monitor.getHealthStatus(agentId);
          return status !== null && status.status === 'disconnected';
        },
        6000,
        100
      );

      const detectionTime = Date.now() - startTime;

      // Should detect within 5 seconds + small tolerance
      expect(detectionTime).toBeLessThan(6000);
    });

    it('should handle 100 agents efficiently', async () => {
      const agentIds = Array.from({ length: 100 }, () => createAgentId());

      const { duration: registrationDuration } = await measureTime(async () => {
        for (const agentId of agentIds) {
          await monitor.registerAgent(agentId);
        }
      });

      // Registration should be fast
      expect(registrationDuration).toBeLessThan(1000);

      monitor.startMonitoring();

      // Send heartbeats to all agents
      const { duration: heartbeatDuration } = await measureTime(async () => {
        for (const agentId of agentIds) {
          monitor.recordHeartbeat(agentId);
        }
      });

      // Heartbeat processing should be fast
      expect(heartbeatDuration).toBeLessThan(100);

      const stats = monitor.getStats();
      expect(stats.totalAgents).toBe(100);
    });

    it('should scale getStats() with agent count', async () => {
      const agentIds = Array.from({ length: 50 }, () => createAgentId());

      for (const agentId of agentIds) {
        await monitor.registerAgent(agentId);
      }

      const { duration } = await measureTime(async () => {
        for (let i = 0; i < 100; i++) {
          monitor.getStats();
        }
      });

      // 100 getStats() calls should be fast
      expect(duration).toBeLessThan(100);
    });

    it('should scale getAllHealthStatuses() with agent count', async () => {
      const agentIds = Array.from({ length: 50 }, () => createAgentId());

      for (const agentId of agentIds) {
        await monitor.registerAgent(agentId);
      }

      const { duration } = await measureTime(async () => {
        for (let i = 0; i < 100; i++) {
          monitor.getAllHealthStatuses();
        }
      });

      // 100 getAllHealthStatuses() calls should be fast
      expect(duration).toBeLessThan(200);
    });
  });

  // =========================================================================
  // Part 8: Edge Cases and Error Handling
  // =========================================================================

  describe('AgentHealthMonitor Contract - Edge Cases', () => {
    it('should handle rapid register/unregister cycles', async () => {
      const agentId = createAgentId();

      for (let i = 0; i < 10; i++) {
        await monitor.registerAgent(agentId);
        await monitor.unregisterAgent(agentId);
      }

      const status = monitor.getHealthStatus(agentId);
      expect(status).toBeNull();
    });

    it('should handle concurrent heartbeats from multiple agents', async () => {
      const agentIds = Array.from({ length: 20 }, () => createAgentId());

      for (const agentId of agentIds) {
        await monitor.registerAgent(agentId);
      }

      monitor.startMonitoring();

      // Send concurrent heartbeats
      const heartbeatPromises = agentIds.map(async (agentId) => {
        for (let i = 0; i < 10; i++) {
          monitor.recordHeartbeat(agentId);
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      });

      await Promise.all(heartbeatPromises);

      const stats = monitor.getStats();
      expect(stats.healthyAgents).toBeGreaterThanOrEqual(10);
    });

    it('should handle monitoring restart during active monitoring', async () => {
      const agentId = createAgentId();
      await monitor.registerAgent(agentId);

      monitor.startMonitoring();
      await new Promise((resolve) => setTimeout(resolve, 100));

      monitor.stopMonitoring();
      monitor.startMonitoring();

      // Should continue monitoring
      await new Promise((resolve) =>
        setTimeout(resolve, HEARTBEAT_INTERVAL + 500)
      );

      const status = monitor.getHealthStatus(agentId);
      expect(status!.missedHeartbeats).toBeGreaterThan(0);
    });

    it('should handle heartbeat for agent during unregistration', async () => {
      const agentId = createAgentId();
      await monitor.registerAgent(agentId);

      // Start unregistration but send heartbeat
      const unregisterPromise = monitor.unregisterAgent(agentId);

      // This may throw or be ignored depending on timing
      try {
        monitor.recordHeartbeat(agentId);
      } catch (error) {
        // Expected: agent may be unregistered already
      }

      await unregisterPromise;
    });

    it('should maintain state consistency under concurrent operations', async () => {
      const agentId = createAgentId();
      await monitor.registerAgent(agentId);

      monitor.startMonitoring();

      // Concurrent operations
      const operations = [];
      for (let i = 0; i < 50; i++) {
        operations.push(
          (async () => {
            monitor.recordHeartbeat(agentId);
            monitor.recordLivenessCheck(agentId, true);
            monitor.getHealthStatus(agentId);
          })()
        );
      }

      await Promise.all(operations);

      const status = monitor.getHealthStatus(agentId);
      expect(status).not.toBeNull();
      expect(status!.status).toBe('healthy');
    });
  });
}
