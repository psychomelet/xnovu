import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

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
  
  // Verify cleanup is complete
  await verifyCleanup(enterpriseId);
  
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
    
    // Delete in correct order to respect foreign key constraints
    
    // 1. Delete notifications (references workflows, rules, categories, priorities)
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
    
    // 2. Delete notification rules (references workflows)
    const { error: ruleError, count: ruleCount } = await supabase
      .schema('notify')
      .from('ent_notification_rule')
      .delete()
      .eq('enterprise_id', enterpriseId);
    
    if (ruleError) {
      console.error('❌ Error deleting notification rules:', ruleError);
    } else {
      console.log(`🗑️  Deleted ${ruleCount || 0} test notification rules`);
    }
    
    // 3. Delete templates (references workflows)
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
    
    // 4. Delete workflows (no dependencies after above deletions)
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
    
    // Note: typ_notification_category and typ_notification_priority are typically
    // shared reference tables and should not have test-specific data
    
  } catch (error) {
    console.error('❌ Supabase cleanup error:', error);
  }
}

async function verifyCleanup(enterpriseId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return;
  }
  
  try {
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });
    
    console.log('\n🔍 Verifying cleanup completeness...');
    
    // Check each table for remaining data
    const tables = [
      { name: 'ent_notification', displayName: 'notifications' },
      { name: 'ent_notification_rule', displayName: 'notification rules' },
      { name: 'ent_notification_template', displayName: 'templates' },
      { name: 'ent_notification_workflow', displayName: 'workflows' }
    ];
    
    let hasRemainingData = false;
    
    for (const table of tables) {
      const { count, error } = await supabase
        .schema('notify')
        .from(table.name as any)
        .select('*', { count: 'exact', head: true })
        .eq('enterprise_id', enterpriseId);
      
      if (error) {
        console.error(`❌ Error checking ${table.displayName}:`, error.message);
      } else if (count && count > 0) {
        console.warn(`⚠️  Found ${count} remaining ${table.displayName} for enterprise ${enterpriseId}`);
        hasRemainingData = true;
      }
    }
    
    if (!hasRemainingData) {
      console.log('✅ All test data successfully cleaned up');
    } else {
      console.warn('⚠️  Some test data remains - manual cleanup may be required');
    }
    
  } catch (error) {
    console.error('❌ Verification error:', error);
  }
}