/**
 * CLI commands for worker management
 */

import { Command } from 'commander';
import { spawn } from 'child_process';
import path from 'path';

export function createWorkerCommands(program: Command): void {
  const worker = program
    .command('worker')
    .description('Manage XNovu workers');

  worker
    .command('start')
    .description('Start a worker process')
    .option('--dev', 'Start in development mode')
    .option('--concurrency <n>', 'Worker concurrency', '5')
    .option('--log-level <level>', 'Log level (debug, info, warn, error)', 'info')
    .action(async (options) => {
      try {
        console.log('🔧 Starting XNovu worker...');

        const env = {
          ...process.env,
          WORKER_CONCURRENCY: options.concurrency,
          WORKER_LOG_LEVEL: options.logLevel,
        };

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
    .description('Stop all worker processes')
    .action(async () => {
      try {
        console.log('⏹️ Stopping XNovu workers...');

        const { spawn } = await import('child_process');
        const pkill = spawn('pkill', ['-f', 'worker/index.ts']);

        pkill.on('exit', (code) => {
          if (code === 0) {
            console.log('✅ Workers stopped successfully');
          } else {
            console.log('ℹ️ No worker processes found');
          }
        });

      } catch (error) {
        console.error('❌ Error stopping workers:', error);
        process.exit(1);
      }
    });

  worker
    .command('scale')
    .description('Scale worker processes')
    .argument('<count>', 'Number of workers to run')
    .option('--dev', 'Start in development mode')
    .option('--concurrency <n>', 'Worker concurrency per process', '5')
    .action(async (count, options) => {
      try {
        const workerCount = parseInt(count);
        if (isNaN(workerCount) || workerCount < 0) {
          console.error('❌ Invalid worker count');
          process.exit(1);
        }

        console.log(`🔧 Scaling to ${workerCount} worker processes...`);

        // Stop existing workers first
        const { spawn } = await import('child_process');
        const pkill = spawn('pkill', ['-f', 'worker/index.ts']);

        await new Promise((resolve) => {
          pkill.on('exit', resolve);
        });

        // Wait a bit for cleanup
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Start new workers
        const workers = [];
        const env = {
          ...process.env,
          WORKER_CONCURRENCY: options.concurrency,
        };

        const workerPath = path.join(process.cwd(), 'worker', 'index.ts');
        const args = options.dev ? ['tsx', workerPath] : ['node', '-r', 'tsx/cjs', workerPath];

        for (let i = 0; i < workerCount; i++) {
          console.log(`🔧 Starting worker ${i + 1}/${workerCount}...`);
          
          const worker = spawn(args[0], args.slice(1), {
            stdio: 'inherit',
            env: {
              ...env,
              WORKER_ID: `worker-${i + 1}`,
            },
          });

          worker.on('error', (error) => {
            console.error(`❌ Worker ${i + 1} failed to start:`, error);
          });

          workers.push(worker);
        }

        console.log(`✅ Started ${workerCount} worker processes`);

        // Handle shutdown signals
        const shutdownWorkers = () => {
          console.log('\n📋 Shutting down all workers...');
          workers.forEach((worker, index) => {
            console.log(`📋 Stopping worker ${index + 1}...`);
            worker.kill('SIGTERM');
          });
        };

        process.on('SIGINT', shutdownWorkers);
        process.on('SIGTERM', shutdownWorkers);

        // Wait for any worker to exit
        await Promise.race(workers.map(worker => 
          new Promise((resolve) => worker.on('exit', resolve))
        ));

      } catch (error) {
        console.error('❌ Error scaling workers:', error);
        process.exit(1);
      }
    });

  worker
    .command('list')
    .description('List running worker processes')
    .action(async () => {
      try {
        console.log('📋 Listing worker processes...');

        const { spawn } = await import('child_process');
        const pgrep = spawn('pgrep', ['-f', 'worker/index.ts']);

        let output = '';
        pgrep.stdout?.on('data', (data) => {
          output += data.toString();
        });

        pgrep.on('exit', (code) => {
          if (code === 0 && output.trim()) {
            const pids = output.trim().split('\n');
            console.log(`✅ Found ${pids.length} worker process(es):`);
            pids.forEach((pid, index) => {
              console.log(`  Worker ${index + 1}: PID ${pid}`);
            });
          } else {
            console.log('ℹ️ No worker processes found');
          }
        });

      } catch (error) {
        console.error('❌ Error listing workers:', error);
        process.exit(1);
      }
    });

  worker
    .command('status')
    .description('Check worker status via Redis/BullMQ')
    .action(async () => {
      try {
        console.log('📊 Checking worker status via queue statistics...');

        // This would require connecting to Redis and checking BullMQ statistics
        // For now, show a placeholder message
        console.log('ℹ️ Worker status can be viewed via Bull Board dashboard');
        console.log('ℹ️ Default Bull Board URL: http://localhost:3000');
        console.log('ℹ️ Or check queue statistics via daemon health endpoint');

      } catch (error) {
        console.error('❌ Error checking worker status:', error);
        process.exit(1);
      }
    });
}