import { NextRequest, NextResponse } from 'next/server';
import { processAIAnalysis, checkAttendanceViolations } from '@/lib/jobs';

export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    // Process AI analysis
    const aiResult = await processAIAnalysis();
    
    // Check attendance violations
    const violationsResult = await checkAttendanceViolations();
    
    return NextResponse.json({
      success: true,
      message: 'AI analysis and violations check completed',
      timestamp: new Date().toISOString(),
      results: {
        aiAnalysis: aiResult,
        violations: violationsResult,
      },
    });
  } catch (error) {
    console.error('AI analysis cron error:', error);
    return NextResponse.json(
      { error: 'Failed to process AI analysis' },
      { status: 500 }
    );
  }
}
