import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = parseInt(session.user.id);
    const db = getDb();
    
    const applications = db.prepare(`
      SELECT * FROM leave_applications 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `).all(userId);
    
    return NextResponse.json(applications);
  } catch (error) {
    console.error('Leave applications API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
