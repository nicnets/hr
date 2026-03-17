import { getDb } from '@/lib/db';
import { sendEmail, logEmail } from '@/lib/email';
import { analyzeTaskSubmission, saveAIAnalysis } from '@/lib/ai';
import type { TaskSubmission } from '@/types';

// IST timezone offset in milliseconds (IST = UTC+5:30)
const IST_OFFSET = 5.5 * 60 * 60 * 1000;

// Get current date in IST
function getISTDate(): Date {
  const now = new Date();
  return new Date(now.getTime() + IST_OFFSET);
}

// Format date for database (YYYY-MM-DD)
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Process recurring tasks - assign daily/weekly/monthly tasks
export async function processRecurringTasks(): Promise<{
  assigned: number;
  details: Array<{ templateId: number; userId: number; title: string }>;
}> {
  const db = getDb();
  const istNow = getISTDate();
  const today = formatDate(istNow);
  const currentHour = istNow.getUTCHours();
  const currentDay = istNow.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
  const currentDate = istNow.getUTCDate();

  const assigned: Array<{ templateId: number; userId: number; title: string }> = [];

  // Get all active recurring templates
  const templates = db.prepare(`
    SELECT rt.*, u.email as user_email, u.name as user_name
    FROM recurring_task_templates rt
    LEFT JOIN users u ON rt.assigned_to = u.id
    WHERE rt.is_active = 1 AND rt.assigned_to IS NOT NULL
  `).all() as Array<{
    id: number;
    title: string;
    description: string;
    recurrence_type: 'daily' | 'weekly' | 'monthly';
    due_time: string | null;
    due_day: number | null;
    project_id: number | null;
    assigned_to: number;
    last_assigned_date: string | null;
    user_email: string;
    user_name: string;
  }>;

  for (const template of templates) {
    let shouldAssign = false;
    let dueDate: string | null = null;

    // Check if already assigned today
    if (template.last_assigned_date === today) {
      continue;
    }

    if (template.recurrence_type === 'daily') {
      // Daily tasks are assigned at 04:00 IST
      if (currentHour >= 4) {
        shouldAssign = true;
        // Due date is today at the specified time
        dueDate = today;
      }
    } else if (template.recurrence_type === 'weekly') {
      // Weekly tasks are assigned on the due day at 04:00 IST
      if (template.due_day !== null && currentDay === template.due_day && currentHour >= 4) {
        shouldAssign = true;
        dueDate = today;
      }
    } else if (template.recurrence_type === 'monthly') {
      // Monthly tasks are assigned on the due date at 04:00 IST
      if (template.due_day !== null && currentDate === template.due_day && currentHour >= 4) {
        shouldAssign = true;
        dueDate = today;
      }
    }

    if (shouldAssign) {
      // Create the assigned task
      const result = db.prepare(`
        INSERT INTO assigned_tasks 
        (title, description, assigned_to, assigned_by, due_date, status, 
         recurrence_type, parent_template_id, project_id)
        VALUES (?, ?, ?, ?, ?, 'assigned', ?, ?, ?)
      `).run(
        template.title,
        template.description,
        template.assigned_to,
        1, // System/admin user
        dueDate,
        template.recurrence_type,
        template.id,
        template.project_id
      );

      // Update last assigned date
      db.prepare(`
        UPDATE recurring_task_templates 
        SET last_assigned_date = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(today, template.id);

      // Create notification
      db.prepare(`
        INSERT INTO notifications (user_id, type, title, message, link)
        VALUES (?, 'task_assigned', ?, ?, ?)
      `).run(
        template.assigned_to,
        `New ${template.recurrence_type} Task Assigned`,
        `You have been assigned: ${template.title}`,
        '/tasks/assigned'
      );

      // Send email notification
      if (template.user_email) {
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">New Task Assigned</h2>
            <p>Hi ${template.user_name},</p>
            <p>You have been assigned a new ${template.recurrence_type} task:</p>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Title:</strong> ${template.title}</p>
              <p><strong>Type:</strong> ${template.recurrence_type.charAt(0).toUpperCase() + template.recurrence_type.slice(1)} Task</p>
              ${dueDate ? `<p><strong>Due Date:</strong> ${dueDate}</p>` : ''}
            </div>
            <div style="margin: 30px 0;">
              <a href="${process.env.NEXTAUTH_URL}/tasks/assigned" 
                 style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                View Task
              </a>
            </div>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #999; font-size: 12px;">
              This is an automated notification from the HR Portal.
            </p>
          </div>
        `;
        
        await sendEmail({
          to: template.user_email,
          subject: `New ${template.recurrence_type} Task: ${template.title}`,
          html: emailHtml,
        });
      }

      assigned.push({
        templateId: template.id,
        userId: template.assigned_to,
        title: template.title,
      });
    }
  }

  return {
    assigned: assigned.length,
    details: assigned,
  };
}

