# Notification Trigger Library

This module provides utility functions for triggering Novu workflows based on notifications from the Supabase database. It can be used by various consumers including API endpoints, Temporal workers, and other services.

## Overview

The notification trigger system allows you to:
1. Fetch notification data from Supabase
2. Load the associated workflow configuration
3. Trigger the Novu workflow with the notification payload
4. Update the notification status throughout the process

## Functions

### `triggerNotificationById(notificationId: number)`

Triggers a single notification by its database ID.

**Parameters:**
- `notificationId`: The numeric ID of the notification

**Returns:** `TriggerResult` object containing:
- `success`: Boolean indicating if the trigger was successful
- `notificationId`: The notification ID
- `novuTransactionId`: The Novu transaction ID returned by Novu (if successful)
- `status`: Final notification status
- `error`: Error message (if failed)
- `details`: Additional details including recipient results
- `notification`: The notification data
- `workflow`: The workflow configuration


### `triggerNotificationsByIds(notificationIds: number[])`

Triggers multiple notifications by their database IDs.

**Parameters:**
- `notificationIds`: Array of notification IDs

**Returns:** Array of `TriggerResult` objects


### `triggerPendingNotifications(limit?: number)`

Triggers all pending notifications.

**Parameters:**
- `limit`: Maximum number of notifications to process (default: 100)

**Returns:** Array of `TriggerResult` objects

### `triggerNotificationByCriteria(criteria: Record<string, any>)`

Find and trigger a notification by custom criteria.

**Parameters:**
- `criteria`: Object with field-value pairs to match

**Returns:** `TriggerResult` object

## Status Flow

The notification status is updated throughout the process:
1. `PENDING` → Initial state
2. `PROCESSING` → When trigger starts
3. `SENT` → When successfully triggered
4. `FAILED` → When an error occurs

## Publish Status Requirement

**Important**: Only notifications with `publish_status = 'PUBLISH'` will be triggered. Notifications in other states (`DRAFT`, `DISCARD`, `NONE`, `DELETED`) will be rejected with an appropriate error message.

## Field Updates

When a notification is processed, the following fields are updated:
- `notification_status`: Updated to reflect the processing result
- `processed_at`: Timestamp when processing completed
- `channels`: Updated with the actual channels used (from workflow's default_channels)
- `error_details`: Contains processing details including:
  - `novu_transaction_ids`: Array of Novu transaction IDs
  - `results`: Detailed results for each recipient
  - `successCount`: Number of successful recipients
  - `totalRecipients`: Total number of recipients
  - `timestamp`: Processing timestamp

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
import { triggerNotificationById } from '@/lib/notifications';

export async function POST(request: Request) {
  const { notificationId } = await request.json();
  
  const result = await triggerNotificationById(
    notificationId
  );
  
  return Response.json(result);
}
```

### Temporal Worker Usage

```typescript
// temporal/activities/notification.ts
import { triggerNotificationsByIds } from '@/lib/notifications';

export async function processNotificationBatch(
  notificationIds: number[]
) {
  // Process multiple notifications
  return await triggerNotificationsByIds(notificationIds);
}
```

### Scheduled Job Usage

```typescript
// jobs/process-pending.ts
import { triggerPendingNotifications } from '@/lib/notifications';

export async function processPendingNotifications() {
  const results = await triggerPendingNotifications(
    50 // Process 50 at a time
  );
  
  console.log(`Processed ${results.length} notifications`);
}
```

## Environment Variables

The library requires the following environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key
- `NOVU_SECRET_KEY`: Novu API secret key