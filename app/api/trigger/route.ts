import { NextRequest, NextResponse } from "next/server";
import { WORKFLOW_KEYS, workflows } from "../../novu/workflow-loader";

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
      subscriberId: customSubscriberId,
    } = body;

    if (!workflowId) {
      return NextResponse.json(
        {
          message: "workflowId is required",
        },
        { status: 400 }
      );
    }

    // Check if workflow exists in our static workflows
    const workflowExists = Object.values(WORKFLOW_KEYS).includes(workflowId) || 
                          workflows.some(w => w.id === workflowId);
    
    if (!workflowExists) {
      return NextResponse.json(
        {
          message: `Workflow '${workflowId}' not found`,
          availableWorkflows: Object.values(WORKFLOW_KEYS)
        },
        { status: 404 }
      );
    }

    // For dynamic workflows, use the default-dynamic-multi workflow
    // and pass the configuration in the payload
    let actualWorkflowId = workflowId;
    let actualPayload = payload;
    
    // If this is a request for dynamic behavior, suggest using default-dynamic-multi
    if (payload.channels && typeof payload.channels === 'object') {
      console.log('📝 Detected dynamic workflow request, using default-dynamic-multi');
      actualWorkflowId = WORKFLOW_KEYS.dynamicMulti;
      actualPayload = payload; // Payload already contains the channel configuration
    }

    // Determine subscriber ID
    const targetSubscriberId = customSubscriberId || subscriberId;

    // Import Novu dynamically to avoid edge runtime issues
    const { Novu } = await import("@novu/api");
    const novu = new Novu({ secretKey });

    console.log('📤 Triggering workflow:', {
      workflowId: actualWorkflowId,
      subscriberId: targetSubscriberId,
      payloadKeys: Object.keys(actualPayload)
    });

    // Trigger the workflow
    const result = await novu.trigger(actualWorkflowId, {
      to: targetSubscriberId,
      payload: actualPayload,
    } as any);

    console.log('✅ Workflow triggered successfully:', result);

    return NextResponse.json(
      {
        success: true,
        data: result,
        workflow: actualWorkflowId,
        subscriberId: targetSubscriberId
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('❌ Error triggering workflow:', error);
    
    // Enhanced error handling
    const errorMessage = error?.response?.data?.message || error.message || 'Unknown error';
    const statusCode = error?.response?.status || 500;

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: error?.response?.data || undefined
      },
      { status: statusCode }
    );
  }
}