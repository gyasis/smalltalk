/**
 * InMemoryStorageAdapter Integration Tests
 *
 * Runs the full StorageAdapter contract test suite against InMemoryStorageAdapter.
 *
 * @see src/persistence/InMemoryStorageAdapter.ts
 * @see tests/contract/storage-adapter.shared.test.ts
 */

import { runStorageAdapterContractTests } from '../contract/storage-adapter.shared.test';
import { InMemoryStorageAdapter } from '../../src/persistence/InMemoryStorageAdapter';

describe('InMemoryStorageAdapter Contract Tests', () => {
  runStorageAdapterContractTests(() => new InMemoryStorageAdapter());
});
