/**
 * Enhanced Subscription Manager with UPDATE monitoring and BullMQ integration
 * 
 * Enhancements over the original SubscriptionManager:
 * - Monitors both INSERT and UPDATE events
 * - Direct BullMQ integration instead of internal queue
 * - Better error handling and reconnection logic
 * - Structured logging with enterprise context
 */

import { supabase } from '@/lib/supabase/client';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { NotificationQueue } from '@/app/services/queue/NotificationQueue';
import type { Database } from '@/lib/supabase/database.types';
import type { RealtimeJobData } from '../../daemon/types/daemon';
import { logger } from '../../daemon/utils/logging';

type NotificationRow = Database['notify']['Tables']['ent_notification']['Row'];

export interface EnhancedSubscriptionConfig {
  enterpriseId: string;
  notificationQueue: NotificationQueue;
  onNotification?: (notification: NotificationRow, eventType: 'INSERT' | 'UPDATE') => Promise<void>;
  onError?: (error: Error) => void;
  events?: ('INSERT' | 'UPDATE' | 'DELETE')[];
  reconnectDelay?: number;
  maxRetries?: number;
}

export class EnhancedSubscriptionManager {
  private channel: RealtimeChannel | null = null;
  private config: EnhancedSubscriptionConfig;
  private isActive = false;
  private isShuttingDown = false;
  private retryCount = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(config: EnhancedSubscriptionConfig) {
    this.config = {
      events: ['INSERT', 'UPDATE'], // Default to both INSERT and UPDATE
      reconnectDelay: 1000,
      maxRetries: 10,
      ...config,
    };

    logger.subscription('Enhanced subscription manager initialized', this.config.enterpriseId, {
      events: this.config.events,
      maxRetries: this.config.maxRetries
    });
  }

