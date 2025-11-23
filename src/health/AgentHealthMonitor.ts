/**
 * AgentHealthMonitor Implementation
 *
 * Monitors agent health through heartbeat mechanism, liveness probes,
 * and automatic recovery with event replay.
 *
 * @see specs/001-production-robustness/contracts/AgentHealthMonitor.contract.ts
 * @see specs/001-production-robustness/spec.md FR-006 to FR-010, FR-010a
 */

import {
  AgentHealthStatus,
  HealthState,
  RecoveryStrategy,
  EventPriority,
  EventReplayPolicy,
} from '../types/robustness';
import {
  AgentHealthMonitor as IAgentHealthMonitor,
  HealthMonitorConfig,
  RecoveryResult,
  MonitoringStats,
  HealthChangeEvent,
} from '../../specs/001-production-robustness/contracts/AgentHealthMonitor.contract';
import { EventBus } from '../../specs/001-production-robustness/contracts/EventBus.contract';

/**
 * Agent interface (minimal to avoid importing full Agent class)
 */
export interface Agent {
  readonly name: string;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<HealthMonitorConfig> = {
  heartbeatInterval: 2000, // 2 seconds (FR-006)
  activityTimeout: 5000, // 5 seconds (FR-007)
  maxMissedBeats: 2, // 2 missed heartbeats = 5 seconds total (FR-007)
  defaultRecoveryStrategy: RecoveryStrategy.RESTART, // FR-008
};

/**
 * Graceful degradation threshold configuration
 */
const DEGRADATION_THRESHOLD = {
  failureCount: 3, // >3 agents
  timeWindow: 30000, // within 30 seconds (FR-010a)
  recoveryCheckInterval: 60000, // check every 60s (FR-010a)
  recoveryThreshold: 2, // <2 agents failed (FR-010a)
  recoveryDuration: 120000, // for 120 consecutive seconds (FR-010a)
};

/**
 * AgentHealthMonitor implementation
 *
 * Responsibilities:
 * - Heartbeat polling every 2s (FR-006)
 * - Disconnection detection within 5s (FR-007)
 * - Liveness probe for zombie detection (FR-009)
 * - Automatic recovery with state preservation (FR-008, FR-009a)
 * - Event replay during recovery (FR-009a, FR-016a)
 * - Graceful degradation mode (FR-010a)
 * - Health metrics and statistics (FR-010, FR-043)
 */
export class AgentHealthMonitor implements IAgentHealthMonitor {
  private config: Required<HealthMonitorConfig>;
  private eventBus?: EventBus;

  // Agent registry and health tracking
  private agents: Map<string, Agent> = new Map();
  private healthStatus: Map<string, AgentHealthStatus> = new Map();
  private recoveryStrategies: Map<string, RecoveryStrategy> = new Map();
  private lastProcessedEvent: Map<string, number> = new Map();

  // Monitoring intervals
  private heartbeatInterval?: NodeJS.Timeout;
  private livenessInterval?: NodeJS.Timeout;
  private degradationCheckInterval?: NodeJS.Timeout;

  // Statistics tracking
  private stats = {
    totalHeartbeats: 0,
    failedHeartbeats: 0,
    recoveryAttempts: 0,
    successfulRecoveries: 0,
    heartbeatLatencies: [] as number[],
    cpuStartTime: process.cpuUsage(),
    monitoringStartTime: Date.now(),
  };

  // Graceful degradation state
  private degradationMode = false;
  private recentFailures: Array<{ agentId: string; timestamp: number }> = [];
  private degradationStartTime?: number;
  private consecutiveHealthyChecks = 0;

  /**
   * Initialize the health monitor
   *
   * @param config Monitor configuration
   */
  async initialize(config?: HealthMonitorConfig): Promise<void> {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    // Reset state
    this.agents.clear();
    this.healthStatus.clear();
    this.recoveryStrategies.clear();
    this.lastProcessedEvent.clear();
    this.recentFailures = [];
    this.degradationMode = false;
    this.consecutiveHealthyChecks = 0;
  }

