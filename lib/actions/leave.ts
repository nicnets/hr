'use server';

import { getDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { differenceInBusinessDays, format, parseISO } from 'date-fns';

export async function getLeaveBalance(userId: number, year?: number) {
  const db = getDb();
  const targetYear = year || new Date().getFullYear();
  
  const balance = db.prepare(`
    SELECT * FROM leave_balances 
    WHERE user_id = ? AND year = ?
  `).get(userId, targetYear) as {
    id: number;
    total_leaves: number;
    used_leaves: number;
    remaining_leaves: number;
    lop_days: number;
  } | undefined;
  
  if (!balance) {
    // Create default balance
    const result = db.prepare(`
      INSERT INTO leave_balances (user_id, year, total_leaves, used_leaves, lop_days)
      VALUES (?, ?, 20, 0, 0)
    `).run(userId, targetYear);
    
    return {
      id: result.lastInsertRowid,
      total_leaves: 20,
      used_leaves: 0,
      remaining_leaves: 20,
      lop_days: 0,
    };
  }
  
  return balance;
}

export async function applyForLeave(userId: number, data: {
  start_date: string;
  end_date: string;
  leave_type: string;
  reason: string;
}) {
  const db = getDb();
  
  // Calculate days requested
  const daysRequested = differenceInBusinessDays(parseISO(data.end_date), parseISO(data.start_date)) + 1;
  
  if (daysRequested <= 0) {
    return { error: 'Invalid date range' };
  }
  
  // Get current balance
  const currentYear = new Date().getFullYear();
  const balance = await getLeaveBalance(userId, currentYear);
  
  // Check if LOP is needed
  const isLop = balance.remaining_leaves < daysRequested;
  
  // Create application
  const result = db.prepare(`
    INSERT INTO leave_applications 
    (user_id, start_date, end_date, leave_type, reason, days_requested, status, is_lop)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
  `).run(userId, data.start_date, data.end_date, data.leave_type, data.reason, daysRequested, isLop ? 1 : 0);
  
  revalidatePath('/leave');
  
  return { 
    success: true, 
    applicationId: result.lastInsertRowid,
    isLop,
    message: isLop 
      ? 'Warning: You do not have sufficient leave balance. This will be marked as Loss of Pay.' 
      : 'Leave application submitted successfully'
  };
}

export async function getLeaveApplications(userId: number) {
  const db = getDb();
  
  return db.prepare(`
    SELECT * FROM leave_applications 
    WHERE user_id = ? 
    ORDER BY created_at DESC
  `).all(userId) as {
    id: number;
    start_date: string;
    end_date: string;
    leave_type: string;
    reason: string;
    days_requested: number;
    status: string;
    is_lop: boolean;
    created_at: string;
  }[];
}

export async function approveLeave(applicationId: number, adminId: number) {
  const db = getDb();
  
  const application = db.prepare('SELECT * FROM leave_applications WHERE id = ?')
    .get(applicationId) as {
      user_id: number;
      days_requested: number;
      status: string;
      is_lop: boolean;
    } | undefined;
  
  if (!application || application.status !== 'pending') {
    return { error: 'Invalid application' };
  }
  
  const currentYear = new Date().getFullYear();
  
  if (!application.is_lop) {
    // Deduct from leave balance
    db.prepare(`
      UPDATE leave_balances 
      SET used_leaves = used_leaves + ?
      WHERE user_id = ? AND year = ?
    `).run(application.days_requested, application.user_id, currentYear);
  } else {
    // Add to LOP days
    db.prepare(`
      UPDATE leave_balances 
      SET lop_days = lop_days + ?
      WHERE user_id = ? AND year = ?
    `).run(application.days_requested, application.user_id, currentYear);
  }
  
  // Update application status
  db.prepare(`
    UPDATE leave_applications 
    SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(adminId, applicationId);
  
  revalidatePath('/admin/leave-applications');
  revalidatePath('/leave');
  
  return { success: true };
}

export async function rejectLeave(applicationId: number, adminId: number, reason: string) {
  const db = getDb();
  
  db.prepare(`
    UPDATE leave_applications 
    SET status = 'rejected', approved_by = ?, approved_at = CURRENT_TIMESTAMP, rejection_reason = ?
    WHERE id = ?
  `).run(adminId, reason, applicationId);
  
  revalidatePath('/admin/leave-applications');
  revalidatePath('/leave');
  
  return { success: true };
}

export async function getPendingLeaveApplications() {
  const db = getDb();
  
  return db.prepare(`
    SELECT la.*, u.name as user_name 
    FROM leave_applications la
    JOIN users u ON la.user_id = u.id
    WHERE la.status = 'pending'
    ORDER BY la.created_at DESC
  `).all() as {
    id: number;
    user_id: number;
    user_name: string;
    start_date: string;
    end_date: string;
    leave_type: string;
    reason: string;
    days_requested: number;
    is_lop: boolean;
    created_at: string;
  }[];
}
