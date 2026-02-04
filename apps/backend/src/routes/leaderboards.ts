import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient, WorkoutType, Gender } from '@prisma/client';

// Leaderboards Routes
export async function leaderboardsRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma;

  // Get global leaderboard
  fastify.get<{
    Querystring: {
      metric?: 'distance' | 'two_thousand' | 'five_thousand' | 'ten_thousand';
      period?: 'week' | 'month' | 'all';
      gender?: 'male' | 'female' | 'all';
      weightClass?: 'lightweight' | 'heavyweight' | 'all';
    };
  }>('/global', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = request.authUser!.id;
    const {
      metric = 'distance',
      period = 'month',
      gender = 'all',
      weightClass = 'all',
    } = request.query;

    // Calculate date range
    const now = new Date();
    let startDate: Date | undefined;
    if (period === 'week') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'month') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Build user filter
    const userFilter: any = {};
    if (gender !== 'all') {
      userFilter.gender = gender as Gender;
    }
    if (weightClass === 'lightweight') {
      userFilter.OR = [
        { gender: 'male', weightKg: { lt: 75 } },
        { gender: 'female', weightKg: { lt: 61.5 } },
      ];
    } else if (weightClass === 'heavyweight') {
      userFilter.OR = [
        { gender: 'male', weightKg: { gte: 75 } },
        { gender: 'female', weightKg: { gte: 61.5 } },
      ];
    }

    if (metric === 'distance') {
      // Total metres leaderboard - only public workouts
      const leaderboard = await prisma.workout.groupBy({
        by: ['userId'],
        where: {
          isPublic: true,
          ...(startDate ? { workoutDate: { gte: startDate } } : {}),
          user: Object.keys(userFilter).length > 0 ? userFilter : undefined,
        },
        _sum: {
          totalDistanceMetres: true,
        },
        orderBy: {
          _sum: {
            totalDistanceMetres: 'desc',
          },
        },
        take: 50,
      });

      // Get user details
      const userIds = leaderboard.map(l => l.userId);
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, avatarUrl: true },
      });
      const userMap = new Map(users.map(u => [u.id, u]));

      // Find current user's rank - only public workouts
      const allRankings = await prisma.workout.groupBy({
        by: ['userId'],
        where: {
          isPublic: true,
          ...(startDate ? { workoutDate: { gte: startDate } } : {}),
        },
        _sum: {
          totalDistanceMetres: true,
        },
        orderBy: {
          _sum: {
            totalDistanceMetres: 'desc',
          },
        },
      });
      const userRank = allRankings.findIndex(r => r.userId === userId) + 1;
      const userTotal = allRankings.find(r => r.userId === userId)?._sum.totalDistanceMetres || 0;

      return {
        success: true,
        data: {
          metric,
          period,
          leaderboard: leaderboard.map((entry, index) => ({
            rank: index + 1,
            userId: entry.userId,
            name: userMap.get(entry.userId)?.name || 'Unknown',
            avatarUrl: userMap.get(entry.userId)?.avatarUrl,
            value: entry._sum.totalDistanceMetres || 0,
            isCurrentUser: entry.userId === userId,
          })),
          currentUser: {
            rank: userRank || null,
            value: userTotal,
          },
        },
      };
    } else {
      // Best time leaderboard for specific distance
      const workoutType = metric as WorkoutType;

      const pbs = await prisma.personalBest.findMany({
        where: {
          category: metric as any,
          user: Object.keys(userFilter).length > 0 ? userFilter : undefined,
        },
        include: {
          user: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
        orderBy: {
          timeSeconds: 'asc',
        },
        take: 50,
      });

      // Find current user's PB and rank
      const userPb = await prisma.personalBest.findUnique({
        where: {
          userId_category: {
            userId,
            category: metric as any,
          },
        },
      });

      let userRank: number | null = null;
      if (userPb) {
        const betterPbs = await prisma.personalBest.count({
          where: {
            category: metric as any,
            timeSeconds: { lt: userPb.timeSeconds! },
          },
        });
        userRank = betterPbs + 1;
      }

      return {
        success: true,
        data: {
          metric,
          period: 'all', // PBs are all-time
          leaderboard: pbs.map((pb, index) => ({
            rank: index + 1,
            userId: pb.userId,
            name: pb.user.name,
            avatarUrl: pb.user.avatarUrl,
            value: pb.timeSeconds,
            achievedAt: pb.achievedAt,
            isCurrentUser: pb.userId === userId,
          })),
          currentUser: {
            rank: userRank,
            value: userPb?.timeSeconds || null,
          },
        },
      };
    }
  });

  // Get club leaderboard
  fastify.get<{
    Params: { clubId: string };
    Querystring: {
      metric?: 'distance' | 'two_thousand' | 'five_thousand';
      period?: 'week' | 'month' | 'all';
    };
  }>('/club/:clubId', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = request.authUser!.id;
    const { clubId } = request.params;
    const { metric = 'distance', period = 'month' } = request.query;

    // Check membership
    const membership = await prisma.clubMembership.findUnique({
      where: {
        clubId_userId: { clubId, userId },
      },
    });

    if (!membership) {
      return reply.status(403).send({
        success: false,
        error: 'You must be a club member to view this leaderboard',
      });
    }

    // Get club member IDs
    const members = await prisma.clubMembership.findMany({
      where: { clubId },
      select: { userId: true },
    });
    const memberIds = members.map(m => m.userId);

    const now = new Date();
    let startDate: Date | undefined;
    if (period === 'week') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'month') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    if (metric === 'distance') {
      // Club leaderboard - only public workouts
      const leaderboard = await prisma.workout.groupBy({
        by: ['userId'],
        where: {
          userId: { in: memberIds },
          isPublic: true,
          ...(startDate ? { workoutDate: { gte: startDate } } : {}),
        },
        _sum: {
          totalDistanceMetres: true,
        },
        orderBy: {
          _sum: {
            totalDistanceMetres: 'desc',
          },
        },
      });

      const users = await prisma.user.findMany({
        where: { id: { in: memberIds } },
        select: { id: true, name: true, avatarUrl: true },
      });
      const userMap = new Map(users.map(u => [u.id, u]));

      return {
        success: true,
        data: {
          metric,
          period,
          leaderboard: leaderboard.map((entry, index) => ({
            rank: index + 1,
            userId: entry.userId,
            name: userMap.get(entry.userId)?.name || 'Unknown',
            avatarUrl: userMap.get(entry.userId)?.avatarUrl,
            value: entry._sum.totalDistanceMetres || 0,
            isCurrentUser: entry.userId === userId,
          })),
        },
      };
    }

    return {
      success: true,
      data: {
        metric,
        period,
        leaderboard: [],
      },
    };
  });

  // Get squad leaderboard
  fastify.get<{
    Params: { squadId: string };
    Querystring: {
      metric?: 'distance';
      period?: 'week' | 'month' | 'all';
    };
  }>('/squad/:squadId', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = request.authUser!.id;
    const { squadId } = request.params;
    const { metric = 'distance', period = 'month' } = request.query;

    // Check membership
    const membership = await prisma.squadMembership.findUnique({
      where: {
        squadId_userId: { squadId, userId },
      },
    });

    if (!membership) {
      return reply.status(403).send({
        success: false,
        error: 'You must be a squad member to view this leaderboard',
      });
    }

    // Get squad member IDs
    const members = await prisma.squadMembership.findMany({
      where: { squadId },
      select: { userId: true },
    });
    const memberIds = members.map(m => m.userId);

    const now = new Date();
    let startDate: Date | undefined;
    if (period === 'week') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'month') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Squad leaderboard - only public workouts
    const leaderboard = await prisma.workout.groupBy({
      by: ['userId'],
      where: {
        userId: { in: memberIds },
        isPublic: true,
        ...(startDate ? { workoutDate: { gte: startDate } } : {}),
      },
      _sum: {
        totalDistanceMetres: true,
      },
      orderBy: {
        _sum: {
          totalDistanceMetres: 'desc',
        },
      },
    });

    const users = await prisma.user.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, name: true, avatarUrl: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    return {
      success: true,
      data: {
        metric,
        period,
        leaderboard: leaderboard.map((entry, index) => ({
          rank: index + 1,
          userId: entry.userId,
          name: userMap.get(entry.userId)?.name || 'Unknown',
          avatarUrl: userMap.get(entry.userId)?.avatarUrl,
          value: entry._sum.totalDistanceMetres || 0,
          isCurrentUser: entry.userId === userId,
        })),
      },
    };
  });
}
