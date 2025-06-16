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
  
  try {
    // Use the generated workflow metadata
    console.log(`   Found ${allWorkflowMetadata.length} workflows with metadata`);
    
    for (const metadata of allWorkflowMetadata) {
      console.log(`\n   Processing ${metadata.workflow_key}...`);
      console.log(`   Workflow key: ${metadata.workflow_key}`);
      console.log(`   Type: ${metadata.workflow_type}`);
      console.log(`   Channels: ${metadata.default_channels?.join(', ') || 'none'}`);
      
      // Check if workflow exists
      const { data: existing } = await supabase
        .schema('notify')
        .from('ent_notification_workflow')
        .select('id')
        .eq('workflow_key', metadata.workflow_key)
        .single();
      
      const workflowData: Database['notify']['Tables']['ent_notification_workflow']['Insert'] = {
        workflow_key: metadata.workflow_key,
        name: metadata.name,
        description: metadata.description,
        workflow_type: metadata.workflow_type,
        default_channels: metadata.default_channels,
        payload_schema: metadata.payload_schema as any,
        control_schema: metadata.control_schema as any,
        template_overrides: metadata.template_overrides as any || null,
        publish_status: metadata.publish_status,
        deactivated: metadata.deactivated,
        typ_notification_category_id: metadata.typ_notification_category_id || null,
        business_id: metadata.business_id || null,
        enterprise_id: metadata.enterprise_id || null,
      };
      
      if (existing) {
        // Update existing workflow
        const { error } = await supabase
          .schema('notify')
          .from('ent_notification_workflow')
          .update({
            ...workflowData,
            updated_at: new Date().toISOString()
          } as Database['notify']['Tables']['ent_notification_workflow']['Update'])
          .eq('workflow_key', metadata.workflow_key);
        
        if (error) {
          console.error(`   ❌ Failed to update ${metadata.workflow_key}:`, error);
        } else {
          console.log(`   ✅ Updated ${metadata.workflow_key}`);
        }
      } else {
        // Insert new workflow
        const { error } = await supabase
          .schema('notify')
          .from('ent_notification_workflow')
          .insert(workflowData);
        
        if (error) {
          console.error(`   ❌ Failed to insert ${metadata.workflow_key}:`, error);
        } else {
          console.log(`   ✅ Inserted ${metadata.workflow_key}`);
        }
      }
    }
    
    console.log('\n✅ Database sync completed!');
  } catch (error) {
    console.error('❌ Failed to sync to database:', error);
    throw error;
  }
}

export async function syncWorkflows() {
  console.log('🔄 Starting XNovu Workflow Sync (Metadata Based)...\n');
  
  try {
    // First sync to Novu Cloud
    await syncToNovuCloud();
    
    // Then sync to database
    await syncToDatabase();
    
    console.log('\n🎉 All syncs completed successfully!');
  } catch (error) {
    console.error('\n❌ Sync process failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  syncWorkflows().catch(() => process.exit(1));
}