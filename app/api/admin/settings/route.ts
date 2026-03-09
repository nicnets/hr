import { getServerSession } from 'next-auth/next';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

// GET /api/admin/settings - Get system config
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const db = getDb();
    
    const config = db.prepare('SELECT * FROM system_config WHERE id = 1').get();
    
    if (!config) {
      // Return default config
      return NextResponse.json({
        shift_start_time: '09:00',
        grace_period_minutes: 15,
        auto_clockout_time: '18:00',
        min_work_hours: 8,
        half_day_threshold: 4,
        working_days: '1,2,3,4,5',
        company_name: 'ForceFriction AI',
      });
    }
    
    return NextResponse.json(config);
  } catch (error) {
    console.error('Settings API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/settings - Update system config
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const {
      shift_start_time,
      grace_period_minutes,
      auto_clockout_time,
      min_work_hours,
      half_day_threshold,
      company_name,
    } = body;
    
    const db = getDb();
    
    // Get old config for audit log
    const oldConfig = db.prepare('SELECT * FROM system_config WHERE id = 1').get();
    
    db.prepare(`
      UPDATE system_config
      SET shift_start_time = ?,
          grace_period_minutes = ?,
          auto_clockout_time = ?,
          min_work_hours = ?,
          half_day_threshold = ?,
          company_name = ?
      WHERE id = 1
    `).run(
      shift_start_time,
      grace_period_minutes,
      auto_clockout_time,
      min_work_hours,
      half_day_threshold,
      company_name
    );
    
    // Create audit log
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
      VALUES (?, 'update', 'system_config', 1, ?, ?)
    `).run(
      session.user.id,
      JSON.stringify(oldConfig),
      JSON.stringify(body)
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
