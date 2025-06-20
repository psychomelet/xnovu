# Temporal Async Integration

This document describes the Temporal worker integration for asynchronous notification processing with Novu.

## Overview

The Temporal integration provides asynchronous notification processing through a simplified architecture that separates concerns between temporal execution and database polling. The system allows Temporal workers to trigger notifications by:

1. Reading notification records from the database (outbox pattern)
2. Fetching the complete notification data including workflow configuration
3. Triggering the appropriate Novu workflow asynchronously
4. Updating the notification status
5. Providing reliable async execution with retry and monitoring capabilities

## Architecture

```
lib/
├── temporal/
│   ├── activities/
│   │   ├── index.ts                    # Exports notification-trigger and rule-scheduled activities
│   │   ├── notification-trigger.ts     # Core async trigger functionality
│   │   └── rule-scheduled.ts           # Creates notifications from scheduled rules
│   ├── workflows/
│   │   ├── index.ts                    # Exports notification workflows
│   │   ├── notification-trigger.ts     # Simple trigger workflows
│   │   └── rule-scheduled.ts           # Workflow triggered by Temporal schedules
│   ├── worker/
│   │   ├── index.ts                    # Worker initialization and lifecycle
│   │   └── config.ts                   # Worker configuration
│   ├── client/
│   │   ├── index.ts                    # Temporal client setup
│   │   ├── notification-client.ts      # High-level API for triggering notifications
│   │   └── schedule-client.ts          # Temporal schedule management
│   ├── services/
│   │   └── rule-sync-service.ts        # Syncs notification rules with Temporal schedules
│   ├── namespace.ts                    # Namespace auto-creation
│   └── service.ts                      # Temporal service management
└── polling/
    ├── notification-polling.ts         # Polling service functions
    ├── polling-loop.ts                 # Database polling loop implementation
    └── rule-polling-loop.ts            # Polls for rule changes and syncs schedules
```

## Key Components

### 1. Temporal Activities

- **notification-trigger.ts**: Contains activities for triggering notifications asynchronously
  - `triggerNotificationByIdActivity`: Triggers a single notification
  - `triggerMultipleNotificationsByIdActivity`: Triggers multiple notifications
- **rule-scheduled.ts**: Creates notifications from rules triggered by Temporal schedules
  - `createNotificationFromRule`: Creates a notification entry when a scheduled rule fires

### 2. Temporal Workflows

- **notification-trigger.ts**: Simple workflows that call the trigger activities
  - `notificationTriggerWorkflow`: Workflow for single notification
- **rule-scheduled.ts**: Workflow triggered by Temporal schedules
  - `ruleScheduledWorkflow`: Creates notifications based on scheduled rules
  - `triggerMultipleNotificationsWorkflow`: Workflow for multiple notifications

### 3. Polling Loop (Outside Temporal)

- **polling-loop.ts**: Runs parallel to the Temporal worker
  - Polls database for new/updated notifications
  - Polls for failed notifications that need retry
  - Polls for scheduled notifications
  - Uses Temporal client to trigger workflows when changes detected

## Core Functions

### `triggerNotificationById`

Location: `/lib/notifications/trigger.ts`

```typescript
export async function triggerNotificationById(
  notificationId: number
): Promise<TriggerResult>
```

This function:
- Accepts a notification database ID
- Fetches the notification and its associated workflow from Supabase
- Validates the notification is published (publish_status = 'PUBLISH')
- Updates status to PROCESSING
- Triggers Novu for each recipient
- Updates final status to SENT/FAILED
- Stores Novu transaction IDs (returned by Novu) in error_details field

### Batch Processing: `triggerNotificationsByIds`

For efficiency, multiple notifications can be processed in parallel:

```typescript
export async function triggerNotificationsByIds(
  notificationIds: number[]
): Promise<TriggerResult[]>
```

## Usage

### Starting the Worker

#### Using CLI Commands (Recommended)

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

#### Programmatic Usage

