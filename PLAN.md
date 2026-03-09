# ForceFriction AI - HR Portal System
## Module 1: Leave Management + Time Tracking System

---

## 1. Executive Summary

A Next.js-based internal HR portal for ~20 employees featuring:
- **Time Tracking**: Clock in/out with automatic calculations
- **Leave Management**: Balance tracking, applications, auto-deductions
- **Task Logging**: Project-based work tracking
- **Admin Panel**: Full system control and reporting
- **Automation**: Grace periods, auto clock-out, attendance penalties

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Database | SQLite (via `better-sqlite3`) |
| ORM | Custom lightweight ORM |
| Auth | NextAuth.js (Credentials + Session) |
| State | React Context + Server Actions |
| Charts | Recharts |
| UI Components | shadcn/ui |
| Icons | Lucide React |
| Email | Nodemailer (SMTP) |
| PDF Generation | jsPDF + jspdf-autotable |
| Cron Jobs | node-cron |

---

## 3. Database Schema

### 3.1 Core Tables

```sql
-- Users table (employees + admins)
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT CHECK(role IN ('employee', 'admin')) DEFAULT 'employee',
    password_hash TEXT NOT NULL,
    department TEXT,
    joining_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Leave balance per employee
CREATE TABLE leave_balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    total_leaves REAL DEFAULT 20.0,
    used_leaves REAL DEFAULT 0.0,
    remaining_leaves REAL GENERATED ALWAYS AS (total_leaves - used_leases) STORED,
    lop_days REAL DEFAULT 0.0,
    UNIQUE(user_id, year),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Attendance records (clock in/out)
CREATE TABLE attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date DATE NOT NULL,
    clock_in DATETIME,
    clock_out DATETIME,
    total_hours REAL GENERATED ALWAYS AS (
        CASE 
            WHEN clock_in IS NOT NULL AND clock_out IS NOT NULL 
            THEN ROUND((julianday(clock_out) - julianday(clock_in)) * 24, 2)
            ELSE NULL 
        END
    ) STORED,
    status TEXT CHECK(status IN ('present', 'late', 'half_day', 'unaccounted', 'on_leave', 'lop')),
    is_auto_clockout BOOLEAN DEFAULT 0,
    grace_period_used BOOLEAN DEFAULT 0,
    UNIQUE(user_id, date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Task logs (work logging)
CREATE TABLE task_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date DATE NOT NULL,
    project_name TEXT NOT NULL,
    task_description TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    hours_spent REAL GENERATED ALWAYS AS (
        ROUND((julianday(end_time) - julianday(start_time)) * 24, 2)
    ) STORED,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Leave applications
CREATE TABLE leave_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    leave_type TEXT CHECK(leave_type IN ('annual', 'sick', 'emergency', 'unpaid')),
    reason TEXT NOT NULL,
    days_requested REAL NOT NULL,
    status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    is_lop BOOLEAN DEFAULT 0,
    approved_by INTEGER,
    approved_at DATETIME,
    rejection_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id)
);

-- Attendance exception requests
CREATE TABLE attendance_exceptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    attendance_id INTEGER,
    date DATE NOT NULL,
    exception_type TEXT CHECK(exception_type IN ('missing_clock_in', 'missing_clock_out', 'both', 'wrong_time')),
    reason TEXT NOT NULL,
    requested_clock_in DATETIME,
    requested_clock_out DATETIME,
    status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    reviewed_by INTEGER,
    reviewed_at DATETIME,
    admin_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (attendance_id) REFERENCES attendance(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

-- System configuration
CREATE TABLE system_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    shift_start_time TIME DEFAULT '09:00',
    grace_period_minutes INTEGER DEFAULT 15,
    auto_clockout_time TIME DEFAULT '18:00',
    min_work_hours REAL DEFAULT 8.0,
    half_day_threshold REAL DEFAULT 4.0,
    working_days TEXT DEFAULT '1,2,3,4,5', -- Monday to Friday
    company_name TEXT DEFAULT 'ForceFriction AI'
);

-- Audit logs
CREATE TABLE audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    old_values TEXT,
    new_values TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Notifications
CREATE TABLE notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT 0,
    link TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Email log (track sent emails)
CREATE TABLE email_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    email_type TEXT NOT NULL,
    subject TEXT NOT NULL,
    status TEXT CHECK(status IN ('sent', 'failed')) NOT NULL,
    error_message TEXT,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

## 4. Project Structure

```
app/
├── (auth)/                           # Auth group
│   ├── login/
│   │   └── page.tsx                  # Login page
│   └── layout.tsx                    # Auth layout (no sidebar)
│
├── (dashboard)/                      # Dashboard group (protected)
│   ├── layout.tsx                    # Dashboard layout with sidebar
│   ├── page.tsx                      # Employee dashboard (default)
│   ├── admin/
│   │   ├── page.tsx                  # Admin dashboard
│   │   ├── employees/
│   │   │   ├── page.tsx              # Employee list
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx          # Employee detail/edit
│   │   │   └── new/
│   │   │       └── page.tsx          # Add new employee
│   │   ├── leave-applications/
│   │   │   └── page.tsx              # Manage leave requests
│   │   ├── attendance-exceptions/
│   │   │   └── page.tsx              # Review exceptions
│   │   ├── reports/
│   │   │   ├── page.tsx              # Reports dashboard
│   │   │   ├── attendance/
│   │   │   │   └── page.tsx          # Attendance reports
│   │   │   ├── leave/
│   │   │   │   └── page.tsx          # Leave reports
│   │   │   └── productivity/
│   │   │       └── page.tsx          # Productivity reports
│   │   ├── settings/
│   │   │   ├── page.tsx              # System settings
│   │   │   ├── leave-policy/
│   │   │   │   └── page.tsx          # Leave policy config
│   │   │   └── attendance-rules/
│   │   │       └── page.tsx          # Attendance rules config
│   │   └── audit-logs/
│   │       └── page.tsx              # Audit trail
│   │
│   ├── attendance/
│   │   ├── page.tsx                  # Attendance history
│   │   └── exceptions/
│   │       ├── page.tsx              # My exceptions
│   │       └── new/
│   │           └── page.tsx          # Request exception
│   │
│   ├── leave/
│   │   ├── page.tsx                  # Leave balance & history
│   │   └── apply/
│   │       └── page.tsx              # Apply for leave
│   │
│   └── tasks/
│       ├── page.tsx                  # Task log history
│       └── log/
│           └── page.tsx              # Log new task
│
├── api/                              # API routes
│   ├── auth/
│   │   └── [...nextauth]/
│   │       └── route.ts
│   ├── clock-in/
│   │   └── route.ts
│   ├── clock-out/
│   │   └── route.ts
│   └── ...
│
├── lib/
│   ├── db/
│   │   ├── index.ts                  # Database connection
│   │   ├── schema.ts                 # Schema definitions
│   │   ├── migrations.ts             # Migration runner
│   │   └── seeds.ts                  # Seed data
│   │
│   ├── actions/
│   │   ├── attendance.ts             # Attendance server actions
│   │   ├── leave.ts                  # Leave server actions
│   │   ├── tasks.ts                  # Task logging actions
│   │   ├── employees.ts              # Employee management actions
│   │   ├── exceptions.ts             # Exception handling actions
│   │   └── reports.ts                # Report generation actions
│   │
│   ├── hooks/
│   │   ├── useAuth.ts                # Auth hook
│   │   ├── useAttendance.ts          # Attendance hook
│   │   └── useLeave.ts               # Leave hook
│   │
│   ├── utils/
│   │   ├── date.ts                   # Date utilities
│   │   ├── calculations.ts           # Work hour calculations
│   │   └── validators.ts             # Input validation
│   │
│   └── constants.ts                  # App constants
│
├── components/
│   ├── ui/                           # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── form.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── table.tsx
│   │   ├── tabs.tsx
│   │   ├── toast.tsx
│   │   └── ...
│   │
│   ├── layout/
│   │   ├── Sidebar.tsx               # Navigation sidebar
│   │   ├── Header.tsx                # Top header
│   │   ├── DashboardLayout.tsx       # Dashboard wrapper
│   │   └── AuthGuard.tsx             # Route protection
│   │
│   ├── dashboard/
│   │   ├── ClockInWidget.tsx         # Clock in/out button
│   │   ├── TodayStatus.tsx           # Today's attendance status
│   │   ├── LeaveBalanceCard.tsx      # Leave balance display
│   │   ├── TaskLogWidget.tsx         # Quick task logging
│   │   └── RecentActivity.tsx        # Activity feed
│   │
│   ├── attendance/
│   │   ├── AttendanceTable.tsx
│   │   ├── ClockButton.tsx
│   │   └── StatusBadge.tsx
│   │
│   ├── leave/
│   │   ├── LeaveBalance.tsx
│   │   ├── LeaveApplicationForm.tsx
│   │   └── LeaveHistoryTable.tsx
│   │
│   ├── tasks/
│   │   ├── TaskLogForm.tsx
│   │   └── TaskLogTable.tsx
│   │
│   ├── admin/
│   │   ├── EmployeeForm.tsx
│   │   ├── EmployeeTable.tsx
│   │   ├── ExceptionReviewModal.tsx
│   │   ├── ReportFilters.tsx
│   │   └── SettingsForm.tsx
│   │
│   └── charts/
│       ├── AttendanceChart.tsx
│       ├── LeaveChart.tsx
│       └── ProductivityChart.tsx
│
├── types/
│   ├── auth.ts
│   ├── user.ts
│   ├── attendance.ts
│   ├── leave.ts
│   ├── task.ts
│   └── common.ts
│
├── globals.css
├── layout.tsx
└── page.tsx                          # Landing/redirect page

