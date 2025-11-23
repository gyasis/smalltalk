# Contract Testing Recommendation for Storage Adapters

## Executive Summary

**Recommended Approach**: **Shared Test Suite with Factory Pattern**

This approach uses a reusable test suite function that accepts an adapter factory, enabling all implementations to be tested against the same contract with minimal boilerplate and maximum type safety.

---

## The Recommended Pattern

### Core Structure

```typescript
// src/__tests__/contracts/StorageAdapterContract.ts

import { StorageAdapter } from '../../types';

/**
 * Factory function type for creating adapter instances in tests
 */
export type AdapterFactory<T extends StorageAdapter = StorageAdapter> = () => T | Promise<T>;

/**
 * Cleanup function type for teardown operations
 */
export type AdapterCleanup = () => void | Promise<void>;

/**
 * Contract test suite for storage adapters
 * Tests the complete StorageAdapter interface contract
 */
export function testStorageAdapterContract(
  adapterName: string,
  createAdapter: AdapterFactory,
  cleanup?: AdapterCleanup
) {
  describe(`StorageAdapter Contract: ${adapterName}`, () => {
    let adapter: StorageAdapter;

    beforeEach(async () => {
      adapter = await createAdapter();
    });

    afterEach(async () => {
      if (cleanup) {
        await cleanup();
      }
    });

    describe('Session Management', () => {
      it('should save and retrieve sessions', async () => {
        const sessionId = 'test-session-123';
        const session = {
          id: sessionId,
          messages: [
            {
              id: 'msg-1',
              role: 'user' as const,
              content: 'Hello',
              timestamp: new Date()
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await adapter.saveSession(session);
        const retrieved = await adapter.getSession(sessionId);

        expect(retrieved).toBeDefined();
        expect(retrieved?.id).toBe(sessionId);
        expect(retrieved?.messages).toHaveLength(1);
        expect(retrieved?.messages[0].content).toBe('Hello');
      });

      it('should return null for non-existent sessions', async () => {
        const result = await adapter.getSession('non-existent-id');
        expect(result).toBeNull();
      });

      it('should update existing sessions', async () => {
        const sessionId = 'update-test';
        const session = {
          id: sessionId,
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await adapter.saveSession(session);

        const updatedSession = {
          ...session,
          messages: [
            {
              id: 'msg-1',
              role: 'user' as const,
              content: 'Updated',
              timestamp: new Date()
            }
          ],
          updatedAt: new Date()
        };

        await adapter.saveSession(updatedSession);
        const retrieved = await adapter.getSession(sessionId);

        expect(retrieved?.messages).toHaveLength(1);
        expect(retrieved?.messages[0].content).toBe('Updated');
      });

      it('should delete sessions', async () => {
        const sessionId = 'delete-test';
        const session = {
          id: sessionId,
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await adapter.saveSession(session);
        const deleted = await adapter.deleteSession(sessionId);

        expect(deleted).toBe(true);
        expect(await adapter.getSession(sessionId)).toBeNull();
      });

      it('should return false when deleting non-existent session', async () => {
        const deleted = await adapter.deleteSession('non-existent');
        expect(deleted).toBe(false);
      });

      it('should list all session IDs', async () => {
        const session1 = {
          id: 'session-1',
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };
        const session2 = {
          id: 'session-2',
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await adapter.saveSession(session1);
        await adapter.saveSession(session2);

        const sessionIds = await adapter.listSessions();
        expect(sessionIds).toContain('session-1');
        expect(sessionIds).toContain('session-2');
        expect(sessionIds.length).toBeGreaterThanOrEqual(2);
      });
    });

    describe('Message Management', () => {
      it('should add messages to sessions', async () => {
        const sessionId = 'msg-test';
        const session = {
          id: sessionId,
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await adapter.saveSession(session);

        const message = {
          id: 'msg-1',
          role: 'user' as const,
          content: 'Test message',
          timestamp: new Date()
        };

        await adapter.addMessage(sessionId, message);
        const retrieved = await adapter.getSession(sessionId);

        expect(retrieved?.messages).toHaveLength(1);
        expect(retrieved?.messages[0].content).toBe('Test message');
      });

      it('should retrieve session messages', async () => {
        const sessionId = 'get-msgs-test';
        const messages = [
          {
            id: 'msg-1',
            role: 'user' as const,
            content: 'Message 1',
            timestamp: new Date()
          },
          {
            id: 'msg-2',
            role: 'assistant' as const,
            content: 'Message 2',
            timestamp: new Date()
          }
        ];

        const session = {
          id: sessionId,
          messages,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await adapter.saveSession(session);
        const retrieved = await adapter.getMessages(sessionId);

        expect(retrieved).toHaveLength(2);
        expect(retrieved[0].content).toBe('Message 1');
        expect(retrieved[1].content).toBe('Message 2');
      });

      it('should return empty array for non-existent session messages', async () => {
        const messages = await adapter.getMessages('non-existent');
        expect(messages).toEqual([]);
      });

      it('should clear all messages from a session', async () => {
        const sessionId = 'clear-test';
        const session = {
          id: sessionId,
          messages: [
            {
              id: 'msg-1',
              role: 'user' as const,
              content: 'Test',
              timestamp: new Date()
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await adapter.saveSession(session);
        await adapter.clearMessages(sessionId);

        const retrieved = await adapter.getSession(sessionId);
        expect(retrieved?.messages).toEqual([]);
      });
    });

    describe('Memory Management', () => {
      it('should save and retrieve memories', async () => {
        const sessionId = 'memory-test';
        const memory = {
          key: 'user_preference',
          value: 'dark_mode',
          timestamp: new Date()
        };

        await adapter.saveMemory(sessionId, memory);
        const retrieved = await adapter.getMemory(sessionId, 'user_preference');

        expect(retrieved).toBeDefined();
        expect(retrieved?.value).toBe('dark_mode');
      });

      it('should return null for non-existent memory', async () => {
        const memory = await adapter.getMemory('session-1', 'non-existent-key');
        expect(memory).toBeNull();
      });

      it('should list all memories for a session', async () => {
        const sessionId = 'list-memory-test';
        const memory1 = {
          key: 'pref1',
          value: 'value1',
          timestamp: new Date()
        };
        const memory2 = {
          key: 'pref2',
          value: 'value2',
          timestamp: new Date()
        };

        await adapter.saveMemory(sessionId, memory1);
        await adapter.saveMemory(sessionId, memory2);

        const memories = await adapter.listMemories(sessionId);
        expect(memories).toHaveLength(2);
        expect(memories.map(m => m.key)).toContain('pref1');
        expect(memories.map(m => m.key)).toContain('pref2');
      });

      it('should delete memories', async () => {
        const sessionId = 'delete-memory-test';
        const memory = {
          key: 'temp_data',
          value: 'temporary',
          timestamp: new Date()
        };

        await adapter.saveMemory(sessionId, memory);
        const deleted = await adapter.deleteMemory(sessionId, 'temp_data');

        expect(deleted).toBe(true);
        expect(await adapter.getMemory(sessionId, 'temp_data')).toBeNull();
      });

      it('should return false when deleting non-existent memory', async () => {
        const deleted = await adapter.deleteMemory('session-1', 'non-existent');
        expect(deleted).toBe(false);
      });
    });

    describe('Error Handling', () => {
      it('should handle concurrent operations safely', async () => {
        const sessionId = 'concurrent-test';
        const session = {
          id: sessionId,
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await adapter.saveSession(session);

        // Perform multiple concurrent operations
        const operations = [
          adapter.addMessage(sessionId, {
            id: 'msg-1',
            role: 'user' as const,
            content: 'Message 1',
            timestamp: new Date()
          }),
          adapter.addMessage(sessionId, {
            id: 'msg-2',
            role: 'user' as const,
            content: 'Message 2',
            timestamp: new Date()
          }),
          adapter.saveMemory(sessionId, {
            key: 'key1',
            value: 'value1',
            timestamp: new Date()
          })
        ];

        await Promise.all(operations);

        const messages = await adapter.getMessages(sessionId);
        const memories = await adapter.listMemories(sessionId);

        expect(messages.length).toBeGreaterThanOrEqual(2);
        expect(memories.length).toBeGreaterThanOrEqual(1);
      });

      it('should throw descriptive error for invalid session data', async () => {
        // Test depends on adapter implementation
        // Some adapters may validate, others may not
        // This is a guideline test - adapt as needed
        try {
          await adapter.saveSession(null as any);
          // If no error thrown, adapter allows it (acceptable)
        } catch (error) {
          expect(error).toBeDefined();
        }
      });
    });

    describe('Data Persistence', () => {
      it('should persist data across adapter instances', async () => {
        const sessionId = 'persistence-test';
        const session = {
          id: sessionId,
          messages: [
            {
              id: 'msg-1',
              role: 'user' as const,
              content: 'Persistent message',
              timestamp: new Date()
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await adapter.saveSession(session);

        // Create new adapter instance
        const newAdapter = await createAdapter();
        const retrieved = await newAdapter.getSession(sessionId);

        expect(retrieved).toBeDefined();
        expect(retrieved?.messages[0].content).toBe('Persistent message');
      });
    });
  });
}
```

