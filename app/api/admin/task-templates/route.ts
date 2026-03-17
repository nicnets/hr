import { getServerSession } from 'next-auth/next';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

// GET /api/admin/task-templates - List all recurring task templates
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const db = getDb();
    
    const templates = db.prepare(`
      SELECT rt.*, 
             u.name as assigned_to_name, 
             p.name as project_name,
             COUNT(at.id) as tasks_generated
      FROM recurring_task_templates rt
      LEFT JOIN users u ON rt.assigned_to = u.id
      LEFT JOIN projects p ON rt.project_id = p.id
      LEFT JOIN assigned_tasks at ON at.parent_template_id = rt.id
      GROUP BY rt.id
      ORDER BY rt.created_at DESC
    `).all();
    
    return NextResponse.json(templates);
  } catch (error) {
    console.error('Task templates API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/task-templates - Create new recurring task template
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
      recurrence_type,
      due_time,
      due_day,
      project_id,
      assigned_to,
    } = body;
    
    if (!title || !description || !recurrence_type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Validate recurrence-specific fields
    if (recurrence_type === 'daily' && !due_time) {
      return NextResponse.json(
        { error: 'Daily tasks require a due time' },
        { status: 400 }
      );
    }
    
    if ((recurrence_type === 'weekly' || recurrence_type === 'monthly') && due_day === undefined) {
      return NextResponse.json(
        { error: `${recurrence_type} tasks require a due day` },
        { status: 400 }
      );
    }
    
    const db = getDb();
    
    const result = db.prepare(`
      INSERT INTO recurring_task_templates 
      (title, description, recurrence_type, due_time, due_day, project_id, assigned_to)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      title,
      description,
      recurrence_type,
      due_time || null,
      due_day !== undefined ? due_day : null,
      project_id || null,
      assigned_to || null
    );
    
    // Create audit log
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
      VALUES (?, 'create', 'recurring_task_template', ?, ?)
    `).run(
      session.user.id,
      result.lastInsertRowid,
      JSON.stringify(body)
    );
    
    return NextResponse.json({
      success: true,
      templateId: result.lastInsertRowid,
    });
  } catch (error) {
    console.error('Create task template error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/task-templates - Update recurring task template
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
        { error: 'Template ID required' },
        { status: 400 }
      );
    }
    
    const db = getDb();
    
    // Get old values for audit
    const oldTemplate = db.prepare('SELECT * FROM recurring_task_templates WHERE id = ?').get(id);
    if (!oldTemplate) {
      return NextResponse.json(
        { error: 'Template not found' },
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
    if (updates.recurrence_type !== undefined) {
      setFields.push('recurrence_type = ?');
      params.push(updates.recurrence_type);
    }
    if (updates.due_time !== undefined) {
      setFields.push('due_time = ?');
      params.push(updates.due_time);
    }
    if (updates.due_day !== undefined) {
      setFields.push('due_day = ?');
      params.push(updates.due_day);
    }
    if (updates.project_id !== undefined) {
      setFields.push('project_id = ?');
      params.push(updates.project_id);
    }
    if (updates.assigned_to !== undefined) {
      setFields.push('assigned_to = ?');
      params.push(updates.assigned_to);
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
    
    setFields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    
    db.prepare(`
      UPDATE recurring_task_templates 
      SET ${setFields.join(', ')}
      WHERE id = ?
    `).run(...params);
    
    // Create audit log
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
      VALUES (?, 'update', 'recurring_task_template', ?, ?, ?)
    `).run(
      session.user.id,
      id,
      JSON.stringify(oldTemplate),
      JSON.stringify(updates)
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update task template error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/task-templates - Delete recurring task template
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
        { error: 'Template ID required' },
        { status: 400 }
      );
    }
    
    const db = getDb();
    
    // Get old values for audit
    const oldTemplate = db.prepare('SELECT * FROM recurring_task_templates WHERE id = ?').get(id);
    
    db.prepare('DELETE FROM recurring_task_templates WHERE id = ?').run(parseInt(id));
    
    // Create audit log
    if (oldTemplate) {
      db.prepare(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values)
        VALUES (?, 'delete', 'recurring_task_template', ?, ?)
      `).run(
        session.user.id,
        id,
        JSON.stringify(oldTemplate)
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete task template error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
