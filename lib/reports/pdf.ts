import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AttendanceRecord {
  date: string;
  employee_name: string;
  clock_in: string | null;
  clock_out: string | null;
  total_hours: number | null;
  status: string;
}

interface LeaveRecord {
  employee_name: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  days_requested: number;
  status: string;
  is_lop: boolean;
}

interface TaskRecord {
  employee_name: string;
  date: string;
  project_name: string;
  task_description: string;
  hours_spent: number;
}

export function generateAttendancePDF(
  records: AttendanceRecord[],
  period: string,
  companyName: string = 'ForceFriction AI'
): Buffer {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.text('Attendance Report', 14, 20);
  
  doc.setFontSize(12);
  doc.text(companyName, 14, 30);
  doc.text(`Period: ${period}`, 14, 38);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 46);
  
  // Summary stats
  const totalRecords = records.length;
  const presentCount = records.filter(r => r.status === 'present').length;
  const lateCount = records.filter(r => r.status === 'late').length;
  const halfDayCount = records.filter(r => r.status === 'half_day').length;
  const unaccountedCount = records.filter(r => r.status === 'unaccounted').length;
  
  doc.setFontSize(14);
  doc.text('Summary', 14, 60);
  
  doc.setFontSize(10);
  const summaryData = [
    ['Total Records', String(totalRecords)],
    ['Present', String(presentCount)],
    ['Late', String(lateCount)],
    ['Half Day', String(halfDayCount)],
    ['Unaccounted', String(unaccountedCount)],
  ];
  
  autoTable(doc, {
    startY: 65,
    head: [['Metric', 'Count']],
    body: summaryData,
    theme: 'striped',
    headStyles: { fillColor: [0, 123, 255] },
    margin: { left: 14 },
    tableWidth: 80,
  });
  
  // Data table
  const tableData = records.map(r => [
    r.employee_name,
    r.date,
    r.clock_in || '-',
    r.clock_out || '-',
    r.total_hours?.toFixed(1) || '-',
    r.status.toUpperCase(),
  ]);
  
  autoTable(doc, {
    startY: 110,
    head: [['Employee', 'Date', 'Clock In', 'Clock Out', 'Hours', 'Status']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [0, 123, 255] },
    styles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 25 },
      2: { cellWidth: 25 },
      3: { cellWidth: 25 },
      4: { cellWidth: 20 },
      5: { cellWidth: 25 },
    },
  });
  
  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.text(
      `Page ${i} of ${pageCount} - ${companyName} HR Portal`,
      14,
      doc.internal.pageSize.height - 10
    );
  }
  
  return Buffer.from(doc.output('arraybuffer'));
}

export function generateLeavePDF(
  records: LeaveRecord[],
  period: string,
  companyName: string = 'ForceFriction AI'
): Buffer {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.text('Leave Report', 14, 20);
  
  doc.setFontSize(12);
  doc.text(companyName, 14, 30);
  doc.text(`Period: ${period}`, 14, 38);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 46);
  
  // Summary
  const totalRequests = records.length;
  const approvedCount = records.filter(r => r.status === 'approved').length;
  const pendingCount = records.filter(r => r.status === 'pending').length;
  const rejectedCount = records.filter(r => r.status === 'rejected').length;
  const lopCount = records.filter(r => r.is_lop).length;
  const totalDays = records
    .filter(r => r.status === 'approved')
    .reduce((sum, r) => sum + r.days_requested, 0);
  
  doc.setFontSize(14);
  doc.text('Summary', 14, 60);
  
  doc.setFontSize(10);
  const summaryData = [
    ['Total Requests', String(totalRequests)],
    ['Approved', String(approvedCount)],
    ['Pending', String(pendingCount)],
    ['Rejected', String(rejectedCount)],
    ['LOP Applications', String(lopCount)],
    ['Total Days (Approved)', String(totalDays)],
  ];
  
  autoTable(doc, {
    startY: 65,
    head: [['Metric', 'Count']],
    body: summaryData,
    theme: 'striped',
    headStyles: { fillColor: [40, 167, 69] },
    margin: { left: 14 },
    tableWidth: 80,
  });
  
  // Data table
  const tableData = records.map(r => [
    r.employee_name,
    r.start_date,
    r.end_date,
    r.leave_type,
    String(r.days_requested),
    r.status.toUpperCase(),
    r.is_lop ? 'Yes' : 'No',
  ]);
  
  autoTable(doc, {
    startY: 120,
    head: [['Employee', 'Start', 'End', 'Type', 'Days', 'Status', 'LOP']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [40, 167, 69] },
    styles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });
  
  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.text(
      `Page ${i} of ${pageCount} - ${companyName} HR Portal`,
      14,
      doc.internal.pageSize.height - 10
    );
  }
  
  return Buffer.from(doc.output('arraybuffer'));
}

