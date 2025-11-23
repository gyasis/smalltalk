# Contract Testing Architecture Diagram

## Pattern Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    StorageAdapterContract.ts                     │
│                     (Contract Test Suite)                        │
│                                                                   │
│  export function testStorageAdapterContract(                     │
│    adapterName: string,                                          │
│    createAdapter: AdapterFactory,                                │
│    cleanup?: AdapterCleanup                                      │
│  )                                                                │
│                                                                   │
│  Tests:                                                           │
│  ├── Session Management (6 tests)                                │
│  ├── Message Management (4 tests)                                │
│  ├── Memory Management (5 tests)                                 │
│  ├── Error Handling (2 tests)                                    │
│  └── Data Persistence (1 test)                                   │
│                                                                   │
│  Total: 18 contract tests                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ imported by
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│ FileSystem    │     │ Redis         │     │ InMemory      │
│ Adapter.test  │     │ Adapter.test  │     │ Adapter.test  │
├───────────────┤     ├───────────────┤     ├───────────────┤
│               │     │               │     │               │
│ Contract:     │     │ Contract:     │     │ Contract:     │
│ 18 tests ✓    │     │ 18 tests ✓    │     │ 18 tests ✓    │
│               │     │               │     │               │
│ Specific:     │     │ Specific:     │     │ Specific:     │
│ + 2 tests     │     │ + 1 test      │     │ + 2 tests     │
│   - Dir       │     │   - TTL       │     │   - Clear     │
│   - Errors    │     │               │     │   - Isolation │
│               │     │               │     │               │
│ Total: 20     │     │ Total: 19     │     │ Total: 20     │
└───────────────┘     └───────────────┘     └───────────────┘
```

## Test Execution Flow

```
User runs: npm test -- FileSystemAdapter.test.ts
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│ Jest Test Runner                                        │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│ FileSystemAdapter.test.ts                               │
│                                                          │
│ 1. Imports testStorageAdapterContract()                 │
│ 2. Calls:                                                │
│    testStorageAdapterContract(                          │
│      'FileSystemAdapter',                               │
│      async () => new FileSystemAdapter({ ... }),        │
│      async () => { /* cleanup */ }                      │
│    )                                                     │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│ Contract Test Suite Executes                            │
│                                                          │
│ For each test:                                           │
│   beforeEach: adapter = await createAdapter()           │
│   test: /* verify contract behavior */                  │
│   afterEach: await cleanup()                            │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│ Results                                                  │
│                                                          │
│ ✓ Session Management (6/6)                              │
│ ✓ Message Management (4/4)                              │
│ ✓ Memory Management (5/5)                               │
│ ✓ Error Handling (2/2)                                  │
│ ✓ Data Persistence (1/1)                                │
│                                                          │
│ Contract Tests: 18 passed                                │
└─────────────────────────────────────────────────────────┘
```

## Adding a New Adapter

```
Step 1: Create adapter implementation
┌─────────────────────────────────────┐
│ src/adapters/PostgresAdapter.ts     │
│                                     │
│ export class PostgresAdapter        │
│   implements StorageAdapter {       │
│                                     │
│   async saveSession() { ... }       │
│   async getSession() { ... }        │
│   // ... other methods              │
│ }                                    │
└─────────────────────────────────────┘

Step 2: Create test file (3 lines!)
┌──────────────────────────────────────────────────────┐
│ src/__tests__/adapters/PostgresAdapter.test.ts      │
│                                                      │
│ import { testStorageAdapterContract }               │
│   from '../contracts/StorageAdapterContract';       │
│ import { PostgresAdapter }                          │
│   from '../../adapters/PostgresAdapter';            │
│                                                      │
│ testStorageAdapterContract(                         │
│   'PostgresAdapter',                                │
│   async () => new PostgresAdapter({                 │
│     connectionString: process.env.PG_TEST_URL       │
│   }),                                                │
│   async () => {                                     │
│     // cleanup test database                        │
│   }                                                  │
│ );                                                   │
└──────────────────────────────────────────────────────┘

Step 3: Run tests
┌─────────────────────────────────────┐
│ npm test -- PostgresAdapter.test.ts │
│                                     │
│ Result: 18 contract tests run ✓     │
└─────────────────────────────────────┘
```

## Contract Compliance Matrix

```
                     File    Redis   InMemory   Postgres   MongoDB
                     System                    (future)   (future)
                     ─────   ─────   ────────   ────────   ───────
