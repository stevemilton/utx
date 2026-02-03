import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getAuth } from 'firebase-admin/auth';
import * as jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email';

interface RegisterBody {
  firebaseToken: string;
  provider?: 'apple' | 'google';
  name: string;
  email?: string;
  heightCm: number;
  weightKg: number;
  birthDate: string;
  gender: 'male' | 'female' | 'prefer_not_to_say' | '';
  maxHr: number;
  restingHr?: number; // Optional, defaults to 50 if not provided
  avatarUrl?: string;
}

interface VerifyBody {
  firebaseToken: string;
  provider?: 'apple' | 'google';
}

// Email/Password Auth interfaces
interface EmailRegisterBody {
  email: string;
  password: string;
  name: string;
}

interface EmailLoginBody {
  email: string;
  password: string;
}

interface VerifyEmailBody {
  token: string;
}

interface RequestResetBody {
  email: string;
}

interface ResetPasswordBody {
  token: string;
  password: string;
}

interface ResendVerificationBody {
  email: string;
}

// Constants for rate limiting and token expiry
const BCRYPT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const VERIFICATION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESET_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute

// Password validation
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validatePassword(password: string): string | null {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!/\d/.test(password)) {
    return 'Password must contain at least one number';
  }
  return null;
}

function validateEmail(email: string): string | null {
  if (!email) {
    return 'Email is required';
  }
  if (!EMAIL_REGEX.test(email)) {
    return 'Please enter a valid email address';
  }
  return null;
}

