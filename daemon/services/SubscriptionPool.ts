/**
 * Subscription Pool Service
 * 
 * Manages realtime subscriptions for multiple enterprises.
 * Each enterprise gets its own SubscriptionManager instance with proper isolation.
 */

import { EnhancedSubscriptionManager } from '@/app/services/realtime/EnhancedSubscriptionManager';
import { EnhancedNotificationQueue } from '@/app/services/queue/EnhancedNotificationQueue';
import type { 
  SubscriptionPoolConfig, 
  EnterpriseSubscriptionStatus 
} from '../types/daemon';
import { logger, measureTime } from '../utils/logging';

export class SubscriptionPool {
  private config: SubscriptionPoolConfig;
  private subscriptions = new Map<string, EnhancedSubscriptionManager>();
  private subscriptionStatus = new Map<string, EnterpriseSubscriptionStatus>();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isStarted = false;
  private isShuttingDown = false;

  constructor(config: SubscriptionPoolConfig) {
    this.config = config;
    
    // Initialize status tracking for all enterprises
    for (const enterpriseId of config.enterpriseIds) {
      this.subscriptionStatus.set(enterpriseId, {
        enterpriseId,
        status: 'disconnected',
        retryCount: 0,
        isHealthy: false,
      });
    }

    logger.subscription('Subscription pool initialized', 'pool', {
      enterpriseCount: config.enterpriseIds.length
    });
  }

  /**
   * Start all enterprise subscriptions
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      logger.warn('Subscription pool already started');
      return;
    }

    try {
      logger.subscription('Starting subscription pool...', 'pool');

      await measureTime(
        () => this.initializeSubscriptions(),
        logger,
        'Subscription pool initialization completed',
        { component: 'SubscriptionPool', enterpriseCount: this.config.enterpriseIds.length }
      );

      this.startHealthChecks();
      this.isStarted = true;

      logger.subscription('Subscription pool started successfully', 'pool', {
        activeSubscriptions: this.subscriptions.size
      });

    } catch (error) {
      logger.error('Failed to start subscription pool:', error instanceof Error ? error : new Error(String(error)));
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Initialize subscriptions for all enterprises
   */
  private async initializeSubscriptions(): Promise<void> {
    const initPromises = this.config.enterpriseIds.map(enterpriseId => 
      this.initializeEnterpriseSubscription(enterpriseId)
    );

    // Wait for all subscriptions to initialize (some may fail)
    const results = await Promise.allSettled(initPromises);

    // Log any failures
    results.forEach((result, index) => {
      const enterpriseId = this.config.enterpriseIds[index];
      if (result.status === 'rejected') {
        logger.error(`Failed to initialize subscription for enterprise ${enterpriseId}:`, result.reason);
        this.updateSubscriptionStatus(enterpriseId, 'error', result.reason?.message);
      }
    });

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    logger.subscription(`Initialized ${successCount}/${this.config.enterpriseIds.length} enterprise subscriptions`, 'pool');
  }

