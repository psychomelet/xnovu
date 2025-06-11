# Rule Engine Implementation Guide

This document describes the implementation of the Phase 3 Rule Engine for XNovu, providing cron-based and scheduled time-based notification processing.

## Overview

The Rule Engine consists of four main components:

1. **CronManager** - Handles cron-based rule scheduling and execution
2. **ScheduledNotificationManager** - Processes time-based scheduled notifications
3. **NotificationQueue** - BullMQ-based queue system for notification processing
4. **RuleService** - Database operations using Supabase JS SDK

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CronManager   │    │ScheduledNotif   │    │ NotificationQueue│
│                 │    │   Manager       │    │   (BullMQ)      │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ • node-cron     │    │ • Periodic      │    │ • Redis-backed  │
│ • Rule loading  │    │   checking      │    │ • Job processing│
│ • Job creation  │    │ • Batch proc.   │    │ • Retry logic   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   RuleService   │
                    │                 │
                    ├─────────────────┤
                    │ • Supabase SDK  │
                    │ • CRUD ops      │
                    │ • Enterprise    │
                    │   isolation     │
                    └─────────────────┘
```

## Components

### 1. RuleService (`app/services/database/RuleService.ts`)

Handles all database operations using Supabase JS SDK directly.

#### Key Methods:
- `getActiveRules(enterpriseId)` - Get all active rules for an enterprise
- `getActiveCronRules(enterpriseId?)` - Get cron-based rules
- `getScheduledNotifications(beforeTime?)` - Get scheduled notifications
- `createNotification(notification)` - Create new notification
- `updateNotificationStatus(id, status, errorDetails?, transactionId?)` - Update notification status

#### Enterprise Isolation:
All queries are automatically scoped by `enterprise_id` to ensure data isolation.

### 2. NotificationQueue (`app/services/queue/NotificationQueue.ts`)

BullMQ-based queue system for processing notifications and rule executions.

#### Queues:
- **notification-processing** - Processes individual notifications
- **rule-execution** - Executes rule logic and creates notifications

#### Key Features:
- Redis-backed persistence
- Automatic retries with exponential backoff
- Concurrent job processing
- Job monitoring and statistics

### 3. CronManager (`app/services/scheduler/CronManager.ts`)

Manages cron-based rule scheduling using node-cron.

#### Key Features:
- Dynamic cron job management
- Timezone support
- Rule validation
- Prevents duplicate execution
- Hot-reload capabilities

#### Cron Rule Format:
```json
{
  "trigger_type": "CRON",
  "trigger_config": {
    "cron": "0 9 * * 1-5",
    "timezone": "America/New_York",
    "enabled": true
  },
  "rule_payload": {
    "recipients": ["user-123", "user-456"],
    "payload": {
      "message": "Daily standup reminder",
      "buildingId": "building-789"
    },
    "overrides": {}
  }
}
```

### 4. ScheduledNotificationManager (`app/services/scheduler/ScheduledNotificationManager.ts`)

Processes notifications with `scheduled_for` timestamps.

#### Key Features:
- Periodic checking (configurable interval)
- Batch processing
- Overdue notification handling
- Statistics and monitoring

## Configuration

### Environment Variables

```bash
# Redis connection for BullMQ
REDIS_URL=redis://localhost:6379

# Rule engine settings
RULE_ENGINE_ENABLED=true
RULE_ENGINE_TIMEZONE=UTC
RULE_ENGINE_MAX_CONCURRENT_JOBS=10
RULE_ENGINE_RETRY_ATTEMPTS=3
RULE_ENGINE_RETRY_DELAY=5000

# Scheduled notification processor settings
SCHEDULED_NOTIFICATION_CHECK_INTERVAL=60000
SCHEDULED_NOTIFICATION_BATCH_SIZE=100
```

### Database Schema

#### Required Tables:
- `ent_notification_rule` - Rule definitions
- `ent_notification` - Notification instances
- `ent_notification_workflow` - Workflow configurations

#### Key Fields:
- `trigger_type` - 'CRON' or 'SCHEDULE'
- `trigger_config` - JSON configuration for timing
- `rule_payload` - JSON payload for notifications
- `scheduled_for` - Timestamp for scheduled notifications

## Usage

### Initialization

```typescript
import { RuleEngineService, defaultRuleEngineConfig } from '@/app/services';

