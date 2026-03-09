import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { format } from 'date-fns';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = parseInt(session.user.id);
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    
    const db = getDb();
    const today = format(new Date(), 'yyyy-MM-dd');
    
    // Get today's attendance
    const todayAttendance = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?')
      .get(userId, today);
    
    // Get attendance history
    let query = 'SELECT * FROM attendance WHERE user_id = ?';
    const params: (number | string)[] = [userId];
    
    if (start) {
      query += ' AND date >= ?';
      params.push(start);
    }
    if (end) {
      query += ' AND date <= ?';
      params.push(end);
    }
    
    query += ' ORDER BY date DESC';
    
    const records = db.prepare(query).all(...params);
    
    return NextResponse.json({
      today: todayAttendance || null,
      records,
    });
  } catch (error) {
    console.error('Attendance API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
