/**
 * Unit tests for Graceful Shutdown Handler
 *
 * Tests shutdown sequence and component cleanup.
 */

import { Server } from 'http';
import {
  setupGracefulShutdown,
  performShutdown,
  isShutdownInProgress,
  resetShutdownState,
  ShutdownDependencies,
  ShutdownConfig,
} from '../../../src/server/shutdown';
import { StorageAdapter } from '../../../specs/001-production-robustness/contracts/StorageAdapter.contract';
import { EventBus } from '../../../specs/001-production-robustness/contracts/EventBus.contract';
import { AgentHealthMonitor } from '../../../specs/001-production-robustness/contracts/AgentHealthMonitor.contract';

describe('Graceful Shutdown', () => {
  let mockLogger: jest.Mock;
  let originalExit: typeof process.exit;

  beforeEach(() => {
    // Reset shutdown state before each test
    resetShutdownState();

    // Mock logger
    mockLogger = jest.fn();

    // Mock process.exit to prevent actual exit
    originalExit = process.exit;
    process.exit = jest.fn() as any;
  });

  afterEach(() => {
    // Restore process.exit
    process.exit = originalExit;

    // Reset shutdown state
    resetShutdownState();
  });

  describe('setupGracefulShutdown', () => {
    it('should register SIGTERM handler', () => {
      const addListenerSpy = jest.spyOn(process, 'on');

      setupGracefulShutdown({}, { logger: mockLogger });

      expect(addListenerSpy).toHaveBeenCalledWith(
        'SIGTERM',
        expect.any(Function)
      );

      addListenerSpy.mockRestore();
    });

    it('should register SIGINT handler', () => {
      const addListenerSpy = jest.spyOn(process, 'on');

      setupGracefulShutdown({}, { logger: mockLogger });

      expect(addListenerSpy).toHaveBeenCalledWith(
        'SIGINT',
        expect.any(Function)
      );

      addListenerSpy.mockRestore();
    });
  });

  describe('performShutdown', () => {
    it('should execute 5-step shutdown sequence', async () => {
      const dependencies: ShutdownDependencies = {};
      const config: ShutdownConfig = {
        logger: mockLogger,
        gracefulTimeout: 100,
        totalTimeout: 1000,
      };

      await performShutdown(dependencies, config);

      // Should log all 5 steps
      expect(mockLogger).toHaveBeenCalledWith(
        expect.stringContaining('[1/5]')
      );
      expect(mockLogger).toHaveBeenCalledWith(
        expect.stringContaining('[2/5]')
      );
      expect(mockLogger).toHaveBeenCalledWith(
        expect.stringContaining('[3/5]')
      );
      expect(mockLogger).toHaveBeenCalledWith(
        expect.stringContaining('[4/5]')
      );
      expect(mockLogger).toHaveBeenCalledWith(
        expect.stringContaining('[5/5]')
      );

      // Should log completion
      expect(mockLogger).toHaveBeenCalledWith(
        expect.stringContaining('Graceful shutdown complete')
      );

      // Should exit with code 0
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should close HTTP server when provided', async () => {
      const mockServer = {
        close: jest.fn((cb) => cb()),
      } as unknown as Server;

      const dependencies: ShutdownDependencies = {
        httpServer: mockServer,
      };

      await performShutdown(dependencies, {
        logger: mockLogger,
        gracefulTimeout: 100,
        totalTimeout: 1000,
      });

      expect(mockServer.close).toHaveBeenCalled();
    });

    it('should close storage adapter when provided', async () => {
      const mockStorage = {
        close: jest.fn().mockResolvedValue(undefined),
        getStats: jest.fn(),
        saveSession: jest.fn(),
        getSession: jest.fn(),
        deleteSession: jest.fn(),
        listSessions: jest.fn(),
      } as unknown as StorageAdapter;

      const dependencies: ShutdownDependencies = {
        storageAdapter: mockStorage,
      };

      await performShutdown(dependencies, {
        logger: mockLogger,
        gracefulTimeout: 100,
        totalTimeout: 1000,
      });

      expect(mockStorage.close).toHaveBeenCalled();
    });

    it('should stop event bus when provided', async () => {
      const mockEventBus = {
        close: jest.fn().mockResolvedValue(undefined),
        publish: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
        getStats: jest.fn(),
      } as unknown as EventBus & { close: jest.Mock };

      const dependencies: ShutdownDependencies = {
        eventBus: mockEventBus,
      };

      await performShutdown(dependencies, {
        logger: mockLogger,
        gracefulTimeout: 100,
        totalTimeout: 1000,
      });

      expect(mockEventBus.close).toHaveBeenCalled();
    });

    it('should stop agent health monitor when provided', async () => {
      const mockMonitor = {
        stopMonitoring: jest.fn(),
        registerAgent: jest.fn(),
        heartbeat: jest.fn(),
        getHealthStatus: jest.fn(),
        getStats: jest.fn(),
      } as unknown as AgentHealthMonitor & { stopMonitoring: jest.Mock };

      const dependencies: ShutdownDependencies = {
        agentMonitor: mockMonitor,
      };

      await performShutdown(dependencies, {
        logger: mockLogger,
        gracefulTimeout: 100,
        totalTimeout: 1000,
      });

      expect(mockMonitor.stopMonitoring).toHaveBeenCalled();
    });

    it('should handle storage close errors gracefully', async () => {
      const mockStorage = {
        close: jest.fn().mockRejectedValue(new Error('Close failed')),
        getStats: jest.fn(),
        saveSession: jest.fn(),
        getSession: jest.fn(),
        deleteSession: jest.fn(),
        listSessions: jest.fn(),
      } as unknown as StorageAdapter;

      const dependencies: ShutdownDependencies = {
        storageAdapter: mockStorage,
      };

      await performShutdown(dependencies, {
        logger: mockLogger,
        gracefulTimeout: 100,
        totalTimeout: 1000,
      });

      // Should log error but continue shutdown
      expect(mockLogger).toHaveBeenCalledWith(
        expect.stringContaining('Error closing storage')
      );
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should prevent multiple simultaneous shutdowns', async () => {
      const dependencies: ShutdownDependencies = {};
      const config: ShutdownConfig = {
        logger: mockLogger,
        gracefulTimeout: 100,
        totalTimeout: 1000,
      };

      // Start first shutdown (don't await)
      const shutdown1 = performShutdown(dependencies, config);

      // Try to start second shutdown
      const shutdown2 = performShutdown(dependencies, config);

      // Both should resolve to the same promise
      await Promise.all([shutdown1, shutdown2]);

      // Should only exit once
      expect(process.exit).toHaveBeenCalledTimes(1);
    });

    it('should set shutdown in progress flag', () => {
      expect(isShutdownInProgress()).toBe(false);

      const dependencies: ShutdownDependencies = {};
      performShutdown(dependencies, {
        logger: mockLogger,
        gracefulTimeout: 100,
        totalTimeout: 1000,
      });

      expect(isShutdownInProgress()).toBe(true);
    });

    it('should handle components without close methods', async () => {
      const mockStorage = {
        // No close method
        getStats: jest.fn(),
        saveSession: jest.fn(),
        getSession: jest.fn(),
        deleteSession: jest.fn(),
        listSessions: jest.fn(),
        initialize: jest.fn(),
      } as unknown as StorageAdapter;

      const mockMonitor = {
        // No stopMonitoring method
        registerAgent: jest.fn(),
        heartbeat: jest.fn(),
        getHealthStatus: jest.fn(),
        getStats: jest.fn(),
        initialize: jest.fn(),
        startMonitoring: jest.fn(),
      } as unknown as AgentHealthMonitor;

      const dependencies: ShutdownDependencies = {
        storageAdapter: mockStorage,
        agentMonitor: mockMonitor,
      };

      await performShutdown(dependencies, {
        logger: mockLogger,
        gracefulTimeout: 100,
        totalTimeout: 1000,
      });

      // Should log skip messages for both components
      expect(mockLogger).toHaveBeenCalledWith(
        expect.stringContaining('has no close method')
      );
      expect(mockLogger).toHaveBeenCalledWith(
        expect.stringContaining('has no stopMonitoring method')
      );
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should respect total timeout', async () => {
      const slowStorage = {
        close: jest.fn().mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 5000))
        ),
        getStats: jest.fn(),
        saveSession: jest.fn(),
        getSession: jest.fn(),
        deleteSession: jest.fn(),
        listSessions: jest.fn(),
      } as unknown as StorageAdapter;

      const dependencies: ShutdownDependencies = {
        storageAdapter: slowStorage,
      };

      // Set very short timeout
      await performShutdown(dependencies, {
        logger: mockLogger,
        gracefulTimeout: 100,
        totalTimeout: 200, // 200ms total timeout
      });

      // Should force exit due to timeout
      expect(process.exit).toHaveBeenCalled();
    }, 10000); // Increase test timeout
  });

  describe('isShutdownInProgress', () => {
    it('should return false initially', () => {
      expect(isShutdownInProgress()).toBe(false);
    });

    it('should return true after shutdown starts', () => {
      performShutdown({}, { logger: mockLogger, totalTimeout: 1000 });
      expect(isShutdownInProgress()).toBe(true);
    });
  });

  describe('resetShutdownState', () => {
    it('should reset shutdown flag', () => {
      performShutdown({}, { logger: mockLogger, totalTimeout: 1000 });
      expect(isShutdownInProgress()).toBe(true);

      resetShutdownState();
      expect(isShutdownInProgress()).toBe(false);
    });
  });
});
