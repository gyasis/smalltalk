/**
 * Health and Readiness Endpoints
 *
 * Provides health check and readiness endpoints for monitoring and orchestration.
 *
 * @see specs/001-production-robustness/spec.md FR-052, FR-053
 */

import { Request, Response, Router } from 'express';
import { StorageAdapter } from '../../specs/001-production-robustness/contracts/StorageAdapter.contract';
import { EventBus } from '../../specs/001-production-robustness/contracts/EventBus.contract';
import { AgentHealthMonitor } from '../../specs/001-production-robustness/contracts/AgentHealthMonitor.contract';

/**
 * Component health status
 */
export interface ComponentHealth {
  status: 'healthy' | 'unhealthy' | 'unknown';
  message?: string;
  details?: Record<string, any>;
}

/**
 * Overall health check response
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  components: {
    storage: ComponentHealth;
    eventBus: ComponentHealth;
    agentMonitor: ComponentHealth;
  };
}

/**
 * Health check dependencies
 */
export interface HealthCheckDependencies {
  storageAdapter?: StorageAdapter;
  eventBus?: EventBus;
  agentMonitor?: AgentHealthMonitor;
}

/**
 * Create health check router
 *
 * Provides:
 * - GET /health: Detailed health status with component checks
 * - GET /ready: Simple readiness check (200 OK or 503 Service Unavailable)
 *
 * @param dependencies Optional dependencies to check
 * @returns Express router with health endpoints
 */
export function createHealthRouter(
  dependencies: HealthCheckDependencies = {}
): Router {
  const router = Router();

  /**
   * GET /health - Detailed health status
   *
   * FR-052: Returns JSON with status, timestamp, and component health
   */
  router.get('/health', async (req: Request, res: Response) => {
    const response = await performHealthCheck(dependencies);

    const statusCode = response.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(response);
  });

  /**
   * GET /ready - Simple readiness check
   *
   * FR-053: Returns 200 if ready, 503 if not ready
   */
  router.get('/ready', async (req: Request, res: Response) => {
    const response = await performHealthCheck(dependencies);

    if (response.status === 'healthy') {
      res.status(200).send('OK');
    } else {
      res.status(503).send('Service Unavailable');
    }
  });

  return router;
}

/**
 * Perform health check on all components
 *
 * @param dependencies Dependencies to check
 * @returns Health check response
 */
export async function performHealthCheck(
  dependencies: HealthCheckDependencies
): Promise<HealthCheckResponse> {
  const { storageAdapter, eventBus, agentMonitor } = dependencies;

  // Check storage health
  const storageHealth = await checkStorageHealth(storageAdapter);

  // Check event bus health
  const eventBusHealth = await checkEventBusHealth(eventBus);

  // Check agent monitor health
  const agentMonitorHealth = await checkAgentMonitorHealth(agentMonitor);

  // Determine overall status
  const componentStatuses = [
    storageHealth.status,
    eventBusHealth.status,
    agentMonitorHealth.status,
  ];

  let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  if (componentStatuses.every((s) => s === 'healthy')) {
    overallStatus = 'healthy';
  } else if (componentStatuses.some((s) => s === 'unhealthy')) {
    overallStatus = 'unhealthy';
  } else {
    overallStatus = 'degraded';
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    components: {
      storage: storageHealth,
      eventBus: eventBusHealth,
      agentMonitor: agentMonitorHealth,
    },
  };
}

/**
 * Check storage adapter health
 */
async function checkStorageHealth(
  adapter?: StorageAdapter
): Promise<ComponentHealth> {
  if (!adapter) {
    return {
      status: 'unknown',
      message: 'Storage adapter not configured',
    };
  }

  try {
    // Try to get stats as a health check
    const stats = await adapter.getStats();
    return {
      status: 'healthy',
      details: {
        totalSessions: stats.totalSessions,
        sizeBytes: stats.sizeBytes,
        backendType: stats.backendType,
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message:
        error instanceof Error ? error.message : 'Storage health check failed',
    };
  }
}

/**
 * Check event bus health
 */
async function checkEventBusHealth(
  eventBus?: EventBus
): Promise<ComponentHealth> {
  if (!eventBus) {
    return {
      status: 'unknown',
      message: 'Event bus not configured',
    };
  }

  try {
    // Get event bus stats as health check
    const stats = await eventBus.getStats();
    return {
      status: 'healthy',
      details: {
        totalEventsPublished: stats.totalEventsPublished,
        totalEventsDelivered: stats.totalEventsDelivered,
        activeSubscriptions: stats.activeSubscriptions,
        avgPropagationLatencyMs: stats.avgPropagationLatencyMs,
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message:
        error instanceof Error
          ? error.message
          : 'Event bus health check failed',
    };
  }
}

/**
 * Check agent health monitor status
 */
async function checkAgentMonitorHealth(
  monitor?: AgentHealthMonitor
): Promise<ComponentHealth> {
  if (!monitor) {
    return {
      status: 'unknown',
      message: 'Agent health monitor not configured',
    };
  }

  try {
    // Get monitoring stats as health check
    const stats = await monitor.getStats();

    // Calculate unhealthy agents (disconnected + recovering)
    const unhealthyAgents = stats.disconnectedAgents + stats.recoveringAgents;

    // Consider degraded if too many agents are unhealthy
    const unhealthyRatio =
      stats.totalAgents > 0 ? unhealthyAgents / stats.totalAgents : 0;

    let status: ComponentHealth['status'] = 'healthy';
    if (unhealthyRatio > 0.5) {
      status = 'unhealthy';
    } else if (unhealthyRatio > 0) {
      status = 'healthy'; // Still healthy with some unhealthy agents
    }

    return {
      status,
      details: {
        totalAgents: stats.totalAgents,
        healthyAgents: stats.healthyAgents,
        disconnectedAgents: stats.disconnectedAgents,
        recoveringAgents: stats.recoveringAgents,
        successfulRecoveries: stats.successfulRecoveries,
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message:
        error instanceof Error
          ? error.message
          : 'Agent monitor health check failed',
    };
  }
}
