import { getDb } from './index';
import bcrypt from 'bcryptjs';

export async function seedDatabase(): Promise<void> {
  const db = getDb();
  
  // Check if admin already exists
  const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@forcefriction.ai');
  if (existingAdmin) {
    console.log('Admin user already exists, skipping seed');
    return;
  }
  
  const passwordHash = await bcrypt.hash('admin123', 10);
  
  // Create admin user
  const adminResult = db.prepare(`
    INSERT INTO users (email, name, role, password_hash, department, joining_date, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('admin@forcefriction.ai', 'System Administrator', 'admin', passwordHash, 'HR', '2024-01-01', 1);
  
  const adminId = adminResult.lastInsertRowid;
  
  // Create leave balance for admin
  const currentYear = new Date().getFullYear();
  db.prepare(`
    INSERT INTO leave_balances (user_id, year, total_leaves, used_leaves, lop_days)
    VALUES (?, ?, ?, ?, ?)
  `).run(adminId, currentYear, 20, 0, 0);
  
  // Create sample employees
  const employees = [
    { email: 'john@forcefriction.ai', name: 'John Doe', dept: 'Engineering', joining: '2024-02-01' },
    { email: 'jane@forcefriction.ai', name: 'Jane Smith', dept: 'Design', joining: '2024-02-15' },
    { email: 'mike@forcefriction.ai', name: 'Mike Johnson', dept: 'Engineering', joining: '2024-03-01' },
  ];
  
  for (const emp of employees) {
    const empPassword = await bcrypt.hash('password123', 10);
    const empResult = db.prepare(`
      INSERT INTO users (email, name, role, password_hash, department, joining_date, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(emp.email, emp.name, 'employee', empPassword, emp.dept, emp.joining, 1);
    
    // Create leave balance for employee
    db.prepare(`
      INSERT INTO leave_balances (user_id, year, total_leaves, used_leaves, lop_days)
      VALUES (?, ?, ?, ?, ?)
    `).run(empResult.lastInsertRowid, currentYear, 20, 0, 0);
  }
  
  console.log('Database seeded successfully');
  console.log('Admin: admin@forcefriction.ai / admin123');
  console.log('Employees: [email]@forcefriction.ai / password123');
}
