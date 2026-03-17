import { getServerSession } from 'next-auth/next';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

// GET /api/admin/task-types - List all task types
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const db = getDb();
    const taskTypes = db.prepare('SELECT * FROM task_types ORDER BY name').all();
    
    return NextResponse.json(taskTypes);
  } catch (error) {
    console.error('Task types API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/task-types - Create new task type
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { name, description, auto_approve } = body;
    
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    
    const db = getDb();
    
    try {
      const result = db.prepare(`
        INSERT INTO task_types (name, description, auto_approve)
        VALUES (?, ?, ?)
      `).run(name, description || null, auto_approve ? 1 : 0);
      
      return NextResponse.json({
        success: true,
        typeId: result.lastInsertRowid,
      });
    } catch (err: any) {
      if (err.message?.includes('UNIQUE constraint failed')) {
        return NextResponse.json({ error: 'Task type with this name already exists' }, { status: 400 });
      }
      throw err;
    }
  } catch (error) {
    console.error('Create task type error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/task-types - Update task type
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { id, name, description, auto_approve, is_active } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }
    
    const db = getDb();
    
    db.prepare(`
      UPDATE task_types 
      SET name = ?, description = ?, auto_approve = ?, is_active = ?
      WHERE id = ?
    `).run(name, description || null, auto_approve ? 1 : 0, is_active ? 1 : 0, id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update task type error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/task-types/:id - Delete task type
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }
    
    const db = getDb();
    
    db.prepare('DELETE FROM task_types WHERE id = ?').run(parseInt(id));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete task type error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
