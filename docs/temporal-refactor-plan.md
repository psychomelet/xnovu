# XNovu Temporal Refactor Plan

## Executive Summary

This document outlines a comprehensive plan to refactor XNovu from its current architecture (Supabase realtime + BullMQ + cron) to Temporal workflows. The refactor will improve reliability, simplify operations, and provide better observability while maintaining all existing functionality.

## Current Architecture Analysis

### Core Components

1. **Realtime Subscription System**
   - `SubscriptionManager` / `EnhancedSubscriptionManager`: Monitors Supabase realtime events (INSERT/UPDATE)
   - Single shared subscription for all enterprises (optimization)
   - Internal queue with retry logic and exponential backoff

2. **Queue Processing**
   - `NotificationQueue` / `EnhancedNotificationQueue`: BullMQ-based job processing
   - Two queues: notification-processing and rule-execution
   - Redis-backed with configurable concurrency and retries

3. **Workflow Management**
   - `DynamicWorkflowFactory`: Creates Novu workflows dynamically
   - `WorkflowRegistry` / `WorkflowLoader`: Manages static and dynamic workflows
   - Template rendering for dynamic content

4. **Scheduling Systems**
   - `CronManager`: Handles cron-based rule execution
   - `ScheduledNotificationManager`: Processes scheduled notifications
   - Periodic polling for scheduled tasks

5. **Daemon Architecture**
   - `DaemonManager`: Orchestrates all services
   - Health monitoring and graceful shutdown
   - Single process managing multiple concerns

### Current Flow

```
1. Notification Insert → Supabase Realtime → SubscriptionManager
2. SubscriptionManager → BullMQ Queue (notification-processing)
3. NotificationQueue Worker → Fetch Workflow → Trigger Novu
4. Update notification status (PENDING → PROCESSING → SENT/FAILED)

Parallel flows:
- Cron rules → CronManager → rule-execution queue → Create notification
- Scheduled notifications → ScheduledNotificationManager → notification queue
```

## Temporal Architecture Design

### Workflow Hierarchy

```
1. NotificationOrchestrationWorkflow (Parent)
   ├── RealtimeMonitoringWorkflow (Child - per enterprise)
   ├── CronSchedulingWorkflow (Child - per enterprise)
   └── ScheduledNotificationWorkflow (Child - continuous)

2. NotificationProcessingWorkflow (Core business logic)
   ├── ValidateNotificationActivity
   ├── FetchWorkflowConfigActivity
   ├── RenderTemplateActivity
   ├── TriggerNovuActivity
   └── UpdateNotificationStatusActivity

3. RuleExecutionWorkflow
   ├── EvaluateRuleActivity
   ├── CreateNotificationActivity
   └── TriggerNotificationProcessingWorkflow
```

### Key Workflows

#### 1. NotificationOrchestrationWorkflow (Long-running)
```typescript
interface NotificationOrchestrationInput {
  enterpriseIds: string[];
  config: {
    realtimeEnabled: boolean;
    cronEnabled: boolean;
    scheduledEnabled: boolean;
  };
}

// Responsibilities:
// - Start child workflows for each subsystem
// - Monitor health and restart failed children
// - Handle configuration updates
// - Coordinate graceful shutdown
```

#### 2. RealtimeMonitoringWorkflow (Long-running, per enterprise)
```typescript
interface RealtimeMonitoringInput {
  enterpriseId: string;
  events: ('INSERT' | 'UPDATE')[];
  batchSize: number;
  pollInterval: number;
}

// Responsibilities:
// - Poll Supabase for new notifications (activity with retry)
// - Batch process notifications
// - Start NotificationProcessingWorkflow for each notification
// - Handle backpressure and rate limiting
```

#### 3. NotificationProcessingWorkflow (Transactional)
```typescript
interface NotificationProcessingInput {
  notificationId: number;
  enterpriseId: string;
  retryPolicy?: RetryPolicy;
}

// Responsibilities:
// - Fetch full notification details
// - Validate and process notification
// - Handle all status transitions
// - Implement retry logic with exponential backoff
```

