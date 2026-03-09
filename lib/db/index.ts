import Database from 'better-sqlite3';
import { join } from 'path';

const dbPath = process.env.DATABASE_URL?.replace('file:', '') || join(process.cwd(), 'data', 'hr-portal.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// Initialize database with schema
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
      logo_url TEXT
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
}
