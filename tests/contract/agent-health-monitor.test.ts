/**
 * AgentHealthMonitor Contract Tests - Implementation
 *
 * Runs the shared contract test suite against the AgentHealthMonitorAdapter implementation.
 *
 * @see tests/contract/agent-health-monitor.shared.test.ts
 */

import { describe } from '@jest/globals';
import { runAgentHealthMonitorContractTests } from './agent-health-monitor.shared.test';
import { AgentHealthMonitorAdapter } from '../../src/health/AgentHealthMonitorAdapter';

describe('AgentHealthMonitorAdapter - Contract Tests', () => {
  runAgentHealthMonitorContractTests(
    () => new AgentHealthMonitorAdapter(),
    {
      heartbeatIntervalMs: 2000, // FR-006
      livenessTimeoutMs: 5000, // FR-009
      missedHeartbeatThreshold: 2, // FR-007
    }
  );
});
