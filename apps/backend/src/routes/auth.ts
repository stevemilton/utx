import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getAuth } from 'firebase-admin/auth';

interface RegisterBody {
  firebaseToken: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
}

interface VerifyBody {
  firebaseToken: string;
}

export async function authRoutes(server: FastifyInstance): Promise<void> {
  const auth = getAuth();

  // Register or login user
  server.post<{ Body: RegisterBody }>(
    '/register',
    async (request: FastifyRequest<{ Body: RegisterBody }>, reply: FastifyReply) => {
      const { firebaseToken, email, displayName, avatarUrl } = request.body;

      try {
        // Verify the Firebase token
        const decodedToken = await auth.verifyIdToken(firebaseToken);
        const firebaseUid = decodedToken.uid;

        // Check if user already exists
        let user = await server.prisma.user.findUnique({
          where: { firebaseUid },
        });

        if (user) {
          // User exists, return them
          return reply.send({
            success: true,
            data: {
              user,
              isNewUser: false,
            },
          });
        }

        // Create new user
        user = await server.prisma.user.create({
          data: {
            firebaseUid,
            email: email || decodedToken.email,
            displayName: displayName || decodedToken.name,
            avatarUrl: avatarUrl || decodedToken.picture,
          },
        });

        return reply.status(201).send({
          success: true,
          data: {
            user,
            isNewUser: true,
          },
        });
      } catch (error) {
        request.log.error(error, 'Registration failed');
        return reply.status(401).send({
          success: false,
          error: 'Invalid Firebase token',
        });
      }
    }
  );

  // Verify token and get user
  server.post<{ Body: VerifyBody }>(
    '/verify',
    async (request: FastifyRequest<{ Body: VerifyBody }>, reply: FastifyReply) => {
      const { firebaseToken } = request.body;

      try {
        const decodedToken = await auth.verifyIdToken(firebaseToken);

        const user = await server.prisma.user.findUnique({
          where: { firebaseUid: decodedToken.uid },
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

        return reply.send({
          success: true,
          data: { user },
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
      const userId = request.user!.id;

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
