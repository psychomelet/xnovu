/**
 * Notification Trigger Functions
 * 
 * This module provides functions to trigger Novu workflows for notifications.
 * It can be used by various consumers including API endpoints, Temporal workers, etc.
 */

import { createClient } from '@supabase/supabase-js';
import { Novu } from '@novu/api';
import type { Database } from '@/lib/supabase/database.types';

type NotificationRow = Database['notify']['Tables']['ent_notification']['Row'];
type NotificationWorkflowRow = Database['notify']['Tables']['ent_notification_workflow']['Row'];
type NotificationStatus = Database['shared_types']['Enums']['notification_status'];

// Initialize clients
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const novuSecretKey = process.env.NOVU_SECRET_KEY!;

const supabase = createClient<Database>(supabaseUrl, supabaseKey);
const novu = new Novu({ secretKey: novuSecretKey });

// Simple logger
const logger = {
  info: (message: string, data?: any) => console.log(`[INFO] ${message}`, data ? JSON.stringify(data) : ''),
  error: (message: string, data?: any) => console.error(`[ERROR] ${message}`, data ? JSON.stringify(data) : ''),
  warn: (message: string, data?: any) => console.warn(`[WARN] ${message}`, data ? JSON.stringify(data) : '')
};

export interface TriggerResult {
  success: boolean;
  notificationId?: number;
  transactionId?: string;
  novuTransactionId?: string;
  status?: NotificationStatus;
  error?: string;
  details?: any;
  notification?: NotificationRow;
  workflow?: NotificationWorkflowRow;
}

export interface RecipientResult {
  recipientId: string;
  success: boolean;
  transactionId?: string;
  error?: string;
}

/**
 * Trigger a notification by its database ID
 * 
 * @param notificationId - The numeric ID of the notification
 * @param enterpriseId - The enterprise ID (for validation)
 * @returns Result object with success status and details
 */
export async function triggerNotificationById(
  notificationId: number,
  enterpriseId: string
): Promise<TriggerResult> {
  const startTime = Date.now();
  
  try {
    // Fetch the notification with its workflow
    logger.info('Fetching notification from database', { 
      notificationId, 
      enterpriseId 
    });
    
    const { data: notification, error: fetchError } = await supabase
      .schema('notify')
      .from('ent_notification')
      .select(`
        *,
        ent_notification_workflow!inner(*)
      `)
      .eq('id', notificationId)
      .eq('enterprise_id', enterpriseId)
      .single();

    if (fetchError || !notification) {
      logger.error('Failed to fetch notification', { 
        error: fetchError, 
        notificationId 
      });
      return {
        success: false,
        error: fetchError?.message || 'Notification not found',
        details: fetchError
      };
    }

    // Type assertion for the joined data
    const notificationWithWorkflow = notification as NotificationRow & {
      ent_notification_workflow: NotificationWorkflowRow;
    };

    const workflow = notificationWithWorkflow.ent_notification_workflow;

    // Update status to PROCESSING
    await supabase
      .schema('notify')
      .from('ent_notification')
      .update({ notification_status: 'PROCESSING' })
      .eq('id', notification.id);

    // Trigger Novu workflow for each recipient
    logger.info('Triggering Novu workflow', {
      notificationId: notification.id,
      workflowKey: workflow.workflow_key,
      recipientCount: notification.recipients.length
    });

    const recipientResults = await triggerForRecipients(
      notification.recipients,
      workflow.workflow_key,
      notification.payload,
      notification.overrides
    );

    const successCount = recipientResults.filter(r => r.success).length;
    const allSuccessful = successCount === recipientResults.length;
    const hasPartialSuccess = successCount > 0 && successCount < recipientResults.length;

    // Collect all transaction IDs
    const transactionIds = recipientResults
      .filter(r => r.success && r.transactionId)
      .map(r => r.transactionId!);

    // Update notification status based on results
    const updateData: any = {
      notification_status: allSuccessful ? 'SENT' : (hasPartialSuccess ? 'PARTIAL' : 'FAILED'),
      processed_at: new Date().toISOString()
    };

    if (transactionIds.length > 0) {
      updateData.novu_transaction_ids = transactionIds;
    }

    if (!allSuccessful) {
      updateData.error_details = { 
        results: recipientResults, 
        successCount,
        totalRecipients: recipientResults.length 
      };
    }

    await supabase
      .schema('notify')
      .from('ent_notification')
      .update(updateData)
      .eq('id', notification.id);

    const duration = Date.now() - startTime;
    logger.info('Notification processing completed', {
      notificationId: notification.id,
      status: updateData.notification_status,
      duration,
      successCount,
      totalRecipients: recipientResults.length
    });

    // Return the first successful transaction ID for reference
    const firstSuccess = recipientResults.find(r => r.success);
    
    return {
      success: allSuccessful,
      notificationId: notification.id,
      transactionId: notification.transaction_id,
      novuTransactionId: firstSuccess?.transactionId,
      status: updateData.notification_status,
      notification: notificationWithWorkflow,
      workflow,
      details: {
        successCount,
        totalRecipients: recipientResults.length,
        duration,
        results: recipientResults
      }
    };

  } catch (error: any) {
    logger.error('Unexpected error in triggerNotificationById', {
      error: error.message,
      notificationId,
      stack: error.stack
    });

    // Try to update status to FAILED
    try {
      await supabase
        .schema('notify')
        .from('ent_notification')
        .update({
          notification_status: 'FAILED',
          error_details: { error: error.message, stack: error.stack },
          processed_at: new Date().toISOString()
        })
        .eq('id', notificationId);
    } catch (updateError) {
      logger.error('Failed to update notification status', { 
        error: updateError 
      });
    }

    return {
      success: false,
      error: error.message,
      details: error
    };
  }
}

