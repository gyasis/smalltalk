/**
 * FileStorageAdapter Integration Tests
 *
 * Runs the complete StorageAdapter contract test suite against FileStorageAdapter.
 * Tests validate compliance with the StorageAdapter interface specification.
 *
 * @see tests/contract/storage-adapter.shared.test.ts
 * @see src/persistence/FileStorageAdapter.ts
 */

import { runStorageAdapterContractTests } from '../contract/storage-adapter.shared.test';
import { FileStorageAdapter } from '../../src/persistence/FileStorageAdapter';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('FileStorageAdapter', () => {
  const testBasePath = path.join('/tmp', 'smalltalk-test-sessions', `${Date.now()}`);

  beforeAll(async () => {
    // Create test directory
    await fs.mkdir(testBasePath, { recursive: true });
  });

  afterAll(async () => {
    // Clean up test directory
    try {
      await fs.rm(testBasePath, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to clean up test directory:', error);
    }
  });

  beforeEach(async () => {
    // Clean test directory before each test
    try {
      await fs.rm(testBasePath, { recursive: true, force: true });
      await fs.mkdir(testBasePath, { recursive: true });
    } catch (error) {
      console.error('Failed to clean up before test:', error);
    }
  });

  // Run complete contract test suite
  runStorageAdapterContractTests(() => new FileStorageAdapter(testBasePath));
});