```typescript
import { WorkerManager } from '@/worker/services/WorkerManager'

// Initialize and start worker manager
const workerManager = new WorkerManager({
  healthPort: 3001,
  logLevel: 'info',
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  },
  novu: {
    secretKey: process.env.NOVU_SECRET_KEY!,
  }
})

// Start the worker (includes both Temporal worker and polling loop)
await workerManager.start()
```

### Triggering Notifications Programmatically

```typescript
import { notificationClient } from '@/lib/temporal/client/notification-client'

// Trigger single notification immediately
const { workflowId, runId } = await notificationClient.asyncTriggerNotificationById(123)

// Trigger multiple notifications
const result = await notificationClient.asyncTriggerMultipleNotifications([123, 456, 789])

// Trigger notification with scheduled delay (using Start Delay)
const scheduledResult = await notificationClient.asyncTriggerNotificationById(123, {
  startDelay: '1h 30m'  // Delay notation: combinations of d, h, m, s
})

// Check workflow status
const status = await notificationClient.getWorkflowStatus(workflowId)

// Get workflow result
const triggerResult = await notificationClient.getWorkflowResult(workflowId)
```

### Scheduled Notifications

The system supports scheduled notifications using Temporal's Start Delay feature:

#### API Usage

```typescript
// Trigger notification scheduled for the future via API
const response = await fetch('/api/trigger-async', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    notificationId: 123,
    scheduled_for: '2025-06-18T15:30:00Z'  // ISO 8601 timestamp
  })
})
```

#### Database-driven Scheduling

```sql
-- Create a notification with scheduled_for field
INSERT INTO notify.ent_notification (
  name,
  payload,
  recipients,
  notification_workflow_id,
  scheduled_for,
  notification_status,
  publish_status,
  enterprise_id
) VALUES (
  'Scheduled Building Maintenance',
  '{"buildingId": "bldg-123", "message": "Maintenance scheduled"}',
  ARRAY['user-456'],
  1,
  '2025-06-18T15:30:00Z',  -- Schedule for future
  'PENDING',
  'PUBLISH',
  'ent-789'
);
```

#### Polling Behavior with Scheduling

The polling system intelligently handles scheduled notifications:

1. **Regular Polling**: Only processes notifications where `scheduled_for` is null or in the past
2. **Scheduled Polling**: Dedicated polling loop for scheduled notifications using `pollScheduledNotifications()`
3. **Start Delay Calculation**: Automatically calculates Temporal Start Delay from `scheduled_for` timestamp

```typescript
// Example of how delays are calculated internally
const scheduledFor = new Date('2025-06-18T15:30:00Z')
const now = new Date()
const delayMs = scheduledFor.getTime() - now.getTime()

if (delayMs > 0) {
  // Triggers with Start Delay
  await notificationClient.asyncTriggerNotificationById(123, {
    startDelay: `${delayMs}ms`
  })
} else {
  // Triggers immediately for past/current timestamps
  await notificationClient.asyncTriggerNotificationById(123)
}
```

#### Validation Rules

- **Past Scheduled Times**: Sync triggers (immediate) reject notifications with past `scheduled_for` timestamps
- **Future Scheduled Times**: Async triggers calculate appropriate Start Delay
- **Invalid Formats**: Malformed timestamps are rejected with validation errors

### Usage in Temporal Activity

```typescript
// In your Temporal activity
import { triggerNotificationById } from '@/lib/notifications';

export async function processNotification(
  notificationId: number
): Promise<void> {
  const result = await triggerNotificationById(notificationId);
  
  if (!result.success) {
    throw new Error(`Failed to process notification: ${result.error}`);
  }
  
  console.log(`Notification sent: ${result.novuTransactionId}`);
}
```

## Database Schema

The integration uses these key tables:
- `ent_notification` - Stores notification instances with payload and recipients
- `ent_notification_workflow` - Workflow definitions with workflow_key for Novu

