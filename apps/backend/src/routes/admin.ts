import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { sendClubVerifiedEmail, sendClubRejectedEmail, sendClubCreatedNotification } from '../services/email';

// Platform Admin Routes
// Protected by ADMIN_API_KEY environment variable
export async function adminRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma;

  // Admin authentication middleware
  const adminAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    const adminKey = request.headers['x-admin-key'];
    const expectedKey = process.env.ADMIN_API_KEY;

    if (!expectedKey) {
      fastify.log.error('ADMIN_API_KEY not configured');
      return reply.status(503).send({
        success: false,
        error: 'Admin API not configured',
      });
    }

    if (!adminKey || adminKey !== expectedKey) {
      return reply.status(401).send({
        success: false,
        error: 'Invalid admin key',
      });
    }
  };

  // List pending (unverified) clubs
  fastify.get('/clubs/pending', {
    preHandler: [adminAuth],
  }, async (request, reply) => {
    const pendingClubs = await prisma.club.findMany({
      where: { verified: false },
      include: {
        memberships: {
          where: { role: 'admin' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          take: 1,
        },
        _count: {
          select: { memberships: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      success: true,
      data: pendingClubs.map(club => ({
        id: club.id,
        name: club.name,
        location: club.location,
        inviteCode: club.inviteCode,
        createdAt: club.createdAt,
        memberCount: club._count.memberships,
        creator: club.memberships[0]?.user || null,
      })),
    };
  });

  // Verify a club
  fastify.post<{ Params: { id: string } }>('/clubs/:id/verify', {
    preHandler: [adminAuth],
  }, async (request, reply) => {
    const { id: clubId } = request.params;

    const club = await prisma.club.findUnique({
      where: { id: clubId },
      include: {
        memberships: {
          where: { role: 'admin' },
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
          take: 1,
        },
      },
    });

    if (!club) {
      return reply.status(404).send({
        success: false,
        error: 'Club not found',
      });
    }

    if (club.verified) {
      return reply.status(400).send({
        success: false,
        error: 'Club is already verified',
      });
    }

    await prisma.club.update({
      where: { id: clubId },
      data: { verified: true },
    });

    // Send email to club creator
    const creator = club.memberships[0]?.user;
    if (creator?.email) {
      try {
        await sendClubVerifiedEmail(
          creator.email,
          creator.name,
          club.name,
          club.inviteCode
        );
      } catch (err) {
        fastify.log.error(err, 'Failed to send club verified email');
      }
    }

    return {
      success: true,
      message: `Club "${club.name}" has been verified`,
    };
  });

  // Reject a club (deletes it)
  fastify.post<{
    Params: { id: string };
    Body: { reason?: string };
  }>('/clubs/:id/reject', {
    preHandler: [adminAuth],
  }, async (request, reply) => {
    const { id: clubId } = request.params;
    const { reason } = request.body || {};

    const club = await prisma.club.findUnique({
      where: { id: clubId },
      include: {
        memberships: {
          where: { role: 'admin' },
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
          take: 1,
        },
      },
    });

    if (!club) {
      return reply.status(404).send({
        success: false,
        error: 'Club not found',
      });
    }

    // Store creator info before deletion
    const creator = club.memberships[0]?.user;
    const clubName = club.name;

    // Delete club and all related data
    await prisma.$transaction(async (tx) => {
      // Get all squad IDs for this club
      const squads = await tx.squad.findMany({
        where: { clubId },
        select: { id: true },
      });
      const squadIds = squads.map(s => s.id);

      // Delete squad memberships
      if (squadIds.length > 0) {
        await tx.squadMembership.deleteMany({
          where: { squadId: { in: squadIds } },
        });
      }

      // Delete squads
      await tx.squad.deleteMany({ where: { clubId } });

      // Delete club memberships
      await tx.clubMembership.deleteMany({ where: { clubId } });

      // Delete join requests
      await tx.clubJoinRequest.deleteMany({ where: { clubId } });

      // Delete club
      await tx.club.delete({ where: { id: clubId } });
    });

    // Send rejection email to creator
    if (creator?.email) {
      try {
        await sendClubRejectedEmail(
          creator.email,
          creator.name,
          clubName,
          reason
        );
      } catch (err) {
        fastify.log.error(err, 'Failed to send club rejected email');
      }
    }

    return {
      success: true,
      message: `Club "${clubName}" has been rejected and deleted`,
    };
  });

  // List all clubs (for admin overview)
  fastify.get('/clubs', {
    preHandler: [adminAuth],
  }, async (request, reply) => {
    const clubs = await prisma.club.findMany({
      include: {
        _count: {
          select: { memberships: true, squads: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: clubs.map(club => ({
        id: club.id,
        name: club.name,
        location: club.location,
        verified: club.verified,
        inviteCode: club.inviteCode,
        createdAt: club.createdAt,
        memberCount: club._count.memberships,
        squadCount: club._count.squads,
      })),
    };
  });
}
