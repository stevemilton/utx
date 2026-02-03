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
  console.log(`[EMAIL] Attempting to send email to: ${to}, subject: ${subject}`);
  console.log(`[EMAIL] RESEND_API_KEY configured: ${!!process.env.RESEND_API_KEY}`);
  console.log(`[EMAIL] FROM_EMAIL: ${FROM_EMAIL}`);

  if (!resend) {
    console.error('[EMAIL] RESEND_API_KEY not set - email not sent');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    console.log('[EMAIL] Calling Resend API...');
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    if (error) {
      console.error('[EMAIL] Resend API returned error:', JSON.stringify(error, null, 2));
      return { success: false, error: error.message };
    }

    console.log('[EMAIL] Email sent successfully! Resend response:', JSON.stringify(data, null, 2));
    return { success: true };
  } catch (err: any) {
    console.error('[EMAIL] Email send threw exception:', err?.message || err);
    console.error('[EMAIL] Full error:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    return { success: false, error: err?.message || 'Failed to send email' };
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

// ============================================
// CLUB NOTIFICATION EMAILS
// ============================================

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'clubs@polarindustries.co';

/**
 * Send notification to admin when a new club is created (for verification)
 */
export async function sendClubCreatedNotification(
  clubName: string,
  clubLocation: string | null,
  creatorName: string,
  creatorEmail: string | null
): Promise<EmailResult> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Club Pending Verification</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden;">
          <tr>
            <td style="background-color: #0D4F4F; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">UTx Admin</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1A1A1A; margin: 0 0 20px 0; font-size: 24px;">New Club Pending Verification</h2>
              <p style="color: #6B7280; font-size: 16px; line-height: 24px; margin: 0 0 20px 0;">
                A new club has been created and needs verification:
              </p>
              <table style="width: 100%; margin-bottom: 20px;">
                <tr>
                  <td style="color: #9CA3AF; padding: 8px 0;">Club Name:</td>
                  <td style="color: #1A1A1A; padding: 8px 0; font-weight: 600;">${clubName}</td>
                </tr>
                <tr>
                  <td style="color: #9CA3AF; padding: 8px 0;">Location:</td>
                  <td style="color: #1A1A1A; padding: 8px 0;">${clubLocation || 'Not specified'}</td>
                </tr>
                <tr>
                  <td style="color: #9CA3AF; padding: 8px 0;">Created by:</td>
                  <td style="color: #1A1A1A; padding: 8px 0;">${creatorName}</td>
                </tr>
                <tr>
                  <td style="color: #9CA3AF; padding: 8px 0;">Creator email:</td>
                  <td style="color: #1A1A1A; padding: 8px 0;">${creatorEmail || 'Not provided'}</td>
                </tr>
              </table>
              <p style="color: #6B7280; font-size: 14px; line-height: 20px; margin: 0;">
                Use the admin API to verify or reject this club.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center;">
              <p style="color: #9CA3AF; font-size: 12px; margin: 0;">UTx - Every ERG Counts</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return sendEmail(ADMIN_EMAIL, `New Club Pending: ${clubName}`, html);
}

/**
 * Send email to club creator when their club is verified
 */
export async function sendClubVerifiedEmail(
  email: string,
  name: string,
  clubName: string,
  inviteCode: string
): Promise<EmailResult> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Club is Live!</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden;">
          <tr>
            <td style="background-color: #0D4F4F; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">UTx</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1A1A1A; margin: 0 0 20px 0; font-size: 24px;">Your Club is Live!</h2>
              <p style="color: #6B7280; font-size: 16px; line-height: 24px; margin: 0 0 20px 0;">
                Hi ${name},
              </p>
              <p style="color: #6B7280; font-size: 16px; line-height: 24px; margin: 0 0 20px 0;">
                Great news! <strong>${clubName}</strong> has been verified and is now live on UTx.
              </p>
              <p style="color: #6B7280; font-size: 16px; line-height: 24px; margin: 0 0 20px 0;">
                Share this invite code with your club members so they can join:
              </p>
              <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 20px;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #0D4F4F;">${inviteCode}</span>
              </div>
              <p style="color: #9CA3AF; font-size: 14px; line-height: 20px; margin: 0;">
                Members can enter this code in the app to instantly join your club.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center;">
              <p style="color: #9CA3AF; font-size: 12px; margin: 0;">UTx - Every ERG Counts</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return sendEmail(email, `${clubName} is now live on UTx!`, html);
}