public/
└── (static assets)

├── next.config.ts
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── PLAN.md                           # This document
```

---

## 5. Core Features & Implementation Details

### 5.1 Authentication Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Login     │────▶│  NextAuth   │────▶│   Session   │
│    Page     │     │  Callback   │     │   Created   │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                        ┌──────────────────────┘
                        ▼
               ┌─────────────────┐
               │  Middleware     │
               │  (Role Check)   │
               └─────────────────┘
                        │
           ┌────────────┴────────────┐
           ▼                         ▼
    ┌─────────────┐           ┌─────────────┐
    │   Admin     │           │  Employee   │
    │  Dashboard  │           │  Dashboard  │
    └─────────────┘           └─────────────┘
```

### 5.2 Clock In/Out Flow

```
Employee Clicks Clock In
         │
         ▼
┌─────────────────────┐
│  Check if already   │──Yes──▶ Show error
│   clocked in today  │
└─────────────────────┘
         │ No
         ▼
┌─────────────────────┐
│ Record clock_in time│
│ Check grace period  │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ If after shift+grace│
│ mark as 'late'      │
└─────────────────────┘
```

### 5.3 Automated Background Jobs

Since this is self-hosted, we'll use `node-cron` for scheduled tasks:

```typescript
// lib/jobs/index.ts
import cron from 'node-cron';

export function startCronJobs() {
  // Auto clock-out at 6:05 PM daily
  cron.schedule('5 18 * * *', async () => {
    await processAutoClockOut();
  });
  
  // Process attendance at 11:55 PM daily
  cron.schedule('55 23 * * *', async () => {
    await processDailyAttendance();
  });
  
  // Clock-in reminders at 9:15 AM
  cron.schedule('15 9 * * 1-5', async () => {
    await sendClockInReminders();
  });
  
  // Clock-out reminders at 5:45 PM
  cron.schedule('45 17 * * 1-5', async () => {
    await sendClockOutReminders();
  });
}
```

