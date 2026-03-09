import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// GET /api/public/config - Get public config (logo, company name)
// This endpoint is public and doesn't require authentication
export async function GET() {
  try {
    const db = getDb();
    
    // Ensure logo_url column exists
    try {
      db.exec(`ALTER TABLE system_config ADD COLUMN logo_url TEXT`);
    } catch {
      // Column already exists
    }
    
    const config = db.prepare('SELECT company_name, logo_url FROM system_config WHERE id = 1').get() as { 
      company_name: string; 
      logo_url: string | null 
    } | undefined;
    
    return NextResponse.json({
      companyName: config?.company_name || 'ForceFriction AI',
      logoUrl: config?.logo_url || null,
    });
  } catch (error) {
    console.error('Public config error:', error);
    return NextResponse.json({
      companyName: 'ForceFriction AI',
      logoUrl: null,
    });
  }
}
