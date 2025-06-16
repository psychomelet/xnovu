import { serve } from "@novu/framework/next";
import { NextRequest } from "next/server";
import { workflows } from "../../novu/workflow-loader";

// Get the handlers from Novu serve - the framework will use NOVU_API_URL env var automatically
const { GET: NovuGET, POST: NovuPOST, OPTIONS } = serve({
  workflows,
});

export async function POST(req: NextRequest, context: any) {
  try {
    return await NovuPOST(req, context);
  } catch (error) {
    console.error('❌ Novu POST Error:', error);
    throw error;
  }
}

export async function GET(req: NextRequest, context: any) {
  try {
    return await NovuGET(req, context);
  } catch (error) {
    console.error('❌ Novu GET Error:', error);
    throw error;
  }
}

export { OPTIONS };