### 5.4 Attendance Processing Logic

```typescript
function processAttendance(attendance: Attendance, config: SystemConfig): AttendanceStatus {
  const { clock_in, clock_out, total_hours } = attendance;
  const { shift_start, grace_period, min_work_hours, half_day_threshold } = config;
  
  // No clock in = Unaccounted
  if (!clock_in) return { status: 'unaccounted', deduction: 1.0 };
  
  // No clock out = Will be auto-processed at end of day
  if (!clock_out) return { status: 'pending', deduction: 0 };
  
  // Check late arrival
  const graceEnd = addMinutes(shift_start, grace_period);
  const isLate = clock_in > graceEnd;
  
  // Check minimum hours
  if (total_hours < half_day_threshold) {
    return { status: 'unaccounted', deduction: 1.0 };
  }
  
  if (total_hours < min_work_hours) {
    return { status: 'half_day', deduction: 0.5 };
  }
  
  return { 
    status: isLate ? 'late' : 'present', 
    deduction: 0 
  };
}
```

### 5.5 Leave Auto-Deduction Flow

```
Daily Attendance Processing
         │
         ▼
┌─────────────────────────┐
│ Check yesterday's       │
│ attendance status       │
└─────────────────────────┘
         │
    ┌────┴────┬────────────┐
    ▼         ▼            ▼
┌──────┐ ┌────────┐ ┌──────────┐
│present│ │half_day│ │unaccounted│
└───┬───┘ └───┬────┘ └─────┬────┘
    │         │            │
 No action  Deduct 0.5   Deduct 1.0
            from leave    from leave
            balance       balance
                            │
                    ┌───────┴───────┐
                    ▼               ▼
               Balance > 0     Balance = 0
                    │               │
               Record leave     Record LOP
```

---

## 6. Page Specifications

### 6.1 Employee Dashboard (`/`)

| Component | Description |
|-----------|-------------|
| Clock Widget | Large CTA button showing current status (In/Out) |
| Today's Summary | Hours worked, tasks logged, break time |
| Leave Balance Card | Visual indicator of remaining leaves |
| Attendance Status | Green/Red indicator for today's status |
| Quick Task Log | Inline form for logging tasks |
| Recent Activity | Last 5 activities (clock events, tasks) |
| Notifications | Unread notifications panel |

### 6.2 Attendance Page (`/attendance`)

| Component | Description |
|-----------|-------------|
| Calendar View | Month view with status colors |
| List View | Table with clock times, hours, status |
| Status Legend | Color coding for different statuses |
| Exception Button | Link to request attendance correction |
| Filter | Date range selector |
| Export | CSV export button |

### 6.3 Leave Page (`/leave`)

| Component | Description |
|-----------|-------------|
| Balance Cards | Total, Used, Remaining, LOP counters |
| Apply Button | CTA to application form |
| History Table | Past applications with status |
| Calendar | Visual leave calendar |

### 6.4 Task Logging Page (`/tasks/log`)

| Component | Description |
|-----------|-------------|
| Project Select | Dropdown of projects |
| Task Input | Text area for description |
| Time Pickers | Start/end time inputs |
| Duration Display | Auto-calculated hours |
| Today's Logs | List of tasks logged today |

### 6.5 Admin Dashboard (`/admin`)

| Component | Description |
|-----------|-------------|
| Stats Cards | Total employees, clocked in, pending requests |
| Live Attendance | Who's currently working |
| Pending Approvals | Leave + exception requests needing action |
| Charts | Weekly attendance trend, leave usage |
| Recent Activity | System-wide activity feed |

### 6.6 Reports Pages

| Report Type | Filters | Visualizations |
|-------------|---------|----------------|
| Attendance | Date, Employee, Status | Line chart, Status breakdown |
| Leave | Date, Employee, Type | Usage chart, Balance report |
| Productivity | Date, Project, Employee | Hours by project, Employee ranking |

---

## 7. Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Project setup with shadcn/ui
- [ ] Database schema & migrations
- [ ] Authentication system
- [ ] Basic layout & navigation

### Phase 2: Core Time Tracking (Week 2)
- [ ] Clock in/out functionality
- [ ] Attendance recording
- [ ] Daily attendance view
- [ ] Basic dashboard

### Phase 3: Leave Management (Week 3)
- [ ] Leave balance system
- [ ] Leave application flow
- [ ] Admin approval workflow
- [ ] Leave history tracking