#### 4. CronSchedulingWorkflow (Long-running, per enterprise)
```typescript
interface CronSchedulingInput {
  enterpriseId: string;
  checkInterval: number; // How often to check for rule updates
}

// Responsibilities:
// - Fetch active cron rules
// - Schedule rule executions using Temporal schedules
// - Handle rule updates dynamically
// - Execute RuleExecutionWorkflow at scheduled times
```

#### 5. ScheduledNotificationWorkflow (Long-running)
```typescript
interface ScheduledNotificationInput {
  batchSize: number;
  pollInterval: number;
}

// Responsibilities:
// - Poll for scheduled notifications
// - Start NotificationProcessingWorkflow for due notifications
// - Handle timezone considerations
```

### Key Activities

#### 1. Database Activities
```typescript
// FetchNotificationActivity
interface FetchNotificationInput {
  notificationId: number;
  enterpriseId: string;
}

// UpdateNotificationStatusActivity  
interface UpdateStatusInput {
  notificationId: number;
  enterpriseId: string;
  status: NotificationStatus;
  errorDetails?: any;
  transactionId?: string;
}

// FetchActiveRulesActivity
interface FetchRulesInput {
  enterpriseId: string;
  ruleType: 'CRON' | 'SCHEDULED';
}
```

#### 2. Integration Activities
```typescript
// TriggerNovuActivity
interface TriggerNovuInput {
  workflowId: string;
  recipients: string[];
  payload: any;
  overrides?: any;
}

// PollSupabaseActivity
interface PollSupabaseInput {
  enterpriseId: string;
  lastProcessedId: number;
  events: ('INSERT' | 'UPDATE')[];
  limit: number;
}
```

#### 3. Template Activities
```typescript
// RenderTemplateActivity
interface RenderTemplateInput {
  templateId: string;
  enterpriseId: string;
  data: Record<string, any>;
}
```

## Migration Strategy

### Phase 1: Parallel Implementation (Weeks 1-3)

1. **Set up Temporal infrastructure**
   - Deploy Temporal cluster
   - Create namespaces (xnovu-dev, xnovu-prod)
   - Set up monitoring and observability

2. **Implement core activities**
   - Database operations (notification CRUD)
   - Novu integration
   - Template rendering
   - All activities should be idempotent

3. **Implement NotificationProcessingWorkflow**
   - Core business logic workflow
   - Comprehensive error handling
   - Status tracking

### Phase 2: Realtime Migration (Weeks 4-5)

1. **Replace SubscriptionManager with RealtimeMonitoringWorkflow**
   - Implement polling-based approach initially
   - Add metrics for comparison with current system
   - Run in shadow mode alongside existing system

2. **Migration approach:**
   ```typescript
   // Use feature flags to control routing
   if (useTemporalForRealtime) {
     // Route to Temporal workflow
   } else {
     // Use existing SubscriptionManager
   }
   ```

### Phase 3: Queue Migration (Weeks 6-7)

1. **Replace BullMQ queues with Temporal workflows**
   - Migrate notification-processing queue
   - Migrate rule-execution queue
   - Implement equivalent retry policies

2. **Benefits:**
   - No separate Redis dependency
   - Better visibility into queue state
   - Simplified dead letter queue handling

### Phase 4: Scheduler Migration (Weeks 8-9)

1. **Replace CronManager with CronSchedulingWorkflow**
   - Use Temporal's native scheduling
   - Dynamic schedule updates without restart
   - Better timezone handling

2. **Replace ScheduledNotificationManager**
   - Implement as continuous workflow
   - Improved batching and error handling

### Phase 5: Cutover and Cleanup (Week 10)

1. **Full cutover to Temporal**
   - Remove feature flags
   - Decommission old components
   - Update documentation

2. **Cleanup tasks:**
   - Remove BullMQ dependencies
   - Remove Redis (unless needed elsewhere)
   - Simplify daemon to just start Temporal workflows

## Implementation Details

### Error Handling and Retries