export function generateProductivityPDF(
  records: TaskRecord[],
  period: string,
  companyName: string = 'ForceFriction AI'
): Buffer {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.text('Productivity Report', 14, 20);
  
  doc.setFontSize(12);
  doc.text(companyName, 14, 30);
  doc.text(`Period: ${period}`, 14, 38);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 46);
  
  // Project summary
  const projectHours: Record<string, number> = {};
  records.forEach(r => {
    projectHours[r.project_name] = (projectHours[r.project_name] || 0) + r.hours_spent;
  });
  
  const sortedProjects = Object.entries(projectHours).sort((a, b) => b[1] - a[1]);
  const totalHours = records.reduce((sum, r) => sum + r.hours_spent, 0);
  
  doc.setFontSize(14);
  doc.text('Hours by Project', 14, 60);
  
  doc.setFontSize(10);
  const projectData = sortedProjects.map(([project, hours]) => [
    project,
    hours.toFixed(1),
    `${Math.round((hours / totalHours) * 100)}%`,
  ]);
  
  autoTable(doc, {
    startY: 65,
    head: [['Project', 'Hours', 'Percentage']],
    body: projectData,
    theme: 'striped',
    headStyles: { fillColor: [108, 117, 125] },
    margin: { left: 14 },
    tableWidth: 100,
  });
  
  // Employee summary
  const employeeHours: Record<string, number> = {};
  records.forEach(r => {
    employeeHours[r.employee_name] = (employeeHours[r.employee_name] || 0) + r.hours_spent;
  });
  
  const sortedEmployees = Object.entries(employeeHours).sort((a, b) => b[1] - a[1]);
  
  const currentY = (doc as any).lastAutoTable?.finalY || 100;
  
  doc.setFontSize(14);
  doc.text('Hours by Employee', 14, currentY + 15);
  
  const employeeData = sortedEmployees.map(([employee, hours]) => [
    employee,
    hours.toFixed(1),
    `${Math.round((hours / totalHours) * 100)}%`,
  ]);
  
  autoTable(doc, {
    startY: currentY + 20,
    head: [['Employee', 'Hours', 'Percentage']],
    body: employeeData,
    theme: 'striped',
    headStyles: { fillColor: [108, 117, 125] },
    margin: { left: 14 },
    tableWidth: 100,
  });
  
  // Detailed task list
  const taskY = (doc as any).lastAutoTable?.finalY || 160;
  
  doc.setFontSize(14);
  doc.text('Task Details', 14, taskY + 15);
  
  const taskData = records.map(r => [
    r.date,
    r.employee_name,
    r.project_name,
    r.task_description.substring(0, 40) + (r.task_description.length > 40 ? '...' : ''),
    r.hours_spent.toFixed(1),
  ]);
  
  autoTable(doc, {
    startY: taskY + 20,
    head: [['Date', 'Employee', 'Project', 'Task', 'Hours']],
    body: taskData,
    theme: 'striped',
    headStyles: { fillColor: [108, 117, 125] },
    styles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });
  
  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.text(
      `Page ${i} of ${pageCount} - ${companyName} HR Portal`,
      14,
      doc.internal.pageSize.height - 10
    );
  }
  
  return Buffer.from(doc.output('arraybuffer'));
}
