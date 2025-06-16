# Notification Trigger Library

This module provides utility functions for triggering Novu workflows based on notifications from the Supabase database. It can be used by various consumers including API endpoints, Temporal workers, and other services.

## Overview

The notification trigger system allows you to:
1. Fetch notification data from Supabase
2. Load the associated workflow configuration
3. Trigger the Novu workflow with the notification payload
4. Update the notification status throughout the process

## Functions

### `triggerNotificationById(notificationId: number, enterpriseId: string)`

Triggers a single notification by its database ID.

**Parameters:**
- `notificationId`: The numeric ID of the notification
- `enterpriseId`: The enterprise ID (for validation)

**Returns:** `TriggerResult` object containing:
- `success`: Boolean indicating if the trigger was successful
- `notificationId`: The notification ID
- `transactionId`: The notification's transaction ID (UUID)
- `novuTransactionId`: The Novu transaction ID (if successful)
- `status`: Final notification status
- `error`: Error message (if failed)
- `details`: Additional details including recipient results
- `notification`: The notification data
- `workflow`: The workflow configuration

### `triggerNotificationByUuid(transactionId: string, enterpriseId: string)`

Triggers a notification by its transaction ID (UUID).

**Parameters:**
- `transactionId`: The UUID of the notification
- `enterpriseId`: The enterprise ID (for validation)

**Returns:** `TriggerResult` object

### `triggerNotificationsByIds(notificationIds: number[], enterpriseId: string)`

Triggers multiple notifications by their database IDs.

**Parameters:**
- `notificationIds`: Array of notification IDs
- `enterpriseId`: The enterprise ID

**Returns:** Array of `TriggerResult` objects

### `batchTriggerNotifications(transactionIds: string[], enterpriseId: string, batchSize?: number)`

Batch triggers multiple notifications by UUIDs with concurrency control.

**Parameters:**
- `transactionIds`: Array of notification UUIDs
- `enterpriseId`: The enterprise ID
- `batchSize`: Number of concurrent operations (default: 10)

**Returns:** Array of `TriggerResult` objects

### `triggerPendingNotifications(enterpriseId: string, limit?: number)`

Triggers all pending notifications for an enterprise.

**Parameters:**
- `enterpriseId`: The enterprise ID
- `limit`: Maximum number of notifications to process (default: 100)

**Returns:** Array of `TriggerResult` objects

### `triggerNotificationByCriteria(criteria: Record<string, any>, enterpriseId: string)`

Find and trigger a notification by custom criteria.

**Parameters:**
- `criteria`: Object with field-value pairs to match
- `enterpriseId`: The enterprise ID

**Returns:** `TriggerResult` object

## Status Flow

The notification status is updated throughout the process:
1. `PENDING` → Initial state
2. `PROCESSING` → When trigger starts
3. `SENT` → When successfully triggered
4. `PARTIAL` → When some recipients succeed but not all
5. `FAILED` → When an error occurs

## Multi-Recipient Support

The library handles notifications with multiple recipients:
- Each recipient is triggered individually
- Results are aggregated and reported
- Partial success is supported (some recipients succeed, others fail)
- All Novu transaction IDs are stored in the database

## Error Handling

All functions include comprehensive error handling:
- Database errors are caught and returned in the result
- Failed notifications are automatically marked with `FAILED` status
- Error messages are stored in the notification's `error_details` field
- Detailed logging is provided for debugging

## Usage Examples

### API Route Usage

```typescript
// app/api/trigger/route.ts
import { triggerNotificationByUuid } from '@/lib/notifications';

export async function POST(request: Request) {
  const { transactionId, enterpriseId } = await request.json();
  
  const result = await triggerNotificationByUuid(
    transactionId,
    enterpriseId
  );
  
  return Response.json(result);
}
```

### Temporal Worker Usage

```typescript
// temporal/activities/notification.ts
import { batchTriggerNotifications } from '@/lib/notifications';

export async function processNotificationBatch(
  transactionIds: string[],
  enterpriseId: string
) {
  // Process with concurrency limit of 5
  return await batchTriggerNotifications(transactionIds, enterpriseId, 5);
}
```

### Scheduled Job Usage

```typescript
// jobs/process-pending.ts
import { triggerPendingNotifications } from '@/lib/notifications';

export async function processPendingNotifications() {
  const enterprises = await getActiveEnterprises();
  
  for (const enterprise of enterprises) {
    const results = await triggerPendingNotifications(
      enterprise.id,
      50 // Process 50 at a time
    );
    
    console.log(`Processed ${results.length} notifications for ${enterprise.id}`);
  }
}
```

## Environment Variables

The library requires the following environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key
- `NOVU_SECRET_KEY`: Novu API secret key