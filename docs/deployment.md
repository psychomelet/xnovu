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
- `REDIS_URL` - Redis connection string for job queue
- `DATABASE_URL` - PostgreSQL connection string

### Container Health Checks

The Docker container includes health checks for:
- Application server responsiveness
- Database connectivity
- Redis connectivity
- Novu service availability

## Deployment Strategies

### Docker Compose Deployment

For local development or single-server deployment:

```yaml
version: '3.8'
services:
  xnovu:
    image: registry.cn-shanghai.aliyuncs.com/yogosystem/xnovu:latest
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - NOVU_SECRET_KEY=${NOVU_SECRET_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - redis

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
```

### Kubernetes Deployment

For production Kubernetes deployments, ensure proper:
- Secret management for API keys
- ConfigMap for non-sensitive configuration
- Service mesh integration if applicable
- Horizontal pod autoscaling based on queue depth

### Cloud Platform Deployment

#### Vercel/Netlify (Serverless)
- Use serverless Redis (Upstash)
- Configure environment variables in platform settings
- Ensure proper function timeout settings

#### AWS/GCP/Azure (Container Services)
- Use managed Redis services
- Configure auto-scaling policies
- Set up proper monitoring and alerting