  /**
   * Start listening to notification events
   */
  async start(): Promise<void> {
    if (this.isActive) {
      logger.subscription('Already active, ignoring start request', this.config.enterpriseId);
      return;
    }

    if (this.isShuttingDown) {
      logger.subscription('Cannot start during shutdown', this.config.enterpriseId);
      return;
    }

    try {
      logger.subscription('Starting subscription...', this.config.enterpriseId);
      await this.createSubscription();
      
    } catch (error) {
      logger.error(`Failed to start subscription for enterprise ${this.config.enterpriseId}:`, error instanceof Error ? error : new Error(String(error)));
      this.handleError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Create the Supabase realtime subscription
   */
  private async createSubscription(): Promise<void> {
    try {
      // Create subscription channel
      this.channel = supabase.channel(`notifications-${this.config.enterpriseId}-enhanced`);

      // Subscribe to each configured event type
      for (const eventType of this.config.events!) {
        this.channel.on(
          'postgres_changes',
          {
            event: eventType,
            schema: 'notify',
            table: 'ent_notification',
            filter: `enterprise_id=eq.${this.config.enterpriseId}`,
          },
          async (payload: RealtimePostgresChangesPayload<NotificationRow>) => {
            await this.handleRealtimeEvent(eventType, payload);
          }
        );
      }

      // Subscribe with status monitoring
      await new Promise<void>((resolve, reject) => {
        this.channel!.subscribe((status) => {
          logger.subscription(`Subscription status: ${status}`, this.config.enterpriseId);

          if (status === 'SUBSCRIBED') {
            this.isActive = true;
            this.retryCount = 0; // Reset retry count on successful connection
            logger.subscription('Successfully subscribed to realtime events', this.config.enterpriseId, {
              events: this.config.events
            });
            resolve();
          } else if (status === 'CHANNEL_ERROR') {
            logger.error(`Subscription channel error for enterprise ${this.config.enterpriseId}`);
            reject(new Error('Subscription channel error'));
          } else if (status === 'TIMED_OUT') {
            logger.error(`Subscription timed out for enterprise ${this.config.enterpriseId}`);
            reject(new Error('Subscription timed out'));
          } else if (status === 'CLOSED') {
            this.isActive = false;
            if (!this.isShuttingDown) {
              logger.warn(`Subscription closed unexpectedly for enterprise ${this.config.enterpriseId}`);
              this.handleError(new Error('Subscription closed unexpectedly'));
            }
          }
        });
      });

    } catch (error) {
      this.isActive = false;
      throw error;
    }
  }

  /**
   * Handle realtime events (INSERT, UPDATE, DELETE)
   */
  private async handleRealtimeEvent(
    eventType: 'INSERT' | 'UPDATE' | 'DELETE',
    payload: RealtimePostgresChangesPayload<NotificationRow>
  ): Promise<void> {
    const startTime = Date.now();

    try {
      logger.subscription(`Received ${eventType} event`, this.config.enterpriseId, {
        eventType,
        recordId: payload.new?.id || payload.old?.id,
      });

      // Validate payload based on event type
      let notificationId: number;
      let notificationData: NotificationRow | null = null;

      switch (eventType) {
        case 'INSERT':
          if (!payload.new || !('id' in payload.new)) {
            throw new Error('Invalid INSERT payload: missing new record');
          }
          notificationId = payload.new.id as number;
          notificationData = payload.new as NotificationRow;
          break;

        case 'UPDATE':
          if (!payload.new || !('id' in payload.new)) {
            throw new Error('Invalid UPDATE payload: missing new record');
          }
          notificationId = payload.new.id as number;
          notificationData = payload.new as NotificationRow;
          break;

        case 'DELETE':
          if (!payload.old || !('id' in payload.old)) {
            throw new Error('Invalid DELETE payload: missing old record');
          }
          notificationId = payload.old.id as number;
          // For DELETE events, we might still want to process cleanup
          break;

        default:
          throw new Error(`Unsupported event type: ${eventType}`);
      }

      // For INSERT and UPDATE events, fetch complete notification data if needed
      if ((eventType === 'INSERT' || eventType === 'UPDATE') && notificationData) {
        // Validate the notification is still in our enterprise
        if (notificationData.enterprise_id !== this.config.enterpriseId) {
          logger.warn(`Received notification for different enterprise`, this.config.enterpriseId, {
            notificationId,
            actualEnterpriseId: notificationData.enterprise_id
          });
          return;
        }

        // Add to BullMQ for processing
        await this.addToQueue(eventType, notificationData, payload.old as NotificationRow | undefined);
      }

      // Call custom handler if provided
      if (this.config.onNotification && notificationData) {
        await this.config.onNotification(notificationData, eventType);
      }

      const duration = Date.now() - startTime;
      logger.subscription(`${eventType} event processed successfully`, this.config.enterpriseId, {
        notificationId,
        duration,
        eventType
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Failed to handle ${eventType} event for enterprise ${this.config.enterpriseId}:`, error instanceof Error ? error : new Error(String(error)), {
        eventType,
        duration,
        recordId: payload.new?.id || payload.old?.id
      });

      // Don't re-throw as this would break the subscription
      // Instead, let error handler decide on reconnection
      this.handleError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Add realtime event to BullMQ for processing
   */
  private async addToQueue(
    eventType: 'INSERT' | 'UPDATE' | 'DELETE',
    notification: NotificationRow,
    oldNotification?: NotificationRow
  ): Promise<void> {
    try {
      const realtimeJobData: RealtimeJobData = {
        type: `realtime-${eventType.toLowerCase()}` as RealtimeJobData['type'],
        enterpriseId: this.config.enterpriseId,
        notificationId: notification.id,
        payload: notification,
        oldPayload: oldNotification,
        timestamp: new Date(),
        eventId: `${this.config.enterpriseId}-${notification.id}-${eventType}-${Date.now()}`,
      };

      // Use the enhanced notification queue to add realtime job
      await this.config.notificationQueue.addRealtimeJob(realtimeJobData);

      logger.subscription('Event added to queue successfully', this.config.enterpriseId, {
        notificationId: notification.id,
        eventType,
        jobId: realtimeJobData.eventId
      });

    } catch (error) {
      logger.error(`Failed to add ${eventType} event to queue:`, error instanceof Error ? error : new Error(String(error)), {
        enterpriseId: this.config.enterpriseId,
        notificationId: notification.id,
        eventType
      });
      throw error;
    }
  }

  /**
   * Handle errors and implement reconnection logic
   */
  private handleError(error: Error): void {
    logger.error(`Subscription error for enterprise ${this.config.enterpriseId}:`, error);

    // Call custom error handler if provided
    if (this.config.onError) {
      try {
        this.config.onError(error);
      } catch (handlerError) {
        logger.error('Error in custom error handler:', handlerError instanceof Error ? handlerError : new Error(String(handlerError)));
      }
    }

    // Don't attempt reconnection if shutting down
    if (this.isShuttingDown) {
      return;
    }

    // Implement exponential backoff reconnection
    this.retryCount++;
    
    if (this.retryCount <= this.config.maxRetries!) {
      const delay = Math.min(
        this.config.reconnectDelay! * Math.pow(2, this.retryCount - 1),
        30000 // Max 30 seconds
      );

      logger.subscription(`Scheduling reconnection attempt ${this.retryCount}/${this.config.maxRetries}`, this.config.enterpriseId, {
        delay,
        error: error.message
      });

      this.reconnectTimeout = setTimeout(() => {
        this.reconnect();
      }, delay);
    } else {
      logger.error(`Max reconnection attempts reached for enterprise ${this.config.enterpriseId}`, {
        retryCount: this.retryCount,
        maxRetries: this.config.maxRetries
      });
    }
  }

  /**
   * Attempt to reconnect the subscription
   */
  private async reconnect(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    try {
      logger.subscription('Attempting to reconnect...', this.config.enterpriseId, {
        attempt: this.retryCount
      });

      // Clean up existing subscription
      await this.cleanup();

      // Create new subscription
      await this.createSubscription();

      logger.subscription('Reconnection successful', this.config.enterpriseId);

    } catch (error) {
      logger.error(`Reconnection failed for enterprise ${this.config.enterpriseId}:`, error instanceof Error ? error : new Error(String(error)));
      this.handleError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Stop the subscription and cleanup resources
   */
  async stop(): Promise<void> {
    this.isShuttingDown = true;
    
    logger.subscription('Stopping subscription...', this.config.enterpriseId);

    // Cancel any pending reconnection
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    await this.cleanup();

    logger.subscription('Subscription stopped', this.config.enterpriseId);
  }

  /**
   * Cleanup subscription resources
   */
  private async cleanup(): Promise<void> {
    if (this.channel) {
      try {
        await supabase.removeChannel(this.channel);
      } catch (error) {
        logger.error('Error removing channel:', error instanceof Error ? error : new Error(String(error)));
      }
      this.channel = null;
    }

    this.isActive = false;
  }

  /**
   * Check if subscription is healthy
   */
  isHealthy(): boolean {
    return this.isActive && !this.isShuttingDown && this.retryCount === 0;
  }

  /**
   * Get subscription status
   */
  getStatus(): {
    isActive: boolean;
    isShuttingDown: boolean;
    retryCount: number;
    maxRetries: number;
    enterpriseId: string;
    events: string[];
  } {
    return {
      isActive: this.isActive,
      isShuttingDown: this.isShuttingDown,
      retryCount: this.retryCount,
      maxRetries: this.config.maxRetries!,
      enterpriseId: this.config.enterpriseId,
      events: this.config.events!,
    };
  }

  /**
   * Reset retry count (useful for manual recovery)
   */
  resetRetryCount(): void {
    this.retryCount = 0;
    logger.subscription('Retry count reset', this.config.enterpriseId);
  }

  /**
   * Force reconnection (useful for manual recovery)
   */
  async forceReconnect(): Promise<void> {
    logger.subscription('Force reconnection requested', this.config.enterpriseId);
    this.resetRetryCount();
    await this.reconnect();
  }
}