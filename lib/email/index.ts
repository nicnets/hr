import nodemailer from 'nodemailer';
import { getDb } from '@/lib/db';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface EmailConfig {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string | null;
  smtp_from: string;
  smtp_auth_method: 'app_password' | 'oauth_google' | 'oauth_microsoft';
  smtp_oauth_client_id: string | null;
  smtp_oauth_client_secret: string | null;
  smtp_oauth_refresh_token: string | null;
  smtp_oauth_access_token: string | null;
  smtp_oauth_token_expiry: string | null;
  smtp_secure: number;
  email_notifications_enabled: number;
}

// Get email config from database
function getEmailConfig(): EmailConfig | null {
  try {
    const db = getDb();
    const config = db.prepare('SELECT * FROM system_config WHERE id = 1').get() as EmailConfig | undefined;
    
    if (!config || !config.email_notifications_enabled) {
      return null;
    }
    
    return config;
  } catch (error) {
    console.error('Failed to get email config:', error);
    return null;
  }
}

// Refresh OAuth token for Microsoft
async function refreshMicrosoftToken(config: EmailConfig): Promise<string | null> {
  try {
    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.smtp_oauth_client_id || '',
        client_secret: config.smtp_oauth_client_secret || '',
        refresh_token: config.smtp_oauth_refresh_token || '',
        grant_type: 'refresh_token',
        scope: 'https://outlook.office365.com/SMTP.Send offline_access',
      }),
    });
    
    const data = await response.json();
    
    if (data.access_token) {
      // Update the access token in database
      const db = getDb();
      const expiryDate = new Date(Date.now() + data.expires_in * 1000).toISOString();
      db.prepare(`
        UPDATE system_config 
        SET smtp_oauth_access_token = ?, 
            smtp_oauth_token_expiry = ?
        WHERE id = 1
      `).run(data.access_token, expiryDate);
      
      return data.access_token;
    }
    
    return null;
  } catch (error) {
    console.error('Failed to refresh Microsoft token:', error);
    return null;
  }
}

// Refresh OAuth token for Google
async function refreshGoogleToken(config: EmailConfig): Promise<string | null> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.smtp_oauth_client_id || '',
        client_secret: config.smtp_oauth_client_secret || '',
        refresh_token: config.smtp_oauth_refresh_token || '',
        grant_type: 'refresh_token',
      }),
    });
    
    const data = await response.json();
    
    if (data.access_token) {
      // Update the access token in database
      const db = getDb();
      const expiryDate = new Date(Date.now() + data.expires_in * 1000).toISOString();
      db.prepare(`
        UPDATE system_config 
        SET smtp_oauth_access_token = ?, 
            smtp_oauth_token_expiry = ?
        WHERE id = 1
      `).run(data.access_token, expiryDate);
      
      return data.access_token;
    }
    
    return null;
  } catch (error) {
    console.error('Failed to refresh Google token:', error);
    return null;
  }
}

// Get valid access token (refresh if needed)
async function getValidAccessToken(config: EmailConfig): Promise<string | null> {
  // Check if current token is still valid (with 5 min buffer)
  if (config.smtp_oauth_access_token && config.smtp_oauth_token_expiry) {
    const expiry = new Date(config.smtp_oauth_token_expiry);
    if (expiry > new Date(Date.now() + 5 * 60 * 1000)) {
      return config.smtp_oauth_access_token;
    }
  }
  
  // Token expired or about to expire, refresh it
  if (config.smtp_auth_method === 'oauth_microsoft') {
    return refreshMicrosoftToken(config);
  } else if (config.smtp_auth_method === 'oauth_google') {
    return refreshGoogleToken(config);
  }
  
  return null;
}