// Process AI analysis for pending task submissions (both assigned tasks and employee-logged tasks)
export async function processAIAnalysis(): Promise<{
  processed: number;
  approved: number;
  rejected: number;
  needsReview: number;
  errors: number;
}> {
  const db = getDb();
  const istNow = getISTDate();
  const currentHour = istNow.getUTCHours();

  // Only run at 23:00 IST (11 PM)
  if (currentHour !== 23) {
    return {
      processed: 0,
      approved: 0,
      rejected: 0,
      needsReview: 0,
      errors: 0,
    };
  }

  let processed = 0;
  let approved = 0;
  let rejected = 0;
  let needsReview = 0;
  let errors = 0;

  // Process assigned task submissions first
  const submissions = db.prepare(`
    SELECT ts.*, at.title as task_title, at.description as task_description,
           u.email as user_email, u.name as user_name
    FROM task_submissions ts
    JOIN assigned_tasks at ON ts.task_id = at.id
    JOIN users u ON ts.user_id = u.id
    LEFT JOIN task_ai_analysis taa ON ts.id = taa.submission_id
    WHERE taa.id IS NULL
    GROUP BY ts.user_id
    ORDER BY ts.submitted_at ASC
  `).all() as Array<TaskSubmission & {
    task_title: string;
    task_description: string;
    user_email: string;
    user_name: string;
  }>;

  for (const submission of submissions) {
    try {
      const analysis = await analyzeTaskSubmission(
        submission.task_title,
        submission.task_description,
        submission
      );

      if (analysis) {
        // Save analysis result
        saveAIAnalysis(
          submission.task_id,
          submission.id,
          submission.user_id,
          analysis
        );

        // Update task status based on decision
        if (analysis.decision === 'approved') {
          db.prepare(`
            UPDATE assigned_tasks 
            SET status = 'closed', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(submission.task_id);
          approved++;
        } else if (analysis.decision === 'rejected') {
          db.prepare(`
            UPDATE assigned_tasks 
            SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(submission.task_id);
          rejected++;
        } else {
          db.prepare(`
            UPDATE assigned_tasks 
            SET status = 'pending_review', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(submission.task_id);
          needsReview++;
        }

        // Send email notification
        await sendAIAnalysisEmail(
          submission.user_email,
          submission.user_name,
          submission.task_title,
          analysis
        );

        processed++;
      } else {
        errors++;
      }
    } catch (error) {
      console.error(`AI analysis error for submission ${submission.id}:`, error);
      errors++;
    }
  }

  // Process employee-logged tasks (task_logs) with AI details
  const employeeTasks = db.prepare(`
    SELECT tl.*, u.email as user_email, u.name as user_name
    FROM task_logs tl
    JOIN users u ON tl.user_id = u.id
    WHERE tl.ai_analyzed = 0
      AND tl.work_summary IS NOT NULL
    GROUP BY tl.user_id
    ORDER BY tl.created_at ASC
  `).all() as Array<{
    id: number;
    user_id: number;
    task_description: string;
    project_name: string;
    work_summary: string;
    task_objective: string;
    final_outcome: string;
    scope_change: string;
    output_type: string;
    output_description: string;
    difficulty_level: string;
    confidence_level: string;
    user_email: string;
    user_name: string;
  }>;

  for (const task of employeeTasks) {
    try {
      // Create a submission-like object for analysis
      const submission = {
        work_summary: task.work_summary,
        task_objective: task.task_objective,
        final_outcome: task.final_outcome,
        scope_change: task.scope_change,
        output_type: task.output_type,
        output_description: task.output_description,
        difficulty_level: task.difficulty_level,
        confidence_level: task.confidence_level,
        time_spent: '1–2 hours', // Default since we don't capture this separately
      } as TaskSubmission;

      const analysis = await analyzeTaskSubmission(
        task.task_description,
        `Project: ${task.project_name}`,
        submission
      );

      if (analysis) {
        // Save analysis directly to task_logs
        db.prepare(`
          UPDATE task_logs
          SET ai_analyzed = 1,
              ai_score = ?,
              ai_decision = ?,
              ai_analysis_summary = ?,
              ai_analyzed_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          analysis.score,
          analysis.decision,
          analysis.analysis_summary,
          task.id
        );

        // Count results
        if (analysis.decision === 'approved') {
          approved++;
        } else if (analysis.decision === 'rejected') {
          rejected++;
        } else {
          needsReview++;
        }

        // Send email notification
        await sendAIAnalysisEmail(
          task.user_email,
          task.user_name,
          task.task_description.substring(0, 100),
          analysis
        );

        processed++;
      } else {
        errors++;
      }
    } catch (error) {
      console.error(`AI analysis error for task log ${task.id}:`, error);
      errors++;
    }
  }

  return {
    processed,
    approved,
    rejected,
    needsReview,
    errors,
  };
}

// Send AI analysis result email
async function sendAIAnalysisEmail(
  email: string,
  name: string,
  taskTitle: string,
  analysis: {
    score: number;
    decision: 'approved' | 'needs_review' | 'rejected';
    analysis_summary: string;
  }
): Promise<void> {
  const decisionColor = analysis.decision === 'approved' ? '#28a745' : 
                       analysis.decision === 'rejected' ? '#dc3545' : '#ffc107';
  const decisionText = analysis.decision === 'approved' ? 'Approved' : 
                      analysis.decision === 'rejected' ? 'Rejected' : 'Needs Review';
  
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${decisionColor};">Task Analysis Result: ${decisionText}</h2>
      <p>Hi ${name},</p>
      <p>Your task submission has been analyzed:</p>
      <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Task:</strong> ${taskTitle}</p>
        <p><strong>Score:</strong> ${analysis.score}/100</p>
        <p><strong>Decision:</strong> <span style="color: ${decisionColor}; font-weight: bold;">${decisionText}</span></p>
        <p><strong>Summary:</strong> ${analysis.analysis_summary}</p>
      </div>
      ${analysis.decision === 'rejected' ? `
        <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Action Required:</strong> Your task has been rejected. Please review the feedback and provide more detailed information.</p>
        </div>
      ` : ''}
      <div style="margin: 30px 0;">
        <a href="${process.env.NEXTAUTH_URL}/tasks" 
           style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
          View Tasks
        </a>
      </div>
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      <p style="color: #999; font-size: 12px;">
        This is an automated notification from the HR Portal.
      </p>
    </div>
  `;
  
  await sendEmail({
    to: email,
    subject: `Task Analysis Result: ${decisionText} - ${taskTitle}`,
    html: emailHtml,
  });
}

// Check for attendance violations (no task submitted, task rejected, hours mismatch)
export async function checkAttendanceViolations(): Promise<{
  violations: number;
  emailsSent: number;
  leavesDeducted: number;
}> {
  const db = getDb();
  const istNow = getISTDate();
  const today = formatDate(istNow);

  let emailsSent = 0;
  let leavesDeducted = 0;

  // Get all employees who clocked in today
  const attendances = db.prepare(`
    SELECT a.*, u.email, u.name
    FROM attendance a
    JOIN users u ON a.user_id = u.id
    WHERE a.date = ? AND a.clock_in IS NOT NULL AND u.is_active = 1
  `).all(today) as Array<{
    id: number;
    user_id: number;
    total_hours: number | null;
    email: string;
    name: string;
  }>;

  for (const attendance of attendances) {
    // Check if employee has submitted any tasks today
    const taskCount = db.prepare(`
      SELECT COUNT(*) as count FROM task_submissions
      WHERE user_id = ? AND date(submitted_at) = ?
    `).get(attendance.user_id, today) as { count: number };

    // Check if any task was rejected today
    const rejectedTask = db.prepare(`
      SELECT at.* FROM assigned_tasks at
      JOIN task_submissions ts ON ts.task_id = at.id
      WHERE ts.user_id = ? AND at.status = 'rejected' AND date(ts.submitted_at) = ?
      LIMIT 1
    `).get(attendance.user_id, today) as { id: number } | undefined;

    let violationType: string | null = null;

    if (taskCount.count === 0) {
      violationType = 'no_task_submitted';
    } else if (rejectedTask) {
      violationType = 'task_rejected';
    } else if (attendance.total_hours !== null && attendance.total_hours < 4) {
      // Less than 4 hours worked (partial day)
      violationType = 'hours_mismatch';
    }

    if (violationType) {
      // Check for existing violation record
      const existingViolation = db.prepare(`
        SELECT * FROM attendance_violations 
        WHERE user_id = ? AND date = ? AND violation_type = ?
      `).get(attendance.user_id, today, violationType) as {
        id: number;
        email_count: number;
        leave_deducted: boolean;
      } | undefined;

      if (!existingViolation) {
        // Create new violation record
        db.prepare(`
          INSERT INTO attendance_violations (user_id, date, violation_type, email_count)
          VALUES (?, ?, ?, 1)
        `).run(attendance.user_id, today, violationType);
        
        // Send first warning email
        await sendViolationEmail(attendance.email, attendance.name, violationType, 1);
        emailsSent++;
      } else if (existingViolation.email_count < 2 && !existingViolation.leave_deducted) {
        // Increment email count and send second warning
        db.prepare(`
          UPDATE attendance_violations 
          SET email_count = email_count + 1
          WHERE id = ?
        `).run(existingViolation.id);
        
        await sendViolationEmail(attendance.email, attendance.name, violationType, 2);
        emailsSent++;
      } else if (existingViolation.email_count >= 2 && !existingViolation.leave_deducted) {
        // Third strike - deduct leave
        const currentYear = istNow.getUTCFullYear();
        
        // Deduct half day for partial attendance
        db.prepare(`
          UPDATE leave_balances 
          SET used_leaves = used_leaves + 0.5, lop_days = lop_days + 0.5
          WHERE user_id = ? AND year = ?
        `).run(attendance.user_id, currentYear);

        db.prepare(`
          UPDATE attendance_violations 
          SET leave_deducted = 1, deduction_hours = 4, resolved_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(existingViolation.id);

        // Send final notice email
        await sendViolationEmail(attendance.email, attendance.name, violationType, 3, true);
        emailsSent++;
        leavesDeducted++;
      }
    }
  }

  return {
    violations: attendances.length,
    emailsSent,
    leavesDeducted,
  };
}

