# XNovu Unified Daemon & Worker System

This document describes the unified daemon and worker system that handles realtime subscriptions, cron scheduling, scheduled notifications, and BullMQ-based processing.

## Architecture Overview

The system consists of two main components:

1. **Unified Daemon** - Single orchestrator process that manages:
   - Realtime subscriptions to Supabase (INSERT/UPDATE events)
   - Cron-based notification rules
   - Scheduled notification processing
   - Health monitoring and metrics

2. **Worker Processes** - Scalable job processors that handle:
   - Realtime notification processing
   - Scheduled notification delivery
   - Rule execution jobs
   - Novu workflow triggering

## Key Features

- ✅ **Unified Management** - Single daemon orchestrates all notification services
- ✅ **Enterprise Isolation** - Separate subscriptions per enterprise with filtering
- ✅ **UPDATE Monitoring** - Monitors both INSERT and UPDATE events (not just INSERT)
- ✅ **BullMQ Integration** - Uses BullMQ for reliable job processing with retry logic
- ✅ **Priority Queues** - Different priorities for realtime vs scheduled vs cron jobs
- ✅ **Health Monitoring** - Comprehensive health checks and metrics endpoints
- ✅ **Graceful Shutdown** - Proper cleanup and shutdown handling
- ✅ **Docker Ready** - Complete Docker deployment configuration
- ✅ **Scalable Workers** - Horizontal scaling of worker processes
- ✅ **Reconnection Logic** - Automatic reconnection with exponential backoff

## Quick Start

### 1. Environment Setup

Copy the example environment file:
```bash
cp .env.daemon.example .env
```

Fill in your configuration:
```bash
# Required settings
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NOVU_SECRET_KEY=your-novu-secret-key
REDIS_URL=redis://localhost:6379
DAEMON_ENTERPRISE_IDS=enterprise-1,enterprise-2
```

### 2. Development Mode

Start Redis:
```bash
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

Start the daemon:
```bash
pnpm xnovu daemon start --dev --enterprises "ent1,ent2"
```

Start workers (in another terminal):
```bash
pnpm xnovu worker scale 2 --dev --concurrency 5
```

### 3. Docker Mode

Start everything with Docker Compose:
```bash
# Development
docker-compose -f docker/docker-compose.yml up -d

# Production  
docker-compose -f docker/docker-compose.prod.yml up -d
```

### 4. Monitoring

- **Health Check**: http://localhost:3001/health
- **Detailed Health**: http://localhost:3001/health/detailed
- **Bull Board**: http://localhost:3000 (queue monitoring)
- **Metrics**: http://localhost:3001/metrics (Prometheus format)

## CLI Commands

### Daemon Management

```bash
# Start daemon
pnpm xnovu daemon start [options]
  --dev                    # Development mode
  --enterprises <ids>      # Comma-separated enterprise IDs
  --health-port <port>     # Health check port (default: 3001)
  --log-level <level>      # Log level: debug, info, warn, error

# Check status
pnpm xnovu daemon status
pnpm xnovu daemon health  # Detailed health check

# Stop daemon
pnpm xnovu daemon stop

# Restart daemon
pnpm xnovu daemon restart [options]
```

### Worker Management

```bash
# Start single worker
pnpm xnovu worker start [options]
  --dev                    # Development mode
  --concurrency <n>        # Concurrent jobs per worker (default: 5)
  --log-level <level>      # Log level

# Scale workers
pnpm xnovu worker scale <count> [options]
  --concurrency <n>        # Concurrent jobs per worker

# List workers
pnpm xnovu worker list

# Stop all workers
pnpm xnovu worker stop
```

### Examples

```bash
# Start daemon for specific enterprises
pnpm xnovu daemon start --enterprises "ent1,ent2,ent3" --log-level debug

# Scale to 4 workers with high concurrency
pnpm xnovu worker scale 4 --concurrency 10

