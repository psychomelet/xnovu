#!/usr/bin/env tsx

/**
 * Test script to verify that unpublished notifications are not triggered
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { triggerNotificationByUuid } from '../lib/notifications';
import type { Database } from '../lib/supabase/database.types';
import { v4 as uuidv4 } from 'uuid';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseKey);

async function testUnpublishedNotification() {
  console.log('🚀 Testing unpublished notification handling...\n');

  let testEnterpriseId = '00000000-0000-0000-0000-000000000001';
  const testSubscriberId = 'e31d847b-ba83-42ca-a3a9-404797c89366';
  const transactionId = uuidv4();
  
  try {
    // Step 1: Get yogo-email workflow
    console.log('📋 Getting yogo-email workflow...');
    
    const { data: workflow } = await supabase
      .schema('notify')
      .from('ent_notification_workflow')
      .select('*')
      .eq('workflow_key', 'yogo-email')
      .limit(1)
      .maybeSingle();

    if (!workflow) {
      throw new Error('yogo-email workflow not found');
    }

    const workflowId = workflow.id;
    console.log('✅ Found workflow with ID:', workflowId);
    
    if (workflow.enterprise_id) {
      testEnterpriseId = workflow.enterprise_id;
    }

    // Step 2: Create notification with DRAFT status
    console.log('\n📝 Creating notification with DRAFT publish_status...');
    const notificationData = {
      transaction_id: transactionId,
      name: 'Unpublished Test - ' + new Date().toISOString(),
      payload: {
        inAppSubject: 'This should not be sent',
        inAppBody: 'This notification is in DRAFT status and should not be triggered.'
      },
      recipients: [testSubscriberId],
      notification_workflow_id: workflowId,
      enterprise_id: testEnterpriseId,
      notification_status: 'PENDING' as const,
      publish_status: 'DRAFT' as const,  // NOT published
      channels: ['EMAIL', 'IN_APP'] as Database['shared_types']['Enums']['notification_channel_type'][]
    };

    const { data: notification, error: insertError } = await supabase
      .schema('notify')
      .from('ent_notification')
      .insert(notificationData)
      .select()
      .single();

    if (insertError) throw insertError;
    console.log('✅ Created notification:');
    console.log('   ID:', notification!.id);
    console.log('   Transaction ID:', notification!.transaction_id);
    console.log('   Publish Status:', notification!.publish_status);

    // Step 3: Try to trigger the unpublished notification
    console.log('\n🔔 Attempting to trigger unpublished notification...');
    const result = await triggerNotificationByUuid(
      notification!.transaction_id!
    );

    if (result.success) {
      console.error('\n❌ ERROR: Unpublished notification was triggered!');
      console.error('This should not happen - notifications with DRAFT status should be rejected.');
    } else {
      console.log('\n✅ Correctly rejected unpublished notification!');
      console.log('   Error message:', result.error);
    }

    // Step 4: Check that status wasn't changed
    console.log('\n📊 Verifying notification was not processed...');
    const { data: finalNotification } = await supabase
      .schema('notify')
      .from('ent_notification')
      .select('notification_status, publish_status, processed_at')
      .eq('id', notification!.id)
      .single();

    console.log('Final notification state:');
    console.log('   Status:', finalNotification?.notification_status);
    console.log('   Publish Status:', finalNotification?.publish_status);
    console.log('   Processed At:', finalNotification?.processed_at);

    if (finalNotification?.notification_status === 'PENDING' && !finalNotification?.processed_at) {
      console.log('\n✅ Test PASSED: Unpublished notifications are correctly rejected');
    } else {
      console.log('\n❌ Test FAILED: Notification status was changed when it should not have been');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testUnpublishedNotification()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });