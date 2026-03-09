import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

// Ensure uploads directory exists
function ensureUploadsDir() {
  const uploadsDir = join(process.cwd(), 'public', 'uploads');
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
  }
  return uploadsDir;
}

// GET /api/admin/logo - Get current logo
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const db = getDb();
    
    // Ensure logo_url column exists
    try {
      db.exec(`ALTER TABLE system_config ADD COLUMN logo_url TEXT`);
    } catch {
      // Column already exists
    }
    
    const config = db.prepare('SELECT logo_url FROM system_config WHERE id = 1').get() as { logo_url: string | null } | undefined;
    
    return NextResponse.json({ 
      logoUrl: config?.logo_url || null 
    });
  } catch (error) {
    console.error('Get logo error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/logo - Upload new logo
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const formData = await request.formData();
    const file = formData.get('logo') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Allowed: JPEG, PNG, SVG, WebP' 
      }, { status: 400 });
    }
    
    // Validate file size (max 2MB)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: 'File too large. Maximum size: 2MB' 
      }, { status: 400 });
    }
    
    // Generate unique filename
    const timestamp = Date.now();
    const extension = file.name.split('.').pop();
    const filename = `logo-${timestamp}.${extension}`;
    
    // Ensure uploads directory exists
    const uploadsDir = ensureUploadsDir();
    const filepath = join(uploadsDir, filename);
    
    // Write file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);
    
    // Save to database
    const logoUrl = `/uploads/${filename}`;
    const db = getDb();
    
    // Ensure logo_url column exists
    try {
      db.exec(`ALTER TABLE system_config ADD COLUMN logo_url TEXT`);
    } catch {
      // Column already exists
    }
    
    db.prepare(`
      UPDATE system_config 
      SET logo_url = ?
      WHERE id = 1
    `).run(logoUrl);
    
    // Log to audit logs
    const adminId = parseInt(session.user.id);
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
      VALUES (?, 'update', 'system_config', 1, ?)
    `).run(adminId, JSON.stringify({ logo_url: logoUrl }));
    
    return NextResponse.json({
      success: true,
      logoUrl,
      message: 'Logo uploaded successfully',
    });
  } catch (error: any) {
    console.error('Upload logo error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/logo - Remove logo
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const db = getDb();
    
    // Ensure logo_url column exists
    try {
      db.exec(`ALTER TABLE system_config ADD COLUMN logo_url TEXT`);
    } catch {
      // Column already exists
    }
    
    db.prepare(`
      UPDATE system_config 
      SET logo_url = NULL
      WHERE id = 1
    `).run();
    
    // Log to audit logs
    const adminId = parseInt(session.user.id);
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
      VALUES (?, 'update', 'system_config', 1, ?)
    `).run(adminId, JSON.stringify({ logo_url: null }));
    
    return NextResponse.json({
      success: true,
      message: 'Logo removed successfully',
    });
  } catch (error: any) {
    console.error('Delete logo error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
