import { Parser } from 'json2csv';

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
  reason?: string;
}

interface TaskRecord {
  employee_name: string;
  date: string;
  project_name: string;
  task_description: string;
  start_time: string;
  end_time: string;
  hours_spent: number;
}

export function generateAttendanceCSV(records: AttendanceRecord[]): string {
  const fields = [
    { label: 'Employee', value: 'employee_name' },
    { label: 'Date', value: 'date' },
    { label: 'Clock In', value: 'clock_in' },
    { label: 'Clock Out', value: 'clock_out' },
    { label: 'Total Hours', value: 'total_hours' },
    { label: 'Status', value: 'status' },
  ];
  
  const parser = new Parser({ fields });
  return parser.parse(records);
}

export function generateLeaveCSV(records: LeaveRecord[]): string {
  const fields = [
    { label: 'Employee', value: 'employee_name' },
    { label: 'Start Date', value: 'start_date' },
    { label: 'End Date', value: 'end_date' },
    { label: 'Leave Type', value: 'leave_type' },
    { label: 'Days Requested', value: 'days_requested' },
    { label: 'Status', value: 'status' },
    { label: 'LOP', value: 'is_lop' },
    { label: 'Reason', value: 'reason' },
  ];
  
  const parser = new Parser({ fields });
  return parser.parse(records);
}

export function generateProductivityCSV(records: TaskRecord[]): string {
  const fields = [
    { label: 'Employee', value: 'employee_name' },
    { label: 'Date', value: 'date' },
    { label: 'Project', value: 'project_name' },
    { label: 'Task Description', value: 'task_description' },
    { label: 'Start Time', value: 'start_time' },
    { label: 'End Time', value: 'end_time' },
    { label: 'Hours Spent', value: 'hours_spent' },
  ];
  
  const parser = new Parser({ fields });
  return parser.parse(records);
}

export function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
