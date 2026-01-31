import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface UpdateProfileBody {
  displayName?: string;
  username?: string;
  avatarUrl?: string;
  birthDate?: string;
  gender?: 'male' | 'female' | 'prefer_not_to_say';
  heightCm?: number;
  weightKg?: number;
  maxHr?: number;
  restingHr?: number;
  bio?: string;
  location?: string;
  preferredUnits?: 'metric' | 'imperial';
  hasCompletedOnboarding?: boolean;
}

interface GetUserParams {
  userId: string;
}

export async function userRoutes(server: FastifyInstance): Promise<void> {
  // Get current user profile
  server.get(
    '/me',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;

      const user = await server.prisma.user.findUnique({
        where: { id: userId },
        include: {
          clubMemberships: {
            include: {
              club: {
                select: {
                  id: true,
                  name: true,
                  logoUrl: true,
                },
              },
            },
          },
          squadMemberships: {
            include: {
              squad: {
                select: {
                  id: true,
                  name: true,
                  clubId: true,
                },
              },
            },
          },
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
        data: { user },
      });
    }
  );

  // Update current user profile
  server.patch<{ Body: UpdateProfileBody }>(
    '/me',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest<{ Body: UpdateProfileBody }>, reply: FastifyReply) => {
      const userId = request.user!.id;
      const updateData = request.body;

      // Check username uniqueness if updating
      if (updateData.username) {
        const existing = await server.prisma.user.findUnique({
          where: { username: updateData.username },
        });

        if (existing && existing.id !== userId) {
          return reply.status(409).send({
            success: false,
            error: 'Username already taken',
          });
        }
      }

      const user = await server.prisma.user.update({
        where: { id: userId },
        data: {
          ...updateData,
          birthDate: updateData.birthDate ? new Date(updateData.birthDate) : undefined,
        },
      });

      return reply.send({
        success: true,
        data: { user },
      });
    }
  );

  // Get another user's public profile
  server.get<{ Params: GetUserParams }>(
    '/:userId',
    { preHandler: [server.optionalAuth] },
    async (request: FastifyRequest<{ Params: GetUserParams }>, reply: FastifyReply) => {
      const { userId } = request.params;
      const currentUserId = request.user?.id;

      const user = await server.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          displayName: true,
          username: true,
          avatarUrl: true,
          bio: true,
          location: true,
          gender: true,
          createdAt: true,
          clubMemberships: {
            include: {
              club: {
                select: {
                  id: true,
                  name: true,
                  logoUrl: true,
                },
              },
            },
          },
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

      // Check if current user follows this user
      let isFollowing = false;
      if (currentUserId) {
        const follow = await server.prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: currentUserId,
              followingId: userId,
            },
          },
        });
        isFollowing = !!follow;
      }

      return reply.send({
        success: true,
        data: {
          user,
          isFollowing,
        },
      });
    }
  );

  // Follow a user
  server.post<{ Params: GetUserParams }>(
    '/:userId/follow',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest<{ Params: GetUserParams }>, reply: FastifyReply) => {
      const { userId } = request.params;
      const currentUserId = request.user!.id;

      if (userId === currentUserId) {
        return reply.status(400).send({
          success: false,
          error: 'Cannot follow yourself',
        });
      }

      // Check if target user exists
      const targetUser = await server.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!targetUser) {
        return reply.status(404).send({
          success: false,
          error: 'User not found',
        });
      }

      // Create follow relationship (upsert to handle duplicates)
      await server.prisma.follow.upsert({
        where: {
          followerId_followingId: {
            followerId: currentUserId,
            followingId: userId,
          },
        },
        update: {},
        create: {
          followerId: currentUserId,
          followingId: userId,
        },
      });

      return reply.send({
        success: true,
        message: 'Now following user',
      });
    }
  );

  // Unfollow a user
  server.delete<{ Params: GetUserParams }>(
    '/:userId/follow',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest<{ Params: GetUserParams }>, reply: FastifyReply) => {
      const { userId } = request.params;
      const currentUserId = request.user!.id;

      await server.prisma.follow.deleteMany({
        where: {
          followerId: currentUserId,
          followingId: userId,
        },
      });

      return reply.send({
        success: true,
        message: 'Unfollowed user',
      });
    }
  );

  // Get user's followers
  server.get<{ Params: GetUserParams }>(
    '/:userId/followers',
    async (request: FastifyRequest<{ Params: GetUserParams }>, reply: FastifyReply) => {
      const { userId } = request.params;

      const followers = await server.prisma.follow.findMany({
        where: { followingId: userId },
        include: {
          follower: {
            select: {
              id: true,
              displayName: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return reply.send({
        success: true,
        data: {
          followers: followers.map((f) => f.follower),
        },
      });
    }
  );

  // Get users that a user is following
  server.get<{ Params: GetUserParams }>(
    '/:userId/following',
    async (request: FastifyRequest<{ Params: GetUserParams }>, reply: FastifyReply) => {
      const { userId } = request.params;

      const following = await server.prisma.follow.findMany({
        where: { followerId: userId },
        include: {
          following: {
            select: {
              id: true,
              displayName: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return reply.send({
        success: true,
        data: {
          following: following.map((f) => f.following),
        },
      });
    }
  );

  // Check username availability
  server.get<{ Querystring: { username: string } }>(
    '/check-username',
    async (request: FastifyRequest<{ Querystring: { username: string } }>, reply: FastifyReply) => {
      const { username } = request.query;

      if (!username || username.length < 3) {
        return reply.status(400).send({
          success: false,
          error: 'Username must be at least 3 characters',
        });
      }

      const existing = await server.prisma.user.findUnique({
        where: { username },
      });

      return reply.send({
        success: true,
        data: {
          available: !existing,
        },
      });
    }
  );
}
