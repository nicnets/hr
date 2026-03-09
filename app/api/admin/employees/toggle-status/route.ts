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
    
    const { employeeId, isActive } = await request.json();
    
    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID required' }, { status: 400 });
    }
    
    const db = getDb();
    
    // Prevent deactivating yourself
    if (parseInt(session.user.id) === employeeId) {
      return NextResponse.json({ error: 'Cannot deactivate yourself' }, { status: 400 });
    }
    
    db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, employeeId);
    
    // Create audit log
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
      VALUES (?, ?, 'user', ?, ?)
    `).run(
      session.user.id,
      isActive ? 'activate' : 'deactivate',
      employeeId,
      JSON.stringify({ is_active: isActive })
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Toggle status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
