/**
 * CLI commands for worker management
 */

import { Command } from 'commander';
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

export function createWorkerCommands(program: Command): void {
  const worker = program
    .command('worker')
    .description('Manage XNovu unified worker');

  worker
    .command('start')
    .description('Start the unified worker')
    .option('--dev', 'Start in development mode')
    .option('--enterprises <ids>', 'Comma-separated enterprise IDs')
    .option('--health-port <port>', 'Health check port', '3001')
    .option('--log-level <level>', 'Log level (debug, info, warn, error)', 'info')
    .action(async (options) => {
      try {
        console.log('🚀 Starting XNovu unified worker...');

        const env = {
          ...process.env,
          WORKER_HEALTH_PORT: options.healthPort,
          WORKER_LOG_LEVEL: options.logLevel,
        };

        if (options.enterprises) {
          env.WORKER_ENTERPRISE_IDS = options.enterprises;
        }

        const workerPath = path.join(process.cwd(), 'worker', 'index.ts');
        const args = options.dev ? ['tsx', workerPath] : ['node', '-r', 'tsx/cjs', workerPath];

        const worker = spawn(args[0], args.slice(1), {
          stdio: 'inherit',
          env,
        });

        worker.on('exit', (code) => {
          if (code === 0) {
            console.log('✅ Worker exited successfully');
          } else {
            console.error(`❌ Worker exited with code ${code}`);
            process.exit(code || 1);
          }
        });

        worker.on('error', (error) => {
          console.error('❌ Failed to start worker:', error);
          process.exit(1);
        });

        // Handle shutdown signals
        process.on('SIGINT', () => {
          console.log('\n📋 Received SIGINT, stopping worker...');
          worker.kill('SIGINT');
        });

        process.on('SIGTERM', () => {
          console.log('\n📋 Received SIGTERM, stopping worker...');
          worker.kill('SIGTERM');
        });

      } catch (error) {
        console.error('❌ Error starting worker:', error);
        process.exit(1);
      }
    });

  worker
    .command('stop')
    .description('Stop the unified worker')
    .action(async () => {
      try {
        console.log('⏹️ Stopping XNovu unified worker...');

        // Try to find and stop the worker process
        const { spawn } = await import('child_process');
        const pkill = spawn('pkill', ['-f', 'worker/index.ts']);

        pkill.on('exit', (code) => {
          if (code === 0) {
            console.log('✅ Worker stopped successfully');
          } else {
            console.log('ℹ️ No worker process found');
          }
        });

      } catch (error) {
        console.error('❌ Error stopping worker:', error);
        process.exit(1);
      }
    });

  worker
    .command('status')
    .description('Check worker status')
    .option('--port <port>', 'Health check port', '3001')
    .action(async (options) => {
      try {
        console.log('🔍 Checking worker status...');

        const response = await fetch(`http://localhost:${options.port}/health`);
        
        if (response.ok) {
          const status = await response.json();
          console.log('✅ Worker is running');
          console.log('📊 Status:', JSON.stringify(status, null, 2));
        } else {
          console.log('❌ Worker health check failed');
          process.exit(1);
        }

      } catch (error) {
        console.log('❌ Could not connect to worker');
        console.log('ℹ️ Worker may not be running or health endpoint unavailable');
        process.exit(1);
      }
    });

  worker
    .command('logs')
    .description('View worker logs')
    .option('--follow', 'Follow log output')
    .option('--lines <n>', 'Number of lines to show', '50')
    .action(async (options) => {
      try {
        console.log('📋 Viewing worker logs...');

        // In a real implementation, this would connect to a log aggregation system
        // For now, we'll just show a message about viewing logs
        console.log('ℹ️ Worker logs are output to stdout/stderr');
        console.log('ℹ️ Use Docker logs or your log aggregation system to view logs');
        
        if (options.follow) {
          console.log('ℹ️ To follow logs in Docker: docker logs -f <worker-container>');
        }

      } catch (error) {
        console.error('❌ Error viewing logs:', error);
        process.exit(1);
      }
    });

  worker
    .command('restart')
    .description('Restart the unified worker')
    .option('--dev', 'Restart in development mode')
    .option('--enterprises <ids>', 'Comma-separated enterprise IDs')
    .action(async (options) => {
      try {
        console.log('🔄 Restarting XNovu unified worker...');

        // Stop first
        const { spawn } = await import('child_process');
        const pkill = spawn('pkill', ['-f', 'worker/index.ts']);

        await new Promise((resolve) => {
          pkill.on('exit', resolve);
        });

        // Wait a bit for cleanup
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Start again
        const startOptions = {
          dev: options.dev,
          enterprises: options.enterprises,
        };

        // Re-use the start command logic
        console.log('🚀 Starting worker again...');
        
        const env = { ...process.env };
        if (options.enterprises) {
          env.WORKER_ENTERPRISE_IDS = options.enterprises;
        }

        const workerPath = path.join(process.cwd(), 'worker', 'index.ts');
        const args = options.dev ? ['tsx', workerPath] : ['node', '-r', 'tsx/cjs', workerPath];

        const worker = spawn(args[0], args.slice(1), {
          stdio: 'inherit',
          env,
        });

        worker.on('exit', (code) => {
          process.exit(code || 0);
        });

        worker.on('error', (error) => {
          console.error('❌ Failed to restart worker:', error);
          process.exit(1);
        });

      } catch (error) {
        console.error('❌ Error restarting worker:', error);
        process.exit(1);
      }
    });

  worker
    .command('health')
    .description('Detailed health check')
    .option('--port <port>', 'Health check port', '3001')
    .action(async (options) => {
      try {
        console.log('🏥 Performing detailed health check...');

        const endpoints = [
          { path: '/health', name: 'Basic Health' },
          { path: '/health/detailed', name: 'Detailed Health' },
          { path: '/health/subscriptions', name: 'Subscriptions' },
          { path: '/metrics', name: 'Metrics' },
        ];

        for (const endpoint of endpoints) {
          try {
            console.log(`\n📋 Checking ${endpoint.name}...`);
            
            const response = await fetch(`http://localhost:${options.port}${endpoint.path}`);
            
            if (response.ok) {
              const data = endpoint.path === '/metrics' 
                ? await response.text() 
                : await response.json();
              
              console.log(`✅ ${endpoint.name}: OK`);
              
              if (endpoint.path !== '/metrics') {
                console.log(JSON.stringify(data, null, 2));
              }
            } else {
              console.log(`❌ ${endpoint.name}: ${response.status} ${response.statusText}`);
            }
          } catch (error) {
            console.log(`❌ ${endpoint.name}: Connection failed`);
          }
        }

      } catch (error) {
        console.error('❌ Error performing health check:', error);
        process.exit(1);
      }
    });
}