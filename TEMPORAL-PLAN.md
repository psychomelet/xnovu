# Temporal Migration Plan for XNovu

## Executive Summary

This document outlines a comprehensive plan to refactor XNovu's notification system from the current BullMQ/daemon-based architecture to Temporal workflows. The migration will reduce code complexity by ~60%, improve reliability, and provide better observability while maintaining all existing functionality.

## Current Architecture Analysis

### Core Components

1. **Daemon System** (~1,500 lines)
   - `DaemonManager`: Orchestrates all services
   - `HealthMonitor`: HTTP health endpoints and monitoring
   - Manual state management and error recovery

2. **Realtime Subscription** 
   - `EnhancedSubscriptionManager`: Monitors Supabase realtime events
   - Recently refactored to use single shared subscription
   - Manual reconnection logic and retry handling

3. **Queue System**
   - BullMQ with Redis backend
   - Two queues: `notification-processing` and `rule-execution`
   - Custom retry and error handling logic

4. **Scheduling System**
   - `CronManager`: Handles cron-based rules
   - `ScheduledNotificationManager`: Time-based notifications
   - Polling patterns with manual state tracking

5. **Worker System**
   - `WorkerManager`: Process orchestration
   - Job processing with concurrency control
   - Manual lifecycle management

### Current Flow

```
Supabase Realtime Event
    ↓
EnhancedSubscriptionManager (polls & filters)
    ↓
BullMQ Queue (Redis)
    ↓
Worker Process
    ↓
Novu Trigger API
```

### Pain Points

1. **Manual State Management**: ~400 lines of state tracking code
2. **Error Handling**: 200+ try-catch blocks across services
3. **Reconnection Logic**: Duplicated across multiple services
4. **Monitoring**: Custom health check implementation
5. **Coordination**: Complex startup/shutdown sequences

## Temporal Architecture Design

### Core Workflows

#### 1. Master Orchestration Workflow
```typescript
@workflow
export async function notificationOrchestrationWorkflow(
  config: OrchestrationConfig
): Promise<void> {
  // Long-running workflow that coordinates all notification processing
  const { enterpriseIds, monitoringInterval } = config;

  // Start child workflows for each subsystem
  const realtimeHandle = await startChild(realtimeMonitoringWorkflow, {
    workflowId: `realtime-monitor-${Date.now()}`,
    args: [{ enterpriseIds }],
  });

  const cronHandle = await startChild(cronSchedulingWorkflow, {
    workflowId: `cron-scheduler-${Date.now()}`,
    args: [{ interval: '1 minute' }],
  });

  // Monitor health and coordinate
  await Promise.race([
    realtimeHandle,
    cronHandle,
    waitForHealthCheck(),
  ]);
}
```

#### 2. Realtime Monitoring Workflow
```typescript
@workflow
export async function realtimeMonitoringWorkflow(
  config: RealtimeConfig
): Promise<void> {
  // Replaces EnhancedSubscriptionManager
  let lastProcessedTimestamp = Date.now();

  // Continuous monitoring with automatic recovery
  while (true) {
    try {
      const notifications = await pollSupabaseNotifications({
        enterpriseIds: config.enterpriseIds,
        since: lastProcessedTimestamp,
      });

      for (const notification of notifications) {
        await startChild(notificationProcessingWorkflow, {
          workflowId: `process-${notification.id}`,
          args: [notification],
        });
      }

      lastProcessedTimestamp = Date.now();
      await sleep('30 seconds');
    } catch (error) {
      // Temporal handles retries automatically
      await handleRealtimeError(error);
    }
  }
}
```

#### 3. Notification Processing Workflow
```typescript
@workflow
export async function notificationProcessingWorkflow(
  notification: NotificationData
): Promise<ProcessingResult> {
  // Core business logic with built-in error handling
  
  // Validate notification
  const validation = await validateNotification(notification);
  if (!validation.isValid) {
    return { status: 'invalid', reason: validation.reason };
  }

  // Fetch workflow configuration
  const workflowConfig = await fetchWorkflowConfig(
    notification.workflowId
  );

  // Process based on type
  if (workflowConfig.type === 'dynamic') {
    const templates = await fetchTemplates(workflowConfig.id);
    const rendered = await renderTemplates(templates, notification);
    await triggerNovuWorkflow(rendered);
  } else {
    await triggerStaticWorkflow(workflowConfig.key, notification);
  }

  // Record completion
  await recordNotificationProcessed(notification.id);
  
  return { status: 'completed', processedAt: Date.now() };
}
```

