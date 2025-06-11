# Realtime Subscription Design

## Overview

The XNovu system uses Supabase Realtime to monitor notification inserts and automatically trigger workflows. This document describes the design and implementation of the realtime subscription system.

## Architecture

```
┌─────────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│   Management        │    │     XNovu            │    │    Novu Cloud/      │
│   Platform          │───▶│   Subscription       │───▶│   Self-hosted       │
│                     │    │    Manager           │    │                     │
└─────────────────────┘    └──────────────────────┘    └─────────────────────┘
         │                           │                           │
         │                           │                           │
         ▼                           ▼                           ▼
┌─────────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│  Supabase Database  │    │   Processing Queue   │    │   Notification      │
│  (notify.ent_       │    │   + Retry Logic      │    │   Delivery          │
│   notification)     │    │                      │    │                     │
└─────────────────────┘    └──────────────────────┘    └─────────────────────┘
```

## Core Components

### 1. SubscriptionManager

**Location:** `app/services/realtime/SubscriptionManager.ts`

The central component that manages Supabase realtime subscriptions and processes notifications.

#### Key Features:
- **Enterprise Isolation**: Each subscription is scoped to a specific enterprise_id
- **Queue-based Processing**: Handles high-volume notifications with configurable concurrency
- **Retry Logic**: Automatic retry with exponential backoff for failed notifications
- **Status Tracking**: Updates notification status throughout the processing lifecycle
- **Error Handling**: Comprehensive error handling and logging

#### Configuration Options:
```typescript
interface SubscriptionConfig {
  enterpriseId: string                    // Enterprise scope
  onNotification?: (notification) => void // Custom notification handler
  onError?: (error: Error) => void        // Custom error handler
  queueConfig?: {
    maxConcurrent?: number     // Max concurrent processing (default: 5)
    retryAttempts?: number     // Max retry attempts (default: 3)
    retryDelay?: number        // Base retry delay in ms (default: 1000)
  }
}
```

### 2. Realtime Subscription Flow

#### Step 1: Database Insert Detection
```sql
-- Trigger occurs when management platform inserts notification
INSERT INTO notify.ent_notification (
  name,
  enterprise_id,
  notification_workflow_id,
  payload,
  recipients,
  channels
) VALUES (...);
```

#### Step 2: Realtime Event Processing
```typescript
// Supabase realtime subscription
supabase
  .channel(`notifications-${enterpriseId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'notify',
    table: 'ent_notification',
    filter: `enterprise_id=eq.${enterpriseId}`
  }, handleNotificationInsert)
```

#### Step 3: Complete Data Retrieval
```typescript
// Fetch complete notification data (realtime payload may be incomplete)
const { data: notification } = await supabase
  .from('ent_notification')
  .select('*')
  .eq('id', notificationId)
  .eq('enterprise_id', enterpriseId)
  .single()
```

#### Step 4: Queue Processing
- Add notification to internal processing queue
- Process notifications with configured concurrency limits
- Update status to 'PROCESSING' before workflow trigger

#### Step 5: Workflow Execution
```typescript
// Get workflow configuration
const { data: workflow } = await supabase
  .from('ent_notification_workflow')
  .select('*')
  .eq('workflow_key', notification.notification_workflow_id)
  .eq('enterprise_id', enterpriseId)

// Trigger Novu workflow
const result = await novu.trigger(workflow.workflow_key, {
  to: notification.recipients.map(id => ({ subscriberId: id })),
  payload: notification.payload,
  overrides: notification.overrides || {},
  tags: notification.tags
})
```

#### Step 6: Status Updates
- **PENDING** → **PROCESSING**: When notification starts processing
- **PROCESSING** → **SENT**: When Novu trigger succeeds
- **PROCESSING** → **FAILED**: When maximum retry attempts reached

## Database Schema Integration

### Notification Status Lifecycle
```
PENDING ────▶ PROCESSING ────▶ SENT
   │              │
   │              ▼
   │           FAILED ◀─── (after max retries)
   │              │
   ▼              ▼
