# Contract Testing Quick Start Guide

## TL;DR - Start Here

**Goal**: Ensure all storage adapter implementations (FileSystem, Redis, InMemory, etc.) pass the same contract tests.

**Solution**: Shared test suite pattern with factory functions.

**Time to add new adapter**: ~3 minutes

---

## Implementation Checklist

### Phase 1: Create Contract (One Time)

- [ ] Define `StorageAdapter` interface in `/src/types/index.ts`
- [ ] Create contract test suite in `/src/__tests__/contracts/StorageAdapterContract.ts`
- [ ] Write 18 core contract tests covering all interface methods

### Phase 2: Test Adapters (Per Adapter)

- [ ] Create test file: `/src/__tests__/adapters/YourAdapter.test.ts`
- [ ] Import contract test function
- [ ] Call with factory function and cleanup
- [ ] Add adapter-specific tests (optional)

---

## Code Templates

### 1. StorageAdapter Interface

```typescript
// src/types/index.ts

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Memory {
  key: string;
  value: any;
  timestamp: Date;
}

export interface StorageAdapter {
  // Session management
  saveSession(session: ChatSession): Promise<void>;
  getSession(sessionId: string): Promise<ChatSession | null>;
  deleteSession(sessionId: string): Promise<boolean>;
  listSessions(): Promise<string[]>;

  // Message management
  addMessage(sessionId: string, message: ChatMessage): Promise<void>;
  getMessages(sessionId: string): Promise<ChatMessage[]>;
  clearMessages(sessionId: string): Promise<void>;

  // Memory management
  saveMemory(sessionId: string, memory: Memory): Promise<void>;
  getMemory(sessionId: string, key: string): Promise<Memory | null>;
  listMemories(sessionId: string): Promise<Memory[]>;
  deleteMemory(sessionId: string, key: string): Promise<boolean>;
}
```

### 2. Contract Test Suite (Copy Directly)

```typescript
// src/__tests__/contracts/StorageAdapterContract.ts

import { StorageAdapter } from '../../types';

export type AdapterFactory<T extends StorageAdapter = StorageAdapter> =
  () => T | Promise<T>;
export type AdapterCleanup = () => void | Promise<void>;

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
      if (cleanup) await cleanup();
    });

    // Copy all tests from main recommendation document
    // See: docs/contract-testing-recommendation.md
  });
}
```

### 3. Adapter Test Template

```typescript
// src/__tests__/adapters/[AdapterName].test.ts

import { testStorageAdapterContract } from '../contracts/StorageAdapterContract';
import { YourAdapter } from '../../adapters/YourAdapter';

// Run contract tests
testStorageAdapterContract(
  'YourAdapter',
  async () => {
    // Setup: create and configure adapter
    return new YourAdapter({
      // configuration here
    });
  },
  async () => {
    // Cleanup: tear down resources
    // Delete test data, close connections, etc.
  }
);

// Optional: Add adapter-specific tests
describe('YourAdapter - Specific Features', () => {
  it('should handle unique feature X', async () => {
    const adapter = new YourAdapter();
    // Test implementation
  });
});
```

---

## Real-World Examples

### FileSystem Adapter (Simplest)

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
    await fs.mkdir(TEST_DIR, { recursive: true });
    return new FileSystemAdapter({ storagePath: TEST_DIR });
  },
  async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  }
);
```

### Redis Adapter (External Dependency)

```typescript
// src/__tests__/adapters/RedisAdapter.test.ts

import { testStorageAdapterContract } from '../contracts/StorageAdapterContract';
import { RedisAdapter } from '../../adapters/RedisAdapter';
import Redis from 'ioredis';

const TEST_PREFIX = 'test:adapter:';
let redis: Redis;

testStorageAdapterContract(
  'RedisAdapter',
  async () => {
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db: 15 // Use dedicated test database
    });
    return new RedisAdapter({ client: redis, keyPrefix: TEST_PREFIX });
  },
  async () => {
    const keys = await redis.keys(`${TEST_PREFIX}*`);
    if (keys.length > 0) await redis.del(...keys);
    await redis.quit();
  }
);
```

### InMemory Adapter (No Cleanup Needed)

```typescript
// src/__tests__/adapters/InMemoryAdapter.test.ts

import { testStorageAdapterContract } from '../contracts/StorageAdapterContract';
import { InMemoryAdapter } from '../../adapters/InMemoryAdapter';

testStorageAdapterContract(
  'InMemoryAdapter',
  () => new InMemoryAdapter()
  // No cleanup needed - memory is freed automatically
);
```

---

## Running Tests

```bash
# Run all adapter tests
npm test -- src/__tests__/adapters

# Run specific adapter
npm test -- FileSystemAdapter.test.ts

# Watch mode
npm test -- --watch

# Coverage report
npm test -- --coverage

# Run only contract tests (skip adapter-specific)
npm test -- StorageAdapterContract
```

---

## Common Patterns

### Pattern 1: Async Factory with Setup

```typescript
testStorageAdapterContract(
  'PostgresAdapter',
  async () => {
    const pool = await createTestPool();
    await pool.query('CREATE TABLE IF NOT EXISTS sessions...');
    return new PostgresAdapter({ pool });
  },
  async () => {
    await pool.query('DROP TABLE IF EXISTS sessions');
    await pool.end();
  }
);
```

### Pattern 2: Environment-Based Configuration

```typescript
testStorageAdapterContract(
  'S3Adapter',
  async () => {
    if (!process.env.AWS_ACCESS_KEY_ID) {
      throw new Error('AWS credentials required for S3 adapter tests');
    }

    return new S3Adapter({
      bucket: process.env.S3_TEST_BUCKET,
      region: process.env.AWS_REGION || 'us-east-1'
    });
  },
  async () => {
    // Clean up test objects from S3
  }
);
```

### Pattern 3: Shared Test Utilities

```typescript
// src/__tests__/utils/adapterTestUtils.ts