#### 4. Scheduling Workflows
```typescript
@workflow
export async function cronSchedulingWorkflow(
  config: CronConfig
): Promise<void> {
  // Replaces CronManager
  while (true) {
    const activeRules = await fetchActiveCronRules();
    
    for (const rule of activeRules) {
      if (await shouldExecuteRule(rule)) {
        await startChild(executeCronRuleWorkflow, {
          workflowId: `cron-${rule.id}-${Date.now()}`,
          args: [rule],
        });
      }
    }
    
    await sleep(config.interval);
  }
}

@workflow
export async function scheduledNotificationWorkflow(
  config: ScheduledConfig
): Promise<void> {
  // Handle one-time scheduled notifications
  await sleep(config.scheduledFor - Date.now());
  await executeScheduledNotification(config.notificationId);
}
```

### Activity Definitions

```typescript
// Supabase Activities
export const supabaseActivities = {
  pollSupabaseNotifications: async (
    config: PollConfig
  ): Promise<Notification[]> => {
    // Implementation moves here from SubscriptionManager
  },
  
  fetchWorkflowConfig: async (
    workflowId: string
  ): Promise<WorkflowConfig> => {
    // Database query logic
  },
};

// Novu Activities  
export const novuActivities = {
  triggerNovuWorkflow: async (
    params: NovuTriggerParams
  ): Promise<TriggerResult> => {
    // Novu API integration
  },
  
  triggerStaticWorkflow: async (
    key: string,
    data: any
  ): Promise<TriggerResult> => {
    // Static workflow triggering
  },
};

// Template Activities
export const templateActivities = {
  fetchTemplates: async (
    workflowId: string
  ): Promise<Template[]> => {
    // Template fetching logic
  },
  
  renderTemplates: async (
    templates: Template[],
    data: any
  ): Promise<RenderedContent> => {
    // Template rendering logic
  },
};
```

### Error Handling Strategy

```typescript
// Declarative retry policies replace manual retry loops
export const activityOptions = {
  supabaseActivities: {
    retry: {
      initialInterval: '1s',
      backoffCoefficient: 2,
      maximumAttempts: 10,
      maximumInterval: '5m',
      nonRetryableErrorTypes: ['ValidationError'],
    },
  },
  novuActivities: {
    retry: {
      initialInterval: '2s',
      backoffCoefficient: 2,
      maximumAttempts: 5,
      nonRetryableErrorTypes: ['InvalidWorkflowError'],
    },
  },
};
```

## Migration Strategy

### Phase 1: Infrastructure Setup (Week 1-2)

1. **Temporal Integration**
   - Add Temporal SDK dependencies
   - Configure Temporal client
   - Set up worker configuration
   - Create workflow and activity registrations

2. **Development Environment**
   - Update docker-compose with Temporal
   - Configure Temporal namespace
   - Set up Temporal UI access
   - Create development workflows

3. **Monitoring Integration**
   - Configure Temporal metrics
   - Set up workflow visibility
   - Create alerting rules
   - Dashboard creation

### Phase 2: Core Workflows (Week 3-4)

1. **Notification Processing Workflow**
   - Port business logic from WorkerManager
   - Implement activity functions
   - Add retry policies
   - Unit testing

2. **Realtime Monitoring Workflow**
   - Replace subscription polling logic
   - Implement child workflow spawning
   - Add error recovery
   - Integration testing

### Phase 3: Parallel Running (Week 5-6)

1. **Shadow Mode**
   - Run Temporal workflows alongside existing system
   - Compare outputs for validation
   - Monitor performance metrics
   - Gradual traffic shifting

2. **Feature Parity Testing**
   - Verify all notification types
   - Test error scenarios
   - Validate retry behavior
   - Performance benchmarking

### Phase 4: Migration Execution (Week 7-8)

1. **Queue Migration**
   - Stop new BullMQ job creation
   - Process remaining queue items
   - Switch to Temporal workflows
   - Remove Redis dependency