  /**
   * Set event bus for event replay during recovery
   *
   * @param eventBus EventBus instance
   */
  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
  }

  /**
   * Register agent for health monitoring (FR-006, FR-007)
   *
   * @param agent Agent to monitor
   * @param recoveryStrategy Optional agent-specific recovery strategy
   */
  registerAgent(agent: Agent, recoveryStrategy?: RecoveryStrategy): void {
    const agentId = this.getAgentId(agent);

    this.agents.set(agentId, agent);
    this.recoveryStrategies.set(
      agentId,
      recoveryStrategy ?? this.config.defaultRecoveryStrategy
    );

    // Initialize health status
    const now = Date.now();
    this.healthStatus.set(agentId, {
      agentId,
      state: HealthState.HEALTHY,
      lastHeartbeat: now,
      lastLivenessCheck: now,
      missedHeartbeats: 0,
      recoveryStrategy: recoveryStrategy ?? this.config.defaultRecoveryStrategy,
      recoveryAttempts: 0,
    });

    this.lastProcessedEvent.set(agentId, now);
  }

  /**
   * Unregister agent from monitoring
   *
   * @param agentId Agent identifier
   */
  unregisterAgent(agentId: string): void {
    this.agents.delete(agentId);
    this.healthStatus.delete(agentId);
    this.recoveryStrategies.delete(agentId);
    this.lastProcessedEvent.delete(agentId);
  }

  /**
   * Start monitoring all registered agents
   *
   * SC-003: Detect disconnections within 5 seconds
   * SC-010: Heartbeat overhead <1% CPU
   */
  startMonitoring(): void {
    // Start heartbeat polling (FR-006)
    this.heartbeatInterval = setInterval(() => {
      this.performHeartbeatCheck();
    }, this.config.heartbeatInterval);

    // Start liveness probe checks (FR-009)
    this.livenessInterval = setInterval(() => {
      this.performLivenessCheck();
    }, this.config.activityTimeout);

    // Start graceful degradation monitoring (FR-010a)
    this.degradationCheckInterval = setInterval(() => {
      this.checkDegradationMode();
    }, DEGRADATION_THRESHOLD.recoveryCheckInterval);
  }

  /**
   * Stop monitoring all agents
   */
  stopMonitoring(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
    if (this.livenessInterval) {
      clearInterval(this.livenessInterval);
      this.livenessInterval = undefined;
    }
    if (this.degradationCheckInterval) {
      clearInterval(this.degradationCheckInterval);
      this.degradationCheckInterval = undefined;
    }
  }

  /**
   * Get health status for a specific agent
   *
   * @param agentId Agent identifier
   * @returns Health status or null if not registered
   */
  getAgentHealth(agentId: string): AgentHealthStatus | null {
    return this.healthStatus.get(agentId) ?? null;
  }

  /**
   * Get health status for all registered agents
   *
   * @returns Map of agent IDs to health statuses
   */
  getAllAgentHealth(): Map<string, AgentHealthStatus> {
    return new Map(this.healthStatus);
  }

