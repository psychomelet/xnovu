import { Command } from 'commander';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { allWorkflowMetadata } from '@/app/novu/workflow-metadata';
import { execa } from 'execa';
import type { ExecaChildProcess } from 'execa';
import { TunnelManager } from '../utils/tunnel-manager';

// Load environment variables
config();

interface SyncOptions {
  dev?: boolean;
  production?: boolean;
  tunnelSubdomain?: string;
  port?: number;
  keepAlive?: boolean;
}

class SyncManager {
  private tunnelManager?: TunnelManager;
  private tunnelUrl?: string;
  private serverProcess?: ExecaChildProcess;
  private port: number;
  private isProduction: boolean;
  private tunnelSubdomain?: string;
  private keepAlive: boolean;

  constructor(options: SyncOptions) {
    // Use random port if not specified to avoid conflicts
    this.port = options.port ? parseInt(options.port as any) : this.getRandomPort();
    this.isProduction = options.production || false;
    this.tunnelSubdomain = options.tunnelSubdomain;
    this.keepAlive = options.keepAlive || false;
  }

  private getRandomPort(): number {
    // Generate random port between 3000 and 9000
    return Math.floor(Math.random() * 6000) + 3000;
  }

  async startServer(): Promise<void> {
    if (this.isProduction) {
      console.log('📦 Production mode - using existing NOVU_BRIDGE_URL from environment');
      return;
    }

    // Ensure port is available
    const maxRetries = 5;
    for (let i = 0; i < maxRetries; i++) {
      const isAvailable = await this.isPortAvailable(this.port);
      if (isAvailable) {
        break;
      }
      console.log(`⚠️  Port ${this.port} is in use, trying another...`);
      this.port = this.getRandomPort();
    }

    console.log(`🚀 Starting Next.js server on port ${this.port}...`);

    // Start the Next.js server in the background
    // Always use the full command to specify our port
    const devCommand = ['next', 'dev', '--turbopack', `--port=${this.port}`];

    this.serverProcess = execa('pnpm', devCommand, {
      env: {
        ...process.env,
      },
      stdio: 'pipe',
    });

    // Wait for server to be ready
    await this.waitForServer();
    console.log('✅ Next.js server is ready');
  }

