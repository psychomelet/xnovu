#!/usr/bin/env tsx

import { Command } from 'commander';
import { execSync, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const program = new Command();

program
  .name('xnovu')
  .description('XNovu CLI - Internal notification system management tools')
  .version('0.1.0');

program
  .command('generate-types')
  .description('Generate TypeScript types from Supabase database schema')
  .option('--project-id <id>', 'Supabase project ID (if not using local)')
  .option('--local', 'Generate types from local Supabase instance', false)
  .action(async (options) => {
    console.log('🔧 Generating Supabase types...');
    
    try {
      const outputPath = path.join(process.cwd(), 'lib', 'supabase', 'database.types.ts');
      
      // Ensure the output directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      let command: string;
      let args: string[];

      if (options.local) {
        // Generate types from local Supabase instance
        command = 'npx';
        args = [
          'supabase',
          'gen',
          'types',
          'typescript',
          '--local',
          '--schema=notify,base,shared_types',
          `--file=${outputPath}`
        ];
      } else {
        // Generate types from remote Supabase project
        const projectId = options.projectId || process.env.SUPABASE_PROJECT_ID;
        
        if (!projectId) {
          console.error('❌ Error: Project ID is required. Provide --project-id or set SUPABASE_PROJECT_ID environment variable.');
          process.exit(1);
        }

        command = 'npx';
        args = [
          'supabase',
          'gen',
          'types',
          'typescript',
          '--project-id',
          projectId,
          '--schema=notify,base,shared_types',
          `--file=${outputPath}`
        ];
      }

      console.log(`📍 Output path: ${outputPath}`);
      console.log(`🚀 Running: ${command} ${args.join(' ')}`);

      // Use spawn for better real-time output
      const child = spawn(command, args, {
        stdio: 'inherit',
        shell: true
      });

      child.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Successfully generated Supabase types!');
          console.log(`📁 Types saved to: ${outputPath}`);
        } else {
          console.error(`❌ Command failed with exit code ${code}`);
          process.exit(code || 1);
        }
      });

      child.on('error', (error) => {
        console.error('❌ Failed to start command:', error.message);
        process.exit(1);
      });

    } catch (error) {
      console.error('❌ Error generating types:', error);
      process.exit(1);
    }
  });

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

program
  .command('status')
  .description('Check XNovu system status and connections')
  .action(async () => {
    console.log('🔍 Checking XNovu system status...');
    
    try {
      // Check if Next.js app is running
      console.log('📦 Next.js application status...');
      try {
        const response = await fetch('http://localhost:4000/api/dev-studio-status');
        if (response.ok) {
          const data = await response.json();
          console.log('✅ Next.js app is running');
          console.log('📊 Status:', JSON.stringify(data, null, 2));
        } else {
          console.log('⚠️  Next.js app is not responding properly');
        }
      } catch {
        console.log('❌ Next.js app is not running (http://localhost:4000)');
      }

      // Check Supabase connection
      console.log('\n🗄️  Checking Supabase connection...');
      if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
        console.log('✅ Supabase environment variables are set');
        console.log(`📍 URL: ${process.env.SUPABASE_URL}`);
      } else {
        console.log('⚠️  Supabase environment variables not found');
      }

      // Check for required files
      console.log('\n📁 Checking required files...');
      const requiredFiles = [
        'lib/supabase/client.ts',
        'lib/supabase/types.ts',
        'app/novu/workflows/index.ts'
      ];

      requiredFiles.forEach(file => {
        const fullPath = path.join(process.cwd(), file);
        if (fs.existsSync(fullPath)) {
          console.log(`✅ ${file}`);
        } else {
          console.log(`❌ ${file} (missing)`);
        }
      });

    } catch (error) {
      console.error('❌ Error checking status:', error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();