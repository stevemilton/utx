import { Resend } from 'resend';

// Initialize Resend - will be undefined if RESEND_API_KEY not set
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// For testing, use onboarding@resend.dev; for production, use verified domain
const FROM_EMAIL = process.env.EMAIL_FROM || 'UTx <onboarding@resend.dev>';
const APP_URL = process.env.APP_URL || 'https://utx-production.up.railway.app';

interface EmailResult {
  success: boolean;
  error?: string;
}

/**
 * Send an email using Resend
 */
async function sendEmail(to: string, subject: string, html: string): Promise<EmailResult> {
  if (!resend) {
    console.warn('RESEND_API_KEY not set - email not sent');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    if (error) {
      console.error('Resend error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Email send failed:', err);
    return { success: false, error: 'Failed to send email' };
  }
}

/**
 * Send email verification email
 */
export async function sendVerificationEmail(
  email: string,
  name: string,
  token: string
): Promise<EmailResult> {
  const verifyUrl = `${APP_URL}/auth/verify-email?token=${token}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color: #0D4F4F; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">UTx</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1A1A1A; margin: 0 0 20px 0; font-size: 24px;">Verify your email</h2>
              <p style="color: #6B7280; font-size: 16px; line-height: 24px; margin: 0 0 20px 0;">
                Hi ${name},
              </p>
              <p style="color: #6B7280; font-size: 16px; line-height: 24px; margin: 0 0 30px 0;">
                Thanks for signing up for UTx! Please verify your email address by clicking the button below:
              </p>
              <table cellpadding="0" cellspacing="0" style="margin: 0 auto 30px auto;">
                <tr>
                  <td style="background-color: #0D4F4F; border-radius: 12px;">
                    <a href="${verifyUrl}" style="display: inline-block; padding: 16px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">
                      Verify Email
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color: #9CA3AF; font-size: 14px; line-height: 20px; margin: 0 0 10px 0;">
                This link expires in 24 hours.
              </p>
              <p style="color: #9CA3AF; font-size: 14px; line-height: 20px; margin: 0;">
                If you didn't create an account, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center;">
              <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
                UTx - Every ERG Counts
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return sendEmail(email, 'Verify your UTx account', html);
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  name: string,
  token: string
): Promise<EmailResult> {
  const resetUrl = `${APP_URL}/auth/reset-password?token=${token}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color: #0D4F4F; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">UTx</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1A1A1A; margin: 0 0 20px 0; font-size: 24px;">Reset your password</h2>
              <p style="color: #6B7280; font-size: 16px; line-height: 24px; margin: 0 0 20px 0;">
                Hi ${name},
              </p>
              <p style="color: #6B7280; font-size: 16px; line-height: 24px; margin: 0 0 30px 0;">
                We received a request to reset your password. Click the button below to create a new password:
              </p>
              <table cellpadding="0" cellspacing="0" style="margin: 0 auto 30px auto;">
                <tr>
                  <td style="background-color: #0D4F4F; border-radius: 12px;">
                    <a href="${resetUrl}" style="display: inline-block; padding: 16px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color: #9CA3AF; font-size: 14px; line-height: 20px; margin: 0 0 10px 0;">
                This link expires in 1 hour.
              </p>
              <p style="color: #9CA3AF; font-size: 14px; line-height: 20px; margin: 0;">
                If you didn't request a password reset, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center;">
              <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
                UTx - Every ERG Counts
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return sendEmail(email, 'Reset your UTx password', html);
}
