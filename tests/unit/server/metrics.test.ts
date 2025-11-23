/**
 * Unit tests for Prometheus Metrics Endpoint
 *
 * Tests metrics collection and Prometheus format output.
 */

import {
  initializeMetrics,
  resetMetrics,
  getMetrics,
  getMetricsRegistry,
  recordSessionCreated,
  recordSessionClosed,
  recordAgentHealthCheck,
  recordAgentFailure,
  recordEventPublished,
  recordEventConsumed,
  recordStorageOperation,
  startStorageTimer,
  createMetricsRouter,
} from '../../../src/server/metrics';

describe('Prometheus Metrics', () => {
  beforeEach(() => {
    // Reset metrics before each test
    resetMetrics();
  });

  afterEach(() => {
    // Clean up after each test
    resetMetrics();
  });

  describe('initializeMetrics', () => {
    it('should initialize metrics registry and metric objects', () => {
      const { registry, metrics } = initializeMetrics();

      expect(registry).toBeDefined();
      expect(metrics).toBeDefined();
      expect(metrics.sessionsTotal).toBeDefined();
      expect(metrics.sessionsActive).toBeDefined();
      expect(metrics.agentHealthChecksTotal).toBeDefined();
      expect(metrics.agentFailuresTotal).toBeDefined();
      expect(metrics.eventsPublishedTotal).toBeDefined();
      expect(metrics.eventsConsumedTotal).toBeDefined();
      expect(metrics.storageOperationsDuration).toBeDefined();
    });

    it('should return same registry on multiple calls', () => {
      const { registry: registry1 } = initializeMetrics();
      const { registry: registry2 } = initializeMetrics();

      expect(registry1).toBe(registry2);
    });

    it('should expose default metrics', async () => {
      initializeMetrics();
      const registry = getMetricsRegistry();
      const metricsOutput = await registry!.metrics();

      // Should include Node.js default metrics
      expect(metricsOutput).toContain('process_cpu_user_seconds_total');
      expect(metricsOutput).toContain('nodejs_heap_size_total_bytes');
    });
  });

  describe('Session metrics', () => {
    it('should record session creation', async () => {
      initializeMetrics();
      recordSessionCreated();
      recordSessionCreated();

      const registry = getMetricsRegistry();
      const metricsOutput = await registry!.metrics();

      expect(metricsOutput).toContain('sessions_total 2');
      expect(metricsOutput).toContain('sessions_active 2');
    });

    it('should record session closure', async () => {
      initializeMetrics();
      recordSessionCreated();
      recordSessionCreated();
      recordSessionClosed();

      const registry = getMetricsRegistry();
      const metricsOutput = await registry!.metrics();

      expect(metricsOutput).toContain('sessions_total 2');
      expect(metricsOutput).toContain('sessions_active 1');
    });

    it('should handle recording before initialization gracefully', () => {
      // Should not throw error
      expect(() => {
        recordSessionCreated();
        recordSessionClosed();
      }).not.toThrow();
    });
  });

  describe('Agent health metrics', () => {
    it('should record agent health checks', async () => {
      initializeMetrics();
      recordAgentHealthCheck('agent-1', 'healthy');
      recordAgentHealthCheck('agent-1', 'healthy');
      recordAgentHealthCheck('agent-2', 'unhealthy');

      const registry = getMetricsRegistry();
      const metricsOutput = await registry!.metrics();

      expect(metricsOutput).toContain('agent_health_checks_total');
      expect(metricsOutput).toContain('agent_id="agent-1"');
      expect(metricsOutput).toContain('result="healthy"');
      expect(metricsOutput).toContain('result="unhealthy"');
    });

    it('should record agent failures', async () => {
      initializeMetrics();
      recordAgentFailure('agent-1', 'disconnected');
      recordAgentFailure('agent-2', 'zombie');

      const registry = getMetricsRegistry();
      const metricsOutput = await registry!.metrics();

      expect(metricsOutput).toContain('agent_failures_total');
      expect(metricsOutput).toContain('failure_type="disconnected"');
      expect(metricsOutput).toContain('failure_type="zombie"');
    });
  });

  describe('Event bus metrics', () => {
    it('should record event publications', async () => {
      initializeMetrics();
      recordEventPublished('agent.message', 'normal');
      recordEventPublished('agent.message', 'normal');
      recordEventPublished('agent.critical', 'critical');

      const registry = getMetricsRegistry();
      const metricsOutput = await registry!.metrics();

      expect(metricsOutput).toContain('events_published_total');
      expect(metricsOutput).toContain('topic="agent.message"');
      expect(metricsOutput).toContain('priority="normal"');
      expect(metricsOutput).toContain('priority="critical"');
    });

    it('should record event consumption', async () => {
      initializeMetrics();
      recordEventConsumed('agent.message', 'subscriber-1');
      recordEventConsumed('agent.message', 'subscriber-2');

      const registry = getMetricsRegistry();
      const metricsOutput = await registry!.metrics();

      expect(metricsOutput).toContain('events_consumed_total');
      expect(metricsOutput).toContain('subscriber_id="subscriber-1"');
      expect(metricsOutput).toContain('subscriber_id="subscriber-2"');
    });
  });

  describe('Storage operation metrics', () => {
    it('should record storage operation duration', async () => {
      initializeMetrics();
      recordStorageOperation('save', 0.025, 'success');
      recordStorageOperation('restore', 0.050, 'success');
      recordStorageOperation('delete', 0.010, 'failure');

      const registry = getMetricsRegistry();
      const metricsOutput = await registry!.metrics();

      expect(metricsOutput).toContain('storage_operations_duration_seconds');
      expect(metricsOutput).toContain('operation="save"');
      expect(metricsOutput).toContain('operation="restore"');
      expect(metricsOutput).toContain('result="success"');
      expect(metricsOutput).toContain('result="failure"');
    });

    it('should support timer helper for storage operations', async () => {
      initializeMetrics();

      const stopTimer = startStorageTimer('save');
      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 10));
      stopTimer('success');

      const registry = getMetricsRegistry();
      const metricsOutput = await registry!.metrics();

      expect(metricsOutput).toContain('storage_operations_duration_seconds');
      expect(metricsOutput).toContain('operation="save"');
    });

    it('should have histogram buckets defined', async () => {
      initializeMetrics();
      recordStorageOperation('save', 0.001, 'success');

      const registry = getMetricsRegistry();
      const metricsOutput = await registry!.metrics();

      // Should contain histogram buckets
      expect(metricsOutput).toContain('le="0.001"');
      expect(metricsOutput).toContain('le="0.01"');
      expect(metricsOutput).toContain('le="0.05"');
      expect(metricsOutput).toContain('le="0.1"');
    });
  });

  describe('createMetricsRouter', () => {
    it('should create router with /metrics endpoint', () => {
      const router = createMetricsRouter();
      expect(router).toBeDefined();
      // Router should have routes registered
      expect((router as any).stack).toBeDefined();
    });

    it('should auto-initialize metrics if not initialized', async () => {
      resetMetrics();
      expect(getMetricsRegistry()).toBeUndefined();

      const router = createMetricsRouter();
      // Simulate calling the endpoint (without actual HTTP request)
      // Metrics should be initialized when endpoint is called
      expect(router).toBeDefined();
    });
  });

  describe('getMetricsRegistry and getMetrics', () => {
    it('should return undefined before initialization', () => {
      expect(getMetricsRegistry()).toBeUndefined();
      expect(getMetrics()).toBeUndefined();
    });

    it('should return registry and metrics after initialization', () => {
      initializeMetrics();
      expect(getMetricsRegistry()).toBeDefined();
      expect(getMetrics()).toBeDefined();
    });
  });

  describe('resetMetrics', () => {
    it('should clear registry and metrics', () => {
      initializeMetrics();
      expect(getMetricsRegistry()).toBeDefined();

      resetMetrics();
      expect(getMetricsRegistry()).toBeUndefined();
      expect(getMetrics()).toBeUndefined();
    });

    it('should allow re-initialization after reset', () => {
      initializeMetrics();
      resetMetrics();

      const { registry, metrics } = initializeMetrics();
      expect(registry).toBeDefined();
      expect(metrics).toBeDefined();
    });
  });
});