/**
 * Trigger a notification by its transaction ID (UUID)
 * 
 * @param transactionId - The UUID of the notification
 * @param enterpriseId - The enterprise ID (for validation)
 * @returns Result object with success status and details
 */
export async function triggerNotificationByUuid(
  transactionId: string,
  enterpriseId: string
): Promise<TriggerResult> {
  try {
    // Fetch notification by transaction_id
    const { data: notification, error } = await supabase
      .schema('notify')
      .from('ent_notification')
      .select('id')
      .eq('transaction_id', transactionId)
      .eq('enterprise_id', enterpriseId)
      .single();

    if (error || !notification) {
      return {
        success: false,
        error: error?.message || 'Notification not found with given transaction ID'
      };
    }

    // Delegate to the main function
    return triggerNotificationById(notification.id, enterpriseId);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Trigger multiple notifications by their IDs
 * 
 * @param notificationIds - Array of notification IDs
 * @param enterpriseId - The enterprise ID
 * @returns Array of results for each notification
 */
export async function triggerNotificationsByIds(
  notificationIds: number[],
  enterpriseId: string
): Promise<TriggerResult[]> {
  const results = await Promise.all(
    notificationIds.map(id => triggerNotificationById(id, enterpriseId))
  );
  return results;
}

/**
 * Batch trigger multiple notifications by UUIDs with concurrency control
 * 
 * @param transactionIds - Array of notification UUIDs
 * @param enterpriseId - The enterprise ID
 * @param batchSize - Number of concurrent operations (default: 10)
 * @returns Array of results
 */
export async function batchTriggerNotifications(
  transactionIds: string[],
  enterpriseId: string,
  batchSize: number = 10
): Promise<TriggerResult[]> {
  logger.info('Batch triggering notifications', {
    count: transactionIds.length,
    enterpriseId
  });

  const results: TriggerResult[] = [];

  // Process in batches to control concurrency
  for (let i = 0; i < transactionIds.length; i += batchSize) {
    const batch = transactionIds.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(uuid => triggerNotificationByUuid(uuid, enterpriseId))
    );
    results.push(...batchResults);
  }

  const successCount = results.filter(r => r.success).length;
  logger.info('Batch processing completed', {
    total: transactionIds.length,
    successful: successCount,
    failed: transactionIds.length - successCount
  });

  return results;
}

/**
 * Trigger all pending notifications for an enterprise
 * 
 * @param enterpriseId - The enterprise ID
 * @param limit - Maximum number of notifications to process (default: 100)
 * @returns Array of results
 */
export async function triggerPendingNotifications(
  enterpriseId: string,
  limit: number = 100
): Promise<TriggerResult[]> {
  try {
    // Fetch pending notifications
    const { data: notifications, error } = await supabase
      .schema('notify')
      .from('ent_notification')
      .select('id')
      .eq('enterprise_id', enterpriseId)
      .eq('notification_status', 'PENDING')
      .limit(limit);

    if (error || !notifications) {
      return [{
        success: false,
        error: error?.message || 'Failed to fetch pending notifications'
      }];
    }

    // Trigger each notification
    const results = await Promise.all(
      notifications.map(notification => 
        triggerNotificationById(notification.id, enterpriseId)
      )
    );

    return results;
  } catch (error) {
    return [{
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch pending notifications'
    }];
  }
}

/**
 * Find and trigger a notification by custom criteria
 * 
 * @param criteria - Object with field-value pairs to match
 * @param enterpriseId - The enterprise ID
 * @returns Result object with success status and details
 */
export async function triggerNotificationByCriteria(
  criteria: Record<string, any>,
  enterpriseId: string
): Promise<TriggerResult> {
  try {
    // Build query
    let query = supabase
      .schema('notify')
      .from('ent_notification')
      .select('id')
      .eq('enterprise_id', enterpriseId);

    // Add criteria to query
    for (const [field, value] of Object.entries(criteria)) {
      query = query.eq(field, value);
    }

    // Execute query
    const { data: notification, error } = await query.single();

    if (error || !notification) {
      return {
        success: false,
        error: error?.message || 'Notification not found with given criteria'
      };
    }

    // Delegate to the main function
    return triggerNotificationById(notification.id, enterpriseId);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Helper function to trigger Novu workflow for multiple recipients
 */
async function triggerForRecipients(
  recipients: string[],
  workflowId: string,
  payload: any,
  overrides?: any
): Promise<RecipientResult[]> {
  const novuPromises = recipients.map(async (recipientId) => {
    try {
      const result = await novu.trigger({
        workflowId,
        to: recipientId,
        payload: payload as any,
        overrides: overrides as any || {}
      });
      
      return { 
        recipientId, 
        success: true, 
        transactionId: result.result?.transactionId 
      };
    } catch (error: any) {
      logger.error('Failed to trigger for recipient', { 
        recipientId, 
        error: error.message 
      });
      return { 
        recipientId, 
        success: false, 
        error: error.message 
      };
    }
  });

  return Promise.all(novuPromises);
}

// Aliases for backward compatibility
export const triggerNotificationByTransactionId = triggerNotificationByUuid;