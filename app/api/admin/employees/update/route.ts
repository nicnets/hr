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
    
    const { employeeId, name, email, role, department, total_leaves } = await request.json();
    
    if (!employeeId || !name || !email || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    const db = getDb();
    
    // Get old values for audit log
    const oldEmployee = db.prepare('SELECT * FROM users WHERE id = ?').get(employeeId);
    if (!oldEmployee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }
    
    // Check if email is being changed and if new email already exists
    if (email !== (oldEmployee as { email: string }).email) {
      const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, employeeId);
      if (existing) {
        return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
      }
    }
    
    const currentYear = new Date().getFullYear();
    const adminId = parseInt(session.user.id);
    
    db.prepare(`
      UPDATE users
      SET name = ?, email = ?, role = ?, department = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, email, role, department || null, employeeId);
    
    // Update leave balance if total_leaves is provided
    if (total_leaves !== undefined && !isNaN(parseFloat(total_leaves))) {
      const existingBalance = db.prepare(`
        SELECT id FROM leave_balances WHERE user_id = ? AND year = ?
      `).get(employeeId, currentYear);
      
      if (existingBalance) {
        db.prepare(`
          UPDATE leave_balances 
          SET total_leaves = ? 
          WHERE user_id = ? AND year = ?
        `).run(parseFloat(total_leaves), employeeId, currentYear);
      } else {
        db.prepare(`
          INSERT INTO leave_balances (user_id, year, total_leaves, used_leaves, lop_days)
          VALUES (?, ?, ?, 0, 0)
        `).run(employeeId, currentYear, parseFloat(total_leaves));
      }
    }
    
    // Create audit log
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
      VALUES (?, 'update', 'user', ?, ?, ?)
    `).run(
      adminId,
      employeeId,
      JSON.stringify(oldEmployee),
      JSON.stringify({ name, email, role, department, total_leaves })
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update employee error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
