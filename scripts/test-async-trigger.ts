#!/usr/bin/env tsx

/**
 * Test script for async notification triggering via database polling
 * 
 * This script tests the async trigger functionality by inserting notifications
 * into the database and monitoring their status changes
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../lib/supabase/database.types';
import { v4 as uuidv4 } from 'uuid';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Add delay utility
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function testAsyncTrigger() {
  console.log('🚀 Starting async notification trigger test (database polling mode)...\n');

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
        inAppSubject: '⚡ Async Database Polling Test',
        inAppBody: 'This notification was triggered through database polling and Temporal workflows!'
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
    console.log('   Status:', notification!.notification_status);

    // Step 3: Monitor notification status changes
    console.log('\n⏳ Monitoring notification status (polling will pick it up)...');
    let isComplete = false;
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds max wait
    let lastStatus = notification!.notification_status;
    
    while (!isComplete && attempts < maxAttempts) {
      await delay(1000); // Wait 1 second between checks
      
      const { data: currentNotification, error: fetchError } = await supabase
        .schema('notify')
        .from('ent_notification')
        .select('*')
        .eq('id', notification!.id)
        .single();
      
      if (fetchError) {
        console.error('Error fetching notification:', fetchError);
        break;
      }
      
      if (currentNotification!.notification_status !== lastStatus) {
        console.log(`   Status changed: ${lastStatus} -> ${currentNotification!.notification_status}`);
        lastStatus = currentNotification!.notification_status;
      }
      
      if (currentNotification!.notification_status === 'SENT' || 
          currentNotification!.notification_status === 'FAILED') {
        isComplete = true;
        console.log('\n✅ Notification processing completed!');
        console.log('   Final Status:', currentNotification!.notification_status);
        console.log('   Processed At:', currentNotification!.processed_at);
        
        if (currentNotification!.error_details) {
          console.log('   Error Details:', JSON.stringify(currentNotification!.error_details, null, 2));
        }
        
        if (currentNotification!.transaction_id) {
          console.log('   Transaction ID:', currentNotification!.transaction_id);
        }
      }
      
      attempts++;
      
      // Show progress every 5 seconds
      if (attempts % 5 === 0 && !isComplete) {
        console.log(`   Still ${lastStatus}... (${attempts}s elapsed)`);
      }
    }
    
    if (!isComplete) {
      console.log('⚠️  Notification still not processed after 60 seconds...');
      console.log('   Current Status:', lastStatus);
      console.log('   Make sure the temporal worker is running!');
    }

    // Step 4: Test multiple notifications
    console.log('\n\n🔥 Testing batch notifications...');
    
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
            inAppBody: `This is batch notification ${i + 1} processed via database polling`
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
    
    // Monitor batch status
    console.log('\n⏳ Monitoring batch notifications...');
    const batchStatuses = new Map(notificationIds.map(id => [id, 'PENDING']));
    let batchComplete = false;
    let batchAttempts = 0;
    
    while (!batchComplete && batchAttempts < maxAttempts) {
      await delay(1000);
      
      const { data: batchResults, error: batchError } = await supabase
        .schema('notify')
        .from('ent_notification')
        .select('id, notification_status')
        .in('id', notificationIds);
      
      if (batchError) {
        console.error('Error fetching batch notifications:', batchError);
        break;
      }
      
      let changesDetected = false;
      for (const result of batchResults!) {
        const oldStatus = batchStatuses.get(result.id);
        if (oldStatus !== result.notification_status) {
          console.log(`   Notification ${result.id}: ${oldStatus} -> ${result.notification_status}`);
          batchStatuses.set(result.id, result.notification_status);
          changesDetected = true;
        }
      }
      
      // Check if all are complete
      const allComplete = Array.from(batchStatuses.values()).every(
        status => status === 'SENT' || status === 'FAILED'
      );
      
      if (allComplete) {
        batchComplete = true;
        console.log('\n✅ All batch notifications processed!');
        const summary = Array.from(batchStatuses.entries())
          .map(([id, status]) => `   ID ${id}: ${status}`)
          .join('\n');
        console.log(summary);
      }
      
      batchAttempts++;
      
      // Show progress every 5 seconds
      if (batchAttempts % 5 === 0 && !batchComplete && !changesDetected) {
        const pendingCount = Array.from(batchStatuses.values()).filter(s => s === 'PENDING').length;
        const processingCount = Array.from(batchStatuses.values()).filter(s => s === 'PROCESSING').length;
        console.log(`   Still waiting... (${pendingCount} pending, ${processingCount} processing)`);
      }
    }
    
    if (!batchComplete) {
      console.log('⚠️  Some batch notifications still not processed after 60 seconds');
    }

    console.log('\n✨ Test completed!');
    console.log('   - Check your email and in-app notifications');
    console.log('   - Monitor the worker logs for processing details');
    console.log('   - Database polling interval: ' + (process.env.POLL_INTERVAL_MS || '10000') + 'ms');
    
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