// Create transporter based on auth method
async function createTransport() {
  const config = getEmailConfig();
  
  if (!config) {
    console.warn('Email configuration missing or disabled. Email notifications will be logged only.');
    return null;
  }
  
  const { smtp_host, smtp_port, smtp_user, smtp_from, smtp_secure, smtp_auth_method } = config;
  
  if (!smtp_host || !smtp_user) {
    console.warn('SMTP host or user not configured.');
    return null;
  }
  
  // App Password Authentication
  if (smtp_auth_method === 'app_password') {
    if (!config.smtp_pass) {
      console.warn('SMTP password not configured for app password authentication.');
      return null;
    }
    
    return nodemailer.createTransport({
      host: smtp_host,
      port: smtp_port,
      secure: smtp_secure === 1,
      auth: {
        user: smtp_user,
        pass: config.smtp_pass,
      },
      tls: {
        // Allow connections even if there are certificate issues
        // This is needed for some SMTP providers like SMTP2GO
        rejectUnauthorized: false,
      },
    });
  }
  
  // OAuth Authentication (Google or Microsoft)
  if (smtp_auth_method === 'oauth_google' || smtp_auth_method === 'oauth_microsoft') {
    const accessToken = await getValidAccessToken(config);
    
    if (!accessToken) {
      console.warn('Failed to get valid OAuth access token.');
      return null;
    }
    
    return nodemailer.createTransport({
      host: smtp_host,
      port: smtp_port,
      secure: smtp_secure === 1,
      auth: {
        user: smtp_user,
        accessToken: accessToken,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }
  
  return null;
}

// Send email
export async function sendEmail({ to, subject, html, text }: EmailOptions): Promise<boolean> {
  const config = getEmailConfig();
  const transporter = await createTransport();
  const from = config?.smtp_from || 'hr@forcefriction.ai';
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

// Test email connection
export async function testEmailConnection(): Promise<{ success: boolean; message: string }> {
  const config = getEmailConfig();
  
  if (!config) {
    return { success: false, message: 'Email notifications are disabled or not configured.' };
  }
  
  const { smtp_host, smtp_port, smtp_user, smtp_auth_method } = config;
  
  if (!smtp_host || !smtp_user) {
    return { success: false, message: 'SMTP host and user are required.' };
  }
  
  // Check auth-specific requirements
  if (smtp_auth_method === 'app_password' && !config.smtp_pass) {
    return { success: false, message: 'SMTP password is required for App Password authentication.' };
  }
  
  if ((smtp_auth_method === 'oauth_google' || smtp_auth_method === 'oauth_microsoft')) {
    if (!config.smtp_oauth_client_id || !config.smtp_oauth_client_secret) {
      return { success: false, message: 'OAuth Client ID and Client Secret are required.' };
    }
    if (!config.smtp_oauth_refresh_token) {
      return { success: false, message: 'OAuth Refresh Token is required.' };
    }
  }
  
  try {
    const transporter = await createTransport();
    
    if (!transporter) {
      return { success: false, message: 'Failed to create email transport. Check your configuration.' };
    }
    
    // Verify connection
    await transporter.verify();
    
    return { success: true, message: `Connection successful! Using ${smtp_auth_method} authentication with ${smtp_host}:${smtp_port}` };
  } catch (error: any) {
    console.error('Email test connection failed:', error);
    
    let errorMessage = error.message || 'Connection failed.';
    
    // Provide helpful error messages for common issues
    if (error.code === 'EAUTH') {
      if (smtp_auth_method === 'app_password') {
        errorMessage = 'Authentication failed. For Gmail, use an App Password instead of your regular password. For Microsoft, use an App Password or enable SMTP AUTH.';
      } else {
        errorMessage = 'OAuth authentication failed. The refresh token may be expired or invalid. Please re-authenticate.';
      }
    } else if (error.code === 'ECONNECTION') {
      errorMessage = `Could not connect to ${smtp_host}:${smtp_port}. Check your host and port settings.`;
    } else if (error.code === 'ESOCKET') {
      errorMessage = 'Socket error. Check if the SMTP server is accessible from your network.';
    }
    
    return { success: false, message: errorMessage };
  }
}

// Get email configuration for display (without sensitive data)
export function getEmailSettings() {
  const config = getEmailConfig();
  
  if (!config) {
    return null;
  }
  
  return {
    smtp_host: config.smtp_host,
    smtp_port: config.smtp_port,
    smtp_user: config.smtp_user,
    smtp_from: config.smtp_from,
    smtp_auth_method: config.smtp_auth_method,
    smtp_secure: config.smtp_secure,
    email_notifications_enabled: config.email_notifications_enabled,
    // Mask sensitive OAuth fields
    has_oauth_client_id: !!config.smtp_oauth_client_id,
    has_oauth_client_secret: !!config.smtp_oauth_client_secret,
    has_oauth_refresh_token: !!config.smtp_oauth_refresh_token,
    has_oauth_access_token: !!config.smtp_oauth_access_token,
    oauth_token_expiry: config.smtp_oauth_token_expiry,
  };
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

// Task Assignment Email Template
export function getTaskAssignmentEmail(
  name: string,
  title: string,
  description: string,
  dueDate: string | null,
  assignedBy: string
): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">New Task Assigned</h2>
      <p>Hi ${name},</p>
      <p>You have been assigned a new task by <strong>${assignedBy}</strong>.</p>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Task:</strong> ${title}</p>
        <p><strong>Description:</strong> ${description}</p>
        ${dueDate ? `<p><strong>Due Date:</strong> ${dueDate}</p>` : ''}
      </div>
      
      <div style="margin: 30px 0;">
        <a href="${process.env.NEXTAUTH_URL}/tasks/assigned" 
           style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
          View Task
        </a>
      </div>
      
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      <p style="color: #999; font-size: 12px;">
        This is an automated notification from ForceFriction AI HR Portal.
      </p>
    </div>
  `;
}

// Task Review Email Template
export function getTaskReviewEmail(
  name: string,
  title: string,
  status: 'approved' | 'rejected',
  reviewNotes?: string
): string {
  const color = status === 'approved' ? '#28a745' : '#dc3545';
  const statusText = status === 'approved' ? 'approved' : 'rejected';
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${color};">Task ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}</h2>
      <p>Hi ${name},</p>
      <p>Your task has been <strong style="color: ${color};">${statusText}</strong>.</p>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Task:</strong> ${title}</p>
        ${reviewNotes ? `<p><strong>Feedback:</strong> ${reviewNotes}</p>` : ''}
      </div>
      
      <div style="margin: 30px 0;">
        <a href="${process.env.NEXTAUTH_URL}/tasks/assigned" 
           style="background-color: ${color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
          View Task
        </a>
      </div>
      
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
