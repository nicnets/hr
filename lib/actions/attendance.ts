'use server';

import { getDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { format, addMinutes, parseISO, isAfter, isBefore, setHours, setMinutes } from 'date-fns';
import { sendEmail, logEmail } from '@/lib/email';

// Shift timing constants
const SHIFT_START_HOUR = 9;  // 9 AM
const SHIFT_END_HOUR = 22;   // 10 PM
const MINIMUM_WORK_HOURS = 8;

interface SystemConfig {
  shift_start_time: string;
  grace_period_minutes: number;
  auto_clockout_time: string;
  min_work_hours: number;
  half_day_threshold: number;
}

/**
 * Clock in - allows multiple sessions per day for breaks
 */
export async function clockIn(userId: number) {
  const db = getDb();
  const today = format(new Date(), 'yyyy-MM-dd');
  const now = new Date();
  
  // Check if shift timing allows clock-in (9 AM - 10 PM)
  const currentHour = now.getHours();
  if (currentHour < SHIFT_START_HOUR || currentHour >= SHIFT_END_HOUR) {
    return { 
      error: `Clock-in is only allowed between ${SHIFT_START_HOUR}:00 and ${SHIFT_END_HOUR}:00` 
    };
  }
  
  // Check if user has any active (not clocked out) session
  const activeSession = db.prepare(`
    SELECT id FROM attendance 
    WHERE user_id = ? AND date = ? AND clock_out IS NULL
  `).get(userId, today) as { id: number } | undefined;
  
  if (activeSession) {
    return { error: 'You have an active session. Please clock out first.' };
  }
  
  // Get system config for grace period (only applies to first clock-in of the day)
  const config = db.prepare('SELECT shift_start_time, grace_period_minutes FROM system_config WHERE id = 1')
    .get() as SystemConfig;
  
  // Check if this is the first clock-in of the day
  const todaySessions = db.prepare(`
    SELECT COUNT(*) as count FROM attendance 
    WHERE user_id = ? AND date = ?
  `).get(userId, today) as { count: number };
  
  const isFirstClockIn = todaySessions.count === 0;
  
  // Determine status - only check grace period for first clock-in
  let status: string = 'present';
  let graceUsed = false;
  
  if (isFirstClockIn) {
    const [shiftHours, shiftMinutes] = config.shift_start_time.split(':').map(Number);
    const shiftStart = setMinutes(setHours(new Date(), shiftHours), shiftMinutes);
    const graceEnd = addMinutes(shiftStart, config.grace_period_minutes);
    
    if (isAfter(now, graceEnd)) {
      status = 'late';
      graceUsed = true;
    }
  }
  
  // Create new attendance session
  const result = db.prepare(`
    INSERT INTO attendance (user_id, date, clock_in, status, grace_period_used, is_final_session)
    VALUES (?, ?, ?, ?, ?, 0)
  `).run(userId, today, now.toISOString(), status, graceUsed ? 1 : 0);
  
  revalidatePath('/');
  revalidatePath('/attendance');
  
  return { 
    success: true, 
    status,
    sessionId: result.lastInsertRowid,
    isFirstClockIn
  };
}

/**
 * Clock out - can be for a break or final checkout
 */
export async function clockOut(userId: number, isFinalCheckout: boolean = false) {
  const db = getDb();
  const today = format(new Date(), 'yyyy-MM-dd');
  const now = new Date();
  
  // Get the active session
  const activeSession = db.prepare(`
    SELECT * FROM attendance 
    WHERE user_id = ? AND date = ? AND clock_out IS NULL
  `).get(userId, today) as { 
    id: number; 
    clock_in: string; 
    status: string;
    is_final_session: number;
  } | undefined;
  
  if (!activeSession) {
    return { error: 'No active clock-in session found' };
  }
  
  // Calculate session hours
  const clockIn = parseISO(activeSession.clock_in);
  const sessionHours = (now.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
  
  // Update the session
  db.prepare(`
    UPDATE attendance 
    SET clock_out = ?, is_final_session = ?
    WHERE id = ?
  `).run(now.toISOString(), isFinalCheckout ? 1 : 0, activeSession.id);
  
  // If final checkout, calculate total hours and check minimum
  if (isFinalCheckout) {
    const totalHoursResult = db.prepare(`
      SELECT COALESCE(SUM(total_hours), 0) as total 
      FROM attendance 
      WHERE user_id = ? AND date = ? AND clock_out IS NOT NULL
    `).get(userId, today) as { total: number };
    
    const totalHours = totalHoursResult.total;
    
    // Check if minimum hours met
    if (totalHours < MINIMUM_WORK_HOURS) {
      // Send email notification
      try {
        const user = db.prepare('SELECT name, email FROM users WHERE id = ?').get(userId) as { name: string; email: string } | undefined;
        
        if (user?.email) {
          const hoursShort = (MINIMUM_WORK_HOURS - totalHours).toFixed(1);
          const emailSent = await sendEmail({
            to: user.email,
            subject: 'Attendance Warning: Minimum Hours Not Met',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #dc3545;">Attendance Warning</h2>
                <p>Hi ${user.name},</p>
                <p>You have clocked out for the day but did not meet the minimum required hours.</p>
                
                <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                  <p><strong>Date:</strong> ${today}</p>
                  <p><strong>Total Hours Worked:</strong> ${totalHours.toFixed(1)} hours</p>
                  <p><strong>Minimum Required:</strong> ${MINIMUM_WORK_HOURS} hours</p>
                  <p><strong>Hours Short:</strong> ${hoursShort} hours</p>
                </div>
                
                <p style="color: #dc3545; font-weight: bold;">
                  This may result in leave deduction if not corrected. 
                  Please contact your manager if you believe this is an error.
                </p>
                
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                <p style="color: #999; font-size: 12px;">
                  This is an automated notification from ForceFriction AI HR Portal.
                </p>
              </div>
            `,
          });
          
          await logEmail(
            userId,
            'attendance_warning',
            'Attendance Warning: Minimum Hours Not Met',
            emailSent ? 'sent' : 'failed'
          );
        }
      } catch (emailError) {
        console.error('Failed to send attendance warning email:', emailError);
      }
    }
    
    revalidatePath('/');
    revalidatePath('/attendance');
    
    return { 
      success: true, 
      sessionHours: Math.round(sessionHours * 100) / 100,
      totalHours: Math.round(totalHours * 100) / 100,
      minimumMet: totalHours >= MINIMUM_WORK_HOURS,
      isFinalCheckout: true
    };
  }
  
  // Break clock-out
  revalidatePath('/');
  revalidatePath('/attendance');
  
  return { 
    success: true, 
    sessionHours: Math.round(sessionHours * 100) / 100,
    message: 'You are now on break. Remember to clock back in!',
    isFinalCheckout: false
  };
}

/**
 * Get today's attendance sessions
 */
export async function getTodayAttendance(userId: number) {
  const db = getDb();
  const today = format(new Date(), 'yyyy-MM-dd');
  
  // Get all sessions for today
  const sessions = db.prepare(`
    SELECT * FROM attendance 
    WHERE user_id = ? AND date = ?
    ORDER BY clock_in ASC
  `).all(userId, today) as {
    id: number;
    clock_in: string | null;
    clock_out: string | null;
    total_hours: number | null;
    status: string;
    is_final_session: number;
  }[];
  
  // Calculate total hours
  const totalHoursResult = db.prepare(`
    SELECT COALESCE(SUM(total_hours), 0) as total 
    FROM attendance 
    WHERE user_id = ? AND date = ? AND clock_out IS NOT NULL
  `).get(userId, today) as { total: number };
  
  // Check if there's an active session
  const hasActiveSession = sessions.some(s => s.clock_in && !s.clock_out);
  
  return {
    sessions,
    totalHours: totalHoursResult.total,
    hasActiveSession,
    minimumMet: totalHoursResult.total >= MINIMUM_WORK_HOURS,
    minimumRequired: MINIMUM_WORK_HOURS
  };
}

/**
 * Get attendance history
 */
export async function getAttendanceHistory(userId: number, startDate?: string, endDate?: string) {
  const db = getDb();
  
  let query = 'SELECT * FROM attendance WHERE user_id = ?';
  const params: (number | string)[] = [userId];
  
  if (startDate) {
    query += ' AND date >= ?';
    params.push(startDate);
  }
  
  if (endDate) {
    query += ' AND date <= ?';
    params.push(endDate);
  }
  
  query += ' ORDER BY date DESC, clock_in ASC';
  
  return db.prepare(query).all(...params) as {
    id: number;
    date: string;
    clock_in: string | null;
    clock_out: string | null;
    total_hours: number | null;
    status: string;
    is_final_session: number;
  }[];
}

/**
 * Check if user can clock in (within shift hours and no active session)
 */
export async function canClockIn(userId: number) {
  const db = getDb();
  const today = format(new Date(), 'yyyy-MM-dd');
  const now = new Date();
  
  // Check shift timing
  const currentHour = now.getHours();
  if (currentHour < SHIFT_START_HOUR || currentHour >= SHIFT_END_HOUR) {
    return {
      canClockIn: false,
      reason: `Shift hours are ${SHIFT_START_HOUR}:00 - ${SHIFT_END_HOUR}:00`,
      isWithinShiftHours: false
    };
  }
  
  // Check for active session
  const activeSession = db.prepare(`
    SELECT id FROM attendance 
    WHERE user_id = ? AND date = ? AND clock_out IS NULL
  `).get(userId, today) as { id: number } | undefined;
  
  if (activeSession) {
    return {
      canClockIn: false,
      reason: 'You have an active session',
      hasActiveSession: true,
      isWithinShiftHours: true
    };
  }
  
  return {
    canClockIn: true,
    isWithinShiftHours: true,
    hasActiveSession: false
  };
}

/**
 * Get current active session
 */
export async function getActiveSession(userId: number) {
  const db = getDb();
  const today = format(new Date(), 'yyyy-MM-dd');
  
  const session = db.prepare(`
    SELECT * FROM attendance 
    WHERE user_id = ? AND date = ? AND clock_out IS NULL
  `).get(userId, today) as {
    id: number;
    clock_in: string;
    status: string;
  } | undefined;
  
  return session || null;
}