  /**
   * Manually trigger heartbeat for an agent
   *
   * @param agentId Agent identifier
   * @returns true if heartbeat succeeded, false if failed
   */
  async sendHeartbeat(agentId: string): Promise<boolean> {
    const agent = this.agents.get(agentId);
    const status = this.healthStatus.get(agentId);

    if (!agent || !status) {
      return false;
    }

    const startTime = Date.now();

    try {
      // Attempt heartbeat - for now, just check if agent exists
      // In production, this would ping the agent process
      const success = await this.checkAgentHeartbeat(agent);

      const latency = Date.now() - startTime;
      this.stats.heartbeatLatencies.push(latency);
      this.stats.totalHeartbeats++;

      if (success) {
        status.lastHeartbeat = Date.now();
        status.missedHeartbeats = 0;

        // Transition to healthy if recovering
        if (status.state === HealthState.RECOVERING) {
          this.updateAgentState(agentId, HealthState.HEALTHY);
        }

        return true;
      } else {
        this.stats.failedHeartbeats++;
        status.missedHeartbeats++;

        // Check if agent should be marked as disconnected (FR-007)
        if (status.missedHeartbeats >= this.config.maxMissedBeats) {
          this.updateAgentState(agentId, HealthState.DISCONNECTED, 'Missed heartbeats threshold exceeded');
        }

        return false;
      }
    } catch (error) {
      this.stats.failedHeartbeats++;
      status.missedHeartbeats++;
      status.lastError = error instanceof Error ? error.message : String(error);

      if (status.missedHeartbeats >= this.config.maxMissedBeats) {
        this.updateAgentState(agentId, HealthState.DISCONNECTED, 'Heartbeat error: ' + status.lastError);
      }

      return false;
    }
  }

  /**
   * Record agent activity
   *
   * @param agentId Agent identifier
   * @param activityType Type of activity
   */
  recordActivity(agentId: string, activityType: string): void {
    const status = this.healthStatus.get(agentId);
    if (status) {
      status.lastHeartbeat = Date.now();
      status.missedHeartbeats = 0;

      // Store activity in metadata
      if (!status.metadata) {
        status.metadata = {};
      }
      status.metadata.lastActivity = activityType;
      status.metadata.lastActivityTime = Date.now();
    }
  }

