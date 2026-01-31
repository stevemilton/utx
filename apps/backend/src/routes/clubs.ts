import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface CreateClubBody {
  name: string;
  description?: string;
  logoUrl?: string;
  location?: string;
}

interface UpdateClubBody {
  name?: string;
  description?: string;
  logoUrl?: string;
  location?: string;
}

interface CreateSquadBody {
  name: string;
  description?: string;
}

interface ClubParams {
  clubId: string;
}

interface SquadParams {
  clubId: string;
  squadId: string;
}

interface JoinClubBody {
  inviteCode: string;
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function clubRoutes(server: FastifyInstance): Promise<void> {
  // Create a new club
  server.post<{ Body: CreateClubBody }>(
    '/',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest<{ Body: CreateClubBody }>, reply: FastifyReply) => {
      const userId = request.user!.id;
      const { name, description, logoUrl, location } = request.body;

      const club = await server.prisma.club.create({
        data: {
          name,
          description,
          logoUrl,
          location,
          inviteCode: generateInviteCode(),
          memberships: {
            create: {
              userId,
              role: 'admin',
            },
          },
        },
        include: {
          memberships: {
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
          },
          _count: {
            select: {
              memberships: true,
              squads: true,
            },
          },
        },
      });

      return reply.status(201).send({
        success: true,
        data: { club },
      });
    }
  );

  // Get all clubs (public list)
  server.get(
    '/',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const clubs = await server.prisma.club.findMany({
        include: {
          _count: {
            select: {
              memberships: true,
              squads: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return reply.send({
        success: true,
        data: { clubs },
      });
    }
  );

  // Get a single club
  server.get<{ Params: ClubParams }>(
    '/:clubId',
    { preHandler: [server.optionalAuth] },
    async (request: FastifyRequest<{ Params: ClubParams }>, reply: FastifyReply) => {
      const { clubId } = request.params;
      const userId = request.user?.id;

      const club = await server.prisma.club.findUnique({
        where: { id: clubId },
        include: {
          memberships: {
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                  username: true,
                  avatarUrl: true,
                },
              },
            },
          },
          squads: {
            include: {
              _count: {
                select: {
                  memberships: true,
                },
              },
            },
          },
          _count: {
            select: {
              memberships: true,
              squads: true,
            },
          },
        },
      });

      if (!club) {
        return reply.status(404).send({
          success: false,
          error: 'Club not found',
        });
      }

      // Check if current user is a member
      let userMembership = null;
      if (userId) {
        userMembership = club.memberships.find((m) => m.userId === userId);
      }

      // Only show invite code to admins
      const responseClub = {
        ...club,
        inviteCode: userMembership?.role === 'admin' ? club.inviteCode : undefined,
      };

      return reply.send({
        success: true,
        data: {
          club: responseClub,
          userMembership,
        },
      });
    }
  );

  // Update club (admin only)
  server.patch<{ Params: ClubParams; Body: UpdateClubBody }>(
    '/:clubId',
    { preHandler: [server.authenticate] },
    async (
      request: FastifyRequest<{ Params: ClubParams; Body: UpdateClubBody }>,
      reply: FastifyReply
    ) => {
      const { clubId } = request.params;
      const userId = request.user!.id;
      const updateData = request.body;

      // Verify admin role
      const membership = await server.prisma.clubMembership.findUnique({
        where: {
          clubId_userId: { clubId, userId },
        },
      });

      if (!membership || membership.role !== 'admin') {
        return reply.status(403).send({
          success: false,
          error: 'Only club admins can update club details',
        });
      }

      const club = await server.prisma.club.update({
        where: { id: clubId },
        data: updateData,
      });

      return reply.send({
        success: true,
        data: { club },
      });
    }
  );

  // Join club with invite code
  server.post<{ Body: JoinClubBody }>(
    '/join',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest<{ Body: JoinClubBody }>, reply: FastifyReply) => {
      const userId = request.user!.id;
      const { inviteCode } = request.body;

      const club = await server.prisma.club.findUnique({
        where: { inviteCode },
      });

      if (!club) {
        return reply.status(404).send({
          success: false,
          error: 'Invalid invite code',
        });
      }

      // Check if already a member
      const existingMembership = await server.prisma.clubMembership.findUnique({
        where: {
          clubId_userId: { clubId: club.id, userId },
        },
      });

      if (existingMembership) {
        return reply.status(409).send({
          success: false,
          error: 'Already a member of this club',
        });
      }

      const membership = await server.prisma.clubMembership.create({
        data: {
          clubId: club.id,
          userId,
          role: 'member',
        },
        include: {
          club: true,
        },
      });

      return reply.status(201).send({
        success: true,
        data: { membership },
      });
    }
  );

