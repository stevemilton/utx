import { FastifyRequest, FastifyReply } from 'fastify';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin if not already done
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const firebaseAuth = getAuth();

export interface AuthenticatedUser {
  id: string;
  firebaseUid: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: AuthenticatedUser;
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.status(401).send({
      success: false,
      error: 'Missing or invalid authorization header',
    });
    return;
  }

  const token = authHeader.substring(7);

  try {
    // First, try to verify as our JWT token (from new auth flow)
    try {
      const decoded = await request.server.jwt.verify(token);
      const jwtPayload = decoded as { userId: string; provider: string };

      if (jwtPayload.userId) {
        const user = await request.server.prisma.user.findUnique({
          where: { id: jwtPayload.userId },
          select: { id: true, firebaseUid: true },
        });

        if (user) {
          request.authUser = user;
          return;
        }
      }
    } catch {
      // Not a valid JWT, try Firebase token below
    }

    // Fallback: try Firebase token verification (legacy)
    const decodedToken = await firebaseAuth.verifyIdToken(token);

    // Get user from database
    const user = await request.server.prisma.user.findUnique({
      where: { firebaseUid: decodedToken.uid },
      select: { id: true, firebaseUid: true },
    });

    if (!user) {
      reply.status(401).send({
        success: false,
        error: 'User not found',
      });
      return;
    }

    request.authUser = user;
  } catch (error: any) {
    request.log.error(error, 'Token verification failed');

    // Provide more specific error message for debugging
    let errorMessage = 'Invalid token';
    if (error?.code === 'auth/id-token-expired') {
      errorMessage = 'Token expired. Please log in again.';
    } else if (error?.code === 'auth/argument-error') {
      errorMessage = 'Invalid token format';
    } else if (error?.message?.includes('jwt malformed')) {
      errorMessage = 'JWT verification failed - malformed token';
    } else if (error?.message?.includes('invalid signature')) {
      errorMessage = 'JWT verification failed - invalid signature (check JWT_SECRET)';
    } else if (error?.message?.includes('jwt expired')) {
      errorMessage = 'Token expired. Please log in again.';
    }

    reply.status(401).send({
      success: false,
      error: errorMessage,
    });
  }
}

export async function optionalAuth(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return; // Continue without user
  }

  const token = authHeader.substring(7);

  try {
    // First, try to verify as our JWT token
    try {
      const decoded = await request.server.jwt.verify(token);
      const jwtPayload = decoded as { userId: string; provider: string };

      if (jwtPayload.userId) {
        const user = await request.server.prisma.user.findUnique({
          where: { id: jwtPayload.userId },
          select: { id: true, firebaseUid: true },
        });

        if (user) {
          request.authUser = user;
          return;
        }
      }
    } catch {
      // Not a valid JWT, try Firebase token below
    }

    // Fallback: try Firebase token verification (legacy)
    const decodedToken = await firebaseAuth.verifyIdToken(token);

    const user = await request.server.prisma.user.findUnique({
      where: { firebaseUid: decodedToken.uid },
      select: { id: true, firebaseUid: true },
    });

    if (user) {
      request.authUser = user;
    }
  } catch {
    // Ignore errors for optional auth
  }
}