export function createTestSession(id: string): ChatSession {
  return {
    id,
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

export function createTestMessage(content: string): ChatMessage {
  return {
    id: `msg-${Date.now()}`,
    role: 'user',
    content,
    timestamp: new Date()
  };
}

// Use in tests:
const session = createTestSession('test-123');
await adapter.saveSession(session);
```

---

## Troubleshooting

### Issue: Tests pass but data doesn't persist

**Solution**: Check that `createAdapter()` returns same instance or properly configured instance.

```typescript
// ❌ Wrong - creates different instance each time
() => new InMemoryAdapter() // Each call creates isolated instance

// ✓ Right - use shared instance or persistent storage
const sharedAdapter = new FileSystemAdapter({ path: './test-data' });
() => sharedAdapter
```

### Issue: Cleanup doesn't run

**Solution**: Ensure cleanup is async and properly awaited.

```typescript
// ❌ Wrong
async () => {
  fs.rm(TEST_DIR, { recursive: true }); // Missing await
}

// ✓ Right
async () => {
  await fs.rm(TEST_DIR, { recursive: true, force: true });
}
```

### Issue: Tests interfere with each other

**Solution**: Use unique identifiers for each test run.

```typescript
const TEST_PREFIX = `test:${Date.now()}:`;

testStorageAdapterContract(
  'RedisAdapter',
  async () => new RedisAdapter({ keyPrefix: TEST_PREFIX }),
  async () => {
    const keys = await redis.keys(`${TEST_PREFIX}*`);
    if (keys.length > 0) await redis.del(...keys);
  }
);
```

---

## Best Practices

### ✅ Do

- **Isolate test data**: Use unique directories, prefixes, or databases
- **Clean up resources**: Always implement cleanup function
- **Test async operations**: Use async/await throughout
- **Document setup requirements**: Note if Docker, databases, or env vars needed
- **Add adapter-specific tests**: Test unique features beyond contract

### ❌ Don't

- **Share state between tests**: Each test should be independent
- **Skip cleanup**: Always clean up to avoid pollution
- **Mix production and test data**: Use separate storage locations
- **Forget error cases**: Test both success and failure paths
- **Hardcode credentials**: Use environment variables

---

## Testing Workflow

```
┌────────────────────────────────────────────────────────────┐
│ Step 1: Implement Storage Adapter                         │
│                                                            │
│ class MyAdapter implements StorageAdapter {               │
│   async saveSession(session) { /* ... */ }                │
│   async getSession(id) { /* ... */ }                      │
│   // ... other methods                                    │
│ }                                                          │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│ Step 2: Create Test File (3 lines)                        │
│                                                            │
│ import { testStorageAdapterContract } from '...';         │
│ import { MyAdapter } from '...';                          │
│                                                            │
│ testStorageAdapterContract(                               │
│   'MyAdapter',                                            │
│   () => new MyAdapter(),                                  │
│   () => { /* cleanup */ }                                 │
│ );                                                         │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│ Step 3: Run Tests                                          │
│                                                            │
│ npm test -- MyAdapter.test.ts                             │
│                                                            │
│ Result:                                                    │
│ ✓ Session Management (6/6)                                │
│ ✓ Message Management (4/4)                                │
│ ✓ Memory Management (5/5)                                 │
│ ✓ Error Handling (2/2)                                    │
│ ✓ Data Persistence (1/1)                                  │
│                                                            │
│ Contract: 18 passed ✓                                     │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│ Step 4: Add Adapter-Specific Tests (Optional)             │
│                                                            │
│ describe('MyAdapter - Specific Features', () => {         │
│   it('should handle feature X', () => { /* ... */ });     │
│ });                                                        │
└────────────────────────────────────────────────────────────┘
```

---

## Next Steps

1. **Review full recommendation**: See `docs/contract-testing-recommendation.md`
2. **View diagrams**: See `docs/contract-testing-diagram.md`
3. **Copy contract tests**: Use complete test suite from recommendation
4. **Implement your adapter**: Follow interface contract
5. **Add tests**: Use templates above
6. **Run tests**: Verify contract compliance

---

## Quick Reference

| Task | Command |
|------|---------|
| Run all adapter tests | `npm test -- adapters` |
| Run specific adapter | `npm test -- [AdapterName].test.ts` |
| Watch mode | `npm test -- --watch` |
| Coverage report | `npm test -- --coverage` |
| Run contract only | `npm test -- StorageAdapterContract` |

| File | Purpose |
|------|---------|
| `types/index.ts` | StorageAdapter interface |
| `__tests__/contracts/StorageAdapterContract.ts` | Contract test suite |
| `__tests__/adapters/[Name].test.ts` | Adapter-specific tests |
| `adapters/[Name].ts` | Adapter implementation |

---

**Time saved**: Adding a new adapter test takes ~3 minutes instead of ~2 hours writing individual tests.

**Maintenance**: Contract updates apply to all adapters automatically.

**Confidence**: All adapters guaranteed to implement same contract.
