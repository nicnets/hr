import { getServerSession } from 'next-auth/next';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { generateAttendancePDF, generateLeavePDF, generateProductivityPDF } from '@/lib/reports/pdf';
import { generateAttendanceCSV, generateLeaveCSV, generateProductivityCSV } from '@/lib/reports/csv';
import { format as formatDate } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const format = searchParams.get('format');
    const start = searchParams.get('start') || formatDate(new Date(), 'yyyy-MM-dd');
    const end = searchParams.get('end') || formatDate(new Date(), 'yyyy-MM-dd');
    
    if (!type || !format) {
      return NextResponse.json({ error: 'Type and format required' }, { status: 400 });
    }
    
    const db = getDb();
    const companyName = (db.prepare('SELECT company_name FROM system_config WHERE id = 1').get() as { company_name: string })?.company_name || 'ForceFriction AI';
    const reportFormat = format; // Store format in a different variable
    const period = `${start} to ${end}`;
    
    if (type === 'attendance') {
      const records = db.prepare(`
        SELECT a.*, u.name as employee_name
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        WHERE a.date >= ? AND a.date <= ?
        ORDER BY a.date DESC, u.name
      `).all(start, end);
      
      if (reportFormat === 'pdf') {
        const pdf = generateAttendancePDF(records as any, period, companyName);
        return new NextResponse(pdf as any, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="attendance-report-${start}-to-${end}.pdf"`,
          },
        });
      } else if (reportFormat === 'csv') {
        const csv = generateAttendanceCSV(records as any);
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="attendance-report-${start}-to-${end}.csv"`,
          },
        });
      }
    }
    
    if (type === 'leave') {
      const records = db.prepare(`
        SELECT la.*, u.name as employee_name
        FROM leave_applications la
        JOIN users u ON la.user_id = u.id
        WHERE (la.start_date <= ? AND la.end_date >= ?) OR
              (la.start_date >= ? AND la.start_date <= ?)
        ORDER BY la.created_at DESC
      `).all(end, start, start, end);
      
      if (reportFormat === 'pdf') {
        const pdf = generateLeavePDF(records as any, period, companyName);
        return new NextResponse(pdf as any, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="leave-report-${start}-to-${end}.pdf"`,
          },
        });
      } else if (reportFormat === 'csv') {
        const csv = generateLeaveCSV(records as any);
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="leave-report-${start}-to-${end}.csv"`,
          },
        });
      }
    }
    
    if (type === 'productivity') {
      const records = db.prepare(`
        SELECT t.*, u.name as employee_name
        FROM task_logs t
        JOIN users u ON t.user_id = u.id
        WHERE t.date >= ? AND t.date <= ?
        ORDER BY t.date DESC, u.name
      `).all(start, end);
      
      if (reportFormat === 'pdf') {
        const pdf = generateProductivityPDF(records as any, period, companyName);
        return new NextResponse(pdf as any, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="productivity-report-${start}-to-${end}.pdf"`,
          },
        });
      } else if (reportFormat === 'csv') {
        const csv = generateProductivityCSV(records as any);
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="productivity-report-${start}-to-${end}.csv"`,
          },
        });
      }
    }
    
    return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
  } catch (error) {
    console.error('Report generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
