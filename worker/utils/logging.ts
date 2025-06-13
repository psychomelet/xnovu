/**
 * Winston-based structured logging for XNovu Worker
 */

import winston from 'winston';

// Create Winston logger instance for worker
const winstonLogger = winston.createLogger({
  level: process.env.WORKER_LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'xnovu-worker',
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
if (process.env.NODE_ENV === 'production' && process.env.WORKER_LOG_FILE_PATH) {
  winstonLogger.add(new winston.transports.File({
    filename: process.env.WORKER_LOG_FILE_PATH,
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

  // Specialized logging methods
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
}

export const logger = new Logger();

// Performance measurement utility
export async function measureTime<T>(
  operation: () => Promise<T>, 
  operationName: string, 
  context?: LogContext
): Promise<T> {
  const startTime = Date.now();
  
  try {
    const result = await operation();
    const duration = Date.now() - startTime;
    logger.info(`${operationName} completed`, { ...context, duration, status: 'success' });
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`${operationName} failed`, error as Error, { ...context, duration, status: 'failed' });
    throw error;
  }
}