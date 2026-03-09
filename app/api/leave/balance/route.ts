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
    const currentYear = new Date().getFullYear();
    
    // Get or create leave balance
    let balance = db.prepare('SELECT * FROM leave_balances WHERE user_id = ? AND year = ?')
      .get(userId, currentYear) as {
        total_leaves: number;
        used_leaves: number;
        remaining_leaves: number;
        lop_days: number;
      };
    
    if (!balance) {
      // Create default balance
      db.prepare(`
        INSERT INTO leave_balances (user_id, year, total_leaves, used_leaves, lop_days)
        VALUES (?, ?, 20, 0, 0)
      `).run(userId, currentYear);
      
      balance = {
        total_leaves: 20,
        used_leaves: 0,
        remaining_leaves: 20,
        lop_days: 0,
      };
    }
    
    return NextResponse.json(balance);
  } catch (error) {
    console.error('Leave balance API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