# Development setup
pnpm xnovu daemon start --dev --enterprises "test-ent"
pnpm xnovu worker scale 2 --dev --concurrency 3
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DAEMON_ENTERPRISE_IDS` | - | Comma-separated enterprise IDs to monitor |
| `DAEMON_HEALTH_PORT` | `3001` | Health check HTTP port |
| `DAEMON_LOG_LEVEL` | `info` | Logging level (debug, info, warn, error) |
| `SUBSCRIPTION_RECONNECT_DELAY` | `1000` | Reconnection delay in milliseconds |
| `SUBSCRIPTION_MAX_RETRIES` | `10` | Maximum reconnection attempts |
| `REALTIME_QUEUE_PRIORITY` | `10` | Priority for realtime events |
| `SCHEDULED_QUEUE_PRIORITY` | `5` | Priority for scheduled notifications |
| `CRON_QUEUE_PRIORITY` | `1` | Priority for cron-generated notifications |
| `WORKER_CONCURRENCY` | `5` | Concurrent jobs per worker process |

### Queue Priorities

The system uses priority-based job processing:

1. **Realtime Events** (Priority 10) - Immediate processing of INSERT/UPDATE events
2. **Scheduled Notifications** (Priority 5) - Time-sensitive scheduled deliveries  
3. **Cron Jobs** (Priority 1) - Background rule execution

### Enterprise Configuration

You can configure settings per enterprise:

```bash
# Enable/disable subscription for specific enterprise
ENT_enterprise-1_SUBSCRIPTION_ENABLED=true
ENT_enterprise-2_SUBSCRIPTION_ENABLED=false

# Custom priority for enterprise
ENT_enterprise-1_REALTIME_PRIORITY=15
```

## Health Monitoring

### Health Endpoints

| Endpoint | Description |
|----------|-------------|
| `/health` | Basic health status |
| `/health/detailed` | Comprehensive health information |
| `/health/subscriptions` | Subscription-specific health |
| `/metrics` | Prometheus metrics |

### Health Status

```json
{
  "status": "healthy",     // healthy, degraded, unhealthy
  "uptime": 3600,
  "components": {
    "subscriptions": {
      "total": 3,
      "active": 3,
      "failed": 0,
      "reconnecting": 0
    },
    "ruleEngine": "healthy",
    "queue": "healthy"
  },
  "enterprise_status": {
    "enterprise-1": "subscribed",
    "enterprise-2": "subscribed"
  }
}
```

### Monitoring Integration

The system provides Prometheus metrics for integration with monitoring systems:

```bash
# Daemon uptime
xnovu_daemon_uptime_seconds

# Health status
xnovu_daemon_healthy

# Subscription metrics
xnovu_subscriptions_total
xnovu_subscriptions_active
xnovu_subscriptions_failed

# Queue metrics
xnovu_queue_notification_waiting
xnovu_queue_notification_active
xnovu_queue_notification_completed
```

## Docker Deployment

### Development

```yaml
# docker/docker-compose.yml
services:
  daemon:
    build: 
      dockerfile: docker/Dockerfile.daemon
    environment:
      - DAEMON_ENTERPRISE_IDS=ent1,ent2
  
  worker:
    deploy:
      replicas: 2
    environment:
      - WORKER_CONCURRENCY=5
```

### Production

```yaml
# docker/docker-compose.prod.yml  
services:
  daemon:
    deploy:
      replicas: 1
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
  
  worker:
    deploy:
      replicas: 4
      resources:
        limits:
          memory: 1.5G
          cpus: '1.0'
```

### Scaling

```bash
# Scale workers
docker service scale xnovu-stack_worker=6

# Scale Redis replicas
docker service scale xnovu-stack_redis-replica=3
```

## Troubleshooting

### Common Issues

**Daemon won't start:**
```bash
# Check environment variables
pnpm xnovu daemon start --log-level debug

# Verify Redis connection
redis-cli ping

# Check Supabase connectivity
curl -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
     "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/"
```

**Subscriptions failing:**
```bash
# Check subscription health
pnpm xnovu daemon health

# View detailed subscription status
curl http://localhost:3001/health/subscriptions
```

**Queue issues:**
```bash
# Check queue statistics
curl http://localhost:3001/health/detailed

