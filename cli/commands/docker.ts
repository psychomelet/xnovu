import { Command } from 'commander';
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import { generateTags, getBuildDate, isWorkingTreeDirty, DEFAULT_REGISTRY, IMAGE_NAME } from '../utils/docker.js';

export function createDockerCommands(program: Command): void {
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
}