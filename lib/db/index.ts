import Database from 'better-sqlite3';
import { join } from 'path';
import bcrypt from 'bcryptjs';

const dbPath = process.env.DATABASE_URL?.replace('file:', '') || join(process.cwd(), 'data', 'hr-portal.db');

let db: Database.Database | null = null;
let initialized = false;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    
    // Initialize database on first connection
    if (!initialized) {
      initDb();
      runMigrations();
      initialized = true;
    }
  }
  return db;
}

// Initialize database with schema and seed data
export function initDb(): void {
  const database = getDb();
  
  // Users table
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
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
    )
  `);

  // Leave balances table
  database.exec(`
    CREATE TABLE IF NOT EXISTS leave_balances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      total_leaves REAL DEFAULT 7.0,
      used_leaves REAL DEFAULT 0.0,
      remaining_leaves REAL GENERATED ALWAYS AS (total_leaves - used_leaves) STORED,
      lop_days REAL DEFAULT 0.0,
      UNIQUE(user_id, year),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Attendance table
  database.exec(`
    CREATE TABLE IF NOT EXISTS attendance (
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
      status TEXT CHECK(status IN ('present', 'late', 'half_day', 'unaccounted', 'on_leave', 'lop', 'pending')) DEFAULT 'pending',
      is_auto_clockout BOOLEAN DEFAULT 0,
      grace_period_used BOOLEAN DEFAULT 0,
      UNIQUE(user_id, date),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Task logs table
  database.exec(`
    CREATE TABLE IF NOT EXISTS task_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date DATE NOT NULL,
      project_name TEXT NOT NULL,
      task_description TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      hours_spent REAL GENERATED ALWAYS AS (
        ROUND((julianday(end_time) - julianday(start_time)) * 24, 2)
      ) STORED,
      -- AI analysis fields for employee-logged tasks
      work_summary TEXT,
      task_objective TEXT,
      final_outcome TEXT,
      scope_change TEXT CHECK(scope_change IN ('No change', 'Minor change', 'Moderate change', 'Major change')),
      output_type TEXT,
      output_description TEXT,
      difficulty_level TEXT CHECK(difficulty_level IN ('Very Easy', 'Easy', 'Moderate', 'Difficult', 'Very Difficult')),
      confidence_level TEXT CHECK(confidence_level IN ('Very confident', 'Confident', 'Somewhat confident', 'Not confident')),
      ai_analyzed BOOLEAN DEFAULT 0,
      ai_score INTEGER,
      ai_decision TEXT CHECK(ai_decision IN ('approved', 'needs_review', 'rejected')),
      ai_analysis_summary TEXT,
      ai_analyzed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Leave applications table
  database.exec(`
    CREATE TABLE IF NOT EXISTS leave_applications (
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
    )
  `);

  // Attendance exceptions table
  database.exec(`
    CREATE TABLE IF NOT EXISTS attendance_exceptions (
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
    )
  `);

  // System config table
  database.exec(`
    CREATE TABLE IF NOT EXISTS system_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      shift_start_time TEXT DEFAULT '09:00',
      grace_period_minutes INTEGER DEFAULT 15,
      auto_clockout_time TEXT DEFAULT '18:00',
      min_work_hours REAL DEFAULT 8.0,
      half_day_threshold REAL DEFAULT 4.0,
      working_days TEXT DEFAULT '1,2,3,4,5',
      company_name TEXT DEFAULT 'ForceFriction AI',
      logo_url TEXT,
      smtp_host TEXT,
      smtp_port INTEGER DEFAULT 587,
      smtp_user TEXT,
      smtp_pass TEXT,
      smtp_from TEXT,
      email_notifications_enabled BOOLEAN DEFAULT 0
    )
  `);

  // Audit logs table
  database.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
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
    )
  `);

  // Notifications table
  database.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read BOOLEAN DEFAULT 0,
      link TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Email logs table
  database.exec(`
    CREATE TABLE IF NOT EXISTS email_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      email_type TEXT NOT NULL,
      subject TEXT NOT NULL,
      status TEXT CHECK(status IN ('sent', 'failed')) NOT NULL,
      error_message TEXT,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Projects table for task logging
  database.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT 1,
      is_internal BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert default projects if none exist
  const existingProjects = database.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number };
  if (existingProjects.count === 0) {
    const defaultProjects = [
      { name: 'Internal - HR Portal', is_internal: 1, description: 'HR Portal development and maintenance' },
      { name: 'Internal - Admin Tasks', is_internal: 1, description: 'General administrative tasks' },
      { name: 'Internal - Training', is_internal: 1, description: 'Training and skill development' },
      { name: 'Internal - Meeting', is_internal: 1, description: 'Internal meetings and discussions' },
      { name: 'Client Project A', is_internal: 0, description: 'External client project A' },
      { name: 'Client Project B', is_internal: 0, description: 'External client project B' },
      { name: 'Client Project C', is_internal: 0, description: 'External client project C' },
      { name: 'Research & Development', is_internal: 1, description: 'R&D activities' },
      { name: 'Documentation', is_internal: 1, description: 'Documentation and knowledge base' },
      { name: 'Other', is_internal: 1, description: 'Other miscellaneous tasks' },
    ];
    
    const insertProject = database.prepare(`
      INSERT INTO projects (name, description, is_internal, is_active)
      VALUES (?, ?, ?, 1)
    `);
    
    for (const project of defaultProjects) {
      insertProject.run(project.name, project.description, project.is_internal);
    }
  }

  // Insert default config if not exists
  const defaultConfig = database.prepare('SELECT id FROM system_config WHERE id = 1').get();
  if (!defaultConfig) {
    database.prepare(`
      INSERT INTO system_config (id, shift_start_time, grace_period_minutes, auto_clockout_time, 
        min_work_hours, half_day_threshold, working_days, company_name)
      VALUES (1, '09:00', 15, '18:00', 8.0, 4.0, '1,2,3,4,5', 'ForceFriction AI')
    `).run();
  }

  // Seed admin user if not exists
  const existingAdmin = database.prepare('SELECT id FROM users WHERE email = ?').get('admin@forcefriction.ai');
  if (!existingAdmin) {
    const passwordHash = bcrypt.hashSync('admin123', 10);
    const adminResult = database.prepare(`
      INSERT INTO users (email, name, role, password_hash, department, joining_date, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('admin@forcefriction.ai', 'System Administrator', 'admin', passwordHash, 'HR', '2024-01-01', 1);
    
    // Create leave balance for admin
    const currentYear = new Date().getFullYear();
    database.prepare(`
      INSERT INTO leave_balances (user_id, year, total_leaves, used_leaves, lop_days)
      VALUES (?, ?, ?, ?, ?)
    `).run(adminResult.lastInsertRowid, currentYear, 20, 0, 0);
    
    console.log('Admin user created: admin@forcefriction.ai / admin123');
  }
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// Run migrations
export function runMigrations(): void {
  const database = getDb();
  
  // Create migrations tracking table
  database.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Migration: Create assigned_tasks table (for existing databases)
  database.exec(`
    CREATE TABLE IF NOT EXISTS assigned_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      assigned_to INTEGER NOT NULL,
      assigned_by INTEGER NOT NULL,
      due_date DATE,
      status TEXT CHECK(status IN ('assigned', 'in_progress', 'pending_review', 'closed', 'rejected')) DEFAULT 'assigned',
      evidence_type TEXT CHECK(evidence_type IN ('link', 'attachment', 'none')) DEFAULT 'none',
      evidence_url TEXT,
      evidence_description TEXT,
      submitted_at DATETIME,
      reviewed_by INTEGER,
      reviewed_at DATETIME,
      review_notes TEXT,
      auto_approve BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);
  
  // Migration: Create task_types table (for existing databases)
  database.exec(`
    CREATE TABLE IF NOT EXISTS task_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      auto_approve BOOLEAN DEFAULT 0,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Insert default task types if none exist
  try {
    const existingTaskTypes = database.prepare('SELECT COUNT(*) as count FROM task_types').get() as { count: number };
    if (existingTaskTypes.count === 0) {
      const defaultTaskTypes = [
        { name: 'Daily Standup', description: 'Daily team standup participation', auto_approve: 1 },
        { name: 'Documentation', description: 'Internal documentation tasks', auto_approve: 0 },
        { name: 'Client Work', description: 'Client-facing project work', auto_approve: 0 },
        { name: 'Training', description: 'Training and skill development', auto_approve: 1 },
        { name: 'Admin Tasks', description: 'Administrative tasks', auto_approve: 1 },
      ];
      
      const insertTaskType = database.prepare(`
        INSERT INTO task_types (name, description, auto_approve)
        VALUES (?, ?, ?)
      `);
      
      for (const type of defaultTaskTypes) {
        insertTaskType.run(type.name, type.description, type.auto_approve);
      }
    }
  } catch {
    // Ignore errors
  }
  
  // Add indexes for performance
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, date)',
    'CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date)',
    'CREATE INDEX IF NOT EXISTS idx_task_logs_user_date ON task_logs(user_id, date)',
    'CREATE INDEX IF NOT EXISTS idx_leave_applications_user ON leave_applications(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_leave_applications_status ON leave_applications(status)',
    'CREATE INDEX IF NOT EXISTS idx_exceptions_status ON attendance_exceptions(status)',
    'CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read)',
    'CREATE INDEX IF NOT EXISTS idx_projects_active ON projects(is_active)',
    'CREATE INDEX IF NOT EXISTS idx_assigned_tasks_assigned_to ON assigned_tasks(assigned_to, status)',
    'CREATE INDEX IF NOT EXISTS idx_assigned_tasks_status ON assigned_tasks(status)',
    'CREATE INDEX IF NOT EXISTS idx_assigned_tasks_assigned_by ON assigned_tasks(assigned_by)',
    'CREATE INDEX IF NOT EXISTS idx_task_submissions_task ON task_submissions(task_id)',
    'CREATE INDEX IF NOT EXISTS idx_task_submissions_user ON task_submissions(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_task_ai_analysis_task ON task_ai_analysis(task_id)',
    'CREATE INDEX IF NOT EXISTS idx_task_ai_analysis_user ON task_ai_analysis(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_recurring_templates_active ON recurring_task_templates(is_active)',
    'CREATE INDEX IF NOT EXISTS idx_task_picker_pool_active ON task_picker_pool(is_active)',
    'CREATE INDEX IF NOT EXISTS idx_attendance_violations_user ON attendance_violations(user_id, date)',
  ];
  
  indexes.forEach(index => {
    database.exec(index);
  });
  
  // Migration: Add logo_url column to system_config if not exists
  try {
    database.exec(`ALTER TABLE system_config ADD COLUMN logo_url TEXT`);
  } catch {
    // Column already exists, ignore error
  }

  // Migration: Create recurring_task_templates table
  database.exec(`
    CREATE TABLE IF NOT EXISTS recurring_task_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      recurrence_type TEXT CHECK(recurrence_type IN ('daily', 'weekly', 'monthly')) NOT NULL,
      due_time TEXT,
      due_day INTEGER,
      project_id INTEGER,
      assigned_to INTEGER,
      is_active BOOLEAN DEFAULT 1,
      last_assigned_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
      FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Migration: Create task_picker_pool table
  database.exec(`
    CREATE TABLE IF NOT EXISTS task_picker_pool (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      project_id INTEGER,
      estimated_hours REAL,
      difficulty_level TEXT CHECK(difficulty_level IN ('Very Easy', 'Easy', 'Moderate', 'Difficult', 'Very Difficult')),
      required_skills TEXT,
      is_active BOOLEAN DEFAULT 1,
      picked_by INTEGER,
      picked_at DATETIME,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
      FOREIGN KEY (picked_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Migration: Create task_submissions table
  database.exec(`
    CREATE TABLE IF NOT EXISTS task_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      work_summary TEXT NOT NULL,
      task_objective TEXT NOT NULL,
      final_outcome TEXT NOT NULL,
      scope_change TEXT CHECK(scope_change IN ('No change', 'Minor change', 'Moderate change', 'Major change')) NOT NULL,
      output_type TEXT CHECK(output_type IN ('Document / Report', 'Graphic / Design', 'Website Update', 'Code / Script', 'Data / Spreadsheet', 'Presentation', 'Communication (Email / Message)', 'Process / Policy Update', 'Research Findings', 'Article Preparation', 'Course Preparation', 'Other')) NOT NULL,
      output_description TEXT NOT NULL,
      time_spent TEXT CHECK(time_spent IN ('Less than 30 minutes', '30 minutes – 1 hour', '1–2 hours', '2–4 hours', '4–8 hours', '1 day')) NOT NULL,
      difficulty_level TEXT CHECK(difficulty_level IN ('Very Easy', 'Easy', 'Moderate', 'Difficult', 'Very Difficult')) NOT NULL,
      confidence_level TEXT CHECK(confidence_level IN ('Very confident', 'Confident', 'Somewhat confident', 'Not confident')) NOT NULL,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES assigned_tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Migration: Create task_ai_analysis table
  database.exec(`
    CREATE TABLE IF NOT EXISTS task_ai_analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      submission_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      score INTEGER NOT NULL,
      task_understanding INTEGER,
      work_authenticity INTEGER,
      output_validity INTEGER,
      effort_reasonableness INTEGER,
      difficulty_consistency INTEGER,
      risk_flags TEXT,
      decision TEXT CHECK(decision IN ('approved', 'needs_review', 'rejected')) NOT NULL,
      analysis_summary TEXT,
      analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      notification_sent BOOLEAN DEFAULT 0,
      FOREIGN KEY (task_id) REFERENCES assigned_tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (submission_id) REFERENCES task_submissions(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Migration: Create ai_config table
  database.exec(`
    CREATE TABLE IF NOT EXISTS ai_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      api_key TEXT,
      model_name TEXT DEFAULT 'gpt-4o-mini',
      is_enabled BOOLEAN DEFAULT 0,
      test_status TEXT,
      test_message TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: Create task_clockin_links table
  database.exec(`
    CREATE TABLE IF NOT EXISTS task_clockin_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER,
      task_log_id INTEGER,
      user_id INTEGER NOT NULL,
      date DATE NOT NULL,
      attendance_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES assigned_tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (task_log_id) REFERENCES task_logs(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (attendance_id) REFERENCES attendance(id) ON DELETE SET NULL
    )
  `);

  // Migration: Create attendance_violations table
  database.exec(`
    CREATE TABLE IF NOT EXISTS attendance_violations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date DATE NOT NULL,
      violation_type TEXT CHECK(violation_type IN ('no_task_submitted', 'task_rejected', 'hours_mismatch')) NOT NULL,
      email_count INTEGER DEFAULT 0,
      leave_deducted BOOLEAN DEFAULT 0,
      deduction_hours REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Migration: Add recurrence fields to assigned_tasks if not exists
  try {
    database.exec(`ALTER TABLE assigned_tasks ADD COLUMN recurrence_type TEXT CHECK(recurrence_type IN ('daily', 'weekly', 'monthly', 'adhoc')) DEFAULT 'adhoc'`);
  } catch {}
  try {
    database.exec(`ALTER TABLE assigned_tasks ADD COLUMN parent_template_id INTEGER`);
  } catch {}
  try {
    database.exec(`ALTER TABLE assigned_tasks ADD COLUMN project_id INTEGER`);
  } catch {}

  // Migration: Add email settings columns to system_config
  try {
    database.exec(`ALTER TABLE system_config ADD COLUMN smtp_host TEXT`);
  } catch {}
  try {
    database.exec(`ALTER TABLE system_config ADD COLUMN smtp_port INTEGER DEFAULT 587`);
  } catch {}
  try {
    database.exec(`ALTER TABLE system_config ADD COLUMN smtp_user TEXT`);
  } catch {}
  try {
    database.exec(`ALTER TABLE system_config ADD COLUMN smtp_pass TEXT`);
  } catch {}
  try {
    database.exec(`ALTER TABLE system_config ADD COLUMN smtp_from TEXT`);
  } catch {}
  try {
    database.exec(`ALTER TABLE system_config ADD COLUMN email_notifications_enabled BOOLEAN DEFAULT 0`);
  } catch {}
  try {
    database.exec(`ALTER TABLE system_config ADD COLUMN smtp_auth_method TEXT DEFAULT 'app_password' CHECK(smtp_auth_method IN ('app_password', 'oauth_google', 'oauth_microsoft'))`);
  } catch {}
  try {
    database.exec(`ALTER TABLE system_config ADD COLUMN smtp_oauth_client_id TEXT`);
  } catch {}
  try {
    database.exec(`ALTER TABLE system_config ADD COLUMN smtp_oauth_client_secret TEXT`);
  } catch {}
  try {
    database.exec(`ALTER TABLE system_config ADD COLUMN smtp_oauth_refresh_token TEXT`);
  } catch {}
  try {
    database.exec(`ALTER TABLE system_config ADD COLUMN smtp_oauth_access_token TEXT`);
  } catch {}
  try {
    database.exec(`ALTER TABLE system_config ADD COLUMN smtp_oauth_token_expiry DATETIME`);
  } catch {}
  try {
    database.exec(`ALTER TABLE system_config ADD COLUMN smtp_secure BOOLEAN DEFAULT 0`);
  } catch {}

  // Migration: Add AI analysis fields to task_logs
  try {
    database.exec(`ALTER TABLE task_logs ADD COLUMN work_summary TEXT`);
  } catch {}
  try {
    database.exec(`ALTER TABLE task_logs ADD COLUMN task_objective TEXT`);
  } catch {}
  try {
    database.exec(`ALTER TABLE task_logs ADD COLUMN final_outcome TEXT`);
  } catch {}
  try {
    database.exec(`ALTER TABLE task_logs ADD COLUMN scope_change TEXT CHECK(scope_change IN ('No change', 'Minor change', 'Moderate change', 'Major change'))`);
  } catch {}
  try {
    database.exec(`ALTER TABLE task_logs ADD COLUMN output_type TEXT`);
  } catch {}
  try {
    database.exec(`ALTER TABLE task_logs ADD COLUMN output_description TEXT`);
  } catch {}
  try {
    database.exec(`ALTER TABLE task_logs ADD COLUMN difficulty_level TEXT CHECK(difficulty_level IN ('Very Easy', 'Easy', 'Moderate', 'Difficult', 'Very Difficult'))`);
  } catch {}
  try {
    database.exec(`ALTER TABLE task_logs ADD COLUMN confidence_level TEXT CHECK(confidence_level IN ('Very confident', 'Confident', 'Somewhat confident', 'Not confident'))`);
  } catch {}
  try {
    database.exec(`ALTER TABLE task_logs ADD COLUMN ai_analyzed BOOLEAN DEFAULT 0`);
  } catch {}
  try {
    database.exec(`ALTER TABLE task_logs ADD COLUMN ai_score INTEGER`);
  } catch {}
  try {
    database.exec(`ALTER TABLE task_logs ADD COLUMN ai_decision TEXT CHECK(ai_decision IN ('approved', 'needs_review', 'rejected'))`);
  } catch {}
  try {
    database.exec(`ALTER TABLE task_logs ADD COLUMN ai_analysis_summary TEXT`);
  } catch {}
  try {
    database.exec(`ALTER TABLE task_logs ADD COLUMN ai_analyzed_at DATETIME`);
  } catch {}

  // Migration: Add indexes for task_logs AI fields
  try {
    database.exec(`CREATE INDEX IF NOT EXISTS idx_task_logs_ai_analyzed ON task_logs(ai_analyzed)`);
  } catch {}
  try {
    database.exec(`CREATE INDEX IF NOT EXISTS idx_task_logs_user_date ON task_logs(user_id, date)`);
  } catch {}
}