function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Generate HTML response for email verification
function getVerificationHtml(success: boolean, message: string): string {
  const bgColor = success ? '#10B981' : '#EF4444';
  const icon = success ? '✓' : '✗';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>UTx - Email Verification</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
      padding: 20px;
    }
    .container {
      text-align: center;
      max-width: 400px;
    }
    .icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: ${bgColor};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
      margin: 0 auto 24px;
    }
    h1 {
      font-size: 24px;
      margin-bottom: 12px;
    }
    p {
      color: #a0aec0;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .btn {
      display: inline-block;
      background: #3B82F6;
      color: white;
      padding: 12px 32px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
    }
    .logo {
      font-size: 32px;
      font-weight: bold;
      margin-bottom: 32px;
      color: #3B82F6;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">UTx</div>
    <div class="icon">${icon}</div>
    <h1>${success ? 'Email Verified!' : 'Verification Failed'}</h1>
    <p>${message}</p>
    ${success ? '<p style="color: #10B981;">You can close this page and return to the app.</p>' : ''}
  </div>
</body>
</html>`;
}

// Apple JWKS client for verifying Apple identity tokens
const appleJwksClient = jwksClient({
  jwksUri: 'https://appleid.apple.com/auth/keys',
  cache: true,
  cacheMaxAge: 86400000, // 24 hours
});

// Get Apple signing key
function getAppleSigningKey(kid: string): Promise<string> {
  return new Promise((resolve, reject) => {
    appleJwksClient.getSigningKey(kid, (err, key) => {
      if (err) {
        reject(err);
      } else {
        const signingKey = key?.getPublicKey();
        if (signingKey) {
          resolve(signingKey);
        } else {
          reject(new Error('No signing key found'));
        }
      }
    });
  });
}

// Verify Apple identity token
async function verifyAppleToken(token: string): Promise<{ sub: string; email?: string; name?: string }> {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || !decoded.header.kid) {
    throw new Error('Invalid Apple token format');
  }

  const signingKey = await getAppleSigningKey(decoded.header.kid);

  const verified = jwt.verify(token, signingKey, {
    algorithms: ['RS256'],
    issuer: 'https://appleid.apple.com',
    // The audience is your app's bundle ID
    audience: 'com.utx.app',
  }) as { sub: string; email?: string; name?: string };

  return verified;
}

// Google token info response type
interface GoogleTokenPayload {
  aud: string;
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

// Verify Google ID token
async function verifyGoogleToken(token: string): Promise<{ sub: string; email?: string; name?: string; picture?: string }> {
  // Google provides a token info endpoint for verification
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);

  if (!response.ok) {
    throw new Error('Invalid Google token');
  }

  const payload = await response.json() as GoogleTokenPayload;

  // Verify the token is for our app
  const validAudiences = [
    '939602682205-l5fpnegg1c7icsj7inhsr7f7gum3dnnf.apps.googleusercontent.com', // iOS client ID
  ];

  if (!validAudiences.includes(payload.aud)) {
    throw new Error('Google token audience mismatch');
  }

  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
  };
}

export async function authRoutes(server: FastifyInstance): Promise<void> {
  const auth = getAuth();

  // Register or login user
  server.post<{ Body: RegisterBody }>(
    '/register',
    async (request: FastifyRequest<{ Body: RegisterBody }>, reply: FastifyReply) => {
      const { firebaseToken, provider, name, email, heightCm, weightKg, birthDate, gender, maxHr, restingHr, avatarUrl } = request.body;

      try {
        let providerUid: string;
        let verifiedEmail: string | undefined;
        let verifiedName: string | undefined;
        let verifiedPicture: string | undefined;
        let authProvider: string;

        // Handle different auth providers
        if (provider === 'apple') {
          // Verify Apple identity token
          const applePayload = await verifyAppleToken(firebaseToken);
          providerUid = `apple:${applePayload.sub}`;
          verifiedEmail = applePayload.email || email;
          verifiedName = applePayload.name || name;
          authProvider = 'apple';
        } else if (provider === 'google') {
          // Verify Google ID token
          const googlePayload = await verifyGoogleToken(firebaseToken);
          providerUid = `google:${googlePayload.sub}`;
          verifiedEmail = googlePayload.email || email;
          verifiedName = googlePayload.name || name;
          verifiedPicture = googlePayload.picture;
          authProvider = 'google';
        } else {
          // Legacy: try Firebase token verification (for backwards compatibility)
          try {
            const decodedToken = await auth.verifyIdToken(firebaseToken);
            providerUid = decodedToken.uid;
            verifiedEmail = decodedToken.email;
            verifiedName = decodedToken.name || name;
            verifiedPicture = decodedToken.picture;
            authProvider = 'firebase';
          } catch {
            return reply.status(401).send({
              success: false,
              error: 'Invalid token - please specify a provider (apple or google)',
            });
          }
        }

        // Check if user already exists by provider UID
        let user = await server.prisma.user.findUnique({
          where: { firebaseUid: providerUid },
        });

        if (user) {
          // User exists, return them with their token
          // Generate a simple JWT for the session
          const token = server.jwt.sign({ userId: user.id, provider: authProvider });

          return reply.send({
            success: true,
            data: {
              user,
              token,
              isNewUser: false,
            },
          });
        }

        // Create new user - handle empty/missing fields for onboarding
        const userData: any = {
          firebaseUid: providerUid,
          name: verifiedName || name || 'User',
          heightCm: heightCm || 0,
          weightKg: weightKg || 0,
          maxHr: maxHr || 0,
          restingHr: restingHr || null, // Optional, can be set during onboarding
          avatarUrl: avatarUrl || verifiedPicture,
        };

        // Only add optional fields if they have valid values
        if (verifiedEmail) {
          userData.email = verifiedEmail;
        }
        if (birthDate && birthDate !== '') {
          userData.birthDate = new Date(birthDate);
        }
        if (gender && (gender === 'male' || gender === 'female' || gender === 'prefer_not_to_say')) {
          userData.gender = gender;
        }

        user = await server.prisma.user.create({
          data: userData,
        });

        // Generate a JWT for the session
        const token = server.jwt.sign({ userId: user.id, provider: authProvider });

        return reply.status(201).send({
          success: true,
          data: {
            user,
            token,
            isNewUser: true,
          },
        });
      } catch (error) {
        request.log.error(error, 'Registration failed');
        return reply.status(401).send({
          success: false,
          error: error instanceof Error ? error.message : 'Authentication failed',
        });
      }
    }
  );

  // Verify token and get user
  server.post<{ Body: VerifyBody }>(
    '/verify',
    async (request: FastifyRequest<{ Body: VerifyBody }>, reply: FastifyReply) => {
      const { firebaseToken, provider } = request.body;

      try {
        let providerUid: string;

        // Handle different auth providers
        if (provider === 'apple') {
          const applePayload = await verifyAppleToken(firebaseToken);
          providerUid = `apple:${applePayload.sub}`;
        } else if (provider === 'google') {
          const googlePayload = await verifyGoogleToken(firebaseToken);
          providerUid = `google:${googlePayload.sub}`;
        } else {
          // Legacy: try Firebase token verification
          const decodedToken = await auth.verifyIdToken(firebaseToken);
          providerUid = decodedToken.uid;
        }

        const user = await server.prisma.user.findUnique({
          where: { firebaseUid: providerUid },
          include: {
            clubMemberships: {
              include: {
                club: true,
              },
            },
            squadMemberships: {
              include: {
                squad: true,
              },
            },
          },
        });

        if (!user) {
          return reply.status(404).send({
            success: false,
            error: 'User not found',
          });
        }

        // Generate a JWT for the session
        const token = server.jwt.sign({ userId: user.id, provider: provider || 'firebase' });

        return reply.send({
          success: true,
          data: { user, token },
        });
      } catch (error) {
        request.log.error(error, 'Token verification failed');
        return reply.status(401).send({
          success: false,
          error: 'Invalid token',
        });
      }
    }
  );

  // Delete account
  server.delete(
    '/account',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.authUser!.id;

      try {
        // IMPORTANT: Fetch Firebase UID BEFORE deleting from database
        const user = await server.prisma.user.findUnique({
          where: { id: userId },
          select: { firebaseUid: true },
        });

        if (!user) {
          return reply.status(404).send({
            success: false,
            error: 'User not found',
          });
        }

        // Delete from Firebase first (if this fails, DB is unchanged)
        try {
          await auth.deleteUser(user.firebaseUid);
        } catch (firebaseError: any) {
          // Only fail if it's not a "user not found" error
          if (firebaseError.code !== 'auth/user-not-found') {
            throw firebaseError;
          }
          // User doesn't exist in Firebase, continue with DB deletion
        }

        // Now delete user and all related data (cascade) from database
        await server.prisma.user.delete({
          where: { id: userId },
        });

        return reply.send({
          success: true,
          message: 'Account deleted successfully',
        });
      } catch (error) {
        request.log.error(error, 'Account deletion failed');
        return reply.status(500).send({
          success: false,
          error: 'Failed to delete account',
        });
      }
    }
  );

  // ============ EMAIL/PASSWORD AUTHENTICATION ============

  // Register with email/password
  server.post<{ Body: EmailRegisterBody }>(
    '/register-email',
    async (request: FastifyRequest<{ Body: EmailRegisterBody }>, reply: FastifyReply) => {
      const { email, password, name } = request.body;

      try {
        // Validate inputs
        const emailError = validateEmail(email);
        if (emailError) {
          return reply.status(400).send({ success: false, error: emailError });
        }

        const passwordError = validatePassword(password);
        if (passwordError) {
          return reply.status(400).send({ success: false, error: passwordError });
        }

        if (!name || name.trim().length < 1) {
          return reply.status(400).send({ success: false, error: 'Name is required' });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Check if email already exists
        const existingUser = await server.prisma.user.findFirst({
          where: { firebaseUid: `email:${normalizedEmail}` },
        });

        if (existingUser) {
          // Return generic success to prevent email enumeration
          // But don't actually create another user
          return reply.send({
            success: true,
            message: 'If this email is not registered, you will receive a verification email shortly.',
          });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

        // Generate verification token
        const verificationToken = generateSecureToken();
        const verificationExpires = new Date(Date.now() + VERIFICATION_EXPIRY_MS);

        // Create user (not verified yet)
        await server.prisma.user.create({
          data: {
            firebaseUid: `email:${normalizedEmail}`,
            email: normalizedEmail,
            name: name.trim(),
            passwordHash,
            emailVerified: false,
            emailVerificationToken: verificationToken,
            emailVerificationExpires: verificationExpires,
          },
        });

        // Send verification email
        await sendVerificationEmail(normalizedEmail, name.trim(), verificationToken);

        return reply.send({
          success: true,
          message: 'If this email is not registered, you will receive a verification email shortly.',
        });
      } catch (error) {
        request.log.error(error, 'Email registration failed');
        return reply.status(500).send({
          success: false,
          error: 'Registration failed. Please try again.',
        });
      }
    }
  );

  // Verify email - GET handler for email links (returns HTML page)
  server.get<{ Querystring: { token: string } }>(
    '/verify-email',
    async (request: FastifyRequest<{ Querystring: { token: string } }>, reply: FastifyReply) => {
      const { token } = request.query;

      try {
        if (!token) {
          return reply.type('text/html').send(getVerificationHtml(false, 'No verification token provided'));
        }

        // Find user by verification token
        const user = await server.prisma.user.findFirst({
          where: { emailVerificationToken: token },
        });

        if (!user) {
          return reply.type('text/html').send(getVerificationHtml(false, 'Invalid or expired verification link'));
        }

        // Check if token expired
        if (user.emailVerificationExpires && new Date() > user.emailVerificationExpires) {
          return reply.type('text/html').send(getVerificationHtml(false, 'Verification link has expired. Please request a new one in the app.'));
        }

        // Update user as verified
        await server.prisma.user.update({
          where: { id: user.id },
          data: {
            emailVerified: true,
            emailVerificationToken: null,
            emailVerificationExpires: null,
          },
        });

        return reply.type('text/html').send(getVerificationHtml(true, 'Your email has been verified! You can now log in to UTx.'));
      } catch (error) {
        request.log.error(error, 'Email verification failed');
        return reply.type('text/html').send(getVerificationHtml(false, 'Verification failed. Please try again.'));
      }
    }
  );

  // Verify email - POST handler for API calls
  server.post<{ Body: VerifyEmailBody }>(
    '/verify-email',
    async (request: FastifyRequest<{ Body: VerifyEmailBody }>, reply: FastifyReply) => {
      const { token } = request.body;

      try {
        if (!token) {
          return reply.status(400).send({ success: false, error: 'Verification token is required' });
        }

        // Find user by verification token
        const user = await server.prisma.user.findFirst({
          where: { emailVerificationToken: token },
        });

        if (!user) {
          return reply.status(400).send({
            success: false,
            error: 'Invalid or expired verification link',
          });
        }

        // Check if token expired
        if (user.emailVerificationExpires && new Date() > user.emailVerificationExpires) {
          return reply.status(400).send({
            success: false,
            error: 'Verification link has expired. Please request a new one.',
          });
        }

        // Update user as verified
        const updatedUser = await server.prisma.user.update({
          where: { id: user.id },
          data: {
            emailVerified: true,
            emailVerificationToken: null,
            emailVerificationExpires: null,
          },
        });

        // Generate JWT token
        const jwtToken = server.jwt.sign({ userId: updatedUser.id, provider: 'email' });

        return reply.send({
          success: true,
          data: {
            user: updatedUser,
            token: jwtToken,
          },
        });
      } catch (error) {
        request.log.error(error, 'Email verification failed');
        return reply.status(500).send({
          success: false,
          error: 'Verification failed. Please try again.',
        });
      }
    }
  );

  // Login with email/password
  server.post<{ Body: EmailLoginBody }>(
    '/login-email',
    async (request: FastifyRequest<{ Body: EmailLoginBody }>, reply: FastifyReply) => {
      const { email, password } = request.body;

      try {
        // Validate inputs
        if (!email || !password) {
          return reply.status(400).send({
            success: false,
            error: 'Email and password are required',
          });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Find user by email
        const user = await server.prisma.user.findFirst({
          where: { firebaseUid: `email:${normalizedEmail}` },
        });

        // Generic error to prevent email enumeration
        const genericError = { success: false, error: 'Invalid email or password' };

        if (!user) {
          return reply.status(401).send(genericError);
        }

        // Check if account is locked
        if (user.lockoutUntil && new Date() < user.lockoutUntil) {
          const minutesLeft = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / 60000);
          return reply.status(429).send({
            success: false,
            error: `Too many failed attempts. Please try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`,
          });
        }

        // Check if email is verified
        if (!user.emailVerified) {
          return reply.status(401).send({
            success: false,
            error: 'Please verify your email before logging in',
            code: 'EMAIL_NOT_VERIFIED',
          });
        }

        // Check if user has a password (might be OAuth-only user)
        if (!user.passwordHash) {
          return reply.status(401).send(genericError);
        }

        // Verify password
        const passwordValid = await bcrypt.compare(password, user.passwordHash);

        if (!passwordValid) {
          // Increment failed attempts
          const newAttempts = (user.failedLoginAttempts || 0) + 1;
          const updates: any = { failedLoginAttempts: newAttempts };

          if (newAttempts >= MAX_FAILED_ATTEMPTS) {
            updates.lockoutUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
          }

          await server.prisma.user.update({
            where: { id: user.id },
            data: updates,
          });

          return reply.status(401).send(genericError);
        }

        // Success - reset failed attempts
        const updatedUser = await server.prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lockoutUntil: null,
          },
        });

        // Generate JWT token
        const jwtToken = server.jwt.sign({ userId: updatedUser.id, provider: 'email' });

        return reply.send({
          success: true,
          data: {
            user: updatedUser,
            token: jwtToken,
          },
        });
      } catch (error) {
        request.log.error(error, 'Email login failed');
        return reply.status(500).send({
          success: false,
          error: 'Login failed. Please try again.',
        });
      }
    }
  );

  // Request password reset
  server.post<{ Body: RequestResetBody }>(
    '/request-reset',
    async (request: FastifyRequest<{ Body: RequestResetBody }>, reply: FastifyReply) => {
      const { email } = request.body;

      try {
        if (!email) {
          return reply.status(400).send({ success: false, error: 'Email is required' });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Always return success to prevent email enumeration
        const successResponse = {
          success: true,
          message: 'If an account exists with this email, you will receive a password reset link shortly.',
        };

        // Find user
        const user = await server.prisma.user.findFirst({
          where: { firebaseUid: `email:${normalizedEmail}` },
        });

        if (!user || !user.passwordHash) {
          // User doesn't exist or is OAuth-only
          return reply.send(successResponse);
        }

        // Generate reset token
        const resetToken = generateSecureToken();
        const resetExpires = new Date(Date.now() + RESET_EXPIRY_MS);

        // Update user with reset token
        await server.prisma.user.update({
          where: { id: user.id },
          data: {
            passwordResetToken: resetToken,
            passwordResetExpires: resetExpires,
          },
        });

        // Send reset email
        await sendPasswordResetEmail(normalizedEmail, user.name, resetToken);

        return reply.send(successResponse);
      } catch (error) {
        request.log.error(error, 'Password reset request failed');
        return reply.status(500).send({
          success: false,
          error: 'Failed to process request. Please try again.',
        });
      }
    }
  );

  // Reset password with token
  server.post<{ Body: ResetPasswordBody }>(
    '/reset-password',
    async (request: FastifyRequest<{ Body: ResetPasswordBody }>, reply: FastifyReply) => {
      const { token, password } = request.body;

      try {
        if (!token) {
          return reply.status(400).send({ success: false, error: 'Reset token is required' });
        }

        const passwordError = validatePassword(password);
        if (passwordError) {
          return reply.status(400).send({ success: false, error: passwordError });
        }

        // Find user by reset token
        const user = await server.prisma.user.findFirst({
          where: { passwordResetToken: token },
        });

        if (!user) {
          return reply.status(400).send({
            success: false,
            error: 'Invalid or expired reset link',
          });
        }

        // Check if token expired
        if (user.passwordResetExpires && new Date() > user.passwordResetExpires) {
          return reply.status(400).send({
            success: false,
            error: 'Reset link has expired. Please request a new one.',
          });
        }

        // Hash new password
        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

        // Update password and clear reset token
        await server.prisma.user.update({
          where: { id: user.id },
          data: {
            passwordHash,
            passwordResetToken: null,
            passwordResetExpires: null,
            failedLoginAttempts: 0,
            lockoutUntil: null,
          },
        });

        return reply.send({
          success: true,
          message: 'Password has been reset successfully. You can now log in.',
        });
      } catch (error) {
        request.log.error(error, 'Password reset failed');
        return reply.status(500).send({
          success: false,
          error: 'Failed to reset password. Please try again.',
        });
      }
    }
  );

  // Resend verification email
  server.post<{ Body: ResendVerificationBody }>(
    '/resend-verification',
    async (request: FastifyRequest<{ Body: ResendVerificationBody }>, reply: FastifyReply) => {
      const { email } = request.body;

      try {
        if (!email) {
          return reply.status(400).send({ success: false, error: 'Email is required' });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Always return success to prevent email enumeration
        const successResponse = {
          success: true,
          message: 'If an unverified account exists with this email, you will receive a verification email shortly.',
        };

        // Find user
        const user = await server.prisma.user.findFirst({
          where: { firebaseUid: `email:${normalizedEmail}` },
        });

        if (!user || user.emailVerified) {
          return reply.send(successResponse);
        }

        // Check cooldown - prevent spam
        if (user.emailVerificationExpires) {
          const tokenAge = Date.now() - (user.emailVerificationExpires.getTime() - VERIFICATION_EXPIRY_MS);
          if (tokenAge < RESEND_COOLDOWN_MS) {
            return reply.status(429).send({
              success: false,
              error: 'Please wait a minute before requesting another verification email.',
            });
          }
        }

        // Generate new verification token
        const verificationToken = generateSecureToken();
        const verificationExpires = new Date(Date.now() + VERIFICATION_EXPIRY_MS);

        // Update user with new token
        await server.prisma.user.update({
          where: { id: user.id },
          data: {
            emailVerificationToken: verificationToken,
            emailVerificationExpires: verificationExpires,
          },
        });

        // Send verification email
        await sendVerificationEmail(normalizedEmail, user.name, verificationToken);

        return reply.send(successResponse);
      } catch (error) {
        request.log.error(error, 'Resend verification failed');
        return reply.status(500).send({
          success: false,
          error: 'Failed to send verification email. Please try again.',
        });
      }
    }
  );
}
