import { NextRequest, NextResponse } from 'next/server';
import { getRuleEngineInstance } from '@/app/lib/rule-engine-init';

export async function POST(request: NextRequest) {
  try {
    const ruleEngine = getRuleEngineInstance();
    
    if (!ruleEngine) {
      return NextResponse.json(
        { error: 'Rule Engine not initialized' },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { enterpriseId } = body;

    // Reload cron rules
    await ruleEngine.reloadCronRules(enterpriseId);

    const message = enterpriseId 
      ? `Cron rules reloaded successfully for enterprise: ${enterpriseId}`
      : 'All cron rules reloaded successfully';

    return NextResponse.json({ 
      message,
      timestamp: new Date().toISOString(),
      enterpriseId: enterpriseId || 'all'
    });

  } catch (error) {
    console.error('Error reloading cron rules:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to reload cron rules',
        message: error.message
      },
      { status: 500 }
    );
  }
}