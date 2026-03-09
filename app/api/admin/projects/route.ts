import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

// Ensure projects table exists
function ensureProjectsTable(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT 1,
      is_internal BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// GET /api/admin/projects - Get all projects
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const db = getDb();
    ensureProjectsTable(db);
    const projects = db.prepare(`
      SELECT * FROM projects 
      ORDER BY is_active DESC, is_internal DESC, name ASC
    `).all();
    
    return NextResponse.json(projects);
  } catch (error) {
    console.error('Get projects error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/projects - Create a new project
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const body = await request.json();
    const { name, description, is_internal } = body;
    
    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }
    
    const db = getDb();
    ensureProjectsTable(db);
    
    // Check if project with same name already exists
    const existing = db.prepare('SELECT id FROM projects WHERE name = ?').get(name.trim());
    if (existing) {
      return NextResponse.json({ error: 'A project with this name already exists' }, { status: 400 });
    }
    
    const result = db.prepare(`
      INSERT INTO projects (name, description, is_internal, is_active)
      VALUES (?, ?, ?, 1)
    `).run(name.trim(), description || null, is_internal ? 1 : 0);
    
    // Log to audit logs
    const adminId = parseInt(session.user.id);
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
      VALUES (?, 'create', 'project', ?, ?)
    `).run(
      adminId,
      result.lastInsertRowid,
      JSON.stringify({ name, description, is_internal })
    );
    
    return NextResponse.json({
      success: true,
      projectId: result.lastInsertRowid,
      message: 'Project created successfully',
    });
  } catch (error: any) {
    console.error('Create project error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
