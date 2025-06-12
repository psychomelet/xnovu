#!/usr/bin/env tsx

/**
 * XNovu Unified Daemon
 * 
 * Master daemon that orchestrates all notification services:
 * - Realtime subscriptions (EnhancedSubscriptionManager)
 * - Temporal workflows for notification processing
 * - Health monitoring and status endpoints
 */

import { config } from 'dotenv';
import { DaemonManager } from './services/DaemonManager';
import { logger } from './utils/logging';
import { setupSignalHandlers } from './utils/signals';

// Load environment variables
config();

async function main() {
  try {
    logger.info('🚀 Starting XNovu Unified Daemon...');

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
    const enterpriseIds = process.env.DAEMON_ENTERPRISE_IDS?.split(',').map(id => id.trim()) || [];
    if (enterpriseIds.length === 0) {
      logger.warn('No enterprise IDs specified in DAEMON_ENTERPRISE_IDS, daemon will run without realtime subscriptions');
    }

    // Initialize daemon manager
    const daemonManager = new DaemonManager({
      enterpriseIds,
      healthPort: parseInt(process.env.DAEMON_HEALTH_PORT || '3001'),
      logLevel: process.env.DAEMON_LOG_LEVEL || 'info',
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
      }
    });

    // Setup graceful shutdown
    setupSignalHandlers(async (signal) => {
      logger.info(`📋 Received ${signal}, shutting down daemon gracefully...`);
      await daemonManager.shutdown();
      process.exit(0);
    });

    // Start daemon
    await daemonManager.start();

    logger.info('✅ XNovu Unified Daemon started successfully');
    logger.info(`🏥 Health check available at http://localhost:${daemonManager.getHealthPort()}/health`);

  } catch (error) {
    logger.error('❌ Failed to start XNovu Unified Daemon:', error instanceof Error ? error : new Error(String(error)));
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

// Start the daemon
main().catch((error) => {
  logger.error('Fatal error in main:', error instanceof Error ? error : new Error(String(error)));
  process.exit(1);
});