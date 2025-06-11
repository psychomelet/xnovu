# Rule Engine API Reference

This document provides detailed API reference for the XNovu Rule Engine components.

## RuleEngineService

Main orchestrator service that manages all rule engine components.

### Constructor

```typescript
RuleEngineService.getInstance(config?: RuleEngineConfig): RuleEngineService
```

Creates or returns the singleton instance of the rule engine.

### Methods

#### `initialize(): Promise<void>`
Initializes all rule engine components.

#### `reloadCronRules(enterpriseId?: string): Promise<void>`
Reloads cron rules from database. If `enterpriseId` is provided, only reloads rules for that enterprise.

#### `getStatus(): Promise<SystemStatus>`
Returns comprehensive system status.

```typescript
interface SystemStatus {
  initialized: boolean;
  cronJobs: CronJobStatus[];
  scheduledNotifications: ScheduledManagerStatus;
  queueStats: QueueStats;
  scheduledStats: ScheduledStats;
}
```

#### `pause(): Promise<void>`
Pauses all processing (queues and scheduled manager).

#### `resume(): Promise<void>`
Resumes all processing.

#### `shutdown(): Promise<void>`
Gracefully shuts down all components.

#### `healthCheck(): Promise<HealthStatus>`
Performs health check on all components.

```typescript
interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  details: {
    initialized: boolean;
    cronManager: boolean;
    scheduledManager: boolean;
    queue: boolean;
  };
}
```

## RuleService

Database operations service using Supabase JS SDK.

### Constructor

```typescript
new RuleService(supabaseUrl?: string, supabaseKey?: string)
```

### Methods

#### `getActiveRules(enterpriseId: string): Promise<NotificationRule[]>`
Gets all active rules for an enterprise.

#### `getActiveCronRules(enterpriseId?: string): Promise<NotificationRule[]>`
Gets active cron-based rules. If no `enterpriseId` provided, returns all cron rules.

#### `getRule(ruleId: number, enterpriseId: string): Promise<NotificationRule | null>`
Gets a specific rule by ID.

#### `getScheduledNotifications(beforeTime?: Date): Promise<Notification[]>`
Gets notifications scheduled for execution. If `beforeTime` provided, only returns notifications due before that time.

#### `createNotification(notification: NotificationInsert): Promise<Notification>`
Creates a new notification record.

#### `updateNotificationStatus(notificationId: number, status: NotificationStatus, errorDetails?: any, transactionId?: string): Promise<void>`
Updates notification status with optional error details and transaction ID.

#### `getWorkflow(workflowId: number, enterpriseId: string): Promise<NotificationWorkflow | null>`
Gets workflow configuration by ID.

#### `batchUpdateNotificationStatus(notificationIds: number[], status: NotificationStatus, errorDetails?: any): Promise<void>`
Updates status for multiple notifications in batch.

### Error Handling

All methods throw `RuleEngineError` with the following structure:

```typescript
class RuleEngineError extends Error {
  constructor(
    message: string,
    public code: string,
    public ruleId?: number,
    public enterpriseId?: string
  )
}
```

## NotificationQueue

BullMQ-based queue system for notification processing.

### Constructor

```typescript
new NotificationQueue(config: RuleEngineConfig)
```

### Methods

#### `addNotificationJob(jobData: NotificationJobData, delay?: number): Promise<void>`
Adds a notification processing job to the queue.

```typescript
interface NotificationJobData {
  notificationId: number;
  ruleId?: number;
  enterpriseId: string;
  workflowId: string;
  recipients: string[];
  payload: any;
  overrides?: any;
  scheduledFor?: Date;
}
```

#### `addRuleExecutionJob(jobData: RuleJobData, delay?: number): Promise<void>`
Adds a rule execution job to the queue.

```typescript
interface RuleJobData {
  ruleId: number;
  enterpriseId: string;
  triggerType: TriggerType;
  executionTime: Date;
}
```

#### `getQueueStats(): Promise<{ notification: any; ruleExecution: any; }>`
Returns statistics for both queues.

#### `pauseQueues(): Promise<void>`
Pauses both queues.

#### `resumeQueues(): Promise<void>`
Resumes both queues.

#### `shutdown(): Promise<void>`
Gracefully shuts down all workers and connections.

## CronManager

Manages cron-based rule scheduling.

### Constructor

```typescript
new CronManager(
  ruleService: RuleService,
  notificationQueue: NotificationQueue,
  defaultTimezone: string = 'UTC'
)
```

### Methods

#### `initialize(): Promise<void>`
Loads and schedules all active cron rules.

#### `scheduleRule(rule: NotificationRule): Promise<void>`
Schedules a single cron rule.

#### `unscheduleRule(ruleId: number, enterpriseId: string): Promise<void>`
Unschedules a cron rule.

#### `updateRule(rule: NotificationRule): Promise<void>`
Updates a cron rule (unschedules old, schedules new).

#### `reloadRules(enterpriseId?: string): Promise<void>`
Reloads all cron rules or rules for specific enterprise.

#### `getJobsStatus(): CronJobStatus[]`
Returns status of all scheduled cron jobs.

```typescript
interface CronJobStatus {
  ruleId: number;
  enterpriseId: string;
  cronExpression: string;
  timezone: string;
  isRunning: boolean;
  isScheduled: boolean;
}
```

#### `getNextExecutions(): NextExecutionInfo[]`
Returns next execution times for all jobs.