saveSession           ✓       ✓        ✓          ?          ?
getSession            ✓       ✓        ✓          ?          ?
deleteSession         ✓       ✓        ✓          ?          ?
listSessions          ✓       ✓        ✓          ?          ?
addMessage            ✓       ✓        ✓          ?          ?
getMessages           ✓       ✓        ✓          ?          ?
clearMessages         ✓       ✓        ✓          ?          ?
saveMemory            ✓       ✓        ✓          ?          ?
getMemory             ✓       ✓        ✓          ?          ?
listMemories          ✓       ✓        ✓          ?          ?
deleteMemory          ✓       ✓        ✓          ?          ?
Concurrent Ops        ✓       ✓        ✓          ?          ?
Error Handling        ✓       ✓        ✓          ?          ?
Data Persistence      ✓       ✓        ✓          ?          ?

Contract Tests        18      18       18         0          0
Specific Tests        2       1        2          0          0
─────────────────────────────────────────────────────────────
Total Tests           20      19       20         0          0
Coverage              100%    100%     100%       0%         0%
```

## Type Safety Flow

```
┌──────────────────────────────────────────────────────────┐
│ Type Definitions                                         │
│                                                           │
│ interface StorageAdapter {                               │
│   saveSession(session: ChatSession): Promise<void>;      │
│   getSession(id: string): Promise<ChatSession | null>;   │
│   // ... other methods                                   │
│ }                                                         │
│                                                           │
│ type AdapterFactory<T extends StorageAdapter> =          │
│   () => T | Promise<T>;                                  │
└──────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────┐
│ Contract Function (Generic)                              │
│                                                           │
│ function testStorageAdapterContract<                     │
│   T extends StorageAdapter = StorageAdapter              │
│ >(                                                        │
│   name: string,                                          │
│   createAdapter: AdapterFactory<T>,                      │
│   cleanup?: AdapterCleanup                               │
│ ): void                                                   │
└──────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────┐
│ Usage (Type-Checked)                                     │
│                                                           │
│ testStorageAdapterContract<FileSystemAdapter>(           │
│   'FileSystemAdapter',                                   │
│   async () => new FileSystemAdapter({ ... })  // ✓ Type  │
│ )                                                         │
│                                                           │
│ testStorageAdapterContract<RedisAdapter>(                │
│   'RedisAdapter',                                        │
│   async () => new RedisAdapter({ ... })       // ✓ Type  │
│ )                                                         │
│                                                           │
│ TypeScript ensures:                                      │
│ - Factory returns correct adapter type                   │
│ - Adapter implements StorageAdapter interface            │
│ - All contract methods are present                       │
└──────────────────────────────────────────────────────────┘
```

## Error Message Quality

```
When a test fails, Jest provides clear context:

FAIL src/__tests__/adapters/RedisAdapter.test.ts
  StorageAdapter Contract: RedisAdapter
    Session Management
      ✓ should save and retrieve sessions (23ms)
      ✗ should return null for non-existent sessions (15ms)

  ● StorageAdapter Contract: RedisAdapter › Session Management
    › should return null for non-existent sessions

    expect(received).toBeNull()

    Received: { id: 'non-existent-id', messages: [], ... }

      at Object.<anonymous> (StorageAdapterContract.ts:45:28)

    This shows:
    ✓ Which adapter failed: RedisAdapter
    ✓ Which test category: Session Management
    ✓ Which specific test: should return null for non-existent sessions
    ✓ What was expected: null
    ✓ What was received: { id: 'non-existent-id', ... }
    ✓ Exact line in contract: StorageAdapterContract.ts:45
```

## Benefits Summary

```
┌─────────────────────────────────────────────────────────────┐
│                      Why This Pattern?                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📋 Single Source of Truth                                  │
│     Contract defined once, tested everywhere                │
│                                                              │
│  🎯 Minimal Boilerplate                                     │
│     3 lines of code per adapter test file                   │
│                                                              │
│  🔒 Type Safety                                             │
│     TypeScript ensures contract compliance at compile time  │
│                                                              │
│  🐛 Clear Error Messages                                    │
│     Jest native output shows exactly what failed            │
│                                                              │
│  🔧 Flexible Setup/Teardown                                 │
│     Factory pattern supports complex initialization         │
│                                                              │
│  ➕ Easy to Extend                                          │
│     Add contract tests in one place, auto-apply to all      │
│                                                              │
│  🎨 Adapter-Specific Tests                                  │
│     Can add unique tests alongside contract tests           │
│                                                              │
│  ⚡ Async-First                                             │
│     Native async/await support throughout                   │
│                                                              │
│  📚 Industry Standard                                       │
│     Used by Prisma, Socket.io, Winston, and others          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```
