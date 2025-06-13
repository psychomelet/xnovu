import { Context } from '@temporalio/activity'
import { NotificationPollingService, PollingOptions } from '@/app/services/database/NotificationPollingService'
import { createSupabaseAdmin } from '@/lib/supabase/client'
import { logger } from '@/app/services/logger'
import { Database } from '@/lib/supabase/database.types'

type NotificationRow = Database['notify']['Tables']['ent_notification']['Row']

// Singleton polling service instance
let pollingService: NotificationPollingService | null = null

function getPollingService(): NotificationPollingService {
  if (!pollingService) {
    const supabase = createSupabaseAdmin()
    pollingService = new NotificationPollingService(supabase)
  }
  return pollingService
}

/**
 * Poll for new or updated notifications
 */
export async function pollNotifications(options: PollingOptions = {}): Promise<NotificationRow[]> {
  const ctx = Context.current()
  const service = getPollingService()
  
  try {
    logger.info('Starting notification polling', {
      activityId: ctx.info.activityId,
      workflowId: ctx.info.workflowExecution.workflowId,
      options
    })

    const notifications = await service.pollNotifications(options)

    logger.info('Notification polling completed', {
      activityId: ctx.info.activityId,
      count: notifications.length
    })

    return notifications
  } catch (error) {
    logger.error('Notification polling failed', {
      activityId: ctx.info.activityId,
      error: error instanceof Error ? error.message : 'Unknown error',
      options
    })
    throw error
  }
}

/**
 * Poll for failed notifications that need retry
 */
export async function pollFailedNotifications(options: PollingOptions = {}): Promise<NotificationRow[]> {
  const ctx = Context.current()
  const service = getPollingService()
  
  try {
    logger.info('Polling for failed notifications', {
      activityId: ctx.info.activityId,
      options
    })

    const notifications = await service.pollFailedNotifications(options)

    logger.info('Failed notification polling completed', {
      activityId: ctx.info.activityId,
      count: notifications.length
    })

    return notifications
  } catch (error) {
    logger.error('Failed notification polling error', {
      activityId: ctx.info.activityId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    throw error
  }
}

/**
 * Poll for scheduled notifications that are due
 */
export async function pollScheduledNotifications(options: PollingOptions = {}): Promise<NotificationRow[]> {
  const ctx = Context.current()
  const service = getPollingService()
  
  try {
    logger.info('Polling for scheduled notifications', {
      activityId: ctx.info.activityId,
      options
    })

    const notifications = await service.pollScheduledNotifications(options)

    logger.info('Scheduled notification polling completed', {
      activityId: ctx.info.activityId,
      count: notifications.length
    })

    return notifications
  } catch (error) {
    logger.error('Scheduled notification polling error', {
      activityId: ctx.info.activityId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    throw error
  }
}

/**
 * Update notification status after processing (polling-specific)
 */
export async function updatePollingNotificationStatus(
  notificationId: number,
  status: Database['shared_types']['Enums']['notification_status'],
  errorDetails?: any
): Promise<void> {
  const ctx = Context.current()
  const service = getPollingService()
  
  try {
    logger.info('Updating notification status', {
      activityId: ctx.info.activityId,
      notificationId,
      status
    })

    await service.updateNotificationStatus(notificationId, status, errorDetails)

    logger.info('Notification status updated', {
      activityId: ctx.info.activityId,
      notificationId,
      status
    })
  } catch (error) {
    logger.error('Failed to update notification status', {
      activityId: ctx.info.activityId,
      notificationId,
      status,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    throw error
  }
}

/**
 * Reset polling timestamp
 */
export async function resetPollingTimestamp(timestamp?: string): Promise<void> {
  const ctx = Context.current()
  const service = getPollingService()
  
  try {
    const resetDate = timestamp ? new Date(timestamp) : undefined
    service.resetPollTimestamp(resetDate)

    logger.info('Polling timestamp reset', {
      activityId: ctx.info.activityId,
      timestamp: resetDate?.toISOString() || 'null'
    })
  } catch (error) {
    logger.error('Failed to reset polling timestamp', {
      activityId: ctx.info.activityId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    throw error
  }
}

/**
 * Get current polling state
 */
export async function getPollingState(): Promise<{ lastPollTimestamp: string | null; isInitialized: boolean }> {
  const ctx = Context.current()
  const service = getPollingService()
  
  try {
    const state = service.getPollingState()
    
    logger.info('Retrieved polling state', {
      activityId: ctx.info.activityId,
      state
    })

    return state
  } catch (error) {
    logger.error('Failed to get polling state', {
      activityId: ctx.info.activityId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    throw error
  }
}