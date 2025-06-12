/**
 * Structured logging utility for the daemon system
 */

interface LogContext {
  component?: string;
  enterpriseId?: string;
  notificationId?: number;
  subscriptionId?: string;
  jobId?: string;
  jobType?: string;
  duration?: number;
  error?: string;
  [key: string]: any;
}

class Logger {
  private logLevel: string;

  constructor() {
    this.logLevel = process.env.DAEMON_LOG_LEVEL || 'info';
  }

  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const targetLevelIndex = levels.indexOf(level);
    return targetLevelIndex >= currentLevelIndex;
  }

  private formatLog(level: string, message: string, context: LogContext = {}): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logData = {
      level,
      message,
      timestamp: new Date().toISOString(),
      component: 'daemon',
      ...context,
    };

    const output = JSON.stringify(logData);

    switch (level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'debug':
        console.debug(output);
        break;
      default:
        console.log(output);
    }
  }

  debug(message: string, context?: LogContext): void {
    this.formatLog('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.formatLog('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.formatLog('warn', message, context);
  }

  error(message: string, context?: LogContext): void;
  error(message: string, error: Error, context?: LogContext): void;
  error(message: string, errorOrContext?: Error | LogContext, context?: LogContext): void {
    let finalContext: LogContext = {};
    
    if (errorOrContext instanceof Error) {
      finalContext = {
        ...context,
        error: errorOrContext.message,
        stack: errorOrContext.stack,
      };
    } else {
      finalContext = errorOrContext || {};
    }

    this.formatLog('error', message, finalContext);
  }

  // Specialized logging methods for common scenarios
  subscription(message: string, enterpriseId: string, context?: LogContext): void {
    this.info(message, {
      component: 'SubscriptionManager',
      enterpriseId,
      ...context,
    });
  }

  queue(message: string, context?: LogContext): void {
    this.info(message, {
      component: 'NotificationQueue',
      ...context,
    });
  }

  ruleEngine(message: string, context?: LogContext): void {
    this.info(message, {
      component: 'RuleEngine',
      ...context,
    });
  }

  health(message: string, context?: LogContext): void {
    this.info(message, {
      component: 'HealthMonitor',
      ...context,
    });
  }

  daemon(message: string, context?: LogContext): void {
    this.info(message, {
      component: 'DaemonManager',
      ...context,
    });
  }
}

export const logger = new Logger();

// Performance measurement utility
export function measureTime<T>(
  operation: () => Promise<T>, 
  logger: Logger, 
  message: string, 
  context?: LogContext
): Promise<T> {
  const startTime = Date.now();
  
  return operation().then(
    (result) => {
      const duration = Date.now() - startTime;
      logger.info(message, { ...context, duration, status: 'success' });
      return result;
    },
    (error) => {
      const duration = Date.now() - startTime;
      logger.error(message, { ...context, duration, status: 'failed', error: error.message });
      throw error;
    }
  );
}