import { NextRequest, NextResponse } from "next/server";
import { workflowLoader } from "../../services/workflow";
import { notificationService } from "../../services/database";

export async function POST(request: NextRequest) {
  const secretKey = process.env.NOVU_SECRET_KEY;
  const subscriberId = process.env.NEXT_PUBLIC_NOVU_SUBSCRIBER_ID;

  // Check for required environment variables
  if (!secretKey) {
    console.error('❌ Secret key is missing from environment variables');
    return NextResponse.json(
      {
        message: "Configuration error: NOVU_SECRET_KEY is missing",
      },
      { status: 500 }
    );
  }

  if (!subscriberId) {
    console.error('❌ NEXT_PUBLIC_NOVU_SUBSCRIBER_ID is missing from environment variables');
    return NextResponse.json(
      {
        message: "Configuration error: NEXT_PUBLIC_NOVU_SUBSCRIBER_ID is missing",
      },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { 
      workflowId, 
      payload = {}, 
      enterpriseId,
      subscriberId: customSubscriberId,
      notificationId 
    } = body;

    if (!workflowId) {
      return NextResponse.json(
        {
          message: "workflowId is required",
        },
        { status: 400 }
      );
    }

    // Load enterprise workflows if enterpriseId is provided
    if (enterpriseId) {
      await workflowLoader.loadEnterpriseWorkflows(enterpriseId);
    }

    // Get workflow from registry
    const workflow = workflowLoader.getWorkflow(workflowId, enterpriseId);
    if (!workflow) {
      const stats = workflowLoader.getStats();
      return NextResponse.json(
        {
          message: `Workflow '${workflowId}' not found${enterpriseId ? ` for enterprise '${enterpriseId}'` : ''}`,
          available: {
            total: stats.total,
            static: stats.static,
            dynamic: stats.dynamic
          }
        },
        { status: 404 }
      );
    }

    // Determine subscriber ID
    const targetSubscriberId = customSubscriberId || subscriberId;

    // Prepare enhanced payload
    const enhancedPayload = {
      ...payload,
      notificationId,
      enterprise_id: enterpriseId,
      subscriberId: targetSubscriberId,
      timestamp: new Date().toISOString()
    };

    // Update notification status to PENDING if notificationId is provided
    if (notificationId && enterpriseId) {
      const parsedNotificationId = typeof notificationId === 'string' ? parseInt(notificationId) : notificationId;
      await notificationService.updateNotificationStatus(
        parsedNotificationId,
        'PENDING',
        enterpriseId
      );
    }

    // Trigger the workflow
    const result = await workflow.trigger({
      to: targetSubscriberId,
      payload: enhancedPayload,
    });

    // Store transaction ID if available
    if (result?.transactionId && notificationId && enterpriseId) {
      const parsedNotificationId = typeof notificationId === 'string' ? parseInt(notificationId) : notificationId;
      await notificationService.updateNotificationStatus(
        parsedNotificationId,
        'PROCESSING',
        enterpriseId,
        undefined,
        result.transactionId
      );
    }

    return NextResponse.json({
      message: "Notification triggered successfully",
      workflowId,
      enterpriseId,
      notificationId,
      transactionId: result?.transactionId,
      result: result,
    });
  } catch (error: unknown) {
    console.error('❌ Error triggering notification:');
    console.error('Error type:', typeof error);
    console.error('Error constructor:', error?.constructor?.name);

    let errorDetails: any = {
      message: 'Unknown error occurred',
      type: typeof error,
      constructor: error?.constructor?.name
    };

    if (error instanceof Error) {
      errorDetails.message = error.message;
      errorDetails.stack = error.stack;
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    } else {
      console.error('Raw error:', error);
      errorDetails.raw = error;
    }

    return NextResponse.json(
      {
        message: "Error triggering notification",
        error: errorDetails,
      },
      { status: 500 },
    );
  }
}