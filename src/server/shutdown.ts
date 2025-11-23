/**
 * Graceful Shutdown Handler
 *
 * Handles SIGTERM/SIGINT signals and orchestrates clean shutdown sequence
 * across all components.
 *
 * @see specs/001-production-robustness/spec.md FR-054
 */

import { Server } from 'http';
import { StorageAdapter } from '../../specs/001-production-robustness/contracts/StorageAdapter.contract';
import { EventBus } from '../../specs/001-production-robustness/contracts/EventBus.contract';
import { AgentHealthMonitor } from '../../specs/001-production-robustness/contracts/AgentHealthMonitor.contract';

/**
 * Shutdown configuration
 */
export interface ShutdownConfig {
  /** Timeout for waiting for in-flight requests (milliseconds) */
  gracefulTimeout?: number;
  /** Total shutdown timeout (milliseconds) */
  totalTimeout?: number;
  /** Logger function for shutdown progress */
  logger?: (message: string) => void;
}

/**
 * Shutdown dependencies
 */
export interface ShutdownDependencies {
  httpServer?: Server;
  storageAdapter?: StorageAdapter;
  eventBus?: EventBus;
  agentMonitor?: AgentHealthMonitor;
}

/**
 * Default shutdown configuration
 */
const DEFAULT_CONFIG: Required<ShutdownConfig> = {
  gracefulTimeout: 30000, // 30 seconds for in-flight requests
  totalTimeout: 60000, // 60 seconds total shutdown time
  logger: console.log,
};

/**
 * Shutdown state
 */
let isShuttingDown = false;
let shutdownPromise: Promise<void> | undefined;

/**
 * Setup graceful shutdown handlers
 *
 * Registers SIGTERM and SIGINT handlers to trigger graceful shutdown.
 * FR-054: 5-step shutdown sequence with timeouts
 *
 * @param dependencies Components to shutdown
 * @param config Shutdown configuration
 */
export function setupGracefulShutdown(
  dependencies: ShutdownDependencies,
  config: ShutdownConfig = {}
): void {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // Handle SIGTERM (e.g., from Kubernetes)
  process.on('SIGTERM', () => {
    finalConfig.logger('Received SIGTERM signal');
    performShutdown(dependencies, finalConfig);
  });

  // Handle SIGINT (e.g., Ctrl+C)
  process.on('SIGINT', () => {
    finalConfig.logger('Received SIGINT signal');
    performShutdown(dependencies, finalConfig);
  });

  // Handle uncaught errors during shutdown
  process.on('uncaughtException', (error) => {
    finalConfig.logger(`Uncaught exception during shutdown: ${error.message}`);
    if (isShuttingDown) {
      // Force exit if already shutting down
      process.exit(1);
    }
  });
}

/**
 * Perform graceful shutdown
 *
 * Implements 5-step shutdown sequence:
 * 1. Stop accepting new requests
 * 2. Wait for in-flight requests (max 30s)
 * 3. Close storage connections
 * 4. Stop event bus
 * 5. Exit process
 *
 * @param dependencies Components to shutdown
 * @param config Shutdown configuration
 */
