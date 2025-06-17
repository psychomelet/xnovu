# XNovu Architecture

## Overview

XNovu is an internal notification system for smart building management platforms, built on top of Novu.co. It manages notifications for campus/park environments with hundreds of buildings, thousands of people, and devices.

The system uses Temporal.io for workflow orchestration, providing durable execution, automatic retries, and excellent visibility into notification processing.

## Core Architecture

```
┌─────────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Management         │     │     XNovu        │     │    Temporal     │
│  Platform           │────▶│    Worker        │────▶│   Workflows     │
│  (Supabase DB)      │     │                  │     │                 │
└─────────────────────┘     └──────────────────┘     └─────────────────┘
                                     │                         │
                                     ▼                         ▼
                            ┌──────────────────┐     ┌─────────────────┐
                            │   Temporal       │     │     Novu        │
                            │   Worker         │────▶│   Platform      │
                            │  (in worker)     │     │                 │
                            └──────────────────┘     └─────────────────┘
```

## Components

### 1. XNovu Worker

The worker is the core service that:
- Subscribes to Supabase realtime changes
- Starts Temporal workflows for notification processing
- Manages health monitoring and graceful shutdown
- Runs an integrated Temporal worker

**Key Features:**
- Polls all enterprises automatically
- Health check endpoint
- Graceful shutdown handling
- Automatic reconnection for subscriptions

### 2. Temporal Workflows

All asynchronous processing is handled through Temporal workflows:

#### Master Orchestration Workflow
- Coordinates all subsystems
- Manages lifecycle of child workflows
- Handles signals for runtime control
- Provides query interface for state inspection

#### Notification Processing Workflow
- Processes individual notifications (INSERT/UPDATE/DELETE)
- Validates notification data
- Fetches workflow configuration
- Triggers appropriate Novu workflows
- Records processing results

#### Cron Scheduling Workflow
- Executes cron-based notification rules
- Manages periodic notifications
- Handles timezone-aware scheduling

#### Scheduled Notification Workflow
- Polls for due notifications
- Processes time-based notifications
- Handles one-time scheduled events

### 3. Temporal Activities

Reusable business logic implemented as activities:

- **Supabase Activities**: Database queries and updates
- **Novu Activities**: Workflow triggering and management
- **Template Activities**: Dynamic template rendering
- **Metrics Activities**: Performance monitoring and logging

### 4. Next.js Application

The web application provides:
- API endpoints for notification triggering
- Novu bridge endpoint for workflow serving
- In-app notification UI components
- Development studio status checks

## Data Flow

### 1. Realtime Notification Flow

```
1. Management platform inserts notification into Supabase
2. Worker receives realtime event via subscription
3. Worker starts NotificationProcessingWorkflow
4. Workflow validates and enriches notification data
5. Workflow triggers appropriate Novu workflow
6. Novu delivers notification through configured channels
```

### 2. Scheduled Notification Flow

```
1. Scheduled notification stored in database
2. ScheduledNotificationWorkflow polls periodically
3. Due notifications are processed
4. NotificationProcessingWorkflow triggered for each
5. Notifications delivered via Novu
```

### 3. Rule-Based Notification Flow

```
1. Rules defined with cron expressions
2. CronSchedulingWorkflow executes on schedule
3. Rules evaluated against current data
4. Notifications created based on rule conditions
5. Standard notification flow follows
```

## Deployment Architecture

### Development Environment

```yaml
# Local development uses docker-compose for Temporal
docker-compose up -d  # Starts Temporal dev server
pnpm dev             # Starts Next.js app
pnpm xnovu worker    # Starts worker with Temporal worker
```

### Production Environment

```yaml
# Production uses external Temporal cluster
TEMPORAL_ADDRESS=temporal.production.local:7233
TEMPORAL_NAMESPACE=xnovu-prod
TEMPORAL_TASK_QUEUE=xnovu-notification-processing

# Worker automatically processes all enterprises
pnpm xnovu worker start
```

## Configuration

### Environment Variables

