#!/usr/bin/env tsx

import { Command } from 'commander';
import { execSync, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { config } from 'dotenv';

// Docker configuration
const DEFAULT_REGISTRY = 'registry.cn-shanghai.aliyuncs.com/yogosystem';
const IMAGE_NAME = 'xnovu';

// Auto-tagging utilities
function getGitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function getGitVersion(): string {
  try {
    return execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function isWorkingTreeDirty(): boolean {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
    return status.length > 0;
  } catch {
    return false;
  }
}

function generateTags(): { tags: string[], localTag: string, commitId: string } {
  const gitSha = getGitSha();
  const version = getGitVersion();
  const isDirty = isWorkingTreeDirty();
  
  const commitId = `${gitSha}${isDirty ? '-dirty' : ''}`;
  const localTag = `${IMAGE_NAME}:${commitId}`;
  
  const tags = [gitSha];
  if (version) {
    tags.push(version);
  }
  tags.push('latest');
  
  return { tags, localTag, commitId };
}

function getBuildDate(): string {
  return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

// Load .env files with proper override precedence
// Load .env first (base/default values)
config({ path: '.env' });
// Load .env.local second with override enabled (overrides .env values)
config({ path: '.env.local', override: true });

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
  .command('docker:build')
  .description('Build Docker image for XNovu with auto-tagging')
  .option('-t, --tag <tag>', 'Override auto-generated tag')
  .option('--platform <platform>', 'Target platform (e.g., linux/amd64,linux/arm64)', 'linux/amd64')
  .option('--no-cache', 'Build without using cache')
  .action(async (options) => {
    console.log('🐳 Building Docker image for XNovu...');
    
    try {
      const { tags, localTag, commitId } = generateTags();
      const buildDate = getBuildDate();
      const isDirty = isWorkingTreeDirty();
      
      const targetTag = options.tag || localTag;
      
      console.log(`📋 Build info:`);
      console.log(`   Commit: ${commitId}`);
      console.log(`   Tags: ${tags.join(', ')}`);
      console.log(`   Local tag: ${targetTag}`);
      console.log(`   Platform: ${options.platform}`);
      if (isDirty) {
        console.log(`   ⚠️  Working tree is dirty`);
      }
      
      // Check if image already exists (skip if clean and exists)
      if (!isDirty && !options.tag) {
        try {
          execSync(`docker image inspect ${targetTag}`, { stdio: 'pipe' });
          console.log(`✅ Skipping: image for commit '${commitId}' already exists`);
          return;
        } catch {
          // Image doesn't exist, continue with build
        }
      }
      
      const args = ['buildx', 'build'];
      
      if (options.platform) {
        args.push('--platform', options.platform);
      }
      
      if (options.noCache) {
        args.push('--no-cache');
      }
      
      // Add labels
      args.push('--label', `org.opencontainers.image.revision=${commitId}`);
      args.push('--label', `org.opencontainers.image.created=${buildDate}`);
      
      // Add build args
      args.push('--build-arg', `VCS_REF=${commitId}`);
      args.push('--build-arg', `BUILD_DATE=${buildDate}`);
      
      args.push('-t', targetTag);
      args.push('--load');
      args.push('.');
      
      console.log(`🚀 Running: docker ${args.join(' ')}`);
      
      const dockerBuild = spawn('docker', args, {
        stdio: 'inherit',
        shell: true
      });
      
      dockerBuild.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ Successfully built Docker image: ${targetTag}`);
          console.log('💡 Run with: pnpm xnovu docker:run');
          console.log('💡 Push with: pnpm xnovu docker:push');
        } else {
          console.error(`❌ Docker build failed with exit code ${code}`);
          process.exit(code || 1);
        }
      });
      
      dockerBuild.on('error', (error) => {
        console.error('❌ Failed to start Docker build:', error.message);
        process.exit(1);
      });
      
    } catch (error) {
      console.error('❌ Error building Docker image:', error);
      process.exit(1);
    }
  });

program
  .command('docker:run')
  .description('Run XNovu Docker container')
  .option('-p, --port <port>', 'Host port to bind to', '3000')
  .option('-t, --tag <tag>', 'Override auto-generated tag')
  .option('-d, --detach', 'Run container in detached mode')
  .option('--env-file <file>', 'Environment file path', '.env.local')
  .action(async (options) => {
    console.log('🐳 Running XNovu Docker container...');
    
    try {
      const { localTag } = generateTags();
      const imageTag = options.tag || localTag;
      
      // Check if image exists
      try {
        execSync(`docker image inspect ${imageTag}`, { stdio: 'pipe' });
      } catch {
        console.error(`❌ Image ${imageTag} not found. Run 'pnpm xnovu docker:build' first.`);
        process.exit(1);
      }
      
      const args = ['run'];
      
      if (options.detach) {
        args.push('-d');
      }
      
      args.push('--rm'); // Auto-remove container when it stops
      args.push('-p', `${options.port}:3000`);
      
      // Add environment file if it exists
      if (fs.existsSync(options.envFile)) {
        args.push('--env-file', options.envFile);
        console.log(`📁 Using environment file: ${options.envFile}`);
      } else {
        console.log(`⚠️  Environment file ${options.envFile} not found, continuing without it`);
      }
      
      args.push('--name', 'xnovu-app');
      args.push(imageTag);
      
      console.log(`🚀 Running: docker ${args.join(' ')}`);
      console.log(`📋 Using image: ${imageTag}`);
      
      const dockerRun = spawn('docker', args, {
        stdio: 'inherit',
        shell: true
      });
      
      dockerRun.on('close', (code) => {
        if (code === 0) {
          if (options.detach) {
            console.log(`✅ XNovu container started successfully`);
            console.log(`🌐 Access at: http://localhost:${options.port}`);
            console.log('💡 Stop with: pnpm xnovu docker:stop');
            console.log('💡 View logs with: docker logs xnovu-app');
          }
        } else {
          console.error(`❌ Docker run failed with exit code ${code}`);
          process.exit(code || 1);
        }
      });
      
      dockerRun.on('error', (error) => {
        console.error('❌ Failed to start Docker container:', error.message);
        process.exit(1);
      });
      
    } catch (error) {
      console.error('❌ Error running Docker container:', error);
      process.exit(1);
    }
  });

