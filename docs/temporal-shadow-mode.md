# Temporal Shadow Mode Documentation

## Overview

Temporal Shadow Mode allows running the new Temporal-based notification processing system alongside the existing BullMQ/daemon architecture. This enables safe testing and gradual migration without disrupting the current system.

## Configuration

### Environment Variables

Add these variables to your `.env` file:

```bash
# Enable Temporal shadow mode
TEMPORAL_SHADOW_MODE=true

# Temporal server configuration
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=xnovu-notification-processing

# Worker configuration
TEMPORAL_MAX_CONCURRENT_ACTIVITIES=100
TEMPORAL_MAX_CONCURRENT_WORKFLOWS=50
TEMPORAL_MAX_CACHED_WORKFLOWS=100

# Shadow mode comparison (optional)
TEMPORAL_COMPARE_RESULTS=true
TEMPORAL_LOG_DISCREPANCIES=true
```

## Getting Started

### 1. Start Temporal Services

```bash
# Start Temporal server, UI, and database
pnpm temporal:start

# View Temporal UI
pnpm temporal:ui

# View logs
pnpm temporal:logs

# Stop services
pnpm temporal:stop
```

### 2. Enable Shadow Mode

Set `TEMPORAL_SHADOW_MODE=true` in your `.env` file, then start the daemon:

```bash
pnpm dev
```

The system will now process notifications through both:
- **Legacy System**: BullMQ queues + daemon workers
- **Temporal System**: Temporal workflows (in shadow mode)

### 3. Monitor Performance

Access monitoring dashboards:
- **Temporal UI**: http://localhost:8080
- **Health Endpoint**: http://localhost:8081/health

The health endpoint now includes Temporal status:

```json
{
  "status": "healthy",
  "components": {
    "subscriptions": { ... },
    "ruleEngine": "healthy",
    "queue": "healthy",
    "temporal": "healthy"
  },
  "temporal_status": {
    "status": "healthy",
    "details": {
      "workflowId": "shadow-orchestration-123456",
      "namespace": "default"
    }
  }
}
```

## Architecture in Shadow Mode

```
┌─────────────────────────────────────────────────────────────┐
│                     Supabase Realtime                       │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ├─────────────────┬─────────────────────┐
                      ▼                 ▼                     ▼
         ┌────────────────────┐ ┌─────────────────┐ ┌─────────────────┐
         │ Legacy System      │ │ Temporal Shadow │ │ Comparison      │
         │ (BullMQ + Workers) │ │ (Workflows)     │ │ & Metrics       │
         └────────────────────┘ └─────────────────┘ └─────────────────┘
                      │                 │                     │
                      └─────────────────┴─────────────────────┘
                                        │
                                        ▼
                                  Novu API
```

## Workflow Structure

### Master Orchestration Workflow
- Coordinates all subsystems
- Manages enterprise configurations
- Handles health monitoring

### Child Workflows
1. **Realtime Monitoring**: Replaces EnhancedSubscriptionManager
2. **Cron Scheduling**: Replaces CronManager
3. **Scheduled Notifications**: Replaces ScheduledNotificationManager
4. **Notification Processing**: Core business logic

## Monitoring & Debugging

### Temporal UI Features
- Real-time workflow execution visibility
- Workflow history and replay
- Error diagnostics with stack traces
- Performance profiling

### Logs
Shadow mode logs are prefixed with `[Temporal Shadow]`:

```
[Temporal Shadow] Starting orchestration workflow...
[Temporal Shadow] Processing 5 notifications
[Temporal Shadow] Workflow completed: process-notification-123
```

### Metrics Comparison
When `TEMPORAL_COMPARE_RESULTS=true`, the system compares results:

```javascript
// Example comparison output
{
  "total": 100,
  "matches": 98,
  "discrepancies": [
    "Notification 123: Legacy(completed) vs Temporal(failed)",
    "Notification 456: Different transaction IDs"
  ]
}
```

## Gradual Migration Strategy

### Phase 1: Shadow Mode (Current)
- Run both systems in parallel
- Compare results
- Monitor performance
- No impact on production

### Phase 2: Canary Deployment
- Route small percentage to Temporal
- Monitor error rates
- Gradual increase

### Phase 3: Full Migration
- Switch all traffic to Temporal
- Keep legacy system as fallback
- Remove legacy code

## Troubleshooting

### Common Issues

1. **Temporal not starting**
   ```bash
   # Check Docker status
   docker-compose ps
   
   # View detailed logs
   docker-compose logs temporal
   ```

2. **Worker connection issues**
   ```bash
   # Verify Temporal is accessible
   curl http://localhost:7233
   
   # Check worker logs
   pnpm dev | grep "Temporal"
   ```

3. **Workflow failures**
   - Check Temporal UI for error details
   - Review workflow history
   - Use replay debugging

### Performance Tuning

Adjust worker configuration based on load:

```env
# For high throughput
TEMPORAL_MAX_CONCURRENT_ACTIVITIES=200
TEMPORAL_MAX_CONCURRENT_WORKFLOWS=100

# For resource-constrained environments
TEMPORAL_MAX_CONCURRENT_ACTIVITIES=50
TEMPORAL_MAX_CONCURRENT_WORKFLOWS=25
```

## Benefits of Shadow Mode

1. **Zero Risk**: No impact on production system
2. **Real Traffic**: Test with actual workloads
3. **Performance Comparison**: Side-by-side metrics
4. **Gradual Migration**: Switch when confident
5. **Easy Rollback**: Disable with single flag

## Next Steps

Once shadow mode validation is complete:

1. Review comparison metrics
2. Address any discrepancies
3. Plan canary deployment
4. Create rollback procedures
5. Document operational runbooks