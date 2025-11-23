/**
 * Unit tests for Health and Readiness Endpoints
 *
 * Tests health check functionality and component status reporting.
 */

import {
  createHealthRouter,
  performHealthCheck,
  HealthCheckDependencies,
  ComponentHealth,
} from '../../../src/server/health';
import { StorageAdapter } from '../../../specs/001-production-robustness/contracts/StorageAdapter.contract';
import { EventBus } from '../../../specs/001-production-robustness/contracts/EventBus.contract';
import { AgentHealthMonitor } from '../../../specs/001-production-robustness/contracts/AgentHealthMonitor.contract';

describe('Health Endpoints', () => {
  describe('performHealthCheck', () => {
    it('should return healthy status when all components are healthy', async () => {
      const mockStorage: Partial<StorageAdapter> = {
        getStats: jest.fn().mockResolvedValue({
          totalSessions: 10,
          sizeBytes: 1024,
          backendType: 'memory',
        }),
      };

      const mockEventBus: Partial<EventBus> = {
        getStats: jest.fn().mockResolvedValue({
          totalEventsPublished: 100,
          totalEventsDelivered: 95,
          activeSubscriptions: 3,
          uniqueTopics: 5,
          eventsInReplayQueue: 0,
          avgPropagationLatencyMs: 2,
          eventsByPriority: { critical: 10, normal: 90 },
          eventHistorySizeBytes: 2048,
        }),
      };

      const mockMonitor: Partial<AgentHealthMonitor> = {
        getStats: jest.fn().mockResolvedValue({
          totalAgents: 5,
          healthyAgents: 5,
          disconnectedAgents: 0,
          recoveringAgents: 0,
          totalHeartbeats: 100,
          failedHeartbeats: 0,
          recoveryAttempts: 0,
          successfulRecoveries: 0,
          avgHeartbeatLatency: 1,
          cpuOverheadPercent: 0.5,
        }),
      };

      const result = await performHealthCheck({
        storageAdapter: mockStorage as StorageAdapter,
        eventBus: mockEventBus as EventBus,
        agentMonitor: mockMonitor as AgentHealthMonitor,
      });

      expect(result.status).toBe('healthy');
      expect(result.components.storage.status).toBe('healthy');
      expect(result.components.eventBus.status).toBe('healthy');
      expect(result.components.agentMonitor.status).toBe('healthy');
      expect(result.timestamp).toBeTruthy();
    });

    it('should return degraded status when some components are unknown', async () => {
      const result = await performHealthCheck({});

      expect(result.status).toBe('degraded');
      expect(result.components.storage.status).toBe('unknown');
      expect(result.components.eventBus.status).toBe('unknown');
      expect(result.components.agentMonitor.status).toBe('unknown');
    });

    it('should return unhealthy status when any component is unhealthy', async () => {
      const mockStorage: Partial<StorageAdapter> = {
        getStats: jest.fn().mockRejectedValue(new Error('Storage unavailable')),
      };

      const mockEventBus: Partial<EventBus> = {
        getStats: jest.fn().mockResolvedValue({
          totalEventsPublished: 100,
          totalEventsDelivered: 95,
          activeSubscriptions: 3,
          uniqueTopics: 5,
          eventsInReplayQueue: 0,
          avgPropagationLatencyMs: 2,
          eventsByPriority: { critical: 10, normal: 90 },
          eventHistorySizeBytes: 2048,
        }),
      };

      const mockMonitor: Partial<AgentHealthMonitor> = {
        getStats: jest.fn().mockResolvedValue({
          totalAgents: 5,
          healthyAgents: 5,
          disconnectedAgents: 0,
          recoveringAgents: 0,
          totalHeartbeats: 100,
          failedHeartbeats: 0,
          recoveryAttempts: 0,
          successfulRecoveries: 0,
          avgHeartbeatLatency: 1,
          cpuOverheadPercent: 0.5,
        }),
      };

      const result = await performHealthCheck({
        storageAdapter: mockStorage as StorageAdapter,
        eventBus: mockEventBus as EventBus,
        agentMonitor: mockMonitor as AgentHealthMonitor,
      });

      expect(result.status).toBe('unhealthy');
      expect(result.components.storage.status).toBe('unhealthy');
      expect(result.components.storage.message).toContain('Storage unavailable');
    });

    it('should include component details in healthy responses', async () => {
      const mockStorage: Partial<StorageAdapter> = {
        getStats: jest.fn().mockResolvedValue({
          totalSessions: 42,
          sizeBytes: 8192,
          backendType: 'file',
        }),
      };

      const mockEventBus: Partial<EventBus> = {
        getStats: jest.fn().mockResolvedValue({
          totalEventsPublished: 200,
          totalEventsDelivered: 180,
          activeSubscriptions: 7,
          uniqueTopics: 12,
          eventsInReplayQueue: 5,
          avgPropagationLatencyMs: 3,
          eventsByPriority: { critical: 20, normal: 180 },
          eventHistorySizeBytes: 4096,
        }),
      };

      const mockMonitor: Partial<AgentHealthMonitor> = {
        getStats: jest.fn().mockResolvedValue({
          totalAgents: 10,
          healthyAgents: 8,
          disconnectedAgents: 1,
          recoveringAgents: 1,
          totalHeartbeats: 500,
          failedHeartbeats: 2,
          recoveryAttempts: 3,
          successfulRecoveries: 5,
          avgHeartbeatLatency: 2,
          cpuOverheadPercent: 0.8,
        }),
      };

      const result = await performHealthCheck({
        storageAdapter: mockStorage as StorageAdapter,
        eventBus: mockEventBus as EventBus,
        agentMonitor: mockMonitor as AgentHealthMonitor,
      });

      expect(result.components.storage.details).toEqual({
        totalSessions: 42,
        sizeBytes: 8192,
        backendType: 'file',
      });

      expect(result.components.eventBus.details).toEqual({
        totalEventsPublished: 200,
        totalEventsDelivered: 180,
        activeSubscriptions: 7,
        avgPropagationLatencyMs: 3,
      });

      expect(result.components.agentMonitor.details).toEqual({
        totalAgents: 10,
        healthyAgents: 8,
        disconnectedAgents: 1,
        recoveringAgents: 1,
        successfulRecoveries: 5,
      });
    });

    it('should handle agent monitor with many unhealthy agents', async () => {
      const mockMonitor: Partial<AgentHealthMonitor> = {
        getStats: jest.fn().mockResolvedValue({
          totalAgents: 10,
          healthyAgents: 3,
          disconnectedAgents: 5,
          recoveringAgents: 2,
          totalHeartbeats: 1000,
          failedHeartbeats: 50,
          recoveryAttempts: 15,
          successfulRecoveries: 10,
          avgHeartbeatLatency: 5,
          cpuOverheadPercent: 2,
        }),
      };

      const result = await performHealthCheck({
        agentMonitor: mockMonitor as AgentHealthMonitor,
      });

      // >50% unhealthy (7 out of 10) should mark component as unhealthy
      expect(result.components.agentMonitor.status).toBe('unhealthy');
    });
  });

  describe('createHealthRouter', () => {
    it('should create router with /health endpoint', () => {
      const router = createHealthRouter();
      expect(router).toBeDefined();
      // Router should have routes registered
      expect((router as any).stack).toBeDefined();
    });

    it('should create router with /ready endpoint', () => {
      const router = createHealthRouter();
      expect(router).toBeDefined();
      // Router should have routes registered
      expect((router as any).stack).toBeDefined();
    });
  });
});
