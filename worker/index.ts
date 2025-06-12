#!/usr/bin/env tsx

/**
 * XNovu Unified Worker
 * 
 * Master worker that orchestrates all notification services:
 * - Notification polling workflows (outbox pattern)
 * - Temporal workflows for notification processing
 * - Health monitoring and status endpoints
 */

import { config } from 'dotenv';
import { WorkerManager } from './services/WorkerManager';
import { logger } from './utils/logging';
import { setupSignalHandlers } from './utils/signals';

// Load environment variables
config();

async function main() {
  try {
    logger.info('🚀 Starting XNovu Unified Worker...');

    // Validate required environment variables
    const requiredVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY', 
      'NOVU_SECRET_KEY',
      'TEMPORAL_ADDRESS'
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    // Parse enterprise IDs from environment
    const enterpriseIds = process.env.WORKER_ENTERPRISE_IDS?.split(',').map(id => id.trim()) || [];
    if (enterpriseIds.length === 0) {
      logger.warn('No enterprise IDs specified in WORKER_ENTERPRISE_IDS, worker will run without polling workflows');
    }

    // Initialize worker manager
    const workerManager = new WorkerManager({
      enterpriseIds,
      healthPort: parseInt(process.env.WORKER_HEALTH_PORT || '3001'),
      logLevel: process.env.WORKER_LOG_LEVEL || 'info',
      supabase: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      },
      novu: {
        secretKey: process.env.NOVU_SECRET_KEY!,
      },
      subscription: {
        reconnectDelay: parseInt(process.env.SUBSCRIPTION_RECONNECT_DELAY || '1000'),
        maxRetries: parseInt(process.env.SUBSCRIPTION_MAX_RETRIES || '10'),
        healthCheckInterval: parseInt(process.env.SUBSCRIPTION_HEALTH_CHECK_INTERVAL || '30000'),
        pollInterval: parseInt(process.env.NOTIFICATION_POLL_INTERVAL || '5000'),
        batchSize: parseInt(process.env.NOTIFICATION_BATCH_SIZE || '100'),
      }
    });

    // Setup graceful shutdown
    setupSignalHandlers(async (signal: string) => {
      logger.info(`📋 Received ${signal}, shutting down worker gracefully...`);
      await workerManager.shutdown();
      process.exit(0);
    });

    // Start worker
    await workerManager.start();

    logger.info('✅ XNovu Unified Worker started successfully');
    logger.info(`🏥 Health check available at http://localhost:${workerManager.getHealthPort()}/health`);

  } catch (error) {
    logger.error('❌ Failed to start XNovu Unified Worker:', error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('🚫 Unhandled Rejection at:', reason instanceof Error ? reason : new Error(String(reason)), {
    promise: String(promise),
    reason: String(reason)
  });
  process.exit(1);
});

// Start the worker
main().catch((error) => {
  logger.error('Fatal error in main:', error instanceof Error ? error : new Error(String(error)));
  process.exit(1);
});