```bash
# Temporal Configuration
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=xnovu-notification-processing
TEMPORAL_MAX_CONCURRENT_ACTIVITIES=100
TEMPORAL_MAX_CONCURRENT_WORKFLOWS=50

# Worker Configuration
WORKER_HEALTH_PORT=3001
WORKER_LOG_LEVEL=info

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Novu Configuration
NOVU_SECRET_KEY=your-novu-secret-key
NEXT_PUBLIC_NOVU_APP_ID=your-app-id
```

## Monitoring and Operations

### Health Checks

The worker exposes health endpoints:
- `GET /health` - Overall system health
- `GET /health/details` - Detailed component status

### Temporal UI

Monitor workflows through Temporal UI:
- View running workflows
- Inspect workflow history
- Debug failed workflows
- Monitor worker status

### Logging

Structured logging with levels:
- `error` - Critical errors requiring attention
- `warn` - Warning conditions
- `info` - General information
- `debug` - Detailed debugging information

## Error Handling

### Workflow Retries

Temporal provides automatic retries with exponential backoff:
```typescript
{
  initialInterval: '1s',
  backoffCoefficient: 2,
  maximumInterval: '1m',
  maximumAttempts: 10
}
```

### Activity Retries

Activities have specific retry policies:
```typescript
{
  initialInterval: '1s',
  backoffCoefficient: 2,
  maximumInterval: '30s',
  maximumAttempts: 5,
  nonRetryableErrorTypes: ['ValidationError']
}
```

### Graceful Degradation

- Subscription failures: Automatic reconnection
- Temporal failures: Circuit breaker pattern
- Novu failures: Dead letter queue for retry

## Scaling Considerations

### Horizontal Scaling

- **Workers**: Single instance processes all enterprises
- **Workers**: Temporal workers scale horizontally
- **Activities**: Concurrent execution controlled by configuration

### Performance Tuning

- `TEMPORAL_MAX_CONCURRENT_ACTIVITIES`: Control activity parallelism
- `TEMPORAL_MAX_CONCURRENT_WORKFLOWS`: Limit workflow concurrency
- `SUBSCRIPTION_BATCH_SIZE`: Control notification batch processing

### Resource Management

- Memory: ~256MB per worker instance
- CPU: ~0.5 cores under normal load
- Network: Minimal, mostly Supabase subscriptions
- Storage: Temporal handles workflow state

## Security

### Authentication

- Supabase: Service role key for admin operations
- Novu: Secret key for API authentication
- Temporal: mTLS for production clusters

### Authorization

- All enterprises processed by single worker
- Row-level security in Supabase
- Workflow-level access control in Temporal

### Data Protection

- Sensitive data encrypted at rest
- TLS for all network communication
- Audit logging for compliance

## Best Practices

### Workflow Design

1. Keep workflows focused and simple
2. Use activities for I/O operations
3. Implement proper error handling
4. Use signals for runtime control
5. Add queries for observability

### Activity Implementation

1. Make activities idempotent
2. Keep activities stateless
3. Handle timeouts appropriately
4. Use proper retry policies
5. Log important operations

### Monitoring

1. Set up alerts for failed workflows
2. Monitor worker health metrics
3. Track notification delivery rates
4. Review Temporal UI regularly
5. Analyze performance patterns

## Troubleshooting

### Common Issues

**Workflow Failures**
- Check Temporal UI for error details
- Review activity retry attempts
- Verify external service connectivity

**Subscription Issues**
- Check worker logs for reconnection attempts
- Verify Supabase credentials
- Review network connectivity

**Performance Problems**
- Monitor concurrent workflow/activity limits
- Check Temporal cluster resources
- Review database query performance

### Debug Commands

```bash
# View worker logs
pnpm xnovu worker --log-level debug

# Check Temporal workflow status
temporal workflow describe -w <workflow-id>

# List running workflows
temporal workflow list -q 'ExecutionStatus="Running"'

# Check worker status
temporal task-queue describe -t xnovu-notification-processing
```