'use server';

import { getDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { format, addMinutes, parseISO, isAfter, setHours, setMinutes } from 'date-fns';

export async function clockIn(userId: number) {
  const db = getDb();
  const today = format(new Date(), 'yyyy-MM-dd');
  const now = new Date();
  
  // Check if already clocked in
  const existing = db.prepare('SELECT id, clock_in FROM attendance WHERE user_id = ? AND date = ?')
    .get(userId, today) as { id: number; clock_in: string } | undefined;
  
  if (existing?.clock_in) {
    return { error: 'Already clocked in today' };
  }
  
  // Get system config for grace period
  const config = db.prepare('SELECT shift_start_time, grace_period_minutes FROM system_config WHERE id = 1')
    .get() as { shift_start_time: string; grace_period_minutes: number };
  
  // Parse shift start time (format: "HH:MM")
  const [shiftHours, shiftMinutes] = config.shift_start_time.split(':').map(Number);
  
  // Create shift start datetime for today
  const shiftStart = setMinutes(setHours(new Date(), shiftHours), shiftMinutes);
  const graceEnd = addMinutes(shiftStart, config.grace_period_minutes);
  
  // Determine status based on current time vs grace period
  let status: string = 'present';
  let graceUsed = false;
  
  // If current time is after grace period end, mark as late
  if (isAfter(now, graceEnd)) {
    status = 'late';
    graceUsed = true;
  }
  
  if (existing) {
    // Update existing record (was created by auto-processing or similar)
    db.prepare(`
      UPDATE attendance 
      SET clock_in = ?, status = ?, grace_period_used = ?
      WHERE id = ?
    `).run(now.toISOString(), status, graceUsed ? 1 : 0, existing.id);
  } else {
    // Create new record
    db.prepare(`
      INSERT INTO attendance (user_id, date, clock_in, status, grace_period_used)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, today, now.toISOString(), status, graceUsed ? 1 : 0);
  }
  
  revalidatePath('/');
  revalidatePath('/attendance');
  
  return { success: true, status };
}

export async function clockOut(userId: number) {
  const db = getDb();
  const today = format(new Date(), 'yyyy-MM-dd');
  const now = new Date();
  
  // Get today's attendance
  const attendance = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?')
    .get(userId, today) as { id: number; clock_in: string; clock_out: string | null } | undefined;
  
  if (!attendance) {
    return { error: 'No clock in record found for today' };
  }
  
  if (attendance.clock_out) {
    return { error: 'Already clocked out today' };
  }
  
  // Get system config
  const config = db.prepare('SELECT min_work_hours, half_day_threshold FROM system_config WHERE id = 1')
    .get() as { min_work_hours: number; half_day_threshold: number };
  
  // Calculate hours worked
  const clockIn = parseISO(attendance.clock_in);
  const hoursWorked = (now.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
  
  // Determine final status
  let status = attendance.clock_in ? 'present' : 'pending';
  
  if (hoursWorked < config.half_day_threshold) {
    status = 'unaccounted';
  } else if (hoursWorked < config.min_work_hours) {
    status = 'half_day';
  }
  
  // Update attendance
  db.prepare(`
    UPDATE attendance 
    SET clock_out = ?, status = ?, is_auto_clockout = 0
    WHERE id = ?
  `).run(now.toISOString(), status, attendance.id);
  
  revalidatePath('/');
  revalidatePath('/attendance');
  
  return { success: true, hoursWorked: Math.round(hoursWorked * 100) / 100 };
}

export async function getTodayAttendance(userId: number) {
  const db = getDb();
  const today = format(new Date(), 'yyyy-MM-dd');
  
  const attendance = db.prepare(`
    SELECT * FROM attendance 
    WHERE user_id = ? AND date = ?
  `).get(userId, today) as {
    id: number;
    clock_in: string | null;
    clock_out: string | null;
    total_hours: number | null;
    status: string;
  } | undefined;
  
  return attendance || null;
}

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
  
  query += ' ORDER BY date DESC';
  
  return db.prepare(query).all(...params) as {
    id: number;
    date: string;
    clock_in: string | null;
    clock_out: string | null;
    total_hours: number | null;
    status: string;
  }[];
}
