import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';

// Generate a random invite code
function generateInviteCode(): string {
  return randomBytes(4).toString('hex').toUpperCase();
}

// Clubs & Squads Routes
export async function clubsRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma;

  // Search clubs
  fastify.get<{ Querystring: { q?: string } }>('/search', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { q } = request.query;

    const clubs = await prisma.club.findMany({
      where: q ? {
        name: {
          contains: q,
          mode: 'insensitive',
        },
      } : {},
      select: {
        id: true,
        name: true,
        location: true,
        verified: true,
        _count: {
          select: { memberships: true, squads: true },
        },
      },
      take: 20,
    });

    return {
      success: true,
      data: clubs.map(club => ({
        id: club.id,
        name: club.name,
        location: club.location,
        verified: club.verified,
        memberCount: club._count.memberships,
        squadCount: club._count.squads,
      })),
    };
  });

  // Get club by ID
  fastify.get<{ Params: { id: string } }>('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const userId = (request as any).userId;

    const club = await prisma.club.findUnique({
      where: { id },
      include: {
        squads: {
          select: {
            id: true,
            name: true,
            _count: { select: { memberships: true } },
          },
        },
        memberships: {
          where: { userId },
          select: { role: true },
        },
        _count: {
          select: { memberships: true },
        },
      },
    });

    if (!club) {
      return reply.status(404).send({
        success: false,
        error: 'Club not found',
      });
    }

    const userMembership = club.memberships[0];

    return {
      success: true,
      data: {
        id: club.id,
        name: club.name,
        location: club.location,
        verified: club.verified,
        memberCount: club._count.memberships,
        squads: club.squads.map(s => ({
          id: s.id,
          name: s.name,
          memberCount: s._count.memberships,
        })),
        userRole: userMembership?.role || null,
        isMember: !!userMembership,
      },
    };
  });

  // Create club (request - will need verification)
  fastify.post<{
    Body: { name: string; location?: string };
  }>('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = (request as any).userId;
    const { name, location } = request.body;

    if (!name || name.trim().length < 2) {
      return reply.status(400).send({
        success: false,
        error: 'Club name must be at least 2 characters',
      });
    }

    // Check for similar names (fuzzy matching)
    const existingClub = await prisma.club.findFirst({
      where: {
        name: {
          contains: name.trim(),
          mode: 'insensitive',
        },
      },
    });

    if (existingClub) {
      return reply.status(409).send({
        success: false,
        error: `A club with a similar name already exists: ${existingClub.name}`,
        existingClub: {
          id: existingClub.id,
          name: existingClub.name,
        },
      });
    }

    // Create club with creator as admin
    const club = await prisma.club.create({
      data: {
        name: name.trim(),
        location: location?.trim(),
        inviteCode: generateInviteCode(),
        verified: false, // Needs manual verification
        memberships: {
          create: {
            userId,
            role: 'admin',
          },
        },
      },
    });

    return {
      success: true,
      data: {
        id: club.id,
        name: club.name,
        location: club.location,
        inviteCode: club.inviteCode,
        verified: club.verified,
      },
      message: 'Club created. It will be verified within 24-48 hours.',
    };
  });

  // Join club by invite code
  fastify.post<{
    Body: { inviteCode: string };
  }>('/join', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = (request as any).userId;
    const { inviteCode } = request.body;

    const club = await prisma.club.findUnique({
      where: { inviteCode: inviteCode.toUpperCase() },
    });

    if (!club) {
      return reply.status(404).send({
        success: false,
        error: 'Invalid invite code',
      });
    }

    // Check if already a member
    const existingMembership = await prisma.clubMembership.findUnique({
      where: {
        clubId_userId: {
          clubId: club.id,
          userId,
        },
      },
    });

    if (existingMembership) {
      return reply.status(409).send({
        success: false,
        error: 'You are already a member of this club',
      });
    }

    await prisma.clubMembership.create({
      data: {
        clubId: club.id,
        userId,
        role: 'member',
      },
    });

    return {
      success: true,
      message: `Joined ${club.name}`,
      data: {
        clubId: club.id,
        clubName: club.name,
      },
    };
  });

  // Leave club
  fastify.post<{ Params: { id: string } }>('/:id/leave', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = (request as any).userId;
    const { id } = request.params;

    const membership = await prisma.clubMembership.findUnique({
      where: {
        clubId_userId: {
          clubId: id,
          userId,
        },
      },
    });

    if (!membership) {
      return reply.status(404).send({
        success: false,
        error: 'You are not a member of this club',
      });
    }

    await prisma.clubMembership.delete({
      where: { id: membership.id },
    });

    // Also remove from all squads in this club
    await prisma.squadMembership.deleteMany({
      where: {
        userId,
        squad: { clubId: id },
      },
    });

    return {
      success: true,
      message: 'Left the club',
    };
  });

  // Create squad (admin only)
  fastify.post<{
    Params: { id: string };
    Body: { name: string };
  }>('/:id/squads', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = (request as any).userId;
    const { id: clubId } = request.params;
    const { name } = request.body;

    // Check admin permission
    const membership = await prisma.clubMembership.findUnique({
      where: {
        clubId_userId: {
          clubId,
          userId,
        },
      },
    });

    if (!membership || membership.role !== 'admin') {
      return reply.status(403).send({
        success: false,
        error: 'Only club admins can create squads',
      });
    }

    const squad = await prisma.squad.create({
      data: {
        clubId,
        name: name.trim(),
        inviteCode: generateInviteCode(),
      },
    });

    return {
      success: true,
      data: {
        id: squad.id,
        name: squad.name,
        inviteCode: squad.inviteCode,
      },
    };
  });

  // Get squads for a club
  fastify.get<{ Params: { id: string } }>('/:id/squads', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id: clubId } = request.params;

    const squads = await prisma.squad.findMany({
      where: { clubId },
      include: {
        _count: { select: { memberships: true } },
      },
    });

    return {
      success: true,
      data: squads.map(s => ({
        id: s.id,
        name: s.name,
        memberCount: s._count.memberships,
      })),
    };
  });

  // Join squad
  fastify.post<{
    Body: { inviteCode: string };
  }>('/squads/join', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = (request as any).userId;
    const { inviteCode } = request.body;

    const squad = await prisma.squad.findUnique({
      where: { inviteCode: inviteCode.toUpperCase() },
      include: { club: true },
    });

    if (!squad) {
      return reply.status(404).send({
        success: false,
        error: 'Invalid invite code',
      });
    }

    // Check if user is member of the club
    const clubMembership = await prisma.clubMembership.findUnique({
      where: {
        clubId_userId: {
          clubId: squad.clubId,
          userId,
        },
      },
    });

    // Auto-join club if not a member
    if (!clubMembership) {
      await prisma.clubMembership.create({
        data: {
          clubId: squad.clubId,
          userId,
          role: 'member',
        },
      });
    }

    // Check if already in squad
    const existingSquadMembership = await prisma.squadMembership.findUnique({
      where: {
        squadId_userId: {
          squadId: squad.id,
          userId,
        },
      },
    });

    if (existingSquadMembership) {
      return reply.status(409).send({
        success: false,
        error: 'You are already a member of this squad',
      });
    }

    await prisma.squadMembership.create({
      data: {
        squadId: squad.id,
        userId,
        role: 'member',
      },
    });

    return {
      success: true,
      message: `Joined ${squad.name}`,
      data: {
        squadId: squad.id,
        squadName: squad.name,
        clubId: squad.clubId,
        clubName: squad.club.name,
      },
    };
  });

  // Get my clubs and squads
  fastify.get('/my', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = (request as any).userId;

    const clubMemberships = await prisma.clubMembership.findMany({
      where: { userId },
      include: {
        club: {
          select: {
            id: true,
            name: true,
            location: true,
            verified: true,
          },
        },
      },
    });

    const squadMemberships = await prisma.squadMembership.findMany({
      where: { userId },
      include: {
        squad: {
          select: {
            id: true,
            name: true,
            clubId: true,
            club: {
              select: { name: true },
            },
          },
        },
      },
    });

    return {
      success: true,
      data: {
        clubs: clubMemberships.map(m => ({
          ...m.club,
          role: m.role,
          joinedAt: m.joinedAt,
        })),
        squads: squadMemberships.map(m => ({
          id: m.squad.id,
          name: m.squad.name,
          clubId: m.squad.clubId,
          clubName: m.squad.club.name,
          role: m.role,
          joinedAt: m.joinedAt,
        })),
      },
    };
  });
}