/**
 * Send email to club creator when their club is rejected
 */
export async function sendClubRejectedEmail(
  email: string,
  name: string,
  clubName: string,
  reason?: string
): Promise<EmailResult> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Club Not Approved</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden;">
          <tr>
            <td style="background-color: #0D4F4F; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">UTx</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1A1A1A; margin: 0 0 20px 0; font-size: 24px;">Club Not Approved</h2>
              <p style="color: #6B7280; font-size: 16px; line-height: 24px; margin: 0 0 20px 0;">
                Hi ${name},
              </p>
              <p style="color: #6B7280; font-size: 16px; line-height: 24px; margin: 0 0 20px 0;">
                Unfortunately, your club <strong>${clubName}</strong> was not approved for UTx.
              </p>
              ${reason ? `
              <p style="color: #6B7280; font-size: 16px; line-height: 24px; margin: 0 0 20px 0;">
                <strong>Reason:</strong> ${reason}
              </p>
              ` : ''}
              <p style="color: #6B7280; font-size: 16px; line-height: 24px; margin: 0;">
                If you believe this was a mistake or have questions, please contact us at support@utx.app.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center;">
              <p style="color: #9CA3AF; font-size: 12px; margin: 0;">UTx - Every ERG Counts</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return sendEmail(email, `Update on your club: ${clubName}`, html);
}

/**
 * Send email to user when their join request is approved
 */
export async function sendJoinApprovedEmail(
  email: string,
  name: string,
  clubName: string
): Promise<EmailResult> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${clubName}!</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden;">
          <tr>
            <td style="background-color: #0D4F4F; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">UTx</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1A1A1A; margin: 0 0 20px 0; font-size: 24px;">Welcome to ${clubName}!</h2>
              <p style="color: #6B7280; font-size: 16px; line-height: 24px; margin: 0 0 20px 0;">
                Hi ${name},
              </p>
              <p style="color: #6B7280; font-size: 16px; line-height: 24px; margin: 0 0 20px 0;">
                Your request to join <strong>${clubName}</strong> has been approved. You're now a member!
              </p>
              <p style="color: #6B7280; font-size: 16px; line-height: 24px; margin: 0;">
                Open the UTx app to see your club, join squads, and start logging workouts with your teammates.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center;">
              <p style="color: #9CA3AF; font-size: 12px; margin: 0;">UTx - Every ERG Counts</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return sendEmail(email, `You're now a member of ${clubName}!`, html);
}

/**
 * Send email to user when their join request is rejected
 */
export async function sendJoinRejectedEmail(
  email: string,
  name: string,
  clubName: string,
  reason?: string
): Promise<EmailResult> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Join Request Update</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden;">
          <tr>
            <td style="background-color: #0D4F4F; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">UTx</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1A1A1A; margin: 0 0 20px 0; font-size: 24px;">Join Request Not Approved</h2>
              <p style="color: #6B7280; font-size: 16px; line-height: 24px; margin: 0 0 20px 0;">
                Hi ${name},
              </p>
              <p style="color: #6B7280; font-size: 16px; line-height: 24px; margin: 0 0 20px 0;">
                Your request to join <strong>${clubName}</strong> was not approved.
              </p>
              ${reason ? `
              <p style="color: #6B7280; font-size: 16px; line-height: 24px; margin: 0 0 20px 0;">
                <strong>Reason:</strong> ${reason}
              </p>
              ` : ''}
              <p style="color: #6B7280; font-size: 16px; line-height: 24px; margin: 0;">
                You can search for other clubs in the UTx app or contact the club directly if you think this was a mistake.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center;">
              <p style="color: #9CA3AF; font-size: 12px; margin: 0;">UTx - Every ERG Counts</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return sendEmail(email, `Update on your request to join ${clubName}`, html);
}
