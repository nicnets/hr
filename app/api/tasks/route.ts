import { getServerSession } from 'next-auth/next';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

// GET /api/tasks - Get tasks for a date range
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = parseInt(session.user.id);
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    
    const db = getDb();
    
    let query = 'SELECT * FROM task_logs WHERE user_id = ?';
    const params: (number | string)[] = [userId];
    
    if (date) {
      query += ' AND date = ?';
      params.push(date);
    } else if (start && end) {
      query += ' AND date >= ? AND date <= ?';
      params.push(start, end);
    }
    
    query += ' ORDER BY date DESC, created_at DESC';
    
    const tasks = db.prepare(query).all(...params);
    
    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Tasks API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/tasks - Create a new task
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = parseInt(session.user.id);
    const body = await request.json();
    
    const { date, project_name, task_description, start_time, end_time } = body;
    
    if (!date || !project_name || !task_description || !start_time || !end_time) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Calculate hours spent
    const start = new Date(`2000-01-01T${start_time}`);
    const end = new Date(`2000-01-01T${end_time}`);
    const minutes = (end.getTime() - start.getTime()) / (1000 * 60);
    const hoursSpent = Math.round(minutes / 60 * 100) / 100;
    
    if (hoursSpent <= 0) {
      return NextResponse.json({ error: 'Invalid time range' }, { status: 400 });
    }
    
    const db = getDb();
    
    const result = db.prepare(`
      INSERT INTO task_logs (user_id, date, project_name, task_description, start_time, end_time)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, date, project_name, task_description, start_time, end_time);
    
    return NextResponse.json({
      success: true,
      taskId: result.lastInsertRowid,
      hoursSpent,
    });
  } catch (error: any) {
    console.error('Create task error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
