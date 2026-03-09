import { NextRequest, NextResponse } from 'next/server';
import { processAutoClockOut } from '@/lib/jobs';

export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const result = await processAutoClockOut();
    return NextResponse.json({
      success: true,
      message: `Processed ${result.processed} auto clock-outs`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Auto clock-out cron error:', error);
    return NextResponse.json(
      { error: 'Failed to process auto clock-outs' },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}
