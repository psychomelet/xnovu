import type {
  Notification,
  NotificationJobData
} from '@/types/rule-engine';
import { RuleEngineError } from '@/types/rule-engine';
import { RuleService } from '../database/RuleService';
import { NotificationQueue } from '../queue/NotificationQueue';

export class ScheduledNotificationManager {
  private ruleService: RuleService;
  private notificationQueue: NotificationQueue;
  private intervalId: NodeJS.Timeout | null = null;
  private checkInterval: number;
  private batchSize: number;
  private isProcessing = false;

  constructor(
    ruleService: RuleService,
    notificationQueue: NotificationQueue,
    checkInterval = 60000, // Check every minute
    batchSize = 100
  ) {
    this.ruleService = ruleService;
    this.notificationQueue = notificationQueue;
    this.checkInterval = checkInterval;
    this.batchSize = batchSize;
  }

  /**
   * Start the scheduled notification processor
   */
  start(): void {
    if (this.intervalId) {
      console.log('ScheduledNotificationManager is already running');
      return;
    }

    console.log(`Starting ScheduledNotificationManager with ${this.checkInterval}ms interval`);

    this.intervalId = setInterval(() => {
      this.processScheduledNotifications().catch(error => {
        console.error('Error processing scheduled notifications:', error);
      });
    }, this.checkInterval);

    // Process immediately on start
    this.processScheduledNotifications().catch(error => {
      console.error('Error in initial scheduled notification processing:', error);
    });
  }

