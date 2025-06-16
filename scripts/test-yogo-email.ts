#!/usr/bin/env tsx

/**
 * Test script for yogo-email workflow
 * 
 * This script tests the yogo-email workflow through the Temporal trigger function
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

async function testYogoEmail() {
  console.log('🚀 Starting yogo-email workflow test...\n');

  let testEnterpriseId = '00000000-0000-0000-0000-000000000001';
  const testSubscriberId = 'e31d847b-ba83-42ca-a3a9-404797c89366';
  const transactionId = uuidv4();
  
  try {
    // Step 1: Ensure yogo-email workflow exists in database
    console.log('📋 Checking for yogo-email workflow...');
    
    // First check if workflow exists regardless of enterprise_id
    const { data: anyWorkflow } = await supabase
      .schema('notify')
      .from('ent_notification_workflow')
      .select('*')
      .eq('workflow_key', 'yogo-email')
      .limit(1)
      .maybeSingle();

    let workflowId: number;
    
    if (anyWorkflow) {
      // Use existing workflow, regardless of enterprise_id
      workflowId = anyWorkflow.id;
      console.log('✅ Found existing yogo-email workflow with ID:', workflowId);
      console.log('   Enterprise ID:', anyWorkflow.enterprise_id);
      
      // Update testEnterpriseId to match the existing workflow
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

    // Step 2: Create notification with yogo-email payload schema
    console.log('\n📝 Creating notification with yogo-email payload...');
    const notificationData = {
      transaction_id: transactionId,
      name: 'Yogo Email Test - ' + new Date().toISOString(),
      payload: {
        // These fields match the yogoEmailPayloadSchema
        inAppSubject: '🎉 Welcome to Yogo Platform!',
        inAppBody: 'This is a test notification from the Temporal-Novu integration. The yogo-email workflow is working correctly.'
      },
      recipients: [testSubscriberId],
      notification_workflow_id: workflowId,
      enterprise_id: testEnterpriseId,
      notification_status: 'PENDING' as const,
      overrides: {
        // Optional: Override email controls
        email: {
          subject: 'Test Email from Yogo Platform',
          showHeader: true,
          components: ['header', 'content', 'footer']
        }
      }
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

    // Step 3: Trigger using temporal function
    console.log('\n🔔 Triggering yogo-email workflow via temporal function...');
    const result = await triggerNotificationByUuid(
      notification!.transaction_id,  // Use transaction_id, not id
      testEnterpriseId
    );

    if (result.success) {
      console.log('\n✅ Successfully triggered yogo-email workflow!');
      console.log('   Notification ID:', result.notificationId);
      console.log('   Novu Transaction ID:', result.novuTransactionId);
      
      if (result.details) {
        console.log('   Recipients:', result.details.totalRecipients);
        console.log('   Successful:', result.details.successCount);
        console.log('   Duration:', result.details.duration + 'ms');
        
        if (result.details.results && result.details.results.length > 0) {
          console.log('   Novu Results:');
          result.details.results.forEach((nr: any, idx: number) => {
            console.log(`     Recipient ${idx + 1}:`, nr.recipientId);
            console.log(`       - Success:`, nr.success);
            if (nr.transactionId) {
              console.log(`       - Transaction:`, nr.transactionId);
            }
            if (nr.error) {
              console.log(`       - Error:`, nr.error);
            }
          });
        }
      }
    } else {
      console.error('\n❌ Failed to trigger:', result.error);
      if (result.details) {
        console.error('Details:', JSON.stringify(result.details, null, 2));
      }
    }

    // Step 4: Check final status
    console.log('\n📊 Checking final notification status...');
    const { data: finalNotification } = await supabase
      .schema('notify')
      .from('ent_notification')
      .select('id, notification_status, processed_at, novu_transaction_ids, error_details')
      .eq('id', notification!.id)
      .single();

    console.log('Final notification state:', finalNotification);

    console.log('\n✨ Test completed! Check your:');
    console.log('   - Email inbox for the test email');
    console.log('   - Novu Cloud dashboard: https://dashboard.novu.co/');
    console.log('   - In-app notifications (if integrated in your app)');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testYogoEmail()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });