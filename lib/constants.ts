export const APP_NAME = 'ForceFriction AI HR Portal';
export const COMPANY_NAME = 'ForceFriction AI';

export const LEAVE_TYPES = [
  { value: 'annual', label: 'Annual Leave' },
  { value: 'sick', label: 'Sick Leave' },
  { value: 'emergency', label: 'Emergency Leave' },
  { value: 'unpaid', label: 'Unpaid Leave' },
] as const;

export const ATTENDANCE_STATUS = {
  present: { label: 'Present', color: 'green' },
  late: { label: 'Late', color: 'yellow' },
  half_day: { label: 'Half Day', color: 'orange' },
  unaccounted: { label: 'Unaccounted', color: 'red' },
  on_leave: { label: 'On Leave', color: 'blue' },
  lop: { label: 'Loss of Pay', color: 'red' },
  pending: { label: 'Pending', color: 'gray' },
} as const;

export const APPLICATION_STATUS = {
  pending: { label: 'Pending', color: 'yellow' },
  approved: { label: 'Approved', color: 'green' },
  rejected: { label: 'Rejected', color: 'red' },
} as const;

export const EXCEPTION_TYPES = {
  missing_clock_in: { label: 'Missing Clock In', deduction: 0 },
  missing_clock_out: { label: 'Missing Clock Out', deduction: 0 },
  both: { label: 'Missing Both', deduction: 1.0 },
  wrong_time: { label: 'Wrong Time Entry', deduction: 0 },
} as const;

export const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const DEFAULT_LEAVE_DAYS = 20;
export const DEFAULT_SHIFT_START = '09:00';
export const DEFAULT_GRACE_PERIOD = 15;
export const DEFAULT_AUTO_CLOCOUT = '18:00';
export const DEFAULT_MIN_WORK_HOURS = 8;
export const DEFAULT_HALF_DAY_THRESHOLD = 4;
