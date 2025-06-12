# XNovu Dynamic Workflow System - Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the XNovu Dynamic Workflow System in production environments, including configuration, monitoring, and operational procedures.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Application Deployment](#application-deployment)
- [Monitoring & Observability](#monitoring--observability)
- [Production Considerations](#production-considerations)
- [Troubleshooting](#troubleshooting)
- [Maintenance Procedures](#maintenance-procedures)

## Prerequisites

### System Requirements

- **Node.js**: Version 18.0.0 or higher
- **pnpm**: Version 8.0.0 or higher
- **PostgreSQL**: Version 14.0 or higher (via Supabase)
- **Memory**: Minimum 2GB RAM for production
- **Storage**: 10GB minimum for application and logs

### External Services

- **Supabase**: PostgreSQL database with real-time subscriptions
- **Novu**: Cloud or self-hosted notification infrastructure
- **Redis** (optional): For enhanced caching and session management

### Network Requirements

- **Outbound HTTPS (443)**: For Novu API calls
- **Outbound HTTPS (443)**: For Supabase connections
- **Inbound HTTP/HTTPS**: For API endpoints
- **WebSocket**: For Supabase real-time subscriptions

## Environment Configuration

### Required Environment Variables

Create a `.env.local` file (or configure in your deployment platform):

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Novu Configuration
NOVU_SECRET_KEY=your-novu-secret-key
NEXT_PUBLIC_NOVU_SUBSCRIBER_ID=default-subscriber-id
NOVU_API_URL=https://api.novu.co  # or your self-hosted URL

# Application Configuration
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.com
LOG_LEVEL=info

# Optional: Redis for enhanced caching
REDIS_URL=redis://localhost:6379

# Optional: Monitoring
SENTRY_DSN=your-sentry-dsn
NEW_RELIC_LICENSE_KEY=your-newrelic-key
```

### Environment-Specific Configurations

#### Development
```bash
NODE_ENV=development
LOG_LEVEL=debug
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

#### Staging
```bash
NODE_ENV=staging
LOG_LEVEL=info
NEXT_PUBLIC_APP_URL=https://staging.your-domain.com
```

#### Production
```bash
NODE_ENV=production
LOG_LEVEL=warn
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## Database Setup

### Supabase Configuration

1. **Create Supabase Project**
   ```bash
   # Initialize Supabase project
   npx supabase init
   npx supabase start
   ```

2. **Apply Database Schema**
   ```bash
   # Generate types from remote database
   pnpm xnovu generate-types
   
   # Apply any pending migrations
   npx supabase db push
   ```

3. **Set Up Row Level Security (RLS)**

   Apply RLS policies for enterprise isolation:

   ```sql
   -- Enable RLS on all notification tables
   ALTER TABLE notify.ent_notification ENABLE ROW LEVEL SECURITY;
   ALTER TABLE notify.ent_notification_workflow ENABLE ROW LEVEL SECURITY;
   ALTER TABLE notify.ent_notification_template ENABLE ROW LEVEL SECURITY;

   -- Create enterprise isolation policies
   CREATE POLICY "Enterprise isolation for notifications" 
   ON notify.ent_notification
   FOR ALL 
   USING (enterprise_id = current_setting('app.current_enterprise_id')::text);

   CREATE POLICY "Enterprise isolation for workflows" 
   ON notify.ent_notification_workflow
   FOR ALL 
   USING (enterprise_id = current_setting('app.current_enterprise_id')::text);

   CREATE POLICY "Enterprise isolation for templates" 
   ON notify.ent_notification_template
   FOR ALL 
   USING (enterprise_id = current_setting('app.current_enterprise_id')::text);
   ```

4. **Create Database Indexes**

   ```sql
   -- Performance indexes for common queries
   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_enterprise_status 
   ON notify.ent_notification(enterprise_id, notification_status);

   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_workflow_enterprise 
   ON notify.ent_notification_workflow(enterprise_id, publish_status) 
   WHERE deactivated = false;

   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_template_enterprise_publish 
   ON notify.ent_notification_template(enterprise_id, publish_status) 
   WHERE deactivated = false;

   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_created_at 
   ON notify.ent_notification(created_at DESC);
   ```

### Database Monitoring

Set up monitoring for database performance:

```sql
-- Create monitoring views
CREATE OR REPLACE VIEW notify.v_workflow_stats AS
SELECT 
  enterprise_id,
  workflow_type,
  COUNT(*) as workflow_count,
  COUNT(*) FILTER (WHERE publish_status = 'PUBLISH') as published_count
FROM notify.ent_notification_workflow 
WHERE deactivated = false
GROUP BY enterprise_id, workflow_type;

CREATE OR REPLACE VIEW notify.v_notification_stats AS
SELECT 
  enterprise_id,
  notification_status,
  COUNT(*) as notification_count,
  DATE_TRUNC('hour', created_at) as hour_bucket
FROM notify.ent_notification 
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY enterprise_id, notification_status, hour_bucket;
```

## Application Deployment

### Docker Deployment

1. **Create Dockerfile**

   ```dockerfile
   FROM node:18-alpine AS base

   # Install dependencies only when needed
   FROM base AS deps
   RUN apk add --no-cache libc6-compat
   WORKDIR /app

   # Install dependencies based on the preferred package manager
   COPY package.json pnpm-lock.yaml* ./
   RUN npm install -g pnpm && pnpm install --frozen-lockfile

   # Rebuild the source code only when needed
   FROM base AS builder
   WORKDIR /app
   COPY --from=deps /app/node_modules ./node_modules
   COPY . .

   # Generate Supabase types
   RUN npm install -g pnpm && pnpm xnovu generate-types

   # Build application
   ENV NEXT_TELEMETRY_DISABLED 1
   RUN pnpm build

   # Production image, copy all the files and run next
   FROM base AS runner
   WORKDIR /app

   ENV NODE_ENV production
   ENV NEXT_TELEMETRY_DISABLED 1

   RUN addgroup --system --gid 1001 nodejs
   RUN adduser --system --uid 1001 nextjs

   COPY --from=builder /app/public ./public
   COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
   COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

   USER nextjs

   EXPOSE 3000

   ENV PORT 3000

   CMD ["node", "server.js"]
   ```

2. **Docker Compose Setup**

   ```yaml
   version: '3.8'
   services:
     xnovu:
       build: .
       ports:
         - "3000:3000"
       environment:
         - NODE_ENV=production
         - NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
         - NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
         - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
         - NOVU_SECRET_KEY=${NOVU_SECRET_KEY}
         - NEXT_PUBLIC_NOVU_SUBSCRIBER_ID=${NOVU_SUBSCRIBER_ID}
       volumes:
         - ./logs:/app/logs
       restart: unless-stopped
       healthcheck:
         test: ["CMD", "curl", "-f", "http://localhost:3000/api/dev-studio-status"]
         interval: 30s
         timeout: 10s
         retries: 3
         start_period: 40s

     redis:
       image: redis:7-alpine
       ports:
         - "6379:6379"
       volumes:
         - redis_data:/data
       restart: unless-stopped

   volumes:
     redis_data:
   ```

### Kubernetes Deployment

1. **Deployment YAML**

   ```yaml
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: xnovu-deployment
     namespace: default
   spec:
     replicas: 3
     selector:
       matchLabels:
         app: xnovu
     template:
       metadata:
         labels:
           app: xnovu
       spec:
         containers:
         - name: xnovu
           image: your-registry/xnovu:latest
           ports:
           - containerPort: 3000
           env:
           - name: NODE_ENV
             value: "production"
           - name: NEXT_PUBLIC_SUPABASE_URL
             valueFrom:
               secretKeyRef:
                 name: xnovu-secrets
                 key: supabase-url
           - name: SUPABASE_SERVICE_ROLE_KEY
             valueFrom:
               secretKeyRef:
                 name: xnovu-secrets
                 key: supabase-service-key
           - name: NOVU_SECRET_KEY
             valueFrom:
               secretKeyRef:
                 name: xnovu-secrets
                 key: novu-secret-key
           resources:
             requests:
               memory: "512Mi"
               cpu: "250m"
             limits:
               memory: "1Gi"
               cpu: "500m"
           livenessProbe:
             httpGet:
               path: /api/dev-studio-status
               port: 3000
             initialDelaySeconds: 30
             periodSeconds: 10
           readinessProbe:
             httpGet:
               path: /api/dev-studio-status
               port: 3000
             initialDelaySeconds: 5
             periodSeconds: 5
   ---
   apiVersion: v1
   kind: Service
   metadata:
     name: xnovu-service
   spec:
     selector:
       app: xnovu
     ports:
     - protocol: TCP
       port: 80
       targetPort: 3000
     type: LoadBalancer
   ```

2. **ConfigMap and Secrets**

   ```yaml
   apiVersion: v1
   kind: Secret
   metadata:
     name: xnovu-secrets
   type: Opaque
   data:
     supabase-url: <base64-encoded-url>
     supabase-service-key: <base64-encoded-key>
     novu-secret-key: <base64-encoded-key>
   ---
   apiVersion: v1
   kind: ConfigMap
   metadata:
     name: xnovu-config
   data:
     LOG_LEVEL: "info"
     NODE_ENV: "production"
   ```

### Vercel Deployment

1. **Deploy to Vercel**

   ```bash
   # Install Vercel CLI
   npm install -g vercel

   # Deploy to Vercel
   vercel --prod
   ```

2. **Environment Variables**

   Configure in Vercel dashboard or via CLI:

   ```bash
   vercel env add NEXT_PUBLIC_SUPABASE_URL
   vercel env add SUPABASE_SERVICE_ROLE_KEY
   vercel env add NOVU_SECRET_KEY
   ```

3. **Vercel Configuration**

   Create `vercel.json`:

   ```json
   {
     "functions": {
       "app/api/**/*.ts": {
         "maxDuration": 30
       }
     },
     "env": {
       "NODE_ENV": "production"
     }
   }
   ```

## Monitoring & Observability

### Application Monitoring

1. **Health Check Endpoints**

   ```typescript
   // app/api/health/route.ts
   export async function GET() {
     const checks = {
       database: await checkDatabase(),
       novu: await checkNovu(),
       workflows: await checkWorkflows(),
       timestamp: new Date().toISOString()
     };

     const healthy = Object.values(checks).every(check => 
       typeof check === 'boolean' ? check : check.status === 'ok'
     );

     return Response.json(checks, { 
       status: healthy ? 200 : 500 
     });
   }
   ```

2. **Metrics Collection**

   ```typescript
   // lib/metrics.ts
   import { workflowRegistry } from '@/app/services/workflow';

   export function collectMetrics() {
     return {
       workflows: workflowRegistry.getStats(),
       uptime: process.uptime(),
       memory: process.memoryUsage(),
       timestamp: Date.now()
     };
   }
   ```

3. **Logging Configuration**

   ```typescript
   // lib/logger.ts
   import winston from 'winston';

   const logger = winston.createLogger({
     level: process.env.LOG_LEVEL || 'info',
     format: winston.format.json(),
     transports: [
       new winston.transports.Console(),
       new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
       new winston.transports.File({ filename: 'logs/combined.log' })
     ]
   });

   export default logger;
   ```

### Performance Monitoring

1. **APM Integration (New Relic)**

   ```typescript
   // next.config.mjs
   import newrelic from 'newrelic';

   /** @type {import('next').NextConfig} */
   const nextConfig = {
     experimental: {
       instrumentationHook: true,
     },
   };

   export default nextConfig;
   ```

2. **Database Performance**

   Monitor slow queries:

   ```sql
   -- Enable query logging in PostgreSQL
   ALTER SYSTEM SET log_min_duration_statement = 1000;
   SELECT pg_reload_conf();

   -- Monitor active connections
   SELECT count(*) FROM pg_stat_activity 
   WHERE state = 'active';
   ```

3. **Custom Metrics**

   ```typescript
   // lib/telemetry.ts
   export class TelemetryService {
     static trackWorkflowExecution(workflowKey: string, duration: number, status: string) {
       // Send to your monitoring service
       console.log(`Workflow ${workflowKey} executed in ${duration}ms with status ${status}`);
     }

     static trackTemplateRender(templateId: number, duration: number) {
       console.log(`Template ${templateId} rendered in ${duration}ms`);
     }
   }
   ```

### Alerting

1. **Health Check Monitoring**

   ```yaml
   # Prometheus alerting rules
   groups:
   - name: xnovu
     rules:
     - alert: XNovuDown
       expr: up{job="xnovu"} == 0
       for: 5m
       labels:
         severity: critical
       annotations:
         summary: "XNovu service is down"

     - alert: HighErrorRate
       expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
       for: 2m
       labels:
         severity: warning
       annotations:
         summary: "High error rate detected"
   ```

2. **Database Alerts**

   ```sql
   -- Monitor notification processing backlog
   SELECT COUNT(*) FROM notify.ent_notification 
   WHERE notification_status = 'PENDING' 
   AND created_at < NOW() - INTERVAL '5 minutes';
   ```

## Production Considerations

### Security

1. **Environment Security**
   - Use secrets management (AWS Secrets Manager, Azure Key Vault)
   - Rotate API keys regularly
   - Enable HTTPS only
   - Implement rate limiting

2. **Database Security**
   - Enable RLS policies
   - Use connection pooling
   - Regular security updates
   - Monitor for suspicious activity

3. **API Security**
   ```typescript
   // middleware.ts
   import { NextRequest, NextResponse } from 'next/server';

   export function middleware(request: NextRequest) {
     // Rate limiting
     const ip = request.ip ?? '127.0.0.1';
     // Implement rate limiting logic

     // CORS headers
     const response = NextResponse.next();
     response.headers.set('Access-Control-Allow-Origin', 'https://your-domain.com');
     
     return response;
   }
   ```

### Scalability

1. **Horizontal Scaling**
   - Use load balancers
   - Stateless application design
   - Database connection pooling
   - Cache shared data in Redis

2. **Workflow Registry Scaling**
   ```typescript
   // Use Redis for distributed workflow registry
   class DistributedWorkflowRegistry extends WorkflowRegistry {
     private redis = new Redis(process.env.REDIS_URL);

     async loadEnterpriseWorkflows(enterpriseId: string) {
       const cached = await this.redis.get(`workflows:${enterpriseId}`);
       if (cached) {
         // Load from cache
         return JSON.parse(cached);
       }
       
       // Load from database and cache
       const workflows = await super.loadEnterpriseWorkflows(enterpriseId);
       await this.redis.setex(`workflows:${enterpriseId}`, 300, JSON.stringify(workflows));
       return workflows;
     }
   }
   ```

3. **Database Optimization**
   ```sql
   -- Configure connection pooling
   ALTER SYSTEM SET max_connections = 200;
   ALTER SYSTEM SET shared_buffers = '256MB';
   ALTER SYSTEM SET effective_cache_size = '1GB';
   ```

### Backup and Recovery

1. **Database Backups**
   ```bash
   # Automated Supabase backups are handled by the platform
   # For additional backups:
   pg_dump -h your-host -U postgres -d postgres > backup.sql
   ```

2. **Application State**
   - Workflow registry state is recoverable from database
   - Template cache can be rebuilt
   - No persistent application state to backup

3. **Disaster Recovery Plan**
   - Document recovery procedures
   - Test recovery scenarios regularly
   - Maintain off-site backups
   - Have rollback procedures ready

## Troubleshooting

### Common Issues

1. **Workflow Not Loading**
   ```bash
   # Check workflow registry
   curl http://localhost:3000/api/trigger \
     -H "Content-Type: application/json" \
     -d '{"workflowId": "test", "enterpriseId": "test"}'

   # Check database connectivity
   npx supabase status
   ```

2. **Template Rendering Failures**
   ```typescript
   // Enable debug logging
   process.env.LOG_LEVEL = 'debug';
   
   // Check template cache
   const renderer = getTemplateRenderer();
   const stats = renderer.getCacheStats();
   console.log('Template cache stats:', stats);
   ```

3. **Database Connection Issues**
   ```bash
   # Test database connection
   psql "postgresql://user:pass@host:port/db" -c "SELECT 1;"
   
   # Check connection pool
   SELECT count(*) FROM pg_stat_activity;
   ```

### Debug Mode

Enable debug mode for detailed logging:

```bash
export LOG_LEVEL=debug
export DEBUG=xnovu:*
npm run dev
```

### Performance Issues

1. **Slow Database Queries**
   ```sql
   -- Identify slow queries
   SELECT query, mean_time, calls 
   FROM pg_stat_statements 
   ORDER BY mean_time DESC 
   LIMIT 10;
   ```

2. **Memory Leaks**
   ```bash
   # Monitor memory usage
   node --inspect --max-old-space-size=4096 server.js
   ```

3. **Template Cache Issues**
   ```typescript
   // Clear template cache
   const renderer = getTemplateRenderer();
   renderer.clearCache();
   ```

## Maintenance Procedures

### Regular Tasks

1. **Daily**
   - Monitor application health
   - Check error logs
   - Verify notification processing

2. **Weekly**
   - Review performance metrics
   - Clean up old notifications
   - Update documentation

3. **Monthly**
   - Security updates
   - Dependency updates
   - Performance optimization

### Update Procedures

1. **Application Updates**
   ```bash
   # Zero-downtime deployment
   docker build -t xnovu:new .
   docker tag xnovu:new xnovu:latest
   kubectl rollout restart deployment/xnovu-deployment
   ```

2. **Database Migrations**
   ```bash
   # Apply migrations
   npx supabase db push
   
   # Verify migration
   npx supabase db diff
   ```

3. **Configuration Updates**
   ```bash
   # Update environment variables
   kubectl patch secret xnovu-secrets -p='{"data":{"key":"value"}}'
   kubectl rollout restart deployment/xnovu-deployment
   ```

### Monitoring Commands

```bash
# Check application status
curl -f http://localhost:3000/api/health

# Monitor logs
kubectl logs -f deployment/xnovu-deployment

# Database status
npx supabase status

# Performance metrics
curl http://localhost:3000/api/metrics
```

This deployment guide ensures a robust, scalable, and maintainable production deployment of the XNovu Dynamic Workflow System.