  /**
   * Stop the scheduled notification processor
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('ScheduledNotificationManager stopped');
    }
  }

  /**
   * Process notifications that are scheduled for now or past due
   */
  async processScheduledNotifications(): Promise<void> {
    if (this.isProcessing) {
      console.log('Already processing scheduled notifications, skipping');
      return;
    }

    try {
      this.isProcessing = true;
      const now = new Date();

      console.log(`Checking for scheduled notifications due before ${now.toISOString()}`);

      // Get scheduled notifications that are due
      const scheduledNotifications = await this.ruleService.getScheduledNotifications(now);

      if (scheduledNotifications.length === 0) {
        console.log('No scheduled notifications found');
        return;
      }

      console.log(`Found ${scheduledNotifications.length} scheduled notifications to process`);

      // Process notifications in batches
      for (let i = 0; i < scheduledNotifications.length; i += this.batchSize) {
        const batch = scheduledNotifications.slice(i, i + this.batchSize);
        await this.processBatch(batch);
      }

      console.log(`Processed ${scheduledNotifications.length} scheduled notifications`);
    } catch (error) {
      console.error('Failed to process scheduled notifications:', error);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a batch of scheduled notifications
   */
  private async processBatch(notifications: Notification[]): Promise<void> {
    const promises = notifications.map(notification => 
      this.processScheduledNotification(notification)
    );

    const results = await Promise.allSettled(promises);

    // Log any failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const notification = notifications[index];
        console.error(
          `Failed to process scheduled notification ${notification.id}:`,
          result.reason
        );
      }
    });
  }

  /**
   * Process a single scheduled notification
   */
  private async processScheduledNotification(notification: Notification): Promise<void> {
    try {
      console.log(`Processing scheduled notification ${notification.id}`);

      // Validate notification has workflow ID
      if (!notification.notification_workflow_id) {
        throw new RuleEngineError(
          `Notification ${notification.id} missing workflow ID`,
          'INVALID_NOTIFICATION',
          undefined,
          notification.enterprise_id!
        );
      }

      // Get workflow information
      const workflow = await this.ruleService.getWorkflow(
        notification.notification_workflow_id,
        notification.enterprise_id!
      );
      
      if (!workflow) {
        throw new RuleEngineError(
          `Workflow ${notification.notification_workflow_id} not found for notification ${notification.id}`,
          'INVALID_NOTIFICATION',
          undefined,
          notification.enterprise_id!
        );
      }

      // Create job data for queue processing
      const jobData: NotificationJobData = {
        notificationId: notification.id,
        ruleId: notification.notification_rule_id || undefined,
        enterpriseId: notification.enterprise_id!,
        workflowId: workflow.workflow_key,
        recipients: notification.recipients,
        payload: notification.payload as any,
        overrides: notification.overrides as any,
      };

      // Add to notification queue for immediate processing
      await this.notificationQueue.addNotificationJob(jobData);

      console.log(`Queued scheduled notification ${notification.id} for processing`);
    } catch (error) {
      console.error(`Failed to process scheduled notification ${notification.id}:`, error);

      // Update notification status to failed
      try {
        await this.ruleService.updateNotificationStatus(
          notification.id,
          'FAILED',
          {
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
            stage: 'scheduled_processing'
          }
        );
      } catch (updateError) {
        console.error(
          `Failed to update notification ${notification.id} status to failed:`,
          updateError
        );
      }

      throw error;
    }
  }

  /**
   * Schedule a notification for future delivery
   */
  async scheduleNotification(
    notificationId: number,
    scheduleTime: Date
  ): Promise<void> {
    try {
      const now = new Date();
      
      if (scheduleTime <= now) {
        throw new RuleEngineError(
          `Schedule time ${scheduleTime.toISOString()} must be in the future`,
          'INVALID_SCHEDULE_TIME'
        );
      }

      console.log(
        `Scheduling notification ${notificationId} for ${scheduleTime.toISOString()}`
      );

      // The notification should already exist in the database with scheduled_for set
      // This method can be used to add it to a queue with a delay if needed
      
      // Calculate delay in milliseconds
      const delayMs = scheduleTime.getTime() - now.getTime();

      // For very long delays (more than 24 hours), we rely on the periodic check
      // For shorter delays, we can add to queue with delay
      if (delayMs <= 24 * 60 * 60 * 1000) { // 24 hours
        // Get notification details to create job
        const notifications = await this.ruleService.getScheduledNotifications();
        const targetNotification = notifications.find(n => n.id === notificationId);

        if (targetNotification && targetNotification.notification_workflow_id) {
          // Get workflow information
          const workflow = await this.ruleService.getWorkflow(
            targetNotification.notification_workflow_id,
            targetNotification.enterprise_id!
          );
          
          if (!workflow) {
            console.error(`Workflow ${targetNotification.notification_workflow_id} not found for notification ${targetNotification.id}`);
            return;
          }

          const jobData: NotificationJobData = {
            notificationId: targetNotification.id,
            ruleId: targetNotification.notification_rule_id || undefined,
            enterpriseId: targetNotification.enterprise_id!,
            workflowId: workflow.workflow_key,
            recipients: targetNotification.recipients,
            payload: targetNotification.payload as any,
            overrides: targetNotification.overrides as any,
            scheduledFor: scheduleTime,
          };

          await this.notificationQueue.addNotificationJob(jobData, delayMs);
        }
      }

      console.log(`Successfully scheduled notification ${notificationId}`);
    } catch (error) {
      console.error(`Failed to schedule notification ${notificationId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel a scheduled notification
   */
  async cancelScheduledNotification(notificationId: number): Promise<void> {
    try {
      console.log(`Cancelling scheduled notification ${notificationId}`);

      // Update notification status to retracted
      await this.ruleService.updateNotificationStatus(
        notificationId,
        'RETRACTED',
        {
          reason: 'Cancelled by user',
          timestamp: new Date().toISOString()
        }
      );

      console.log(`Successfully cancelled notification ${notificationId}`);
    } catch (error) {
      console.error(`Failed to cancel notification ${notificationId}:`, error);
      throw error;
    }
  }

  /**
   * Get statistics about scheduled notifications
   */
  async getScheduledNotificationsStats(): Promise<{
    totalScheduled: number;
    overdue: number;
    upcoming24h: number;
    upcomingWeek: number;
  }> {
    try {
      const now = new Date();
      const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const inWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const [allScheduled, overdue, upcoming24h, upcomingWeek] = await Promise.all([
        this.ruleService.getScheduledNotifications(),
        this.ruleService.getScheduledNotifications(now),
        this.ruleService.getScheduledNotifications(in24Hours),
        this.ruleService.getScheduledNotifications(inWeek),
      ]);

      return {
        totalScheduled: allScheduled.length,
        overdue: overdue.length,
        upcoming24h: upcoming24h.length - overdue.length,
        upcomingWeek: upcomingWeek.length - upcoming24h.length,
      };
    } catch (error) {
      console.error('Failed to get scheduled notifications stats:', error);
      throw error;
    }
  }

  /**
   * Get the current processing status
   */
  getStatus(): {
    isRunning: boolean;
    isProcessing: boolean;
    checkInterval: number;
    batchSize: number;
  } {
    return {
      isRunning: this.intervalId !== null,
      isProcessing: this.isProcessing,
      checkInterval: this.checkInterval,
      batchSize: this.batchSize,
    };
  }
}