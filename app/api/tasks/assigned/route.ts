import { getServerSession } from 'next-auth/next';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

// GET /api/tasks/assigned - Get tasks assigned to current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = parseInt(session.user.id);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    
    const db = getDb();
    
    let query = `
      SELECT 
        at.id, at.title, at.description, at.status, at.due_date,
        at.evidence_type, at.evidence_url, at.evidence_description,
        at.submitted_at, at.reviewed_at, at.review_notes, at.auto_approve,
        at.recurrence_type, at.project_id,
        at.created_at, at.updated_at,
        assigned_by.name as assigned_by_name,
        p.name as project_name
      FROM assigned_tasks at
      JOIN users assigned_by ON at.assigned_by = assigned_by.id
      LEFT JOIN projects p ON at.project_id = p.id
      WHERE at.assigned_to = ?
    `;
    const params: (string | number)[] = [userId];
    
    if (status) {
      query += ' AND at.status = ?';
      params.push(status);
    }
    
    query += " ORDER BY CASE at.status WHEN 'assigned' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'pending_review' THEN 3 ELSE 4 END, at.due_date ASC, at.created_at DESC";
    
    const tasks = db.prepare(query).all(...params);
    
    // Get submissions and AI analysis for each task
    const tasksWithDetails = tasks.map((task: any) => {
      const submission = db.prepare(`
        SELECT * FROM task_submissions WHERE task_id = ? AND user_id = ?
      `).get(task.id, userId);
      
      const aiAnalysis = submission ? db.prepare(`
        SELECT * FROM task_ai_analysis WHERE submission_id = ?
      `).get((submission as { id: number }).id) : null;
      
      return {
        ...task,
        submission,
        ai_analysis: aiAnalysis,
      };
    });
    
    return NextResponse.json(tasksWithDetails);
  } catch (error) {
    console.error('Assigned tasks API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/tasks/assigned - Submit task with evidence or update status
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = parseInt(session.user.id);
    const body = await request.json();
    const { task_id, action, evidence_type, evidence_url, evidence_description } = body;
    
    if (!task_id || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    const db = getDb();
    
    // Get task details and verify ownership
    const task = db.prepare('SELECT * FROM assigned_tasks WHERE id = ? AND assigned_to = ?').get(task_id, userId) as {
      id: number;
      title: string;
      status: string;
      auto_approve: number;
    } | undefined;
    
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    
    if (action === 'start') {
      // Start working on task
      if (task.status !== 'assigned') {
        return NextResponse.json({ error: 'Task already started' }, { status: 400 });
      }
      
      db.prepare(`
        UPDATE assigned_tasks 
        SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(task_id);
      
      return NextResponse.json({ success: true, status: 'in_progress' });
    }
    
    if (action === 'submit') {
      // Submit task for review
      if (task.status !== 'in_progress' && task.status !== 'assigned') {
        return NextResponse.json({ error: 'Task cannot be submitted' }, { status: 400 });
      }
      
      if (!evidence_type || evidence_type === 'none') {
        return NextResponse.json({ error: 'Evidence is required' }, { status: 400 });
      }
      
      if (evidence_type === 'link' && !evidence_url) {
        return NextResponse.json({ error: 'Evidence URL is required' }, { status: 400 });
      }
      
      // Determine new status based on auto_approve setting
      const newStatus = task.auto_approve ? 'closed' : 'pending_review';
      const submittedAt = new Date().toISOString();
      
      db.prepare(`
        UPDATE assigned_tasks 
        SET status = ?, evidence_type = ?, evidence_url = ?, evidence_description = ?, 
            submitted_at = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newStatus, evidence_type, evidence_url || null, evidence_description || null, submittedAt, task_id);
      
      // If auto-approve, set reviewed info
      if (task.auto_approve) {
        db.prepare(`
          UPDATE assigned_tasks 
          SET reviewed_by = assigned_by, reviewed_at = CURRENT_TIMESTAMP, review_notes = 'Auto-approved'
          WHERE id = ?
        `).run(task_id);
        
        return NextResponse.json({ 
          success: true, 
          status: 'closed',
          message: 'Task submitted and auto-approved'
        });
      }
      
      // Create notification for admin
      db.prepare(`
        INSERT INTO notifications (user_id, type, title, message, link)
        VALUES (?, 'task_pending_review', ?, ?, ?)
      `).run(
        session.user.id,
        'Task Pending Review',
        `Task "${task.title}" has been submitted for review`,
        '/admin/tasks'
      );
      
      return NextResponse.json({ 
        success: true, 
        status: 'pending_review',
        message: 'Task submitted for review'
      });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Submit task error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