program
  .command('docker:push')
  .description('Push Docker image to registry with auto-generated tags')
  .option('-r, --registry <registry>', 'Container registry', DEFAULT_REGISTRY)
  .option('--dry-run', 'Show what would be pushed without actually pushing')
  .action(async (options) => {
    console.log('🚀 Pushing Docker image to registry...');
    
    try {
      const { tags, localTag, commitId } = generateTags();
      const remoteImage = `${options.registry}/${IMAGE_NAME}`;
      
      console.log(`📋 Push info:`);
      console.log(`   Local image: ${localTag}`);
      console.log(`   Remote image: ${remoteImage}`);
      console.log(`   Tags to push: ${tags.join(', ')}`);
      console.log(`   Registry: ${options.registry}`);
      
      if (options.dryRun) {
        console.log('🧪 Dry run - showing what would be pushed:');
        for (const tag of tags) {
          console.log(`   Would push: ${remoteImage}:${tag}`);
        }
        return;
      }
      
      // Check if local image exists
      try {
        execSync(`docker image inspect ${localTag}`, { stdio: 'pipe' });
      } catch {
        console.error(`❌ Local image ${localTag} not found. Run 'pnpm xnovu docker:build' first.`);
        process.exit(1);
      }
      
      console.log(`🏷️  Tagging and pushing ${tags.length} tags...`);
      
      for (const tag of tags) {
        const remoteTag = `${remoteImage}:${tag}`;
        
        // Tag the image
        if (tag !== commitId.split('-')[0]) { // Don't retag if it's the same as local tag base
          console.log(`🏷️  Tagging ${localTag} -> ${remoteTag}`);
          try {
            execSync(`docker tag ${localTag} ${remoteTag}`, { stdio: 'pipe' });
          } catch (error) {
            console.error(`❌ Failed to tag image: ${error}`);
            continue;
          }
        }
        
        // Push the image
        console.log(`📤 Pushing ${remoteTag}...`);
        const pushProcess = spawn('docker', ['push', remoteTag], {
          stdio: 'inherit',
          shell: true
        });
        
        await new Promise((resolve, reject) => {
          pushProcess.on('close', (code) => {
            if (code === 0) {
              console.log(`✅ Successfully pushed ${remoteTag}`);
              resolve(code);
            } else {
              console.error(`❌ Failed to push ${remoteTag} (exit code: ${code})`);
              reject(new Error(`Push failed with code ${code}`));
            }
          });
          
          pushProcess.on('error', (error) => {
            console.error(`❌ Failed to start push for ${remoteTag}:`, error.message);
            reject(error);
          });
        });
      }
      
      console.log(`🎉 Successfully pushed all tags to ${options.registry}`);
      
    } catch (error) {
      console.error('❌ Error pushing Docker image:', error);
      process.exit(1);
    }
  });

program
  .command('docker:stop')
  .description('Stop and remove XNovu Docker container')
  .action(async () => {
    console.log('🛑 Stopping XNovu Docker container...');
    
    try {
      // Stop the container
      const stopResult = spawn('docker', ['stop', 'xnovu-app'], {
        stdio: 'pipe',
        shell: true
      });
      
      stopResult.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Container stopped successfully');
          
          // Remove the container
          const removeResult = spawn('docker', ['rm', 'xnovu-app'], {
            stdio: 'pipe',
            shell: true
          });
          
          removeResult.on('close', (removeCode) => {
            if (removeCode === 0) {
              console.log('✅ Container removed successfully');
            } else {
              console.log('⚠️  Failed to remove container (it may not exist)');
            }
          });
        } else {
          console.log('⚠️  Failed to stop container (it may not be running)');
        }
      });
      
    } catch (error) {
      console.error('❌ Error stopping Docker container:', error);
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