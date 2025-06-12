/**
 * CLI commands for daemon management
 */

import { Command } from 'commander';
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

export function createDaemonCommands(program: Command): void {
  const daemon = program
    .command('daemon')
    .description('Manage XNovu unified daemon');

  daemon
    .command('start')
    .description('Start the unified daemon')
    .option('--dev', 'Start in development mode')
    .option('--enterprises <ids>', 'Comma-separated enterprise IDs')
    .option('--health-port <port>', 'Health check port', '3001')
    .option('--log-level <level>', 'Log level (debug, info, warn, error)', 'info')
    .action(async (options) => {
      try {
        console.log('🚀 Starting XNovu unified daemon...');

        const env = {
          ...process.env,
          DAEMON_HEALTH_PORT: options.healthPort,
          DAEMON_LOG_LEVEL: options.logLevel,
        };

        if (options.enterprises) {
          env.DAEMON_ENTERPRISE_IDS = options.enterprises;
        }

        const daemonPath = path.join(process.cwd(), 'daemon', 'index.ts');
        const args = options.dev ? ['tsx', daemonPath] : ['node', '-r', 'tsx/cjs', daemonPath];

        const daemon = spawn(args[0], args.slice(1), {
          stdio: 'inherit',
          env,
        });

        daemon.on('exit', (code) => {
          if (code === 0) {
            console.log('✅ Daemon exited successfully');
          } else {
            console.error(`❌ Daemon exited with code ${code}`);
            process.exit(code || 1);
          }
        });

        daemon.on('error', (error) => {
          console.error('❌ Failed to start daemon:', error);
          process.exit(1);
        });

        // Handle shutdown signals
        process.on('SIGINT', () => {
          console.log('\n📋 Received SIGINT, stopping daemon...');
          daemon.kill('SIGINT');
        });

        process.on('SIGTERM', () => {
          console.log('\n📋 Received SIGTERM, stopping daemon...');
          daemon.kill('SIGTERM');
        });

      } catch (error) {
        console.error('❌ Error starting daemon:', error);
        process.exit(1);
      }
    });

  daemon
    .command('stop')
    .description('Stop the unified daemon')
    .action(async () => {
      try {
        console.log('⏹️ Stopping XNovu unified daemon...');

        // Try to find and stop the daemon process
        const { spawn } = await import('child_process');
        const pkill = spawn('pkill', ['-f', 'daemon/index.ts']);

        pkill.on('exit', (code) => {
          if (code === 0) {
            console.log('✅ Daemon stopped successfully');
          } else {
            console.log('ℹ️ No daemon process found');
          }
        });

      } catch (error) {
        console.error('❌ Error stopping daemon:', error);
        process.exit(1);
      }
    });

  daemon
    .command('status')
    .description('Check daemon status')
    .option('--port <port>', 'Health check port', '3001')
    .action(async (options) => {
      try {
        console.log('🔍 Checking daemon status...');

        const response = await fetch(`http://localhost:${options.port}/health`);
        
        if (response.ok) {
          const status = await response.json();
          console.log('✅ Daemon is running');
          console.log('📊 Status:', JSON.stringify(status, null, 2));
        } else {
          console.log('❌ Daemon health check failed');
          process.exit(1);
        }

      } catch (error) {
        console.log('❌ Could not connect to daemon');
        console.log('ℹ️ Daemon may not be running or health endpoint unavailable');
        process.exit(1);
      }
    });

  daemon
    .command('logs')
    .description('View daemon logs')
    .option('--follow', 'Follow log output')
    .option('--lines <n>', 'Number of lines to show', '50')
    .action(async (options) => {
      try {
        console.log('📋 Viewing daemon logs...');

        // In a real implementation, this would connect to a log aggregation system
        // For now, we'll just show a message about viewing logs
        console.log('ℹ️ Daemon logs are output to stdout/stderr');
        console.log('ℹ️ Use Docker logs or your log aggregation system to view logs');
        
        if (options.follow) {
          console.log('ℹ️ To follow logs in Docker: docker logs -f <daemon-container>');
        }

      } catch (error) {
        console.error('❌ Error viewing logs:', error);
        process.exit(1);
      }
    });

  daemon
    .command('restart')
    .description('Restart the unified daemon')
    .option('--dev', 'Restart in development mode')
    .option('--enterprises <ids>', 'Comma-separated enterprise IDs')
    .action(async (options) => {
      try {
        console.log('🔄 Restarting XNovu unified daemon...');

        // Stop first
        const { spawn } = await import('child_process');
        const pkill = spawn('pkill', ['-f', 'daemon/index.ts']);

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
        console.log('🚀 Starting daemon again...');
        
        const env = { ...process.env };
        if (options.enterprises) {
          env.DAEMON_ENTERPRISE_IDS = options.enterprises;
        }

        const daemonPath = path.join(process.cwd(), 'daemon', 'index.ts');
        const args = options.dev ? ['tsx', daemonPath] : ['node', '-r', 'tsx/cjs', daemonPath];

        const daemon = spawn(args[0], args.slice(1), {
          stdio: 'inherit',
          env,
        });

        daemon.on('exit', (code) => {
          process.exit(code || 0);
        });

        daemon.on('error', (error) => {
          console.error('❌ Failed to restart daemon:', error);
          process.exit(1);
        });

      } catch (error) {
        console.error('❌ Error restarting daemon:', error);
        process.exit(1);
      }
    });

  daemon
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