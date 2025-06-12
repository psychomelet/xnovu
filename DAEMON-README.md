# XNovu Unified Daemon

This document describes the unified daemon that orchestrates notification processing using Temporal workflows and Supabase realtime subscriptions.

## Architecture Overview

The system consists of:

1. **Unified Daemon** - Single orchestrator process that manages:
   - Realtime subscriptions to Supabase (INSERT/UPDATE events)
   - Temporal workflow orchestration
   - Health monitoring and metrics

2. **Temporal Workers** - Run as part of the daemon process to execute:
   - Notification processing workflows
   - Cron-based scheduling workflows
   - Scheduled notification workflows
   - Master orchestration workflow

## Key Features

- ✅ **Temporal Workflows** - Durable execution with automatic retries
- ✅ **Enterprise Isolation** - Separate handling per enterprise
- ✅ **UPDATE Monitoring** - Monitors both INSERT and UPDATE events
- ✅ **Workflow Visibility** - Real-time monitoring via Temporal UI
- ✅ **Health Monitoring** - Comprehensive health checks and metrics
- ✅ **Graceful Shutdown** - Proper cleanup and workflow termination
- ✅ **Scalable Workers** - Horizontal scaling via Temporal
- ✅ **Reconnection Logic** - Automatic reconnection with exponential backoff

## Quick Start

### 1. Environment Setup

Copy the example environment file:
```bash
cp .env.example .env
```

Configure Temporal connection:
```bash
# Required settings
TEMPORAL_ADDRESS=your-temporal-server:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=xnovu-notification-processing

# Supabase settings
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Novu settings
NOVU_SECRET_KEY=your-novu-secret-key

# Enterprise configuration
DAEMON_ENTERPRISE_IDS=enterprise-1,enterprise-2
```

### 2. Development Mode

Start the daemon:
```bash
pnpm xnovu daemon start --dev --enterprises "ent1,ent2"
```

### 3. Production Mode

```bash
# Start daemon with production settings
pnpm xnovu daemon start --enterprises "ent1,ent2,ent3" --log-level info
```

### 4. Monitoring

- **Health Check**: http://localhost:3001/health
- **Detailed Status**: http://localhost:3001/status
- **Temporal UI**: Access your Temporal UI to monitor workflows

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

### Examples

```bash
# Start daemon for specific enterprises
pnpm xnovu daemon start --enterprises "ent1,ent2,ent3" --log-level debug

# Development setup
pnpm xnovu daemon start --dev --enterprises "test-ent"
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TEMPORAL_ADDRESS` | - | Temporal server address |
| `TEMPORAL_NAMESPACE` | `default` | Temporal namespace |
| `TEMPORAL_TASK_QUEUE` | `xnovu-notification-processing` | Task queue name |
| `TEMPORAL_MAX_CONCURRENT_ACTIVITIES` | `100` | Max concurrent activities |
| `TEMPORAL_MAX_CONCURRENT_WORKFLOWS` | `50` | Max concurrent workflows |
| `DAEMON_ENTERPRISE_IDS` | - | Comma-separated enterprise IDs |
| `DAEMON_HEALTH_PORT` | `3001` | Health check HTTP port |
| `DAEMON_LOG_LEVEL` | `info` | Logging level |
| `SUBSCRIPTION_RECONNECT_DELAY` | `1000` | Reconnection delay in ms |
| `SUBSCRIPTION_MAX_RETRIES` | `10` | Maximum reconnection attempts |

## Health Monitoring

### Health Endpoints

| Endpoint | Description |
|----------|-------------|
| `/health` | Basic health status |
| `/status` | Comprehensive status information |

### Health Status

```json
{
  "status": "healthy",
  "uptime": 3600,
  "components": {
    "subscriptions": {
      "total": 3,
      "active": 3,
      "failed": 0,
      "reconnecting": 0
    },
    "ruleEngine": "healthy",
    "queue": "healthy",
    "temporal": "healthy"
  },
  "enterprise_status": {
    "enterprise-1": "subscribed",
    "enterprise-2": "subscribed"
  },
  "temporal_status": {
    "status": "healthy",
    "orchestrationWorkflow": "RUNNING"
  }
}
```

## Temporal Workflows

### Master Orchestration Workflow
Coordinates all subsystems:
- Manages cron scheduling workflows
- Manages scheduled notification workflows
- Handles graceful shutdown

### Notification Processing Workflow
Processes individual notifications:
- Fetches workflow configuration
- Renders templates for dynamic workflows
- Triggers Novu workflows
- Updates notification status

### Cron Scheduling Workflow
Executes notifications based on cron expressions:
- Monitors active cron rules
- Executes rules at scheduled times
- Handles timezone conversions

### Scheduled Notification Workflow
Processes time-based notifications:
- Polls for due notifications
- Processes in batches
- Updates notification status

## Troubleshooting

### Common Issues

**Daemon won't start:**
```bash
# Check environment variables
pnpm xnovu daemon start --log-level debug

# Verify Temporal connectivity
curl $TEMPORAL_ADDRESS

# Check Supabase connectivity
curl -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
     "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/"
```

**Subscriptions failing:**
```bash
# Check subscription health
pnpm xnovu daemon health

# View detailed status
curl http://localhost:3001/status
```

**Workflow issues:**
- Check Temporal UI for workflow status
- View workflow history for errors
- Check worker logs for activity failures

### Log Analysis

**Structured Logging:**
```json
{
  "level": "info",
  "timestamp": "2024-01-15T10:30:00Z",
  "component": "DaemonManager",
  "event": "orchestration_started",
  "workflow_id": "orchestration-123456"
}
```

**Key Log Components:**
- `DaemonManager` - Overall daemon orchestration
- `EnhancedSubscriptionManager` - Realtime subscription events
- `TemporalService` - Worker and workflow management
- `HealthMonitor` - Health check events

### Performance Tuning

**High Load Scenarios:**

```bash
# Increase worker capacity
TEMPORAL_MAX_CONCURRENT_ACTIVITIES=200
TEMPORAL_MAX_CONCURRENT_WORKFLOWS=100

# Scale Temporal workers horizontally
# Deploy multiple daemon instances with same task queue

# Tune subscription health checks
SUBSCRIPTION_HEALTH_CHECK_INTERVAL=120000
```

## Best Practices

### Production Deployment

1. **Resource Planning**
   - 1 daemon per deployment/region
   - Configure Temporal worker limits based on load
   - Monitor memory usage and scale accordingly

2. **Security**
   - Use secure Temporal connections
   - Restrict network access to health endpoints
   - Rotate secrets regularly

3. **Monitoring**
   - Set up alerts for subscription failures
   - Monitor Temporal workflow metrics
   - Track enterprise-specific events
   - Configure log aggregation

4. **Backup/Recovery**
   - Temporal provides workflow history
   - Configure workflow retention policies
   - Test disaster recovery procedures

### Development Best Practices

1. **Local Development**
   - Use local Temporal server for testing
   - Enable debug logging
   - Use test enterprise IDs

2. **Testing**
   - Integration tests for subscription handling
   - Workflow testing with Temporal test framework
   - End-to-end notification flow tests

3. **Code Quality**
   - Structured logging throughout
   - Comprehensive error handling
   - Type safety for all workflow data
   - Documentation for workflows

This unified daemon provides a robust, scalable foundation for handling all XNovu notification processing with Temporal workflows, enterprise isolation, and comprehensive monitoring.