# ForceFriction AI - HR Portal

A comprehensive HR management system with time tracking, leave management, and productivity reporting.

## Features

### For Employees
- ✅ Clock In/Out with grace period tracking
- ✅ Attendance history and calendar view
- ✅ Leave application and balance tracking
- ✅ Task logging by project
- ✅ Exception requests for attendance issues

### For Admins
- ✅ Employee management (add, edit, deactivate)
- ✅ Leave approval workflow
- ✅ Attendance exception review
- ✅ System settings configuration
- ✅ PDF & CSV report generation
- ✅ Audit logs for all activities

### Automation
- ✅ Auto clock-out at 6:00 PM
- ✅ Grace period enforcement (15 min)
- ✅ Automatic leave deduction for unaccounted attendance
- ✅ LOP (Loss of Pay) handling
- ✅ Email notifications
- ✅ Daily attendance processing

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: SQLite (better-sqlite3)
- **Auth**: NextAuth.js
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **PDF**: jsPDF + jspdf-autotable
- **Email**: Nodemailer
- **Deployment**: Docker + DigitalOcean

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Setup database
npm run db:init

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

Default credentials:
- Admin: `admin@forcefriction.ai` / `admin123`
- Employee: `john@forcefriction.ai` / `password123`

### Production Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.

Quick deploy to DigitalOcean:
```bash
# 1. Setup server
ssh root@DROPLET_IP
./scripts/droplet-setup.sh

# 2. Deploy application
./scripts/deploy.sh

# 3. Setup SSL
./scripts/setup-ssl.sh yourdomain.com admin@yourdomain.com
```

## Project Structure

```
app/
├── (auth)/login/           # Authentication
├── (dashboard)/            # Protected routes
│   ├── admin/              # Admin panel
│   ├── attendance/         # Attendance tracking
│   ├── leave/              # Leave management
│   ├── tasks/              # Task logging
│   └── page.tsx            # Employee dashboard
├── api/                    # API routes
components/                 # UI components
lib/
├── actions/                # Server actions
├── db/                     # Database & schema
├── email/                  # Email service
├── jobs/                   # Background jobs
└── reports/                # PDF/CSV generation
```

## Database Schema

- `users` - Employees & admins
- `leave_balances` - Annual leave tracking
- `attendance` - Daily clock in/out
- `task_logs` - Project task entries
- `leave_applications` - Leave requests
- `attendance_exceptions` - Correction requests
- `audit_logs` - Activity tracking
- `notifications` - User notifications

## Business Rules

| Scenario | Action |
|----------|--------|
| No clock in | Unaccounted → Deduct 1 leave |
| < 4 hours worked | Unaccounted → Deduct 1 leave |
| 4-8 hours worked | Half Day → Deduct 0.5 leave |
| 8+ hours worked | Normal → No deduction |
| Clock in after grace period | Mark as Late |
| Leave approved | Deduct from balance |
| Insufficient balance | Mark as LOP |

## Cron Jobs

| Job | Schedule | Endpoint |
|-----|----------|----------|
| Auto Clock-Out | 6:05 PM daily | `/api/cron/auto-clockout` |
| Daily Processing | 11:55 PM daily | `/api/cron/process-attendance` |

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
DATABASE_URL=file:./data/hr-portal.db
```

## License

Private - ForceFriction AI
