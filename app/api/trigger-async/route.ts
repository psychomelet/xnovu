import { NextRequest, NextResponse } from 'next/server'
import { notificationClient } from '@/lib/temporal/client/notification-client'
import { triggerNotificationById } from '@/lib/notifications/trigger'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { notificationId, notificationIds, async = true } = body

    if (!notificationId && !notificationIds) {
      return NextResponse.json(
        { error: 'Either notificationId or notificationIds is required' },
        { status: 400 }
      )
    }

    // Handle single notification
    if (notificationId) {
      if (async) {
        // Async trigger using Temporal
        const result = await notificationClient.asyncTriggerNotificationById(notificationId)
        return NextResponse.json({
          success: true,
          async: true,
          workflowId: result.workflowId,
          runId: result.runId,
          message: `Notification ${notificationId} queued for async processing`
        })
      } else {
        // Sync trigger (fallback)
        const result = await triggerNotificationById(notificationId)
        return NextResponse.json({
          async: false,
          ...result
        })
      }
    }

    // Handle multiple notifications
    if (notificationIds && Array.isArray(notificationIds)) {
      if (async) {
        // Async trigger using Temporal
        const result = await notificationClient.asyncTriggerMultipleNotifications(notificationIds)
        return NextResponse.json({
          success: true,
          async: true,
          workflowId: result.workflowId,
          runId: result.runId,
          message: `${notificationIds.length} notifications queued for async processing`
        })
      } else {
        // Sync trigger (fallback) - process in parallel
        const results = await Promise.all(
          notificationIds.map(id => triggerNotificationById(id))
        )
        const successCount = results.filter(r => r.success).length
        
        return NextResponse.json({
          success: successCount === results.length,
          async: false,
          totalCount: results.length,
          successCount,
          results
        })
      }
    }

  } catch (error: any) {
    console.error('Error in trigger-async API:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// Get workflow status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workflowId = searchParams.get('workflowId')

    if (!workflowId) {
      return NextResponse.json(
        { error: 'workflowId is required' },
        { status: 400 }
      )
    }

    const status = await notificationClient.getWorkflowStatus(workflowId)
    
    // Try to get result if workflow is completed
    let result = null
    if (!status.isRunning) {
      try {
        result = await notificationClient.getWorkflowResult(workflowId)
      } catch (error) {
        // Workflow might not have completed successfully
        console.error('Failed to get workflow result:', error)
      }
    }

    return NextResponse.json({
      workflowId,
      ...status,
      result
    })

  } catch (error: any) {
    console.error('Error getting workflow status:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get workflow status' },
      { status: 500 }
    )
  }
}