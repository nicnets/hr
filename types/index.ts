export interface User {
  id: number;
  email: string;
  name: string;
  role: 'employee' | 'admin';
  department: string | null;
  joining_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeaveBalance {
  id: number;
  user_id: number;
  year: number;
  total_leaves: number;
  used_leaves: number;
  remaining_leaves: number;
  lop_days: number;
}

export interface Attendance {
  id: number;
  user_id: number;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  total_hours: number | null;
  status: 'present' | 'late' | 'half_day' | 'unaccounted' | 'on_leave' | 'lop' | 'pending';
  is_auto_clockout: boolean;
  grace_period_used: boolean;
}

export interface TaskLog {
  id: number;
  user_id: number;
  date: string;
  project_name: string;
  task_description: string;
  start_time: string;
  end_time: string;
  hours_spent: number;
  created_at: string;
}

export interface LeaveApplication {
  id: number;
  user_id: number;
  start_date: string;
  end_date: string;
  leave_type: 'annual' | 'sick' | 'emergency' | 'unpaid';
  reason: string;
  days_requested: number;
  status: 'pending' | 'approved' | 'rejected';
  is_lop: boolean;
  approved_by: number | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  user_name?: string;
}

export interface AttendanceException {
  id: number;
  user_id: number;
  attendance_id: number | null;
  date: string;
  exception_type: 'missing_clock_in' | 'missing_clock_out' | 'both' | 'wrong_time';
  reason: string;
  requested_clock_in: string | null;
  requested_clock_out: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: number | null;
  reviewed_at: string | null;
  admin_notes: string | null;
  created_at: string;
  user_name?: string;
}

export interface SystemConfig {
  id: number;
  shift_start_time: string;
  grace_period_minutes: number;
  auto_clockout_time: string;
  min_work_hours: number;
  half_day_threshold: number;
  working_days: string;
  company_name: string;
}

export interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  old_values: string | null;
  new_values: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface DashboardStats {
  totalEmployees: number;
  currentlyClockedIn: number;
  pendingLeaveRequests: number;
  pendingExceptions: number;
  todayAttendance: {
    present: number;
    late: number;
    absent: number;
  };
}

export interface EmployeeDashboardData {
  user: User;
  leaveBalance: LeaveBalance;
  todayAttendance: Attendance | null;
  recentTasks: TaskLog[];
  notifications: Notification[];
  pendingLeaves: LeaveApplication[];
}

export interface AdminDashboardData {
  stats: DashboardStats;
  recentActivity: AuditLog[];
  pendingApprovals: {
    leaves: LeaveApplication[];
    exceptions: AttendanceException[];
  };
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  is_internal: boolean;
  created_at: string;
  updated_at: string;
}
