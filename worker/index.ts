#!/usr/bin/env tsx

/**
 * XNovu Worker Process
 * 
 * Dedicated worker process for processing BullMQ jobs:
 * - Notification jobs (from realtime events, cron, scheduled)
 * - Rule execution jobs (from cron triggers)
 * - Realtime jobs (from INSERT/UPDATE events)
 */

import { config } from 'dotenv';
import { WorkerManager } from './services/WorkerManager';
import { logger } from '../daemon/utils/logging';
import { setupSignalHandlers } from '../daemon/utils/signals';

// Load environment variables
config();

async function main() {
  try {
    logger.info('🔧 Starting XNovu Worker Process...');

    // Validate required environment variables
    const requiredVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY', 
      'NOVU_SECRET_KEY',
      'REDIS_URL'
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    // Worker configuration
    const workerConfig = {
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5'),
      logLevel: process.env.WORKER_LOG_LEVEL || 'info',
      redis: {
        url: process.env.REDIS_URL!,
      },
      supabase: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      },
      novu: {
        secretKey: process.env.NOVU_SECRET_KEY!,
      },
      ruleEngine: {
        maxConcurrentJobs: parseInt(process.env.RULE_ENGINE_MAX_CONCURRENT_JOBS || '10'),
        retryAttempts: parseInt(process.env.RULE_ENGINE_RETRY_ATTEMPTS || '3'),
        retryDelay: parseInt(process.env.RULE_ENGINE_RETRY_DELAY || '5000'),
      }
    };

    // Initialize worker manager
    const workerManager = new WorkerManager(workerConfig);

    // Setup graceful shutdown
    setupSignalHandlers(async (signal) => {
      logger.info(`📋 Received ${signal}, shutting down worker gracefully...`);
      await workerManager.shutdown();
      process.exit(0);
    });

    // Start worker
    await workerManager.start();

    logger.info('✅ XNovu Worker Process started successfully');
    logger.info(`🔧 Worker concurrency: ${workerConfig.concurrency}`);

  } catch (error) {
    logger.error('❌ Failed to start XNovu Worker Process:', error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('💥 Uncaught Exception in worker:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('🚫 Unhandled Rejection in worker:', reason instanceof Error ? reason : new Error(String(reason)), { promise: String(promise) });
  process.exit(1);
});

// Start the worker
main().catch((error) => {
  logger.error('Fatal error in worker main:', error instanceof Error ? error : new Error(String(error)));
  process.exit(1);
});