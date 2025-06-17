import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { Client as TemporalClient, Connection } from '@temporalio/client';

export default async function globalTeardown() {
  console.log('\n🧹 Global test teardown starting...');
  
  const enterpriseId = process.env.TEST_ENTERPRISE_ID;
  if (!enterpriseId) {
    console.log('⚠️  No test enterprise ID found, skipping cleanup');
    return;
  }
  
  console.log(`🔍 Cleaning up data for enterprise ID: ${enterpriseId}`);
  
  // Clean up Supabase data
  await cleanupSupabase(enterpriseId);
  
  // Clean up Temporal workflows
  await cleanupTemporal(enterpriseId);
  
  console.log('✅ Global test teardown complete\n');
}

async function cleanupSupabase(enterpriseId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('⚠️  Supabase credentials not found, skipping Supabase cleanup');
    return;
  }
  
  try {
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });
    
    // Delete notifications
    const { error: notificationError, count: notificationCount } = await supabase
      .schema('notify')
      .from('ent_notification')
      .delete()
      .eq('enterprise_id', enterpriseId);
    
    if (notificationError) {
      console.error('❌ Error deleting notifications:', notificationError);
    } else {
      console.log(`🗑️  Deleted ${notificationCount || 0} test notifications`);
    }
    
    // Delete workflows created by tests
    const { error: workflowError, count: workflowCount } = await supabase
      .schema('notify')
      .from('ent_notification_workflow')
      .delete()
      .eq('enterprise_id', enterpriseId);
    
    if (workflowError) {
      console.error('❌ Error deleting workflows:', workflowError);
    } else {
      console.log(`🗑️  Deleted ${workflowCount || 0} test workflows`);
    }
    
    // Delete templates
    const { error: templateError, count: templateCount } = await supabase
      .schema('notify')
      .from('ent_notification_template')
      .delete()
      .eq('enterprise_id', enterpriseId);
    
    if (templateError) {
      console.error('❌ Error deleting templates:', templateError);
    } else {
      console.log(`🗑️  Deleted ${templateCount || 0} test templates`);
    }
    
  } catch (error) {
    console.error('❌ Supabase cleanup error:', error);
  }
}

async function cleanupTemporal(enterpriseId: string) {
  const temporalAddress = process.env.TEMPORAL_ADDRESS;
  const temporalNamespace = process.env.TEMPORAL_NAMESPACE;
  
  if (!temporalAddress || !temporalNamespace) {
    console.log('⚠️  Temporal configuration not found, skipping Temporal cleanup');
    return;
  }
  
  try {
    const connection = await Connection.connect({
      address: temporalAddress,
      connectTimeout: '10s',
    });
    
    const client = new TemporalClient({
      connection,
      namespace: temporalNamespace,
    });
    
    // List workflows containing the enterprise ID
    let cancelledCount = 0;
    try {
      const handle = client.workflow.list({
        query: `WorkflowId LIKE "%${enterpriseId}%"`,
      });
      
      for await (const workflow of handle) {
        try {
          const wfHandle = client.workflow.getHandle(workflow.workflowId);
          await wfHandle.cancel();
          cancelledCount++;
        } catch (error) {
          // Workflow might already be completed
          console.log(`⚠️  Could not cancel workflow ${workflow.workflowId}:`, error);
        }
      }
    } catch (listError: any) {
      // If we can't list workflows (e.g., 404 or no permission), that's okay
      if (listError.code === 12 || listError.message?.includes('404')) {
        console.log('⚠️  Temporal workflow listing not available (might be using mock or limited permissions)');
      } else {
        console.log('⚠️  Could not list Temporal workflows:', listError.message);
      }
    }
    
    if (cancelledCount > 0) {
      console.log(`🗑️  Cancelled ${cancelledCount} test workflows`);
    }
    
    await connection.close();
  } catch (error: any) {
    // Only log as error if it's not a connection issue (which might be expected in test environment)
    if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED')) {
      console.log('⚠️  Temporal service not available for cleanup');
    } else {
      console.error('❌ Temporal cleanup error:', error.message || error);
    }
  }
}