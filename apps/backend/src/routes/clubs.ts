import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';
import { sendClubCreatedNotification, sendJoinApprovedEmail, sendJoinRejectedEmail } from '../services/email';

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
        logoUrl: true,
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
        logoUrl: club.logoUrl,
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
    const userId = request.authUser!.id;

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
    const isAdmin = userMembership?.role === 'admin';

    // Get pending request count for admins
    let pendingRequestCount = 0;
    if (isAdmin) {
      pendingRequestCount = await prisma.clubJoinRequest.count({
        where: {
          clubId: id,
          status: 'pending',
        },
      });
    }

    // Get user's pending join request if they're not a member
    let userJoinRequest = null;
    if (!userMembership) {
      const request = await prisma.clubJoinRequest.findUnique({
        where: {
          clubId_userId: { clubId: id, userId },
        },
        select: {
          id: true,
          status: true,
          requestedAt: true,
          rejectionReason: true,
        },
      });
      if (request) {
        userJoinRequest = request;
      }
    }

    return {
      success: true,
      data: {
        id: club.id,
        name: club.name,
        location: club.location,
        logoUrl: club.logoUrl,
        verified: club.verified,
        inviteCode: userMembership ? club.inviteCode : undefined,
        memberCount: club._count.memberships,
        squads: club.squads.map(s => ({
          id: s.id,
          name: s.name,
          memberCount: s._count.memberships,
        })),
        userRole: userMembership?.role || null,
        isMember: !!userMembership,
        pendingRequestCount: isAdmin ? pendingRequestCount : undefined,
        userJoinRequest,
      },
    };
  });

  // Create club (request - will need verification)
  fastify.post<{
    Body: { name: string; location?: string };
  }>('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = request.authUser!.id;
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

    // Get creator info for notification
    const creator = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

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

    // Send notification to admin for verification
    try {
      await sendClubCreatedNotification(
        club.name,
        club.location,
        creator?.name || 'Unknown',
        creator?.email || null
      );
    } catch (err) {
      fastify.log.error(err, 'Failed to send club created notification');
    }

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
    const userId = request.authUser!.id;
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
    const userId = request.authUser!.id;
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
    const userId = request.authUser!.id;
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
    const userId = request.authUser!.id;
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
    const userId = request.authUser!.id;

    const clubMemberships = await prisma.clubMembership.findMany({
      where: { userId },
      include: {
        club: {
          select: {
            id: true,
            name: true,
            location: true,
            logoUrl: true,
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

  // ============================================
  // JOIN REQUEST ENDPOINTS
  // ============================================

  // Get user's pending join requests
  fastify.get('/my-requests', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = request.authUser!.id;

    const requests = await prisma.clubJoinRequest.findMany({
      where: { userId },
      include: {
        club: {
          select: {
            id: true,
            name: true,
            location: true,
            verified: true,
            _count: { select: { memberships: true } },
          },
        },
      },
      orderBy: { requestedAt: 'desc' },
    });

    return {
      success: true,
      data: requests.map(r => ({
        id: r.id,
        clubId: r.clubId,
        clubName: r.club.name,
        clubLocation: r.club.location,
        clubVerified: r.club.verified,
        clubMemberCount: r.club._count.memberships,
        status: r.status,
        message: r.message,
        requestedAt: r.requestedAt,
        reviewedAt: r.reviewedAt,
        rejectionReason: r.rejectionReason,
      })),
    };
  });

  // Request to join a club
  fastify.post<{
    Params: { id: string };
    Body: { message?: string };
  }>('/:id/request', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = request.authUser!.id;
    const { id: clubId } = request.params;
    const { message } = request.body || {};

    // Check club exists
    const club = await prisma.club.findUnique({
      where: { id: clubId },
    });

    if (!club) {
      return reply.status(404).send({
        success: false,
        error: 'Club not found',
      });
    }

    // Check if already a member
    const existingMembership = await prisma.clubMembership.findUnique({
      where: {
        clubId_userId: { clubId, userId },
      },
    });

    if (existingMembership) {
      return reply.status(409).send({
        success: false,
        error: 'You are already a member of this club',
      });
    }

    // Check for existing pending request
    const existingRequest = await prisma.clubJoinRequest.findUnique({
      where: {
        clubId_userId: { clubId, userId },
      },
    });

    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        return reply.status(409).send({
          success: false,
          error: 'You already have a pending request for this club',
        });
      }
      if (existingRequest.status === 'rejected') {
        // Allow re-requesting after rejection - update the existing request
        const updatedRequest = await prisma.clubJoinRequest.update({
          where: { id: existingRequest.id },
          data: {
            status: 'pending',
            message: message?.trim() || null,
            requestedAt: new Date(),
            reviewedBy: null,
            reviewedAt: null,
            rejectionReason: null,
          },
        });

        return {
          success: true,
          data: {
            requestId: updatedRequest.id,
            clubId: club.id,
            clubName: club.name,
            status: 'pending',
          },
          message: 'Join request submitted. You will be notified when approved.',
        };
      }
    }

    // Create new request
    const joinRequest = await prisma.clubJoinRequest.create({
      data: {
        clubId,
        userId,
        message: message?.trim() || null,
        status: 'pending',
      },
    });

    return {
      success: true,
      data: {
        requestId: joinRequest.id,
        clubId: club.id,
        clubName: club.name,
        status: 'pending',
      },
      message: 'Join request submitted. You will be notified when approved.',
    };
  });

  // Get pending requests for a club (admin only)
  fastify.get<{ Params: { id: string } }>('/:id/requests', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = request.authUser!.id;
    const { id: clubId } = request.params;

    // Check admin permission
    const membership = await prisma.clubMembership.findUnique({
      where: {
        clubId_userId: { clubId, userId },
      },
    });

    if (!membership || membership.role !== 'admin') {
      return reply.status(403).send({
        success: false,
        error: 'Only club admins can view join requests',
      });
    }

    const requests = await prisma.clubJoinRequest.findMany({
      where: {
        clubId,
        status: 'pending',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { requestedAt: 'asc' },
    });

    return {
      success: true,
      data: requests.map(r => ({
        id: r.id,
        userId: r.userId,
        userName: r.user.name,
        userAvatar: r.user.avatarUrl,
        message: r.message,
        requestedAt: r.requestedAt,
      })),
    };
  });

  // Approve a join request (admin only)
  fastify.post<{
    Params: { id: string; requestId: string };
  }>('/:id/requests/:requestId/approve', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const adminUserId = request.authUser!.id;
    const { id: clubId, requestId } = request.params;

    // Check admin permission
    const membership = await prisma.clubMembership.findUnique({
      where: {
        clubId_userId: { clubId, userId: adminUserId },
      },
    });

    if (!membership || membership.role !== 'admin') {
      return reply.status(403).send({
        success: false,
        error: 'Only club admins can approve join requests',
      });
    }

    // Get the request with user email for notification
    const joinRequest = await prisma.clubJoinRequest.findUnique({
      where: { id: requestId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        club: { select: { name: true } },
      },
    });

    if (!joinRequest || joinRequest.clubId !== clubId) {
      return reply.status(404).send({
        success: false,
        error: 'Join request not found',
      });
    }

    if (joinRequest.status !== 'pending') {
      return reply.status(400).send({
        success: false,
        error: `Request is already ${joinRequest.status}`,
      });
    }

    // Use transaction to update request and create membership
    await prisma.$transaction([
      prisma.clubJoinRequest.update({
        where: { id: requestId },
        data: {
          status: 'approved',
          reviewedBy: adminUserId,
          reviewedAt: new Date(),
        },
      }),
      prisma.clubMembership.create({
        data: {
          clubId,
          userId: joinRequest.userId,
          role: 'member',
        },
      }),
    ]);

    // Send approval email to user
    if (joinRequest.user.email) {
      try {
        await sendJoinApprovedEmail(
          joinRequest.user.email,
          joinRequest.user.name,
          joinRequest.club.name
        );
      } catch (err) {
        fastify.log.error(err, 'Failed to send join approved email');
      }
    }

    return {
      success: true,
      message: `${joinRequest.user.name} has been added to ${joinRequest.club.name}`,
      data: {
        userId: joinRequest.userId,
        userName: joinRequest.user.name,
      },
    };
  });

  // Reject a join request (admin only)
  fastify.post<{
    Params: { id: string; requestId: string };
    Body: { reason?: string };
  }>('/:id/requests/:requestId/reject', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const adminUserId = request.authUser!.id;
    const { id: clubId, requestId } = request.params;
    const { reason } = request.body || {};

    // Check admin permission
    const membership = await prisma.clubMembership.findUnique({
      where: {
        clubId_userId: { clubId, userId: adminUserId },
      },
    });

    if (!membership || membership.role !== 'admin') {
      return reply.status(403).send({
        success: false,
        error: 'Only club admins can reject join requests',
      });
    }

    // Get the request with user email for notification
    const joinRequest = await prisma.clubJoinRequest.findUnique({
      where: { id: requestId },
      include: {
        user: { select: { name: true, email: true } },
        club: { select: { name: true } },
      },
    });

    if (!joinRequest || joinRequest.clubId !== clubId) {
      return reply.status(404).send({
        success: false,
        error: 'Join request not found',
      });
    }

    if (joinRequest.status !== 'pending') {
      return reply.status(400).send({
        success: false,
        error: `Request is already ${joinRequest.status}`,
      });
    }

    await prisma.clubJoinRequest.update({
      where: { id: requestId },
      data: {
        status: 'rejected',
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
        rejectionReason: reason?.trim() || null,
      },
    });

    // Send rejection email to user
    if (joinRequest.user.email) {
      try {
        await sendJoinRejectedEmail(
          joinRequest.user.email,
          joinRequest.user.name,
          joinRequest.club.name,
          reason?.trim()
        );
      } catch (err) {
        fastify.log.error(err, 'Failed to send join rejected email');
      }
    }

    return {
      success: true,
      message: `Join request from ${joinRequest.user.name} has been rejected`,
    };
  });

  // Cancel own join request
  fastify.delete<{
    Params: { id: string; requestId: string };
  }>('/:id/requests/:requestId', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = request.authUser!.id;
    const { id: clubId, requestId } = request.params;

    const joinRequest = await prisma.clubJoinRequest.findUnique({
      where: { id: requestId },
    });

    if (!joinRequest || joinRequest.clubId !== clubId) {
      return reply.status(404).send({
        success: false,
        error: 'Join request not found',
      });
    }

    if (joinRequest.userId !== userId) {
      return reply.status(403).send({
        success: false,
        error: 'You can only cancel your own requests',
      });
    }

    if (joinRequest.status !== 'pending') {
      return reply.status(400).send({
        success: false,
        error: `Cannot cancel a ${joinRequest.status} request`,
      });
    }

    await prisma.clubJoinRequest.update({
      where: { id: requestId },
      data: {
        status: 'cancelled',
      },
    });

    return {
      success: true,
      message: 'Join request cancelled',
    };
  });

  // ============================================
  // CLUB MANAGEMENT ENDPOINTS (Admin only)
  // ============================================

  // Update club (admin only)
  fastify.patch<{
    Params: { id: string };
    Body: { name?: string; location?: string };
  }>('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = request.authUser!.id;
    const { id: clubId } = request.params;
    const { name, location } = request.body;

    // Check if user is admin
    const membership = await prisma.clubMembership.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });

    if (!membership || membership.role !== 'admin') {
      return reply.status(403).send({
        success: false,
        error: 'Only club admins can update the club',
      });
    }

    // Validate name if provided
    if (name !== undefined) {
      if (!name || name.trim().length < 2) {
        return reply.status(400).send({
          success: false,
          error: 'Club name must be at least 2 characters',
        });
      }
    }

    const updatedClub = await prisma.club.update({
      where: { id: clubId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(location !== undefined && { location: location?.trim() || null }),
      },
    });

    return {
      success: true,
      data: updatedClub,
      message: 'Club updated successfully',
    };
  });

  // Delete club (admin only)
  fastify.delete<{ Params: { id: string } }>('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = request.authUser!.id;
    const { id: clubId } = request.params;

    // Check if user is admin
    const membership = await prisma.clubMembership.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });

    if (!membership || membership.role !== 'admin') {
      return reply.status(403).send({
        success: false,
        error: 'Only club admins can delete the club',
      });
    }

    // Delete in order: squad memberships, squads, club memberships, join requests, club
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

    return {
      success: true,
      message: 'Club deleted successfully',
    };
  });

  // Get club members (members only)
  fastify.get<{ Params: { id: string } }>('/:id/members', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = request.authUser!.id;
    const { id: clubId } = request.params;

    // Check if user is a member
    const membership = await prisma.clubMembership.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });

    if (!membership) {
      return reply.status(403).send({
        success: false,
        error: 'You must be a member to view the member list',
      });
    }

    const members = await prisma.clubMembership.findMany({
      where: { clubId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' }, // admins first
        { joinedAt: 'asc' },
      ],
    });

    return {
      success: true,
      data: members.map(m => ({
        id: m.user.id,
        name: m.user.name,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
    };
  });

  // Remove member (admin only)
  fastify.delete<{
    Params: { id: string; userId: string };
  }>('/:id/members/:userId', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const adminId = request.authUser!.id;
    const { id: clubId, userId: targetUserId } = request.params;

    // Check if requester is admin
    const adminMembership = await prisma.clubMembership.findUnique({
      where: { clubId_userId: { clubId, userId: adminId } },
    });

    if (!adminMembership || adminMembership.role !== 'admin') {
      return reply.status(403).send({
        success: false,
        error: 'Only club admins can remove members',
      });
    }

    // Cannot remove yourself (use leave instead)
    if (targetUserId === adminId) {
      return reply.status(400).send({
        success: false,
        error: 'Cannot remove yourself. Use the leave endpoint instead.',
      });
    }

    // Check if target is a member
    const targetMembership = await prisma.clubMembership.findUnique({
      where: { clubId_userId: { clubId, userId: targetUserId } },
    });

    if (!targetMembership) {
      return reply.status(404).send({
        success: false,
        error: 'Member not found',
      });
    }

    // Remove from club and all squads in that club
    await prisma.$transaction(async (tx) => {
      // Get all squad IDs for this club
      const squads = await tx.squad.findMany({
        where: { clubId },
        select: { id: true },
      });
      const squadIds = squads.map(s => s.id);

      // Remove from all squads in this club
      if (squadIds.length > 0) {
        await tx.squadMembership.deleteMany({
          where: {
            squadId: { in: squadIds },
            userId: targetUserId,
          },
        });
      }

      // Remove from club
      await tx.clubMembership.delete({
        where: { clubId_userId: { clubId, userId: targetUserId } },
      });
    });

    return {
      success: true,
      message: 'Member removed successfully',
    };
  });

  // Change member role (admin only)
  fastify.patch<{
    Params: { id: string; userId: string };
    Body: { role: 'admin' | 'member' };
  }>('/:id/members/:userId', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const adminId = request.authUser!.id;
    const { id: clubId, userId: targetUserId } = request.params;
    const { role } = request.body;

    if (!role || !['admin', 'member'].includes(role)) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid role. Must be "admin" or "member"',
      });
    }

    // Check if requester is admin
    const adminMembership = await prisma.clubMembership.findUnique({
      where: { clubId_userId: { clubId, userId: adminId } },
    });

    if (!adminMembership || adminMembership.role !== 'admin') {
      return reply.status(403).send({
        success: false,
        error: 'Only club admins can change member roles',
      });
    }

    // Check if target is a member
    const targetMembership = await prisma.clubMembership.findUnique({
      where: { clubId_userId: { clubId, userId: targetUserId } },
    });

    if (!targetMembership) {
      return reply.status(404).send({
        success: false,
        error: 'Member not found',
      });
    }

    // If demoting from admin, check there's at least one other admin
    if (targetMembership.role === 'admin' && role === 'member') {
      const adminCount = await prisma.clubMembership.count({
        where: { clubId, role: 'admin' },
      });

      if (adminCount <= 1) {
        return reply.status(400).send({
          success: false,
          error: 'Cannot demote the last admin. Promote another member first or delete the club.',
        });
      }
    }

    await prisma.clubMembership.update({
      where: { clubId_userId: { clubId, userId: targetUserId } },
      data: { role },
    });

    return {
      success: true,
      message: `Member role changed to ${role}`,
    };
  });

  // Regenerate invite code (admin only)
  fastify.post<{ Params: { id: string } }>('/:id/regenerate-code', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = request.authUser!.id;
    const { id: clubId } = request.params;

    // Check if user is admin
    const membership = await prisma.clubMembership.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });

    if (!membership || membership.role !== 'admin') {
      return reply.status(403).send({
        success: false,
        error: 'Only club admins can regenerate the invite code',
      });
    }

    const newCode = generateInviteCode();

    const updatedClub = await prisma.club.update({
      where: { id: clubId },
      data: { inviteCode: newCode },
    });

    return {
      success: true,
      data: { inviteCode: updatedClub.inviteCode },
      message: 'Invite code regenerated successfully',
    };
  });

  // Upload club logo (admin only)
  fastify.post<{ Params: { id: string } }>('/:id/logo', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = request.authUser!.id;
    const { id: clubId } = request.params;

    // Check if user is admin
    const membership = await prisma.clubMembership.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });

    if (!membership || membership.role !== 'admin') {
      return reply.status(403).send({
        success: false,
        error: 'Only club admins can upload a logo',
      });
    }

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
      const logoUrl = `data:${mimeType};base64,${base64}`;

      // Update club with logo URL
      const club = await prisma.club.update({
        where: { id: clubId },
        data: { logoUrl },
      });

      return reply.send({
        success: true,
        data: { logoUrl: club.logoUrl },
      });
    } catch (error) {
      request.log.error(error, 'Club logo upload failed');
      return reply.status(500).send({
        success: false,
        error: 'Failed to upload logo',
      });
    }
  });
}
