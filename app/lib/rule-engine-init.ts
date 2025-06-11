/**
 * Rule Engine Initialization for Next.js Application
 * 
 * This module handles the initialization of the rule engine when the Next.js
 * application starts. It should be imported in your main application file
 * or API route to ensure the rule engine is running.
 */

import { RuleEngineService, defaultRuleEngineConfig } from '@/app/services';
import type { RuleEngineConfig } from '@/types/rule-engine';

let ruleEngineInstance: RuleEngineService | null = null;
let initializationPromise: Promise<void> | null = null;

/**
 * Initialize the rule engine with custom configuration
 */
export async function initializeRuleEngine(
  config: Partial<RuleEngineConfig> = {}
): Promise<RuleEngineService> {
  // Return existing instance if already initialized
  if (ruleEngineInstance) {
    return ruleEngineInstance;
  }

  // Return the existing initialization promise if in progress
  if (initializationPromise) {
    await initializationPromise;
    return ruleEngineInstance!;
  }

  // Start initialization
  initializationPromise = performInitialization(config);
  await initializationPromise;
  
  return ruleEngineInstance!;
}

async function performInitialization(config: Partial<RuleEngineConfig>): Promise<void> {
  try {
    console.log('🚀 Initializing XNovu Rule Engine...');

    // Check if rule engine is enabled
    if (process.env.RULE_ENGINE_ENABLED === 'false') {
      console.log('⏸️ Rule Engine is disabled via environment variable');
      return;
    }

    // Merge custom config with defaults
    const finalConfig: RuleEngineConfig = {
      ...defaultRuleEngineConfig,
      ...config,
    };

    // Validate configuration
    validateConfiguration(finalConfig);

    // Get singleton instance
    ruleEngineInstance = RuleEngineService.getInstance(finalConfig);

    // Initialize all components
    await ruleEngineInstance.initialize();

    console.log('✅ XNovu Rule Engine initialized successfully');

    // Setup graceful shutdown handlers
    setupShutdownHandlers();

    // Setup health monitoring (optional)
    if (process.env.NODE_ENV === 'production') {
      setupHealthMonitoring();
    }

  } catch (error) {
    console.error('❌ Failed to initialize Rule Engine:', error);
    ruleEngineInstance = null;
    initializationPromise = null;
    throw error;
  }
}

/**
 * Get the current rule engine instance
 */
export function getRuleEngineInstance(): RuleEngineService | null {
  return ruleEngineInstance;
}

/**
 * Check if rule engine is initialized and healthy
 */
export async function isRuleEngineHealthy(): Promise<boolean> {
  if (!ruleEngineInstance) {
    return false;
  }

  try {
    const health = await ruleEngineInstance.healthCheck();
    return health.status === 'healthy';
  } catch (error) {
    console.error('Health check failed:', error);
    return false;
  }
}

/**
 * Get rule engine status for monitoring
 */
export async function getRuleEngineStatus() {
  if (!ruleEngineInstance) {
    return { initialized: false, error: 'Rule engine not initialized' };
  }

  try {
    return await ruleEngineInstance.getStatus();
  } catch (error) {
    return { initialized: false, error: error.message };
  }
}

/**
 * Validate rule engine configuration
 */
function validateConfiguration(config: RuleEngineConfig): void {
  const errors: string[] = [];

  if (!config.redisUrl) {
    errors.push('Redis URL is required');
  }

  if (!config.defaultTimezone) {
    errors.push('Default timezone is required');
  }

  if (config.maxConcurrentJobs <= 0) {
    errors.push('Max concurrent jobs must be greater than 0');
  }

  if (config.jobRetryAttempts < 0) {
    errors.push('Job retry attempts cannot be negative');
  }

  if (config.jobRetryDelay <= 0) {
    errors.push('Job retry delay must be greater than 0');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid rule engine configuration: ${errors.join(', ')}`);
  }
}

/**
 * Setup graceful shutdown handlers
 */
function setupShutdownHandlers(): void {
  const shutdownHandler = async (signal: string) => {
    console.log(`\n📋 Received ${signal}, shutting down Rule Engine gracefully...`);
    
    if (ruleEngineInstance) {
      try {
        await ruleEngineInstance.shutdown();
        console.log('✅ Rule Engine shutdown complete');
      } catch (error) {
        console.error('❌ Error during Rule Engine shutdown:', error);
      }
    }
    
    process.exit(0);
  };

  // Handle various shutdown signals
  process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
  process.on('SIGINT', () => shutdownHandler('SIGINT'));
  process.on('SIGUSR2', () => shutdownHandler('SIGUSR2')); // Nodemon restart

  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    console.error('💥 Uncaught Exception:', error);
    
    if (ruleEngineInstance) {
      try {
        await ruleEngineInstance.shutdown();
      } catch (shutdownError) {
        console.error('Error during emergency shutdown:', shutdownError);
      }
    }
    
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', async (reason, promise) => {
    console.error('🚫 Unhandled Rejection at:', promise, 'reason:', reason);
    
    if (ruleEngineInstance) {
      try {
        await ruleEngineInstance.shutdown();
      } catch (shutdownError) {
        console.error('Error during emergency shutdown:', shutdownError);
      }
    }
    
    process.exit(1);
  });
}

/**
 * Setup health monitoring for production
 */
function setupHealthMonitoring(): void {
  if (!ruleEngineInstance) return;

  // Health check every 5 minutes
  const healthCheckInterval = setInterval(async () => {
    try {
      const isHealthy = await isRuleEngineHealthy();
      
      if (!isHealthy) {
        console.warn('⚠️ Rule Engine health check failed');
        
        // You might want to:
        // 1. Send alerts to monitoring system
        // 2. Attempt to restart components
        // 3. Log detailed diagnostic information
        
        const status = await getRuleEngineStatus();
        console.warn('Rule Engine Status:', status);
      }
    } catch (error) {
      console.error('Health monitoring error:', error);
    }
  }, 5 * 60 * 1000); // 5 minutes

  // Clear interval on shutdown
  process.on('SIGTERM', () => clearInterval(healthCheckInterval));
  process.on('SIGINT', () => clearInterval(healthCheckInterval));
}

/**
 * Restart rule engine (useful for configuration updates)
 */
export async function restartRuleEngine(
  config: Partial<RuleEngineConfig> = {}
): Promise<RuleEngineService> {
  console.log('🔄 Restarting Rule Engine...');

  // Shutdown existing instance
  if (ruleEngineInstance) {
    await ruleEngineInstance.shutdown();
    ruleEngineInstance = null;
    initializationPromise = null;
  }

  // Reinitialize with new config
  return await initializeRuleEngine(config);
}

/**
 * Export configuration for easy access
 */
export { defaultRuleEngineConfig };

/**
 * Auto-initialize if this module is imported and we're in a server context
 */
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'test') {
  // Auto-initialize with a delay to ensure all modules are loaded
  setTimeout(() => {
    initializeRuleEngine().catch(error => {
      console.error('Failed to auto-initialize Rule Engine:', error);
    });
  }, 1000);
}