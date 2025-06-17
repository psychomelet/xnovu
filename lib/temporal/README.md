# Temporal Worker - Simplified Architecture

## Overview

The Temporal worker has been simplified to focus solely on asynchronous notification triggering. The polling logic has been moved outside of Temporal's scope to provide clearer separation of concerns.

## Architecture

```
lib/
├── temporal/
│   ├── activities/
│   │   ├── index.ts                    # Exports notification-trigger activity
│   │   └── notification-trigger.ts     # Core async trigger functionality
│   ├── workflows/
│   │   ├── index.ts                    # Exports notification workflows
│   │   └── notification-trigger.ts     # Simple trigger workflows
│   ├── worker/
│   │   ├── index.ts                    # Worker initialization and lifecycle
│   │   └── config.ts                   # Worker configuration
│   ├── client/
│   │   ├── index.ts                    # Temporal client setup
│   │   └── notification-client.ts      # High-level API for triggering notifications
│   ├── namespace.ts                    # Namespace auto-creation
│   └── service.ts                      # Temporal service management
└── polling/
    ├── notification-polling.ts         # Polling service functions
    └── polling-loop.ts                 # Database polling loop implementation
```

## Key Components

### 1. Temporal Activities

- **notification-trigger.ts**: Contains activities for triggering notifications asynchronously
  - `triggerNotificationByIdActivity`: Triggers a single notification
  - `triggerMultipleNotificationsByIdActivity`: Triggers multiple notifications

### 2. Temporal Workflows

- **notification-trigger.ts**: Simple workflows that call the trigger activities
  - `notificationTriggerWorkflow`: Workflow for single notification
  - `triggerMultipleNotificationsWorkflow`: Workflow for multiple notifications

### 3. Polling Loop (Outside Temporal)

- **polling-loop.ts**: Runs parallel to the Temporal worker
  - Polls database for new/updated notifications
  - Polls for failed notifications that need retry
  - Polls for scheduled notifications
  - Uses Temporal client to trigger workflows when changes detected

## Usage

### Starting the Worker

```typescript
import { startWorker } from '@/lib/temporal/worker'

// Start the worker (includes both Temporal worker and polling loop)
await startWorker()
```

### Triggering Notifications Programmatically

```typescript
import { notificationClient } from '@/lib/temporal/client/notification-client'

// Trigger single notification
const { workflowId, runId } = await notificationClient.asyncTriggerNotificationById(123)

// Trigger multiple notifications
const result = await notificationClient.asyncTriggerMultipleNotifications([123, 456, 789])

// Check workflow status
const status = await notificationClient.getWorkflowStatus(workflowId)

// Get workflow result
const triggerResult = await notificationClient.getWorkflowResult(workflowId)
```

## Configuration

### Environment Variables

```bash
# Temporal Configuration
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=xnovu-notifications

# Polling Configuration
POLL_INTERVAL_MS=10000              # New notification polling interval
FAILED_POLL_INTERVAL_MS=60000       # Failed notification retry interval
SCHEDULED_POLL_INTERVAL_MS=30000    # Scheduled notification check interval
POLL_BATCH_SIZE=100                 # Number of notifications per batch
```

## Benefits of Simplified Architecture

1. **Clearer Separation of Concerns**: Temporal handles only async execution, polling is a separate concern
2. **Easier to Understand**: Simple workflow with single responsibility
3. **Independent Scaling**: Polling and temporal workers can be scaled separately
4. **Simpler Testing**: Each component can be tested in isolation
5. **Reduced Complexity**: Fewer temporal activities and workflows to maintain