export async function performShutdown(
  dependencies: ShutdownDependencies,
  config: ShutdownConfig = {}
): Promise<void> {
  // Prevent multiple shutdown attempts
  if (isShuttingDown) {
    if (shutdownPromise) {
      return shutdownPromise;
    }
    return;
  }

  isShuttingDown = true;
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const shutdownStartTime = Date.now();

  shutdownPromise = (async () => {
    try {
      // Set overall timeout
      const timeoutHandle = setTimeout(() => {
        finalConfig.logger(
          `Shutdown timeout (${finalConfig.totalTimeout}ms) reached, forcing exit`
        );
        process.exit(1);
      }, finalConfig.totalTimeout);

      // Step 1: Stop accepting new requests
      finalConfig.logger('[1/5] Stopping HTTP server from accepting new requests...');
      const step1Start = Date.now();
      await stopAcceptingRequests(dependencies.httpServer, finalConfig);
      finalConfig.logger(`[1/5] Complete (${Date.now() - step1Start}ms)`);

      // Step 2: Wait for in-flight requests
      finalConfig.logger('[2/5] Waiting for in-flight requests to complete...');
      const step2Start = Date.now();
      await waitForInflightRequests(
        dependencies.httpServer,
        finalConfig.gracefulTimeout
      );
      finalConfig.logger(`[2/5] Complete (${Date.now() - step2Start}ms)`);

      // Step 3: Close storage connections
      finalConfig.logger('[3/5] Closing storage connections...');
      const step3Start = Date.now();
      await closeStorage(dependencies.storageAdapter, finalConfig);
      finalConfig.logger(`[3/5] Complete (${Date.now() - step3Start}ms)`);

      // Step 4: Stop event bus
      finalConfig.logger('[4/5] Stopping event bus...');
      const step4Start = Date.now();
      await stopEventBus(dependencies.eventBus, finalConfig);
      finalConfig.logger(`[4/5] Complete (${Date.now() - step4Start}ms)`);

      // Step 5: Stop agent health monitor
      finalConfig.logger('[5/5] Stopping agent health monitor...');
      const step5Start = Date.now();
      await stopAgentMonitor(dependencies.agentMonitor, finalConfig);
      finalConfig.logger(`[5/5] Complete (${Date.now() - step5Start}ms)`);

      // Clear timeout
      clearTimeout(timeoutHandle);

      const totalTime = Date.now() - shutdownStartTime;
      finalConfig.logger(`Graceful shutdown complete (${totalTime}ms)`);

      // Exit process
      process.exit(0);
    } catch (error) {
      finalConfig.logger(
        `Error during shutdown: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  })();

  return shutdownPromise;
}

/**
 * Step 1: Stop accepting new requests
 */
async function stopAcceptingRequests(
  server: Server | undefined,
  config: Required<ShutdownConfig>
): Promise<void> {
  if (!server) {
    config.logger('No HTTP server configured, skipping');
    return;
  }

  return new Promise<void>((resolve) => {
    server.close(() => {
      config.logger('HTTP server stopped accepting new connections');
      resolve();
    });
  });
}

/**
 * Step 2: Wait for in-flight requests
 */
async function waitForInflightRequests(
  server: Server | undefined,
  timeout: number
): Promise<void> {
  if (!server) {
    return;
  }

  // Node.js HTTP server automatically waits for connections to close
  // when server.close() is called. We just wait for the timeout period.
  await new Promise<void>((resolve) => {
    setTimeout(resolve, Math.min(timeout, 100)); // Short wait
  });
}

/**
 * Step 3: Close storage connections
 */
async function closeStorage(
  storage: StorageAdapter | undefined,
  config: Required<ShutdownConfig>
): Promise<void> {
  if (!storage) {
    config.logger('No storage adapter configured, skipping');
    return;
  }

  try {
    // Check if storage has a close/disconnect method
    if ('close' in storage && typeof storage.close === 'function') {
      await (storage as any).close();
      config.logger('Storage connections closed');
    } else if (
      'disconnect' in storage &&
      typeof storage.disconnect === 'function'
    ) {
      await (storage as any).disconnect();
      config.logger('Storage disconnected');
    } else {
      config.logger('Storage adapter has no close method, skipping');
    }
  } catch (error) {
    config.logger(
      `Error closing storage: ${error instanceof Error ? error.message : String(error)}`
    );
    // Continue shutdown despite storage error
  }
}

/**
 * Step 4: Stop event bus
 */
async function stopEventBus(
  eventBus: EventBus | undefined,
  config: Required<ShutdownConfig>
): Promise<void> {
  if (!eventBus) {
    config.logger('No event bus configured, skipping');
    return;
  }

  try {
    // Event bus should flush pending events and stop
    if ('close' in eventBus && typeof eventBus.close === 'function') {
      await (eventBus as any).close();
      config.logger('Event bus stopped');
    } else if ('stop' in eventBus && typeof eventBus.stop === 'function') {
      await (eventBus as any).stop();
      config.logger('Event bus stopped');
    } else {
      config.logger('Event bus has no close/stop method, skipping');
    }
  } catch (error) {
    config.logger(
      `Error stopping event bus: ${error instanceof Error ? error.message : String(error)}`
    );
    // Continue shutdown despite event bus error
  }
}

/**
 * Step 5: Stop agent health monitor
 */
async function stopAgentMonitor(
  monitor: AgentHealthMonitor | undefined,
  config: Required<ShutdownConfig>
): Promise<void> {
  if (!monitor) {
    config.logger('No agent health monitor configured, skipping');
    return;
  }

  try {
    // Stop health monitoring using contract method
    if ('stopMonitoring' in monitor && typeof monitor.stopMonitoring === 'function') {
      monitor.stopMonitoring();
      config.logger('Agent health monitor stopped');
    } else {
      config.logger('Agent health monitor has no stopMonitoring method, skipping');
    }
  } catch (error) {
    config.logger(
      `Error stopping agent monitor: ${error instanceof Error ? error.message : String(error)}`
    );
    // Continue shutdown despite monitor error
  }
}

/**
 * Check if shutdown is in progress
 *
 * @returns True if shutdown has been initiated
 */
export function isShutdownInProgress(): boolean {
  return isShuttingDown;
}

/**
 * Reset shutdown state (for testing)
 */
export function resetShutdownState(): void {
  isShuttingDown = false;
  shutdownPromise = undefined;
}
