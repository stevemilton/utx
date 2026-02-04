import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface FeedQuery {
  limit?: number;
  cursor?: string;
  type?: 'all' | 'following' | 'squad';
}

export async function feedRoutes(server: FastifyInstance): Promise<void> {
  // Get personalized feed
  server.get<{ Querystring: FeedQuery }>(
    '/',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest<{ Querystring: FeedQuery }>, reply: FastifyReply) => {
      const userId = request.authUser!.id;
      const { limit = 20, cursor, type = 'all' } = request.query;

      let userIds: string[] = [];

      switch (type) {
        case 'following':
        case 'all':
        default:
          // Get users the current user follows (for both 'all' and 'following')
          // Feed should only show workouts from followed users, NOT user's own workouts
          // User's own workouts appear in "My Workouts" tab instead
          const following = await server.prisma.follow.findMany({
            where: { followerId: userId },
            select: { followingId: true },
          });
          userIds = following.map((f) => f.followingId);
          // DO NOT include own workouts - they go in My Workouts tab
          break;

        case 'squad':
          // Get user's squad memberships
          const squadMemberships = await server.prisma.squadMembership.findMany({
            where: { userId },
            select: { squadId: true },
          });

          if (squadMemberships.length > 0) {
            // Get all members of user's squads (excluding self)
            const squadIds = squadMemberships.map((m) => m.squadId);
            const squadMembers = await server.prisma.squadMembership.findMany({
              where: { squadId: { in: squadIds } },
              select: { userId: true },
            });
            // Exclude current user - their workouts are in My Workouts
            userIds = [...new Set(squadMembers.map((m) => m.userId))].filter(id => id !== userId);
          }
          break;
      }

      const where: any = {};

      if (userIds.length > 0) {
        // Feed: show ONLY followed/squad users' PUBLIC workouts
        // User's own workouts appear in "My Workouts" tab, not here
        where.AND = [
          { userId: { in: userIds } },
          { isPublic: true }, // Only show public workouts from followed users
        ];
      } else {
        // No follows yet - show empty feed (user's workouts are in My Workouts)
        return reply.send({
          success: true,
          data: [],
        });
      }

      if (cursor) {
        where.id = { lt: cursor };
      }

      const workouts = await server.prisma.workout.findMany({
        where,
        take: limit + 1,
        orderBy: { workoutDate: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
          _count: {
            select: {
              reactions: true,
              comments: true,
            },
          },
          reactions: {
            where: { userId },
            select: { id: true },
          },
        },
      });

      const hasMore = workouts.length > limit;
      if (hasMore) workouts.pop();

      const nextCursor = hasMore ? workouts[workouts.length - 1]?.id : null;

      // Transform to include hasUserReacted
      const transformedWorkouts = workouts.map((workout) => ({
        id: workout.id,
        userId: workout.userId,
        userName: workout.user.name,
        userAvatarUrl: workout.user.avatarUrl,
        workoutType: workout.workoutType,
        totalTimeSeconds: workout.totalTimeSeconds,
        totalDistanceMetres: workout.totalDistanceMetres,
        averageSplitSeconds: workout.averageSplitSeconds,
        averageRate: workout.averageRate,
        avgHeartRate: workout.avgHeartRate,
        effortScore: workout.effortScore,
        isPb: workout.isPb,
        reactionCount: workout._count.reactions,
        commentCount: workout._count.comments,
        hasUserReacted: workout.reactions.length > 0,
        workoutDate: workout.workoutDate,
        createdAt: workout.createdAt,
      }));

      return reply.send({
        success: true,
        data: transformedWorkouts,
      });
    }
  );

  // Squad feed shortcut
  server.get(
    '/squad',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.authUser!.id;

      const squadMemberships = await server.prisma.squadMembership.findMany({
        where: { userId },
        select: { squadId: true },
      });

      if (squadMemberships.length === 0) {
        return reply.send({
          success: true,
          data: [],
        });
      }

      const squadIds = squadMemberships.map((m) => m.squadId);
      const squadMembers = await server.prisma.squadMembership.findMany({
        where: { squadId: { in: squadIds } },
        select: { userId: true },
      });
      // Get squad members excluding current user (their workouts are in My Workouts)
      const userIds = [...new Set(squadMembers.map((m) => m.userId))].filter(id => id !== userId);

      if (userIds.length === 0) {
        return reply.send({
          success: true,
          data: [],
        });
      }

      const workouts = await server.prisma.workout.findMany({
        where: {
          userId: { in: userIds },
          isPublic: true, // Only show public workouts from squad members
        },
        take: 20,
        orderBy: { workoutDate: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
          _count: {
            select: {
              reactions: true,
              comments: true,
            },
          },
          reactions: {
            where: { userId },
            select: { id: true },
          },
        },
      });

      const transformedWorkouts = workouts.map((workout) => ({
        id: workout.id,
        userId: workout.userId,
        userName: workout.user.name,
        userAvatarUrl: workout.user.avatarUrl,
        workoutType: workout.workoutType,
        totalTimeSeconds: workout.totalTimeSeconds,
        totalDistanceMetres: workout.totalDistanceMetres,
        averageSplitSeconds: workout.averageSplitSeconds,
        averageRate: workout.averageRate,
        avgHeartRate: workout.avgHeartRate,
        effortScore: workout.effortScore,
        isPb: workout.isPb,
        reactionCount: workout._count.reactions,
        commentCount: workout._count.comments,
        hasUserReacted: workout.reactions.length > 0,
        workoutDate: workout.workoutDate,
        createdAt: workout.createdAt,
      }));

      return reply.send({
        success: true,
        data: transformedWorkouts,
      });
    }
  );

  // Following feed shortcut
  server.get(
    '/following',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.authUser!.id;

      const following = await server.prisma.follow.findMany({
        where: { followerId: userId },
        select: { followingId: true },
      });
      const userIds = following.map((f) => f.followingId);
      // DO NOT include own workouts - they go in My Workouts tab

      if (userIds.length === 0) {
        return reply.send({
          success: true,
          data: [],
        });
      }

      const workouts = await server.prisma.workout.findMany({
        where: {
          userId: { in: userIds },
          isPublic: true, // Only show public workouts from followed users
        },
        take: 20,
        orderBy: { workoutDate: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
          _count: {
            select: {
              reactions: true,
              comments: true,
            },
          },
          reactions: {
            where: { userId },
            select: { id: true },
          },
        },
      });

      const transformedWorkouts = workouts.map((workout) => ({
        id: workout.id,
        userId: workout.userId,
        userName: workout.user.name,
        userAvatarUrl: workout.user.avatarUrl,
        workoutType: workout.workoutType,
        totalTimeSeconds: workout.totalTimeSeconds,
        totalDistanceMetres: workout.totalDistanceMetres,
        averageSplitSeconds: workout.averageSplitSeconds,
        averageRate: workout.averageRate,
        avgHeartRate: workout.avgHeartRate,
        effortScore: workout.effortScore,
        isPb: workout.isPb,
        reactionCount: workout._count.reactions,
        commentCount: workout._count.comments,
        hasUserReacted: workout.reactions.length > 0,
        workoutDate: workout.workoutDate,
        createdAt: workout.createdAt,
      }));

      return reply.send({
        success: true,
        data: transformedWorkouts,
      });
    }
  );
}
