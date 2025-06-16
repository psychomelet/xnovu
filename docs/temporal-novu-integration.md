# Temporal-Novu Integration

This document describes the integration between the Temporal worker and Novu notification system.

## Overview

The integration allows Temporal workers to trigger notifications by:
1. Reading notification records from the database (outbox pattern)
2. Fetching the complete notification data including workflow configuration
3. Triggering the appropriate Novu workflow
4. Updating the notification status

## Implementation

### Core Function: `triggerNotificationByUuid`

Location: `/lib/notifications/trigger.ts`

```typescript
export async function triggerNotificationByUuid(
  transactionId: string
): Promise<TriggerResult>
```

This function:
- Accepts a notification UUID (transaction_id field)
- Fetches the notification and its associated workflow from Supabase
- Validates the notification is published (publish_status = 'PUBLISH')
- Updates status to PROCESSING
- Triggers Novu for each recipient
- Updates final status to SENT/FAILED
- Stores Novu transaction IDs in error_details field

### Batch Processing: `batchTriggerNotifications`

For efficiency, multiple notifications can be processed in parallel:

```typescript
export async function batchTriggerNotifications(
  transactionIds: string[],
  batchSize?: number
): Promise<TriggerResult[]>
```

## Database Schema

The integration uses these key tables:
- `ent_notification` - Stores notification instances with payload and recipients
- `ent_notification_workflow` - Workflow definitions with workflow_key for Novu

Key fields:
- `transaction_id` (UUID) - Unique identifier for the notification
- `notification_status` - PENDING → PROCESSING → SENT/FAILED
- `publish_status` - Must be 'PUBLISH' for notification to be triggered
- `recipients` - Array of UUIDs that map to Novu subscriber IDs
- `payload` - JSON data passed to the Novu workflow
- `channels` - Updated with workflow's default_channels after processing
- `error_details` - Stores Novu transaction IDs and processing results

## Configuration

Required environment variables:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-key
NOVU_SECRET_KEY=your-novu-secret-key
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
```

## Usage Example

```typescript
// In your Temporal activity
import { triggerNotificationByUuid } from '@/lib/notifications';

export async function processNotification(
  transactionId: string
): Promise<void> {
  const result = await triggerNotificationByUuid(transactionId);
  
  if (!result.success) {
    throw new Error(`Failed to process notification: ${result.error}`);
  }
  
  console.log(`Notification sent: ${result.novuTransactionId}`);
}
```

## Status Flow

1. **PENDING** - Initial state when notification is created
2. **PROCESSING** - Set when worker starts processing
3. **SENT** - Successfully sent to all recipients
4. **FAILED** - Complete or partial failure

Note: Notifications must have `publish_status = 'PUBLISH'` to be processed. Other statuses (DRAFT, DISCARD, NONE, DELETED) will be rejected.

## Error Handling

The function includes comprehensive error handling:
- Database connection errors
- Novu API errors
- Per-recipient failure tracking
- Automatic status updates on failure

## Performance Considerations

- Batch processing supports configurable concurrency (default: 10)
- Each notification can have multiple recipients processed in parallel
- Status updates are atomic to prevent race conditions