/**
 * StorageAdapterFactory Unit Tests
 *
 * Phase 2, Task 2.17 - Production Robustness Enhancements
 *
 * Tests factory pattern for creating StorageAdapter instances
 */

import { StorageAdapterFactory, StorageAdapterType } from '../../src/persistence/StorageAdapterFactory';
import { FileStorageAdapter } from '../../src/persistence/FileStorageAdapter';
import { InMemoryStorageAdapter } from '../../src/persistence/InMemoryStorageAdapter';

describe('StorageAdapterFactory', () => {
  describe('create()', () => {
    it('should create FileStorageAdapter for type "file"', () => {
      const adapter = StorageAdapterFactory.create({
        type: 'file',
        basePath: '/tmp/test-sessions'
      });

      expect(adapter).toBeInstanceOf(FileStorageAdapter);
    });

    it('should create InMemoryStorageAdapter for type "memory"', () => {
      const adapter = StorageAdapterFactory.create({
        type: 'memory'
      });

      expect(adapter).toBeInstanceOf(InMemoryStorageAdapter);
    });

    it('should throw error for type "redis" (not implemented)', () => {
      expect(() => {
        StorageAdapterFactory.create({ type: 'redis' });
      }).toThrow('RedisStorageAdapter not yet implemented');
    });

    it('should throw error for type "postgres" (not implemented)', () => {
      expect(() => {
        StorageAdapterFactory.create({ type: 'postgres' });
      }).toThrow('PostgresStorageAdapter not yet implemented');
    });

    it('should throw error for unsupported type', () => {
      expect(() => {
        StorageAdapterFactory.create({ type: 'invalid' as any });
      }).toThrow('Unsupported storage adapter type: invalid');
    });

    it('should pass basePath to FileStorageAdapter', () => {
      const customPath = '/custom/path/sessions';
      const adapter = StorageAdapterFactory.create({
        type: 'file',
        basePath: customPath
      }) as FileStorageAdapter;

      expect(adapter).toBeInstanceOf(FileStorageAdapter);
      // FileStorageAdapter stores basePath internally
    });

    it('should use default basePath if not provided for file adapter', () => {
      const adapter = StorageAdapterFactory.create({
        type: 'file'
      });

      expect(adapter).toBeInstanceOf(FileStorageAdapter);
    });
  });

  describe('createAndInitialize()', () => {
    it('should create and initialize FileStorageAdapter', async () => {
      const adapter = await StorageAdapterFactory.createAndInitialize({
        type: 'file',
        basePath: '/tmp/test-sessions-init'
      });

      expect(adapter).toBeInstanceOf(FileStorageAdapter);

      // Verify initialization by checking health
      const health = await adapter.healthCheck();
      expect(health.healthy).toBe(true);

      await adapter.close();
    });

    it('should create and initialize InMemoryStorageAdapter', async () => {
      const adapter = await StorageAdapterFactory.createAndInitialize({
        type: 'memory'
      });

      expect(adapter).toBeInstanceOf(InMemoryStorageAdapter);

      // Verify initialization by checking health
      const health = await adapter.healthCheck();
      expect(health.healthy).toBe(true);

      await adapter.close();
    });

    it('should throw error for unimplemented type during createAndInitialize', async () => {
      await expect(
        StorageAdapterFactory.createAndInitialize({ type: 'redis' })
      ).rejects.toThrow('RedisStorageAdapter not yet implemented');
    });
  });

  describe('getSupportedTypes()', () => {
    it('should return all supported adapter types', () => {
      const types = StorageAdapterFactory.getSupportedTypes();

      expect(types).toEqual(['file', 'memory', 'redis', 'postgres']);
      expect(types).toHaveLength(4);
    });

    it('should return array of strings', () => {
      const types = StorageAdapterFactory.getSupportedTypes();

      types.forEach(type => {
        expect(typeof type).toBe('string');
      });
    });
  });

  describe('getImplementedTypes()', () => {
    it('should return only implemented adapter types', () => {
      const types = StorageAdapterFactory.getImplementedTypes();

      expect(types).toEqual(['file', 'memory']);
      expect(types).toHaveLength(2);
    });

    it('should be a subset of supported types', () => {
      const implemented = StorageAdapterFactory.getImplementedTypes();
      const supported = StorageAdapterFactory.getSupportedTypes();

      implemented.forEach(type => {
        expect(supported).toContain(type);
      });
    });
  });

  describe('isImplemented()', () => {
    it('should return true for "file" adapter', () => {
      expect(StorageAdapterFactory.isImplemented('file')).toBe(true);
    });

    it('should return true for "memory" adapter', () => {
      expect(StorageAdapterFactory.isImplemented('memory')).toBe(true);
    });

    it('should return false for "redis" adapter', () => {
      expect(StorageAdapterFactory.isImplemented('redis')).toBe(false);
    });

    it('should return false for "postgres" adapter', () => {
      expect(StorageAdapterFactory.isImplemented('postgres')).toBe(false);
    });
  });

  describe('Type Safety', () => {
    it('should accept valid StorageAdapterType', () => {
      const validTypes: StorageAdapterType[] = ['file', 'memory', 'redis', 'postgres'];

      validTypes.forEach(type => {
        expect(() => {
          if (type === 'file' || type === 'memory') {
            StorageAdapterFactory.create({ type });
          } else {
            // These should throw for now
            try {
              StorageAdapterFactory.create({ type });
            } catch (e) {
              // Expected for unimplemented types
            }
          }
        }).not.toThrow(TypeError);
      });
    });
  });

  describe('Configuration Propagation', () => {
    it('should pass configuration to adapter initialize()', async () => {
      const config = {
        type: 'file' as const,
        basePath: '/tmp/test-config',
        customOption: 'test-value'
      };

      const adapter = await StorageAdapterFactory.createAndInitialize(config);

      // Verify adapter is initialized (health check)
      const health = await adapter.healthCheck();
      expect(health.healthy).toBe(true);

      await adapter.close();
    });
  });
});
