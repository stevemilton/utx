import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getAuth } from 'firebase-admin/auth';
import * as jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

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
  avatarUrl?: string;
}

interface VerifyBody {
  firebaseToken: string;
  provider?: 'apple' | 'google';
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
      const { firebaseToken, provider, name, email, heightCm, weightKg, birthDate, gender, maxHr, avatarUrl } = request.body;

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
        // Delete user and all related data (cascade)
        await server.prisma.user.delete({
          where: { id: userId },
        });

        // Also delete from Firebase
        const user = await server.prisma.user.findUnique({
          where: { id: userId },
          select: { firebaseUid: true },
        });

        if (user) {
          await auth.deleteUser(user.firebaseUid);
        }

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
}
