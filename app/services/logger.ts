/**
 * Winston-based structured logging for XNovu
 */

import winston from 'winston';

// Define custom log levels matching our app needs
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Create Winston logger instance
const winstonLogger = winston.createLogger({
  levels: logLevels,
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'xnovu-app',
    env: process.env.NODE_ENV || 'development'
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        // In development, use pretty print
        process.env.NODE_ENV === 'development'
          ? winston.format.combine(
              winston.format.colorize(),
              winston.format.printf(({ level, message, timestamp, ...metadata }) => {
                let msg = `${timestamp} [${level}] ${message}`;
                if (Object.keys(metadata).length > 0) {
                  msg += ` ${JSON.stringify(metadata)}`;
                }
                return msg;
              })
            )
          : winston.format.json()
      )
    })
  ],
});

// Add file transport in production
if (process.env.NODE_ENV === 'production' && process.env.LOG_FILE_PATH) {
  winstonLogger.add(new winston.transports.File({
    filename: process.env.LOG_FILE_PATH,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }));
}

interface LogContext {
  component?: string;
  enterpriseId?: string;
  notificationId?: number;
  subscriptionId?: string;
  workflowId?: string;
  duration?: number;
  [key: string]: any;
}

class Logger {
  debug(message: string, context?: LogContext): void {
    winstonLogger.debug(message, context);
  }

  info(message: string, context?: LogContext): void {
    winstonLogger.info(message, context);
  }

  warn(message: string, context?: LogContext): void {
    winstonLogger.warn(message, context);
  }

  error(message: string, errorOrContext?: Error | LogContext, context?: LogContext): void {
    if (errorOrContext instanceof Error) {
      winstonLogger.error(message, {
        ...context,
        error: {
          message: errorOrContext.message,
          stack: errorOrContext.stack,
          name: errorOrContext.name
        }
      });
    } else {
      winstonLogger.error(message, errorOrContext);
    }
  }

  // Specialized logging methods for common scenarios
  subscription(message: string, enterpriseId: string, context?: LogContext): void {
    this.info(message, {
      component: 'SubscriptionManager',
      enterpriseId,
      ...context,
    });
  }

  temporal(message: string, context?: LogContext): void {
    this.info(message, {
      component: 'Temporal',
      ...context,
    });
  }

  workflow(message: string, workflowId: string, context?: LogContext): void {
    this.info(message, {
      component: 'Workflow',
      workflowId,
      ...context,
    });
  }

  health(message: string, context?: LogContext): void {
    this.info(message, {
      component: 'HealthMonitor',
      ...context,
    });
  }

  worker(message: string, context?: LogContext): void {
    this.info(message, {
      component: 'WorkerManager',
      ...context,
    });
  }

  // Helper method to measure operation duration
  async measureTime<T>(
    operation: () => Promise<T>,
    operationName: string,
    context?: LogContext
  ): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      this.info(`${operationName} completed`, { ...context, duration, status: 'success' });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.error(`${operationName} failed`, error as Error, { ...context, duration, status: 'failed' });
      throw error;
    }
  }
}

export const logger = new Logger();

// Export winston instance for advanced usage
export const winstonInstance = winstonLogger;