  /**
   * Trigger recovery for a disconnected agent (FR-008, FR-009, FR-009a)
   *
   * SC-004: 90% of agent failures recover automatically
   *
   * @param agentId Agent identifier
   * @returns Recovery result
   */
  async recoverAgent(agentId: string): Promise<RecoveryResult> {
    const startTime = Date.now();
    const status = this.healthStatus.get(agentId);
    const strategy = this.recoveryStrategies.get(agentId) ?? RecoveryStrategy.RESTART;

    if (!status) {
      return {
        success: false,
        strategy: strategy,
        durationMs: Date.now() - startTime,
        error: 'Agent not registered',
      };
    }

    this.stats.recoveryAttempts++;
    status.recoveryAttempts++;

    // Update state to recovering
    this.updateAgentState(agentId, HealthState.RECOVERING);

    try {
      let success = false;

      switch (strategy) {
        case RecoveryStrategy.RESTART:
          success = await this.restartAgent(agentId);
          break;
        case RecoveryStrategy.REPLACE:
          success = await this.replaceAgent(agentId);
          break;
        case RecoveryStrategy.ALERT:
          success = await this.alertOperator(agentId);
          break;
        case RecoveryStrategy.NONE:
          success = false;
          break;
      }

      if (success) {
        this.stats.successfulRecoveries++;

        // Perform event replay if EventBus is available (FR-009a, FR-016a)
        if (this.eventBus) {
          await this.replayMissedEvents(agentId);
        }

        this.updateAgentState(agentId, HealthState.HEALTHY);

        return {
          success: true,
          strategy,
          durationMs: Date.now() - startTime,
        };
      } else {
        this.updateAgentState(agentId, HealthState.FAILED, 'Recovery failed');

        return {
          success: false,
          strategy,
          durationMs: Date.now() - startTime,
          error: 'Recovery strategy failed',
        };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      status.lastError = errorMsg;
      this.updateAgentState(agentId, HealthState.FAILED, errorMsg);

      return {
        success: false,
        strategy,
        durationMs: Date.now() - startTime,
        error: errorMsg,
      };
    }
  }

  /**
   * Update recovery strategy for an agent
   *
   * @param agentId Agent identifier
   * @param strategy New recovery strategy
   */
  setRecoveryStrategy(agentId: string, strategy: RecoveryStrategy): void {
    this.recoveryStrategies.set(agentId, strategy);

    const status = this.healthStatus.get(agentId);
    if (status) {
      status.recoveryStrategy = strategy;
    }
  }

  /**
   * Get monitoring statistics (FR-010, FR-043)
   *
   * @returns Monitoring statistics
   */
  getStats(): MonitoringStats {
    const healthCounts = this.getHealthCounts();

    // Calculate average heartbeat latency
    const avgLatency =
      this.stats.heartbeatLatencies.length > 0
        ? this.stats.heartbeatLatencies.reduce((a, b) => a + b, 0) /
          this.stats.heartbeatLatencies.length
        : 0;

    // Estimate CPU overhead (SC-010: <1%)
    const cpuUsage = process.cpuUsage(this.stats.cpuStartTime);
    const totalCpuTime = cpuUsage.user + cpuUsage.system; // microseconds
    const wallTime = (Date.now() - this.stats.monitoringStartTime) * 1000; // microseconds
    const cpuPercent = wallTime > 0 ? (totalCpuTime / wallTime) * 100 : 0;

    return {
      totalAgents: this.agents.size,
      healthyAgents: healthCounts.healthy,
      disconnectedAgents: healthCounts.disconnected,
      recoveringAgents: healthCounts.recovering,
      totalHeartbeats: this.stats.totalHeartbeats,
      failedHeartbeats: this.stats.failedHeartbeats,
      recoveryAttempts: this.stats.recoveryAttempts,
      successfulRecoveries: this.stats.successfulRecoveries,
      avgHeartbeatLatency: avgLatency,
      cpuOverheadPercent: cpuPercent,
    };
  }

  // Private helper methods

  /**
   * Get agent ID from Agent instance
   */
  private getAgentId(agent: Agent): string {
    // Use agent name as ID for now
    // TODO: Update when Agent class has unique ID property
    return agent.name;
  }

  /**
   * Perform heartbeat check for all registered agents
   *
   * This checks if agents have sent heartbeats recently.
   * If an agent hasn't sent a heartbeat within the interval, increment missed count.
   */
  private async performHeartbeatCheck(): Promise<void> {
    const now = Date.now();

    for (const [agentId, status] of this.healthStatus) {
      // Check if heartbeat is recent enough
      const timeSinceHeartbeat = now - status.lastHeartbeat;
      const isHeartbeatCurrent = timeSinceHeartbeat < this.config.heartbeatInterval * 1.5;

      if (isHeartbeatCurrent) {
        // Heartbeat is current - reset missed count
        status.missedHeartbeats = 0;
        this.stats.totalHeartbeats++;
      } else {
        // Heartbeat is missing - increment missed count
        status.missedHeartbeats++;
        this.stats.failedHeartbeats++;

        // Check if agent should be marked as disconnected (FR-007)
        if (status.missedHeartbeats >= this.config.maxMissedBeats) {
          if (status.state !== HealthState.DISCONNECTED) {
            this.updateAgentState(agentId, HealthState.DISCONNECTED, 'Missed heartbeats threshold exceeded');
          }
        }
      }
    }
  }

  /**
   * Perform liveness probe for all agents (FR-009)
   *
   * Detects zombie agents: responding to heartbeats but not processing
   */
  private async performLivenessCheck(): Promise<void> {
    for (const [agentId, agent] of this.agents) {
      const status = this.healthStatus.get(agentId);
      if (!status) continue;

      try {
        const isAlive = await this.checkAgentLiveness(agent);
        const now = Date.now();

        if (isAlive) {
          status.lastLivenessCheck = now;

          // If agent was zombie and is now alive, mark as healthy
          if (status.state === HealthState.ZOMBIE) {
            this.updateAgentState(agentId, HealthState.HEALTHY);
          }
        } else {
          // Agent is not responding to liveness probe
          // but may still be sending heartbeats (zombie)
          if (status.state === HealthState.HEALTHY) {
            this.updateAgentState(agentId, HealthState.ZOMBIE, 'Liveness probe failed');
          }
        }
      } catch (error) {
        // Liveness check error - mark as zombie if currently healthy
        if (status.state === HealthState.HEALTHY) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          this.updateAgentState(agentId, HealthState.ZOMBIE, 'Liveness check error: ' + errorMsg);
        }
      }
    }
  }

