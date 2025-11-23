/**
 * SmallTalk Production Server
 *
 * Main entry point for Docker deployment with health monitoring and graceful shutdown
 */

import express from 'express';
import { HealthServer } from './HealthServer.js';

const PORT = process.env['PORT'] ? parseInt(process.env['PORT']) : 3000;
const HEALTH_PORT = process.env['HEALTH_PORT'] ? parseInt(process.env['HEALTH_PORT']) : 3001;

async function main() {
  console.log('🚀 Starting SmallTalk Server...');

  // Create main application server
  const app = express();
  app.use(express.json());

  // Basic info endpoint
  app.get('/', (req, res) => {
    res.json({
      name: 'SmallTalk AI Framework',
      version: process.env['npm_package_version'] || '0.2.6.b',
      status: 'running',
      environment: process.env['NODE_ENV'] || 'production',
      timestamp: new Date().toISOString(),
    });
  });

  // Start main app server
  const mainServer = app.listen(PORT, () => {
    console.log(`✅ Main server listening on port ${PORT}`);
    console.log(`📍 http://localhost:${PORT}`);
  });

  // Start health monitoring server
  const healthServer = new HealthServer(HEALTH_PORT);

  // Register example health checks
  healthServer.registerHealthCheck('app', async () => {
    // Check if main server is listening
    return mainServer.listening;
  });

  await healthServer.start();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down gracefully...`);

    // Stop accepting new connections
    mainServer.close(() => {
      console.log('✅ Main server closed');
    });

    await healthServer.stop();
    console.log('✅ Health server closed');

    // Exit
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  console.log('');
  console.log('════════════════════════════════════════════════');
  console.log('  SmallTalk Server Ready');
  console.log('════════════════════════════════════════════════');
  console.log(`  Main API: http://localhost:${PORT}`);
  console.log(`  Health:   http://localhost:${HEALTH_PORT}/health`);
  console.log(`  Metrics:  http://localhost:${HEALTH_PORT}/metrics`);
  console.log('════════════════════════════════════════════════');
  console.log('');
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the server
main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
