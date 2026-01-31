import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface CreateWorkoutBody {
  photoUrl?: string;
  workoutType: string;
  totalTimeSeconds: number;
  totalDistanceMetres: number;
  avgSplit: number;
  avgStrokeRate?: number;
  avgWatts?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  calories?: number;
  dragFactor?: number;
  intervals?: object;
  hrData?: object;
  notes?: string;
  isPublic?: boolean;
  workoutDate?: string;
}

interface UpdateWorkoutBody {
  workoutType?: string;
  notes?: string;
  isPublic?: boolean;
}

interface GetWorkoutsQuery {
  limit?: number;
  cursor?: string;
  userId?: string;
}

interface WorkoutParams {
  workoutId: string;
}

interface OcrBody {
  imageBase64: string;
}

export async function workoutRoutes(server: FastifyInstance): Promise<void> {
  // Create a new workout
  server.post<{ Body: CreateWorkoutBody }>(
    '/',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest<{ Body: CreateWorkoutBody }>, reply: FastifyReply) => {
      const userId = request.user!.id;
      const data = request.body;

      // Get user for effort score calculation
      const user = await server.prisma.user.findUnique({
        where: { id: userId },
        select: { maxHr: true },
      });

      // Calculate effort score
      let effortScore = 0;
      if (user?.maxHr && data.avgHeartRate) {
        const avgHrPercent = data.avgHeartRate / user.maxHr;
        const durationScore = Math.min(data.totalTimeSeconds / 3600, 1) * 2;
        const avgHrScore = Math.min(avgHrPercent, 1) * 3;
        effortScore = Math.round(Math.min(durationScore + avgHrScore + 2, 10) * 10) / 10;
      } else {
        // Estimate from duration only
        effortScore = Math.round(Math.min(data.totalTimeSeconds / 3600, 1) * 3 * 10) / 10;
      }

      const workout = await server.prisma.workout.create({
        data: {
          userId,
          photoUrl: data.photoUrl,
          workoutType: data.workoutType,
          totalTimeSeconds: data.totalTimeSeconds,
          totalDistanceMetres: data.totalDistanceMetres,
          avgSplit: data.avgSplit,
          avgStrokeRate: data.avgStrokeRate,
          avgWatts: data.avgWatts,
          avgHeartRate: data.avgHeartRate,
          maxHeartRate: data.maxHeartRate,
          calories: data.calories,
          dragFactor: data.dragFactor,
          intervals: data.intervals,
          hrData: data.hrData,
          effortScore,
          notes: data.notes,
          isPublic: data.isPublic ?? true,
          workoutDate: data.workoutDate ? new Date(data.workoutDate) : new Date(),
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
      });

      // Check and update personal bests
      await updatePersonalBests(server, userId, workout);

      return reply.status(201).send({
        success: true,
        data: { workout },
      });
    }
  );

  // Get workouts (paginated)
  server.get<{ Querystring: GetWorkoutsQuery }>(
    '/',
    { preHandler: [server.optionalAuth] },
    async (request: FastifyRequest<{ Querystring: GetWorkoutsQuery }>, reply: FastifyReply) => {
      const { limit = 20, cursor, userId } = request.query;
      const currentUserId = request.user?.id;

      const where: any = {};

      if (userId) {
        where.userId = userId;
        // If viewing another user's workouts, only show public ones
        if (userId !== currentUserId) {
          where.isPublic = true;
        }
      } else {
        // Public feed - show only public workouts
        where.isPublic = true;
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
            },
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

      return reply.send({
        success: true,
        data: {
          workouts,
          nextCursor,
          hasMore,
        },
      });
    }
  );

  // Get a single workout
  server.get<{ Params: WorkoutParams }>(
    '/:workoutId',
    { preHandler: [server.optionalAuth] },
    async (request: FastifyRequest<{ Params: WorkoutParams }>, reply: FastifyReply) => {
      const { workoutId } = request.params;
      const currentUserId = request.user?.id;

      const workout = await server.prisma.workout.findUnique({
        where: { id: workoutId },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              username: true,
              avatarUrl: true,
            },
          },
          reactions: {
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
          comments: {
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!workout) {
        return reply.status(404).send({
          success: false,
          error: 'Workout not found',
        });
      }

      // Check visibility
      if (!workout.isPublic && workout.userId !== currentUserId) {
        return reply.status(403).send({
          success: false,
          error: 'This workout is private',
        });
      }

      return reply.send({
        success: true,
        data: { workout },
      });
    }
  );

  // Update a workout
  server.patch<{ Params: WorkoutParams; Body: UpdateWorkoutBody }>(
    '/:workoutId',
    { preHandler: [server.authenticate] },
    async (
      request: FastifyRequest<{ Params: WorkoutParams; Body: UpdateWorkoutBody }>,
      reply: FastifyReply
    ) => {
      const { workoutId } = request.params;
      const userId = request.user!.id;
      const updateData = request.body;

      // Verify ownership
      const existing = await server.prisma.workout.findUnique({
        where: { id: workoutId },
      });

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: 'Workout not found',
        });
      }

      if (existing.userId !== userId) {
        return reply.status(403).send({
          success: false,
          error: 'Not authorized to edit this workout',
        });
      }

      const workout = await server.prisma.workout.update({
        where: { id: workoutId },
        data: updateData,
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
      });

      return reply.send({
        success: true,
        data: { workout },
      });
    }
  );

  // Delete a workout
  server.delete<{ Params: WorkoutParams }>(
    '/:workoutId',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest<{ Params: WorkoutParams }>, reply: FastifyReply) => {
      const { workoutId } = request.params;
      const userId = request.user!.id;

      // Verify ownership
      const existing = await server.prisma.workout.findUnique({
        where: { id: workoutId },
      });

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: 'Workout not found',
        });
      }

      if (existing.userId !== userId) {
        return reply.status(403).send({
          success: false,
          error: 'Not authorized to delete this workout',
        });
      }

      await server.prisma.workout.delete({
        where: { id: workoutId },
      });

      return reply.send({
        success: true,
        message: 'Workout deleted',
      });
    }
  );

  // Add reaction to workout
  server.post<{ Params: WorkoutParams; Body: { type: string } }>(
    '/:workoutId/reactions',
    { preHandler: [server.authenticate] },
    async (
      request: FastifyRequest<{ Params: WorkoutParams; Body: { type: string } }>,
      reply: FastifyReply
    ) => {
      const { workoutId } = request.params;
      const { type } = request.body;
      const userId = request.user!.id;

      // Upsert reaction
      const reaction = await server.prisma.workoutReaction.upsert({
        where: {
          workoutId_userId: {
            workoutId,
            userId,
          },
        },
        update: { type },
        create: {
          workoutId,
          userId,
          type,
        },
      });

      return reply.send({
        success: true,
        data: { reaction },
      });
    }
  );

  // Remove reaction from workout
  server.delete<{ Params: WorkoutParams }>(
    '/:workoutId/reactions',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest<{ Params: WorkoutParams }>, reply: FastifyReply) => {
      const { workoutId } = request.params;
      const userId = request.user!.id;

      await server.prisma.workoutReaction.deleteMany({
        where: {
          workoutId,
          userId,
        },
      });

      return reply.send({
        success: true,
        message: 'Reaction removed',
      });
    }
  );

  // Add comment to workout
  server.post<{ Params: WorkoutParams; Body: { content: string } }>(
    '/:workoutId/comments',
    { preHandler: [server.authenticate] },
    async (
      request: FastifyRequest<{ Params: WorkoutParams; Body: { content: string } }>,
      reply: FastifyReply
    ) => {
      const { workoutId } = request.params;
      const { content } = request.body;
      const userId = request.user!.id;

      const comment = await server.prisma.workoutComment.create({
        data: {
          workoutId,
          userId,
          content,
        },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      });

      return reply.status(201).send({
        success: true,
        data: { comment },
      });
    }
  );

  // Delete comment
  server.delete<{ Params: { workoutId: string; commentId: string } }>(
    '/:workoutId/comments/:commentId',
    { preHandler: [server.authenticate] },
    async (
      request: FastifyRequest<{ Params: { workoutId: string; commentId: string } }>,
      reply: FastifyReply
    ) => {
      const { commentId } = request.params;
      const userId = request.user!.id;

      const comment = await server.prisma.workoutComment.findUnique({
        where: { id: commentId },
      });

      if (!comment) {
        return reply.status(404).send({
          success: false,
          error: 'Comment not found',
        });
      }

      if (comment.userId !== userId) {
        return reply.status(403).send({
          success: false,
          error: 'Not authorized to delete this comment',
        });
      }

      await server.prisma.workoutComment.delete({
        where: { id: commentId },
      });

      return reply.send({
        success: true,
        message: 'Comment deleted',
      });
    }
  );

  // OCR endpoint - process erg photo with OpenAI Vision
  server.post<{ Body: OcrBody }>(
    '/ocr',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest<{ Body: OcrBody }>, reply: FastifyReply) => {
      const { imageBase64 } = request.body;

      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are an expert at reading Concept2 rowing ergometer screens. Extract workout data from the image and return it as JSON.

The JSON should have these fields (use null if not visible):
- workoutType: "time" | "distance" | "intervals" | "just_row"
- totalTimeSeconds: number (convert MM:SS.S to seconds)
- totalDistanceMetres: number
- avgSplit: number (in seconds per 500m, convert M:SS.S to seconds)
- avgStrokeRate: number (strokes per minute)
- avgWatts: number
- avgHeartRate: number
- maxHeartRate: number
- calories: number
- dragFactor: number
- intervals: array of {distanceMetres, timeSeconds, split, strokeRate, watts, heartRate} if interval workout

Only return valid JSON, no other text.`,
            },
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${imageBase64}`,
                  },
                },
                {
                  type: 'text',
                  text: 'Extract the workout data from this Concept2 erg screen.',
                },
              ],
            },
          ],
          max_tokens: 1000,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No response from OpenAI');
        }

        // Parse the JSON response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('Could not parse OCR response');
        }

        const ocrData = JSON.parse(jsonMatch[0]);

        return reply.send({
          success: true,
          data: { ocrData },
        });
      } catch (error) {
        request.log.error(error, 'OCR processing failed');
        return reply.status(500).send({
          success: false,
          error: 'Failed to process image',
        });
      }
    }
  );
}

