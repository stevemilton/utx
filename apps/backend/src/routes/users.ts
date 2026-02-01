import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface UpdateProfileBody {
  name?: string;
  heightCm?: number;
  weightKg?: number;
  birthDate?: string;
  gender?: 'male' | 'female' | 'prefer_not_to_say';
  maxHr?: number;
  hasCompletedOnboarding?: boolean;
}

interface UserParams {
  userId: string;
}

export async function usersRoutes(server: FastifyInstance): Promise<void> {
  // Get current user profile
  server.get(
    '/me',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.authUser!.id;

      const user = await server.prisma.user.findUnique({
        where: { id: userId },
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
          personalBests: true,
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
        data: user,
      });
    }
  );

  // Update current user profile
  server.patch<{ Body: UpdateProfileBody }>(
    '/me',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest<{ Body: UpdateProfileBody }>, reply: FastifyReply) => {
      const userId = request.authUser!.id;
      const { name, heightCm, weightKg, birthDate, gender, maxHr, hasCompletedOnboarding } = request.body;

      // Build update data object with only provided fields
      const updateData: Record<string, unknown> = {};

      if (name !== undefined) updateData.name = name;
      if (heightCm !== undefined) updateData.heightCm = heightCm;
      if (weightKg !== undefined) updateData.weightKg = weightKg;
      if (birthDate !== undefined) updateData.birthDate = new Date(birthDate);
      if (gender !== undefined) updateData.gender = gender;
      if (maxHr !== undefined) updateData.maxHr = maxHr;
      if (hasCompletedOnboarding !== undefined) updateData.hasCompletedOnboarding = hasCompletedOnboarding;

      try {
        const user = await server.prisma.user.update({
          where: { id: userId },
          data: updateData,
        });

        return reply.send({
          success: true,
          data: user,
        });
      } catch (error) {
        request.log.error(error, 'Profile update failed');
        return reply.status(500).send({
          success: false,
          error: 'Failed to update profile',
        });
      }
    }
  );

  // Get user profile by ID
  server.get<{ Params: UserParams }>(
    '/:userId',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest<{ Params: UserParams }>, reply: FastifyReply) => {
      const { userId } = request.params;

      const user = await server.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          heightCm: true,
          weightKg: true,
          createdAt: true,
          personalBests: true,
          _count: {
            select: {
              workouts: true,
              followers: true,
              following: true,
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
        data: user,
      });
    }
  );

  // Follow a user
  server.post<{ Params: UserParams }>(
    '/:userId/follow',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest<{ Params: UserParams }>, reply: FastifyReply) => {
      const currentUserId = request.authUser!.id;
      const { userId } = request.params;

      if (currentUserId === userId) {
        return reply.status(400).send({
          success: false,
          error: 'Cannot follow yourself',
        });
      }

      try {
        await server.prisma.follow.create({
          data: {
            followerId: currentUserId,
            followingId: userId,
          },
        });

        return reply.send({
          success: true,
          message: 'User followed',
        });
      } catch (error: any) {
        if (error.code === 'P2002') {
          return reply.status(400).send({
            success: false,
            error: 'Already following this user',
          });
        }
        throw error;
      }
    }
  );

  // Unfollow a user
  server.delete<{ Params: UserParams }>(
    '/:userId/unfollow',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest<{ Params: UserParams }>, reply: FastifyReply) => {
      const currentUserId = request.authUser!.id;
      const { userId } = request.params;

      await server.prisma.follow.deleteMany({
        where: {
          followerId: currentUserId,
          followingId: userId,
        },
      });

      return reply.send({
        success: true,
        message: 'User unfollowed',
      });
    }
  );

  // Get user's followers
  server.get<{ Params: UserParams }>(
    '/:userId/followers',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest<{ Params: UserParams }>, reply: FastifyReply) => {
      const { userId } = request.params;

      const followers = await server.prisma.follow.findMany({
        where: { followingId: userId },
        include: {
          follower: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      });

      return reply.send({
        success: true,
        data: followers.map((f) => f.follower),
      });
    }
  );

  // Get users the user is following
  server.get<{ Params: UserParams }>(
    '/:userId/following',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest<{ Params: UserParams }>, reply: FastifyReply) => {
      const { userId } = request.params;

      const following = await server.prisma.follow.findMany({
        where: { followerId: userId },
        include: {
          following: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      });

      return reply.send({
        success: true,
        data: following.map((f) => f.following),
      });
    }
  );
}
