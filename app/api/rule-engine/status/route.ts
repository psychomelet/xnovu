import { NextRequest, NextResponse } from 'next/server';
import { getRuleEngineInstance, getRuleEngineStatus, isRuleEngineHealthy } from '@/app/lib/rule-engine-init';

export async function GET(request: NextRequest) {
  try {
    const ruleEngine = getRuleEngineInstance();
    
    if (!ruleEngine) {
      return NextResponse.json(
        { 
          error: 'Rule Engine not initialized',
          initialized: false,
          healthy: false
        },
        { status: 503 }
      );
    }

    const [status, isHealthy] = await Promise.all([
      getRuleEngineStatus(),
      isRuleEngineHealthy()
    ]);

    return NextResponse.json({
      ...status,
      healthy: isHealthy,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting rule engine status:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to get rule engine status',
        message: error instanceof Error ? error.message : 'Unknown error',
        initialized: false,
        healthy: false
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();
    const ruleEngine = getRuleEngineInstance();
    
    if (!ruleEngine) {
      return NextResponse.json(
        { error: 'Rule Engine not initialized' },
        { status: 503 }
      );
    }

    switch (action) {
      case 'pause':
        await ruleEngine.pause();
        return NextResponse.json({ message: 'Rule Engine paused successfully' });
        
      case 'resume':
        await ruleEngine.resume();
        return NextResponse.json({ message: 'Rule Engine resumed successfully' });
        
      case 'health-check':
        const health = await ruleEngine.healthCheck();
        return NextResponse.json(health);
        
      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: pause, resume, health-check' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error performing rule engine action:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to perform action',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}