RETRACTED ◀────────────────── (manual cancellation)
```

### Key Database Fields
- `notification_status`: Current processing status
- `transaction_id`: Novu transaction ID for cancellation
- `processed_at`: Timestamp when processing completed
- `error_details`: JSON error information for failed notifications
- `workflow_version`: Version tracking for workflow changes

## Error Handling & Resilience

### 1. Connection Resilience
- Automatic reconnection on subscription failures
- Timeout handling with configurable retry intervals
- Connection status monitoring and logging

### 2. Processing Failures
- Exponential backoff retry strategy
- Maximum retry limit to prevent infinite loops
- Detailed error logging with context

### 3. Data Consistency
- Atomic status updates with enterprise_id filtering
- Transaction isolation for concurrent processing
- Error state recovery mechanisms

## Performance Considerations

### 1. Concurrency Control
```typescript
// Configurable processing limits
const config = {
  queueConfig: {
    maxConcurrent: 10,     // Process up to 10 notifications simultaneously
    retryAttempts: 5,      // Retry failed notifications up to 5 times
    retryDelay: 2000       // Base delay of 2 seconds between retries
  }
}
```

### 2. Queue Management
- In-memory queue for pending notifications
- FIFO processing with priority support (future enhancement)
- Queue length monitoring and alerting

### 3. Memory Management
- Bounded queue size to prevent memory leaks
- Cleanup of completed processing items
- Periodic queue health checks

## Monitoring & Observability

### 1. Status Tracking
```typescript
// Get current subscription status
const status = subscriptionManager.getStatus()
// Returns: { isActive, queueLength, activeProcessing }
```

### 2. Metrics Collection
- Processing throughput (notifications/second)
- Error rates by error type
- Queue depth and processing latency
- Retry attempt distribution

### 3. Logging Strategy
- Structured logging with enterprise_id context
- Error logs with full stack traces
- Processing lifecycle events
- Performance metrics logging

## Security Considerations

### 1. Enterprise Isolation
- All database queries filtered by enterprise_id
- Realtime subscriptions scoped to enterprise
- Error logs sanitized to prevent data leakage

### 2. Access Control
- Supabase RLS (Row Level Security) policies
- API key rotation support
- Audit logging for all operations

### 3. Data Validation
- Schema validation for notification payloads
- Workflow existence verification
- Recipient list validation

## Configuration Examples

### Basic Setup
```typescript
const subscriptionManager = new SubscriptionManager({
  enterpriseId: 'enterprise-123'
})

await subscriptionManager.start()
```

### Advanced Configuration
```typescript
const subscriptionManager = new SubscriptionManager({
  enterpriseId: 'enterprise-123',
  queueConfig: {
    maxConcurrent: 15,
    retryAttempts: 5,
    retryDelay: 1500
  },
  onNotification: async (notification) => {
    // Custom processing logic
    console.log(`Processed notification ${notification.id}`)
  },
  onError: (error) => {
    // Custom error handling
    errorReportingService.report(error)
  }
})

await subscriptionManager.start()
```

## Integration Points

### 1. Management Platform
- Inserts notifications into `notify.ent_notification`
- No direct API calls to XNovu required
- Uses standard Supabase client for database operations

### 2. Novu Integration
- Automatic workflow triggering via Novu Node.js SDK
- Transaction ID tracking for cancellation support
- Payload forwarding with schema validation

### 3. Client Applications
- Real-time status updates via Supabase subscriptions
- Direct database queries for notification history
- No dependency on XNovu internal APIs

## Future Enhancements

### 1. Priority Queues
- Support for priority-based notification processing
- SLA-based queue management
- Deadline-aware scheduling

### 2. Batch Processing
- Bulk notification processing for efficiency
- Digest-style notifications
- Time-window batching

### 3. Advanced Monitoring
- Real-time dashboards for queue health
- Alerting for processing failures
- Performance optimization recommendations

## Troubleshooting

### Common Issues
1. **Subscription Not Starting**: Check Supabase connection and credentials
2. **High Queue Depth**: Increase maxConcurrent or check Novu performance
3. **Failed Notifications**: Review error_details in database
4. **Memory Issues**: Monitor queue size and processing efficiency

### Debug Mode
```typescript
// Enable debug logging
process.env.DEBUG = 'xnovu:subscription'

// Check subscription status
console.log(subscriptionManager.getStatus())

// Manual retry of failed notifications
await subscriptionManager.retryFailedNotifications(50)
```