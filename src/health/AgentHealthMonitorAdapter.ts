/**
 * AgentHealthMonitorAdapter
 *
 * Adapter that implements the contract test interface while wrapping
 * the main AgentHealthMonitor implementation.
 *
 * This allows the contract tests to run against a simplified interface
 * while the main implementation handles the full Agent complexity.
 */

import { AgentHealthMonitor } from './AgentHealthMonitor';
import { RecoveryStrategy, HealthState } from '../types/robustness';
import {
  AgentHealthMonitor as ITestAgentHealthMonitor,
  AgentHealthStatus as TestAgentHealthStatus,
  HealthMonitorStats as TestHealthMonitorStats,
} from '../../tests/contract/agent-health-monitor.shared.test';

/**
 * Mock Agent class for testing
 *
 * Creates minimal agent instances with just name/ID
 * Avoids importing full Agent class to prevent Jest ES module issues
 */
class MockAgent {
  public readonly name: string;

  constructor(agentId: string) {
    this.name = agentId;
  }
}

/**
 * AgentHealthMonitorAdapter
 *
 * Wraps AgentHealthMonitor to match contract test interface
 */
export class AgentHealthMonitorAdapter implements ITestAgentHealthMonitor {
  private monitor: AgentHealthMonitor;
  private mockAgents: Map<string, MockAgent> = new Map();

  constructor() {
    this.monitor = new AgentHealthMonitor();
    this.ensureInitialized();
  }

  /**
   * Ensure monitor is initialized with default config
   */
  private async ensureInitialized(): Promise<void> {
    await this.monitor.initialize({
      heartbeatInterval: 2000,
      activityTimeout: 5000,
      maxMissedBeats: 2,
      defaultRecoveryStrategy: RecoveryStrategy.RESTART,
    });
  }

  /**
   * Register agent by ID (contract test interface)
   *
   * Creates a mock agent and registers it with the monitor
   */
  async registerAgent(agentId: string): Promise<void> {
    // Validation
    if (!agentId || agentId === '' || agentId === null || agentId === undefined) {
      throw new Error('Invalid agent ID');
    }

    // Create mock agent
    const mockAgent = new MockAgent(agentId);
    this.mockAgents.set(agentId, mockAgent);

    // Register with main monitor (cast to any to avoid Agent type import)
    this.monitor.registerAgent(mockAgent as any, RecoveryStrategy.RESTART);
  }

  /**
   * Unregister agent by ID
   */
  async unregisterAgent(agentId: string): Promise<void> {
    this.monitor.unregisterAgent(agentId);
    this.mockAgents.delete(agentId);
  }

  /**
   * Start monitoring
   */
  startMonitoring(): void {
    this.monitor.startMonitoring();
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    this.monitor.stopMonitoring();
  }

  /**
   * Record heartbeat for agent (contract test interface)
   */
  recordHeartbeat(agentId: string): void {
    // Check if agent is registered
    if (!this.mockAgents.has(agentId)) {
      throw new Error(`Agent ${agentId} is not registered`);
    }

    // Record activity which updates heartbeat
    this.monitor.recordActivity(agentId, 'heartbeat');
  }

  /**
   * Record liveness check result (contract test interface)
   */
  recordLivenessCheck(agentId: string, success: boolean): void {
    // Check if agent is registered
    if (!this.mockAgents.has(agentId)) {
      throw new Error(`Agent ${agentId} is not registered`);
    }

    const status = this.monitor.getAgentHealth(agentId);
    if (!status) {
      throw new Error(`Agent ${agentId} status not found`);
    }

    const now = Date.now();

    if (success) {
      // Successful liveness check
      status.lastLivenessCheck = now;

      // If agent is zombie and liveness succeeds, transition to healthy
      if (status.state === HealthState.ZOMBIE) {
        status.state = HealthState.HEALTHY;
      }
    } else {
      // Failed liveness check
      // If agent has recent heartbeat but liveness fails, it's a zombie
      const timeSinceHeartbeat = now - status.lastHeartbeat;
      const heartbeatInterval = 2000;

      if (timeSinceHeartbeat < heartbeatInterval * 2) {
        // Recent heartbeat but liveness failed = zombie
        status.state = HealthState.ZOMBIE;
      }
    }
  }

  /**
   * Get health status for specific agent
   */
  getHealthStatus(agentId: string): TestAgentHealthStatus | null {
    const status = this.monitor.getAgentHealth(agentId);
    if (!status) return null;

    return this.convertToTestStatus(status);
  }

  /**
   * Get all health statuses
   */
  getAllHealthStatuses(): Map<string, TestAgentHealthStatus> {
    const allStatuses = this.monitor.getAllAgentHealth();
    const testStatuses = new Map<string, TestAgentHealthStatus>();

    for (const [agentId, status] of allStatuses) {
      testStatuses.set(agentId, this.convertToTestStatus(status));
    }

    return testStatuses;
  }

  /**
   * Get monitoring statistics
   */
  getStats(): TestHealthMonitorStats {
    const stats = this.monitor.getStats();

    // Count zombie agents
    const allStatuses = this.monitor.getAllAgentHealth();
    let zombieCount = 0;
    for (const status of allStatuses.values()) {
      if (status.state === HealthState.ZOMBIE) {
        zombieCount++;
      }
    }

    return {
      totalAgents: stats.totalAgents,
      healthyAgents: stats.healthyAgents,
      disconnectedAgents: stats.disconnectedAgents,
      zombieAgents: zombieCount,
      totalRecoveries: stats.successfulRecoveries,
      failedRecoveries: stats.recoveryAttempts - stats.successfulRecoveries,
    };
  }

  /**
   * Convert internal health status to test status format
   */
  private convertToTestStatus(
    status: import('../types/robustness.js').AgentHealthStatus
  ): TestAgentHealthStatus {
    // Map HealthState enum to test status string
    let testStatus: 'healthy' | 'disconnected' | 'zombie';
    switch (status.state) {
      case HealthState.HEALTHY:
      case HealthState.RECOVERING:
      case HealthState.DEGRADED:
        testStatus = 'healthy';
        break;
      case HealthState.DISCONNECTED:
      case HealthState.FAILED:
        testStatus = 'disconnected';
        break;
      case HealthState.ZOMBIE:
        testStatus = 'zombie';
        break;
      default:
        testStatus = 'healthy';
    }

    return {
      agentId: status.agentId,
      status: testStatus,
      lastHeartbeat: new Date(status.lastHeartbeat),
      lastLivenessCheck: new Date(status.lastLivenessCheck ?? status.lastHeartbeat),
      missedHeartbeats: status.missedHeartbeats,
      recoveryAttempts: status.recoveryAttempts,
    };
  }

  /**
   * Check if monitor is initialized
   */
  private isMonitorInitialized(): boolean {
    // Simple heuristic: if we have any agents, assume initialized
    return this.mockAgents.size > 0;
  }
}
