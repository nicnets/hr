import { getServerSession } from 'next-auth/next';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Employee ID required' }, { status: 400 });
    }
    
    const db = getDb();
    const currentYear = new Date().getFullYear();
    
    const employee = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.department, u.joining_date, u.is_active,
             lb.total_leaves, lb.used_leaves, lb.remaining_leaves, lb.lop_days
      FROM users u
      LEFT JOIN leave_balances lb ON u.id = lb.user_id AND lb.year = ?
      WHERE u.id = ?
    `).get(currentYear, id);
    
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }
    
    return NextResponse.json(employee);
  } catch (error) {
    console.error('Employee detail error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
