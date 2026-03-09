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
    
    const { applicationId, reason } = await request.json();
    
    if (!applicationId) {
      return NextResponse.json({ error: 'Application ID required' }, { status: 400 });
    }
    
    if (!reason?.trim()) {
      return NextResponse.json({ error: 'Rejection reason required' }, { status: 400 });
    }
    
    const adminId = parseInt(session.user.id);
    const db = getDb();
    
    // Get application details
    const application = db.prepare('SELECT * FROM leave_applications WHERE id = ?')
      .get(applicationId) as {
        user_id: number;
        status: string;
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
      SET status = 'rejected', approved_by = ?, approved_at = CURRENT_TIMESTAMP, rejection_reason = ?
      WHERE id = ?
    `).run(adminId, reason, applicationId);
    
    // Notify employee
    db.prepare(`
      INSERT INTO notifications (user_id, type, title, message)
      VALUES (?, 'leave', 'Leave Rejected', ?)
    `).run(application.user_id, `Your leave application was rejected. Reason: ${reason}`);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Leave rejection error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
