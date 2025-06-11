import { Command } from 'commander';
import { spawn } from 'child_process';

export function createDevCommands(program: Command): void {
  program
    .command('dev')
    .description('Start development environment with Novu Studio')
    .option('--novu-endpoint <url>', 'Custom Novu endpoint for self-hosted instances')
    .action(async (options) => {
      console.log('🚀 Starting XNovu development environment...');
      
      try {
        // Start Next.js dev server
        console.log('📦 Starting Next.js development server...');
        const nextDev = spawn('pnpm', ['dev'], {
          stdio: 'inherit',
          shell: true
        });

        // Wait a moment for Next.js to start
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Start Novu Studio
        console.log('🎨 Starting Novu Studio...');
        const novuArgs = ['novu@latest', 'dev'];
        
        if (options.novuEndpoint) {
          novuArgs.push('-d', options.novuEndpoint);
        }

        const novuStudio = spawn('npx', novuArgs, {
          stdio: 'inherit',
          shell: true
        });

        // Handle cleanup on exit
        const cleanup = () => {
          console.log('\n🛑 Shutting down development environment...');
          nextDev.kill();
          novuStudio.kill();
          process.exit(0);
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);

      } catch (error) {
        console.error('❌ Error starting development environment:', error);
        process.exit(1);
      }
    });
}