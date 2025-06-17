import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Basic health check - just return OK
    // Additional checks can be added here for database, external services, etc.
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'xnovu-app'
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'xnovu-app',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 503 }
    );
  }
}