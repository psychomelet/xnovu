import { NextRequest, NextResponse } from "next/server";
import { welcomeOnboardingEmail, yogoEmail } from "../../novu/workflows";

const workflows = {
  "welcome-onboarding-email": welcomeOnboardingEmail,
  "yogo-email": yogoEmail,
};

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
    const { workflowId, payload = {} } = body;

    if (!workflowId) {
      return NextResponse.json(
        {
          message: "workflowId is required",
        },
        { status: 400 }
      );
    }

    const workflow = workflows[workflowId as keyof typeof workflows];
    if (!workflow) {
      return NextResponse.json(
        {
          message: `Workflow '${workflowId}' not found. Available workflows: ${Object.keys(workflows).join(', ')}`,
        },
        { status: 404 }
      );
    }

    const result = await workflow.trigger({
      to: subscriberId,
      payload,
    });

    return NextResponse.json({
      message: "Notification triggered successfully",
      workflowId,
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