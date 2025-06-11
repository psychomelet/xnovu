#!/usr/bin/env tsx

import { Command } from 'commander';
import { execSync, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { config } from 'dotenv';

// Always load .env and .env.local files
config();
config({ path: '.env.local' });

const program = new Command();

program
  .name('xnovu')
  .description('XNovu CLI - Internal notification system management tools')
  .version('0.1.0');

program
  .command('generate-types')
  .description('Generate TypeScript types from Supabase project')
  .action(async () => {
    console.log('🔧 Generating Supabase types from remote project...');
    
    try {
      const outputPath = path.join(process.cwd(), 'lib', 'supabase', 'database.types.ts');
      const projectId = process.env.SUPABASE_PROJECT_ID;
      
      if (!projectId) {
        console.error('❌ SUPABASE_PROJECT_ID not found in environment variables');
        console.log('💡 Make sure your .env file contains SUPABASE_PROJECT_ID');
        process.exit(1);
      }

      // Ensure the output directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      console.log(`📍 Project ID: ${projectId}`);
      console.log(`📍 Output path: ${outputPath}`);

      // Generate types from remote Supabase project
      const command = 'npx';
      const args = [
        'supabase',
        'gen',
        'types',
        'typescript',
        `--project-id=${projectId}`,
        '--schema=notify,base,shared_types'
      ];

      console.log(`🚀 Running: ${command} ${args.join(' ')}`);

      const child = spawn(command, args, {
        stdio: 'pipe',
        shell: true
      });

      let output = '';
      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.stderr?.on('data', (data) => {
        console.error(data.toString());
      });

      child.on('close', (code) => {
        if (code === 0) {
          // Write the output to the file
          fs.writeFileSync(outputPath, output, 'utf8');
          console.log('✅ Successfully generated Supabase types!');
          console.log(`📁 Types saved to: ${outputPath}`);
        } else {
          console.error(`❌ Command failed with exit code ${code}`);
          console.log('💡 Make sure you have:');
          console.log('   1. Supabase CLI installed: npm install -g supabase');
          console.log('   2. Valid SUPABASE_PROJECT_ID in .env');
          console.log('   3. Authenticated with Supabase: supabase login');
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
      // Check Supabase connection
      console.log('🗄️  Checking Supabase connection...');
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const databaseUrl = process.env.DATABASE_URL;
      
      if (supabaseUrl && supabaseAnonKey) {
        console.log('✅ Supabase environment variables are set');
        console.log(`📍 URL: ${supabaseUrl}`);
        console.log(`🔑 Anon Key: ${supabaseAnonKey.substring(0, 20)}...`);
        
        // Test Supabase connection
        try {
          const testResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${supabaseAnonKey}`
            }
          });
          
          if (testResponse.ok) {
            console.log('✅ Supabase API connection successful');
          } else {
            console.log('⚠️  Supabase API connection failed');
          }
        } catch (connError) {
          console.log('❌ Failed to connect to Supabase API');
        }
      } else {
        console.log('⚠️  Supabase environment variables not found');
      }

      // Check PostgreSQL connection
      if (databaseUrl) {
        console.log('\n🐘 Checking PostgreSQL connection...');
        console.log(`📍 Database URL: ${databaseUrl.replace(/:[^:@]*@/, ':***@')}`);
        
        try {
          // Test PostgreSQL connection using psql
          execSync(`psql "${databaseUrl}" -c "SELECT version();"`, { 
            stdio: 'pipe',
            timeout: 5000 
          });
          console.log('✅ PostgreSQL connection successful');
        } catch (pgError) {
          console.log('❌ PostgreSQL connection failed');
          console.log('💡 Make sure PostgreSQL client (psql) is installed');
        }
      } else {
        console.log('\n🐘 PostgreSQL connection...');
        console.log('⚠️  DATABASE_URL not found');
      }

      // Check Novu configuration
      console.log('\n🔔 Checking Novu configuration...');
      const novuSecretKey = process.env.NOVU_SECRET_KEY;
      const novuAppId = process.env.NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER;
      
      if (novuSecretKey && novuSecretKey !== 'your_cloud_secret_key') {
        console.log('✅ Novu secret key is configured');
      } else {
        console.log('⚠️  Novu secret key not configured (using default)');
      }
      
      if (novuAppId && novuAppId !== 'your_app_identifier') {
        console.log('✅ Novu application identifier is configured');
      } else {
        console.log('⚠️  Novu application identifier not configured (using default)');
      }

      // Check for required files
      console.log('\n📁 Checking required files...');
      const requiredFiles = [
        'lib/supabase/client.ts',
        'lib/supabase/database.types.ts',
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

      console.log('\n💡 To generate missing types, run: pnpm xnovu generate-types');


    } catch (error) {
      console.error('❌ Error checking status:', error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();