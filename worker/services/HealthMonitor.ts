/**
 * Health Monitor Service
 * 
 * Provides HTTP health check endpoints and monitoring capabilities
 */

import { createServer, Server, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import type { WorkerManager } from './WorkerManager';
import { logger } from '../utils/logging';

interface HealthMonitorConfig {
  port: number;
  workerManager: WorkerManager;
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
      const healthStatus = await this.config.workerManager.getHealthStatus();
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
      const healthStatus = await this.config.workerManager.getHealthStatus();
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
   * Handle subscription-specific health endpoint (now polling workflows)
   */
  private async handleSubscriptionHealth(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const pollingWorkflowIds = this.config.workerManager.getPollingWorkflowIds();
      
      if (!pollingWorkflowIds || pollingWorkflowIds.size === 0) {
        this.sendResponse(res, 200, {
          status: 'no_polling_workflows',
          message: 'No polling workflows configured',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const workflowStatuses: Record<string, string> = {};
      for (const [enterpriseId, workflowId] of pollingWorkflowIds) {
        workflowStatuses[enterpriseId] = `workflow: ${workflowId}`;
      }
      
      this.sendResponse(res, 200, {
        status: 'healthy',
        polling_workflows: {
          total: pollingWorkflowIds.size,
          workflows: workflowStatuses
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
      const healthStatus = await this.config.workerManager.getHealthStatus();
      const pollingWorkflowIds = this.config.workerManager.getPollingWorkflowIds();
      
      let metrics = [
        `# HELP xnovu_worker_uptime_seconds Worker uptime in seconds`,
        `# TYPE xnovu_worker_uptime_seconds gauge`,
        `xnovu_worker_uptime_seconds ${healthStatus.uptime}`,
        ``,
        `# HELP xnovu_worker_healthy Worker health status (1 = healthy, 0 = unhealthy)`,
        `# TYPE xnovu_worker_healthy gauge`,
        `xnovu_worker_healthy ${healthStatus.status === 'healthy' ? 1 : 0}`,
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