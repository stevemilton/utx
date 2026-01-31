import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface LeaderboardQuery {
  distance?: number;
  period?: 'week' | 'month' | 'year' | 'all';
  gender?: 'male' | 'female' | 'all';
  ageGroup?: string;
  weightClass?: 'lightweight' | 'heavyweight' | 'all';
  limit?: number;
  offset?: number;
}

const STANDARD_DISTANCES = [500, 1000, 2000, 5000, 6000, 10000, 21097, 42195];

// Age groups for classification
const AGE_GROUPS = [
  { name: 'U19', minAge: 0, maxAge: 18 },
  { name: '19-29', minAge: 19, maxAge: 29 },
  { name: '30-39', minAge: 30, maxAge: 39 },
  { name: '40-49', minAge: 40, maxAge: 49 },
  { name: '50-59', minAge: 50, maxAge: 59 },
  { name: '60-69', minAge: 60, maxAge: 69 },
  { name: '70+', minAge: 70, maxAge: 999 },
];

export async function leaderboardRoutes(server: FastifyInstance): Promise<void> {
  // Get global leaderboard for a distance
  server.get<{ Querystring: LeaderboardQuery }>(
    '/',
    async (request: FastifyRequest<{ Querystring: LeaderboardQuery }>, reply: FastifyReply) => {
      const {
        distance = 2000,
        period = 'all',
        gender = 'all',
        ageGroup,
        weightClass = 'all',
        limit = 50,
        offset = 0,
      } = request.query;

      // Validate distance
      if (!STANDARD_DISTANCES.includes(distance)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid distance. Must be a standard erg distance.',
        });
      }

      // Build date filter
      let dateFilter = {};
      const now = new Date();
      if (period === 'week') {
        dateFilter = { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
      } else if (period === 'month') {
        dateFilter = { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
      } else if (period === 'year') {
        dateFilter = { gte: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) };
      }

      // Build user filter
      const userFilter: any = {};

      if (gender !== 'all') {
        userFilter.gender = gender;
      }

      if (weightClass !== 'all') {
        if (weightClass === 'lightweight') {
          userFilter.OR = [
            { gender: 'male', weightKg: { lt: 75 } },
            { gender: 'female', weightKg: { lt: 61.5 } },
          ];
        } else {
          userFilter.OR = [
            { gender: 'male', weightKg: { gte: 75 } },
            { gender: 'female', weightKg: { gte: 61.5 } },
          ];
        }
      }

      if (ageGroup) {
        const group = AGE_GROUPS.find((g) => g.name === ageGroup);
        if (group) {
          const today = new Date();
          const minBirthDate = new Date(
            today.getFullYear() - group.maxAge - 1,
            today.getMonth(),
            today.getDate()
          );
          const maxBirthDate = new Date(
            today.getFullYear() - group.minAge,
            today.getMonth(),
            today.getDate()
          );

          userFilter.birthDate = {
            gte: minBirthDate,
            lte: maxBirthDate,
          };
        }
      }

      // Get personal bests
      const pbs = await server.prisma.personalBest.findMany({
        where: {
          distanceMetres: distance,
          ...(Object.keys(dateFilter).length > 0 ? { achievedAt: dateFilter } : {}),
          user: Object.keys(userFilter).length > 0 ? userFilter : undefined,
        },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              username: true,
              avatarUrl: true,
              gender: true,
              birthDate: true,
              weightKg: true,
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
        },
        orderBy: { timeSeconds: 'asc' },
        skip: offset,
        take: limit + 1,
      });

      const hasMore = pbs.length > limit;
      if (hasMore) pbs.pop();

      // Calculate age and add rank
      const leaderboard = pbs.map((pb, index) => {
        const age = pb.user.birthDate
          ? Math.floor(
              (Date.now() - new Date(pb.user.birthDate).getTime()) /
                (365.25 * 24 * 60 * 60 * 1000)
            )
          : null;

        const userAgeGroup = age
          ? AGE_GROUPS.find((g) => age >= g.minAge && age <= g.maxAge)?.name
          : null;

        return {
          rank: offset + index + 1,
          user: {
            id: pb.user.id,
            displayName: pb.user.displayName,
            username: pb.user.username,
            avatarUrl: pb.user.avatarUrl,
            gender: pb.user.gender,
            age,
            ageGroup: userAgeGroup,
            club: pb.user.clubMemberships[0]?.club || null,
          },
          timeSeconds: pb.timeSeconds,
          split: pb.split,
          watts: pb.watts,
          achievedAt: pb.achievedAt,
        };
      });

      return reply.send({
        success: true,
        data: {
          distance,
          period,
          filters: {
            gender,
            ageGroup,
            weightClass,
          },
          leaderboard,
          hasMore,
          nextOffset: hasMore ? offset + limit : null,
        },
      });
    }
  );

  // Get user's rank on a leaderboard
  server.get<{ Querystring: LeaderboardQuery }>(
    '/my-rank',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest<{ Querystring: LeaderboardQuery }>, reply: FastifyReply) => {
      const userId = request.user!.id;
      const { distance = 2000, gender = 'all', ageGroup, weightClass = 'all' } = request.query;

      // Get user's PB for this distance
      const myPB = await server.prisma.personalBest.findUnique({
        where: {
          userId_distanceMetres: {
            userId,
            distanceMetres: distance,
          },
        },
      });

      if (!myPB) {
        return reply.send({
          success: true,
          data: {
            hasPB: false,
            rank: null,
            totalEntries: null,
            percentile: null,
          },
        });
      }

      // Build user filter (same as main leaderboard)
      const userFilter: any = {};

      if (gender !== 'all') {
        userFilter.gender = gender;
      }

      if (weightClass !== 'all') {
        if (weightClass === 'lightweight') {
          userFilter.OR = [
            { gender: 'male', weightKg: { lt: 75 } },
            { gender: 'female', weightKg: { lt: 61.5 } },
          ];
        } else {
          userFilter.OR = [
            { gender: 'male', weightKg: { gte: 75 } },
            { gender: 'female', weightKg: { gte: 61.5 } },
          ];
        }
      }

      // Count how many are faster
      const fasterCount = await server.prisma.personalBest.count({
        where: {
          distanceMetres: distance,
          timeSeconds: { lt: myPB.timeSeconds },
          user: Object.keys(userFilter).length > 0 ? userFilter : undefined,
        },
      });

      // Total entries
      const totalEntries = await server.prisma.personalBest.count({
        where: {
          distanceMetres: distance,
          user: Object.keys(userFilter).length > 0 ? userFilter : undefined,
        },
      });

      const rank = fasterCount + 1;
      const percentile = ((totalEntries - rank + 1) / totalEntries) * 100;

      return reply.send({
        success: true,
        data: {
          hasPB: true,
          rank,
          totalEntries,
          percentile: Math.round(percentile * 10) / 10,
          myTime: myPB.timeSeconds,
          mySplit: myPB.split,
        },
      });
    }
  );

  // Get available filter options
  server.get(
    '/filters',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        success: true,
        data: {
          distances: STANDARD_DISTANCES.map((d) => ({
            value: d,
            label: d >= 10000 ? `${d / 1000}k` : `${d}m`,
          })),
          periods: [
            { value: 'week', label: 'This Week' },
            { value: 'month', label: 'This Month' },
            { value: 'year', label: 'This Year' },
            { value: 'all', label: 'All Time' },
          ],
          genders: [
            { value: 'all', label: 'All' },
            { value: 'male', label: 'Men' },
            { value: 'female', label: 'Women' },
          ],
          ageGroups: AGE_GROUPS.map((g) => ({
            value: g.name,
            label: g.name,
          })),
          weightClasses: [
            { value: 'all', label: 'All' },
            { value: 'lightweight', label: 'Lightweight' },
            { value: 'heavyweight', label: 'Heavyweight/Open' },
          ],
        },
      });
    }
  );

  // Get total metres leaderboard
  server.get<{ Querystring: { period?: string; clubId?: string; limit?: number } }>(
    '/total-metres',
    async (
      request: FastifyRequest<{ Querystring: { period?: string; clubId?: string; limit?: number } }>,
      reply: FastifyReply
    ) => {
      const { period = 'month', clubId, limit = 50 } = request.query;

      // Build date filter
      let dateFilter: any = {};
      const now = new Date();
      if (period === 'week') {
        dateFilter = { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
      } else if (period === 'month') {
        dateFilter = { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
      } else if (period === 'year') {
        dateFilter = { gte: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) };
      }

      // Get club member IDs if filtering by club
      let memberIds: string[] | undefined;
      if (clubId) {
        const members = await server.prisma.clubMembership.findMany({
          where: { clubId },
          select: { userId: true },
        });
        memberIds = members.map((m) => m.userId);
      }

      // Aggregate total metres by user
      const stats = await server.prisma.workout.groupBy({
        by: ['userId'],
        where: {
          ...(Object.keys(dateFilter).length > 0 ? { workoutDate: dateFilter } : {}),
          ...(memberIds ? { userId: { in: memberIds } } : {}),
        },
        _sum: {
          totalDistanceMetres: true,
        },
        _count: true,
        orderBy: {
          _sum: {
            totalDistanceMetres: 'desc',
          },
        },
        take: limit,
      });

      // Get user details
      const userIds = stats.map((s) => s.userId);
      const users = await server.prisma.user.findMany({
        where: { id: { in: userIds } },
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
      });

      const userMap = new Map(users.map((u) => [u.id, u]));

      const leaderboard = stats.map((s, index) => {
        const user = userMap.get(s.userId);
        return {
          rank: index + 1,
          user: user
            ? {
                id: user.id,
                displayName: user.displayName,
                username: user.username,
                avatarUrl: user.avatarUrl,
                club: user.clubMemberships[0]?.club || null,
              }
            : null,
          totalMetres: s._sum.totalDistanceMetres || 0,
          workoutCount: s._count,
        };
      });

      return reply.send({
        success: true,
        data: {
          period,
          leaderboard,
        },
      });
    }
  );
}