### Phase 4: Automation & Rules (Week 4)
- [ ] Grace period logic
- [ ] Auto clock-out cron
- [ ] Attendance status calculation
- [ ] Auto leave deduction
- [ ] LOP handling

### Phase 5: Task Logging (Week 5)
- [ ] Task logging form
- [ ] Project tracking
- [ ] Hours calculation
- [ ] Task history

### Phase 6: Admin Panel (Week 6) ✅
- [x] Employee management
- [x] Project management (configure projects for task logging)
- [x] Settings configuration
- [x] Exception review
- [x] Audit logs
- [x] Admin dashboard with stats and charts

### Phase 7: Reporting & Polish (Week 7)
- [ ] Report generation
- [ ] Data visualization
- [ ] CSV/Excel export
- [ ] Notification system
- [ ] UI/UX polish

### Phase 8: Testing & Deployment (Week 8)
- [ ] Unit tests
- [ ] Integration tests
- [ ] User acceptance testing
- [ ] Production deployment
- [ ] Email configuration
- [ ] Cron job setup
- [ ] Backup automation

---

## 8. API Routes

```
# Auth
POST   /api/auth/callback/credentials

# Attendance
POST   /api/clock-in                 # Clock in
POST   /api/clock-out                # Clock out
GET    /api/attendance               # Get attendance records
PUT    /api/attendance/:id           # Update attendance (admin)

# Leave
GET    /api/leave/balance            # Get leave balance
POST   /api/leave/apply              # Apply for leave
GET    /api/leave/applications       # Get applications
PUT    /api/leave/applications/:id   # Approve/reject (admin)

# Tasks
GET    /api/tasks                    # Get task logs
POST   /api/tasks                    # Create task log
PUT    /api/tasks/:id                # Update task log
DELETE /api/tasks/:id                # Delete task log

# Exceptions
POST   /api/exceptions               # Request exception
GET    /api/exceptions               # Get exceptions
PUT    /api/exceptions/:id           # Review exception (admin)

# Admin
GET    /api/admin/employees          # List employees
POST   /api/admin/employees          # Create employee
PUT    /api/admin/employees/:id      # Update employee
DELETE /api/admin/employees/:id      # Deactivate employee
GET    /api/admin/reports/:type      # Generate reports
GET    /api/admin/settings           # Get settings
PUT    /api/admin/settings           # Update settings

# Cron (protected)
GET    /api/cron/auto-clockout       # Daily auto clock-out
GET    /api/cron/process-attendance  # Daily attendance processing
```

---

## 9. Key Business Rules Summary

| Rule | Trigger | Action |
|------|---------|--------|
| Grace Period | Clock in after shift_start + 15min | Mark as 'late' |
| Auto Clock-Out | 6:00 PM if no clock out | Auto-record clock out |
| Half-Day | Work hours < 8 but >= 4 | Deduct 0.5 leave |
| Unaccounted | No clock in OR hours < 4 | Deduct 1 leave |
| LOP | Unaccounted + 0 balance | Record as LOP |
| Leave Deduction | Approved leave application | Deduct requested days |
| Exception Approved | Admin approves | Reverse deduction, correct record |

---

## 10. Security Considerations

1. **Authentication**: NextAuth.js with secure session management
2. **Authorization**: Role-based access control (RBAC)
3. **Input Validation**: Zod schemas for all inputs
4. **SQL Injection**: Parameterized queries only
5. **XSS Protection**: React's built-in escaping + CSP headers
6. **CSRF Protection**: NextAuth.js handles this
7. **Audit Logging**: All admin actions logged
8. **Rate Limiting**: API route protection

---

## 11. Next Steps

1. **Review & Approve**: Review this plan and provide feedback
2. **Begin Implementation**: Start with Phase 1
3. **Provide SMTP Credentials**: Email for notifications
4. **Prepare Domain**: For SSL certificate and deployment

---

*Document Version: 1.0*
*Created: 2026-03-05*
*For: ForceFriction AI*

---

## 12. Email Notification System

### 12.1 Email Types & Triggers

| Trigger | Recipients | Email Content |
|---------|------------|---------------|
| Clock-in Reminder (9:15 AM) | Employees not clocked in | Reminder with clock-in link |
| Clock-out Reminder (5:45 PM) | Employees still clocked in | Reminder to log tasks & clock out |
| Late Clock-in | Employee + Admin | Late arrival notification |
| Auto Clock-out | Employee | Notification of auto clock-out at 6 PM |
| Half-day Detected | Employee + Admin | Worked < 8 hours, 0.5 leave deducted |
| Unaccounted Attendance | Employee + Admin | No clock in/out, 1 leave deducted |
| LOP Applied | Employee + Admin | LOP recorded (no leave balance) |
| Leave Applied | Employee (confirmation) + Admin (action needed) | Application details |
| Leave Approved | Employee | Approval with dates |
| Leave Rejected | Employee | Rejection with reason |
| Exception Requested | Admin | New exception to review |
| Exception Approved | Employee | Approval with notes |
| Exception Rejected | Employee | Rejection with reason |
| Daily Admin Summary | All Admins | Daily attendance stats |

### 12.2 Email Service Configuration

```typescript
// lib/email/index.ts
import nodemailer from 'nodemailer';
import { render } from '@react-email/render';

const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST,        // e.g., smtp.gmail.com
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmail({
  to,
  subject,
  template,
  data,
}: EmailOptions) {
  const html = await render(template(data));
  const text = await render(template(data), { plainText: true });
  
  try {
    await transporter.sendMail({
      from: `"ForceFriction AI HR" <${process.env.SMTP_FROM}>`,
      to,
      subject,
      html,
      text,
    });
    // Log success to email_logs table
  } catch (error) {
    // Log failure to email_logs table
    console.error('Email send failed:', error);
  }
}
```

