/**
 * Health Monitor Service
 * 
 * Provides HTTP health check endpoints and monitoring capabilities
 */

import { createServer, Server, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import type { DaemonManager } from './DaemonManager';
import { logger } from '../utils/logging';

interface HealthMonitorConfig {
  port: number;
  daemonManager: DaemonManager;
}

export class HealthMonitor {
  private config: HealthMonitorConfig;
  private server: Server | null = null;
  private isStarted = false;

  constructor(config: HealthMonitorConfig) {
    this.config = config;
  }

  /**
   * Start the health monitor HTTP server
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      logger.warn('Health monitor already started');
      return;
    }

    try {
      this.server = createServer(this.handleRequest.bind(this));
      
      await new Promise<void>((resolve, reject) => {
        this.server!.listen(this.config.port, (error?: Error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      this.isStarted = true;
      logger.health('Health monitor started', { port: this.config.port });

    } catch (error) {
      logger.error('Failed to start health monitor:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Stop the health monitor
   */
  async stop(): Promise<void> {
    if (!this.isStarted || !this.server) {
      return;
    }

    try {
      await new Promise<void>((resolve, reject) => {
        this.server!.close((error?: Error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      this.isStarted = false;
      this.server = null;
      logger.health('Health monitor stopped');

    } catch (error) {
      logger.error('Error stopping health monitor:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Handle HTTP requests
   */
  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      const method = req.method || 'GET';

      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (method === 'OPTIONS') {
        res.statusCode = 200;
        res.end();
        return;
      }

      if (method !== 'GET') {
        this.sendResponse(res, 405, { error: 'Method not allowed' });
        return;
      }

      switch (url.pathname) {
        case '/health':
          await this.handleHealthCheck(req, res);
          break;
        
        case '/health/detailed':
          await this.handleDetailedHealth(req, res);
          break;

        case '/health/subscriptions':
          await this.handleSubscriptionHealth(req, res);
          break;

        case '/metrics':
          await this.handleMetrics(req, res);
          break;

        default:
          this.sendResponse(res, 404, { error: 'Not found' });
      }

    } catch (error) {
      logger.error('Error handling health check request:', error instanceof Error ? error : new Error(String(error)));
      this.sendResponse(res, 500, { error: 'Internal server error' });
    }
  }

  /**
   * Handle basic health check endpoint
   */
  private async handleHealthCheck(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const healthStatus = await this.config.daemonManager.getHealthStatus();
      const statusCode = healthStatus.status === 'healthy' ? 200 : 
                         healthStatus.status === 'degraded' ? 200 : 503;

      this.sendResponse(res, statusCode, {
        status: healthStatus.status,
        uptime: healthStatus.uptime,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || 'unknown'
      });

    } catch (error) {
      logger.error('Error in health check:', error instanceof Error ? error : new Error(String(error)));
      this.sendResponse(res, 503, {
        status: 'unhealthy',
        error: 'Health check failed',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle detailed health check endpoint
   */
  private async handleDetailedHealth(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const healthStatus = await this.config.daemonManager.getHealthStatus();
      const statusCode = healthStatus.status === 'healthy' ? 200 : 
                         healthStatus.status === 'degraded' ? 200 : 503;

      this.sendResponse(res, statusCode, {
        ...healthStatus,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || 'unknown',
        process: {
          pid: process.pid,
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
          nodeVersion: process.version
        }
      });

    } catch (error) {
      logger.error('Error in detailed health check:', error instanceof Error ? error : new Error(String(error)));
      this.sendResponse(res, 503, {
        status: 'unhealthy',
        error: 'Detailed health check failed',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle subscription-specific health endpoint
   */
  private async handleSubscriptionHealth(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const subscriptionManager = this.config.daemonManager.getSubscriptionManager();
      
      if (!subscriptionManager) {
        this.sendResponse(res, 200, {
          status: 'no_subscriptions',
          message: 'No subscription manager configured',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const managerStatus = subscriptionManager.getStatus();
      const isHealthy = subscriptionManager.isHealthy();
      
      this.sendResponse(res, 200, {
        status: isHealthy ? 'healthy' : 'degraded',
        subscription_manager: {
          isActive: managerStatus.isActive,
          isHealthy,
          retryCount: managerStatus.retryCount,
          maxRetries: managerStatus.maxRetries,
          events: managerStatus.events
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error in subscription health check:', error instanceof Error ? error : new Error(String(error)));
      this.sendResponse(res, 500, {
        status: 'error',
        error: 'Subscription health check failed',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle metrics endpoint (Prometheus-compatible)
   */
  private async handleMetrics(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const healthStatus = await this.config.daemonManager.getHealthStatus();
      const subscriptionManager = this.config.daemonManager.getSubscriptionManager();
      
      let metrics = [
        `# HELP xnovu_daemon_uptime_seconds Daemon uptime in seconds`,
        `# TYPE xnovu_daemon_uptime_seconds gauge`,
        `xnovu_daemon_uptime_seconds ${healthStatus.uptime}`,
        ``,
        `# HELP xnovu_daemon_healthy Daemon health status (1 = healthy, 0 = unhealthy)`,
        `# TYPE xnovu_daemon_healthy gauge`,
        `xnovu_daemon_healthy ${healthStatus.status === 'healthy' ? 1 : 0}`,
        ``,
        `# HELP xnovu_subscriptions_total Total number of configured subscriptions`,
        `# TYPE xnovu_subscriptions_total gauge`,
        `xnovu_subscriptions_total ${healthStatus.components.subscriptions.total}`,
        ``,
        `# HELP xnovu_subscriptions_active Number of active subscriptions`,
        `# TYPE xnovu_subscriptions_active gauge`,
        `xnovu_subscriptions_active ${healthStatus.components.subscriptions.active}`,
        ``,
        `# HELP xnovu_subscriptions_failed Number of failed subscriptions`,
        `# TYPE xnovu_subscriptions_failed gauge`,
        `xnovu_subscriptions_failed ${healthStatus.components.subscriptions.failed}`,
        ``,
        `# HELP xnovu_subscriptions_reconnecting Number of reconnecting subscriptions`,
        `# TYPE xnovu_subscriptions_reconnecting gauge`,
        `xnovu_subscriptions_reconnecting ${healthStatus.components.subscriptions.reconnecting}`,
      ];

      // Add queue metrics if available
      if (healthStatus.queue_stats) {
        const queueStats = healthStatus.queue_stats;
        
        if (queueStats.notification) {
          metrics.push(
            ``,
            `# HELP xnovu_queue_notification_waiting Jobs waiting in notification queue`,
            `# TYPE xnovu_queue_notification_waiting gauge`,
            `xnovu_queue_notification_waiting ${queueStats.notification.waiting || 0}`,
            ``,
            `# HELP xnovu_queue_notification_active Jobs active in notification queue`,
            `# TYPE xnovu_queue_notification_active gauge`,
            `xnovu_queue_notification_active ${queueStats.notification.active || 0}`,
            ``,
            `# HELP xnovu_queue_notification_completed Completed jobs in notification queue`,
            `# TYPE xnovu_queue_notification_completed gauge`,
            `xnovu_queue_notification_completed ${queueStats.notification.completed || 0}`,
            ``,
            `# HELP xnovu_queue_notification_failed Failed jobs in notification queue`,
            `# TYPE xnovu_queue_notification_failed gauge`,
            `xnovu_queue_notification_failed ${queueStats.notification.failed || 0}`
          );
        }
      }

      res.setHeader('Content-Type', 'text/plain');
      res.statusCode = 200;
      res.end(metrics.join('\n'));

    } catch (error) {
      logger.error('Error in metrics endpoint:', error instanceof Error ? error : new Error(String(error)));
      this.sendResponse(res, 500, { error: 'Metrics endpoint failed' });
    }
  }

  /**
   * Send JSON response
   */
  private sendResponse(res: ServerResponse, statusCode: number, data: any): void {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = statusCode;
    res.end(JSON.stringify(data, null, 2));
  }

  /**
   * Check if health monitor is running
   */
  isRunning(): boolean {
    return this.isStarted;
  }

  /**
   * Get health monitor port
   */
  getPort(): number {
    return this.config.port;
  }
}