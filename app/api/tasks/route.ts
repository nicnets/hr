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
    const includeAiAnalysis = searchParams.get('include_ai') === 'true';
    
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

// PUT /api/tasks - Update task with AI submission details
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = parseInt(session.user.id);
    const body = await request.json();
    const { taskId, ...details } = body;
    
    if (!taskId) {
      return NextResponse.json({ error: 'Task ID required' }, { status: 400 });
    }
    
    const db = getDb();
    
    // Verify the task belongs to this user
    const task = db.prepare('SELECT * FROM task_logs WHERE id = ? AND user_id = ?').get(taskId, userId);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    
    // Update with AI submission details
    db.prepare(`
      UPDATE task_logs
      SET work_summary = ?,
          task_objective = ?,
          final_outcome = ?,
          scope_change = ?,
          output_type = ?,
          output_description = ?,
          difficulty_level = ?,
          confidence_level = ?,
          ai_analyzed = 0
      WHERE id = ?
    `).run(
      details.work_summary,
      details.task_objective,
      details.final_outcome,
      details.scope_change,
      details.output_type,
      details.output_description,
      details.difficulty_level,
      details.confidence_level,
      taskId
    );
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Update task error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
