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
  
  let connection: Connection | null = null;
  
  try {
    // Determine if TLS is needed based on address
    const isSecure = temporalAddress.includes(':443') || temporalAddress.startsWith('https://');
    
    // Try multiple connection configurations with shorter timeout for cleanup
    const connectionConfigs = [
      { tls: isSecure ? {} : false, connectTimeout: '5s' },
      { tls: isSecure ? { serverNameOverride: temporalAddress.split(':')[0] } : false, connectTimeout: '5s' },
    ];
    
    let lastError: any;
    for (const config of connectionConfigs) {
      try {
        connection = await Connection.connect({
          address: temporalAddress,
          ...config,
        });
        break;
      } catch (error: any) {
        lastError = error;
        continue;
      }
    }
    
    if (!connection) {
      // Check if it's a connection error that's expected in test environment
      if (lastError?.code === 'ECONNREFUSED' || 
          lastError?.message?.includes('ECONNREFUSED') ||
          lastError?.message?.includes('Failed to connect before the deadline') ||
          lastError?.message?.includes('14 UNAVAILABLE')) {
        console.log('⚠️  Temporal service not available for cleanup (this is normal in test environment)');
        return;
      }
      throw lastError;
    }
    
    const client = new TemporalClient({
      connection,
      namespace: temporalNamespace,
    });
    
    // List workflows containing the enterprise ID
    let cancelledCount = 0;
    try {
      // First try to list all workflows and filter client-side
      // Note: LIKE operator may not be supported in all Temporal deployments
      const handle = client.workflow.list({
        // List all workflows, we'll filter client-side
        pageSize: 100,
      });
      
      for await (const workflow of handle) {
        // Filter workflows that contain the enterprise ID
        if (workflow.workflowId.includes(enterpriseId)) {
          try {
            const wfHandle = client.workflow.getHandle(workflow.workflowId);
            await wfHandle.cancel();
            cancelledCount++;
          } catch (error) {
            // Workflow might already be completed - this is expected
          }
        }
      }
    } catch (listError: any) {
      // Try with a query if supported
      if (listError.message?.includes('invalid query') || listError.message?.includes('invalid operator')) {
        console.log('⚠️  Query-based workflow listing not supported, attempting alternative approach');
        
        try {
          // Try listing with a simple equality check on WorkflowType
          const handle = client.workflow.list({
            query: 'ExecutionStatus = "Running"',
            pageSize: 100,
          });
          
          for await (const workflow of handle) {
            if (workflow.workflowId.includes(enterpriseId)) {
              try {
                const wfHandle = client.workflow.getHandle(workflow.workflowId);
                await wfHandle.cancel();
                cancelledCount++;
              } catch (error) {
                // Workflow might already be completed
              }
            }
          }
        } catch (secondError: any) {
          // If we still can't list workflows, that's okay
          if (secondError.code === 12 || 
              secondError.message?.includes('404') || 
              secondError.message?.includes('PermissionDenied') ||
              secondError.message?.includes('Unauthorized')) {
            console.log('⚠️  Temporal workflow listing not available (insufficient permissions or mock service)');
          } else {
            console.log('⚠️  Could not list Temporal workflows:', secondError.message);
          }
        }
      } else if (listError.code === 12 || 
          listError.message?.includes('404') || 
          listError.message?.includes('PermissionDenied') ||
          listError.message?.includes('Unauthorized')) {
        console.log('⚠️  Temporal workflow listing not available (insufficient permissions or mock service)');
      } else {
        console.log('⚠️  Could not list Temporal workflows:', listError.message);
      }
    }
    
    if (cancelledCount > 0) {
      console.log(`🗑️  Cancelled ${cancelledCount} test workflows`);
    }
    
  } catch (error: any) {
    // Only log as error if it's not an expected connection issue
    if (error.code === 'ECONNREFUSED' || 
        error.message?.includes('ECONNREFUSED') ||
        error.message?.includes('Failed to connect before the deadline') ||
        error.message?.includes('14 UNAVAILABLE')) {
      console.log('⚠️  Temporal service not available for cleanup (this is normal in test environment)');
    } else {
      console.error('❌ Temporal cleanup error:', error.message || error);
    }
  } finally {
    // Always close the connection if it was established
    if (connection) {
      try {
        await connection.close();
      } catch (closeError) {
        // Ignore close errors
      }
    }
  }
}