  /**
   * Check agent heartbeat
   *
   * In production, this would ping the agent process.
   * For now, we assume agents are always responsive.
   */
  private async checkAgentHeartbeat(agent: Agent): Promise<boolean> {
    // Simple check: agent exists
    // TODO: Implement actual heartbeat ping when Agent has health check method
    return agent !== null && agent !== undefined;
  }

  /**
   * Check agent liveness (FR-009)
   *
   * Sends test request to ensure agent is processing, not just alive.
   */
  private async checkAgentLiveness(agent: Agent): Promise<boolean> {
    // Simple check for now
    // TODO: Implement actual liveness probe when Agent has processability check
    return agent !== null && agent !== undefined;
  }

  /**
   * Update agent state and emit health change event
   */
  private updateAgentState(
    agentId: string,
    newState: HealthState,
    reason?: string
  ): void {
    const status = this.healthStatus.get(agentId);
    if (!status) return;

    const previousState = status.state;
    status.state = newState;

    if (reason) {
      status.lastError = reason;
    }

    // Track failures for graceful degradation (FR-010a)
    if (newState === HealthState.DISCONNECTED || newState === HealthState.FAILED) {
      this.recentFailures.push({
        agentId,
        timestamp: Date.now(),
      });

      // Cleanup old failures outside time window
      const cutoff = Date.now() - DEGRADATION_THRESHOLD.timeWindow;
      this.recentFailures = this.recentFailures.filter(
        (f) => f.timestamp > cutoff
      );

      // Check if we should enter degradation mode
      if (this.recentFailures.length > DEGRADATION_THRESHOLD.failureCount) {
        this.enterDegradationMode();
      }
    }

    // Emit health change event
    const event: HealthChangeEvent = {
      agentId,
      previousState,
      newState,
      timestamp: Date.now(),
      reason,
    };

    // TODO: Emit event through EventBus when available
    console.log('[AgentHealthMonitor] Health change:', event);
  }

  /**
   * Restart agent during recovery (FR-008)
   */
  private async restartAgent(agentId: string): Promise<boolean> {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    // TODO: Implement actual agent restart logic
    // For now, just simulate success
    console.log(`[AgentHealthMonitor] Restarting agent: ${agentId}`);

    return true;
  }

  /**
   * Replace agent during recovery (FR-008)
   */
  private async replaceAgent(agentId: string): Promise<boolean> {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    // TODO: Implement actual agent replacement logic
    // For now, just simulate success
    console.log(`[AgentHealthMonitor] Replacing agent: ${agentId}`);

    return true;
  }

  /**
   * Alert operator during recovery (FR-008)
   */
  private async alertOperator(agentId: string): Promise<boolean> {
    const status = this.healthStatus.get(agentId);
    if (!status) return false;

    // FR-002a: Console logging for Phase 1
    console.error('[AgentHealthMonitor] ALERT: Agent failure', {
      agentId,
      state: status.state,
      lastError: status.lastError,
      recoveryAttempts: status.recoveryAttempts,
      timestamp: new Date().toISOString(),
    });

    return true;
  }