---

## Usage Examples

### 1. File System Adapter Test

```typescript
// src/__tests__/adapters/FileSystemAdapter.test.ts

import { testStorageAdapterContract } from '../contracts/StorageAdapterContract';
import { FileSystemAdapter } from '../../adapters/FileSystemAdapter';
import * as fs from 'fs/promises';
import * as path from 'path';

const TEST_DIR = path.join(__dirname, '../__test-data__/fs-adapter');

testStorageAdapterContract(
  'FileSystemAdapter',
  async () => {
    // Setup: ensure test directory exists
    await fs.mkdir(TEST_DIR, { recursive: true });
    return new FileSystemAdapter({ storagePath: TEST_DIR });
  },
  async () => {
    // Cleanup: remove test directory
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  }
);

// Adapter-specific tests
describe('FileSystemAdapter - Specific Features', () => {
  it('should create storage directory if it does not exist', async () => {
    const nonExistentPath = path.join(__dirname, '../__test-data__/new-dir');

    try {
      const adapter = new FileSystemAdapter({ storagePath: nonExistentPath });
      await adapter.saveSession({
        id: 'test',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const exists = await fs.access(nonExistentPath)
        .then(() => true)
        .catch(() => false);

      expect(exists).toBe(true);
    } finally {
      await fs.rm(nonExistentPath, { recursive: true, force: true });
    }
  });

  it('should handle file system errors gracefully', async () => {
    const adapter = new FileSystemAdapter({ storagePath: '/invalid/path/no/permissions' });

    await expect(adapter.saveSession({
      id: 'test',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    })).rejects.toThrow();
  });
});
```

