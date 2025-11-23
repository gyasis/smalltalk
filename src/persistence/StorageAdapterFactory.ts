/**
 * StorageAdapterFactory - Factory for creating StorageAdapter instances
 *
 * Phase 2, Task 2.17 - Production Robustness Enhancements
 *
 * Creates storage adapter instances by type with optional configuration.
 * Supports: file, memory, redis (placeholder), postgres (placeholder)
 */

import { StorageAdapter, StorageAdapterConfig } from '../../specs/001-production-robustness/contracts/StorageAdapter.contract';
import { FileStorageAdapter } from './FileStorageAdapter';
import { InMemoryStorageAdapter } from './InMemoryStorageAdapter';

/**
 * Supported storage adapter types
 */
export type StorageAdapterType = 'file' | 'memory' | 'redis' | 'postgres';

/**
 * Configuration for StorageAdapterFactory
 */
export interface StorageAdapterFactoryConfig extends StorageAdapterConfig {
  type: StorageAdapterType;
  basePath?: string;  // For file adapter
  // Future: redisUrl, postgresUrl, etc.
}

/**
 * Factory for creating StorageAdapter instances
 *
 * @example
 * ```typescript
 * // Create file-based storage
 * const adapter = StorageAdapterFactory.create({
 *   type: 'file',
 *   basePath: 'data/sessions'
 * });
 * await adapter.initialize();
 *
 * // Create in-memory storage (testing)
 * const testAdapter = StorageAdapterFactory.create({ type: 'memory' });
 * await testAdapter.initialize();
 * ```
 */
export class StorageAdapterFactory {
  /**
   * Create a StorageAdapter instance by type
   *
   * @param config - Configuration including adapter type
   * @returns StorageAdapter instance (not yet initialized)
   * @throws Error if adapter type is not supported
   */
  static create(config: StorageAdapterFactoryConfig): StorageAdapter {
    switch (config.type) {
      case 'file':
        return new FileStorageAdapter(config.basePath);

      case 'memory':
        return new InMemoryStorageAdapter();

      case 'redis':
        throw new Error('RedisStorageAdapter not yet implemented (Phase 7, Tasks 7.1-7.3)');

      case 'postgres':
        throw new Error('PostgresStorageAdapter not yet implemented (Phase 7, Tasks 7.4-7.6)');

      default:
        throw new Error(`Unsupported storage adapter type: ${(config as any).type}`);
    }
  }

  /**
   * Create and initialize a StorageAdapter in one step
   *
   * @param config - Configuration including adapter type
   * @returns Initialized StorageAdapter instance
   *
   * @example
   * ```typescript
   * const adapter = await StorageAdapterFactory.createAndInitialize({
   *   type: 'file',
   *   basePath: 'data/sessions'
   * });
   * // Ready to use immediately
   * await adapter.saveSession(session);
   * ```
   */
  static async createAndInitialize(config: StorageAdapterFactoryConfig): Promise<StorageAdapter> {
    const adapter = StorageAdapterFactory.create(config);
    await adapter.initialize(config);
    return adapter;
  }

  /**
   * Get list of supported adapter types
   *
   * @returns Array of supported adapter type strings
   */
  static getSupportedTypes(): StorageAdapterType[] {
    return ['file', 'memory', 'redis', 'postgres'];
  }

  /**
   * Get list of currently implemented adapter types
   *
   * @returns Array of implemented adapter type strings
   */
  static getImplementedTypes(): StorageAdapterType[] {
    return ['file', 'memory'];
  }

  /**
   * Check if an adapter type is implemented
   *
   * @param type - Storage adapter type to check
   * @returns true if implemented, false otherwise
   */
  static isImplemented(type: StorageAdapterType): boolean {
    return StorageAdapterFactory.getImplementedTypes().includes(type);
  }
}