### 12.3 Email Templates (React Email)

Templates located in `emails/` directory:

```typescript
// emails/ClockInReminder.tsx
import { Html, Body, Heading, Text, Button } from '@react-email/components';

export function ClockInReminderEmail({ name, date, clockInUrl }: Props) {
  return (
    <Html>
      <Body style={{ fontFamily: 'sans-serif' }}>
        <Heading>Good Morning, {name}!</Heading>
        <Text>You haven't clocked in yet for {date}.</Text>
        <Button href={clockInUrl} style={{ backgroundColor: '#007bff', color: '#fff', padding: '12px 24px' }}>
          Clock In Now
        </Button>
        <Text style={{ fontSize: '12px', color: '#666' }}>
          If the button doesn't work, copy this link: {clockInUrl}
        </Text>
      </Body>
    </Html>
  );
}
```

---

## 13. Report Generation (CSV & PDF)

### 13.1 Report Types & Formats

| Report | CSV Fields | PDF Sections |
|--------|-----------|--------------|
| **Attendance** | Employee, Date, Clock In, Clock Out, Hours, Status | Summary stats, Detailed table, Charts |
| **Leave** | Employee, Leave Type, Days, Status, Approved By | Balance summary, Usage breakdown, Calendar view |
| **Productivity** | Employee, Project, Task, Hours, Date | Hours by project, Employee ranking, Task breakdown |
| **Exceptions** | Employee, Date, Type, Status, Reviewed By | Pending vs resolved, Trends over time |

### 13.2 CSV Export

```typescript
// lib/reports/csv.ts
import { Parser } from 'json2csv';

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

// API Route
// GET /api/admin/reports/attendance?format=csv&startDate=...&endDate=...
```

### 13.3 PDF Generation

```typescript
// lib/reports/pdf.ts
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function generateAttendancePDF(data: ReportData): Buffer {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.text('Attendance Report', 14, 20);
  doc.setFontSize(12);
  doc.text(`ForceFriction AI - ${data.period}`, 14, 30);
  
  // Summary stats
  doc.setFontSize(14);
  doc.text('Summary', 14, 45);
  doc.setFontSize(10);
  doc.text(`Total Employees: ${data.summary.totalEmployees}`, 14, 55);
  doc.text(`Present Days: ${data.summary.presentDays}`, 14, 62);
  doc.text(`Late Arrivals: ${data.summary.lateDays}`, 14, 69);
  doc.text(`Half Days: ${data.summary.halfDays}`, 14, 76);
  doc.text(`Unaccounted: ${data.summary.unaccountedDays}`, 14, 83);
  
  // Data table
  autoTable(doc, {
    startY: 95,
    head: [['Employee', 'Date', 'Clock In', 'Clock Out', 'Hours', 'Status']],
    body: data.records.map(r => [
      r.employee_name,
      r.date,
      r.clock_in || '-',
      r.clock_out || '-',
      r.total_hours?.toString() || '-',
      r.status,
    ]),
    theme: 'striped',
    headStyles: { fillColor: [0, 123, 255] },
  });
  
  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.text(
      `Page ${i} of ${pageCount} - Generated on ${new Date().toLocaleString()}`,
      14,
      doc.internal.pageSize.height - 10
    );
  }
  
  return Buffer.from(doc.output('arraybuffer'));
}

// API Route
// GET /api/admin/reports/attendance?format=pdf&startDate=...&endDate=...
```

---

## 14. Self-Hosting Deployment Guide (Docker + DigitalOcean)

### 14.1 System Requirements

- **OS**: Linux (Ubuntu 22.04 LTS recommended) / Windows Server
- **Node.js**: v20 LTS or higher
- **Memory**: 2GB RAM minimum
- **Storage**: 10GB SSD minimum
- **Network**: Static IP or domain name

### 14.2 Environment Variables

Create `.env.local` file:

```bash
# Database
DATABASE_URL="file:./hr-portal.db"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"  # Generate with: openssl rand -base64 32

# SMTP Configuration (for email notifications)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="hr@forcefriction.ai"

# App Settings
COMPANY_NAME="ForceFriction AI"
ADMIN_DEFAULT_EMAIL="admin@forcefriction.ai"
ADMIN_DEFAULT_PASSWORD="change-me-on-first-login"

# Cron Job Secret (protect cron endpoints)
CRON_SECRET="your-cron-secret-here"
```

### 14.3 Installation Steps

```bash
# 1. Clone repository
git clone <repo-url> hr-portal
cd hr-portal

# 2. Install dependencies
npm install

# 3. Setup database
npm run db:migrate
npm run db:seed

# 4. Build application
npm run build

# 5. Start application
npm start
```

### 14.4 Production Deployment with PM2

