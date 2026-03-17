import { getServerSession } from 'next-auth/next';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

// GET /api/admin/tasks - List all tasks with filters
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const assignedTo = searchParams.get('assigned_to');
    
    const db = getDb();
    
    let query = `
      SELECT 
        at.id, at.title, at.description, at.status, at.due_date,
        at.evidence_type, at.evidence_url, at.evidence_description,
        at.submitted_at, at.reviewed_at, at.review_notes, at.auto_approve,
        at.recurrence_type, at.parent_template_id, at.project_id,
        at.created_at, at.updated_at,
        assigned_to.id as assigned_to_id, assigned_to.name as assigned_to_name, assigned_to.email as assigned_to_email,
        assigned_by.name as assigned_by_name,
        reviewed_by.name as reviewed_by_name,
        p.name as project_name
      FROM assigned_tasks at
      JOIN users assigned_to ON at.assigned_to = assigned_to.id
      JOIN users assigned_by ON at.assigned_by = assigned_by.id
      LEFT JOIN users reviewed_by ON at.reviewed_by = reviewed_by.id
      LEFT JOIN projects p ON at.project_id = p.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];
    
    if (status) {
      query += ' AND at.status = ?';
      params.push(status);
    }
    
    if (assignedTo) {
      query += ' AND at.assigned_to = ?';
      params.push(parseInt(assignedTo));
    }
    
    query += ' ORDER BY at.created_at DESC';
    
    const tasks = db.prepare(query).all(...params);
    
    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Admin tasks API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/tasks - Create new task assignment
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
      assigned_to, 
      due_date, 
      auto_approve,
      recurrence_type = 'adhoc',
      project_id,
    } = body;
    
    if (!title || !description || !assigned_to) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    const db = getDb();
    
    // Verify assigned user exists and is active
    const user = db.prepare('SELECT id FROM users WHERE id = ? AND is_active = 1').get(assigned_to);
    if (!user) {
      return NextResponse.json({ error: 'Assigned user not found or inactive' }, { status: 400 });
    }
    
    const result = db.prepare(`
      INSERT INTO assigned_tasks (title, description, assigned_to, assigned_by, due_date, auto_approve, status, recurrence_type, project_id)
      VALUES (?, ?, ?, ?, ?, ?, 'assigned', ?, ?)
    `).run(title, description, assigned_to, session.user.id, due_date || null, auto_approve ? 1 : 0, recurrence_type, project_id || null);
    
    // Create notification for assigned user
    db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (?, 'task_assigned', ?, ?, ?)
    `).run(
      assigned_to,
      'New Task Assigned',
      `You have been assigned a new task: ${title}`,
      '/tasks/assigned'
    );
    
    // Create audit log
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
      VALUES (?, 'create', 'assigned_task', ?, ?)
    `).run(session.user.id, result.lastInsertRowid, JSON.stringify({ title, assigned_to, due_date }));
    
    return NextResponse.json({
      success: true,
      taskId: result.lastInsertRowid,
    });
  } catch (error) {
    console.error('Create task error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/tasks/:id - Update task or review
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { task_id, action, review_notes, status } = body;
    
    if (!task_id || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    const db = getDb();
    
    // Get task details
    const task = db.prepare('SELECT * FROM assigned_tasks WHERE id = ?').get(task_id) as {
      id: number;
      assigned_to: number;
      title: string;
      status: string;
    } | undefined;
    
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    
    if (action === 'review') {
      // Approve or reject task
      const newStatus = status === 'approved' ? 'closed' : 'rejected';
      
      db.prepare(`
        UPDATE assigned_tasks 
        SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newStatus, session.user.id, review_notes || null, task_id);
      
      // Create notification for user
      db.prepare(`
        INSERT INTO notifications (user_id, type, title, message, link)
        VALUES (?, 'task_reviewed', ?, ?, ?)
      `).run(
        task.assigned_to,
        newStatus === 'closed' ? 'Task Approved' : 'Task Rejected',
        `Your task "${task.title}" has been ${newStatus === 'closed' ? 'approved' : 'rejected'}`,
        '/tasks/assigned'
      );
      
      return NextResponse.json({ success: true, status: newStatus });
    }
    
    if (action === 'update') {
      const { title, description, due_date, auto_approve, recurrence_type, project_id } = body;
      
      db.prepare(`
        UPDATE assigned_tasks 
        SET title = ?, description = ?, due_date = ?, auto_approve = ?, 
            recurrence_type = ?, project_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(title, description, due_date || null, auto_approve ? 1 : 0, recurrence_type, project_id || null, task_id);
      
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Update task error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/tasks/:id - Delete task
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('id');
    
    if (!taskId) {
      return NextResponse.json({ error: 'Task ID required' }, { status: 400 });
    }
    
    const db = getDb();
    
    db.prepare('DELETE FROM assigned_tasks WHERE id = ?').run(parseInt(taskId));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete task error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