  /**
   * Initialize subscription for a single enterprise
   */
  private async initializeEnterpriseSubscription(enterpriseId: string): Promise<void> {
    try {
      logger.subscription('Initializing subscription', enterpriseId);
      this.updateSubscriptionStatus(enterpriseId, 'connecting');

      const subscriptionManager = new EnhancedSubscriptionManager({
        enterpriseId,
        notificationQueue: this.config.notificationQueue,
        events: ['INSERT', 'UPDATE'], // Monitor both INSERT and UPDATE events
        reconnectDelay: this.config.reconnectDelay,
        maxRetries: this.config.maxRetries,
        onNotification: async (notification, eventType) => {
          logger.subscription(`Notification received via callback (${eventType})`, enterpriseId, {
            notificationId: notification.id,
            eventType
          });
        },
        onError: (error) => {
          logger.error(`Subscription error for enterprise ${enterpriseId}:`, error);
          this.handleSubscriptionError(enterpriseId, error);
        }
      });

      await subscriptionManager.start();
      
      this.subscriptions.set(enterpriseId, subscriptionManager);
      this.updateSubscriptionStatus(enterpriseId, 'subscribed');

      logger.subscription('Subscription initialized successfully', enterpriseId);

    } catch (error) {
      logger.error(`Failed to initialize subscription for enterprise ${enterpriseId}:`, error instanceof Error ? error : new Error(String(error)));
      this.updateSubscriptionStatus(enterpriseId, 'error', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Handle subscription errors and implement reconnection logic
   */
  private handleSubscriptionError(enterpriseId: string, error: Error): void {
    const status = this.subscriptionStatus.get(enterpriseId);
    if (!status) return;

    logger.error(`Subscription error for enterprise ${enterpriseId}:`, error);

    // Update status and increment retry count
    status.retryCount++;
    status.lastError = error.message;
    this.updateSubscriptionStatus(enterpriseId, 'error', error.message);

    // Implement exponential backoff reconnection
    if (status.retryCount <= this.config.maxRetries) {
      const delay = Math.min(
        this.config.reconnectDelay * Math.pow(2, status.retryCount - 1),
        30000 // Max 30 seconds
      );

      logger.subscription(`Scheduling reconnection attempt ${status.retryCount}/${this.config.maxRetries}`, enterpriseId, {
        delay,
        error: error.message
      });

      setTimeout(() => {
        if (!this.isShuttingDown) {
          this.reconnectEnterprise(enterpriseId);
        }
      }, delay);
    } else {
      logger.error(`Max reconnection attempts reached for enterprise ${enterpriseId}`, {
        retryCount: status.retryCount,
        maxRetries: this.config.maxRetries
      });
    }
  }

  /**
   * Reconnect a specific enterprise subscription
   */
  private async reconnectEnterprise(enterpriseId: string): Promise<void> {
    try {
      logger.subscription('Attempting reconnection', enterpriseId);
      this.updateSubscriptionStatus(enterpriseId, 'reconnecting');

      // Stop existing subscription if any
      const existingSubscription = this.subscriptions.get(enterpriseId);
      if (existingSubscription) {
        await existingSubscription.stop();
        this.subscriptions.delete(enterpriseId);
      }

      // Re-initialize subscription
      await this.initializeEnterpriseSubscription(enterpriseId);

      // Reset retry count on successful reconnection
      const status = this.subscriptionStatus.get(enterpriseId);
      if (status) {
        status.retryCount = 0;
        status.lastError = undefined;
      }

      logger.subscription('Reconnection successful', enterpriseId);

    } catch (error) {
      logger.error(`Reconnection failed for enterprise ${enterpriseId}:`, error instanceof Error ? error : new Error(String(error)));
      this.handleSubscriptionError(enterpriseId, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Update subscription status for an enterprise
   */
  private updateSubscriptionStatus(
    enterpriseId: string, 
    status: EnterpriseSubscriptionStatus['status'], 
    errorMessage?: string
  ): void {
    const currentStatus = this.subscriptionStatus.get(enterpriseId);
    if (!currentStatus) return;

    currentStatus.status = status;
    currentStatus.isHealthy = status === 'subscribed' || status === 'connected';
    
    if (status === 'subscribed' || status === 'connected') {
      currentStatus.lastConnected = new Date();
      currentStatus.lastError = undefined;
    }
    
    if (errorMessage) {
      currentStatus.lastError = errorMessage;
    }

    this.subscriptionStatus.set(enterpriseId, currentStatus);
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval);

    logger.subscription('Health checks started', 'pool', {
      interval: this.config.healthCheckInterval
    });
  }

  /**
   * Perform health checks on all subscriptions
   */
  private async performHealthChecks(): Promise<void> {
    for (const [enterpriseId, subscription] of this.subscriptions) {
      try {
        const isHealthy = subscription.isHealthy();
        const status = this.subscriptionStatus.get(enterpriseId);
        
        if (status) {
          status.isHealthy = isHealthy;
          
          if (!isHealthy && status.status === 'subscribed') {
            logger.warn(`Health check failed for enterprise ${enterpriseId}`, {
              status: subscription.getStatus()
            });
            this.updateSubscriptionStatus(enterpriseId, 'error', 'Health check failed');
          }
        }
      } catch (error) {
        logger.error(`Health check error for enterprise ${enterpriseId}:`, error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  /**
   * Get health status summary
   */
  async getHealthStatus(): Promise<{
    total: number;
    active: number;
    failed: number;
    reconnecting: number;
  }> {
    const statuses = Array.from(this.subscriptionStatus.values());
    
    return {
      total: statuses.length,
      active: statuses.filter(s => s.status === 'subscribed' || s.status === 'connected').length,
      failed: statuses.filter(s => s.status === 'error').length,
      reconnecting: statuses.filter(s => s.status === 'reconnecting').length,
    };
  }

  /**
   * Get detailed enterprise status
   */
  async getEnterpriseStatus(): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    
    for (const [enterpriseId, status] of this.subscriptionStatus) {
      result[enterpriseId] = status.status;
    }
    
    return result;
  }

  /**
   * Get detailed status for a specific enterprise
   */
  getEnterpriseDetails(enterpriseId: string): EnterpriseSubscriptionStatus | null {
    return this.subscriptionStatus.get(enterpriseId) || null;
  }

  /**
   * Manually restart subscription for an enterprise
   */
  async restartEnterprise(enterpriseId: string): Promise<void> {
    logger.subscription('Manual restart requested', enterpriseId);
    
    const status = this.subscriptionStatus.get(enterpriseId);
    if (status) {
      status.retryCount = 0; // Reset retry count for manual restart
    }
    
    await this.reconnectEnterprise(enterpriseId);
  }

  /**
   * Graceful shutdown of all subscriptions
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Subscription pool shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    logger.subscription('Starting subscription pool shutdown...', 'pool');

    try {
      // Stop health checks
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      // Shutdown all subscriptions in parallel
      const shutdownPromises = Array.from(this.subscriptions.entries()).map(
        async ([enterpriseId, subscription]) => {
          try {
            await subscription.stop();
            this.updateSubscriptionStatus(enterpriseId, 'disconnected');
            logger.subscription('Subscription stopped', enterpriseId);
          } catch (error) {
            logger.error(`Error stopping subscription for ${enterpriseId}:`, error instanceof Error ? error : new Error(String(error)));
          }
        }
      );

      await Promise.all(shutdownPromises);
      
      this.subscriptions.clear();
      this.isStarted = false;

      logger.subscription('Subscription pool shutdown completed', 'pool');

    } catch (error) {
      logger.error('Error during subscription pool shutdown:', error instanceof Error ? error : new Error(String(error)));
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Emergency cleanup
   */
  private async cleanup(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    for (const subscription of this.subscriptions.values()) {
      try {
        await subscription.stop();
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    this.subscriptions.clear();
    this.isStarted = false;
  }

  /**
   * Check if pool is running
   */
  isRunning(): boolean {
    return this.isStarted && !this.isShuttingDown;
  }

  /**
   * Get active subscription count
   */
  getActiveSubscriptionCount(): number {
    return this.subscriptions.size;
  }
}