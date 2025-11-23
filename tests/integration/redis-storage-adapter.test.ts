/**
 * RedisStorageAdapter Integration Tests
 *
 * Runs the complete StorageAdapter contract test suite against RedisStorageAdapter.
 * Tests validate compliance with the StorageAdapter interface specification.
 *
 * Requirements:
 * - Redis server must be running on localhost:6379 (or configure via env vars)
 * - Use a dedicated test database (default: db 15)
 *
 * @see tests/contract/storage-adapter.shared.test.ts
 * @see src/persistence/RedisStorageAdapter.ts
 */

import { runStorageAdapterContractTests } from '../contract/storage-adapter.shared.test';
import { RedisStorageAdapter } from '../../src/persistence/RedisStorageAdapter';
import Redis from 'ioredis';

describe('RedisStorageAdapter', () => {
  // Use a dedicated test database to avoid conflicts
  const testConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    db: parseInt(process.env.REDIS_TEST_DB || '15', 10),
  };

  let cleanupClient: Redis;

  beforeAll(async () => {
    // Create dedicated Redis client for database cleanup
    cleanupClient = new Redis({
      host: testConfig.host,
      port: testConfig.port,
      db: testConfig.db,
    });

    // FLUSHDB clears entire test database
    await cleanupClient.flushdb();
  });

  beforeEach(async () => {
    // Clear entire test database before each test to ensure clean state
    if (cleanupClient) {
      await cleanupClient.flushdb();
    }
  });

  afterAll(async () => {
    // Clean up test database and close connection
    if (cleanupClient) {
      await cleanupClient.flushdb();
      await cleanupClient.quit();
    }
  });

  // Run complete contract test suite
  runStorageAdapterContractTests(() => new RedisStorageAdapter(testConfig));
});