2. **Scheduler Migration**
   - Migrate cron rules to workflows
   - Convert scheduled notifications
   - Verify scheduling accuracy
   - Remove old scheduler code

### Phase 5: Cleanup & Optimization (Week 9-10)

1. **Code Removal**
   - Remove daemon infrastructure
   - Delete queue management code
   - Remove manual retry logic
   - Clean up health monitoring

2. **Documentation & Training**
   - Update technical documentation
   - Create runbooks
   - Team training sessions
   - Knowledge transfer

## Risk Mitigation

### Technical Risks

1. **Data Consistency**
   - Risk: Duplicate processing during migration
   - Mitigation: Idempotency keys, exactly-once semantics

2. **Performance Impact**
   - Risk: Temporal overhead affects latency
   - Mitigation: Performance testing, workflow optimization

3. **Integration Complexity**
   - Risk: Unexpected Supabase/Novu interactions
   - Mitigation: Comprehensive integration testing

### Operational Risks

1. **Rollback Strategy**
   - Maintain feature flags for quick rollback
   - Keep old system operational during migration
   - Gradual traffic shifting

2. **Monitoring Gaps**
   - Risk: Loss of visibility during transition
   - Mitigation: Dual monitoring, comprehensive dashboards

## Success Metrics

### Code Quality
- **Lines of Code**: 60% reduction (1,500 → 600)
- **Cyclomatic Complexity**: 70% reduction
- **Test Coverage**: Maintain >80%

### Operational Metrics
- **Error Rate**: <0.1% failed workflows
- **Processing Latency**: P99 <1s
- **Recovery Time**: <30s for transient failures

### Business Metrics
- **Notification Delivery**: 99.9% success rate
- **Processing Throughput**: No degradation
- **System Availability**: 99.95% uptime

## Configuration Examples

### Temporal Worker Configuration
```typescript
// worker.config.ts
export const workerConfig = {
  namespace: 'xnovu-prod',
  taskQueue: 'notification-processing',
  workflowsPath: require.resolve('./workflows'),
  activities: {
    ...supabaseActivities,
    ...novuActivities,
    ...templateActivities,
  },
  maxConcurrentActivityExecutions: 100,
  maxConcurrentWorkflowExecutions: 50,
};
```

### Workflow Client Configuration
```typescript
// client.config.ts
export const temporalClient = new WorkflowClient({
  namespace: 'xnovu-prod',
  connection: await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS,
  }),
});

// Starting the master workflow
await temporalClient.start(notificationOrchestrationWorkflow, {
  workflowId: 'xnovu-orchestrator',
  taskQueue: 'notification-processing',
  args: [{
    enterpriseIds: config.enterpriseIds,
    monitoringInterval: '30s',
  }],
  workflowIdReusePolicy: 'WORKFLOW_ID_REUSE_POLICY_ALLOW_DUPLICATE',
});
```

## Monitoring & Observability

### Temporal UI Benefits
- Real-time workflow execution visibility
- Historical replay capability
- Error diagnostics with stack traces
- Performance profiling

### Custom Metrics
```typescript
// Temporal automatically provides these metrics:
// - workflow_start_count
// - workflow_completed_count
// - workflow_failed_count
// - activity_execution_latency
// - workflow_execution_latency

// Custom business metrics via activities:
export async function recordNotificationMetrics(
  notification: NotificationData
): Promise<void> {
  metrics.increment('notification.processed', {
    type: notification.type,
    enterprise: notification.enterpriseId,
  });
}
```

## Long-term Benefits

1. **Maintainability**
   - 60% less code to maintain
   - Clear workflow definitions
   - Built-in error handling

2. **Reliability**
   - Automatic retry and recovery
   - Durable execution
   - Exactly-once processing

3. **Developer Experience**
   - Visual debugging with Temporal UI
   - Time-travel debugging
   - Clear execution history

4. **Operational Excellence**
   - No Redis management
   - Simplified deployment
   - Better resource utilization

## Conclusion

Migrating to Temporal will transform XNovu from a complex distributed system with manual state management into a robust, maintainable workflow engine. The investment in migration will pay dividends through reduced operational overhead, improved reliability, and developer productivity.

The phased approach ensures minimal disruption while providing clear rollback points. With the infrastructure team's existing Temporal expertise, this migration represents a natural evolution toward a more sophisticated and reliable notification system.