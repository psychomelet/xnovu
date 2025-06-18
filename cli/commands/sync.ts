import { Command } from 'commander';
import { execSync } from 'child_process';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { allWorkflowMetadata } from '@/app/novu/workflow-metadata';

// Load environment variables
config();

async function syncToNovuCloud() {
  const BRIDGE_URL = process.env.NOVU_BRIDGE_URL;
  const SECRET_KEY = process.env.NOVU_SECRET_KEY;
  
  if (!BRIDGE_URL || !SECRET_KEY) {
    console.error('❌ Missing required environment variables:');
    if (!BRIDGE_URL) console.error('  - NOVU_BRIDGE_URL');
    if (!SECRET_KEY) console.error('  - NOVU_SECRET_KEY');
    throw new Error('Missing required environment variables');
  }
  
  console.log('🚀 Syncing workflows to Novu Cloud...');
  console.log(`   Bridge URL: ${BRIDGE_URL}`);
  
  try {
    // Execute the Novu sync command
    const command = `npx novu@latest sync --bridge-url=${BRIDGE_URL} --secret-key=${SECRET_KEY}`;
    console.log('   Running sync command...');
    
    execSync(command, { 
      stdio: 'inherit',
      env: { ...process.env }
    });
    
    console.log('✅ Successfully synced workflows to Novu Cloud!');
  } catch (error) {
    console.error('❌ Failed to sync to Novu Cloud:', error);
    throw error;
  }
}

async function syncToDatabase() {
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
    
    return results;
  } catch (error) {
    console.error('❌ Failed to sync to database:', error);
    throw error;
  }
}

async function verifyDatabase() {
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

async function syncWorkflows() {
  console.log('🔄 Starting XNovu Workflow Sync...\n');
  
  try {
    // First sync to Novu Cloud
    await syncToNovuCloud();
    
    // Then sync to database
    await syncToDatabase();
    
    // Verify the sync
    await verifyDatabase();
    
    console.log('\n🎉 All syncs completed successfully!');
  } catch (error) {
    console.error('\n❌ Sync process failed:', error);
    throw error;
  }
}

export function createSyncCommands(program: Command) {
  program
    .command('sync')
    .description('Sync workflows to Novu Cloud and database')
    .action(async () => {
      try {
        await syncWorkflows();
      } catch (error) {
        console.error('Sync failed:', error);
        process.exit(1);
      }
    });
}