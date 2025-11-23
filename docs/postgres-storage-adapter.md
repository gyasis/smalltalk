# PostgresStorageAdapter

PostgreSQL-based storage implementation for SmallTalk session persistence.

## Overview

The `PostgresStorageAdapter` provides production-grade session storage using PostgreSQL with JSONB for efficient JSON storage, connection pooling, optimistic locking, and transaction support.

## Features

- **Connection Pooling**: Efficient connection management using `pg` library
- **JSONB Storage**: Optimized JSON storage and querying
- **Optimistic Locking**: Version-based conflict detection
- **Prepared Statements**: SQL injection protection
- **Transactions**: Atomic batch operations
- **TTL Support**: Optional time-to-live for key-value storage
- **Performance Optimized**: Indexes for state and timestamp queries

## Schema

### Sessions Table

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sessions_state ON sessions ((data->>'state'));
CREATE INDEX idx_sessions_updated_at ON sessions (updated_at);
```

### Key-Value Table

```sql
CREATE TABLE key_value (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  ttl TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_key_value_ttl ON key_value (ttl) WHERE ttl IS NOT NULL;
```

## Setup

### Using Docker Compose (Recommended for Testing)

1. Start PostgreSQL test database:
```bash
docker compose -f docker-compose.test.yml up -d
```

2. Run tests:
```bash
npm test -- tests/integration/postgres-storage-adapter.test.ts
```

3. Stop database:
```bash
docker compose -f docker-compose.test.yml down
```

### Using Native PostgreSQL

1. Install PostgreSQL (16+)
2. Create database:
```sql
CREATE DATABASE smalltalk_test;
```

3. Set environment variables:
```bash
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export POSTGRES_DB=smalltalk_test
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=postgres
```

## Usage

### Basic Usage

```typescript
import { PostgresStorageAdapter } from './persistence/PostgresStorageAdapter';

const adapter = new PostgresStorageAdapter({
  host: 'localhost',
  port: 5432,
  database: 'smalltalk',
  user: 'postgres',
  password: 'your_password',
  poolSize: 10,
});

await adapter.initialize();

// Save session
await adapter.saveSession(session);

// Retrieve session
const session = await adapter.getSession(sessionId);

// Clean up
await adapter.close();
```

### Connection String Usage

```typescript
const adapter = new PostgresStorageAdapter({
  connectionString: 'postgres://user:password@localhost:5432/smalltalk',
  poolSize: 10,
});
```

## Performance

### Benchmarks (from Contract Tests)

- **saveSession()**: < 50ms p95 (SC-009)
- **getSession()**: < 100ms p95 (SC-007)
- **Batch Operations**: 20-40% faster than individual operations

### Optimizations

1. **Indexes**: State and timestamp indexes for fast filtering
2. **JSONB**: Native JSON querying without deserialization
3. **Connection Pool**: Reuses connections for better throughput
4. **Prepared Statements**: Query plan caching
5. **Batch Transactions**: Atomic multi-session operations

## Configuration

### PostgresConfig Options

```typescript
interface PostgresConfig {
  host?: string;              // Default: 'localhost'
  port?: number;              // Default: 5432
  database?: string;          // Default: 'smalltalk'
  user?: string;              // Default: 'postgres'
  password?: string;          // Default: 'postgres'
  connectionString?: string;  // Alternative to individual params
  poolSize?: number;          // Default: 10
  ssl?: boolean;              // Default: false
}
```

## Contract Compliance

The PostgresStorageAdapter passes all 48 StorageAdapter contract tests:

- ✓ Lifecycle management (initialize, close, healthCheck)
- ✓ Session operations (save, get, delete, list)
- ✓ Batch operations (saveSessions, getSessions, deleteSessions)
- ✓ Key-value storage (setValue, getValue, deleteValue)
- ✓ Performance benchmarks (p95 latency requirements)
- ✓ Statistics and cleanup (getStats, clear)
- ✓ Serialization (SessionSerializer integration)

## Security

- **Prepared Statements**: Prevents SQL injection
- **Connection Pooling**: Secure credential management
- **SSL Support**: Encrypted connections (optional)
- **Version Control**: Optimistic locking prevents race conditions

## Error Handling

The adapter throws custom error types:

- `StorageError`: General storage failures
- `ConflictError`: Optimistic locking conflicts
- `NotFoundError`: Resource not found (if applicable)

## Troubleshooting

### Connection Issues

```bash
# Test connection
docker exec -it smalltalk-postgres-test psql -U postgres -d smalltalk_test -c "SELECT 1"

# Check logs
docker logs smalltalk-postgres-test
```

### Performance Issues

1. Check connection pool size (increase if needed)
2. Verify indexes exist
3. Monitor query performance with EXPLAIN ANALYZE
4. Consider table partitioning for large datasets

## Migration from FileStorageAdapter

```typescript
// Old (File)
const oldAdapter = new FileStorageAdapter('data/sessions');

// New (PostgreSQL)
const newAdapter = new PostgresStorageAdapter({
  host: 'localhost',
  database: 'smalltalk',
});

// Both implement same StorageAdapter interface
// No application code changes required!
```

## Development

### Running Tests

```bash
# Start test database
docker compose -f docker-compose.test.yml up -d

# Run tests
npm test -- tests/integration/postgres-storage-adapter.test.ts

# Clean up
docker compose -f docker-compose.test.yml down -v
```

### Adding Indexes

```sql
-- Add custom index for query optimization
CREATE INDEX idx_custom ON sessions ((data->>'customField'));
```

## See Also

- [StorageAdapter Contract](../specs/001-production-robustness/contracts/StorageAdapter.contract.ts)
- [FileStorageAdapter](../src/persistence/FileStorageAdapter.ts)
- [Production Robustness Spec](../specs/001-production-robustness/spec.md)