  /**
   * Replay missed events during recovery (FR-009a, FR-016a)
   */
  private async replayMissedEvents(agentId: string): Promise<void> {
    if (!this.eventBus) return;

    const lastProcessed = this.lastProcessedEvent.get(agentId) ?? 0;
    const status = this.healthStatus.get(agentId);

    if (!status) return;

    try {
      // Get replay policy for agent
      const replayPolicy = this.eventBus.getReplayPolicy(agentId);

      if (replayPolicy === EventReplayPolicy.NONE) {
        return;
      }

      // Replay events from last processed timestamp
      const eventsReplayed = await this.eventBus.replay(agentId, {
        since: lastProcessed,
        priority:
          replayPolicy === EventReplayPolicy.CRITICAL_ONLY
            ? EventPriority.CRITICAL
            : undefined,
      });

      // FR-009a: If >50% of events fail, mark as degraded
      // For now, we trust replay succeeded
      // TODO: Track individual event replay failures

      console.log(
        `[AgentHealthMonitor] Replayed ${eventsReplayed} events for agent ${agentId}`
      );

      // Update last processed event timestamp
      this.lastProcessedEvent.set(agentId, Date.now());
    } catch (error) {
      console.error(
        `[AgentHealthMonitor] Event replay failed for agent ${agentId}:`,
        error
      );

      // FR-009a: Mark agent as degraded if event replay fails
      this.updateAgentState(
        agentId,
        HealthState.DEGRADED,
        'Event replay failed'
      );
    }
  }

  /**
   * Enter graceful degradation mode (FR-010a)
   */
  private enterDegradationMode(): void {
    if (this.degradationMode) return;

    this.degradationMode = true;
    this.degradationStartTime = Date.now();
    this.consecutiveHealthyChecks = 0;

    console.error('[AgentHealthMonitor] ENTERING GRACEFUL DEGRADATION MODE', {
      failedAgents: this.recentFailures.length,
      timestamp: new Date().toISOString(),
    });

    // FR-010a: Actions during degradation
    // 1. Pause new session creation - handled by caller
    // 2. Reduce concurrent session limit 100→50 - handled by caller
    // 3. Prioritize existing sessions - handled by caller
    // 4. Attempt automated recovery every 60s - already running
    // 5. Send operator alert
    console.error('[AgentHealthMonitor] CRITICAL: Multiple agent failures detected');
  }

  /**
   * Check if we can exit graceful degradation mode (FR-010a)
   */
  private checkDegradationMode(): void {
    if (!this.degradationMode) return;

    // Count currently failed agents
    const healthCounts = this.getHealthCounts();
    const currentlyFailed =
      healthCounts.disconnected + healthCounts.failed + healthCounts.zombie;

    // FR-010a: Exit when <2 agents failed for 120 consecutive seconds
    if (currentlyFailed < DEGRADATION_THRESHOLD.recoveryThreshold) {
      this.consecutiveHealthyChecks++;

      const healthyDuration =
        this.consecutiveHealthyChecks *
        (DEGRADATION_THRESHOLD.recoveryCheckInterval / 1000);

      if (healthyDuration >= DEGRADATION_THRESHOLD.recoveryDuration / 1000) {
        this.exitDegradationMode();
      }
    } else {
      this.consecutiveHealthyChecks = 0;
    }
  }

  /**
   * Exit graceful degradation mode (FR-010a)
   */
  private exitDegradationMode(): void {
    this.degradationMode = false;
    this.degradationStartTime = undefined;
    this.consecutiveHealthyChecks = 0;
    this.recentFailures = [];

    console.log('[AgentHealthMonitor] EXITING GRACEFUL DEGRADATION MODE', {
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get health state counts
   */
  private getHealthCounts(): {
    healthy: number;
    disconnected: number;
    zombie: number;
    recovering: number;
    degraded: number;
    failed: number;
  } {
    const counts = {
      healthy: 0,
      disconnected: 0,
      zombie: 0,
      recovering: 0,
      degraded: 0,
      failed: 0,
    };

    for (const status of this.healthStatus.values()) {
      switch (status.state) {
        case HealthState.HEALTHY:
          counts.healthy++;
          break;
        case HealthState.DISCONNECTED:
          counts.disconnected++;
          break;
        case HealthState.ZOMBIE:
          counts.zombie++;
          break;
        case HealthState.RECOVERING:
          counts.recovering++;
          break;
        case HealthState.DEGRADED:
          counts.degraded++;
          break;
        case HealthState.FAILED:
          counts.failed++;
          break;
      }
    }

    return counts;
  }
}
