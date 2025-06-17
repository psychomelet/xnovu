/**
 * Notification Trigger Functions
 * 
 * This module provides functions to trigger Novu workflows for notifications.
 * It can be used by various consumers including API endpoints, Temporal workers, etc.
 */

import { createClient } from '@supabase/supabase-js';
import { Novu } from '@novu/api';
import type { Database } from '@/lib/supabase/database.types';
import { getTemplateRenderer } from '@/app/services/template/TemplateRenderer';

type NotificationRow = Database['notify']['Tables']['ent_notification']['Row'];
type NotificationWorkflowRow = Database['notify']['Tables']['ent_notification_workflow']['Row'];
type NotificationStatus = Database['shared_types']['Enums']['notification_status'];
type PublishStatus = 'NONE' | 'DRAFT' | 'DISCARD' | 'PUBLISH' | 'DELETED';
type ChannelType = Database['shared_types']['Enums']['notification_channel_type'];

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
 * @returns Result object with success status and details
 */
export async function triggerNotificationById(
  notificationId: number
): Promise<TriggerResult> {
  const startTime = Date.now();
  
  try {
    // Fetch the notification with its workflow
    logger.info('Fetching notification from database', { 
      notificationId 
    });
    
    const { data: notification, error: fetchError } = await supabase
      .schema('notify')
      .from('ent_notification')
      .select(`
        *,
        ent_notification_workflow!inner(*)
      `)
      .eq('id', notificationId)
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

    // Check if notification is published
    if (notification.publish_status !== 'PUBLISH') {
      logger.warn('Notification is not published', {
        notificationId,
        publishStatus: notification.publish_status
      });
      return {
        success: false,
        error: `Notification is not published (status: ${notification.publish_status})`,
        notification: notification as NotificationRow
      };
    }

    // Check if notification is scheduled for future
    if (notification.scheduled_for) {
      const scheduledTime = new Date(notification.scheduled_for);
      const now = new Date();
      if (scheduledTime > now) {
        logger.warn('Notification is scheduled for future', {
          notificationId,
          scheduledFor: notification.scheduled_for,
          currentTime: now.toISOString()
        });
        return {
          success: false,
          error: `Notification scheduled for ${scheduledTime.toISOString()}. Current time: ${now.toISOString()}`,
          notificationId,
          status: 'SCHEDULED' as NotificationStatus,
          notification: notification as NotificationRow
        };
      }
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
      notification.overrides,
      notification.enterprise_id || undefined // Convert null to undefined
    );

    const successCount = recipientResults.filter(r => r.success).length;
    const allSuccessful = successCount === recipientResults.length;
    const hasPartialSuccess = successCount > 0 && successCount < recipientResults.length;

    // Collect all transaction IDs
    const transactionIds = recipientResults
      .filter(r => r.success && r.transactionId)
      .map(r => r.transactionId!);

    // Determine actual channels used (from workflow default_channels)
    const channels = workflow.default_channels as ChannelType[] || [];

    // Update notification status based on results
    const updateData: any = {
      notification_status: allSuccessful ? 'SENT' : 'FAILED',
      processed_at: new Date().toISOString(),
      channels: channels
    };

    // Store transaction IDs and results in error_details (used for both success and failure)
    const resultDetails: any = {
      novu_transaction_ids: transactionIds,
      results: recipientResults,
      successCount,
      totalRecipients: recipientResults.length,
      timestamp: new Date().toISOString()
    };

    // Always store the details for tracking
    updateData.error_details = resultDetails;

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
      transactionId: notification.transaction_id || undefined,
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
 * Trigger multiple notifications by their IDs
 * 
 * @param notificationIds - Array of notification IDs
 * @returns Array of results for each notification
 */
export async function triggerNotificationsByIds(
  notificationIds: number[]
): Promise<TriggerResult[]> {
  const results = await Promise.all(
    notificationIds.map(id => triggerNotificationById(id))
  );
  return results;
}


/**
 * Trigger all pending notifications
 * 
 * @param limit - Maximum number of notifications to process (default: 100)
 * @returns Array of results
 */
export async function triggerPendingNotifications(
  limit: number = 100
): Promise<TriggerResult[]> {
  try {
    // Fetch pending notifications that are published
    const { data: notifications, error } = await supabase
      .schema('notify')
      .from('ent_notification')
      .select('id')
      .eq('notification_status', 'PENDING')
      .eq('publish_status', 'PUBLISH')
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
        triggerNotificationById(notification.id)
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
 * @returns Result object with success status and details
 */
export async function triggerNotificationByCriteria(
  criteria: Record<string, any>
): Promise<TriggerResult> {
  try {
    // Build query
    let query = supabase
      .schema('notify')
      .from('ent_notification')
      .select('id');

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
    return triggerNotificationById(notification.id);
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
  overrides?: any,
  enterpriseId?: string
): Promise<RecipientResult[]> {
  // Check if we need to render templates
  let processedOverrides = overrides || {};
  
  if (enterpriseId && overrides) {
    try {
      processedOverrides = await renderTemplatesInOverrides(overrides, payload, enterpriseId);
    } catch (error) {
      logger.error('Failed to render templates in overrides', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        enterpriseId 
      });
      // Continue with original overrides if template rendering fails
    }
  }

  const novuPromises = recipients.map(async (recipientId) => {
    try {
      const result = await novu.trigger({
        workflowId,
        to: recipientId,
        payload: payload as any,
        overrides: processedOverrides as any
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

/**
 * Render templates found in notification overrides
 * Detects template tags and processes them with TemplateRenderer
 */
export async function renderTemplatesInOverrides(
  overrides: any,
  payload: any,
  enterpriseId: string
): Promise<any> {
  // Handle null/undefined overrides
  if (!overrides) {
    return overrides;
  }
  
  const templateRenderer = getTemplateRenderer();
  const processedOverrides = JSON.parse(JSON.stringify(overrides)); // Deep clone
  
  // Function to recursively process template strings
  const processTemplateString = async (value: any): Promise<any> => {
    if (typeof value === 'string') {
      // Check if the string contains template syntax
      if (value.includes('{{') && value.includes('}}')) {
        try {
          // Render the template with payload as variables
          const rendered = await templateRenderer.render(value, {
            enterpriseId,
            variables: payload
          });
          return rendered;
        } catch (error) {
          logger.warn('Template rendering failed, using original value', {
            error: error instanceof Error ? error.message : 'Unknown error',
            template: value.substring(0, 100) // Log first 100 chars
          });
          return value;
        }
      }
    } else if (Array.isArray(value)) {
      // Process arrays recursively
      return Promise.all(value.map(item => processTemplateString(item)));
    } else if (value && typeof value === 'object') {
      // Process objects recursively
      const processed: any = {};
      for (const [key, val] of Object.entries(value)) {
        processed[key] = await processTemplateString(val);
      }
      return processed;
    }
    
    return value;
  };
  
  // Process the entire overrides object
  return processTemplateString(processedOverrides);
}

