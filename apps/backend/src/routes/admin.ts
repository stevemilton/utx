import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { timingSafeEqual } from 'crypto';
import { sendClubVerifiedEmail, sendClubRejectedEmail, sendClubCreatedNotification } from '../services/email';

/**
 * Constant-time comparison of two strings to prevent timing attacks.
 * Uses crypto.timingSafeEqual to ensure comparison time doesn't leak information.
 */
function safeCompare(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  // If lengths differ, we still perform a comparison to maintain constant time
  if (aBuffer.length !== bBuffer.length) {
    // Compare against itself to maintain timing consistency
    timingSafeEqual(aBuffer, aBuffer);
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}

// Platform Admin Routes
// Protected by ADMIN_API_KEY or user with isSuperAdmin=true
export async function adminRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma;

  // Super admin authentication middleware
  // Accepts either: 1) x-admin-key header, or 2) authenticated user with isSuperAdmin=true
  const superAdminAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    // Option 1: API key auth (for scripts/automation)
    const adminKeyHeader = request.headers['x-admin-key'];
    const expectedKey = process.env.ADMIN_API_KEY;

    // Ensure adminKey is a string (headers can be string | string[] | undefined)
    const adminKey = Array.isArray(adminKeyHeader) ? adminKeyHeader[0] : adminKeyHeader;

    // Use constant-time comparison to prevent timing attacks
    if (adminKey && expectedKey && safeCompare(adminKey, expectedKey)) {
      return; // Authorized via API key
    }

    // Option 2: User-based auth (for in-app admin)
    // First try to authenticate the user
    try {
      await fastify.authenticate(request, reply);
    } catch {
      // If no valid token, and no valid API key, return 401
      if (!adminKey) {
        return reply.status(401).send({
          success: false,
          error: 'Authentication required',
        });
      }
      // Invalid API key
      return reply.status(401).send({
        success: false,
        error: 'Invalid admin key',
      });
    }

    // Check if authenticated user is a super admin
    const authUser = (request as any).authUser;
    if (!authUser) {
      return reply.status(401).send({
        success: false,
        error: 'Authentication required',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { isSuperAdmin: true },
    });

    if (!user?.isSuperAdmin) {
      return reply.status(403).send({
        success: false,
        error: 'Super admin access required',
      });
    }
  };

  // Legacy alias for backwards compatibility
  const adminAuth = superAdminAuth;

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

  // Test email sending (for debugging)
  fastify.post<{
    Body: { to?: string };
  }>('/test-email', {
    preHandler: [adminAuth],
  }, async (request, reply) => {
    const { to } = request.body || {};
    const testEmail = to || process.env.ADMIN_EMAIL || 'clubs@polarindustries.co';

    fastify.log.info(`[ADMIN] Testing email to: ${testEmail}`);

    try {
      const result = await sendClubCreatedNotification(
        'Test Club Name',
        'Test Location',
        'Test Creator',
        'test@example.com'
      );

      return {
        success: true,
        message: `Test email sent to ${testEmail}`,
        emailResult: result,
        config: {
          resendConfigured: !!process.env.RESEND_API_KEY,
          fromEmail: process.env.EMAIL_FROM || 'UTx <onboarding@resend.dev>',
          adminEmail: process.env.ADMIN_EMAIL || 'clubs@polarindustries.co',
        },
      };
    } catch (err: any) {
      fastify.log.error(err, 'Test email failed');
      return {
        success: false,
        error: err?.message || 'Unknown error',
        config: {
          resendConfigured: !!process.env.RESEND_API_KEY,
          fromEmail: process.env.EMAIL_FROM || 'UTx <onboarding@resend.dev>',
          adminEmail: process.env.ADMIN_EMAIL || 'clubs@polarindustries.co',
        },
      };
    }
  });

  // Check email configuration (no actual send)
  fastify.get('/email-config', {
    preHandler: [adminAuth],
  }, async (request, reply) => {
    return {
      success: true,
      config: {
        resendApiKeySet: !!process.env.RESEND_API_KEY,
        resendApiKeyPrefix: process.env.RESEND_API_KEY?.substring(0, 8) + '...',
        fromEmail: process.env.EMAIL_FROM || 'UTx <onboarding@resend.dev> (default)',
        adminEmail: process.env.ADMIN_EMAIL || 'clubs@polarindustries.co (default)',
        appUrl: process.env.APP_URL || 'https://utx-production.up.railway.app (default)',
      },
    };
  });
}
