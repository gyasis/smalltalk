/**
 * AgentHealthMonitor Contract
 *
 * Defines the interface for agent health monitoring, heartbeat management,
 * and automatic recovery.
 *
 * @see spec.md User Story 2 - Agent Disconnection Detection and Recovery
 * @see research.md Section 5 - Heartbeat Mechanism Design
 */

import { AgentHealthStatus, HealthState, RecoveryStrategy } from '../../../src/types/robustness.js';

/**
 * Agent interface (minimal to avoid importing full Agent class)
 */
export interface Agent {
  readonly name: string;
}

/**
 * Health monitor configuration
 */
export interface HealthMonitorConfig {
  /** Heartbeat interval in milliseconds (default: 2000) */
  heartbeatInterval?: number;
  /** Activity timeout in milliseconds (default: 5000) */
  activityTimeout?: number;
  /** Maximum missed heartbeats before failure (default: 2) */
  maxMissedBeats?: number;
  /** Default recovery strategy */
  defaultRecoveryStrategy?: RecoveryStrategy;
}

/**
 * Recovery result
 */
export interface RecoveryResult {
  /** Whether recovery succeeded */
  success: boolean;
  /** Recovery strategy used */
  strategy: string;
  /** Time taken in milliseconds */
  durationMs: number;
  /** Error message if recovery failed */
  error?: string;
}

/**
 * AgentHealthMonitor interface
 *
 * Responsible for continuous agent health monitoring and automatic recovery.
 */
export interface AgentHealthMonitor {
  /**
   * Initialize the health monitor
   *
   * @param config Monitor configuration
   */
  initialize(config?: HealthMonitorConfig): Promise<void>;

  /**
   * Register agent for health monitoring
   *
   * FR-006: System MUST implement heartbeat mechanism
   * FR-007: System MUST detect missed heartbeats within timeout
   *
   * @param agent Agent to monitor
   * @param recoveryStrategy Optional agent-specific recovery strategy
   */
  registerAgent(agent: Agent, recoveryStrategy?: RecoveryStrategy): void;

  /**
   * Unregister agent from monitoring
   *
   * @param agentId Agent identifier
   */
  unregisterAgent(agentId: string): void;

  /**
   * Start monitoring all registered agents
   *
   * SC-003: Agent disconnections detected within 5 seconds
   * SC-010: Heartbeat monitoring overhead consumes less than 1% CPU
   */
  startMonitoring(): void;

  /**
   * Stop monitoring all agents
   */
  stopMonitoring(): void;

  /**
   * Get health status for a specific agent
   *
   * @param agentId Agent identifier
   * @returns Health status or null if agent not registered
   */
  getAgentHealth(agentId: string): AgentHealthStatus | null;

  /**
   * Get health status for all registered agents
   *
   * @returns Map of agent IDs to health statuses
   */
  getAllAgentHealth(): Map<string, AgentHealthStatus>;

  /**
   * Manually trigger heartbeat for an agent
   *
   * @param agentId Agent identifier
   * @returns true if heartbeat succeeded, false if failed
   */
  sendHeartbeat(agentId: string): Promise<boolean>;

  /**
   * Record agent activity (message sent, task completed, etc.)
   *
   * @param agentId Agent identifier
   * @param activityType Type of activity
   */
  recordActivity(agentId: string, activityType: string): void;

  /**
   * Trigger recovery for a disconnected agent
   *
   * FR-008: System MUST provide configurable recovery strategies
   * FR-009: System MUST maintain conversation continuity during recovery
   * SC-004: 90% of agent failures recover automatically
   *
   * @param agentId Agent identifier
   * @returns Recovery result
   */
  recoverAgent(agentId: string): Promise<RecoveryResult>;

  /**
   * Update recovery strategy for an agent
   *
   * @param agentId Agent identifier
   * @param strategy New recovery strategy
   */
  setRecoveryStrategy(agentId: string, strategy: RecoveryStrategy): void;

  /**
   * Get monitoring statistics
   *
   * FR-010: System MUST alert operators when agents exceed failure thresholds
   *
   * @returns Monitoring statistics
   */
  getStats(): MonitoringStats;
}

/**
 * Monitoring statistics
 */
export interface MonitoringStats {
  /** Total number of registered agents */
  totalAgents: number;
  /** Number of healthy agents */
  healthyAgents: number;
  /** Number of disconnected agents */
  disconnectedAgents: number;
  /** Number of agents currently recovering */
  recoveringAgents: number;
  /** Total heartbeats sent */
  totalHeartbeats: number;
  /** Total failed heartbeats */
  failedHeartbeats: number;
  /** Total recovery attempts */
  recoveryAttempts: number;
  /** Successful recoveries */
  successfulRecoveries: number;
  /** Average heartbeat latency in milliseconds */
  avgHeartbeatLatency: number;
  /** Estimated CPU overhead percentage */
  cpuOverheadPercent: number;
}

/**
 * Health change event data
 */
export interface HealthChangeEvent {
  agentId: string;
  previousState: HealthState;
  newState: HealthState;
  timestamp: number;
  reason?: string;
}
