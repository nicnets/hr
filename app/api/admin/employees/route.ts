import { getServerSession } from 'next-auth/next';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';
import bcrypt from 'bcryptjs';

// GET /api/admin/employees - List all employees
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const db = getDb();
    const currentYear = new Date().getFullYear();
    
    const employees = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.department, u.joining_date, u.is_active,
             lb.total_leaves, lb.used_leaves, lb.remaining_leaves, lb.lop_days
      FROM users u
      LEFT JOIN leave_balances lb ON u.id = lb.user_id AND lb.year = ?
      ORDER BY u.name
    `).all(currentYear);
    
    return NextResponse.json(employees);
  } catch (error) {
    console.error('Employees API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/employees - Create new employee
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { name, email, role, department, joining_date, password, total_leaves } = body;
    
    if (!name || !email || !role || !joining_date || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Use provided total_leaves or default to 7
    const leaveBalance = total_leaves && !isNaN(parseFloat(total_leaves)) 
      ? parseFloat(total_leaves) 
      : 7;
    
    const db = getDb();
    const currentYear = new Date().getFullYear();
    
    // Check if email already exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create user
    const result = db.prepare(`
      INSERT INTO users (name, email, role, department, joining_date, password_hash, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(name, email, role, department || null, joining_date, passwordHash);
    
    const userId = result.lastInsertRowid;
    
    // Create leave balance with custom total
    db.prepare(`
      INSERT INTO leave_balances (user_id, year, total_leaves, used_leaves, lop_days)
      VALUES (?, ?, ?, 0, 0)
    `).run(userId, currentYear, leaveBalance);
    
    // Create audit log
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
      VALUES (?, 'create', 'user', ?, ?)
    `).run(session.user.id, userId, JSON.stringify({ name, email, role }));
    
    return NextResponse.json({
      success: true,
      userId,
    });
  } catch (error) {
    console.error('Create employee error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