  // Leave club
  server.delete<{ Params: ClubParams }>(
    '/:clubId/leave',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest<{ Params: ClubParams }>, reply: FastifyReply) => {
      const { clubId } = request.params;
      const userId = request.user!.id;

      // Check if user is the only admin
      const membership = await server.prisma.clubMembership.findUnique({
        where: {
          clubId_userId: { clubId, userId },
        },
      });

      if (!membership) {
        return reply.status(404).send({
          success: false,
          error: 'Not a member of this club',
        });
      }

      if (membership.role === 'admin') {
        const adminCount = await server.prisma.clubMembership.count({
          where: { clubId, role: 'admin' },
        });

        if (adminCount === 1) {
          return reply.status(400).send({
            success: false,
            error: 'Cannot leave club as the only admin. Transfer admin role first.',
          });
        }
      }

      // Remove from all squads in this club first
      await server.prisma.squadMembership.deleteMany({
        where: {
          userId,
          squad: { clubId },
        },
      });

      // Remove club membership
      await server.prisma.clubMembership.delete({
        where: {
          clubId_userId: { clubId, userId },
        },
      });

      return reply.send({
        success: true,
        message: 'Left club successfully',
      });
    }
  );

  // Create squad within club
  server.post<{ Params: ClubParams; Body: CreateSquadBody }>(
    '/:clubId/squads',
    { preHandler: [server.authenticate] },
    async (
      request: FastifyRequest<{ Params: ClubParams; Body: CreateSquadBody }>,
      reply: FastifyReply
    ) => {
      const { clubId } = request.params;
      const userId = request.user!.id;
      const { name, description } = request.body;

      // Verify admin or coach role
      const membership = await server.prisma.clubMembership.findUnique({
        where: {
          clubId_userId: { clubId, userId },
        },
      });

      if (!membership || !['admin', 'coach'].includes(membership.role)) {
        return reply.status(403).send({
          success: false,
          error: 'Only club admins or coaches can create squads',
        });
      }

      const squad = await server.prisma.squad.create({
        data: {
          clubId,
          name,
          description,
          memberships: {
            create: {
              userId,
              role: 'coach',
            },
          },
        },
        include: {
          _count: {
            select: {
              memberships: true,
            },
          },
        },
      });

      return reply.status(201).send({
        success: true,
        data: { squad },
      });
    }
  );

  // Get club's squads
  server.get<{ Params: ClubParams }>(
    '/:clubId/squads',
    async (request: FastifyRequest<{ Params: ClubParams }>, reply: FastifyReply) => {
      const { clubId } = request.params;

      const squads = await server.prisma.squad.findMany({
        where: { clubId },
        include: {
          memberships: {
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
          },
          _count: {
            select: {
              memberships: true,
            },
          },
        },
      });

      return reply.send({
        success: true,
        data: { squads },
      });
    }
  );

  // Join squad
  server.post<{ Params: SquadParams }>(
    '/:clubId/squads/:squadId/join',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest<{ Params: SquadParams }>, reply: FastifyReply) => {
      const { clubId, squadId } = request.params;
      const userId = request.user!.id;

      // Verify user is a club member
      const clubMembership = await server.prisma.clubMembership.findUnique({
        where: {
          clubId_userId: { clubId, userId },
        },
      });

      if (!clubMembership) {
        return reply.status(403).send({
          success: false,
          error: 'Must be a club member to join squads',
        });
      }

      // Check if already in squad
      const existing = await server.prisma.squadMembership.findUnique({
        where: {
          squadId_userId: { squadId, userId },
        },
      });

      if (existing) {
        return reply.status(409).send({
          success: false,
          error: 'Already a member of this squad',
        });
      }

      const membership = await server.prisma.squadMembership.create({
        data: {
          squadId,
          userId,
          role: 'athlete',
        },
        include: {
          squad: true,
        },
      });

      return reply.status(201).send({
        success: true,
        data: { membership },
      });
    }
  );

  // Leave squad
  server.delete<{ Params: SquadParams }>(
    '/:clubId/squads/:squadId/leave',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest<{ Params: SquadParams }>, reply: FastifyReply) => {
      const { squadId } = request.params;
      const userId = request.user!.id;

      await server.prisma.squadMembership.deleteMany({
        where: {
          squadId,
          userId,
        },
      });

      return reply.send({
        success: true,
        message: 'Left squad successfully',
      });
    }
  );

  // Regenerate invite code (admin only)
  server.post<{ Params: ClubParams }>(
    '/:clubId/regenerate-invite',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest<{ Params: ClubParams }>, reply: FastifyReply) => {
      const { clubId } = request.params;
      const userId = request.user!.id;

      // Verify admin role
      const membership = await server.prisma.clubMembership.findUnique({
        where: {
          clubId_userId: { clubId, userId },
        },
      });

      if (!membership || membership.role !== 'admin') {
        return reply.status(403).send({
          success: false,
          error: 'Only club admins can regenerate invite codes',
        });
      }

      const club = await server.prisma.club.update({
        where: { id: clubId },
        data: { inviteCode: generateInviteCode() },
        select: { inviteCode: true },
      });

      return reply.send({
        success: true,
        data: { inviteCode: club.inviteCode },
      });
    }
  );

  // Get club leaderboard
  server.get<{ Params: ClubParams; Querystring: { period?: string; distance?: number } }>(
    '/:clubId/leaderboard',
    async (
      request: FastifyRequest<{ Params: ClubParams; Querystring: { period?: string; distance?: number } }>,
      reply: FastifyReply
    ) => {
      const { clubId } = request.params;
      const { period = 'all', distance } = request.query;

      // Get all club member IDs
      const members = await server.prisma.clubMembership.findMany({
        where: { clubId },
        select: { userId: true },
      });
      const memberIds = members.map((m) => m.userId);

      let dateFilter = {};
      if (period === 'week') {
        dateFilter = { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
      } else if (period === 'month') {
        dateFilter = { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
      }

      if (distance) {
        // Leaderboard for specific distance (PB based)
        const pbs = await server.prisma.personalBest.findMany({
          where: {
            userId: { in: memberIds },
            distanceMetres: distance,
          },
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                username: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: { timeSeconds: 'asc' },
        });

        return reply.send({
          success: true,
          data: {
            leaderboard: pbs.map((pb, index) => ({
              rank: index + 1,
              user: pb.user,
              timeSeconds: pb.timeSeconds,
              split: pb.split,
              achievedAt: pb.achievedAt,
            })),
          },
        });
      }

      // Total metres leaderboard
      const stats = await server.prisma.workout.groupBy({
        by: ['userId'],
        where: {
          userId: { in: memberIds },
          ...(Object.keys(dateFilter).length > 0 ? { workoutDate: dateFilter } : {}),
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

      // Get user details
      const userIds = stats.map((s) => s.userId);
      const users = await server.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          displayName: true,
          username: true,
          avatarUrl: true,
        },
      });

      const userMap = new Map(users.map((u) => [u.id, u]));

      return reply.send({
        success: true,
        data: {
          leaderboard: stats.map((s, index) => ({
            rank: index + 1,
            user: userMap.get(s.userId),
            totalMetres: s._sum.totalDistanceMetres || 0,
          })),
        },
      });
    }
  );
}
