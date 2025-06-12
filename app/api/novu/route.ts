import { serve } from "@novu/framework/next";
import { NextRequest } from "next/server";
import { workflowLoader } from "../../services/workflow";

// Initialize workflows and get handlers from Novu serve
async function getHandlers() {
  const workflows = await workflowLoader.getAllWorkflows();
  return serve({
    workflows,
  });
}

// Cache handlers promise to avoid reinitializing on every request
let handlersPromise: Promise<any> | null = null;

function getOrCreateHandlers() {
  if (!handlersPromise) {
    handlersPromise = getHandlers();
  }
  return handlersPromise;
}

export async function POST(req: NextRequest, context: any) {
  try {
    const { POST: NovuPOST } = await getOrCreateHandlers();
    return await NovuPOST(req, context);
  } catch (error) {
    console.error('❌ Novu POST Error:', error);
    throw error;
  }
}

export async function GET(req: NextRequest, context: any) {
  try {
    const { GET: NovuGET } = await getOrCreateHandlers();
    return await NovuGET(req, context);
  } catch (error) {
    console.error('❌ Novu GET Error:', error);
    throw error;
  }
}

export async function OPTIONS(req: NextRequest, context: any) {
  try {
    const { OPTIONS: NovuOPTIONS } = await getOrCreateHandlers();
    return await NovuOPTIONS(req, context);
  } catch (error) {
    console.error('❌ Novu OPTIONS Error:', error);
    throw error;
  }
}
