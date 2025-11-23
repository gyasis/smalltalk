/**
 * Prometheus Metrics Endpoint
 *
 * Provides metrics in Prometheus format for monitoring and alerting.
 *
 * @see specs/001-production-robustness/spec.md FR-043
 */

import { Request, Response, Router } from 'express';
import * as promClient from 'prom-client';

/**
 * Metrics registry singleton
 */
let metricsRegistry: promClient.Registry | undefined;

/**
 * Metrics counters and gauges
 */
export interface SmallTalkMetrics {
  sessionsTotal: promClient.Counter<string>;
  sessionsActive: promClient.Gauge<string>;
  agentHealthChecksTotal: promClient.Counter<string>;
  agentFailuresTotal: promClient.Counter<string>;
  eventsPublishedTotal: promClient.Counter<string>;
  eventsConsumedTotal: promClient.Counter<string>;
  storageOperationsDuration: promClient.Histogram<string>;
}

let metrics: SmallTalkMetrics | undefined;

/**
 * Initialize Prometheus metrics
 *
 * Sets up all counters, gauges, and histograms for SmallTalk.
 * Should be called once at application startup.
 *
 * @returns Metrics registry and metric objects
 */
export function initializeMetrics(): {
  registry: promClient.Registry;
  metrics: SmallTalkMetrics;
} {
  if (metricsRegistry && metrics) {
    return { registry: metricsRegistry, metrics };
  }

  // Create new registry
  const registry = new promClient.Registry();

  // Add default metrics (memory, CPU, etc.)
  promClient.collectDefaultMetrics({ register: registry });

  // Session metrics
  const sessionsTotal = new promClient.Counter({
    name: 'sessions_total',
    help: 'Total number of sessions created',
    registers: [registry],
  });

  const sessionsActive = new promClient.Gauge({
    name: 'sessions_active',
    help: 'Current number of active sessions',
    registers: [registry],
  });

  // Agent health metrics
  const agentHealthChecksTotal = new promClient.Counter({
    name: 'agent_health_checks_total',
    help: 'Total number of agent health checks performed',
    labelNames: ['agent_id', 'result'],
    registers: [registry],
  });

  const agentFailuresTotal = new promClient.Counter({
    name: 'agent_failures_total',
    help: 'Total number of agent failures detected',
    labelNames: ['agent_id', 'failure_type'],
    registers: [registry],
  });

  // Event bus metrics
  const eventsPublishedTotal = new promClient.Counter({
    name: 'events_published_total',
    help: 'Total number of events published',
    labelNames: ['topic', 'priority'],
    registers: [registry],
  });

  const eventsConsumedTotal = new promClient.Counter({
    name: 'events_consumed_total',
    help: 'Total number of events consumed',
    labelNames: ['topic', 'subscriber_id'],
    registers: [registry],
  });

  // Storage operation metrics
  const storageOperationsDuration = new promClient.Histogram({
    name: 'storage_operations_duration_seconds',
    help: 'Duration of storage operations in seconds',
    labelNames: ['operation', 'result'],
    buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 5],
    registers: [registry],
  });

  // Store in module-level variables
  metricsRegistry = registry;
  metrics = {
    sessionsTotal,
    sessionsActive,
    agentHealthChecksTotal,
    agentFailuresTotal,
    eventsPublishedTotal,
    eventsConsumedTotal,
    storageOperationsDuration,
  };

  return { registry, metrics };
}

/**
 * Get current metrics registry
 *
 * @returns Current metrics registry or undefined if not initialized
 */
export function getMetricsRegistry(): promClient.Registry | undefined {
  return metricsRegistry;
}

/**
 * Get current metrics objects
 *
 * @returns Current metrics or undefined if not initialized
 */
export function getMetrics(): SmallTalkMetrics | undefined {
  return metrics;
}

/**
 * Create metrics router
 *
 * Provides GET /metrics endpoint in Prometheus format.
 *
 * @returns Express router with metrics endpoint
 */
export function createMetricsRouter(): Router {
  const router = Router();

  /**
   * GET /metrics - Prometheus metrics endpoint
   *
   * FR-043: Exposes metrics in Prometheus format
   */
  router.get('/metrics', async (req: Request, res: Response) => {
    if (!metricsRegistry) {
      // Auto-initialize if not already done
      initializeMetrics();
    }

    try {
      res.set('Content-Type', metricsRegistry!.contentType);
      const metricsData = await metricsRegistry!.metrics();
      res.send(metricsData);
    } catch (error) {
      res.status(500).send(
        error instanceof Error ? error.message : 'Failed to generate metrics'
      );
    }
  });

  return router;
}

/**
 * Record session creation
 *
 * Increments session total counter and active gauge.
 */
export function recordSessionCreated(): void {
  if (!metrics) return;
  metrics.sessionsTotal.inc();
  metrics.sessionsActive.inc();
}

/**
 * Record session closure
 *
 * Decrements active session gauge.
 */
export function recordSessionClosed(): void {
  if (!metrics) return;
  metrics.sessionsActive.dec();
}

/**
 * Record agent health check
 *
 * @param agentId Agent identifier
 * @param result Health check result ('healthy' | 'unhealthy')
 */
export function recordAgentHealthCheck(
  agentId: string,
  result: 'healthy' | 'unhealthy'
): void {
  if (!metrics) return;
  metrics.agentHealthChecksTotal.inc({ agent_id: agentId, result });
}

/**
 * Record agent failure
 *
 * @param agentId Agent identifier
 * @param failureType Type of failure ('disconnected' | 'zombie' | 'failed')
 */
export function recordAgentFailure(
  agentId: string,
  failureType: string
): void {
  if (!metrics) return;
  metrics.agentFailuresTotal.inc({ agent_id: agentId, failure_type: failureType });
}

/**
 * Record event publication
 *
 * @param topic Event topic
 * @param priority Event priority ('critical' | 'normal')
 */
export function recordEventPublished(
  topic: string,
  priority: 'critical' | 'normal'
): void {
  if (!metrics) return;
  metrics.eventsPublishedTotal.inc({ topic, priority });
}

/**
 * Record event consumption
 *
 * @param topic Event topic
 * @param subscriberId Subscriber identifier
 */
export function recordEventConsumed(topic: string, subscriberId: string): void {
  if (!metrics) return;
  metrics.eventsConsumedTotal.inc({ topic, subscriber_id: subscriberId });
}

/**
 * Record storage operation duration
 *
 * @param operation Operation name ('save' | 'restore' | 'delete' | 'list')
 * @param durationSeconds Duration in seconds
 * @param result Operation result ('success' | 'failure')
 */
export function recordStorageOperation(
  operation: string,
  durationSeconds: number,
  result: 'success' | 'failure'
): void {
  if (!metrics) return;
  metrics.storageOperationsDuration.observe({ operation, result }, durationSeconds);
}

/**
 * Timer helper for storage operations
 *
 * Returns a function to stop the timer and record the duration.
 *
 * @param operation Operation name
 * @returns Stop timer function
 */
export function startStorageTimer(operation: string): (result: 'success' | 'failure') => void {
  const startTime = Date.now();

  return (result: 'success' | 'failure') => {
    const durationSeconds = (Date.now() - startTime) / 1000;
    recordStorageOperation(operation, durationSeconds, result);
  };
}

/**
 * Reset all metrics
 *
 * Useful for testing. Clears the registry and metrics objects.
 */
export function resetMetrics(): void {
  if (metricsRegistry) {
    metricsRegistry.clear();
  }
  metricsRegistry = undefined;
  metrics = undefined;
}
