import { getServerSession } from 'next-auth/next';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { Parser } from 'json2csv';

// GET /api/admin/reports - Generate comprehensive reports
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') || 'tasks';
    const employeeId = searchParams.get('employee_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const format = searchParams.get('format') || 'json'; // json, csv
    
    const db = getDb();
    
    // Helper function to send CSV response
    const sendCSV = (data: any[], fields: any[], filename: string) => {
      const parser = new Parser({ fields });
      const csv = parser.parse(data);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    };
    
    if (reportType === 'tasks') {
      // Task report with all details
      let query = `
        SELECT 
          at.id,
          at.title,
          at.description,
          at.status,
          at.due_date,
          at.recurrence_type,
          at.created_at,
          at.submitted_at,
          at.reviewed_at,
          at.review_notes,
          u1.name as assigned_to_name,
          u1.email as assigned_to_email,
          u2.name as assigned_by_name,
          p.name as project_name,
          ts.work_summary,
          ts.task_objective,
          ts.final_outcome,
          ts.scope_change,
          ts.output_type,
          ts.output_description,
          ts.time_spent,
          ts.difficulty_level,
          ts.confidence_level,
          ts.submitted_at as submission_date,
          taa.score,
          taa.decision as ai_decision,
          taa.analysis_summary as ai_summary,
          taa.task_understanding,
          taa.work_authenticity,
          taa.output_validity,
          taa.effort_reasonableness,
          taa.difficulty_consistency,
          taa.risk_flags
        FROM assigned_tasks at
        JOIN users u1 ON at.assigned_to = u1.id
        JOIN users u2 ON at.assigned_by = u2.id
        LEFT JOIN projects p ON at.project_id = p.id
        LEFT JOIN task_submissions ts ON at.id = ts.task_id
        LEFT JOIN task_ai_analysis taa ON ts.id = taa.submission_id
        WHERE 1=1
      `;
      const params: (string | number)[] = [];
      
      if (employeeId) {
        query += ' AND at.assigned_to = ?';
        params.push(parseInt(employeeId));
      }
      if (startDate) {
        query += ' AND date(at.created_at) >= ?';
        params.push(startDate);
      }
      if (endDate) {
        query += ' AND date(at.created_at) <= ?';
        params.push(endDate);
      }
      
      query += ' ORDER BY at.created_at DESC';
      
      const tasks = db.prepare(query).all(...params);
      
      // Calculate summary stats
      const stats = db.prepare(`
        SELECT 
          COUNT(*) as total_tasks,
          SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as completed_tasks,
          SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_tasks,
          SUM(CASE WHEN status = 'pending_review' THEN 1 ELSE 0 END) as pending_review_tasks,
          AVG(taa.score) as avg_ai_score
        FROM assigned_tasks at
        LEFT JOIN task_submissions ts ON at.id = ts.task_id
        LEFT JOIN task_ai_analysis taa ON ts.id = taa.submission_id
        WHERE 1=1
        ${employeeId ? ' AND at.assigned_to = ?' : ''}
        ${startDate ? ' AND date(at.created_at) >= ?' : ''}
        ${endDate ? ' AND date(at.created_at) <= ?' : ''}
      `).get(...params) as {
        total_tasks: number;
        completed_tasks: number;
        rejected_tasks: number;
        pending_review_tasks: number;
        avg_ai_score: number | null;
      };
      
      if (format === 'csv') {
        const fields = [
          { label: 'Task ID', value: 'id' },
          { label: 'Title', value: 'title' },
          { label: 'Description', value: 'description' },
          { label: 'Status', value: 'status' },
          { label: 'Assigned To', value: 'assigned_to_name' },
          { label: 'Assigned By', value: 'assigned_by_name' },
          { label: 'Project', value: 'project_name' },
          { label: 'Recurrence Type', value: 'recurrence_type' },
          { label: 'Due Date', value: 'due_date' },
          { label: 'Created At', value: 'created_at' },
          { label: 'Submitted At', value: 'submitted_at' },
          { label: 'Reviewed At', value: 'reviewed_at' },
          { label: 'Work Summary', value: 'work_summary' },
          { label: 'Task Objective', value: 'task_objective' },
          { label: 'Final Outcome', value: 'final_outcome' },
          { label: 'Scope Change', value: 'scope_change' },
          { label: 'Output Type', value: 'output_type' },
          { label: 'Time Spent', value: 'time_spent' },
          { label: 'Difficulty Level', value: 'difficulty_level' },
          { label: 'Confidence Level', value: 'confidence_level' },
          { label: 'AI Score', value: 'score' },
          { label: 'AI Decision', value: 'ai_decision' },
        ];
        return sendCSV(tasks, fields, `tasks-report-${startDate || 'all'}-to-${endDate || 'all'}.csv`);
      }

      // Prepare chart data
      const statusCounts = db.prepare(`
        SELECT 
          status,
          COUNT(*) as count
        FROM assigned_tasks at
        WHERE 1=1
        ${employeeId ? ' AND at.assigned_to = ?' : ''}
        ${startDate ? ' AND date(at.created_at) >= ?' : ''}
        ${endDate ? ' AND date(at.created_at) <= ?' : ''}
        GROUP BY status
      `).all(...params);

      const chartData = statusCounts.map((s: any) => ({ name: s.status, value: s.count }));
      
      const statusDistribution = [
        { name: 'Assigned', value: 0, color: '#3b82f6' },
        { name: 'In Progress', value: 0, color: '#f59e0b' },
        { name: 'Pending Review', value: 0, color: '#f97316' },
        { name: 'Closed', value: 0, color: '#22c55e' },
        { name: 'Rejected', value: 0, color: '#ef4444' },
      ];
      
      statusCounts.forEach((s: any) => {
        const item = statusDistribution.find((d: any) => d.name.toLowerCase().replace(' ', '_') === s.status);
        if (item) item.value = s.count;
      });

      // Trend data (tasks created per day)
      let trendQuery = `
        SELECT 
          date(created_at) as date,
          COUNT(*) as count
        FROM assigned_tasks
        WHERE date(created_at) >= ? AND date(created_at) <= ?
      `;
      const trendParams: (string | number)[] = [startDate || '2024-01-01', endDate || '2024-12-31'];
      if (employeeId) {
        trendQuery += ' AND assigned_to = ?';
        trendParams.push(parseInt(employeeId));
      }
      trendQuery += ' GROUP BY date(created_at) ORDER BY date(created_at)';
      const trendData = db.prepare(trendQuery).all(...trendParams);

      return NextResponse.json({
        summary: {
          total_tasks: stats.total_tasks,
          completed_tasks: stats.completed_tasks,
          rejected_tasks: stats.rejected_tasks,
          pending_review: stats.pending_review_tasks,
          avg_ai_score: stats.avg_ai_score ? Math.round(stats.avg_ai_score * 100) / 100 : 0,
        },
        records: tasks,
        columns: ['title', 'assigned_to_name', 'status', 'project_name', 'created_at', 'ai_decision', 'score'],
        chartData,
        statusDistribution: statusDistribution.filter((d: any) => d.value > 0),
        trendData: trendData.map((t: any) => ({ date: t.date, value: t.count })),
      });
      
    } else if (reportType === 'ai-analysis') {
      // AI analysis report
      let query = `
        SELECT 
          taa.id,
          taa.score,
          taa.task_understanding,
          taa.work_authenticity,
          taa.output_validity,
          taa.effort_reasonableness,
          taa.difficulty_consistency,
          taa.risk_flags,
          taa.decision,
          taa.analysis_summary,
          taa.analyzed_at,
          taa.notification_sent,
          at.title as task_title,
          u.name as employee_name,
          u.email as employee_email,
          ts.work_summary,
          ts.time_spent,
          ts.difficulty_level
        FROM task_ai_analysis taa
        JOIN assigned_tasks at ON taa.task_id = at.id
        JOIN users u ON taa.user_id = u.id
        JOIN task_submissions ts ON taa.submission_id = ts.id
        WHERE 1=1
      `;
      const params: (string | number)[] = [];
      
      if (employeeId) {
        query += ' AND taa.user_id = ?';
        params.push(parseInt(employeeId));
      }
      if (startDate) {
        query += ' AND date(taa.analyzed_at) >= ?';
        params.push(startDate);
      }
      if (endDate) {
        query += ' AND date(taa.analyzed_at) <= ?';
        params.push(endDate);
      }
      
      query += ' ORDER BY taa.analyzed_at DESC';
      
      const analyses = db.prepare(query).all(...params);
      
      // Calculate stats
      const stats = db.prepare(`
        SELECT 
          COUNT(*) as total_analyzed,
          AVG(score) as avg_score,
          SUM(CASE WHEN decision = 'approved' THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN decision = 'rejected' THEN 1 ELSE 0 END) as rejected,
          SUM(CASE WHEN decision = 'needs_review' THEN 1 ELSE 0 END) as needs_review
        FROM task_ai_analysis taa
        WHERE 1=1
        ${employeeId ? ' AND taa.user_id = ?' : ''}
        ${startDate ? ' AND date(taa.analyzed_at) >= ?' : ''}
        ${endDate ? ' AND date(taa.analyzed_at) <= ?' : ''}
      `).get(...params) as {
        total_analyzed: number;
        avg_score: number | null;
        approved: number;
        rejected: number;
        needs_review: number;
      };
      
      if (format === 'csv') {
        const fields = [
          { label: 'Analysis ID', value: 'id' },
          { label: 'Task Title', value: 'task_title' },
          { label: 'Employee', value: 'employee_name' },
          { label: 'Score', value: 'score' },
          { label: 'Task Understanding', value: 'task_understanding' },
          { label: 'Work Authenticity', value: 'work_authenticity' },
          { label: 'Output Validity', value: 'output_validity' },
          { label: 'Effort Reasonableness', value: 'effort_reasonableness' },
          { label: 'Difficulty Consistency', value: 'difficulty_consistency' },
          { label: 'Risk Flags', value: 'risk_flags' },
          { label: 'Decision', value: 'decision' },
          { label: 'Analysis Summary', value: 'analysis_summary' },
          { label: 'Analyzed At', value: 'analyzed_at' },
          { label: 'Time Spent', value: 'time_spent' },
          { label: 'Difficulty Level', value: 'difficulty_level' },
        ];
        return sendCSV(analyses, fields, `ai-analysis-report-${startDate || 'all'}-to-${endDate || 'all'}.csv`);
      }

      // Prepare chart data
      const chartData = [
        { name: 'Approved', value: stats.approved || 0 },
        { name: 'Rejected', value: stats.rejected || 0 },
        { name: 'Needs Review', value: stats.needs_review || 0 },
      ];

      const statusDistribution = [
        { name: 'Approved', value: stats.approved || 0, color: '#22c55e' },
        { name: 'Rejected', value: stats.rejected || 0, color: '#ef4444' },
        { name: 'Needs Review', value: stats.needs_review || 0, color: '#f59e0b' },
      ].filter(d => d.value > 0);

      // Score distribution
      const scoreDistribution = db.prepare(`
        SELECT 
          CASE 
            WHEN score >= 80 THEN 'Excellent (80-100)'
            WHEN score >= 60 THEN 'Good (60-79)'
            WHEN score >= 40 THEN 'Fair (40-59)'
            ELSE 'Poor (0-39)'
          END as range,
          COUNT(*) as count
        FROM task_ai_analysis taa
        WHERE 1=1
        ${employeeId ? ' AND taa.user_id = ?' : ''}
        ${startDate ? ' AND date(taa.analyzed_at) >= ?' : ''}
        ${endDate ? ' AND date(taa.analyzed_at) <= ?' : ''}
        GROUP BY range
        ORDER BY MIN(score)
      `).all(...params);

      return NextResponse.json({
        summary: {
          total_analyzed: stats.total_analyzed,
          avg_score: stats.avg_score ? Math.round(stats.avg_score * 100) / 100 : 0,
          approved: stats.approved,
          rejected: stats.rejected,
          needs_review: stats.needs_review,
        },
        records: analyses,
        columns: ['task_title', 'employee_name', 'decision', 'score', 'analyzed_at'],
        chartData,
        statusDistribution,
        scoreDistribution: scoreDistribution.map((s: any) => ({ name: s.range, value: s.count })),
      });
      
    } else if (reportType === 'violations') {
      // Attendance violations report
      let query = `
        SELECT 
          av.*,
          u.name as employee_name,
          u.email as employee_email
        FROM attendance_violations av
        JOIN users u ON av.user_id = u.id
        WHERE 1=1
      `;
      const params: (string | number)[] = [];
      
      if (employeeId) {
        query += ' AND av.user_id = ?';
        params.push(parseInt(employeeId));
      }
      if (startDate) {
        query += ' AND av.date >= ?';
        params.push(startDate);
      }
      if (endDate) {
        query += ' AND av.date <= ?';
        params.push(endDate);
      }
      
      query += ' ORDER BY av.created_at DESC';
      
      const violations = db.prepare(query).all(...params);
      
      // Calculate stats
      const stats = db.prepare(`
        SELECT 
          COUNT(*) as total_violations,
          SUM(CASE WHEN leave_deducted = 1 THEN 1 ELSE 0 END) as leave_deductions,
          SUM(deduction_hours) as total_hours_deducted,
          SUM(CASE WHEN violation_type = 'no_task_submitted' THEN 1 ELSE 0 END) as no_task_count,
          SUM(CASE WHEN violation_type = 'task_rejected' THEN 1 ELSE 0 END) as rejected_count,
          SUM(CASE WHEN violation_type = 'hours_mismatch' THEN 1 ELSE 0 END) as hours_mismatch_count
        FROM attendance_violations av
        WHERE 1=1
        ${employeeId ? ' AND av.user_id = ?' : ''}
        ${startDate ? ' AND av.date >= ?' : ''}
        ${endDate ? ' AND av.date <= ?' : ''}
      `).get(...params) as {
        total_violations: number;
        leave_deductions: number;
        total_hours_deducted: number;
        no_task_count: number;
        rejected_count: number;
        hours_mismatch_count: number;
      };
      
      if (format === 'csv') {
        const fields = [
          { label: 'Violation ID', value: 'id' },
          { label: 'Employee Name', value: 'employee_name' },
          { label: 'Employee Email', value: 'employee_email' },
          { label: 'Date', value: 'date' },
          { label: 'Violation Type', value: 'violation_type' },
          { label: 'Email Count', value: 'email_count' },
          { label: 'Leave Deducted', value: 'leave_deducted' },
          { label: 'Deduction Hours', value: 'deduction_hours' },
          { label: 'Created At', value: 'created_at' },
          { label: 'Resolved At', value: 'resolved_at' },
        ];
        return sendCSV(violations, fields, `violations-report-${startDate || 'all'}-to-${endDate || 'all'}.csv`);
      }

      // Prepare chart data
      const byTypeChart = [
        { name: 'No Task Submitted', value: stats.no_task_count || 0 },
        { name: 'Task Rejected', value: stats.rejected_count || 0 },
        { name: 'Hours Mismatch', value: stats.hours_mismatch_count || 0 },
      ];

      const statusDistribution = [
        { name: 'No Task', value: stats.no_task_count || 0, color: '#f59e0b' },
        { name: 'Rejected', value: stats.rejected_count || 0, color: '#ef4444' },
        { name: 'Hours Mismatch', value: stats.hours_mismatch_count || 0, color: '#8b5cf6' },
      ].filter(d => d.value > 0);

      // Trend data
      let trendQuery = `
        SELECT 
          date,
          COUNT(*) as count
        FROM attendance_violations
        WHERE date >= ? AND date <= ?
      `;
      const trendParams: (string | number)[] = [startDate || '2024-01-01', endDate || '2024-12-31'];
      if (employeeId) {
        trendQuery += ' AND user_id = ?';
        trendParams.push(parseInt(employeeId));
      }
      trendQuery += ' GROUP BY date ORDER BY date';
      const trendData = db.prepare(trendQuery).all(...trendParams);

      return NextResponse.json({
        summary: {
          total_violations: stats.total_violations,
          leave_deductions: stats.leave_deductions,
          total_hours_deducted: stats.total_hours_deducted || 0,
        },
        records: violations,
        columns: ['employee_name', 'date', 'violation_type', 'email_count', 'leave_deducted'],
        chartData: byTypeChart.filter(d => d.value > 0),
        statusDistribution,
        trendData: trendData.map((t: any) => ({ date: t.date, value: t.count })),
      });
      
    } else if (reportType === 'task-picker') {
      // Task picker usage report
      const stats = db.prepare(`
        SELECT 
          COUNT(*) as total_tasks,
          SUM(CASE WHEN picked_by IS NOT NULL THEN 1 ELSE 0 END) as picked_tasks,
          SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) as completed_tasks,
          AVG(CASE WHEN completed_at IS NOT NULL THEN 
            (julianday(completed_at) - julianday(picked_at)) * 24 
          END) as avg_completion_hours
        FROM task_picker_pool
      `).get() as {
        total_tasks: number;
        picked_tasks: number;
        completed_tasks: number;
        avg_completion_hours: number | null;
      };
      
      const tasksByEmployee = db.prepare(`
        SELECT 
          u.name as employee_name,
          COUNT(*) as tasks_picked,
          SUM(CASE WHEN tp.completed_at IS NOT NULL THEN 1 ELSE 0 END) as tasks_completed
        FROM task_picker_pool tp
        JOIN users u ON tp.picked_by = u.id
        GROUP BY tp.picked_by
        ORDER BY tasks_picked DESC
      `).all();
      
      return NextResponse.json({
        stats: {
          total: stats.total_tasks,
          picked: stats.picked_tasks,
          completed: stats.completed_tasks,
          avgCompletionHours: stats.avg_completion_hours ? 
            Math.round(stats.avg_completion_hours * 100) / 100 : null,
        },
        byEmployee: tasksByEmployee,
      });
    }
    
    return NextResponse.json(
      { error: 'Invalid report type' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Reports API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
