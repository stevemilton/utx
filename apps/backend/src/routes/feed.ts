import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface FeedQuery {
  limit?: number;
  cursor?: string;
  type?: 'all' | 'following' | 'club' | 'squad';
  clubId?: string;
  squadId?: string;
}

export async function feedRoutes(server: FastifyInstance): Promise<void> {
  // Get personalized feed
  server.get<{ Querystring: FeedQuery }>(
    '/',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest<{ Querystring: FeedQuery }>, reply: FastifyReply) => {
      const userId = request.user!.id;
      const { limit = 20, cursor, type = 'all', clubId, squadId } = request.query;

      let userIds: string[] = [];

      switch (type) {
        case 'following':
          // Get users the current user follows
          const following = await server.prisma.follow.findMany({
            where: { followerId: userId },
            select: { followingId: true },
          });
          userIds = following.map((f) => f.followingId);
          // Include own workouts
          userIds.push(userId);
          break;

        case 'club':
          if (!clubId) {
            return reply.status(400).send({
              success: false,
              error: 'clubId is required for club feed',
            });
          }
          // Get all members of the club
          const clubMembers = await server.prisma.clubMembership.findMany({
            where: { clubId },
            select: { userId: true },
          });
          userIds = clubMembers.map((m) => m.userId);
          break;

        case 'squad':
          if (!squadId) {
            return reply.status(400).send({
              success: false,
              error: 'squadId is required for squad feed',
            });
          }
          // Get all members of the squad
          const squadMembers = await server.prisma.squadMembership.findMany({
            where: { squadId },
            select: { userId: true },
          });
          userIds = squadMembers.map((m) => m.userId);
          break;

        case 'all':
        default:
          // Show all public workouts (global feed)
          break;
      }

      const where: any = {
        isPublic: true,
      };

      if (type !== 'all' && userIds.length > 0) {
        where.userId = { in: userIds };
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
              displayName: true,
              username: true,
              avatarUrl: true,
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
                take: 1,
              },
            },
          },
          reactions: {
            where: { userId },
            select: { type: true },
          },
          _count: {
            select: {
              reactions: true,
              comments: true,
            },
          },
        },
      });

      const hasMore = workouts.length > limit;
      if (hasMore) workouts.pop();

      const nextCursor = hasMore ? workouts[workouts.length - 1]?.id : null;

      // Transform workouts to include user's reaction
      const transformedWorkouts = workouts.map((w) => ({
        ...w,
        userReaction: w.reactions[0]?.type || null,
        reactions: undefined,
      }));

      return reply.send({
        success: true,
        data: {
          workouts: transformedWorkouts,
          nextCursor,
          hasMore,
        },
      });
    }
  );

  // Get workout stats for the current user
  server.get(
    '/stats',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;

      // Get stats for last 7 days, 30 days, and all time
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [last7Days, last30Days, allTime, totalWorkouts] = await Promise.all([
        server.prisma.workout.aggregate({
          where: {
            userId,
            workoutDate: { gte: sevenDaysAgo },
          },
          _sum: {
            totalDistanceMetres: true,
            totalTimeSeconds: true,
            calories: true,
          },
          _count: true,
          _avg: {
            effortScore: true,
          },
        }),
        server.prisma.workout.aggregate({
          where: {
            userId,
            workoutDate: { gte: thirtyDaysAgo },
          },
          _sum: {
            totalDistanceMetres: true,
            totalTimeSeconds: true,
            calories: true,
          },
          _count: true,
          _avg: {
            effortScore: true,
          },
        }),
        server.prisma.workout.aggregate({
          where: { userId },
          _sum: {
            totalDistanceMetres: true,
            totalTimeSeconds: true,
            calories: true,
          },
          _avg: {
            effortScore: true,
          },
        }),
        server.prisma.workout.count({
          where: { userId },
        }),
      ]);

      return reply.send({
        success: true,
        data: {
          last7Days: {
            workoutCount: last7Days._count,
            totalMetres: last7Days._sum.totalDistanceMetres || 0,
            totalSeconds: last7Days._sum.totalTimeSeconds || 0,
            totalCalories: last7Days._sum.calories || 0,
            avgEffortScore: last7Days._avg.effortScore || 0,
          },
          last30Days: {
            workoutCount: last30Days._count,
            totalMetres: last30Days._sum.totalDistanceMetres || 0,
            totalSeconds: last30Days._sum.totalTimeSeconds || 0,
            totalCalories: last30Days._sum.calories || 0,
            avgEffortScore: last30Days._avg.effortScore || 0,
          },
          allTime: {
            workoutCount: totalWorkouts,
            totalMetres: allTime._sum.totalDistanceMetres || 0,
            totalSeconds: allTime._sum.totalTimeSeconds || 0,
            totalCalories: allTime._sum.calories || 0,
            avgEffortScore: allTime._avg.effortScore || 0,
          },
        },
      });
    }
  );

  // Get recent activity (reactions, comments, follows)
  server.get(
    '/activity',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;

      // Get recent reactions on user's workouts
      const recentReactions = await server.prisma.workoutReaction.findMany({
        where: {
          workout: { userId },
          userId: { not: userId }, // Exclude own reactions
        },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          workout: {
            select: {
              id: true,
              workoutType: true,
              totalDistanceMetres: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      // Get recent comments on user's workouts
      const recentComments = await server.prisma.workoutComment.findMany({
        where: {
          workout: { userId },
          userId: { not: userId }, // Exclude own comments
        },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          workout: {
            select: {
              id: true,
              workoutType: true,
              totalDistanceMetres: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      // Get recent new followers
      const recentFollowers = await server.prisma.follow.findMany({
        where: { followingId: userId },
        include: {
          follower: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      // Combine and sort by date
      const activity = [
        ...recentReactions.map((r) => ({
          type: 'reaction' as const,
          user: r.user,
          workout: r.workout,
          reactionType: r.type,
          createdAt: r.createdAt,
        })),
        ...recentComments.map((c) => ({
          type: 'comment' as const,
          user: c.user,
          workout: c.workout,
          content: c.content,
          createdAt: c.createdAt,
        })),
        ...recentFollowers.map((f) => ({
          type: 'follow' as const,
          user: f.follower,
          createdAt: f.createdAt,
        })),
      ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return reply.send({
        success: true,
        data: {
          activity: activity.slice(0, 20),
        },
      });
    }
  );
}