// Send violation email
async function sendViolationEmail(
  email: string,
  name: string,
  violationType: string,
  warningNumber: number,
  leaveDeducted: boolean = false
): Promise<void> {
  const violationMessages: Record<string, string> = {
    no_task_submitted: 'No task was submitted for today',
    task_rejected: 'Your task submission was rejected',
    hours_mismatch: 'Your logged hours do not match the required work hours',
  };

  let subject: string;
  let color: string;
  let message: string;

  if (leaveDeducted) {
    subject = 'FINAL NOTICE: Leave Deducted Due to Attendance Violation';
    color = '#dc3545';
    message = `This is your final notice. Due to repeated violations (${violationMessages[violationType]}), 0.5 day leave has been deducted from your balance.`;
  } else if (warningNumber === 2) {
    subject = 'SECOND WARNING: Attendance Violation';
    color = '#ffc107';
    message = `This is your second warning. ${violationMessages[violationType]}. Please take immediate action. A third violation will result in automatic leave deduction.`;
  } else {
    subject = 'WARNING: Attendance Violation Detected';
    color = '#ffc107';
    message = `${violationMessages[violationType]}. Please ensure to submit your tasks and maintain proper work hours.`;
  }

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${color};">${subject}</h2>
      <p>Hi ${name},</p>
      <p>${message}</p>
      <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Issue:</strong> ${violationMessages[violationType]}</p>
        <p><strong>Warning #:</strong> ${warningNumber}</p>
      </div>
      ${!leaveDeducted ? `
        <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Action Required:</strong> Please log your tasks and ensure your work hours are properly recorded.</p>
        </div>
        <div style="margin: 30px 0;">
          <a href="${process.env.NEXTAUTH_URL}/tasks/log" 
             style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Log Tasks
          </a>
        </div>
      ` : ''}
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      <p style="color: #999; font-size: 12px;">
        This is an automated notification from the HR Portal.
      </p>
    </div>
  `;

  await sendEmail({
    to: email,
    subject,
    html: emailHtml,
  });
}

// Get pending AI analysis count (for dashboard)
export function getPendingAIAnalysisCount(): number {
  const db = getDb();
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM task_submissions ts
    LEFT JOIN task_ai_analysis taa ON ts.id = taa.submission_id
    WHERE taa.id IS NULL
  `).get() as { count: number };

  return result.count;
}

// Get recent AI analysis results (for admin dashboard)
export function getRecentAIAnalysis(limit: number = 10): Array<{
  id: number;
  task_title: string;
  user_name: string;
  score: number;
  decision: string;
  analyzed_at: string;
}> {
  const db = getDb();
  return db.prepare(`
    SELECT taa.id, at.title as task_title, u.name as user_name,
           taa.score, taa.decision, taa.analyzed_at
    FROM task_ai_analysis taa
    JOIN assigned_tasks at ON taa.task_id = at.id
    JOIN users u ON taa.user_id = u.id
    ORDER BY taa.analyzed_at DESC
    LIMIT ?
  `).all(limit) as Array<{
    id: number;
    task_title: string;
    user_name: string;
    score: number;
    decision: string;
    analyzed_at: string;
  }>;
}