  private async waitForServer(maxAttempts = 30): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`http://localhost:${this.port}/api/novu`);
        if (response.ok) {
          return;
        }
      } catch (error) {
        // Server not ready yet
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error('Server failed to start within timeout period');
  }

  private async isPortAvailable(port: number): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:${port}/`);
      // If we get a response, port is in use
      return false;
    } catch (error) {
      // If connection fails, port is available
      return true;
    }
  }

  async createTunnel(subdomain?: string, onStabilizing?: () => Promise<void>): Promise<string> {
    if (this.isProduction) {
      const bridgeUrl = process.env.NOVU_BRIDGE_URL;
      if (!bridgeUrl) {
        throw new Error('NOVU_BRIDGE_URL is required in production mode');
      }
      return bridgeUrl;
    }

    this.tunnelManager = new TunnelManager();
    const { url } = await this.tunnelManager.createTunnel({
      port: this.port,
      subdomain,
      onStabilizing
    });

    this.tunnelUrl = `${url}/api/novu`;
    return this.tunnelUrl;
  }

  async syncToNovuCloud(bridgeUrl: string): Promise<void> {
    const SECRET_KEY = process.env.NOVU_SECRET_KEY;
    const API_URL = process.env.NOVU_API_URL;

    if (!SECRET_KEY) {
      throw new Error('Missing required environment variable: NOVU_SECRET_KEY');
    }

    console.log('\n🚀 Syncing workflows to Novu Cloud...');
    console.log(`   Bridge URL: ${bridgeUrl}`);
    if (API_URL) {
      console.log(`   API URL: ${API_URL}`);
    }

    try {
      // Test bridge URL returns expected response before syncing
      console.log('   Verifying bridge URL...');
      const testResponse = await fetch(bridgeUrl);
      if (!testResponse.ok) {
        throw new Error(`Bridge URL returned status ${testResponse.status}`);
      }

      const data = await testResponse.json();
      if (data.status !== 'ok') {
        throw new Error(`Bridge URL returned unexpected response: ${JSON.stringify(data)}`);
      }
      console.log(`   ✅ Bridge URL verified - Workflows: ${data.discovered?.workflows || 0}, Steps: ${data.discovered?.steps || 0}`);

      // Execute the Novu sync command
      const syncArgs = ['novu@latest', 'sync', `--bridge-url=${bridgeUrl}`, `--secret-key=${SECRET_KEY}`];
      
      // Add API URL if provided for self-hosted instances
      if (API_URL) {
        syncArgs.push(`--api-url=${API_URL}`);
      }

      console.log('   Running sync command...');
      console.log('   Command: npx novu@latest sync [REDACTED]');

      try {
        // Use execa instead of execSync for better error handling
        const { stdout, stderr } = await execa('npx', syncArgs, {
          timeout: 60000,
          env: { ...process.env }
        });

        if (stdout) {
          console.log(stdout);
        }
        if (stderr) {
          console.error(stderr);
        }

        console.log('✅ Successfully synced workflows to Novu Cloud!');
      } catch (execError: any) {
        // If execa fails, log more details
        console.error('   Command execution failed:');
        if (execError.stdout) {
          console.log('   STDOUT:', execError.stdout);
        }
        if (execError.stderr) {
          console.error('   STDERR:', execError.stderr);
        }
        if (execError.exitCode !== undefined) {
          console.error('   Exit code:', execError.exitCode);
        }
        throw execError;
      }
    } catch (error: any) {
      console.error('❌ Failed to sync to Novu Cloud:', error.message || error);

      // If it's a timeout error, provide helpful message
      if (error.message?.includes('timeout') || error.message?.includes('Bridge request timeout')) {
        console.log('\n💡 Tip: The tunnel might be slow. Try running the sync command manually:');
        console.log(`   npx novu@latest sync --bridge-url=${bridgeUrl} --secret-key=<YOUR_SECRET_KEY>\n`);
      }

      throw error;
    }
  }

  async syncToDatabase(): Promise<void> {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error('❌ Missing required environment variables:');
      if (!SUPABASE_URL) console.error('  - NEXT_PUBLIC_SUPABASE_URL');
      if (!SUPABASE_SERVICE_KEY) console.error('  - SUPABASE_SERVICE_ROLE_KEY');
      throw new Error('Missing required environment variables');
    }

    console.log('\n📊 Syncing workflows to Supabase database...');

    // Initialize Supabase client
    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const results = {
      inserted: [] as string[],
      updated: [] as string[],
      errors: [] as { workflow: string; error: any }[],
    };

    try {
      console.log(`   Found ${allWorkflowMetadata.length} workflows with metadata\n`);

      for (const metadata of allWorkflowMetadata) {
        console.log(`   Processing ${metadata.workflow_key}...`);

        // Check if workflow exists
        const { data: existing, error: fetchError } = await supabase
          .schema('notify')
          .from('ent_notification_workflow')
          .select('id')
          .eq('workflow_key', metadata.workflow_key)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = not found
          console.error(`   ❌ Error fetching: ${fetchError.message}`);
          results.errors.push({ workflow: metadata.workflow_key, error: fetchError });
          continue;
        }

        const workflowData: Database['notify']['Tables']['ent_notification_workflow']['Insert'] = {
          workflow_key: metadata.workflow_key,
          name: metadata.name,
          description: metadata.description,
          workflow_type: metadata.workflow_type,
          default_channels: metadata.default_channels,
          payload_schema: metadata.payload_schema as any,
          control_schema: metadata.control_schema as any,
          template_overrides: metadata.template_overrides as any || null,
          publish_status: metadata.publish_status || 'DRAFT',
          deactivated: metadata.deactivated || false,
          typ_notification_category_id: metadata.typ_notification_category_id || null,
          business_id: metadata.business_id || null,
          enterprise_id: metadata.enterprise_id || null,
        };

        if (existing) {
          // Update existing workflow
          const { error } = await supabase
            .schema('notify')
            .from('ent_notification_workflow')
            .update(workflowData as Database['notify']['Tables']['ent_notification_workflow']['Update'])
            .eq('workflow_key', metadata.workflow_key);

          if (error) {
            console.error(`   ❌ Failed to update: ${error.message}`);
            results.errors.push({ workflow: metadata.workflow_key, error });
          } else {
            console.log(`   ✅ Updated`);
            results.updated.push(metadata.workflow_key);
          }
        } else {
          // Insert new workflow
          const { error } = await supabase
            .schema('notify')
            .from('ent_notification_workflow')
            .insert(workflowData);

          if (error) {
            console.error(`   ❌ Failed to insert: ${error.message}`);
            results.errors.push({ workflow: metadata.workflow_key, error });
          } else {
            console.log(`   ✅ Inserted`);
            results.inserted.push(metadata.workflow_key);
          }
        }
      }

      // Print summary
      console.log('\n📋 Database Sync Summary:');
      console.log(`   ✅ Inserted: ${results.inserted.length} workflows`);
      if (results.inserted.length > 0) {
        console.log(`      ${results.inserted.join(', ')}`);
      }
      console.log(`   ✅ Updated: ${results.updated.length} workflows`);
      if (results.updated.length > 0) {
        console.log(`      ${results.updated.join(', ')}`);
      }
      if (results.errors.length > 0) {
        console.log(`   ❌ Errors: ${results.errors.length} workflows`);
        results.errors.forEach(({ workflow, error }) => {
          console.log(`      ${workflow}: ${error.message}`);
        });
      }
    } catch (error) {
      console.error('❌ Failed to sync to database:', error);
      throw error;
    }
  }

  async verifyDatabase(): Promise<void> {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return; // Skip verification if no credentials
    }

    console.log('\n🔍 Verifying database sync...');

    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    try {
      // Query workflows
      const { data: workflows, error } = await supabase
        .schema('notify')
        .from('ent_notification_workflow')
        .select('workflow_key, name, workflow_type, default_channels')
        .in('workflow_key', allWorkflowMetadata.map(m => m.workflow_key))
        .order('workflow_key');

      if (error) {
        console.error('   ❌ Failed to verify:', error.message);
        return;
      }

      if (!workflows || workflows.length === 0) {
        console.log('   ⚠️  No workflows found in database');
        return;
      }

      console.log(`   ✅ Verified ${workflows.length} workflows in database`);

      // Check for missing workflows
      const dbWorkflowKeys = new Set(workflows.map(w => w.workflow_key));
      const missingInDb = allWorkflowMetadata
        .map(m => m.workflow_key)
        .filter(key => !dbWorkflowKeys.has(key));

      if (missingInDb.length > 0) {
        console.log(`   ⚠️  Missing in database: ${missingInDb.join(', ')}`);
      }
    } catch (error) {
      console.error('   ❌ Verification failed:', error);
    }
  }

  async cleanup(): Promise<void> {
    if (this.keepAlive) {
      console.log('\n🔌 Keeping tunnel and server alive...');
      console.log(`   📡 Bridge URL: ${this.tunnelUrl}`);
      console.log(`   🖥️  Server running on port: ${this.port}`);
      console.log('   Press Ctrl+C to stop');

      // Set up graceful shutdown
      process.on('SIGINT', () => {
        console.log('\n🧹 Shutting down...');
        if (this.tunnelManager) {
          this.tunnelManager.closeTunnel();
        }
        if (this.serverProcess) {
          this.serverProcess.kill();
        }
        process.exit(0);
      });

      // Keep process alive
      await new Promise(() => {});
    } else {
      console.log('\n🧹 Cleaning up...');

      if (this.tunnelManager) {
        this.tunnelManager.closeTunnel();
        console.log('   ✅ Tunnel closed');
      }

      if (this.serverProcess) {
        this.serverProcess.kill();
        console.log('   ✅ Server stopped');
      }
    }
  }

  async run(): Promise<void> {
    console.log('🔄 Starting XNovu Workflow Sync...\n');

    try {
      // Start server (if in dev mode)
      await this.startServer();

      let databaseSyncPromise: Promise<void> | null = null;
      let databaseSyncCompleted = false;

      // Create tunnel with database sync during stabilization
      const bridgeUrl = await this.createTunnel(this.tunnelSubdomain, async () => {
        // Run database sync during the 15-second stabilization wait
        console.log('\n📊 Running database sync while tunnel stabilizes...');
        databaseSyncPromise = this.syncToDatabase()
          .then(() => {
            databaseSyncCompleted = true;
            console.log('✅ Database sync completed during tunnel stabilization');
          })
          .catch(error => {
            console.error('⚠️  Database sync failed during tunnel stabilization:', error);
            // Don't fail the entire process, we'll try again later if needed
          });
        
        // Wait for either database sync to complete or 15 seconds
        await Promise.race([
          databaseSyncPromise,
          new Promise(resolve => setTimeout(resolve, 15000))
        ]);
      });

      // If database sync didn't complete during tunnel stabilization, ensure it's done
      if (!databaseSyncCompleted && databaseSyncPromise) {
        console.log('⏳ Waiting for database sync to complete...');
        await databaseSyncPromise;
      } else if (!databaseSyncCompleted) {
        // Run database sync if it hasn't been started yet
        await this.syncToDatabase();
      }

      // Sync to Novu Cloud
      await this.syncToNovuCloud(bridgeUrl);

      // Verify the database sync happened correctly
      await this.verifyDatabase();

      console.log('\n🎉 All syncs completed successfully!');
    } catch (error) {
      console.error('\n❌ Sync process failed:', error);
      throw error;
    } finally {
      // Always cleanup resources
      await this.cleanup();
    }
  }
}

export function createSyncCommands(program: Command) {
  program
    .command('sync')
    .description('Sync workflows to Novu Cloud and database')
    .option('--dev', 'Use LocalTunnel for development (default)', true)
    .option('--production', 'Use NOVU_BRIDGE_URL from environment')
    .option('--tunnel-subdomain <subdomain>', 'Custom subdomain for LocalTunnel')
    .option('--port <port>', 'Port for local server (random if not specified)')
    .option('--keep-alive', 'Keep tunnel and server running after sync')
    .action(async (options: SyncOptions) => {
      try {
        const syncManager = new SyncManager(options);
        await syncManager.run();
      } catch (error) {
        console.error('Sync failed:', error);
        process.exit(1);
      }
    });
}