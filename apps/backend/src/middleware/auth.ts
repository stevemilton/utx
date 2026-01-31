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

const auth = getAuth();

export interface AuthenticatedUser {
  id: string;
  firebaseUid: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
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
    const decodedToken = await auth.verifyIdToken(token);

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

    request.user = user;
  } catch (error) {
    request.log.error(error, 'Token verification failed');
    reply.status(401).send({
      success: false,
      error: 'Invalid token',
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
    const decodedToken = await auth.verifyIdToken(token);

    const user = await request.server.prisma.user.findUnique({
      where: { firebaseUid: decodedToken.uid },
      select: { id: true, firebaseUid: true },
    });

    if (user) {
      request.user = user;
    }
  } catch {
    // Ignore errors for optional auth
  }
}
