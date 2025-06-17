# XNovu Deployment Guide

This document covers deployment strategies and Docker containerization for XNovu.

## Docker Deployment

### Docker Commands with Auto-Tagging

```bash
# Build with auto-generated tags
pnpm xnovu docker:build

# Multi-platform build
pnpm xnovu docker:build --platform linux/arm64

# Run in detached mode
pnpm xnovu docker:run -d

# Preview what would be pushed
pnpm xnovu docker:push --dry-run

# Push to custom registry
pnpm xnovu docker:push -r custom-registry

# Stop and remove container
pnpm xnovu docker:stop
```

## Docker Auto-Tagging System

XNovu uses an intelligent auto-tagging system based on git state:

### Tag Generation
- **Commit SHA**: Always includes short git commit hash (e.g., `6f826ed`)
- **Git Tag**: Includes nearest semantic version tag if available (e.g., `v1.2.3`)
- **Latest**: Always includes `latest` tag
- **Dirty State**: Appends `-dirty` suffix if working tree has uncommitted changes

### Examples

```bash
# Clean working tree with git tag v1.0.0
Local tag: xnovu:6f826ed
Remote tags: 6f826ed, v1.0.0, latest

# Dirty working tree (uncommitted changes)
Local tag: xnovu:6f826ed-dirty
Remote tags: 6f826ed, latest

# Clean working tree without git tags
Local tag: xnovu:6f826ed
Remote tags: 6f826ed, latest
```

### Registry Configuration
- **Default Registry**: `registry.cn-shanghai.aliyuncs.com/yogosystem`
- **Image Name**: `xnovu`
- **Override Registry**: Use `-r` flag with push command

## Environment Configuration for Deployment

### Production Environment Variables

Ensure all required environment variables are set in your deployment environment:

```bash
# Copy and configure environment variables
cp .env.example .env
```

Key variables for production:
- `NOVU_SECRET_KEY` - Your Novu API secret key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role for database access
- `DATABASE_URL` - PostgreSQL connection string
- `TEMPORAL_ADDRESS` - Temporal cluster connection string
- `TEMPORAL_NAMESPACE` - Temporal namespace (default: xnovu)
- `TEMPORAL_TASK_QUEUE` - Temporal task queue name

### Worker Configuration

Additional variables for the XNovu worker:
- `POLL_INTERVAL_MS` - New notification polling interval (default: 10000ms)
- `FAILED_POLL_INTERVAL_MS` - Failed notification retry interval (default: 60000ms)  
- `SCHEDULED_POLL_INTERVAL_MS` - Scheduled notification check interval (default: 30000ms)
- `POLL_BATCH_SIZE` - Number of notifications per batch (default: 100)
- `WORKER_HEALTH_PORT` - Worker health check port (default: 3001)
- `TEMPORAL_MAX_CONCURRENT_ACTIVITIES` - Max concurrent Temporal activities (default: 100)
- `TEMPORAL_MAX_CONCURRENT_WORKFLOWS` - Max concurrent Temporal workflows (default: 50)

### Container Health Checks

The Docker containers include health checks for:

**Application Container (port 4000):**
- Application server responsiveness
- Database connectivity
- Novu service availability

**Worker Container (port 3001):**
- Worker process health
- Temporal worker connectivity
- Database polling loop status
- Notification processing status

## Worker Management

XNovu includes a unified worker system that handles both Temporal workflows and database polling. The worker can be managed using CLI commands:

### Worker Commands

```bash
# Start the unified worker
pnpm xnovu worker start

# Stop the worker
pnpm xnovu worker stop

# Check worker status
pnpm xnovu worker status

# Get detailed health information
pnpm xnovu worker health

# Restart the worker
pnpm xnovu worker restart
```

### Worker Architecture

The unified worker consists of:
- **Temporal Worker**: Processes async notification workflows
- **Database Polling Loop**: Monitors for new/failed/scheduled notifications
- **Health Monitoring**: Provides status endpoints for operational monitoring

### Worker Health Endpoints

- `GET /health` - Basic health check
- `GET /status` - Detailed worker status including polling metrics
- `GET /metrics` - Performance and processing metrics

## Deployment Strategies

### Docker Compose Deployment

For local development or single-server deployment:

```yaml
version: '3.8'
services:
  # XNovu Application
  app:
    image: registry.cn-shanghai.aliyuncs.com/yogosystem/xnovu:latest
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - NOVU_SECRET_KEY=${NOVU_SECRET_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
      - DATABASE_URL=${DATABASE_URL}
      - TEMPORAL_ADDRESS=${TEMPORAL_ADDRESS}
      - TEMPORAL_NAMESPACE=${TEMPORAL_NAMESPACE:-xnovu}
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:4000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # XNovu Worker
  worker:
    image: registry.cn-shanghai.aliyuncs.com/yogosystem/xnovu:latest
    command: ["pnpm", "xnovu", "worker", "start"]
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - NOVU_SECRET_KEY=${NOVU_SECRET_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
      - DATABASE_URL=${DATABASE_URL}
      - TEMPORAL_ADDRESS=${TEMPORAL_ADDRESS}
      - TEMPORAL_NAMESPACE=${TEMPORAL_NAMESPACE:-xnovu}
      - TEMPORAL_TASK_QUEUE=${TEMPORAL_TASK_QUEUE:-xnovu-notification-processing}
      - POLL_INTERVAL_MS=${POLL_INTERVAL_MS:-10000}
      - FAILED_POLL_INTERVAL_MS=${FAILED_POLL_INTERVAL_MS:-60000}
      - SCHEDULED_POLL_INTERVAL_MS=${SCHEDULED_POLL_INTERVAL_MS:-30000}
      - POLL_BATCH_SIZE=${POLL_BATCH_SIZE:-100}
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    depends_on:
      - app
```

**Important Notes:**
- Both services require access to external Temporal cluster
- Worker service uses `pnpm xnovu worker start` command for unified worker management
- Health checks are available on separate ports (4000 for app, 3001 for worker)
- Polling configuration is handled by environment variables
- No Redis dependency - removed in favor of Temporal-based async processing

### Kubernetes Deployment

For production Kubernetes deployments, ensure proper:
- Secret management for API keys
- ConfigMap for non-sensitive configuration
- Service mesh integration if applicable
- Horizontal pod autoscaling based on queue depth

### Cloud Platform Deployment

#### Vercel/Netlify (Serverless)
- Configure environment variables in platform settings
- Ensure proper function timeout settings
- Note: Worker component requires persistent runtime - consider separate container deployment

#### AWS/GCP/Azure (Container Services)
- Deploy both app and worker containers
- Use managed Temporal cloud services or self-hosted Temporal cluster
- Configure auto-scaling policies for both services
- Set up proper monitoring and alerting for worker health endpoints
- Consider separate scaling policies for app vs worker based on notification load