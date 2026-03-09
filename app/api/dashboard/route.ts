import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { format } from 'date-fns';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = parseInt(session.user.id);
    const db = getDb();
    const currentYear = new Date().getFullYear();
    const today = format(new Date(), 'yyyy-MM-dd');
    
    // Get user info
    const user = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(userId) as {
      id: number;
      name: string;
      role: string;
    };
    
    // Get leave balance
    let leaveBalance = db.prepare('SELECT * FROM leave_balances WHERE user_id = ? AND year = ?')
      .get(userId, currentYear) as {
        total_leaves: number;
        used_leaves: number;
        remaining_leaves: number;
        lop_days: number;
      };
    
    if (!leaveBalance) {
      // Create default balance
      db.prepare('INSERT INTO leave_balances (user_id, year, total_leaves, used_leaves, lop_days) VALUES (?, ?, 20, 0, 0)')
        .run(userId, currentYear);
      leaveBalance = { total_leaves: 20, used_leaves: 0, remaining_leaves: 20, lop_days: 0 };
    }
    
    // Get today's attendance
    const todayAttendance = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?')
      .get(userId, today) as {
        id: number;
        clock_in: string | null;
        clock_out: string | null;
        total_hours: number | null;
        status: string;
      } | undefined;
    
    // Get recent tasks
    const recentTasks = db.prepare(`
      SELECT * FROM task_logs 
      WHERE user_id = ? AND date = ?
      ORDER BY created_at DESC
      LIMIT 5
    `).all(userId, today) as {
      id: number;
      project_name: string;
      task_description: string;
      hours_spent: number;
    }[];
    
    // Get pending leaves
    const pendingLeaves = db.prepare(`
      SELECT * FROM leave_applications 
      WHERE user_id = ? AND status = 'pending'
      ORDER BY created_at DESC
    `).all(userId) as {
      id: number;
      start_date: string;
      end_date: string;
      days_requested: number;
    }[];
    
    // Get unread notifications
    const notifications = db.prepare(`
      SELECT * FROM notifications 
      WHERE user_id = ? AND is_read = 0
      ORDER BY created_at DESC
      LIMIT 5
    `).all(userId) as {
      id: number;
      title: string;
      message: string;
    }[];
    
    return NextResponse.json({
      user: {
        id: String(user.id),
        name: user.name,
        role: user.role,
      },
      leaveBalance,
      todayAttendance: todayAttendance || null,
      recentTasks,
      pendingLeaves,
      notifications,
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
