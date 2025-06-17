#!/usr/bin/env tsx

/**
 * Test script for scheduled notification functionality
 * Tests both sync and async triggers with scheduled_for field
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../lib/supabase/database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const supabase = createClient<Database>(supabaseUrl, supabaseKey)

async function createTestNotification(scheduledFor: Date | null) {
  const { data, error } = await supabase
    .schema('notify')
    .from('ent_notification')
    .insert({
      name: `Test Scheduled Notification - ${new Date().toISOString()}`,
      description: 'Testing scheduled notification trigger',
      payload: {
        message: 'This is a scheduled test notification',
        timestamp: new Date().toISOString()
      },
      recipients: ['test-user-123'],
      notification_workflow_id: 1, // Assuming workflow ID 1 exists
      publish_status: 'PUBLISH',
      scheduled_for: scheduledFor?.toISOString() || null,
      enterprise_id: 'test-enterprise'
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create notification: ${error.message}`)
  }

  return data
}

async function testSyncTrigger(notificationId: number) {
  console.log(`\n📋 Testing SYNC trigger for notification ${notificationId}...`)
  
  const response = await fetch(`${apiUrl}/api/trigger-async`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      notificationId,
      async: false // Sync mode
    })
  })

  const result = await response.json()
  console.log('Sync trigger result:', JSON.stringify(result, null, 2))
  
  return result
}

async function testAsyncTrigger(notificationId: number) {
  console.log(`\n🚀 Testing ASYNC trigger for notification ${notificationId}...`)
  
  const response = await fetch(`${apiUrl}/api/trigger-async`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      notificationId,
      async: true // Async mode
    })
  })

  const result = await response.json()
  console.log('Async trigger result:', JSON.stringify(result, null, 2))
  
  return result
}

async function getWorkflowStatus(workflowId: string) {
  const response = await fetch(`${apiUrl}/api/trigger-async?workflowId=${workflowId}`)
  return await response.json()
}

async function runTests() {
  console.log('🧪 Starting scheduled notification tests...\n')

  try {
    // Test 1: Immediate notification (no scheduled_for)
    console.log('Test 1: Immediate notification (no scheduled_for)')
    const immediateNotif = await createTestNotification(null)
    console.log(`Created immediate notification: ${immediateNotif.id}`)
    
    await testSyncTrigger(immediateNotif.id)
    await testAsyncTrigger(immediateNotif.id)

    // Test 2: Past scheduled notification
    console.log('\n\nTest 2: Past scheduled notification')
    const pastDate = new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
    const pastNotif = await createTestNotification(pastDate)
    console.log(`Created past scheduled notification: ${pastNotif.id} (scheduled for ${pastDate.toISOString()})`)
    
    await testSyncTrigger(pastNotif.id)
    await testAsyncTrigger(pastNotif.id)

    // Test 3: Future scheduled notification (5 minutes from now)
    console.log('\n\nTest 3: Future scheduled notification')
    const futureDate = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes from now
    const futureNotif = await createTestNotification(futureDate)
    console.log(`Created future scheduled notification: ${futureNotif.id} (scheduled for ${futureDate.toISOString()})`)
    
    // Sync should fail
    const syncResult = await testSyncTrigger(futureNotif.id)
    if (!syncResult.success) {
      console.log('✅ Sync trigger correctly rejected future notification')
    } else {
      console.error('❌ Sync trigger should have failed for future notification!')
    }

    // Async should succeed with delay
    const asyncResult = await testAsyncTrigger(futureNotif.id)
    if (asyncResult.success && asyncResult.startDelay) {
      console.log(`✅ Async trigger accepted with delay: ${asyncResult.startDelay}ms (${asyncResult.startDelay / 1000}s)`)
      
      // Check workflow status
      console.log('\nChecking workflow status...')
      const status = await getWorkflowStatus(asyncResult.workflowId)
      console.log('Workflow status:', JSON.stringify(status, null, 2))
    } else {
      console.error('❌ Async trigger should have succeeded with delay!')
    }

    // Test 4: Very near future (10 seconds)
    console.log('\n\nTest 4: Very near future scheduled notification (10 seconds)')
    const nearFutureDate = new Date(Date.now() + 10 * 1000) // 10 seconds from now
    const nearFutureNotif = await createTestNotification(nearFutureDate)
    console.log(`Created near future notification: ${nearFutureNotif.id} (scheduled for ${nearFutureDate.toISOString()})`)
    
    const nearAsyncResult = await testAsyncTrigger(nearFutureNotif.id)
    if (nearAsyncResult.success && nearAsyncResult.startDelay) {
      console.log(`✅ Async trigger accepted with delay: ${nearAsyncResult.startDelay}ms`)
      console.log('Waiting 15 seconds to check if notification was processed...')
      
      await new Promise(resolve => setTimeout(resolve, 15000))
      
      const status = await getWorkflowStatus(nearAsyncResult.workflowId)
      console.log('Workflow status after delay:', JSON.stringify(status, null, 2))
    }

  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

// Run the tests
runTests().then(() => {
  console.log('\n✅ All tests completed!')
  process.exit(0)
}).catch(error => {
  console.error('Test script error:', error)
  process.exit(1)
})