```bash
# Install PM2 globally
npm install -g pm2

# Create PM2 config (ecosystem.config.js)
module.exports = {
  apps: [{
    name: 'hr-portal',
    script: 'npm',
    args: 'start',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    // Cron jobs run within the app using node-cron
  }],
};

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 14.5 Reverse Proxy with Nginx

```nginx
# /etc/nginx/sites-available/hr-portal
server {
    listen 80;
    server_name hr.forcefriction.ai;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name hr.forcefriction.ai;
    
    # SSL certificates (use Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/hr.forcefriction.ai/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hr.forcefriction.ai/privkey.pem;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Proxy to Next.js app
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Static files caching
    location /_next/static {
        proxy_pass http://localhost:3000/_next/static;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 14.6 SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d hr.forcefriction.ai

# Auto-renewal test
sudo certbot renew --dry-run
```

### 14.7 Backup Strategy

```bash
# Create backup script (scripts/backup.sh)
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/hr-portal"
DB_FILE="/var/www/hr-portal/hr-portal.db"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
sqlite3 $DB_FILE ".backup '$BACKUP_DIR/db_$DATE.backup'"

# Compress backup
gzip $BACKUP_DIR/db_$DATE.backup

# Keep only last 30 backups
ls -t $BACKUP_DIR/*.gz | tail -n +31 | xargs rm -f

# Optional: Upload to cloud storage (AWS S3, etc.)
# aws s3 cp $BACKUP_DIR/db_$DATE.backup.gz s3://your-bucket/backups/
```

Add to crontab:
```bash
# Daily backup at 2 AM
0 2 * * * /var/www/hr-portal/scripts/backup.sh >> /var/log/hr-portal-backup.log 2>&1
```

### 14.8 Update/Deployment Script

```bash
#!/bin/bash
# scripts/deploy.sh

cd /var/www/hr-portal

# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Run migrations
npm run db:migrate

# Build application
npm run build

# Restart PM2
pm2 restart hr-portal

echo "Deployment complete at $(date)"
```

---

## 17. Updated Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Database | SQLite (via `better-sqlite3`) |
| ORM | Custom lightweight ORM |
| Auth | NextAuth.js (Credentials + Session) |
| State | React Context + Server Actions |
| Charts | Recharts |
| UI Components | shadcn/ui |
| Icons | Lucide React |
| **Email** | **Nodemailer + React Email** |
| **PDF Generation** | **jsPDF + jspdf-autotable** |
| **Cron Jobs** | **node-cron** |
| **CSV Export** | **json2csv** |

---

## 18. Updated Package Dependencies

```json
{
  "dependencies": {
    "next": "16.1.6",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "next-auth": "^5.0.0-beta.15",
    "better-sqlite3": "^9.4.3",
    "bcryptjs": "^2.4.3",
    "node-cron": "^3.0.3",
    "nodemailer": "^6.9.11",
    "@react-email/components": "^0.0.15",
    "@react-email/render": "^0.0.12",
    "jspdf": "^2.5.1",
    "jspdf-autotable": "^3.8.2",
    "json2csv": "^6.0.0",
    "zod": "^3.22.4",
    "date-fns": "^3.3.1",
    "recharts": "^2.12.0",
    "lucide-react": "^0.344.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.1"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/node-cron": "^3.0.11",
    "@types/nodemailer": "^6.4.14",
    "@types/json2csv": "^5.0.7"
  }
}
```

---

## 19. Final Checklist

### Pre-Development
- [ ] Review and approve plan
- [ ] Set up development environment
- [ ] Initialize shadcn/ui components

### Phase Completion
- [ ] Phase 1: Foundation
- [ ] Phase 2: Core Time Tracking
- [ ] Phase 3: Leave Management
- [ ] Phase 4: Automation & Rules
- [ ] Phase 5: Task Logging
- [ ] Phase 6: Admin Panel
- [ ] Phase 7: Reporting, Email & PDF
- [ ] Phase 8: Testing & Deployment

### Production Readiness
- [ ] Environment variables configured
- [ ] SMTP email tested
- [ ] Backup automation working
- [ ] SSL certificate installed
- [ ] Admin account created
- [ ] Initial leave balances set
- [ ] Employee data imported
- [ ] Projects configured for task logging

---

*Document Version: 1.1*
*Updated: 2026-03-05*
*For: ForceFriction AI*


### 14.1 Docker Configuration

#### Dockerfile

```dockerfile
# Dockerfile
FROM node:20-alpine AS base

# Install dependencies for SQLite
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=base /app/node_modules ./node_modules
COPY . .

# Generate Prisma client (if using) or setup DB
RUN npm run db:generate || true

# Build the application
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Create directory for database (persistent storage)
RUN mkdir -p /app/data
RUN chown nextjs:nodejs /app/data

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy database initialization scripts
COPY --from=builder /app/lib/db ./lib/db

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Database path for persistent storage
ENV DATABASE_URL="file:./data/hr-portal.db"

CMD ["node", "server.js"]
```

#### docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: hr-portal
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=file:./data/hr-portal.db
      - NEXTAUTH_URL=${NEXTAUTH_URL}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - SMTP_HOST=${SMTP_HOST}
      - SMTP_PORT=${SMTP_PORT}
      - SMTP_USER=${SMTP_USER}
      - SMTP_PASS=${SMTP_PASS}
      - SMTP_FROM=${SMTP_FROM}
      - CRON_SECRET=${CRON_SECRET}
      - COMPANY_NAME=${COMPANY_NAME}
    volumes:
      # Persistent storage for SQLite database
      - ./data:/app/data
      # Backup directory
      - ./backups:/app/backups
    networks:
      - hr-portal-network
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Optional: Nginx reverse proxy
  nginx:
    image: nginx:alpine
    container_name: hr-portal-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
    depends_on:
      - app
    networks:
      - hr-portal-network
    command: "/bin/sh -c 'while :; do sleep 6h & wait $${!}; nginx -s reload; done & nginx -g \"daemon off;\"'"

  # Optional: Certbot for SSL
  certbot:
    image: certbot/certbot
    container_name: hr-portal-certbot
    restart: unless-stopped
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
    networks:
      - hr-portal-network

networks:
  hr-portal-network:
    driver: bridge

volumes:
  data:
  backups:
```

#### .dockerignore

```
# .dockerignore
node_modules
npm-debug.log
.next
.git
.env.local
.env
.env.*
*.md
!.env.example
data/
backups/
certbot/
```

### 14.2 DigitalOcean Deployment

#### Option 1: DigitalOcean App Platform (Easiest)

```yaml
# .do/app.yaml
name: hr-portal
services:
  - name: app
    source_dir: /
    github:
      repo: your-username/hr-portal
      branch: main
      deploy_on_push: true
    build_command: npm run build
    run_command: npm start
    environment_slug: node-js
    instance_count: 1
    instance_size_slug: basic-xs
    envs:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        value: ${db.DATABASE_URL}
      - key: NEXTAUTH_SECRET
        value: ${NEXTAUTH_SECRET}
        type: SECRET
      - key: NEXTAUTH_URL
        value: ${APP_URL}
      - key: SMTP_HOST
        value: ${SMTP_HOST}
      - key: SMTP_PASS
        value: ${SMTP_PASS}
        type: SECRET
    
databases:
  - name: db
    engine: PG  # Use Postgres instead of SQLite for App Platform
    version: "15"
    size: db-s-dev-database
    num_nodes: 1
```

**Note**: For App Platform, switch to PostgreSQL instead of SQLite since filesystem is ephemeral.

#### Option 2: DigitalOcean Droplet (Recommended for Full Control)

##### Step 1: Create Droplet

```bash
# Recommended specs for ~20 users:
# - OS: Ubuntu 22.04 (LTS) x64
# - Plan: Basic (Regular Intel/AMD with SSD)
# - CPU Options: Premium AMD/Intel
# - Size: $12/month (1 GB RAM / 1 vCPU / 25 GB SSD)
# - Datacenter: Closest to your location
# - Authentication: SSH keys (recommended) or Password
```

##### Step 2: Server Setup Script

```bash
#!/bin/bash
# scripts/droplet-setup.sh

# Run on your DigitalOcean Droplet

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
sudo apt install apt-transport-https ca-certificates curl software-properties-common -y
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu focal stable"
sudo apt update
sudo apt install docker-ce -y

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker ${USER}

# Install Git
sudo apt install git -y

# Create app directory
mkdir -p /var/www/hr-portal
cd /var/www/hr-portal

# Setup firewall (UFW)
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

echo "Server setup complete!"
echo "Please log out and log back in for docker permissions to take effect."
```

##### Step 3: Deploy Script

```bash
#!/bin/bash
# scripts/deploy-droplet.sh

APP_DIR="/var/www/hr-portal"
REPO_URL="git@github.com:your-username/hr-portal.git"

# Create app directory if not exists
sudo mkdir -p $APP_DIR
sudo chown $USER:$USER $APP_DIR

# Clone repository if not exists
if [ ! -d "$APP_DIR/.git" ]; then
    git clone $REPO_URL $APP_DIR
fi

cd $APP_DIR

# Pull latest changes
git pull origin main

# Create environment file if not exists
if [ ! -f ".env" ]; then
    cat > .env << 'EOF'
NODE_ENV=production
NEXTAUTH_URL=https://hr.yourdomain.com
NEXTAUTH_SECRET=change-me-in-production
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=hr@yourdomain.com
CRON_SECRET=change-me-in-production
COMPANY_NAME=ForceFriction AI
EOF
    echo "Created .env file. Please edit it with your actual values!"
    exit 1
fi

# Create necessary directories
mkdir -p data backups certbot/conf certbot/www

# Build and start containers
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Clean up old images
docker image prune -f

# Show status
docker-compose ps

echo "Deployment complete!"
echo "App running at: http://$(curl -s ifconfig.me):3000"
```

##### Step 4: Initial SSL Setup

```bash
#!/bin/bash
# scripts/setup-ssl.sh

DOMAIN="hr.yourdomain.com"
EMAIL="admin@yourdomain.com"

# Create certbot directories
mkdir -p certbot/conf certbot/www

# Get initial certificate
docker-compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN

# Reload nginx
docker-compose exec nginx nginx -s reload

echo "SSL certificate installed for $DOMAIN"
```

### 14.3 Database Backup in Docker

```bash
#!/bin/bash
# scripts/docker-backup.sh

BACKUP_DIR="/var/www/hr-portal/backups"
DATE=$(date +%Y%m%d_%H%M%S)
CONTAINER_NAME="hr-portal"

# Create backup
mkdir -p $BACKUP_DIR
docker exec $CONTAINER_NAME sqlite3 /app/data/hr-portal.db ".backup '/app/backups/db_$DATE.backup'"

# Copy from container to host
docker cp $CONTAINER_NAME:/app/backups/db_$DATE.backup $BACKUP_DIR/

# Compress
gzip $BACKUP_DIR/db_$DATE.backup

# Keep only last 30 backups
ls -t $BACKUP_DIR/*.gz | tail -n +31 | xargs rm -f

# Optional: Upload to DigitalOcean Spaces
# s3cmd put $BACKUP_DIR/db_$DATE.backup.gz s3://your-backup-bucket/hr-portal/

echo "Backup completed: db_$DATE.backup.gz"
```

Add to crontab on host:
```bash
# Edit crontab
sudo crontab -e

# Add daily backup at 2 AM
0 2 * * * /var/www/hr-portal/scripts/docker-backup.sh >> /var/log/hr-portal-backup.log 2>&1
```

### 14.4 DigitalOcean Monitoring

```yaml
# docker-compose.monitoring.yml (optional)
version: '3.8'

services:
  # Prometheus for metrics
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    networks:
      - hr-portal-network

  # Grafana for dashboards
  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    restart: unless-stopped
    ports:
      - "3001:3000"
    volumes:
      - grafana-data:/var/lib/grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
    networks:
      - hr-portal-network

  # Node exporter for system metrics
  node-exporter:
    image: prom/node-exporter:latest
    container_name: node-exporter
    restart: unless-stopped
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.rootfs=/rootfs'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    networks:
      - hr-portal-network

volumes:
  prometheus-data:
  grafana-data:

networks:
  hr-portal-network:
    external: true
```

### 14.5 CI/CD with GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to DigitalOcean

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup SSH
        uses: webfactory/ssh-agent@v0.8.0
        with:
          ssh-private-key: ${{ secrets.DROPLET_SSH_KEY }}
      
      - name: Add host to known hosts
        run: |
          mkdir -p ~/.ssh
          ssh-keyscan -H ${{ secrets.DROPLET_IP }} >> ~/.ssh/known_hosts
      
      - name: Deploy to Droplet
        run: |
          ssh root@${{ secrets.DROPLET_IP }} '
            cd /var/www/hr-portal &&
            git pull origin main &&
            docker-compose down &&
            docker-compose build --no-cache &&
            docker-compose up -d &&
            docker image prune -f
          '
      
      - name: Notify on success
        if: success()
        run: echo "Deployment successful!"
      
      - name: Notify on failure
        if: failure()
        run: echo "Deployment failed!"
```

### 14.6 Environment Variables for DigitalOcean

```bash
# .env (on production server)
NODE_ENV=production

# Database (SQLite in Docker volume)
DATABASE_URL=file:./data/hr-portal.db

# NextAuth
NEXTAUTH_URL=https://hr.forcefriction.ai
NEXTAUTH_SECRET=your-secure-secret-key-here

# SMTP (Gmail example)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=hr@forcefriction.ai
SMTP_PASS=your-gmail-app-password
SMTP_FROM=hr@forcefriction.ai

# Security
CRON_SECRET=your-cron-secret-here

# Company
COMPANY_NAME=ForceFriction AI

# DigitalOcean Spaces (optional, for backups)
DO_SPACES_KEY=your-spaces-key
DO_SPACES_SECRET=your-spaces-secret
DO_SPACES_BUCKET=hr-portal-backups
DO_SPACES_REGION=nyc3
```

### 14.7 Docker Commands Reference

```bash
# Build and start
sudo docker-compose up -d --build

# View logs
sudo docker-compose logs -f app

# View all logs
sudo docker-compose logs -f

# Restart service
sudo docker-compose restart app

# Stop all
sudo docker-compose down

# Update (pull, rebuild, restart)
sudo docker-compose pull
sudo docker-compose up -d --build

# Database shell access
sudo docker-compose exec app sqlite3 /app/data/hr-portal.db

# Backup database
sudo docker-compose exec app sqlite3 /app/data/hr-portal.db ".backup '/app/backups/backup.db'"

# Restore database
sudo docker cp ./backup.db hr-portal:/app/data/hr-portal.db

# Check container health
sudo docker-compose ps
sudo docker-compose exec app wget --no-verbose --tries=1 --spider http://localhost:3000/api/health
```

### 14.8 Next.js Configuration for Docker

```typescript
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone', // Required for Docker
  experimental: {
    // Enable if using App Router with server components
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
  // Disable image optimization (or configure external loader)
  images: {
    unoptimized: true,
  },
  // Environment variables available at build time
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
};

export default nextConfig;
```

---

## 20. DigitalOcean Deployment Checklist

### Pre-Deployment
- [ ] Create DigitalOcean account
- [ ] Add payment method
- [ ] Create Droplet ($12/month plan recommended)
- [ ] Configure DNS (A record pointing to Droplet IP)
- [ ] Generate SSH key pair
- [ ] Add SSH key to DigitalOcean

### Server Setup
- [ ] Connect to Droplet via SSH
- [ ] Run droplet-setup.sh
- [ ] Clone repository
- [ ] Create .env file with production values
- [ ] Configure firewall (UFW)

### Application Deployment
- [ ] Build Docker images
- [ ] Start containers
- [ ] Test application at http://DROPLET_IP:3000
- [ ] Setup SSL with Certbot
- [ ] Test HTTPS at https://yourdomain.com

### Post-Deployment
- [ ] Create admin user
- [ ] Add employees
- [ ] Configure leave policies
- [ ] Test email notifications
- [ ] Setup automated backups
- [ ] Configure CI/CD pipeline (optional)
- [ ] Setup monitoring (optional)

### Maintenance
- [ ] Weekly: Check logs and disk space
- [ ] Monthly: Update system packages
- [ ] Monthly: Review and test backups
- [ ] Quarterly: SSL certificate renewal check

