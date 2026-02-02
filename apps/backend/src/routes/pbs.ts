import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient, PbCategory } from '@prisma/client';

// PBs Route - Personal Bests tracking
export async function pbsRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma;

  // Get all PBs for the authenticated user
  fastify.get('/', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.authUser!.id;

    const pbs = await prisma.personalBest.findMany({
      where: { userId },
      include: {
        workout: {
          select: {
            id: true,
            workoutType: true,
            totalTimeSeconds: true,
            totalDistanceMetres: true,
            averageSplitSeconds: true,
            workoutDate: true,
          },
        },
      },
      orderBy: { achievedAt: 'desc' },
    });

    // Transform to user-friendly format
    const formattedPbs = pbs.map(pb => ({
      id: pb.id,
      category: pb.category,
      timeSeconds: pb.timeSeconds,
      distanceMetres: pb.distanceMetres,
      achievedAt: pb.achievedAt,
      workout: pb.workout,
    }));

    return {
      success: true,
      data: formattedPbs,
    };
  });

  // Get PB for a specific category
  fastify.get<{ Params: { category: string } }>('/:category', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = request.authUser!.id;
    const { category } = request.params;

    // Validate category
    const validCategories = Object.values(PbCategory);
    if (!validCategories.includes(category as PbCategory)) {
      return reply.status(400).send({
        success: false,
        error: `Invalid category. Valid categories: ${validCategories.join(', ')}`,
      });
    }

    const pb = await prisma.personalBest.findUnique({
      where: {
        userId_category: {
          userId,
          category: category as PbCategory,
        },
      },
      include: {
        workout: {
          select: {
            id: true,
            workoutType: true,
            totalTimeSeconds: true,
            totalDistanceMetres: true,
            averageSplitSeconds: true,
            averageRate: true,
            avgHeartRate: true,
            workoutDate: true,
          },
        },
      },
    });

    if (!pb) {
      return {
        success: true,
        data: null,
        message: `No PB recorded for ${category}`,
      };
    }

    return {
      success: true,
      data: {
        id: pb.id,
        category: pb.category,
        timeSeconds: pb.timeSeconds,
        distanceMetres: pb.distanceMetres,
        achievedAt: pb.achievedAt,
        workout: pb.workout,
      },
    };
  });

  // Get PB history for a category (all attempts, not just the best)
  fastify.get<{ Params: { category: string } }>('/:category/history', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = request.authUser!.id;
    const { category } = request.params;

    // Map category to workout type
    const workoutType = category as any;

    const workouts = await prisma.workout.findMany({
      where: {
        userId,
        workoutType,
      },
      select: {
        id: true,
        totalTimeSeconds: true,
        totalDistanceMetres: true,
        averageSplitSeconds: true,
        averageRate: true,
        avgHeartRate: true,
        isPb: true,
        workoutDate: true,
      },
      orderBy: { workoutDate: 'asc' },
    });

    return {
      success: true,
      data: workouts,
    };
  });
}
