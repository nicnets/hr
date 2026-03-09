import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const db = getDb();
    
    const applications = db.prepare(`
      SELECT la.*, u.name as user_name 
      FROM leave_applications la
      JOIN users u ON la.user_id = u.id
      ORDER BY 
        CASE la.status WHEN 'pending' THEN 0 ELSE 1 END,
        la.created_at DESC
    `).all();
    
    return NextResponse.json(applications);
  } catch (error) {
    console.error('Admin leave applications API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
