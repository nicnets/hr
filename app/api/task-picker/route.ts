import { getServerSession } from 'next-auth/next';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

// GET /api/task-picker - Get available tasks for employees to pick
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = parseInt(session.user.id);
    const db = getDb();
    
    // Get available tasks (not picked yet)
    const availableTasks = db.prepare(`
      SELECT tp.*, p.name as project_name
      FROM task_picker_pool tp
      LEFT JOIN projects p ON tp.project_id = p.id
      WHERE tp.is_active = 1 AND tp.picked_by IS NULL
      ORDER BY tp.created_at DESC
    `).all();
    
    // Get tasks picked by current user
    const myTasks = db.prepare(`
      SELECT tp.*, p.name as project_name
      FROM task_picker_pool tp
      LEFT JOIN projects p ON tp.project_id = p.id
      WHERE tp.picked_by = ?
      ORDER BY tp.picked_at DESC
    `).all(userId);
    
    return NextResponse.json({
      available: availableTasks,
      myTasks,
    });
  } catch (error) {
    console.error('Task picker API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/task-picker - Pick a task
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = parseInt(session.user.id);
    const body = await request.json();
    const { task_id } = body;
    
    if (!task_id) {
      return NextResponse.json(
        { error: 'Task ID required' },
        { status: 400 }
      );
    }
    
    const db = getDb();
    
    // Check if task is available
    const task = db.prepare(`
      SELECT * FROM task_picker_pool 
      WHERE id = ? AND is_active = 1 AND picked_by IS NULL
    `).get(task_id);
    
    if (!task) {
      return NextResponse.json(
        { error: 'Task not available or already picked' },
        { status: 400 }
      );
    }
    
    // Pick the task
    db.prepare(`
      UPDATE task_picker_pool 
      SET picked_by = ?, picked_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(userId, task_id);
    
    // Create notification
    db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (?, 'task_picked', ?, ?, ?)
    `).run(
      userId,
      'Task Picked',
      `You have picked: ${(task as { title: string }).title}`,
      '/tasks/assigned'
    );
    
    // Also create as an assigned task for the employee to track
    const taskData = task as {
      title: string;
      description: string;
      project_id: number | null;
    };
    
    db.prepare(`
      INSERT INTO assigned_tasks 
      (title, description, assigned_to, assigned_by, status, recurrence_type, project_id)
      VALUES (?, ?, ?, ?, 'assigned', 'adhoc', ?)
    `).run(
      taskData.title,
      taskData.description,
      userId,
      userId, // Self-assigned
      taskData.project_id
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Pick task error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/task-picker - Mark picked task as completed
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = parseInt(session.user.id);
    const body = await request.json();
    const { task_id } = body;
    
    if (!task_id) {
      return NextResponse.json(
        { error: 'Task ID required' },
        { status: 400 }
      );
    }
    
    const db = getDb();
    
    // Check if task is picked by current user
    const task = db.prepare(`
      SELECT * FROM task_picker_pool 
      WHERE id = ? AND picked_by = ? AND completed_at IS NULL
    `).get(task_id, userId);
    
    if (!task) {
      return NextResponse.json(
        { error: 'Task not found or not picked by you' },
        { status: 400 }
      );
    }
    
    // Mark as completed
    db.prepare(`
      UPDATE task_picker_pool 
      SET completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(task_id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Complete task error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
