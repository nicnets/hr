import { getServerSession } from 'next-auth/next';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

// GET /api/task-submissions - Get submissions for a task or user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = parseInt(session.user.id);
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('task_id');
    
    const db = getDb();
    
    if (taskId) {
      // Get submission for specific task
      const submission = db.prepare(`
        SELECT ts.*, taa.score, taa.decision, taa.analysis_summary
        FROM task_submissions ts
        LEFT JOIN task_ai_analysis taa ON ts.id = taa.submission_id
        WHERE ts.task_id = ? AND ts.user_id = ?
        ORDER BY ts.submitted_at DESC
        LIMIT 1
      `).get(parseInt(taskId), userId);
      
      return NextResponse.json(submission || null);
    } else {
      // Get all submissions for user
      const submissions = db.prepare(`
        SELECT ts.*, at.title as task_title, taa.score, taa.decision
        FROM task_submissions ts
        JOIN assigned_tasks at ON ts.task_id = at.id
        LEFT JOIN task_ai_analysis taa ON ts.id = taa.submission_id
        WHERE ts.user_id = ?
        ORDER BY ts.submitted_at DESC
      `).all(userId);
      
      return NextResponse.json(submissions);
    }
  } catch (error) {
    console.error('Task submissions API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/task-submissions - Create new task submission
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = parseInt(session.user.id);
    const body = await request.json();
    const {
      task_id,
      work_summary,
      task_objective,
      final_outcome,
      scope_change,
      output_type,
      output_description,
      time_spent,
      difficulty_level,
      confidence_level,
    } = body;
    
    // Validation
    if (!task_id || !work_summary || !task_objective || !final_outcome || 
        !scope_change || !output_type || !output_description || !time_spent || 
        !difficulty_level || !confidence_level) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }
    
    // Validate work_summary minimum 40 words
    const wordCount = work_summary.trim().split(/\s+/).length;
    if (wordCount < 40) {
      return NextResponse.json(
        { error: `Work summary must be at least 40 words (currently ${wordCount})` },
        { status: 400 }
      );
    }
    
    const db = getDb();
    
    // Check if task exists and is assigned to user
    const task = db.prepare(`
      SELECT * FROM assigned_tasks 
      WHERE id = ? AND assigned_to = ? AND status IN ('assigned', 'in_progress')
    `).get(task_id, userId);
    
    if (!task) {
      return NextResponse.json(
        { error: 'Task not found or not assigned to you' },
        { status: 404 }
      );
    }
    
    // Check if already submitted
    const existing = db.prepare(`
      SELECT id FROM task_submissions WHERE task_id = ? AND user_id = ?
    `).get(task_id, userId);
    
    if (existing) {
      return NextResponse.json(
        { error: 'Task already submitted. Please wait for review or contact admin.' },
        { status: 400 }
      );
    }
    
    // Create submission
    const result = db.prepare(`
      INSERT INTO task_submissions 
      (task_id, user_id, work_summary, task_objective, final_outcome, scope_change,
       output_type, output_description, time_spent, difficulty_level, confidence_level)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      task_id,
      userId,
      work_summary,
      task_objective,
      final_outcome,
      scope_change,
      output_type,
      output_description,
      time_spent,
      difficulty_level,
      confidence_level
    );
    
    // Update task status to pending_review
    db.prepare(`
      UPDATE assigned_tasks 
      SET status = 'pending_review', submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(task_id);
    
    // Link with today's attendance
    const today = new Date().toISOString().split('T')[0];
    const attendance = db.prepare(`
      SELECT id FROM attendance WHERE user_id = ? AND date = ?
    `).get(userId, today);
    
    if (attendance) {
      db.prepare(`
        INSERT INTO task_clockin_links (task_id, user_id, date, attendance_id)
        VALUES (?, ?, ?, ?)
      `).run(task_id, userId, today, (attendance as { id: number }).id);
    }
    
    // Create notification for user
    db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (?, 'task_submitted', ?, ?, ?)
    `).run(
      userId,
      'Task Submitted',
      'Your task has been submitted for review',
      '/tasks/assigned'
    );
    
    return NextResponse.json({
      success: true,
      submissionId: result.lastInsertRowid,
    });
  } catch (error) {
    console.error('Create task submission error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/task-submissions - Update existing submission (for rejected tasks)
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = parseInt(session.user.id);
    const body = await request.json();
    const {
      task_id,
      work_summary,
      task_objective,
      final_outcome,
      scope_change,
      output_type,
      output_description,
      time_spent,
      difficulty_level,
      confidence_level,
    } = body;
    
    if (!task_id) {
      return NextResponse.json(
        { error: 'Task ID required' },
        { status: 400 }
      );
    }
    
    // Validate work_summary minimum 40 words
    const wordCount = work_summary.trim().split(/\s+/).length;
    if (wordCount < 40) {
      return NextResponse.json(
        { error: `Work summary must be at least 40 words (currently ${wordCount})` },
        { status: 400 }
      );
    }
    
    const db = getDb();
    
    // Check if task was rejected
    const task = db.prepare(`
      SELECT * FROM assigned_tasks 
      WHERE id = ? AND assigned_to = ? AND status = 'rejected'
    `).get(task_id, userId);
    
    if (!task) {
      return NextResponse.json(
        { error: 'Task not found or not in rejected status' },
        { status: 404 }
      );
    }
    
    // Get existing submission
    const existing = db.prepare(`
      SELECT id FROM task_submissions WHERE task_id = ? AND user_id = ?
    `).get(task_id, userId) as { id: number } | undefined;
    
    if (!existing) {
      return NextResponse.json(
        { error: 'Original submission not found' },
        { status: 404 }
      );
    }
    
    // Update submission
    db.prepare(`
      UPDATE task_submissions 
      SET work_summary = ?, task_objective = ?, final_outcome = ?, scope_change = ?,
          output_type = ?, output_description = ?, time_spent = ?, difficulty_level = ?,
          confidence_level = ?, submitted_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      work_summary,
      task_objective,
      final_outcome,
      scope_change,
      output_type,
      output_description,
      time_spent,
      difficulty_level,
      confidence_level,
      existing.id
    );
    
    // Reset task status to pending_review
    db.prepare(`
      UPDATE assigned_tasks 
      SET status = 'pending_review', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(task_id);
    
    // Delete old AI analysis if exists
    db.prepare('DELETE FROM task_ai_analysis WHERE submission_id = ?').run(existing.id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update task submission error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
