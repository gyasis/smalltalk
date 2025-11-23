# SmallTalk Production Deployment Guide

Comprehensive guide for deploying SmallTalk with production-ready robustness features including session persistence, agent health monitoring, event-driven architecture, and distributed storage.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Environment Configuration](#environment-configuration)
3. [Storage Adapter Selection](#storage-adapter-selection)
4. [Docker Deployment](#docker-deployment)
5. [Health Monitoring](#health-monitoring)
6. [Backup and Restore](#backup-and-restore)
7. [Scaling Considerations](#scaling-considerations)
8. [Troubleshooting](#troubleshooting)
9. [Production Checklist](#production-checklist)

---

## Quick Start

Deploy SmallTalk in production with Docker in under 5 minutes.

### Prerequisites

- **Node.js**: 18.x or higher
- **Docker**: 20.10+ with Docker Compose 2.0+
- **System Resources**: Minimum 2GB RAM, 10GB disk space
- **Network**: Outbound access to LLM providers (OpenAI, Anthropic, Gemini)
- **API Keys**: Valid LLM provider credentials

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/smalltalk.git
   cd smalltalk
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   nano .env  # Edit with your API keys and passwords
   ```

3. **Start services**
   ```bash
   docker compose up -d
   ```

4. **Verify health**
   ```bash
   curl http://localhost:3001/health
   ```

5. **View logs**
   ```bash
   docker compose logs -f app
   ```

**Expected Output:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-23T10:30:00.000Z",
  "components": {
    "storage": { "status": "healthy" },
    "eventBus": { "status": "healthy" },
    "agentMonitor": { "status": "healthy" }
  }
}
```

---

## Environment Configuration

SmallTalk follows [12-factor app](https://12factor.net/) principles with full configuration via environment variables.

### Complete Variable Reference

#### Application Configuration

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `NODE_ENV` | Deployment environment | No | `development` | `production` |
| `APP_PORT` | Application HTTP port | No | `3000` | `3000` |
| `HEALTH_PORT` | Health/metrics endpoint port | No | `3001` | `3001` |

#### LLM Provider API Keys

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `OPENAI_API_KEY` | OpenAI API key | Conditional | - | `sk-proj-...` |
| `ANTHROPIC_API_KEY` | Anthropic API key | Conditional | - | `sk-ant-...` |
| `GEMINI_API_KEY` | Google Gemini API key | Conditional | - | `AIza...` |

**Note**: At least one LLM provider API key is required.

#### Storage Configuration (FR-051)

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `STORAGE_TYPE` | Storage backend | No | `file` | `redis`, `postgres`, `file` |
| `STORAGE_PATH` | File storage directory | No | `./data` | `/var/lib/smalltalk` |
| `REDIS_URL` | Redis connection string | If using Redis | - | `redis://localhost:6379` |
| `POSTGRES_URL` | PostgreSQL connection string | If using PostgreSQL | - | `postgresql://user:pass@localhost:5432/db` |

#### Session Management (FR-004, FR-051)

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `SESSION_EXPIRATION_DAYS` | Session TTL in days | No | `7` | `30` |
| `SESSION_TTL` | Session TTL in seconds | No | `3600` | `7200` |
| `SESSION_CLEANUP_INTERVAL` | Cleanup interval (seconds) | No | `300` | `600` |
| `MAX_CONCURRENT_SESSIONS` | Max active sessions | No | `100` | `500` |

#### Agent Health Monitoring (FR-006, FR-007, FR-009, FR-051)

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `HEARTBEAT_INTERVAL_MS` | Heartbeat interval (ms) | No | `2000` | `5000` |
| `LIVENESS_PROBE_TIMEOUT_MS` | Liveness timeout (ms) | No | `5000` | `10000` |
| `AGENT_HEALTH_CHECK_INTERVAL` | Health check interval (seconds) | No | `30` | `60` |
| `AGENT_HEARTBEAT_TIMEOUT` | Heartbeat timeout (seconds) | No | `90` | `120` |

#### Agent State Management (FR-009a, FR-051)

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `AGENT_STATE_MESSAGE_HISTORY` | Message turns to preserve | No | `10` | `20` |
| `AGENT_STATE_MAX_SIZE_MB` | Max agent state size (MB) | No | `10` | `50` |

#### Event Bus Configuration (FR-011a, FR-014, FR-051)

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `EVENT_RETENTION_HOURS` | Event log retention (hours) | No | `24` | `72` |
| `EVENT_REGISTRY_MAX_SIZE` | Max event registry entries | No | `10000` | `50000` |

#### Alerting (Phase 2 - Optional) (FR-002a, FR-051)

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `ALERT_EMAIL_TO` | Alert email recipient | No | - | `ops@example.com` |
| `SMTP_HOST` | SMTP server hostname | No | - | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP server port | No | `587` | `465` |
| `SMTP_USER` | SMTP username | No | - | `alerts@example.com` |
| `SMTP_PASS` | SMTP password | No | - | `secret` |
| `ALERT_SLACK_WEBHOOK` | Slack webhook URL | No | - | `https://hooks.slack.com/...` |
| `ALERT_PAGERDUTY_KEY` | PagerDuty integration key | No | - | `R03...` |

#### Monitoring (Optional)

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `PROMETHEUS_PORT` | Prometheus port | No | `9090` | `9090` |
| `PROMETHEUS_RETENTION` | Metrics retention period | No | `30d` | `90d` |
| `GRAFANA_PORT` | Grafana port | No | `3100` | `3100` |
| `GRAFANA_USER` | Grafana admin username | No | `admin` | `admin` |
| `GRAFANA_PASSWORD` | Grafana admin password | No | `admin` | `secure_password` |

### Example .env File

```bash
# SmallTalk Production Configuration

# ================================
# Application Configuration
# ================================
NODE_ENV=production
APP_PORT=3000
HEALTH_PORT=3001

# ================================
# LLM Provider API Keys
# ================================
OPENAI_API_KEY=sk-proj-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here
GEMINI_API_KEY=your-gemini-key-here

# ================================
# Storage Configuration
# ================================
STORAGE_TYPE=redis
REDIS_URL=redis://redis:6379
POSTGRES_URL=postgresql://smalltalk:secure_password@postgres:5432/smalltalk

# ================================
# Session Management
# ================================
SESSION_EXPIRATION_DAYS=7
SESSION_TTL=3600
SESSION_CLEANUP_INTERVAL=300
MAX_CONCURRENT_SESSIONS=100

# ================================
# Agent Health Monitoring
# ================================
HEARTBEAT_INTERVAL_MS=2000
LIVENESS_PROBE_TIMEOUT_MS=5000
AGENT_HEALTH_CHECK_INTERVAL=30
AGENT_HEARTBEAT_TIMEOUT=90

# ================================
# Agent State Management
# ================================
AGENT_STATE_MESSAGE_HISTORY=10
AGENT_STATE_MAX_SIZE_MB=10

# ================================
# Event Bus Configuration
# ================================
EVENT_RETENTION_HOURS=24
EVENT_REGISTRY_MAX_SIZE=10000

# ================================
# PostgreSQL Configuration
# ================================
POSTGRES_DB=smalltalk
POSTGRES_USER=smalltalk
POSTGRES_PASSWORD=change_me_in_production_12345
POSTGRES_PORT=5432

# ================================
# Redis Configuration
# ================================
REDIS_PORT=6379
REDIS_MAX_MEMORY=256mb

# ================================
# Monitoring (Optional)
# ================================
PROMETHEUS_PORT=9090
PROMETHEUS_RETENTION=30d
GRAFANA_PORT=3100
GRAFANA_USER=admin
GRAFANA_PASSWORD=change_me_in_production_12345
```

### Security Best Practices for Secrets

**DO:**
- ✅ Use strong, unique passwords (minimum 16 characters)
- ✅ Rotate API keys and passwords regularly (every 90 days)
- ✅ Use Docker secrets or environment variable injection from secret managers
- ✅ Restrict `.env` file permissions: `chmod 600 .env`
- ✅ Never commit `.env` to version control (add to `.gitignore`)
- ✅ Use separate credentials for development, staging, and production
- ✅ Enable audit logging for secret access

**DON'T:**
- ❌ Use default passwords in production (`admin`, `password`, `changeme`)
- ❌ Store secrets in plaintext configuration files
- ❌ Share API keys across environments
- ❌ Log API keys or passwords
- ❌ Hardcode credentials in source code

**Recommended Secret Management:**
- **Docker Secrets**: For Docker Swarm deployments
- **Kubernetes Secrets**: For Kubernetes deployments
- **HashiCorp Vault**: For enterprise secret management
- **AWS Secrets Manager / GCP Secret Manager**: For cloud deployments

---

## Storage Adapter Selection

SmallTalk supports three storage backends, each optimized for different use cases. See [Storage Adapter Comparison](./storage-adapter-comparison.md) for detailed analysis.

### Quick Decision Matrix

| Deployment Size | Primary Storage | Backup Strategy | Cost |
|----------------|----------------|-----------------|------|
| **< 100 sessions/day** | FileStorage | Git + S3 | $5-20/month |
| **100-10K sessions/day** | Redis | RDB snapshots | $40-250/month |
| **10K-100K sessions/day** | Redis Cluster + PostgreSQL | PostgreSQL PITR | $200-1000/month |
| **> 100K sessions/day** | Redis Cluster + PostgreSQL + S3 | Multi-tier backup | $1000+/month |

### FileStorage (Default)

**Best for:** Local development, solo developers, small teams

**Advantages:**
- Zero infrastructure overhead
- Instant setup - no external dependencies
- Easy debugging (inspect JSON files directly)
- Simple backup (file copy or git commit)

**Limitations:**
- No horizontal scaling
- Limited concurrent access (file locks)
- Single server only

**Configuration:**
```bash
STORAGE_TYPE=file
STORAGE_PATH=/var/lib/smalltalk/data
```

**Performance:**
- saveSession: ~15-30ms p95
- getSession: ~10-20ms p95
- Suitable for < 100 sessions/day

### RedisStorageAdapter

**Best for:** Distributed systems, high-throughput applications, cloud deployments

**Advantages:**
- Sub-10ms read/write latency (in-memory)
- Excellent horizontal scaling (Redis Cluster)
- Built-in TTL for automatic session expiration
- Native distributed access across application instances

**Limitations:**
- Requires Redis server (managed or self-hosted)
- Higher infrastructure cost
- Memory-constrained (sessions stored in RAM)

**Configuration:**
```bash
STORAGE_TYPE=redis
REDIS_URL=redis://localhost:6379
# Optional: Redis Cluster
REDIS_CLUSTER_NODES=redis1:6379,redis2:6379,redis3:6379
```

**Performance:**
- saveSession: ~6-7ms p95
- getSession: ~3-4ms p95
- Suitable for 100-100K sessions/day

### PostgresStorageAdapter

**Best for:** Enterprise deployments, compliance requirements, audit trails

**Advantages:**
- Full ACID guarantees
- Point-in-time recovery (PITR)
- Relational queries for analytics
- Version-based optimistic locking (FR-005)
- Enterprise backup/restore tools

**Limitations:**
- Higher latency than Redis (~60-170ms)
- More complex setup and maintenance
- Requires database administration

**Configuration:**
```bash
STORAGE_TYPE=postgres
POSTGRES_URL=postgresql://user:password@localhost:5432/smalltalk
```

**Performance:**
- saveSession: ~150-170ms p95
- getSession: ~60-70ms p95
- Suitable for any scale with proper tuning

### Hybrid Deployment (Recommended for Production)

Combine Redis (hot data) + PostgreSQL (cold data) for optimal performance and durability:

```
┌─────────────────────────────────┐
│   Application Instances (3x)    │
└─────────────────┬───────────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
    ▼             ▼             ▼
┌────────┐  ┌────────┐  ┌────────┐
│ Redis  │  │ Redis  │  │ Redis  │  ← Hot Storage (active sessions)
│ Master │  │ Slave  │  │ Slave  │    TTL: 24 hours
└────────┘  └────────┘  └────────┘
    │
    │ Archive (sessions > 24h old)
    ▼
┌─────────────────────────────────┐
│  PostgreSQL (Primary + Replica) │  ← Cold Storage (historical data)
│  + S3 Archival (> 90 days)      │    Retention: unlimited
└─────────────────────────────────┘
```

**Implementation:**
- Active sessions (< 24 hours): Redis
- Historical sessions (> 24 hours): PostgreSQL
- Archived sessions (> 90 days): S3 with lifecycle policies
- Automatic archival via scheduled jobs (cron/systemd timer)

**See:** [Storage Adapter Comparison](./storage-adapter-comparison.md) for migration strategies and detailed benchmarks.

---

## Docker Deployment

SmallTalk provides production-ready Docker images and Docker Compose orchestration. See [DOCKER.md](../DOCKER.md) for detailed guide.

### Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    Docker Network                         │
│                  smalltalk-network                        │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   SmallTalk  │  │    Redis     │  │  PostgreSQL  │   │
│  │     App      │─▶│   (Cache)    │  │ (Persistent) │   │
│  │   :3000      │  │   :6379      │  │   :5432      │   │
│  │   :3001      │  └──────────────┘  └──────────────┘   │
│  └──────┬───────┘                                        │
│         │                                                 │
│         ▼                                                 │
│  ┌──────────────┐  ┌──────────────┐                     │
│  │  Prometheus  │  │   Grafana    │ (Optional)          │
│  │   :9090      │─▶│   :3100      │                     │
│  └──────────────┘  └──────────────┘                     │
└──────────────────────────────────────────────────────────┘

Volumes:
- app-data: Application data files
- app-logs: Application logs
- redis-data: Redis AOF/RDB files
- postgres-data: PostgreSQL database
- prometheus-data: Metrics history (30 days default)
- grafana-data: Dashboards and settings
```

### Starting Services

**Production mode:**
```bash
docker compose up -d
```

**Development mode with hot reload:**
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

**Enable monitoring stack:**
```bash
docker compose --profile monitoring up -d
```

**Scale application instances:**
```bash
docker compose up -d --scale app=3
```

### Service Status

**Check service health:**
```bash
docker compose ps
```

**Expected output:**
```
NAME                 STATUS         PORTS
smalltalk-app        Up (healthy)   0.0.0.0:3000-3001->3000-3001/tcp
smalltalk-redis      Up (healthy)   0.0.0.0:6379->6379/tcp
smalltalk-postgres   Up (healthy)   0.0.0.0:5432->5432/tcp
```

**View logs:**
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f app
docker compose logs -f redis
docker compose logs -f postgres
```

### Volume Management

**List volumes:**
```bash
docker volume ls | grep smalltalk
```

**Backup volumes:**
```bash
# Backup application data
docker run --rm -v smalltalk_app-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/app-data-backup.tar.gz /data

# Backup PostgreSQL data
docker compose exec postgres pg_dump -U smalltalk smalltalk \
  | gzip > postgres-backup-$(date +%Y%m%d).sql.gz
```

**Restore volumes:**
```bash
# Restore application data
docker run --rm -v smalltalk_app-data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/app-data-backup.tar.gz -C /

# Restore PostgreSQL
gunzip < postgres-backup-20250123.sql.gz | \
  docker compose exec -T postgres psql -U smalltalk smalltalk
```

### Network Configuration

**Expose services externally with reverse proxy (nginx):**

```nginx
# /etc/nginx/sites-available/smalltalk
server {
    listen 80;
    server_name smalltalk.example.com;

    # Application
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health checks (internal only)
    location /health {
        proxy_pass http://localhost:3001/health;
        allow 10.0.0.0/8;  # Internal network only
        deny all;
    }

    # Metrics (internal only)
    location /metrics {
        proxy_pass http://localhost:3001/metrics;
        allow 10.0.0.0/8;  # Internal network only
        deny all;
    }
}
```

**Enable HTTPS with Let's Encrypt:**
```bash
certbot --nginx -d smalltalk.example.com
```

---

## Health Monitoring

SmallTalk provides comprehensive health and readiness endpoints for monitoring and orchestration.

### Health Endpoint (FR-052)

**Endpoint:** `GET /health`

**Purpose:** Detailed health status with component-level diagnostics

**Response Format:**
```json
{
  "status": "healthy|degraded|unhealthy",
  "timestamp": "2025-01-23T10:30:00.000Z",
  "components": {
    "storage": {
      "status": "healthy",
      "details": {
        "totalSessions": 42,
        "sizeBytes": 1048576,
        "backendType": "redis"
      }
    },
    "eventBus": {
      "status": "healthy",
      "details": {
        "totalEventsPublished": 1234,
        "totalEventsDelivered": 1230,
        "activeSubscriptions": 15,
        "avgPropagationLatencyMs": 8.3
      }
    },
    "agentMonitor": {
      "status": "healthy",
      "details": {
        "totalAgents": 10,
        "healthyAgents": 10,
        "disconnectedAgents": 0,
        "recoveringAgents": 0,
        "successfulRecoveries": 25
      }
    }
  }
}
```

**Status Determination (FR-052):**
- `healthy`: All components healthy, < 80% capacity
- `degraded`: 1-3 failed agents OR > 80% capacity
- `unhealthy`: > 3 failed agents OR graceful degradation mode active

**HTTP Status Codes:**
- `200 OK`: Status is `healthy`
- `503 Service Unavailable`: Status is `degraded` or `unhealthy`

**Usage:**
```bash
# Manual check
curl http://localhost:3001/health | jq

# Continuous monitoring
watch -n 5 'curl -s http://localhost:3001/health | jq .status'
```

### Readiness Endpoint (FR-053)

**Endpoint:** `GET /ready`

**Purpose:** Simple readiness check for load balancers and orchestrators

**Response Format:**
- `200 OK` with body `"OK"`: Service is ready to accept traffic
- `503 Service Unavailable` with body `"Service Unavailable"`: Service is initializing or degraded

**Readiness Checks:**
1. StorageAdapter initialized successfully
2. EventBus initialized and accepting subscriptions
3. System not in graceful degradation mode

**Usage:**

**Docker health check:**
```yaml
healthcheck:
  test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001/ready"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

**Kubernetes liveness probe:**
```yaml
livenessProbe:
  httpGet:
    path: /ready
    port: 3001
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

**Load balancer health check:**
```nginx
upstream smalltalk_backend {
    server app1:3000 max_fails=3 fail_timeout=30s;
    server app2:3000 max_fails=3 fail_timeout=30s;
    server app3:3000 max_fails=3 fail_timeout=30s;

    # Health check
    check interval=5000 rise=2 fall=3 timeout=1000 type=http;
    check_http_send "GET /ready HTTP/1.0\r\n\r\n";
    check_http_expect_alive http_2xx;
}
```

### Metrics Endpoint (FR-043)

**Endpoint:** `GET /metrics`

**Purpose:** Prometheus-format metrics for monitoring and alerting

**Format:** Prometheus text exposition format

**Key Metrics:**

| Metric Name | Type | Description | Labels |
|-------------|------|-------------|--------|
| `sessions_total` | Counter | Total sessions created | - |
| `sessions_active` | Gauge | Current active sessions | - |
| `agent_health_checks_total` | Counter | Agent health checks performed | `agent_id`, `result` |
| `agent_failures_total` | Counter | Agent failures detected | `agent_id`, `failure_type` |
| `events_published_total` | Counter | Events published | `topic`, `priority` |
| `events_consumed_total` | Counter | Events consumed | `topic`, `subscriber_id` |
| `storage_operations_duration_seconds` | Histogram | Storage operation latency | `operation`, `result` |
| `process_cpu_user_seconds_total` | Counter | CPU time in user mode | - |
| `process_resident_memory_bytes` | Gauge | Resident memory size | - |
| `nodejs_heap_size_used_bytes` | Gauge | Heap memory used | - |

**Example Output:**
```
# HELP sessions_total Total number of sessions created
# TYPE sessions_total counter
sessions_total 1234

# HELP sessions_active Current number of active sessions
# TYPE sessions_active gauge
sessions_active 42

# HELP agent_health_checks_total Total number of agent health checks performed
# TYPE agent_health_checks_total counter
agent_health_checks_total{agent_id="agent-001",result="healthy"} 500
agent_health_checks_total{agent_id="agent-002",result="unhealthy"} 3

# HELP storage_operations_duration_seconds Duration of storage operations
# TYPE storage_operations_duration_seconds histogram
storage_operations_duration_seconds_bucket{operation="save",result="success",le="0.001"} 150
storage_operations_duration_seconds_bucket{operation="save",result="success",le="0.01"} 480
storage_operations_duration_seconds_bucket{operation="save",result="success",le="0.05"} 495
storage_operations_duration_seconds_bucket{operation="save",result="success",le="+Inf"} 500
storage_operations_duration_seconds_sum{operation="save",result="success"} 2.5
storage_operations_duration_seconds_count{operation="save",result="success"} 500
```

**Prometheus Configuration:**
```yaml
# config/prometheus.yml
scrape_configs:
  - job_name: 'smalltalk'
    static_configs:
      - targets: ['app:3001']
    scrape_interval: 15s
    scrape_timeout: 10s
    metrics_path: /metrics
```

**Query Examples:**
```promql
# Session rate (requests per second)
rate(sessions_total[5m])

# P95 storage operation latency
histogram_quantile(0.95, rate(storage_operations_duration_seconds_bucket[5m]))

# Agent failure rate (failures per minute)
rate(agent_failures_total[1m]) * 60

# Event bus throughput (events per second)
rate(events_published_total[1m])

# Memory usage percentage
(nodejs_heap_size_used_bytes / nodejs_heap_size_total_bytes) * 100
```

### Alert Configuration

**Prometheus Alerting Rules:**
```yaml
# config/alerts.yml
groups:
  - name: smalltalk_alerts
    interval: 30s
    rules:
      # High session load
      - alert: HighSessionLoad
        expr: sessions_active > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High session load detected"
          description: "Active sessions: {{ $value }} (threshold: 80)"

      # Agent failures
      - alert: AgentFailureRateHigh
        expr: rate(agent_failures_total[5m]) > 0.1
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High agent failure rate"
          description: "Failure rate: {{ $value }} failures/sec"

      # Storage latency violations (FR-013)
      - alert: StorageLatencyViolation
        expr: histogram_quantile(0.95, rate(storage_operations_duration_seconds_bucket[5m])) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Storage p95 latency exceeds 100ms"
          description: "Current p95: {{ $value }}s"

      # Service unhealthy
      - alert: ServiceUnhealthy
        expr: up{job="smalltalk"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "SmallTalk service is down"
          description: "Service has been down for > 1 minute"

      # High memory usage
      - alert: HighMemoryUsage
        expr: (nodejs_heap_size_used_bytes / nodejs_heap_size_total_bytes) > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage detected"
          description: "Heap usage: {{ $value | humanizePercentage }}"
```

**Grafana Dashboards:**
- Session metrics: Active sessions, session rate, session duration
- Agent health: Agent status, failure rate, recovery success rate
- Event bus: Event throughput, propagation latency, subscription count
- Storage performance: Operation latency (p50, p95, p99), error rate
- System resources: CPU, memory, disk I/O

**Pre-built dashboards:** Available in `config/grafana/dashboards/`

---

## Backup and Restore

Comprehensive backup strategies for all storage adapters.

### Backup Strategies by Storage Type

#### FileStorage Backup

**Method 1: Simple file copy**
```bash
# Backup
tar czf backup-$(date +%Y%m%d-%H%M%S).tar.gz data/

# Restore
tar xzf backup-20250123-103000.tar.gz
```

**Method 2: Git version control**
```bash
# Initialize repository
cd data/
git init
git add .
git commit -m "Initial state"

# Daily snapshots (cron)
0 2 * * * cd /var/lib/smalltalk/data && git add . && git commit -m "Daily backup $(date)"

# Restore to specific date
git checkout $(git rev-list -n 1 --before="2025-01-20" main)
```

**Method 3: S3 sync**
```bash
# Install AWS CLI
apt-get install awscli

# Sync to S3 (hourly)
0 * * * * aws s3 sync /var/lib/smalltalk/data s3://my-bucket/smalltalk-backups/ --delete

# Restore from S3
aws s3 sync s3://my-bucket/smalltalk-backups/ /var/lib/smalltalk/data --delete
```

#### Redis Backup (RDB + AOF)

**RDB (Snapshot) Backup:**
```bash
# Trigger manual snapshot
docker compose exec redis redis-cli BGSAVE

# Wait for completion
docker compose exec redis redis-cli LASTSAVE

# Copy snapshot file
docker compose cp redis:/data/dump.rdb ./backups/redis-dump-$(date +%Y%m%d).rdb

# Automated snapshots (redis.conf)
save 900 1      # Save if 1 key changed in 15 minutes
save 300 10     # Save if 10 keys changed in 5 minutes
save 60 10000   # Save if 10000 keys changed in 1 minute
```

**AOF (Append-Only File) Backup:**
```bash
# Enable AOF persistence
docker compose exec redis redis-cli CONFIG SET appendonly yes

# Rewrite AOF to compact
docker compose exec redis redis-cli BGREWRITEAOF

# Copy AOF file
docker compose cp redis:/data/appendonly.aof ./backups/redis-aof-$(date +%Y%m%d).aof
```

**Restore Redis:**
```bash
# Stop Redis
docker compose stop redis

# Restore RDB file
docker compose cp ./backups/redis-dump-20250123.rdb redis:/data/dump.rdb

# Or restore AOF file
docker compose cp ./backups/redis-aof-20250123.aof redis:/data/appendonly.aof

# Start Redis
docker compose start redis

# Verify data
docker compose exec redis redis-cli DBSIZE
```

**Redis Backup Best Practices:**
- Use both RDB (fast recovery) and AOF (durability)
- Schedule RDB snapshots every 6-12 hours
- AOF fsync policy: `everysec` (balance performance/durability)
- Store backups off-server (S3, network storage)
- Test restore procedures monthly

#### PostgreSQL Backup

**Logical Backup (pg_dump):**
```bash
# Full database backup
docker compose exec postgres pg_dump -U smalltalk smalltalk \
  --format=custom --compress=9 \
  > backups/postgres-$(date +%Y%m%d-%H%M%S).dump

# Schema-only backup
docker compose exec postgres pg_dump -U smalltalk smalltalk \
  --schema-only --format=custom \
  > backups/postgres-schema-$(date +%Y%m%d).dump

# Data-only backup
docker compose exec postgres pg_dump -U smalltalk smalltalk \
  --data-only --format=custom \
  > backups/postgres-data-$(date +%Y%m%d).dump

# Restore from custom format
docker compose exec -T postgres pg_restore -U smalltalk -d smalltalk --clean --if-exists \
  < backups/postgres-20250123-103000.dump
```

**Point-in-Time Recovery (PITR):**
```bash
# Enable WAL archiving (postgresql.conf)
wal_level = replica
archive_mode = on
archive_command = 'cp %p /var/lib/postgresql/wal_archive/%f'

# Base backup
docker compose exec postgres pg_basebackup -U smalltalk -D /tmp/base_backup -Ft -z -P

# Restore to specific timestamp
# 1. Stop PostgreSQL
# 2. Restore base backup
# 3. Create recovery.conf:
restore_command = 'cp /var/lib/postgresql/wal_archive/%f %p'
recovery_target_time = '2025-01-23 10:30:00'
# 4. Start PostgreSQL
```

**Automated Backup Script:**
```bash
#!/bin/bash
# /usr/local/bin/backup-postgres.sh

BACKUP_DIR="/var/backups/smalltalk/postgres"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d-%H%M%S)

# Create backup
docker compose exec -T postgres pg_dump -U smalltalk smalltalk \
  --format=custom --compress=9 \
  > "$BACKUP_DIR/postgres-$DATE.dump"

# Upload to S3
aws s3 cp "$BACKUP_DIR/postgres-$DATE.dump" \
  s3://my-bucket/smalltalk-backups/postgres/

# Delete old backups
find "$BACKUP_DIR" -name "postgres-*.dump" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: postgres-$DATE.dump"
```

**Cron schedule (daily at 2 AM):**
```cron
0 2 * * * /usr/local/bin/backup-postgres.sh >> /var/log/smalltalk-backup.log 2>&1
```

### Disaster Recovery Procedures

**Scenario 1: Single component failure (Redis crash)**

1. Verify other services healthy:
   ```bash
   docker compose ps
   curl http://localhost:3001/health
   ```

2. Restore Redis from latest backup:
   ```bash
   docker compose stop redis
   docker compose cp ./backups/redis-dump-latest.rdb redis:/data/dump.rdb
   docker compose start redis
   ```

3. Verify recovery:
   ```bash
   docker compose exec redis redis-cli PING
   docker compose exec redis redis-cli DBSIZE
   ```

4. System automatically recovers (FR-040: 5-minute recovery target)

**Scenario 2: Complete data loss (disk failure)**

1. Provision new infrastructure
2. Install Docker and Docker Compose
3. Clone SmallTalk repository
4. Restore environment configuration:
   ```bash
   aws s3 cp s3://my-bucket/smalltalk-config/.env .env
   ```
5. Restore PostgreSQL (persistent data):
   ```bash
   docker compose up -d postgres
   aws s3 cp s3://my-bucket/smalltalk-backups/postgres/latest.dump - | \
     docker compose exec -T postgres pg_restore -U smalltalk -d smalltalk --clean
   ```
6. Restore Redis (optional - sessions can be rebuilt):
   ```bash
   docker compose up -d redis
   aws s3 cp s3://my-bucket/smalltalk-backups/redis/latest.rdb - | \
     docker compose cp - redis:/data/dump.rdb
   docker compose restart redis
   ```
7. Start application:
   ```bash
   docker compose up -d app
   ```
8. Verify health:
   ```bash
   curl http://localhost:3001/health
   ```

**Recovery Time Objectives (RTO):**
- Single component failure: < 5 minutes (FR-040)
- Complete data loss: < 30 minutes
- Regional disaster: < 2 hours (with geo-replicated backups)

**Recovery Point Objectives (RPO):**
- PostgreSQL: < 1 hour (hourly backups)
- Redis: < 5 minutes (AOF with everysec fsync)
- FileStorage: < 15 minutes (git commits or S3 sync)

---

## Scaling Considerations

SmallTalk supports horizontal and vertical scaling strategies.

### Horizontal Scaling (Multiple Instances)

**Architecture:**
```
                ┌──────────────┐
                │ Load Balancer│
                │   (nginx)    │
                └──────┬───────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
┌───────────┐  ┌───────────┐  ┌───────────┐
│  App #1   │  │  App #2   │  │  App #3   │
│  :3000    │  │  :3000    │  │  :3000    │
└─────┬─────┘  └─────┬─────┘  └─────┬─────┘
      │              │              │
      └──────────────┼──────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
  ┌──────────┐ ┌──────────┐ ┌──────────┐
  │  Redis   │ │  Redis   │ │  Redis   │
  │  Master  │ │  Slave   │ │  Slave   │
  └──────────┘ └──────────┘ └──────────┘
        │
        ▼
  ┌──────────────────────────────┐
  │  PostgreSQL (Primary)        │
  │  + Read Replicas (2x)        │
  └──────────────────────────────┘
```

**Scale with Docker Compose:**
```bash
# Scale to 3 instances
docker compose up -d --scale app=3

# Verify instances
docker compose ps app
```

**Load Balancer Configuration (nginx):**
```nginx
upstream smalltalk_backend {
    # Least connections algorithm
    least_conn;

    server app1:3000 max_fails=3 fail_timeout=30s;
    server app2:3000 max_fails=3 fail_timeout=30s;
    server app3:3000 max_fails=3 fail_timeout=30s;

    # Sticky sessions (optional - for session affinity)
    # ip_hash;
}

server {
    listen 80;
    server_name smalltalk.example.com;

    location / {
        proxy_pass http://smalltalk_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

**Session Affinity Considerations:**
- **Not required** if using Redis or PostgreSQL (sessions shared across instances)
- **Required** if using FileStorage (sessions local to each instance)
- Use `ip_hash` or cookie-based affinity for FileStorage

**Redis Cluster for High Availability:**
```yaml
# docker-compose.redis-cluster.yml
version: '3.8'
services:
  redis-master:
    image: redis:7-alpine
    command: redis-server --port 6379 --cluster-enabled yes

  redis-slave-1:
    image: redis:7-alpine
    command: redis-server --port 6379 --slaveof redis-master 6379

  redis-slave-2:
    image: redis:7-alpine
    command: redis-server --port 6379 --slaveof redis-master 6379

  redis-sentinel-1:
    image: redis:7-alpine
    command: redis-sentinel /etc/redis/sentinel.conf
```

### Vertical Scaling (Resource Limits)

**Set resource limits in docker-compose.yml:**
```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G

  redis:
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M

  postgres:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G
```

**Capacity Planning:**

| Sessions/Day | App Instances | App CPU | App RAM | Redis RAM | PostgreSQL |
|-------------|---------------|---------|---------|-----------|------------|
| < 100 | 1 | 0.5 CPU | 512 MB | 256 MB | 1 GB |
| 100-1K | 1-2 | 1 CPU | 1 GB | 512 MB | 2 GB |
| 1K-10K | 2-3 | 2 CPU | 2 GB | 1 GB | 4 GB |
| 10K-100K | 3-5 | 2 CPU | 4 GB | 2 GB | 8 GB |
| > 100K | 5+ | 4 CPU | 8 GB | 4 GB+ | 16 GB+ |

**Auto-scaling Triggers (Cloud Platforms):**
```yaml
# Kubernetes HPA (Horizontal Pod Autoscaler)
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: smalltalk-app
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: smalltalk-app
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
    - type: Pods
      pods:
        metric:
          name: sessions_active
        target:
          type: AverageValue
          averageValue: "50"
```

### Database Replication

**PostgreSQL Streaming Replication:**
```yaml
# docker-compose.postgres-replica.yml
services:
  postgres-primary:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=smalltalk
      - POSTGRES_USER=smalltalk
      - POSTGRES_PASSWORD=secure_password
    command: |
      postgres
        -c wal_level=replica
        -c max_wal_senders=3
        -c max_replication_slots=3
    volumes:
      - postgres-primary-data:/var/lib/postgresql/data

  postgres-replica-1:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=smalltalk
      - POSTGRES_USER=smalltalk
      - POSTGRES_PASSWORD=secure_password
      - POSTGRES_PRIMARY_HOST=postgres-primary
    command: |
      postgres
        -c hot_standby=on
    volumes:
      - postgres-replica-1-data:/var/lib/postgresql/data
    depends_on:
      - postgres-primary
```

**Read/Write Split:**
```typescript
// Configure separate read/write pools
const writePool = new Pool({
  host: 'postgres-primary',
  port: 5432,
  database: 'smalltalk',
  max: 20
});

const readPool = new Pool({
  host: 'postgres-replica',
  port: 5432,
  database: 'smalltalk',
  max: 50  // More read connections
});

// Use write pool for mutations
await writePool.query('INSERT INTO sessions ...');

// Use read pool for queries
await readPool.query('SELECT * FROM sessions ...');
```

### Performance Optimization

**Database Tuning (PostgreSQL):**
```sql
-- postgresql.conf optimizations for SmallTalk
shared_buffers = 256MB              -- 25% of system RAM
effective_cache_size = 1GB          -- 50-75% of system RAM
maintenance_work_mem = 64MB
work_mem = 16MB
max_connections = 200
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1              -- For SSD storage
effective_io_concurrency = 200      -- For SSD storage

-- Index optimizations
CREATE INDEX idx_sessions_updated_at ON sessions(updated_at);
CREATE INDEX idx_sessions_state ON sessions(state);
CREATE INDEX idx_key_value_ttl ON key_value(ttl) WHERE ttl IS NOT NULL;
```

**Redis Tuning:**
```bash
# redis.conf optimizations
maxmemory-policy allkeys-lru        # Evict least recently used keys
maxmemory 2gb                       # Set based on available RAM
tcp-backlog 511                     # Connection queue size
timeout 300                         # Close idle connections after 5 min
tcp-keepalive 300                   # TCP keepalive
appendonly yes                      # Enable AOF for durability
appendfsync everysec                # Balance performance/durability
auto-aof-rewrite-percentage 100     # Trigger AOF rewrite at 2x size
auto-aof-rewrite-min-size 64mb      # Minimum size for rewrite
```

**Application Performance:**
```typescript
// Enable connection pooling
const storageAdapter = new PostgresStorageAdapter({
  poolSize: 20,                     // Match max_connections
  idleTimeoutMillis: 30000,         // Close idle connections
  connectionTimeoutMillis: 2000     // Fail fast on connection issues
});

// Batch operations for efficiency
await storageAdapter.saveSessions(sessions);  // Faster than individual saves
await storageAdapter.getSessions(sessionIds); // Faster than individual gets

// Cache frequently accessed data
const cache = new Map();
const session = cache.get(sessionId) || await storageAdapter.getSession(sessionId);
```

---

## Troubleshooting

Common issues and solutions for SmallTalk deployments.

### Common Issues

#### Issue 1: Application won't start

**Symptoms:**
```bash
docker compose ps
# smalltalk-app   Exit 1
```

**Diagnosis:**
```bash
docker compose logs app
```

**Common causes and solutions:**

**Missing environment variables:**
```
Error: OPENAI_API_KEY is required
```
Solution: Add API key to `.env` file

**Database connection failed:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
Solution:
```bash
# Check PostgreSQL is running
docker compose ps postgres

# Check health
docker compose exec postgres pg_isready -U smalltalk

# Restart PostgreSQL
docker compose restart postgres
```

**Port already in use:**
```
Error: listen EADDRINUSE: address already in use :::3000
```
Solution:
```bash
# Find process using port
lsof -i :3000
kill -9 <PID>

# Or change port in .env
APP_PORT=3001
```

#### Issue 2: Health check failures

**Symptoms:**
```bash
curl http://localhost:3001/health
# {"status": "unhealthy", ...}
```

**Diagnosis:**
```bash
curl http://localhost:3001/health | jq
```

**Component-specific issues:**

**Storage unhealthy:**
```json
{
  "components": {
    "storage": {
      "status": "unhealthy",
      "message": "Connection timeout"
    }
  }
}
```
Solution:
```bash
# Check Redis
docker compose exec redis redis-cli PING

# Check PostgreSQL
docker compose exec postgres psql -U smalltalk -d smalltalk -c "SELECT 1;"

# Restart storage service
docker compose restart redis
```

**Event bus unhealthy:**
```json
{
  "components": {
    "eventBus": {
      "status": "unhealthy",
      "message": "Event bus health check failed"
    }
  }
}
```
Solution: Check application logs for event bus initialization errors

**Agent monitor unhealthy:**
```json
{
  "components": {
    "agentMonitor": {
      "status": "unhealthy",
      "details": {
        "disconnectedAgents": 5
      }
    }
  }
}
```
Solution: Review agent logs, check agent connectivity, restart failing agents

#### Issue 3: High latency (Session restore > 100ms)

**Diagnosis:**
```bash
# Check metrics
curl http://localhost:3001/metrics | grep storage_operations_duration

# Query Prometheus
histogram_quantile(0.95, rate(storage_operations_duration_seconds_bucket[5m]))
```

**Solutions:**

**Redis latency:**
```bash
# Check Redis latency
docker compose exec redis redis-cli --latency

# Check Redis slowlog
docker compose exec redis redis-cli SLOWLOG GET 10
```

**PostgreSQL latency:**
```bash
# Check slow queries
docker compose exec postgres psql -U smalltalk -d smalltalk -c "
  SELECT query, mean_exec_time, calls
  FROM pg_stat_statements
  ORDER BY mean_exec_time DESC
  LIMIT 10;
"

# Add missing indexes
docker compose exec postgres psql -U smalltalk -d smalltalk -c "
  CREATE INDEX idx_sessions_updated_at ON sessions(updated_at);
"
```

**Network latency:**
```bash
# Check container network latency
docker compose exec app ping -c 10 redis
docker compose exec app ping -c 10 postgres
```

#### Issue 4: Out of memory

**Symptoms:**
```
Error: JavaScript heap out of memory
```

**Diagnosis:**
```bash
# Check container memory usage
docker stats

# Check application metrics
curl http://localhost:3001/metrics | grep nodejs_heap
```

**Solutions:**

**Increase Node.js heap size:**
```yaml
# docker-compose.yml
services:
  app:
    environment:
      - NODE_OPTIONS=--max-old-space-size=4096  # 4GB heap
```

**Increase Redis memory:**
```bash
# .env
REDIS_MAX_MEMORY=512mb
```

**Increase container limits:**
```yaml
# docker-compose.yml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 4G
```

#### Issue 5: Session data loss

**Symptoms:**
- Sessions not restored after restart
- Empty session history

**Diagnosis:**
```bash
# Check storage adapter type
docker compose logs app | grep "Initializing storage"

# Check data persistence
docker volume ls | grep smalltalk
docker volume inspect smalltalk_app-data
```

**Solutions:**

**FileStorage data loss:**
```bash
# Verify volume mount
docker compose exec app ls -la /app/data/sessions/

# Restore from backup
docker compose cp ./backups/app-data-backup.tar.gz app:/tmp/
docker compose exec app tar xzf /tmp/app-data-backup.tar.gz -C /app/
```

**Redis data loss:**
```bash
# Check persistence settings
docker compose exec redis redis-cli CONFIG GET save
docker compose exec redis redis-cli CONFIG GET appendonly

# Enable persistence
docker compose exec redis redis-cli CONFIG SET appendonly yes
docker compose exec redis redis-cli CONFIG SET save "900 1 300 10 60 10000"
```

**PostgreSQL data loss:**
```bash
# Check data directory
docker compose exec postgres ls -la /var/lib/postgresql/data/

# Restore from backup
gunzip < postgres-backup.sql.gz | \
  docker compose exec -T postgres psql -U smalltalk smalltalk
```

#### Issue 6: Agent disconnections

**Symptoms:**
```bash
curl http://localhost:3001/health | jq '.components.agentMonitor'
# {"disconnectedAgents": 3}
```

**Diagnosis:**
```bash
# Check agent logs
docker compose logs app | grep -i "agent.*disconnect"

# Check health check metrics
curl http://localhost:3001/metrics | grep agent_health_checks_total
```

**Solutions:**

**Increase heartbeat timeout:**
```bash
# .env
AGENT_HEARTBEAT_TIMEOUT=120  # Increase from 90 to 120 seconds
```

**Review agent recovery strategy:**
```bash
# Check recovery attempts in logs
docker compose logs app | grep -i "recovery"
```

**Manual agent restart:**
```bash
# Trigger agent restart via API (if implemented)
curl -X POST http://localhost:3000/api/agents/{agentId}/restart
```

### Log Analysis

**Structured log format (FR-045):**
```json
{
  "timestamp": "2025-01-23T10:30:00.000Z",
  "level": "ERROR",
  "correlation_id": "req-abc123",
  "component": "SessionManager",
  "message": "Failed to save session",
  "metadata": {
    "sessionId": "session-xyz",
    "error": "Connection timeout",
    "retryCount": 3
  }
}
```

**Query logs with jq:**
```bash
# Filter errors only
docker compose logs app | grep '^{' | jq 'select(.level == "ERROR")'

# Group by component
docker compose logs app | grep '^{' | jq -r '.component' | sort | uniq -c

# Trace request flow with correlation ID
docker compose logs app | grep '^{' | jq 'select(.correlation_id == "req-abc123")'

# Find slowest operations
docker compose logs app | grep '^{' | jq 'select(.metadata.duration_ms > 100)'
```

**Centralized logging (recommended for production):**
```yaml
# docker-compose.yml
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
        labels: "service,environment"
        tag: "{{.ImageName}}/{{.Name}}/{{.ID}}"

  # Optional: Loki for log aggregation
  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
    volumes:
      - loki-data:/loki

  # Optional: Promtail for log shipping
  promtail:
    image: grafana/promtail:latest
    volumes:
      - /var/log:/var/log
      - ./config/promtail.yml:/etc/promtail/config.yml
```

### Performance Debugging

**Identify bottlenecks:**
```bash
# CPU profiling
docker compose exec app node --prof index.js

# Heap snapshot
docker compose exec app kill -USR2 <PID>  # Trigger heap snapshot
docker compose cp app:/app/heapdump-*.heapsnapshot .

# Analyze with Chrome DevTools
# chrome://inspect -> Load snapshot
```

**Database query analysis:**
```sql
-- PostgreSQL query performance
EXPLAIN ANALYZE SELECT * FROM sessions WHERE state = 'active';

-- Enable pg_stat_statements
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Top slow queries
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Redis performance analysis:**
```bash
# Monitor Redis commands in real-time
docker compose exec redis redis-cli MONITOR

# Redis slowlog (queries > 10ms)
docker compose exec redis redis-cli CONFIG SET slowlog-log-slower-than 10000
docker compose exec redis redis-cli SLOWLOG GET 10
```

---

## Production Checklist

Complete this checklist before deploying SmallTalk to production.

### Pre-Deployment Verification

#### Security

- [ ] All default passwords changed (PostgreSQL, Redis, Grafana)
- [ ] API keys configured via environment variables (not hardcoded)
- [ ] `.env` file permissions restricted (`chmod 600 .env`)
- [ ] `.env` file added to `.gitignore`
- [ ] TLS/HTTPS enabled for external access
- [ ] Firewall rules configured (restrict port access)
- [ ] Security warning displayed at startup (FR-034)
- [ ] File permissions set to 600 for session/agent state files (FR-034a)
- [ ] Docker containers running as non-root user (UID 1001)
- [ ] Secrets management configured (Vault, AWS Secrets Manager, etc.)

#### Configuration

- [ ] `NODE_ENV=production` set in environment
- [ ] LLM provider API keys validated (test connection)
- [ ] Storage adapter selected (Redis recommended for production)
- [ ] Session expiration policy configured (default: 7 days)
- [ ] Max concurrent sessions set appropriately (default: 100)
- [ ] Agent health monitoring enabled with appropriate timeouts
- [ ] Event retention period configured (default: 24 hours)
- [ ] Resource limits set in docker-compose.yml
- [ ] Log retention policy configured (max-size, max-file)

#### Infrastructure

- [ ] Docker 20.10+ and Docker Compose 2.0+ installed
- [ ] Minimum system resources available (2GB RAM, 10GB disk)
- [ ] Network connectivity to LLM providers verified
- [ ] Redis running with persistence enabled (RDB + AOF)
- [ ] PostgreSQL running with WAL archiving enabled
- [ ] Volumes configured for data persistence
- [ ] Health checks configured for all services
- [ ] Restart policies set (`restart: unless-stopped`)

#### Monitoring & Alerting

- [ ] Health endpoint accessible (`/health`)
- [ ] Readiness endpoint configured for load balancer (`/ready`)
- [ ] Metrics endpoint configured for Prometheus (`/metrics`)
- [ ] Prometheus scraping configured (15s interval)
- [ ] Grafana dashboards imported and configured
- [ ] Alert rules configured for critical metrics:
  - [ ] High session load (> 80 active sessions)
  - [ ] Agent failure rate (> 0.1 failures/sec)
  - [ ] Storage latency violations (p95 > 100ms)
  - [ ] Service unavailability (down > 1 minute)
  - [ ] High memory usage (> 90% heap)
- [ ] Alert delivery configured (email, Slack, PagerDuty)
- [ ] On-call rotation established

#### Backup & Recovery

- [ ] Backup strategy defined for storage adapter:
  - [ ] FileStorage: Daily file backups to S3
  - [ ] Redis: RDB snapshots every 6 hours + AOF persistence
  - [ ] PostgreSQL: Daily pg_dump backups + WAL archiving
- [ ] Backup automation configured (cron, systemd timer)
- [ ] Off-site backup storage configured (S3, cloud storage)
- [ ] Backup retention policy defined (30 days recommended)
- [ ] Disaster recovery procedures documented
- [ ] Restore procedures tested (monthly validation)
- [ ] Recovery Time Objective (RTO) validated (< 5 minutes for single component)
- [ ] Recovery Point Objective (RPO) validated (< 1 hour data loss)

#### Performance & Scalability

- [ ] Load testing performed (target: 100 concurrent sessions)
- [ ] Performance baselines established:
  - [ ] Session restore latency < 100ms p95 (FR-007)
  - [ ] Event propagation latency < 10ms p95 (FR-013)
  - [ ] State serialization < 50ms p95
- [ ] Database connection pooling configured
- [ ] Database indexes created for frequent queries
- [ ] Redis memory eviction policy configured (`allkeys-lru`)
- [ ] Horizontal scaling tested (multiple app instances)
- [ ] Session affinity configured (if using FileStorage)
- [ ] Auto-scaling thresholds configured (if using cloud platform)

#### Operational Readiness

- [ ] Deployment runbook created
- [ ] Rollback procedure documented
- [ ] Incident response playbook created
- [ ] Escalation procedures defined
- [ ] Service Level Objectives (SLOs) defined:
  - [ ] Uptime: 95% monthly (FR-039)
  - [ ] Recovery time: < 5 minutes (FR-040)
  - [ ] Session restore success: > 95% (SC-002)
  - [ ] Agent recovery success: > 90% (SC-004)
- [ ] Maintenance windows scheduled
- [ ] Team training completed on:
  - [ ] SmallTalk architecture and components
  - [ ] Deployment procedures
  - [ ] Monitoring and alerting
  - [ ] Troubleshooting and recovery
  - [ ] Backup and restore

#### Testing & Validation

- [ ] Contract tests passing (48/48 for storage adapters)
- [ ] Integration tests passing
- [ ] End-to-end tests passing
- [ ] Load tests passing (target capacity validated)
- [ ] Chaos testing performed (component failures, network issues)
- [ ] Security scanning completed (vulnerability assessment)
- [ ] Penetration testing performed (if handling sensitive data)
- [ ] User acceptance testing (UAT) completed

#### Documentation

- [ ] Architecture diagram created
- [ ] API documentation complete
- [ ] Environment variable reference documented
- [ ] Deployment guide reviewed (this document)
- [ ] Troubleshooting guide reviewed
- [ ] Runbooks created for common operations
- [ ] Contact information documented (on-call, escalation)

### Post-Deployment Validation

After deployment, verify:

1. **Health check passing:**
   ```bash
   curl http://your-domain.com/health | jq
   # Expected: {"status": "healthy"}
   ```

2. **All services healthy:**
   ```bash
   docker compose ps
   # All services should show (healthy)
   ```

3. **Metrics collection working:**
   ```bash
   curl http://your-domain.com/metrics | head -20
   # Should show Prometheus metrics
   ```

4. **Session creation and restoration:**
   ```bash
   # Create session
   curl -X POST http://your-domain.com/api/sessions -d '{"message": "test"}'
   # Note session ID, restart app
   docker compose restart app
   # Restore session
   curl http://your-domain.com/api/sessions/{sessionId}
   # Should return full session state
   ```

5. **Monitoring dashboards accessible:**
   - Prometheus: http://your-domain.com:9090
   - Grafana: http://your-domain.com:3100

6. **Alerts configured and firing:**
   ```bash
   # Trigger test alert (intentionally exceed threshold)
   # Verify alert received via configured channel
   ```

7. **Logs aggregated and queryable:**
   ```bash
   docker compose logs app | grep ERROR
   # Should show structured JSON logs
   ```

8. **Backup automation running:**
   ```bash
   # Check latest backup timestamp
   ls -lt /var/backups/smalltalk/
   ```

### Ongoing Operations

Weekly:
- Review monitoring dashboards for trends
- Check alert history for false positives/negatives
- Verify backup success (check backup logs)
- Review error logs for recurring issues

Monthly:
- Test disaster recovery procedures
- Review and update capacity planning
- Rotate API keys and passwords
- Update dependencies (security patches)
- Review SLO compliance

Quarterly:
- Load testing with updated capacity targets
- Security audit and vulnerability scanning
- Team training refresh
- Documentation review and updates

---

## Additional Resources

- **SmallTalk Documentation**: [README.md](../README.md)
- **Docker Deployment**: [DOCKER.md](../DOCKER.md)
- **Storage Adapter Comparison**: [storage-adapter-comparison.md](./storage-adapter-comparison.md)
- **Feature Specification**: [specs/001-production-robustness/spec.md](../specs/001-production-robustness/spec.md)
- **Contract Testing**: [docs/contract-testing-index.md](./contract-testing-index.md)

### External Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [Prometheus Monitoring](https://prometheus.io/docs/introduction/overview/)
- [Grafana Dashboards](https://grafana.com/docs/grafana/latest/)
- [Redis Persistence](https://redis.io/docs/manual/persistence/)
- [PostgreSQL Backup](https://www.postgresql.org/docs/current/backup.html)
- [12-Factor App Methodology](https://12factor.net/)

---

**Document Version**: 1.0.0
**Last Updated**: 2025-01-23
**SmallTalk Version**: 0.2.3
**Feature Branch**: 001-production-robustness
**Status**: ✅ Production Ready
