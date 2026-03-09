import nodemailer from 'nodemailer';
import { getDb } from '@/lib/db';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Create transporter
function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  
  if (!host || !user || !pass) {
    console.warn('Email configuration missing. Email notifications will be logged only.');
    return null;
  }
  
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

export async function sendEmail({ to, subject, html, text }: EmailOptions): Promise<boolean> {
  const transporter = createTransport();
  const from = process.env.SMTP_FROM || 'hr@forcefriction.ai';
  const companyName = process.env.COMPANY_NAME || 'ForceFriction AI';
  
  try {
    if (transporter) {
      await transporter.sendMail({
        from: `"${companyName} HR" <${from}>`,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''),
      });
      
      console.log(`[Email] Sent to ${to}: ${subject}`);
    } else {
      // Log email for development
      console.log('[Email] Would send:', { to, subject, html: html.substring(0, 200) });
    }
    
    return true;
  } catch (error) {
    console.error('Email send failed:', error);
    return false;
  }
}

// Email Templates
export function getClockInReminderEmail(name: string, date: string, clockInUrl: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Good Morning, ${name}!</h2>
      <p>You haven't clocked in yet for <strong>${date}</strong>.</p>
      <div style="margin: 30px 0;">
        <a href="${clockInUrl}" 
           style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Clock In Now
        </a>
      </div>
      <p style="color: #666; font-size: 12px;">
        If the button doesn't work, copy this link: ${clockInUrl}
      </p>
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      <p style="color: #999; font-size: 12px;">
        This is an automated reminder from ForceFriction AI HR Portal.
      </p>
    </div>
  `;
}

export function getClockOutReminderEmail(name: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Hi ${name},</h2>
      <p>You are still clocked in. Don't forget to:</p>
      <ul>
        <li>Log your tasks for today</li>
        <li>Clock out before you leave</li>
      </ul>
      <div style="margin: 30px 0;">
        <a href="${process.env.NEXTAUTH_URL}/tasks/log" 
           style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Log Tasks
        </a>
      </div>
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      <p style="color: #999; font-size: 12px;">
        This is an automated reminder from ForceFriction AI HR Portal.
      </p>
    </div>
  `;
}

export function getLeaveStatusEmail(
  name: string, 
  status: 'approved' | 'rejected', 
  startDate: string, 
  endDate: string,
  days: number,
  reason?: string
): string {
  const isApproved = status === 'approved';
  const color = isApproved ? '#28a745' : '#dc3545';
  const title = isApproved ? 'Leave Request Approved' : 'Leave Request Rejected';
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${color};">${title}</h2>
      <p>Hi ${name},</p>
      <p>Your leave request has been <strong style="color: ${color};">${status}</strong>.</p>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Period:</strong> ${startDate} to ${endDate}</p>
        <p><strong>Duration:</strong> ${days} day${days > 1 ? 's' : ''}</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
      </div>
      
      ${isApproved 
        ? '<p>Enjoy your time off!</p>' 
        : '<p>If you have any questions, please contact your manager.</p>'
      }
      
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      <p style="color: #999; font-size: 12px;">
        This is an automated notification from ForceFriction AI HR Portal.
      </p>
    </div>
  `;
}

export function getAttendanceIssueEmail(
  name: string,
  issue: string,
  date: string,
  deduction?: string
): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc3545;">Attendance Issue Detected</h2>
      <p>Hi ${name},</p>
      <p>We noticed an issue with your attendance:</p>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Date:</strong> ${date}</p>
        <p><strong>Issue:</strong> ${issue}</p>
        ${deduction ? `<p><strong>Action:</strong> ${deduction}</p>` : ''}
      </div>
      
      <p>If you believe this is an error, you can request an attendance exception:</p>
      <div style="margin: 30px 0;">
        <a href="${process.env.NEXTAUTH_URL}/attendance/exceptions/new" 
           style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Request Exception
        </a>
      </div>
      
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      <p style="color: #999; font-size: 12px;">
        This is an automated notification from ForceFriction AI HR Portal.
      </p>
    </div>
  `;
}

export function getAdminNotificationEmail(
  title: string,
  message: string,
  actionUrl?: string,
  actionText?: string
): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">${title}</h2>
      <p>${message}</p>
      
      ${actionUrl && actionText ? `
        <div style="margin: 30px 0;">
          <a href="${actionUrl}" 
             style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            ${actionText}
          </a>
        </div>
      ` : ''}
      
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      <p style="color: #999; font-size: 12px;">
        This is an automated notification from ForceFriction AI HR Portal.
      </p>
    </div>
  `;
}

// Log email to database
export async function logEmail(
  userId: number,
  emailType: string,
  subject: string,
  status: 'sent' | 'failed',
  errorMessage?: string
): Promise<void> {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO email_logs (user_id, email_type, subject, status, error_message)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, emailType, subject, status, errorMessage || null);
  } catch (error) {
    console.error('Failed to log email:', error);
  }
}
