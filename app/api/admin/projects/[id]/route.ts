import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

// PUT /api/admin/projects/[id] - Update a project
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const { id } = await params;
    const projectId = parseInt(id);
    
    if (isNaN(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }
    
    const body = await request.json();
    const { name, description, is_internal, is_active } = body;
    
    const db = getDb();
    
    // Check if project exists
    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    
    // Check for name conflict if name is being changed
    if (name && name.trim() !== (existing as any).name) {
      const nameExists = db.prepare('SELECT id FROM projects WHERE name = ? AND id != ?').get(name.trim(), projectId);
      if (nameExists) {
        return NextResponse.json({ error: 'A project with this name already exists' }, { status: 400 });
      }
    }
    
    // Build update query dynamically
    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description || null);
    }
    if (is_internal !== undefined) {
      updates.push('is_internal = ?');
      values.push(is_internal ? 1 : 0);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active ? 1 : 0);
    }
    updates.push('updated_at = CURRENT_TIMESTAMP');
    
    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }
    
    values.push(projectId);
    
    db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    
    // Log to audit logs
    const adminId = parseInt(session.user.id);
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
      VALUES (?, 'update', 'project', ?, ?, ?)
    `).run(
      adminId,
      projectId,
      JSON.stringify(existing),
      JSON.stringify({ name, description, is_internal, is_active })
    );
    
    return NextResponse.json({
      success: true,
      message: 'Project updated successfully',
    });
  } catch (error) {
    console.error('Update project error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/projects/[id] - Soft delete a project (mark as inactive)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const { id } = await params;
    const projectId = parseInt(id);
    
    if (isNaN(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }
    
    const db = getDb();
    
    // Check if project exists
    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    
    // Soft delete - mark as inactive
    db.prepare('UPDATE projects SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(projectId);
    
    // Log to audit logs
    const adminId = parseInt(session.user.id);
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values)
      VALUES (?, 'delete', 'project', ?, ?)
    `).run(
      adminId,
      projectId,
      JSON.stringify(existing)
    );
    
    return NextResponse.json({
      success: true,
      message: 'Project deactivated successfully',
    });
  } catch (error) {
    console.error('Delete project error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
