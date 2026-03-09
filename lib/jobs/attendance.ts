'use server';

import { getDb } from '@/lib/db';
import { format, parseISO, setHours, setMinutes } from 'date-fns';

/**
 * Auto clock-out users who haven't clocked out by the configured time
 * This should run at the auto_clockout_time (default: 6:05 PM)
 */
export async function processAutoClockOut() {
  const db = getDb();
  const today = format(new Date(), 'yyyy-MM-dd');
  
  // Get system config
  const config = db.prepare('SELECT auto_clockout_time, min_work_hours, half_day_threshold FROM system_config WHERE id = 1')
    .get() as { auto_clockout_time: string; min_work_hours: number; half_day_threshold: number };
  
  // Find all users who have clocked in but not clocked out today
  const activeAttendances = db.prepare(`
    SELECT a.*, u.email, u.name 
    FROM attendance a
    JOIN users u ON a.user_id = u.id
    WHERE a.date = ? AND a.clock_in IS NOT NULL AND a.clock_out IS NULL
  `).all(today) as {
    id: number;
    user_id: number;
    clock_in: string;
    email: string;
    name: string;
  }[];
  
  console.log(`[Auto Clock-out] Processing ${activeAttendances.length} active attendances`);
  
  for (const attendance of activeAttendances) {
    // Parse the auto clock-out time
    const [hours, minutes] = config.auto_clockout_time.split(':').map(Number);
    const clockOutTime = setMinutes(setHours(new Date(), hours), minutes);
    
    // Calculate hours worked
    const clockIn = parseISO(attendance.clock_in);
    const hoursWorked = (clockOutTime.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
    
    // Determine status
    let status = 'present';
    if (hoursWorked < config.half_day_threshold) {
      status = 'unaccounted';
    } else if (hoursWorked < config.min_work_hours) {
      status = 'half_day';
    }
    
    // Update attendance record
    db.prepare(`
      UPDATE attendance 
      SET clock_out = ?, status = ?, is_auto_clockout = 1
      WHERE id = ?
    `).run(clockOutTime.toISOString(), status, attendance.id);
    
    console.log(`[Auto Clock-out] ${attendance.name} - ${hoursWorked.toFixed(2)} hours - ${status}`);
    
    // Create notification
    db.prepare(`
      INSERT INTO notifications (user_id, type, title, message)
      VALUES (?, 'attendance', 'Auto Clock-out', ?)
    `).run(
      attendance.user_id,
      `You were automatically clocked out at ${config.auto_clockout_time}. Hours worked: ${hoursWorked.toFixed(1)}`
    );
  }
  
  return { processed: activeAttendances.length };
}

interface SystemConfig {
  min_work_hours: number;
  half_day_threshold: number;
  shift_start_time: string;
}

interface AttendanceRecord {
  id: number;
  user_id: number;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  total_hours: number | null;
  status: string;
}

interface LeaveBalance {
  id: number;
  remaining_leaves: number;
}

/**
 * Process daily attendance for all users
 * This runs at 11:55 PM daily
 * 
 * Rules:
 * - No clock in at all = Unaccounted (deduct 1 leave or mark LOP)
 * - Less than half_day_threshold hours = Unaccounted (deduct 1 leave or mark LOP)
 * - Between half_day_threshold and min_work_hours = Half Day (deduct 0.5 leave)
 * - More than min_work_hours = Normal (no deduction)
 */
export async function processDailyAttendance() {
  const db = getDb();
  const today = format(new Date(), 'yyyy-MM-dd');
  const currentYear = new Date().getFullYear();
  
  // Get system config
  const config = db.prepare('SELECT min_work_hours, half_day_threshold FROM system_config WHERE id = 1')
    .get() as SystemConfig;
  
  // Get all active users
  const users = db.prepare('SELECT id, name, email FROM users WHERE is_active = 1').all() as {
    id: number;
    name: string;
    email: string;
  }[];
  
  let stats = {
    unaccounted: 0,
    halfDay: 0,
    lop: 0,
    normal: 0,
  };
  
  for (const user of users) {
    // Get attendance record for today
    const attendance = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?')
      .get(user.id, today) as AttendanceRecord | undefined;
    
    let finalStatus: string;
    let deduction = 0;
    let isLop = false;
    
    if (!attendance || !attendance.clock_in) {
      // User didn't clock in at all
      finalStatus = 'unaccounted';
      deduction = 1.0;
      
      // Create attendance record if it doesn't exist
      if (!attendance) {
        db.prepare('INSERT INTO attendance (user_id, date, status) VALUES (?, ?, ?)')
          .run(user.id, today, 'unaccounted');
      } else {
        db.prepare('UPDATE attendance SET status = ? WHERE id = ?')
          .run('unaccounted', attendance.id);
      }
      
    } else if (!attendance.clock_out) {
      // User clocked in but didn't clock out - auto clock-out should have handled this
      // But if it didn't, mark as unaccounted
      finalStatus = 'unaccounted';
      deduction = 1.0;
      
      db.prepare('UPDATE attendance SET status = ? WHERE id = ?')
        .run('unaccounted', attendance.id);
        
    } else {
      // User has both clock in and out
      const hoursWorked = attendance.total_hours || 0;
      
      if (hoursWorked < config.half_day_threshold) {
        // Less than half day threshold (default 4 hours)
        finalStatus = 'unaccounted';
        deduction = 1.0;
        
        db.prepare('UPDATE attendance SET status = ? WHERE id = ?')
          .run('unaccounted', attendance.id);
          
      } else if (hoursWorked < config.min_work_hours) {
        // Between half day and full day (default 4-8 hours)
        finalStatus = 'half_day';
        deduction = 0.5;
        
        db.prepare('UPDATE attendance SET status = ? WHERE id = ?')
          .run('half_day', attendance.id);
          
      } else {
        // Full day worked
        finalStatus = attendance.status === 'late' ? 'late' : 'present';
        deduction = 0;
      }
    }
    
    // Apply leave deduction if needed
    if (deduction > 0) {
      // Check leave balance
      const balance = db.prepare('SELECT id, remaining_leaves FROM leave_balances WHERE user_id = ? AND year = ?')
        .get(user.id, currentYear) as LeaveBalance | undefined;
      
      const remainingLeaves = balance?.remaining_leaves || 0;
      
      if (remainingLeaves >= deduction) {
        // Deduct from leave balance
        db.prepare('UPDATE leave_balances SET used_leaves = used_leaves + ? WHERE user_id = ? AND year = ?')
          .run(deduction, user.id, currentYear);
        
        console.log(`[Daily Processing] ${user.name}: Deducted ${deduction} leave day(s) for ${finalStatus}`);
        
        // Create notification
        const deductionType = deduction === 1.0 ? '1 day' : '0.5 day';
        db.prepare(`
          INSERT INTO notifications (user_id, type, title, message)
          VALUES (?, 'attendance', 'Leave Deducted', ?)
        `).run(
          user.id,
          `${deductionType} has been deducted from your leave balance due to ${finalStatus === 'unaccounted' ? 'unaccounted attendance' : 'half day'}.`
        );
        
      } else {
        // Not enough leave balance - mark as LOP
        isLop = true;
        const lopDays = deduction;
        
        // Update attendance to LOP
        db.prepare('UPDATE attendance SET status = ? WHERE user_id = ? AND date = ?')
          .run('lop', user.id, today);
        
        // Add to LOP counter
        if (balance) {
          db.prepare('UPDATE leave_balances SET lop_days = lop_days + ? WHERE user_id = ? AND year = ?')
            .run(lopDays, user.id, currentYear);
        } else {
          // Create balance record with LOP
          db.prepare(`
            INSERT INTO leave_balances (user_id, year, total_leaves, used_leaves, lop_days)
            VALUES (?, ?, 20, 0, ?)
          `).run(user.id, currentYear, lopDays);
        }
        
        console.log(`[Daily Processing] ${user.name}: Marked as LOP (${lopDays} day(s))`);
        
        // Create notification
        db.prepare(`
          INSERT INTO notifications (user_id, type, title, message)
          VALUES (?, 'attendance', 'Loss of Pay Applied', ?)
        `).run(
          user.id,
          `You have been marked as Loss of Pay (LOP) for today due to insufficient leave balance.`
        );
      }
      
      if (finalStatus === 'unaccounted') stats.unaccounted++;
      if (finalStatus === 'half_day') stats.halfDay++;
      if (isLop) stats.lop++;
    } else {
      stats.normal++;
    }
  }
  
  console.log('[Daily Processing] Summary:', stats);
  
  return {
    success: true,
    date: today,
    processed: users.length,
    stats,
  };
}

/**
 * Process exception requests that were approved
 * This reverses deductions and corrects attendance records
 */
export async function processApprovedExceptions() {
  const db = getDb();
  const currentYear = new Date().getFullYear();
  
  // Get all approved exceptions that haven't been processed yet
  // We track this by checking if attendance was already updated
  const exceptions = db.prepare(`
    SELECT ae.*, a.status as attendance_status, a.user_id
    FROM attendance_exceptions ae
    JOIN attendance a ON ae.attendance_id = a.id
    WHERE ae.status = 'approved' 
    AND ae.reviewed_at > datetime('now', '-1 day')
  `).all() as {
    id: number;
    user_id: number;
    attendance_id: number;
    exception_type: string;
    requested_clock_in: string | null;
    requested_clock_out: string | null;
    attendance_status: string;
  }[];
  
  let reversedCount = 0;
  
  for (const exception of exceptions) {
    // Determine what to reverse based on previous status
    let deductionToReverse = 0;
    
    if (exception.attendance_status === 'unaccounted') {
      deductionToReverse = 1.0;
    } else if (exception.attendance_status === 'half_day') {
      deductionToReverse = 0.5;
    } else if (exception.attendance_status === 'lop') {
      // Reverse LOP
      db.prepare('UPDATE leave_balances SET lop_days = lop_days - 1 WHERE user_id = ? AND year = ?')
        .run(exception.user_id, currentYear);
      deductionToReverse = 1.0;
    }
    
    // Restore leave balance
    if (deductionToReverse > 0 && exception.attendance_status !== 'lop') {
      db.prepare('UPDATE leave_balances SET used_leaves = used_leaves - ? WHERE user_id = ? AND year = ?')
        .run(deductionToReverse, exception.user_id, currentYear);
    }
    
    // Update attendance record with corrected times
    let newStatus = 'present';
    
    if (exception.requested_clock_in && exception.requested_clock_out) {
      const clockIn = new Date(exception.requested_clock_in);
      const clockOut = new Date(exception.requested_clock_out);
      const hoursWorked = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
      
      // Recalculate status based on hours
      const config = db.prepare('SELECT min_work_hours, half_day_threshold FROM system_config WHERE id = 1')
        .get() as SystemConfig;
      
      if (hoursWorked < config.half_day_threshold) {
        newStatus = 'unaccounted';
      } else if (hoursWorked < config.min_work_hours) {
        newStatus = 'half_day';
      }
    }
    
    db.prepare(`
      UPDATE attendance 
      SET clock_in = COALESCE(?, clock_in),
          clock_out = COALESCE(?, clock_out),
          status = ?
      WHERE id = ?
    `).run(exception.requested_clock_in, exception.requested_clock_out, newStatus, exception.attendance_id);
    
    // Create notification for user
    db.prepare(`
      INSERT INTO notifications (user_id, type, title, message)
      VALUES (?, 'attendance', 'Exception Approved', ?)
    `).run(
      exception.user_id,
      'Your attendance exception request has been approved. Your leave balance has been restored.'
    );
    
    reversedCount++;
    console.log(`[Exception Processing] Reversed deduction for user ${exception.user_id}`);
  }
  
  return { processed: reversedCount };
}

/**
 * Generate daily summary report for admins
 */
export async function generateDailySummary() {
  const db = getDb();
  const today = format(new Date(), 'yyyy-MM-dd');
  
  // Get summary stats
  const stats = db.prepare(`
    SELECT 
      status,
      COUNT(*) as count
    FROM attendance
    WHERE date = ?
    GROUP BY status
  `).all(today) as { status: string; count: number }[];
  
  // Get pending approvals
  const pendingLeaves = db.prepare(`
    SELECT COUNT(*) as count FROM leave_applications WHERE status = 'pending'
  `).get() as { count: number };
  
  const pendingExceptions = db.prepare(`
    SELECT COUNT(*) as count FROM attendance_exceptions WHERE status = 'pending'
  `).get() as { count: number };
  
  const summary = {
    date: today,
    attendance: stats.reduce((acc, s) => ({ ...acc, [s.status]: s.count }), {}),
    pendingApprovals: {
      leaves: pendingLeaves.count,
      exceptions: pendingExceptions.count,
    },
  };
  
  console.log('[Daily Summary]', summary);
  
  return summary;
}
