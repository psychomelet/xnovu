#!/usr/bin/env tsx

/**
 * Test script for async notification triggering via Temporal
 * 
 * This script tests the async trigger functionality through Temporal workflows
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { notificationClient } from '../lib/temporal/client/notification-client';
import type { Database } from '../lib/supabase/database.types';
import { v4 as uuidv4 } from 'uuid';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Add delay utility
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function testAsyncTrigger() {
  console.log('🚀 Starting async notification trigger test...\n');

  let testEnterpriseId = '00000000-0000-0000-0000-000000000001';
  const testSubscriberId = 'e31d847b-ba83-42ca-a3a9-404797c89366';
  const transactionId = uuidv4();
  
  try {
    // Step 1: Ensure workflow exists
    console.log('📋 Checking for yogo-email workflow...');
    
    const { data: anyWorkflow } = await supabase
      .schema('notify')
      .from('ent_notification_workflow')
      .select('*')
      .eq('workflow_key', 'yogo-email')
      .limit(1)
      .maybeSingle();

    let workflowId: number;
    
    if (anyWorkflow) {
      workflowId = anyWorkflow.id;
      console.log('✅ Found existing yogo-email workflow with ID:', workflowId);
      
      if (anyWorkflow.enterprise_id) {
        testEnterpriseId = anyWorkflow.enterprise_id;
        console.log('   Using enterprise ID from existing workflow:', testEnterpriseId);
      }
    } else {
      // Create new workflow
      const { data: newWorkflow, error: workflowError } = await supabase
        .schema('notify')
        .from('ent_notification_workflow')
        .insert({
          name: 'Yogo Email',
          workflow_key: 'yogo-email',
          description: 'Email notification workflow for Yogo platform with in-app support',
          workflow_type: 'STATIC',
          enterprise_id: testEnterpriseId,
          default_channels: ['EMAIL', 'IN_APP']
        })
        .select()
        .single();

      if (workflowError) throw workflowError;
      workflowId = newWorkflow!.id;
      console.log('✅ Created yogo-email workflow with ID:', workflowId);
    }

    // Step 2: Create test notification
    console.log('\n📝 Creating test notification...');
    const notificationData = {
      transaction_id: transactionId,
      name: 'Async Temporal Test - ' + new Date().toISOString(),
      payload: {
        inAppSubject: '⚡ Async Temporal Test Notification',
        inAppBody: 'This notification was triggered asynchronously through Temporal workflows!'
      },
      recipients: [testSubscriberId],
      notification_workflow_id: workflowId,
      enterprise_id: testEnterpriseId,
      notification_status: 'PENDING' as const,
      publish_status: 'PUBLISH' as const,
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

    // Step 3: Trigger notification asynchronously
    console.log('\n🔔 Triggering notification asynchronously via Temporal...');
    const asyncResult = await notificationClient.asyncTriggerNotificationById(notification!.id);
    
    console.log('✅ Async trigger initiated:');
    console.log('   Workflow ID:', asyncResult.workflowId);
    console.log('   Run ID:', asyncResult.runId);

    // Step 4: Monitor workflow status
    console.log('\n⏳ Monitoring workflow status...');
    let isComplete = false;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max wait
    
    while (!isComplete && attempts < maxAttempts) {
      await delay(1000); // Wait 1 second between checks
      
      const status = await notificationClient.getWorkflowStatus(asyncResult.workflowId);
      console.log(`   Status check ${attempts + 1}:`, status.status, `(history: ${status.historyLength})`);
      
      if (!status.isRunning) {
        isComplete = true;
        console.log('✅ Workflow completed!');
        
        // Try to get the result
        try {
          const result = await notificationClient.getWorkflowResult(asyncResult.workflowId);
          console.log('\n📊 Workflow Result:');
          
          if (Array.isArray(result)) {
            console.log('   Multiple notifications processed:', result.length);
            result.forEach((r, index) => {
              console.log(`   Notification ${index + 1}:`);
              console.log('     - Success:', r.success);
              console.log('     - Notification ID:', r.notificationId);
              console.log('     - Status:', r.status);
            });
          } else {
            console.log('   Success:', result.success);
            console.log('   Notification ID:', result.notificationId);
            console.log('   Novu Transaction ID:', result.novuTransactionId);
            console.log('   Status:', result.status);
            
            if (result.details) {
              console.log('   Details:');
              console.log('     - Success Count:', result.details.successCount);
              console.log('     - Total Recipients:', result.details.totalRecipients);
              console.log('     - Duration:', result.details.duration + 'ms');
            }
          }
        } catch (error) {
          console.error('❌ Failed to get workflow result:', error);
        }
      }
      
      attempts++;
    }
    
    if (!isComplete) {
      console.log('⚠️  Workflow still running after 30 seconds...');
    }

    // Step 5: Check final notification status
    console.log('\n📊 Checking final notification status in database...');
    const { data: finalNotification } = await supabase
      .schema('notify')
      .from('ent_notification')
      .select('id, notification_status, publish_status, channels, processed_at, error_details')
      .eq('id', notification!.id)
      .single();

    console.log('Final notification state:');
    console.log('   ID:', finalNotification?.id);
    console.log('   Status:', finalNotification?.notification_status);
    console.log('   Channels:', finalNotification?.channels);
    console.log('   Processed At:', finalNotification?.processed_at);

    // Step 6: Test multiple notifications
    console.log('\n\n🔥 Testing batch async trigger...');
    
    // Create multiple notifications
    const batchNotifications = [];
    for (let i = 0; i < 3; i++) {
      const { data, error } = await supabase
        .schema('notify')
        .from('ent_notification')
        .insert({
          transaction_id: uuidv4(),
          name: `Batch Test ${i + 1} - ${new Date().toISOString()}`,
          payload: {
            inAppSubject: `Batch Notification ${i + 1}`,
            inAppBody: `This is batch notification ${i + 1} triggered via Temporal`
          },
          recipients: [testSubscriberId],
          notification_workflow_id: workflowId,
          enterprise_id: testEnterpriseId,
          notification_status: 'PENDING' as const,
          publish_status: 'PUBLISH' as const,
          channels: ['EMAIL', 'IN_APP'] as Database['shared_types']['Enums']['notification_channel_type'][]
        })
        .select()
        .single();
      
      if (error) throw error;
      batchNotifications.push(data!);
    }
    
    const notificationIds = batchNotifications.map(n => n.id);
    console.log('✅ Created batch notifications:', notificationIds);
    
    // Trigger batch
    const batchResult = await notificationClient.asyncTriggerMultipleNotifications(notificationIds);
    console.log('✅ Batch trigger initiated:');
    console.log('   Workflow ID:', batchResult.workflowId);
    console.log('   Run ID:', batchResult.runId);

    console.log('\n✨ Test completed successfully!');
    console.log('   - Check Temporal UI for workflow execution details');
    console.log('   - Check your email and in-app notifications');
    console.log('   - Monitor database for notification status updates');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testAsyncTrigger()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });