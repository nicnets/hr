import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { differenceInBusinessDays, parseISO } from 'date-fns';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = parseInt(session.user.id);
    const body = await request.json();
    
    const { start_date, end_date, leave_type, reason } = body;
    
    if (!start_date || !end_date || !leave_type || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Check if leave type allows retrospective applications
    const allowedRetroTypes = ['sick', 'emergency'];
    const isRetroactive = new Date(start_date) < new Date(new Date().toDateString());
    
    if (isRetroactive && !allowedRetroTypes.includes(leave_type)) {
      return NextResponse.json({ 
        error: `${leave_type} leave cannot be applied retrospectively. Only sick and emergency leave can be applied for past dates.` 
      }, { status: 400 });
    }
    
    // Check if retrospective application is within allowed window (30 days)
    if (isRetroactive) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startDate = parseISO(start_date);
      
      if (startDate < thirtyDaysAgo) {
        return NextResponse.json({ 
          error: 'Retrospective leave can only be applied up to 30 days in the past' 
        }, { status: 400 });
      }
    }
    
    // Calculate business days
    const daysRequested = differenceInBusinessDays(parseISO(end_date), parseISO(start_date)) + 1;
    
    if (daysRequested <= 0) {
      return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
    }
    
    const db = getDb();
    const currentYear = new Date().getFullYear();
    
    // Check current balance
    const balance = db.prepare('SELECT remaining_leaves FROM leave_balances WHERE user_id = ? AND year = ?')
      .get(userId, currentYear) as { remaining_leaves: number } | undefined;
    
    const remainingLeaves = balance?.remaining_leaves || 0;
    const isLop = remainingLeaves < daysRequested;
    
    // Create leave application
    const result = db.prepare(`
      INSERT INTO leave_applications 
      (user_id, start_date, end_date, leave_type, reason, days_requested, status, is_lop)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(userId, start_date, end_date, leave_type, reason, daysRequested, isLop ? 1 : 0);
    
    // Create notification for admins
    const admins = db.prepare('SELECT id FROM users WHERE role = ? AND is_active = 1')
      .all('admin') as { id: number }[];
    
    for (const admin of admins) {
      db.prepare(`
        INSERT INTO notifications (user_id, type, title, message, link)
        VALUES (?, 'leave', 'New Leave Request', ?, ?)
      `).run(
        admin.id,
        `${session.user.name} has requested ${daysRequested} day${daysRequested > 1 ? 's' : ''} of ${leave_type} leave`,
        '/admin/leave-applications'
      );
    }
    
    return NextResponse.json({
      success: true,
      applicationId: result.lastInsertRowid,
      isLop,
      message: isLop 
        ? 'Leave applied. This will be marked as Loss of Pay due to insufficient balance.' 
        : 'Leave application submitted successfully',
    });
  } catch (error) {
    console.error('Leave apply API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
