import express, { Request, Response } from 'express';
import { Server } from 'http';

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  uptime: number;
  timestamp: string;
  services: {
    [key: string]: {
      status: 'up' | 'down';
      message?: string;
    };
  };
}

interface MetricsData {
  requests_total: number;
  requests_success: number;
  requests_failed: number;
  uptime_seconds: number;
  memory_usage_bytes: number;
  process_cpu_usage: number;
}

export class HealthServer {
  private app: express.Application;
  private server: Server | null = null;
  private startTime: number;
  private metrics: MetricsData;
  private healthChecks: Map<string, () => Promise<boolean>> = new Map();

  constructor(private port: number = 3001) {
    this.app = express();
    this.startTime = Date.now();
    this.metrics = {
      requests_total: 0,
      requests_success: 0,
      requests_failed: 0,
      uptime_seconds: 0,
      memory_usage_bytes: 0,
      process_cpu_usage: 0,
    };

    this.setupRoutes();
  }

  /**
   * Register a custom health check
   */
  registerHealthCheck(name: string, check: () => Promise<boolean>): void {
    this.healthChecks.set(name, check);
  }

  /**
   * Setup health and metrics endpoints
   */
  private setupRoutes(): void {
    // Health check endpoint (for Docker HEALTHCHECK)
    this.app.get('/health', async (req: Request, res: Response) => {
      const result = await this.performHealthCheck();
      const statusCode = result.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(result);
    });

    // Liveness probe (simple check)
    this.app.get('/healthz', (req: Request, res: Response) => {
      res.status(200).json({ status: 'ok' });
    });

    // Readiness probe (detailed checks)
    this.app.get('/ready', async (req: Request, res: Response) => {
      const result = await this.performHealthCheck();
      const statusCode = result.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(result);
    });

    // Prometheus-compatible metrics
    this.app.get('/metrics', (req: Request, res: Response) => {
      this.updateMetrics();
      const prometheusMetrics = this.formatPrometheusMetrics();
      res.set('Content-Type', 'text/plain');
      res.send(prometheusMetrics);
    });
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<HealthCheckResult> {
    const services: HealthCheckResult['services'] = {};
    let overallHealthy = true;

    // Run all registered health checks
    for (const [name, check] of this.healthChecks.entries()) {
      try {
        const isHealthy = await check();
        services[name] = {
          status: isHealthy ? 'up' : 'down',
        };
        if (!isHealthy) {
          overallHealthy = false;
        }
      } catch (error) {
        services[name] = {
          status: 'down',
          message: error instanceof Error ? error.message : 'Unknown error',
        };
        overallHealthy = false;
      }
    }

    // Memory check (warn if > 90% of heap limit)
    const memUsage = process.memoryUsage();
    const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    services['memory'] = {
      status: heapUsedPercent < 90 ? 'up' : 'down',
      message: `${heapUsedPercent.toFixed(2)}% heap used`,
    };

    return {
      status: overallHealthy ? 'healthy' : 'degraded',
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString(),
      services,
    };
  }

  /**
   * Update metrics data
   */
  private updateMetrics(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    this.metrics.uptime_seconds = Math.floor((Date.now() - this.startTime) / 1000);
    this.metrics.memory_usage_bytes = memUsage.heapUsed;
    this.metrics.process_cpu_usage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
  }

  /**
   * Format metrics in Prometheus exposition format
   */
  private formatPrometheusMetrics(): string {
    return `# HELP smalltalk_requests_total Total number of requests
# TYPE smalltalk_requests_total counter
smalltalk_requests_total ${this.metrics.requests_total}

# HELP smalltalk_requests_success Total number of successful requests
# TYPE smalltalk_requests_success counter
smalltalk_requests_success ${this.metrics.requests_success}

# HELP smalltalk_requests_failed Total number of failed requests
# TYPE smalltalk_requests_failed counter
smalltalk_requests_failed ${this.metrics.requests_failed}

# HELP smalltalk_uptime_seconds Application uptime in seconds
# TYPE smalltalk_uptime_seconds gauge
smalltalk_uptime_seconds ${this.metrics.uptime_seconds}

# HELP smalltalk_memory_usage_bytes Current memory usage in bytes
# TYPE smalltalk_memory_usage_bytes gauge
smalltalk_memory_usage_bytes ${this.metrics.memory_usage_bytes}

# HELP smalltalk_process_cpu_usage Process CPU usage in seconds
# TYPE smalltalk_process_cpu_usage gauge
smalltalk_process_cpu_usage ${this.metrics.process_cpu_usage}
`;
  }

  /**
   * Increment request counter
   */
  incrementRequests(success: boolean = true): void {
    this.metrics.requests_total++;
    if (success) {
      this.metrics.requests_success++;
    } else {
      this.metrics.requests_failed++;
    }
  }

  /**
   * Start the health server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`Health server listening on port ${this.port}`);
        console.log(`Health: http://localhost:${this.port}/health`);
        console.log(`Metrics: http://localhost:${this.port}/metrics`);
        resolve();
      });
    });
  }

  /**
   * Stop the health server
   */
  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve, reject) => {
        this.server!.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }
}
