import { NextRequest, NextResponse } from 'next/server';
import { processRecurringTasks } from '@/lib/jobs';

export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const result = await processRecurringTasks();
    
    return NextResponse.json({
      success: true,
      message: 'Recurring tasks processed',
      timestamp: new Date().toISOString(),
      result,
    });
  } catch (error) {
    console.error('Recurring tasks cron error:', error);
    return NextResponse.json(
      { error: 'Failed to process recurring tasks' },
      { status: 500 }
    );
  }
}
