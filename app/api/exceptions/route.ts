import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = parseInt(session.user.id);
    const body = await request.json();
    
    const { date, exception_type, reason, requested_clock_in, requested_clock_out } = body;
    
    if (!date || !exception_type || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    const db = getDb();
    
    // Check if attendance record exists for this date
    const attendance = db.prepare('SELECT id FROM attendance WHERE user_id = ? AND date = ?')
      .get(userId, date) as { id: number } | undefined;
    
    // Create exception request
    const result = db.prepare(`
      INSERT INTO attendance_exceptions 
      (user_id, attendance_id, date, exception_type, reason, requested_clock_in, requested_clock_out, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      userId,
      attendance?.id || null,
      date,
      exception_type,
      reason,
      requested_clock_in ? `${date}T${requested_clock_in}` : null,
      requested_clock_out ? `${date}T${requested_clock_out}` : null
    );
    
    return NextResponse.json({
      success: true,
      exceptionId: result.lastInsertRowid,
    });
  } catch (error) {
    console.error('Exception API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