Key fields:
- `id` - Database ID of the notification
- `notification_status` - PENDING → PROCESSING → SENT/FAILED
- `publish_status` - Must be 'PUBLISH' for notification to be triggered
- `recipients` - Array of UUIDs that map to Novu subscriber IDs
- `payload` - JSON data passed to the Novu workflow
- `channels` - Updated with workflow's default_channels after processing
- `error_details` - Stores Novu transaction IDs (returned by Novu) and processing results
- `scheduled_for` - Optional timestamp for future delivery (uses Temporal Start Delay)

## Status Flow

1. **PENDING** - Initial state when notification is created
2. **PROCESSING** - Set when worker starts processing
3. **SENT** - Successfully sent to all recipients
4. **FAILED** - Complete or partial failure

Note: Notifications must have `publish_status = 'PUBLISH'` to be processed. Other statuses (DRAFT, DISCARD, NONE, DELETED) will be rejected.

### Polling Mechanics

The polling system operates outside of Temporal workflows:

1. **Three Independent Polling Loops**:
   - **New Notifications**: Polls for `notification_status = 'PENDING'` records where `scheduled_for` is null or in the past
   - **Failed Notifications**: Retries `notification_status = 'FAILED'` records regardless of scheduling
   - **Scheduled Notifications**: Specifically polls for notifications with `scheduled_for <= now` and `notification_status = 'PENDING'`

2. **Database Queries**: Uses timestamp-based polling with `updated_at` filtering
3. **Batch Processing**: Configurable batch sizes to optimize database load
4. **Temporal Integration**: Uses Temporal client to trigger workflows when changes detected
5. **Scheduling Logic**: Automatically calculates Start Delay for future-scheduled notifications

#### Scheduled Notification Polling

The `NotificationPollingService` provides specialized methods for scheduled notifications:

```typescript
// Poll for notifications that are due for delivery
const dueNotifications = await pollingService.pollScheduledNotifications({
  batchSize: 100
})

// Regular polling excludes future-scheduled notifications
const currentNotifications = await pollingService.pollNotifications({
  batchSize: 100,
  includeProcessed: false  // Only PENDING/FAILED by default
})
```

Key behaviors:
- **Time-based Filtering**: Only returns notifications where `scheduled_for <= now`
- **Status Filtering**: Scheduled polling only includes `PENDING` status notifications
- **Ordering**: Results ordered by `scheduled_for` ascending (earliest first)
- **Integration**: Seamlessly works with Temporal Start Delay for precise timing

## Configuration

### Environment Variables

```bash
# Temporal Configuration
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=xnovu
TEMPORAL_TASK_QUEUE=xnovu-notification-processing
TEMPORAL_MAX_CONCURRENT_ACTIVITIES=100
TEMPORAL_MAX_CONCURRENT_WORKFLOWS=50
TEMPORAL_MAX_CACHED_WORKFLOWS=100

# Polling Configuration
POLL_INTERVAL_MS=10000              # New notification polling interval
FAILED_POLL_INTERVAL_MS=60000       # Failed notification retry interval
SCHEDULED_POLL_INTERVAL_MS=30000    # Scheduled notification check interval
POLL_BATCH_SIZE=100                 # Number of notifications per batch

# Worker Configuration
WORKER_HEALTH_PORT=3001             # Worker health check port
WORKER_LOG_LEVEL=info               # Worker logging level

# Required for Novu integration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NOVU_SECRET_KEY=your-novu-secret-key
DATABASE_URL=your-database-connection-string
```

## Testing

### Direct Connection Test
Use `scripts/test-novu-direct.ts` to verify database and Novu connectivity:
```bash
pnpm exec tsx scripts/test-novu-direct.ts
```

### Notification Test Scripts
Use the test scripts to verify notification processing:
```bash
# Test published notification
pnpm exec tsx scripts/test-yogo-email.ts

# Test unpublished notification rejection
pnpm exec tsx scripts/test-unpublished-notification.ts

# Test scheduled notification functionality
pnpm exec tsx scripts/test-scheduled-notification.ts
```

