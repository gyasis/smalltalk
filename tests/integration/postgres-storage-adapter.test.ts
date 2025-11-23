/**
 * PostgresStorageAdapter Integration Tests
 *
 * Runs the complete StorageAdapter contract test suite against PostgresStorageAdapter.
 * Tests validate compliance with the StorageAdapter interface specification.
 *
 * Prerequisites:
 * - PostgreSQL server running on localhost:5432
 * - Test database 'smalltalk_test' created
 * - User 'postgres' with password 'postgres' (or custom via env vars)
 *
 * Environment Variables:
 * - POSTGRES_HOST: Database host (default: localhost)
 * - POSTGRES_PORT: Database port (default: 5432)
 * - POSTGRES_DB: Database name (default: smalltalk_test)
 * - POSTGRES_USER: Database user (default: postgres)
 * - POSTGRES_PASSWORD: Database password (default: postgres)
 *
 * @see tests/contract/storage-adapter.shared.test.ts
 * @see src/persistence/PostgresStorageAdapter.ts
 */

import { runStorageAdapterContractTests } from '../contract/storage-adapter.shared.test';
import { PostgresStorageAdapter } from '../../src/persistence/PostgresStorageAdapter';
import { Pool } from 'pg';

describe('PostgresStorageAdapter', () => {
  // PostgreSQL connection config from environment or defaults
  const config = {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'smalltalk_test',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    poolSize: 5,
  };

  let pool: Pool;

  beforeAll(async () => {
    // Create a connection pool for setup/teardown operations
    pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
    });

    // Test database connectivity
    try {
      await pool.query('SELECT 1');
    } catch (error) {
      console.error(
        'Failed to connect to PostgreSQL. Ensure the database is running and accessible.',
        error
      );
      throw error;
    }
  });

  afterAll(async () => {
    // Close connection pool
    await pool.end();
  });

  beforeEach(async () => {
    // Clean up tables before each test
    try {
      await pool.query('DROP TABLE IF EXISTS sessions CASCADE');
      await pool.query('DROP TABLE IF EXISTS key_value CASCADE');
    } catch (error) {
      console.error('Failed to clean up database before test:', error);
    }
  });

  afterEach(async () => {
    // Clean up tables after each test
    try {
      await pool.query('DROP TABLE IF EXISTS sessions CASCADE');
      await pool.query('DROP TABLE IF EXISTS key_value CASCADE');
    } catch (error) {
      console.error('Failed to clean up database after test:', error);
    }
  });

  // Run complete contract test suite
  runStorageAdapterContractTests(() => new PostgresStorageAdapter(config));
});
