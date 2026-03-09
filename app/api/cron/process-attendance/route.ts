import { NextRequest, NextResponse } from 'next/server';
import { processDailyAttendance, processApprovedExceptions, generateDailySummary } from '@/lib/jobs';

export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    // Process approved exceptions first (restore leave balances)
    const exceptions = await processApprovedExceptions();
    
    // Process daily attendance with penalties
    const attendance = await processDailyAttendance();
    
    // Generate summary
    const summary = await generateDailySummary();
    
    return NextResponse.json({
      success: true,
      message: 'Daily processing completed',
      timestamp: new Date().toISOString(),
      results: {
        exceptions,
        attendance,
        summary,
      },
    });
  } catch (error) {
    console.error('Daily processing cron error:', error);
    return NextResponse.json(
      { error: 'Failed to process daily attendance' },
      { status: 500 }
    );
  }
}
