/**
 * SessionManager Integration Tests
 *
 * Tests SessionManager with InMemoryStorageAdapter implementation.
 * Uses shared contract test suite to validate all requirements.
 *
 * @see tests/contract/session-manager.shared.test.ts
 */

import { describe } from '@jest/globals';
import { runSessionManagerContractTests } from '../contract/session-manager.shared.test';
import { SessionManager } from '../../src/session/SessionManager';
import { InMemoryStorageAdapter } from '../../src/persistence/InMemoryStorageAdapter';

describe('SessionManager with InMemoryStorageAdapter', () => {
  runSessionManagerContractTests(() => {
    const adapter = new InMemoryStorageAdapter();
    return new SessionManager(adapter);
  });
});