// Initialize the rule engine
const ruleEngine = RuleEngineService.getInstance(defaultRuleEngineConfig);
await ruleEngine.initialize();
```

### Creating Cron Rules

```typescript
// Example: Daily reminder at 9 AM EST, weekdays only
const cronRule = {
  name: "Daily Standup Reminder",
  trigger_type: "CRON",
  trigger_config: {
    cron: "0 9 * * 1-5",
    timezone: "America/New_York",
    enabled: true
  },
  rule_payload: {
    recipients: ["user-123", "user-456"],
    payload: {
      message: "Time for daily standup!",
      buildingId: "building-789"
    }
  },
  enterprise_id: "ent-123",
  notification_workflow_id: 1,
  publish_status: "PUBLISH",
  deactivated: false
};
```

### Creating Scheduled Notifications

```typescript
// Example: Maintenance notification scheduled for tomorrow
const scheduledNotification = {
  name: "Scheduled Maintenance",
  scheduled_for: "2024-01-15T14:00:00Z",
  recipients: ["tenant-123", "admin-456"],
  payload: {
    message: "Building maintenance scheduled",
    maintenanceType: "HVAC"
  },
  enterprise_id: "ent-123",
  notification_workflow_id: 2,
  notification_status: "PENDING",
  publish_status: "PUBLISH",
  deactivated: false
};
```

## Monitoring

### System Status

```typescript
const status = await ruleEngine.getStatus();
console.log({
  initialized: status.initialized,
  cronJobs: status.cronJobs.length,
  queueStats: status.queueStats,
  scheduledStats: status.scheduledStats
});
```

### Health Check

```typescript
const health = await ruleEngine.healthCheck();
console.log(health.status); // 'healthy' or 'unhealthy'
```

## Error Handling

### Custom Error Types:
- `RuleEngineError` - General rule engine errors
- `CronValidationError` - Invalid cron expressions
- `ScheduleValidationError` - Invalid schedule times

### Error Recovery:
- Automatic job retries with exponential backoff
- Failed notification status tracking
- Comprehensive error logging

## Security

### Enterprise Isolation:
- All database queries scoped by `enterprise_id`
- Queue jobs include enterprise context
- No cross-enterprise data access

### Input Validation:
- Cron expression validation
- Schedule time validation
- Payload structure validation

## Performance

### Optimization Features:
- Concurrent job processing
- Batch notification processing
- Redis-backed queue persistence
- Connection pooling for database operations

### Recommended Settings:
- Max concurrent jobs: 10-50 (based on system capacity)
- Check interval: 30-60 seconds
- Batch size: 50-200 notifications

## Troubleshooting

### Common Issues:

1. **Cron jobs not executing**
   - Check cron expression validity
   - Verify timezone settings
   - Ensure rule is published and not deactivated

2. **Scheduled notifications not processing**
   - Check `scheduled_for` timestamp format
   - Verify ScheduledNotificationManager is running
   - Check notification status in database

3. **Queue processing failures**
   - Verify Redis connection
   - Check Novu API credentials
   - Review error logs in notification records

### Debug Commands:

```typescript
// Check cron job status
const cronStatus = ruleEngine.cronManager.getJobsStatus();

// Get queue statistics
const queueStats = await ruleEngine.notificationQueue.getQueueStats();

// Check scheduled notification status
const scheduledStatus = ruleEngine.scheduledNotificationManager.getStatus();
```

## Migration from Manual Triggers

### Phase 1: Parallel Operation
- Keep existing manual trigger system
- Add rule engine for new workflows
- Gradually migrate high-volume notifications

### Phase 2: Rule Engine Primary
- Route most notifications through rule engine
- Keep manual triggers for special cases
- Monitor performance and reliability

### Phase 3: Full Migration
- Complete migration to rule engine
- Remove legacy manual trigger code
- Optimize performance based on usage patterns

## Testing

See the test files for comprehensive examples:
- `__tests__/RuleService.test.ts`
- `__tests__/CronManager.test.ts`
- `__tests__/NotificationQueue.test.ts`

## Future Enhancements

### Phase 4 Planned Features:
- Advanced rule conditions and logic
- Template-based payload generation
- A/B testing for notifications
- Advanced analytics and reporting
- Multi-region support