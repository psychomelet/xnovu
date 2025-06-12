/**
 * Signal handling utilities for graceful shutdown
 */

import type { SignalHandler } from '../types/daemon';
import { logger } from './logging';

export function setupSignalHandlers(shutdownHandler: SignalHandler): void {
  // Handle various shutdown signals
  process.on('SIGTERM', () => handleSignal('SIGTERM', shutdownHandler));
  process.on('SIGINT', () => handleSignal('SIGINT', shutdownHandler));
  process.on('SIGUSR2', () => handleSignal('SIGUSR2', shutdownHandler)); // Nodemon restart

  // Handle uncaught exceptions and rejections
  process.on('uncaughtException', async (error) => {
    logger.error('💥 Uncaught Exception:', error, { 
      component: 'SignalHandler',
      fatal: true 
    });
    
    try {
      await shutdownHandler('uncaughtException');
    } catch (shutdownError) {
      logger.error('Error during emergency shutdown:', shutdownError instanceof Error ? shutdownError : new Error(String(shutdownError)));
    }
    
    process.exit(1);
  });

  process.on('unhandledRejection', async (reason, promise) => {
    logger.error('🚫 Unhandled Rejection:', {
      component: 'SignalHandler',
      reason: reason instanceof Error ? reason.message : String(reason),
      promise: promise.toString(),
      fatal: true
    });
    
    try {
      await shutdownHandler('unhandledRejection');
    } catch (shutdownError) {
      logger.error('Error during emergency shutdown:', shutdownError instanceof Error ? shutdownError : new Error(String(shutdownError)));
    }
    
    process.exit(1);
  });
}

async function handleSignal(signal: string, handler: SignalHandler): Promise<void> {
  logger.daemon(`Received ${signal} signal`);
  
  try {
    await handler(signal);
  } catch (error) {
    logger.error(`Error handling ${signal}:`, error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
}