'use server';

import { getDb } from '@/lib/db';
import { format, parseISO, setHours, setMinutes } from 'date-fns';
import { sendEmail, logEmail } from '@/lib/email';

// Shift timing constants
const SHIFT_END_HOUR = 22; // 10 PM
const MINIMUM_WORK_HOURS = 8;

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
 * Auto clock-out users who haven't clocked out by the configured time
 * This should run at the auto_clockout_time (default: 10:00 PM)
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
    let status = 'auto_clockout';
    if (hoursWorked < config.half_day_threshold) {
      status = 'unaccounted';
    } else if (hoursWorked < config.min_work_hours) {
      status = 'half_day';
    }
    
    // Update attendance record
    db.prepare(`
      UPDATE attendance 
      SET clock_out = ?, status = ?, is_auto_clockout = 1, is_final_session = 1
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
    
    // Send email notification about auto clock-out
    try {
      if (attendance.email) {
        const emailSent = await sendEmail({
          to: attendance.email,
          subject: 'Auto Clock-out Notification',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #dc3545;">Auto Clock-out</h2>
              <p>Hi ${attendance.name},</p>
              <p>You were automatically clocked out at <strong>${config.auto_clockout_time}</strong> as you did not manually clock out.</p>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <p><strong>Date:</strong> ${today}</p>
                <p><strong>Clock In:</strong> ${format(clockIn, 'HH:mm')}</p>
                <p><strong>Auto Clock Out:</strong> ${config.auto_clockout_time}</p>
                <p><strong>Hours Worked:</strong> ${hoursWorked.toFixed(1)} hours</p>
              </div>
              
              <p>Please remember to clock out manually in the future to ensure accurate time tracking.</p>
              
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 12px;">
                This is an automated notification from ForceFriction AI HR Portal.
              </p>
            </div>
          `,
        });
        
        await logEmail(
          attendance.user_id,
          'auto_clockout',
          'Auto Clock-out Notification',
          emailSent ? 'sent' : 'failed'
        );
      }
    } catch (emailError) {
      console.error('Failed to send auto clock-out email:', emailError);
    }
  }
  
  return { processed: activeAttendances.length };
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
    // Get all attendance sessions for today
    const sessions = db.prepare(`
      SELECT * FROM attendance 
      WHERE user_id = ? AND date = ?
    `).all(user.id, today) as AttendanceRecord[];
    
    // Calculate total hours from all sessions
    const totalHours = sessions.reduce((sum, s) => sum + (s.total_hours || 0), 0);
    
    let finalStatus: string;
    let deduction = 0;
    let isLop = false;
    let hasActiveSession = false;
    
    // Check if there's an active session (shouldn't happen after auto clock-out)
    hasActiveSession = sessions.some(s => s.clock_in && !s.clock_out);
    
    if (sessions.length === 0 || !sessions.some(s => s.clock_in)) {
      // User didn't clock in at all
      finalStatus = 'unaccounted';
      deduction = 1.0;
      
      // Create attendance record if it doesn't exist
      db.prepare('INSERT INTO attendance (user_id, date, status) VALUES (?, ?, ?)')
        .run(user.id, today, 'unaccounted');
      
    } else if (hasActiveSession) {
      // User clocked in but didn't clock out - auto clock-out should have handled this
      // But if it didn't, mark as unaccounted
      finalStatus = 'unaccounted';
      deduction = 1.0;
      
      // Update active session
      const activeSession = sessions.find(s => s.clock_in && !s.clock_out);
      if (activeSession) {
        db.prepare('UPDATE attendance SET status = ? WHERE id = ?')
          .run('unaccounted', activeSession.id);
      }
        
    } else {
      // User has clocked in and out (all sessions closed)
      
      if (totalHours < config.half_day_threshold) {
        // Less than half day threshold (default 4 hours)
        finalStatus = 'unaccounted';
        deduction = 1.0;
        
        // Update all sessions
        sessions.forEach(s => {
          db.prepare('UPDATE attendance SET status = ? WHERE id = ?')
            .run('unaccounted', s.id);
        });
          
      } else if (totalHours < config.min_work_hours) {
        // Between half day and full day (default 4-8 hours)
        finalStatus = 'half_day';
        deduction = 0.5;
        
        // Update all sessions
        sessions.forEach(s => {
          if (s.status !== 'late' && s.status !== 'auto_clockout') {
            db.prepare('UPDATE attendance SET status = ? WHERE id = ?')
              .run('half_day', s.id);
          }
        });
        
        // Send email for not meeting minimum hours
        try {
          if (user.email) {
            const emailSent = await sendEmail({
              to: user.email,
              subject: 'Attendance Notice: Partial Day Worked',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #ffc107;">Attendance Notice</h2>
                  <p>Hi ${user.name},</p>
                  <p>You worked a partial day today.</p>
                  
                  <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>Date:</strong> ${today}</p>
                    <p><strong>Total Hours:</strong> ${totalHours.toFixed(1)} hours</p>
                    <p><strong>Status:</strong> Half Day</p>
                    <p><strong>Leave Deduction:</strong> 0.5 day</p>
                  </div>
                  
                  <p>Minimum ${config.min_work_hours} hours are required for a full day.</p>
                  
                  <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                  <p style="color: #999; font-size: 12px;">
                    This is an automated notification from ForceFriction AI HR Portal.
                  </p>
                </div>
              `,
            });
            
            await logEmail(
              user.id,
              'half_day_notice',
              'Attendance Notice: Partial Day Worked',
              emailSent ? 'sent' : 'failed'
            );
          }
        } catch (emailError) {
          console.error('Failed to send half-day notice email:', emailError);
        }
          
      } else {
        // Full day worked
        finalStatus = 'present';
        deduction = 0;
        
        // Check if any session was late
        const hasLateSession = sessions.some(s => s.status === 'late');
        if (hasLateSession) {
          finalStatus = 'late';
        }
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
        
        // Send email about leave deduction
        try {
          if (user.email) {
            await sendEmail({
              to: user.email,
              subject: 'Leave Deduction Notice',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #dc3545;">Leave Deduction Notice</h2>
                  <p>Hi ${user.name},</p>
                  <p>${deductionType} has been deducted from your leave balance.</p>
                  
                  <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>Date:</strong> ${today}</p>
                    <p><strong>Reason:</strong> ${finalStatus === 'unaccounted' ? 'Unaccounted Attendance' : 'Half Day Worked'}</p>
                    <p><strong>Hours Worked:</strong> ${totalHours.toFixed(1)} hours</p>
                    <p><strong>Deduction:</strong> ${deductionType}</p>
                  </div>
                  
                  <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                  <p style="color: #999; font-size: 12px;">
                    This is an automated notification from ForceFriction AI HR Portal.
                  </p>
                </div>
              `,
            });
          }
        } catch (emailError) {
          console.error('Failed to send leave deduction email:', emailError);
        }
        
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
        
        // Send LOP email
        try {
          if (user.email) {
            await sendEmail({
              to: user.email,
              subject: 'Loss of Pay (LOP) Notice',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #dc3545;">Loss of Pay Notice</h2>
                  <p>Hi ${user.name},</p>
                  <p>You have been marked as Loss of Pay (LOP) for today.</p>
                  
                  <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>Date:</strong> ${today}</p>
                    <p><strong>Hours Worked:</strong> ${totalHours.toFixed(1)} hours</p>
                    <p><strong>Reason:</strong> Insufficient leave balance</p>
                  </div>
                  
                  <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                  <p style="color: #999; font-size: 12px;">
                    This is an automated notification from ForceFriction AI HR Portal.
                  </p>
                </div>
              `,
            });
          }
        } catch (emailError) {
          console.error('Failed to send LOP email:', emailError);
        }
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
  
  // Get users with less than minimum hours
  const usersWithLowHours = db.prepare(`
    SELECT 
      u.name,
      u.email,
      COALESCE(SUM(a.total_hours), 0) as total_hours
    FROM users u
    LEFT JOIN attendance a ON u.id = a.user_id AND a.date = ?
    WHERE u.is_active = 1
    GROUP BY u.id
    HAVING total_hours < 8
  `).all(today) as { name: string; email: string; total_hours: number }[];
  
  const summary = {
    date: today,
    attendance: stats.reduce((acc, s) => ({ ...acc, [s.status]: s.count }), {}),
    pendingApprovals: {
      leaves: pendingLeaves.count,
      exceptions: pendingExceptions.count,
    },
    usersWithLowHours: usersWithLowHours.length,
    lowHoursDetails: usersWithLowHours,
  };
  
  console.log('[Daily Summary]', summary);
  
  return summary;
}
