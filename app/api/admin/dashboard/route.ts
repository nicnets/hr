import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { format, startOfWeek, endOfWeek, subDays } from 'date-fns';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const db = getDb();
    const today = format(new Date(), 'yyyy-MM-dd');
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    
    // Total employees
    const totalEmployees = db.prepare(`
      SELECT COUNT(*) as count FROM users WHERE role = 'employee' AND is_active = 1
    `).get() as { count: number };
    
    // Currently clocked in (have clock_in but no clock_out today)
    const currentlyClockedIn = db.prepare(`
      SELECT COUNT(*) as count FROM attendance 
      WHERE date = ? AND clock_in IS NOT NULL AND clock_out IS NULL
    `).get(today) as { count: number };
    
    // Pending leave requests
    const pendingLeaveRequests = db.prepare(`
      SELECT COUNT(*) as count FROM leave_applications WHERE status = 'pending'
    `).get() as { count: number };
    
    // Pending attendance exceptions
    const pendingExceptions = db.prepare(`
      SELECT COUNT(*) as count FROM attendance_exceptions WHERE status = 'pending'
    `).get() as { count: number };
    
    // Pending task reviews
    const pendingTaskReviews = db.prepare(`
      SELECT COUNT(*) as count FROM assigned_tasks WHERE status = 'pending_review'
    `).get() as { count: number };
    
    // Today's attendance breakdown
    const todayAttendance = db.prepare(`
      SELECT 
        SUM(CASE WHEN status IN ('present', 'late') THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late,
        SUM(CASE WHEN status = 'on_leave' THEN 1 ELSE 0 END) as on_leave,
        SUM(CASE WHEN status IN ('unaccounted', 'lop') THEN 1 ELSE 0 END) as absent
      FROM attendance 
      WHERE date = ?
    `).get(today) as { present: number; late: number; on_leave: number; absent: number };
    
    // Weekly attendance trend
    const weeklyAttendance = db.prepare(`
      SELECT 
        date,
        SUM(CASE WHEN status IN ('present', 'late') THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late,
        SUM(CASE WHEN status = 'on_leave' THEN 1 ELSE 0 END) as on_leave,
        SUM(CASE WHEN status IN ('unaccounted', 'lop') THEN 1 ELSE 0 END) as absent
      FROM attendance 
      WHERE date >= ? AND date <= ?
      GROUP BY date
      ORDER BY date
    `).all(weekStart, weekEnd) as { date: string; present: number; late: number; on_leave: number; absent: number }[];
    
    // Recent leave applications
    const recentLeaves = db.prepare(`
      SELECT 
        la.*,
        u.name as user_name
      FROM leave_applications la
      JOIN users u ON la.user_id = u.id
      ORDER BY la.created_at DESC
      LIMIT 5
    `).all() as {
      id: number;
      user_name: string;
      start_date: string;
      end_date: string;
      leave_type: string;
      days_requested: number;
      status: string;
      created_at: string;
    }[];
    
    // Recent attendance exceptions
    const recentExceptions = db.prepare(`
      SELECT 
        ae.*,
        u.name as user_name
      FROM attendance_exceptions ae
      JOIN users u ON ae.user_id = u.id
      ORDER BY ae.created_at DESC
      LIMIT 5
    `).all() as {
      id: number;
      user_name: string;
      date: string;
      exception_type: string;
      status: string;
      created_at: string;
    }[];
    
    // Recent audit logs
    const recentActivity = db.prepare(`
      SELECT 
        al.*,
        u.name as user_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT 10
    `).all() as {
      id: number;
      user_name: string | null;
      action: string;
      entity_type: string;
      created_at: string;
    }[];
    
    // Who's on leave today
    const onLeaveToday = db.prepare(`
      SELECT 
        u.name,
        la.start_date,
        la.end_date,
        la.leave_type
      FROM leave_applications la
      JOIN users u ON la.user_id = u.id
      WHERE la.status = 'approved'
        AND la.start_date <= ?
        AND la.end_date >= ?
      ORDER BY u.name
    `).all(today, today) as {
      name: string;
      start_date: string;
      end_date: string;
      leave_type: string;
    }[];
    
    // Recent clock-ins (last 5)
    const recentClockIns = db.prepare(`
      SELECT 
        u.name,
        a.clock_in,
        a.status
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      WHERE a.date = ? AND a.clock_in IS NOT NULL
      ORDER BY a.clock_in DESC
      LIMIT 5
    `).all(today) as {
      name: string;
      clock_in: string;
      status: string;
    }[];
    
    return NextResponse.json({
      stats: {
        totalEmployees: totalEmployees.count,
        currentlyClockedIn: currentlyClockedIn.count,
        pendingLeaveRequests: pendingLeaveRequests.count,
        pendingExceptions: pendingExceptions.count,
        pendingTaskReviews: pendingTaskReviews.count,
        todayAttendance: {
          present: todayAttendance?.present || 0,
          late: todayAttendance?.late || 0,
          onLeave: todayAttendance?.on_leave || 0,
          absent: todayAttendance?.absent || 0,
        },
      },
      weeklyAttendance: weeklyAttendance.map(day => ({
        date: day.date,
        present: day.present || 0,
        late: day.late || 0,
        onLeave: day.on_leave || 0,
        absent: day.absent || 0,
      })),
      pendingApprovals: {
        leaves: recentLeaves.filter(l => l.status === 'pending').map(l => ({
          id: l.id,
          user_name: l.user_name,
          start_date: l.start_date,
          end_date: l.end_date,
          leave_type: l.leave_type,
          days_requested: l.days_requested,
          status: l.status,
          created_at: l.created_at,
        })),
        exceptions: recentExceptions.filter(e => e.status === 'pending').map(e => ({
          id: e.id,
          user_name: e.user_name,
          date: e.date,
          exception_type: e.exception_type,
          status: e.status,
          created_at: e.created_at,
        })),
      },
      recentActivity: recentActivity.map(a => ({
        id: a.id,
        user_name: a.user_name,
        action: a.action,
        entity_type: a.entity_type,
        created_at: a.created_at,
      })),
      onLeaveToday,
      recentClockIns,
    });
  } catch (error) {
    console.error('Admin dashboard API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