```typescript
// Notification processing retry policy
const notificationRetryPolicy: RetryPolicy = {
  initialInterval: '1s',
  backoffCoefficient: 2,
  maximumInterval: '5m',
  maximumAttempts: 3,
  nonRetryableErrorTypes: ['ValidationError', 'WorkflowNotFound'],
};

// Realtime monitoring retry policy  
const realtimeRetryPolicy: RetryPolicy = {
  initialInterval: '5s',
  backoffCoefficient: 1.5,
  maximumInterval: '1m',
  maximumAttempts: 0, // Infinite retries for long-running
};
```

### State Management

```typescript
// RealtimeMonitoringWorkflow state
interface RealtimeState {
  lastProcessedId: number;
  lastProcessedAt: Date;
  consecutiveErrors: number;
  isHealthy: boolean;
}

// CronSchedulingWorkflow state
interface CronState {
  activeRules: Map<number, CronRule>;
  scheduleHandles: Map<number, ScheduleHandle>;
  lastRuleFetch: Date;
}
```

### Monitoring and Observability

1. **Temporal UI provides:**
   - Workflow execution history
   - Activity failure tracking
   - Queue depth visualization
   - Retry attempt tracking

2. **Custom metrics:**
   ```typescript
   // Activity metrics
   - notification_processing_duration
   - novu_trigger_success_rate
   - template_render_duration
   
   // Workflow metrics
   - active_monitoring_workflows
   - notification_processing_rate
   - rule_execution_count
   ```

3. **Health checks:**
   ```typescript
   interface TemporalHealthCheck {
     checkWorkflowHealth(): Promise<{
       orchestration: WorkflowStatus;
       realtime: Map<string, WorkflowStatus>;
       scheduling: Map<string, WorkflowStatus>;
     }>;
   }
   ```

## Benefits of Temporal Architecture

### 1. Reliability
- **Automatic retries** with sophisticated policies
- **Durable execution** - survives process/server failures
- **Exactly-once semantics** - no duplicate notifications
- **Built-in timeouts** at workflow and activity level

### 2. Simplicity
- **No queue management** - Temporal handles all queueing
- **No cron management** - Native scheduling support
- **Unified error handling** - Consistent across all components
- **Single deployment unit** - Just workers, no daemons

### 3. Observability
- **Full execution history** - Every step is recorded
- **Visual workflow tracking** - See execution in Temporal UI
- **Built-in metrics** - Latency, throughput, error rates
- **Debugging tools** - Replay workflows, inspect state

### 4. Scalability
- **Horizontal scaling** - Add more workers as needed
- **Backpressure handling** - Automatic rate limiting
- **Resource isolation** - Task queues for different workloads
- **Multi-tenancy** - Easy enterprise isolation

### 5. Development Experience
- **Type-safe workflows** - Full TypeScript support
- **Testing utilities** - Time-travel testing
- **Local development** - Run Temporal locally
- **Versioning support** - Safe workflow updates

## Configuration Migration

### Current Configuration
```typescript
// Environment variables
DAEMON_ENTERPRISE_IDS=ent1,ent2,ent3
SUBSCRIPTION_RECONNECT_DELAY=1000
SUBSCRIPTION_MAX_RETRIES=10
REDIS_URL=redis://localhost:6379
```

### Temporal Configuration
```typescript
// Temporal connection config
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=xnovu-prod
TEMPORAL_TASK_QUEUE=xnovu-notifications

// Workflow configuration (stored in Temporal or database)
{
  "realtime": {
    "pollInterval": 5000,
    "batchSize": 100,
    "enabled": true
  },
  "cron": {
    "checkInterval": 60000,
    "enabled": true
  },
  "scheduled": {
    "pollInterval": 30000,
    "batchSize": 50,
    "enabled": true
  }
}
```

## Risk Mitigation

### 1. Performance Risks
- **Mitigation**: Run performance tests comparing current vs Temporal
- **Metrics**: Notification latency, throughput, resource usage

