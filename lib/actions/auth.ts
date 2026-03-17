'use server';

import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function createUser(data: {
  email: string;
  name: string;
  password: string;
  role: 'employee' | 'admin';
  department?: string;
  joining_date: string;
}) {
  const db = getDb();
  
  // Check if email already exists (case-insensitive)
  const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(data.email);
  if (existing) {
    return { error: 'Email already exists' };
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  
  const result = db.prepare(`
    INSERT INTO users (email, name, role, password_hash, department, joining_date, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(data.email, data.name, data.role, passwordHash, data.department || null, data.joining_date);
  
  // Create leave balance for the current year
  const currentYear = new Date().getFullYear();
  db.prepare(`
    INSERT INTO leave_balances (user_id, year, total_leaves, used_leaves, lop_days)
    VALUES (?, ?, 20, 0, 0)
  `).run(result.lastInsertRowid, currentYear);
  
  revalidatePath('/admin/employees');
  return { success: true, userId: result.lastInsertRowid };
}

export async function updateUser(userId: number, data: {
  name?: string;
  email?: string;
  department?: string;
  is_active?: boolean;
}) {
  const db = getDb();
  
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  
  if (data.name !== undefined) {
    fields.push('name = ?');
    values.push(data.name);
  }
  if (data.email !== undefined) {
    fields.push('email = ?');
    values.push(data.email);
  }
  if (data.department !== undefined) {
    fields.push('department = ?');
    values.push(data.department);
  }
  if (data.is_active !== undefined) {
    fields.push('is_active = ?');
    values.push(data.is_active ? 1 : 0);
  }
  
  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(userId);
  
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  
  revalidatePath('/admin/employees');
  return { success: true };
}

export async function resetPassword(userId: number, newPassword: string) {
  const db = getDb();
  const passwordHash = await bcrypt.hash(newPassword, 10);
  
  db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(passwordHash, userId);
  
  return { success: true };
}