```typescript
interface NextExecutionInfo {
  ruleId: number;
  enterpriseId: string;
  nextExecution: Date | null;
}
```

#### `shutdown(): Promise<void>`
Stops and destroys all cron jobs.

### Cron Configuration Format

```typescript
interface CronTriggerConfig {
  cron: string;           // Standard cron expression
  timezone?: string;      // IANA timezone identifier
  enabled?: boolean;      // Whether rule is enabled
}
```

### Supported Cron Formats

- **5-field format**: `* * * * *` (minute, hour, day, month, weekday)
- **6-field format**: `* * * * * *` (second, minute, hour, day, month, weekday)

### Examples

```typescript
// Every weekday at 9 AM EST
{
  cron: "0 9 * * 1-5",
  timezone: "America/New_York"
}

// Every 30 minutes
{
  cron: "*/30 * * * *",
  timezone: "UTC"
}

// First day of every month at midnight
{
  cron: "0 0 1 * *",
  timezone: "UTC"
}
```

## ScheduledNotificationManager

Manages time-based scheduled notifications.

### Constructor

```typescript
new ScheduledNotificationManager(
  ruleService: RuleService,
  notificationQueue: NotificationQueue,
  checkInterval: number = 60000,    // Check every minute
  batchSize: number = 100           // Process 100 at a time
)
```

### Methods

#### `start(): void`
Starts the periodic processor.

#### `stop(): void`
Stops the periodic processor.

#### `processScheduledNotifications(): Promise<void>`
Manually trigger processing of scheduled notifications.

#### `scheduleNotification(notificationId: number, scheduleTime: Date): Promise<void>`
Schedule a notification for future delivery.

#### `cancelScheduledNotification(notificationId: number): Promise<void>`
Cancel a scheduled notification.

#### `getScheduledNotificationsStats(): Promise<ScheduledStats>`
Get statistics about scheduled notifications.

```typescript
interface ScheduledStats {
  totalScheduled: number;
  overdue: number;
  upcoming24h: number;
  upcomingWeek: number;
}
```

#### `getStatus(): ScheduledManagerStatus`
Get current status of the manager.

```typescript
interface ScheduledManagerStatus {
  isRunning: boolean;
  isProcessing: boolean;
  checkInterval: number;
  batchSize: number;
}
```

## Type Definitions

### Core Types

```typescript
type TriggerType = 'CRON' | 'SCHEDULE';

type NotificationStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'RETRACTED';

type PublishStatus = 'NONE' | 'DRAFT' | 'DISCARD' | 'PUBLISH' | 'DELETED';

type ChannelType = 'IN_APP' | 'EMAIL' | 'SMS' | 'CHAT' | 'PUSH';
```

### Database Types

```typescript
interface NotificationRule {
  id: number;
  name: string;
  enterprise_id: string;
  notification_workflow_id: number;
  trigger_type: string;
  trigger_config: any;
  rule_payload: any;
  publish_status: PublishStatus;
  deactivated: boolean;
  // ... other fields
}

interface Notification {
  id: number;
  name: string;
  enterprise_id: string;
  notification_rule_id?: number;
  notification_workflow_id?: number;
  notification_status: NotificationStatus;
  channels: ChannelType[];
  recipients: string[];
  payload: any;
  overrides?: any;
  scheduled_for?: string;
  // ... other fields
}
```

### Configuration Types

```typescript
interface RuleEngineConfig {
  redisUrl?: string;
  defaultTimezone: string;
  maxConcurrentJobs: number;
  jobRetryAttempts: number;
  jobRetryDelay: number;
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `DATABASE_ERROR` | Database operation failed |
| `INVALID_CONFIG` | Invalid rule configuration |
| `INVALID_CRON` | Invalid cron expression |
| `INVALID_SCHEDULE` | Invalid schedule time |
| `INVALID_NOTIFICATION` | Invalid notification data |
| `INVALID_SCHEDULE_TIME` | Schedule time is in the past |
| `UNKNOWN_ERROR` | Unexpected error occurred |

## Usage Examples

### Basic Setup

```typescript
import { RuleEngineService, defaultRuleEngineConfig } from '@/app/services';

// Initialize
const ruleEngine = RuleEngineService.getInstance(defaultRuleEngineConfig);
await ruleEngine.initialize();

// Check status
const status = await ruleEngine.getStatus();
console.log(`Rule engine running with ${status.cronJobs.length} cron jobs`);
```

### Creating Rules Programmatically

```typescript
// Using RuleService directly
const ruleService = ruleEngine.ruleService;

const newRule = await ruleService.createNotificationRule({
  name: "Weekly Report",
  trigger_type: "CRON",
  trigger_config: {
    cron: "0 9 * * 1",  // Every Monday at 9 AM
    timezone: "UTC"
  },
  rule_payload: {
    recipients: ["manager@company.com"],
    payload: { reportType: "weekly" }
  },
  enterprise_id: "ent-123",
  notification_workflow_id: 1
});
```

### Manual Rule Reload

```typescript
// Reload all rules
await ruleEngine.reloadCronRules();

// Reload rules for specific enterprise
await ruleEngine.reloadCronRules("ent-123");
```

### Monitoring Queue Performance

```typescript
const stats = await ruleEngine.notificationQueue.getQueueStats();
console.log('Notification queue:', stats.notification);
console.log('Rule execution queue:', stats.ruleExecution);
```