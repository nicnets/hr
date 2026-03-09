import { getServerSession } from 'next-auth/next';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { applicationId } = await request.json();
    
    if (!applicationId) {
      return NextResponse.json({ error: 'Application ID required' }, { status: 400 });
    }
    
    const adminId = parseInt(session.user.id);
    const db = getDb();
    const currentYear = new Date().getFullYear();
    
    // Get application details
    const application = db.prepare('SELECT * FROM leave_applications WHERE id = ?')
      .get(applicationId) as {
        user_id: number;
        days_requested: number;
        status: string;
        is_lop: boolean;
        start_date: string;
        end_date: string;
      } | undefined;
    
    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }
    
    if (application.status !== 'pending') {
      return NextResponse.json({ error: 'Application already processed' }, { status: 400 });
    }
    
    // Update application status
    db.prepare(`
      UPDATE leave_applications 
      SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(adminId, applicationId);
    
    // Deduct leave or add LOP
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
    
    // Create attendance records for leave period - mark as 'on_leave'
    const { start_date, end_date } = application;
    const start = new Date(start_date);
    const end = new Date(end_date);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      // Skip weekends (0 = Sunday, 6 = Saturday)
      const dayOfWeek = d.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // Check if attendance record exists
        const existing = db.prepare('SELECT id FROM attendance WHERE user_id = ? AND date = ?')
          .get(application.user_id, dateStr);
        
        if (existing) {
          db.prepare('UPDATE attendance SET status = ? WHERE id = ?')
            .run('on_leave', (existing as { id: number }).id);
        } else {
          db.prepare('INSERT INTO attendance (user_id, date, status) VALUES (?, ?, ?)')
            .run(application.user_id, dateStr, 'on_leave');
        }
      }
    }
    
    // Notify employee
    db.prepare(`
      INSERT INTO notifications (user_id, type, title, message)
      VALUES (?, 'leave', 'Leave Approved', 'Your leave application has been approved.')
    `).run(application.user_id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Leave approval error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