// Helper function to update personal bests
async function updatePersonalBests(server: FastifyInstance, userId: string, workout: any) {
  const standardDistances = [500, 1000, 2000, 5000, 6000, 10000];

  // Check if workout matches a standard distance (within 1%)
  for (const distance of standardDistances) {
    if (Math.abs(workout.totalDistanceMetres - distance) / distance < 0.01) {
      const existing = await server.prisma.personalBest.findUnique({
        where: {
          userId_distanceMetres: {
            userId,
            distanceMetres: distance,
          },
        },
      });

      if (!existing || workout.totalTimeSeconds < existing.timeSeconds) {
        await server.prisma.personalBest.upsert({
          where: {
            userId_distanceMetres: {
              userId,
              distanceMetres: distance,
            },
          },
          update: {
            timeSeconds: workout.totalTimeSeconds,
            split: workout.avgSplit,
            watts: workout.avgWatts,
            strokeRate: workout.avgStrokeRate,
            workoutId: workout.id,
            achievedAt: workout.workoutDate,
          },
          create: {
            userId,
            distanceMetres: distance,
            timeSeconds: workout.totalTimeSeconds,
            split: workout.avgSplit,
            watts: workout.avgWatts,
            strokeRate: workout.avgStrokeRate,
            workoutId: workout.id,
            achievedAt: workout.workoutDate,
          },
        });
      }
      break;
    }
  }
}