## Error Handling

The function includes comprehensive error handling:
- Database connection errors
- Novu API errors
- Per-recipient failure tracking
- Automatic status updates on failure
- Temporal retry policies for transient failures
- Dead letter queue for permanent failures

## Performance Considerations

- Batch processing supports configurable concurrency (default: 10)
- Each notification can have multiple recipients processed in parallel
- Status updates are atomic to prevent race conditions
- Independent scaling: Polling and temporal workers can be scaled separately
- Temporal provides built-in retry and backoff strategies

## Rule Scheduling with Temporal Schedules

The system supports CRON-based notification rules that are synchronized with Temporal Schedules:

### How It Works

1. **Rule Definition**: Rules are defined in `ent_notification_rule` table with `trigger_type = 'CRON'`
2. **Schedule Synchronization**: 
   - On worker startup, all active CRON rules are synced to Temporal Schedules
   - A polling loop monitors rule changes and updates schedules accordingly
3. **Schedule Execution**: When a schedule fires, it triggers the `ruleScheduledWorkflow`
4. **Notification Creation**: The workflow creates a notification entry that is picked up by the standard polling loop

### Configuration

```bash
# Rule polling configuration (in .env.worker)
RULE_POLL_INTERVAL_MS=30000            # Check for rule changes every 30 seconds
RULE_POLL_BATCH_SIZE=100               # Process up to 100 rule changes per batch
```

### Rule Schema

Rules must have the following structure:
```json
{
  "trigger_type": "CRON",
  "trigger_config": {
    "cron": "0 9 * * MON",  // Standard cron expression
    "timezone": "UTC"       // Optional, defaults to UTC
  },
  "rule_payload": {
    "recipients": ["user-id-1", "user-id-2"],
    // Additional payload data
  }
}
```

### Schedule Management

- Schedules are automatically created/updated when rules change
- Deactivated or unpublished rules have their schedules paused
- Deleted rules have their schedules removed
- Schedule IDs follow the pattern: `rule-{ruleId}-{enterpriseId}`

## Deployment and Monitoring

### Health Monitoring

The worker provides comprehensive health monitoring through dedicated endpoints:

```bash
# Basic health check
curl http://localhost:3001/health

# Detailed status including polling metrics
curl http://localhost:3001/status

# Performance and processing metrics
curl http://localhost:3001/metrics
```

### Docker Deployment

The worker is designed to run in a separate container from the main application:

```yaml
worker:
  image: xnovu:latest
  command: ["pnpm", "xnovu", "worker", "start"]
  ports:
    - "3001:3001"  # Health check port
  environment:
    - TEMPORAL_ADDRESS=${TEMPORAL_ADDRESS}
    - POLL_INTERVAL_MS=${POLL_INTERVAL_MS:-10000}
    # ... other environment variables
  healthcheck:
    test: ["CMD", "wget", "-q", "--spider", "http://localhost:3001/health"]
```

### Operational Considerations

- **External Dependencies**: Temporal, Supabase, and Novu are expected to be external services
- **No Local Dependencies**: Redis or other queue systems are not required
- **Graceful Shutdown**: Worker handles SIGTERM/SIGINT for graceful shutdowns
- **Auto-Recovery**: Built-in reconnection logic for database and Temporal connections
- **Resource Management**: Configurable concurrency limits for optimal resource usage

## Benefits of Simplified Architecture

1. **Clearer Separation of Concerns**: Temporal handles only async execution, polling is a separate concern
2. **Easier to Understand**: Simple workflow with single responsibility
3. **Independent Scaling**: Polling and temporal workers can be scaled separately
4. **Simpler Testing**: Each component can be tested in isolation
5. **Reduced Complexity**: Fewer temporal activities and workflows to maintain
6. **Reliable Async Processing**: Temporal provides durability, retries, and monitoring
7. **Observability**: Built-in workflow tracking and debugging capabilities
8. **Production Ready**: Comprehensive health monitoring and graceful shutdown handling