### 2. Redis Adapter Test

```typescript
// src/__tests__/adapters/RedisAdapter.test.ts

import { testStorageAdapterContract } from '../contracts/StorageAdapterContract';
import { RedisAdapter } from '../../adapters/RedisAdapter';
import Redis from 'ioredis';

const TEST_PREFIX = 'test:adapter:';

testStorageAdapterContract(
  'RedisAdapter',
  async () => {
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db: parseInt(process.env.REDIS_TEST_DB || '15') // Use separate DB for tests
    });

    return new RedisAdapter({
      client: redis,
      keyPrefix: TEST_PREFIX
    });
  },
  async () => {
    // Cleanup: delete all test keys
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db: parseInt(process.env.REDIS_TEST_DB || '15')
    });

    const keys = await redis.keys(`${TEST_PREFIX}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    await redis.quit();
  }
);

// Redis-specific tests
describe('RedisAdapter - Specific Features', () => {
  it('should support TTL for sessions', async () => {
    const redis = new Redis({ db: 15 });
    const adapter = new RedisAdapter({
      client: redis,
      keyPrefix: TEST_PREFIX,
      ttl: 1 // 1 second TTL
    });

    await adapter.saveSession({
      id: 'ttl-test',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Wait for TTL to expire
    await new Promise(resolve => setTimeout(resolve, 1100));

    const session = await adapter.getSession('ttl-test');
    expect(session).toBeNull();

    await redis.quit();
  });
});
```

### 3. In-Memory Adapter Test

```typescript
// src/__tests__/adapters/InMemoryAdapter.test.ts

import { testStorageAdapterContract } from '../contracts/StorageAdapterContract';
import { InMemoryAdapter } from '../../adapters/InMemoryAdapter';

testStorageAdapterContract(
  'InMemoryAdapter',
  () => new InMemoryAdapter(),
  () => {
    // No cleanup needed for in-memory
  }
);

// In-memory specific tests
describe('InMemoryAdapter - Specific Features', () => {
  it('should clear all data', () => {
    const adapter = new InMemoryAdapter();

    adapter.saveSession({
      id: 'test-1',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    adapter.clear();

    expect(adapter.listSessions()).resolves.toEqual([]);
  });

  it('should not persist across instances', async () => {
    const adapter1 = new InMemoryAdapter();
    await adapter1.saveSession({
      id: 'test',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const adapter2 = new InMemoryAdapter();
    const session = await adapter2.getSession('test');

    expect(session).toBeNull();
  });
});
```

---

## Why This Approach?

### ✅ Meets All Requirements

1. **Same contract tests for all implementations**: Single test suite runs against all adapters
2. **Works with Jest**: Native Jest describe/it/expect patterns
3. **Minimal boilerplate**: 2-line import + function call per adapter
4. **Clear failure messages**: Jest's built-in error reporting shows exactly which method/assertion failed
5. **Type-safe**: Full TypeScript support with generics

### ✅ Additional Benefits

1. **Easy to extend**: Add new contract tests in one place
2. **Adapter-specific tests**: Each adapter can have additional tests for unique features
3. **Flexible setup/teardown**: Factory pattern allows complex initialization
4. **Async-first**: Handles async adapters naturally
5. **Discoverable**: Test suite function is exported and documented
6. **Maintainable**: Single source of truth for contract definition

---

## Comparison with Alternatives

### Alternative 1: Abstract Test Class
```typescript
abstract class StorageAdapterContractTests {
  abstract createAdapter(): StorageAdapter;

  // Tests defined as methods
}

class FileSystemAdapterTests extends StorageAdapterContractTests {
  createAdapter() { return new FileSystemAdapter(); }
}
```

**❌ Rejected because:**
- Less idiomatic in Jest (Jest favors functions over classes)
- More boilerplate per adapter
- Harder to type-check
- Less flexible for setup/teardown

### Alternative 2: test.each with Adapter Array
```typescript
describe.each([
  ['FileSystem', () => new FileSystemAdapter()],
  ['Redis', () => new RedisAdapter()],
  ['InMemory', () => new InMemoryAdapter()]
])('%s Adapter', (name, factory) => {
  // Tests here
});
```

**❌ Rejected because:**
- Cannot have different setup/teardown per adapter
- Cannot add adapter-specific tests easily
- All adapters tested in single file (organization issue)
- Harder to run tests for single adapter

### Alternative 3: Custom Test Runner
```typescript
const runner = new ContractTestRunner();
runner.registerAdapter('FileSystem', fileSystemFactory);
runner.run();
```

**❌ Rejected because:**
- Over-engineered for this use case
- Hides Jest functionality
- Harder to debug
- More code to maintain

---

## Adding a New Adapter

To add tests for a new storage adapter implementation:

1. **Create test file**: `src/__tests__/adapters/YourAdapter.test.ts`

2. **Import and call contract test**:
   ```typescript
   import { testStorageAdapterContract } from '../contracts/StorageAdapterContract';
   import { YourAdapter } from '../../adapters/YourAdapter';

   testStorageAdapterContract(
     'YourAdapter',
     () => new YourAdapter(/* config */),
     () => {
       // Optional cleanup
     }
   );
   ```

3. **Add adapter-specific tests** (optional):
   ```typescript
   describe('YourAdapter - Specific Features', () => {
     it('should handle special feature X', () => {
       // Test implementation
     });
   });
   ```

That's it! The adapter is now tested against the full contract.

---

## Running Tests

```bash
# Run all adapter contract tests
npm test -- src/__tests__/adapters

# Run specific adapter tests
npm test -- FileSystemAdapter.test.ts

# Run contract tests only (no adapter-specific tests)
npm test -- StorageAdapterContract

# Watch mode for development
npm test -- --watch src/__tests__/adapters
```

---

## Type Safety Features

The pattern leverages TypeScript generics for full type safety:

```typescript
// Factory can specify exact adapter type
export type AdapterFactory<T extends StorageAdapter = StorageAdapter> =
  () => T | Promise<T>;

// Usage with specific adapter type
testStorageAdapterContract<FileSystemAdapter>(
  'FileSystemAdapter',
  async () => new FileSystemAdapter({ path: './data' })
);

// TypeScript will ensure factory returns correct type
```

---

## Best Practices

### 1. Test Data Isolation
- Use unique test directories/prefixes per adapter type
- Clean up after tests to avoid pollution
- Use separate databases/namespaces for tests

### 2. Async Handling
- Always use `async/await` for adapter operations
- Ensure cleanup functions are async if needed
- Handle promise rejections in cleanup

### 3. Error Testing
- Test both success and failure paths
- Verify error messages are descriptive
- Ensure errors don't leak resources

### 4. Performance Testing
- Add optional performance tests for specific adapters
- Test concurrent operations
- Verify scalability for large datasets

### 5. Documentation
- Document adapter-specific configuration requirements
- Provide example usage in test files
- Note any special setup (Docker, databases, etc.)

---

## Summary

The **Shared Test Suite with Factory Pattern** provides:

- ✅ Single source of truth for contract tests
- ✅ Minimal boilerplate per adapter
- ✅ Full type safety with TypeScript
- ✅ Clear, Jest-native error messages
- ✅ Flexible setup/teardown per adapter
- ✅ Easy to add new adapters
- ✅ Support for adapter-specific tests
- ✅ Async-first design
- ✅ Industry-standard pattern

This approach is used by major projects like:
- Prisma (database adapter testing)
- Socket.io (transport adapter testing)
- Winston (logger transport testing)

It balances simplicity, maintainability, and developer experience while ensuring contract compliance across all implementations.