# View Bull Board dashboard
open http://localhost:3000
```

### Log Analysis

**Structured Logging:**
```json
{
  "level": "info",
  "timestamp": "2024-01-15T10:30:00Z",
  "component": "SubscriptionManager",
  "enterprise_id": "ent1",
  "event": "notification_received",
  "notification_id": 12345,
  "event_type": "INSERT"
}
```

**Key Log Components:**
- `DaemonManager` - Overall daemon orchestration
- `SubscriptionManager` - Realtime subscription events
- `NotificationQueue` - Job processing
- `HealthMonitor` - Health check events

### Performance Tuning

**High Load Scenarios:**

```bash
# Increase worker concurrency
WORKER_CONCURRENCY=15

# Scale worker processes
pnpm xnovu worker scale 6

# Increase queue concurrency
RULE_ENGINE_MAX_CONCURRENT_JOBS=25

# Tune subscription health checks
SUBSCRIPTION_HEALTH_CHECK_INTERVAL=120000
```

**Memory Optimization:**

```bash
# Reduce queue retention
removeOnComplete: 20
removeOnFail: 50

# Optimize Redis memory
redis-cli config set maxmemory-policy allkeys-lru
```

## Migration from Existing System

### Step 1: Parallel Deployment

1. Deploy daemon in monitoring mode (no processing)
2. Verify subscription connectivity
3. Compare event capture with existing system

### Step 2: Gradual Rollout

1. Enable processing for test enterprise
2. Monitor performance and error rates  
3. Gradually add more enterprises

### Step 3: Full Migration

1. Enable for all enterprises
2. Decommission existing realtime processing
3. Monitor and optimize

### Migration Checklist

- [ ] Environment variables configured
- [ ] Redis accessible from both daemon and workers
- [ ] Supabase permissions verified
- [ ] Novu integration tested
- [ ] Health monitoring configured
- [ ] Log aggregation set up
- [ ] Monitoring dashboards created
- [ ] Backup/recovery procedures documented

## Advanced Configuration

### Custom Enterprise Settings

```typescript
// Per-enterprise configuration
const enterpriseConfig = {
  'enterprise-1': {
    enabled: true,
    events: ['INSERT', 'UPDATE'],
    priority: 10,
    maxRetries: 15
  },
  'enterprise-2': {
    enabled: true,
    events: ['INSERT'],
    priority: 5,
    maxRetries: 10
  }
};
```

### Queue Customization

```typescript
// Custom queue configuration
const queueConfig = {
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
    removeOnComplete: 50,
    removeOnFail: 100,
  },
  settings: {
    stalledInterval: 30000,
    maxStalledCount: 3,
  }
};
```

### Monitoring Extensions

```typescript
// Custom metrics
const customMetrics = {
  notificationLatency: new Histogram({
    name: 'xnovu_notification_latency_seconds',
    help: 'Notification processing latency',
    buckets: [0.1, 0.5, 1, 2, 5]
  }),
  
  enterpriseEvents: new Counter({
    name: 'xnovu_enterprise_events_total',
    help: 'Total events per enterprise',
    labelNames: ['enterprise_id', 'event_type']
  })
};
```

## Best Practices

### Production Deployment

1. **Resource Planning**
   - 1 daemon per deployment/region
   - 2-4 workers per CPU core
   - Redis with persistence enabled
   - Monitor memory usage and scale accordingly

2. **Security**
   - Use Redis AUTH in production
   - Restrict network access to health endpoints
   - Rotate secrets regularly
   - Enable TLS for external connections

3. **Monitoring**
   - Set up alerts for subscription failures
   - Monitor queue depth and processing rates
   - Track enterprise-specific metrics
   - Configure log aggregation and analysis

4. **Backup/Recovery**
   - Redis persistence configuration
   - Queue job recovery procedures
   - Subscription state recovery
   - Disaster recovery testing

### Development Best Practices

1. **Local Development**
   - Use Docker Compose for consistent environment
   - Enable debug logging for troubleshooting
   - Use separate Redis instance for testing
   - Mock external services when needed

2. **Testing**
   - Integration tests for subscription handling
   - Load tests for queue processing
   - End-to-end tests for notification flow
   - Chaos engineering for failure scenarios

3. **Code Quality**
   - Structured logging throughout
   - Comprehensive error handling
   - Type safety for all job data
   - Documentation for custom configurations

This unified daemon and worker system provides a robust, scalable foundation for handling all XNovu notification processing with enterprise isolation, reliability, and comprehensive monitoring.