### 2. Migration Risks  
- **Mitigation**: Parallel run with feature flags
- **Rollback**: Keep old system operational during migration

### 3. Operational Risks
- **Mitigation**: Comprehensive monitoring and alerting
- **Training**: Team training on Temporal operations

## Timeline and Milestones

| Week | Milestone | Success Criteria |
|------|-----------|------------------|
| 1-3 | Core Implementation | All activities tested, NotificationProcessingWorkflow working |
| 4-5 | Realtime Migration | Shadow mode showing equivalent performance |
| 6-7 | Queue Migration | All queued jobs processing through Temporal |
| 8-9 | Scheduler Migration | Cron and scheduled notifications working |
| 10 | Cutover | Old system decommissioned, all traffic on Temporal |

## Next Steps

1. **Proof of Concept**: Implement NotificationProcessingWorkflow
2. **Performance Testing**: Benchmark against current system
3. **Team Training**: Temporal workshops and documentation
4. **Infrastructure Setup**: Deploy Temporal cluster
5. **Begin Phase 1**: Start parallel implementation

## Appendix: Code Examples

### Example: NotificationProcessingWorkflow

```typescript
export async function NotificationProcessingWorkflow(
  input: NotificationProcessingInput
): Promise<void> {
  // Update status to PROCESSING
  await updateNotificationStatus({
    notificationId: input.notificationId,
    enterpriseId: input.enterpriseId,
    status: 'PROCESSING',
  });

  try {
    // Fetch full notification details
    const notification = await fetchNotification({
      notificationId: input.notificationId,
      enterpriseId: input.enterpriseId,
    });

    // Fetch workflow configuration
    const workflowConfig = await fetchWorkflowConfig({
      workflowId: notification.notification_workflow_id,
      enterpriseId: input.enterpriseId,
    });

    // Render templates if dynamic workflow
    let processedPayload = notification.payload;
    if (workflowConfig.type === 'DYNAMIC') {
      processedPayload = await renderTemplate({
        templateId: workflowConfig.templateId,
        enterpriseId: input.enterpriseId,
        data: notification.payload,
      });
    }

    // Trigger Novu workflow
    const result = await triggerNovu({
      workflowId: workflowConfig.workflow_key,
      recipients: notification.recipients,
      payload: processedPayload,
      overrides: notification.overrides,
    });

    // Update status to SENT
    await updateNotificationStatus({
      notificationId: input.notificationId,
      enterpriseId: input.enterpriseId,
      status: 'SENT',
      transactionId: result.transactionId,
    });

  } catch (error) {
    // Update status to FAILED
    await updateNotificationStatus({
      notificationId: input.notificationId,
      enterpriseId: input.enterpriseId,
      status: 'FAILED',
      errorDetails: error.message,
    });
    
    throw error; // Let Temporal handle retries
  }
}
```

### Example: RealtimeMonitoringWorkflow

```typescript
export async function RealtimeMonitoringWorkflow(
  input: RealtimeMonitoringInput
): Promise<void> {
  let lastProcessedId = 0;
  
  // Continue until cancelled
  while (true) {
    try {
      // Poll for new notifications
      const notifications = await pollSupabase({
        enterpriseId: input.enterpriseId,
        lastProcessedId,
        events: input.events,
        limit: input.batchSize,
      });

      // Process each notification
      for (const notification of notifications) {
        // Start child workflow for each notification
        await workflow.startChild(NotificationProcessingWorkflow, {
          args: [{
            notificationId: notification.id,
            enterpriseId: input.enterpriseId,
          }],
          workflowId: `notification-${notification.id}`,
          taskQueue: 'xnovu-notifications',
        });

        lastProcessedId = Math.max(lastProcessedId, notification.id);
      }

      // Sleep before next poll
      await workflow.sleep(input.pollInterval);

    } catch (error) {
      // Log error and continue
      await workflow.sleep(input.pollInterval * 2); // Backoff on error
    }
  }
}
```

This refactor plan provides a clear path from the current architecture to a Temporal-based system, maintaining all functionality while improving reliability, observability, and operational simplicity.