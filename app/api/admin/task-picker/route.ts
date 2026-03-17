import { getServerSession } from 'next-auth/next';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

// GET /api/admin/task-picker - List all task picker pool items
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'available', 'picked', 'completed', 'all'
    
    const db = getDb();
    
    let query = `
      SELECT tp.*, 
             p.name as project_name,
             u.name as picker_name,
             u.email as picker_email
      FROM task_picker_pool tp
      LEFT JOIN projects p ON tp.project_id = p.id
      LEFT JOIN users u ON tp.picked_by = u.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];
    
    if (status === 'available') {
      query += ' AND tp.is_active = 1 AND tp.picked_by IS NULL';
    } else if (status === 'picked') {
      query += ' AND tp.picked_by IS NOT NULL AND tp.completed_at IS NULL';
    } else if (status === 'completed') {
      query += ' AND tp.completed_at IS NOT NULL';
    }
    
    query += ' ORDER BY tp.created_at DESC';
    
    const tasks = db.prepare(query).all(...params);
    
    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Task picker admin API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/task-picker - Create new task picker item
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const {
      title,
      description,
      project_id,
      estimated_hours,
      difficulty_level,
      required_skills,
    } = body;
    
    if (!title || !description) {
      return NextResponse.json(
        { error: 'Title and description are required' },
        { status: 400 }
      );
    }
    
    const db = getDb();
    
    const result = db.prepare(`
      INSERT INTO task_picker_pool 
      (title, description, project_id, estimated_hours, difficulty_level, required_skills)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      title,
      description,
      project_id || null,
      estimated_hours || null,
      difficulty_level || null,
      required_skills ? JSON.stringify(required_skills) : null
    );
    
    // Create audit log
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
      VALUES (?, 'create', 'task_picker_pool', ?, ?)
    `).run(
      session.user.id,
      result.lastInsertRowid,
      JSON.stringify(body)
    );
    
    return NextResponse.json({
      success: true,
      taskId: result.lastInsertRowid,
    });
  } catch (error) {
    console.error('Create task picker item error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/task-picker - Update task picker item
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { id, ...updates } = body;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Task ID required' },
        { status: 400 }
      );
    }
    
    const db = getDb();
    
    const oldTask = db.prepare('SELECT * FROM task_picker_pool WHERE id = ?').get(id);
    if (!oldTask) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }
    
    const setFields: string[] = [];
    const params: (string | number | null)[] = [];
    
    if (updates.title !== undefined) {
      setFields.push('title = ?');
      params.push(updates.title);
    }
    if (updates.description !== undefined) {
      setFields.push('description = ?');
      params.push(updates.description);
    }
    if (updates.project_id !== undefined) {
      setFields.push('project_id = ?');
      params.push(updates.project_id);
    }
    if (updates.estimated_hours !== undefined) {
      setFields.push('estimated_hours = ?');
      params.push(updates.estimated_hours);
    }
    if (updates.difficulty_level !== undefined) {
      setFields.push('difficulty_level = ?');
      params.push(updates.difficulty_level);
    }
    if (updates.required_skills !== undefined) {
      setFields.push('required_skills = ?');
      params.push(JSON.stringify(updates.required_skills));
    }
    if (updates.is_active !== undefined) {
      setFields.push('is_active = ?');
      params.push(updates.is_active ? 1 : 0);
    }
    
    if (setFields.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }
    
    params.push(id);
    
    db.prepare(`
      UPDATE task_picker_pool 
      SET ${setFields.join(', ')}
      WHERE id = ?
    `).run(...params);
    
    // Create audit log
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
      VALUES (?, 'update', 'task_picker_pool', ?, ?, ?)
    `).run(
      session.user.id,
      id,
      JSON.stringify(oldTask),
      JSON.stringify(updates)
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update task picker item error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/task-picker - Delete task picker item
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Task ID required' },
        { status: 400 }
      );
    }
    
    const db = getDb();
    
    const oldTask = db.prepare('SELECT * FROM task_picker_pool WHERE id = ?').get(id);
    
    db.prepare('DELETE FROM task_picker_pool WHERE id = ?').run(parseInt(id));
    
    // Create audit log
    if (oldTask) {
      db.prepare(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values)
        VALUES (?, 'delete', 'task_picker_pool', ?, ?)
      `).run(
        session.user.id,
        id,
        JSON.stringify(oldTask)
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete task picker item error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
