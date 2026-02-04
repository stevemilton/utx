import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface UpdateProfileBody {
  username?: string;
  name?: string;
  heightCm?: number;
  weightKg?: number;
  birthDate?: string;
  gender?: 'male' | 'female' | 'prefer_not_to_say';
  maxHr?: number;
  restingHr?: number; // Optional, improves effort score accuracy
  hasCompletedOnboarding?: boolean;
  isPublic?: boolean;
}

interface UserParams {
  userId: string;
}

interface SearchQuery {
  q: string;
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
      const { username, name, heightCm, weightKg, birthDate, gender, maxHr, restingHr, hasCompletedOnboarding } = request.body;

      // Build update data object with only provided fields
      const updateData: Record<string, unknown> = {};

      // Validate and sanitize username if provided
      if (username !== undefined) {
        if (username === '') {
          // Allow clearing username
          updateData.username = null;
        } else {
          // Validate username format: lowercase alphanumeric and underscores, 3-20 chars
          const sanitizedUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
          if (sanitizedUsername.length < 3 || sanitizedUsername.length > 20) {
            return reply.status(400).send({
              success: false,
              error: 'Username must be 3-20 characters (letters, numbers, underscores only)',
            });
          }

          // Check if username is already taken
          const existingUser = await server.prisma.user.findFirst({
            where: {
              username: sanitizedUsername,
              id: { not: userId },
            },
          });

          if (existingUser) {
            return reply.status(400).send({
              success: false,
              error: 'Username is already taken',
            });
          }

          updateData.username = sanitizedUsername;
        }
      }

      if (name !== undefined) updateData.name = name;
      if (heightCm !== undefined) updateData.heightCm = heightCm;
      if (weightKg !== undefined) updateData.weightKg = weightKg;
      if (birthDate !== undefined) updateData.birthDate = new Date(birthDate);
      if (gender !== undefined) updateData.gender = gender;
      if (maxHr !== undefined) updateData.maxHr = maxHr;
      if (restingHr !== undefined) updateData.restingHr = restingHr;
      if (hasCompletedOnboarding !== undefined) updateData.hasCompletedOnboarding = hasCompletedOnboarding;
      if (request.body.isPublic !== undefined) updateData.isPublic = request.body.isPublic;

      try {
        const user = await server.prisma.user.update({
          where: { id: userId },
          data: updateData,
        });

        return reply.send({
          success: true,
          data: user,
        });
      } catch (error: any) {
        // Handle unique constraint violation for username
        if (error.code === 'P2002' && error.meta?.target?.includes('username')) {
          return reply.status(400).send({
            success: false,
            error: 'Username is already taken',
          });
        }
        request.log.error(error, 'Profile update failed');
        return reply.status(500).send({
          success: false,
          error: 'Failed to update profile',
        });
      }
    }
  );

  // Upload avatar
  server.post(
    '/me/avatar',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.authUser!.id;

      try {
        // Handle multipart form data
        const data = await request.file();

        if (!data) {
          return reply.status(400).send({
            success: false,
            error: 'No file uploaded',
          });
        }

        // Read file buffer and convert to base64 data URL
        const buffer = await data.toBuffer();
        const base64 = buffer.toString('base64');
        const mimeType = data.mimetype || 'image/jpeg';
        const avatarUrl = `data:${mimeType};base64,${base64}`;

        // Update user with avatar URL
        const user = await server.prisma.user.update({
          where: { id: userId },
          data: { avatarUrl },
        });

        return reply.send({
          success: true,
          data: { avatarUrl: user.avatarUrl },
        });
      } catch (error) {
        request.log.error(error, 'Avatar upload failed');
        return reply.status(500).send({
          success: false,
          error: 'Failed to upload avatar',
        });
      }
    }
  );

  // Search for users (athletes)
  server.get<{ Querystring: SearchQuery }>(
    '/search',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest<{ Querystring: SearchQuery }>, reply: FastifyReply) => {
      const { q } = request.query;
      const currentUserId = request.authUser!.id;

      if (!q || q.length < 2) {
        return reply.send({
          success: true,
          data: [],
        });
      }

      // Remove @ prefix if searching by username
      const searchTerm = q.startsWith('@') ? q.slice(1) : q;

      // Search for public users by name OR username (case-insensitive)
      const users = await server.prisma.user.findMany({
        where: {
          AND: [
            { isPublic: true },
            { id: { not: currentUserId } }, // Exclude self
            {
              OR: [
                {
                  name: {
                    contains: searchTerm,
                    mode: 'insensitive',
                  },
                },
                {
                  username: {
                    contains: searchTerm,
                    mode: 'insensitive',
                  },
                },
              ],
            },
          ],
        },
        select: {
          id: true,
          username: true,
          name: true,
          avatarUrl: true,
          _count: {
            select: {
              workouts: true,
              followers: true,
            },
          },
        },
        take: 20,
      });

      // Check which users the current user is following
      const followingIds = await server.prisma.follow.findMany({
        where: {
          followerId: currentUserId,
          followingId: { in: users.map((u) => u.id) },
        },
        select: { followingId: true },
      });

      const followingSet = new Set(followingIds.map((f) => f.followingId));

      const usersWithFollowStatus = users.map((user) => ({
        ...user,
        isFollowing: followingSet.has(user.id),
      }));

      return reply.send({
        success: true,
        data: usersWithFollowStatus,
      });
    }
  );

  // Get user profile by ID
  server.get<{ Params: UserParams }>(
    '/:userId',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest<{ Params: UserParams }>, reply: FastifyReply) => {
      const { userId } = request.params;
      const currentUserId = request.authUser!.id;

      const user = await server.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          isPublic: true,
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

      // Check if current user is viewing their own profile
      const isOwnProfile = currentUserId === userId;

      // Check if current user follows this user
      let isFollowing = false;
      if (!isOwnProfile) {
        const followRecord = await server.prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: currentUserId,
              followingId: userId,
            },
          },
        });
        isFollowing = !!followRecord;
      }

      // If profile is private and viewer is not the owner and not following, return limited data
      if (!user.isPublic && !isOwnProfile && !isFollowing) {
        return reply.send({
          success: true,
          data: {
            id: user.id,
            name: user.name,
            avatarUrl: user.avatarUrl,
            isPrivate: true,
            isFollowing: false,
            _count: {
              followers: user._count.followers,
              following: user._count.following,
            },
          },
        });
      }

      return reply.send({
        success: true,
        data: {
          ...user,
          isPrivate: false,
          isFollowing,
        },
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
