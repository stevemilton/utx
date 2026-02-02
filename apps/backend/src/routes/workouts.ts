import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { WorkoutType, PbCategory } from '@prisma/client';
import OpenAI from 'openai';
import { calculateEffortScore } from '../utils/effortScore.js';
import { generateCoachingInsight } from '../utils/aiCoaching.js';

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
  workoutDate?: string;
}

interface UpdateWorkoutBody {
  notes?: string;
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

// Map string workout types to enum
function mapWorkoutType(type: string): WorkoutType {
  const mapping: Record<string, WorkoutType> = {
    '500': 'five_hundred',
    '1000': 'one_thousand',
    '2000': 'two_thousand',
    '5000': 'five_thousand',
    '6000': 'six_thousand',
    '10000': 'ten_thousand',
    'half_marathon': 'half_marathon',
    'marathon': 'marathon',
    'one_minute': 'one_minute',
    'steady_state': 'steady_state',
    'intervals': 'intervals',
    'distance': 'custom',
    'time': 'custom',
    'custom': 'custom',
  };
  return mapping[type] || 'custom';
}

// Map distance to PB category
function distanceToPbCategory(distance: number): PbCategory | null {
  const mapping: Record<number, PbCategory> = {
    500: 'five_hundred',
    1000: 'one_thousand',
    2000: 'two_thousand',
    5000: 'five_thousand',
    6000: 'six_thousand',
    10000: 'ten_thousand',
    21097: 'half_marathon',
    42195: 'marathon',
  };

  // Allow 1% tolerance for distance matching
  for (const [dist, category] of Object.entries(mapping)) {
    if (Math.abs(distance - Number(dist)) / Number(dist) < 0.01) {
      return category;
    }
  }
  return null;
}

export async function workoutRoutes(server: FastifyInstance): Promise<void> {
  // Create a new workout
  server.post<{ Body: CreateWorkoutBody }>(
    '/',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest<{ Body: CreateWorkoutBody }>, reply: FastifyReply) => {
      const userId = request.authUser!.id;
      const data = request.body;

      // Get user for effort score calculation and AI coaching
      const user = await server.prisma.user.findUnique({
        where: { id: userId },
        select: { maxHr: true, heightCm: true, weightKg: true, birthDate: true, gender: true },
      });

      // Calculate effort score using the utility
      const effortScore = user?.maxHr
        ? calculateEffortScore({
            avgHeartRate: data.avgHeartRate,
            maxHeartRate: data.maxHeartRate,
            userMaxHr: user.maxHr,
            totalTimeSeconds: data.totalTimeSeconds,
            workoutType: mapWorkoutType(data.workoutType),
            hrData: data.hrData,
          })
        : calculateEffortScore({
            avgHeartRate: null,
            maxHeartRate: null,
            userMaxHr: 180,
            totalTimeSeconds: data.totalTimeSeconds,
            workoutType: mapWorkoutType(data.workoutType),
          });

      const workout = await server.prisma.workout.create({
        data: {
          userId,
          photoUrl: data.photoUrl,
          workoutType: mapWorkoutType(data.workoutType),
          totalTimeSeconds: data.totalTimeSeconds,
          totalDistanceMetres: data.totalDistanceMetres,
          averageSplitSeconds: data.avgSplit,
          averageRate: data.avgStrokeRate || 0,
          averageWatts: data.avgWatts,
          avgHeartRate: data.avgHeartRate,
          maxHeartRate: data.maxHeartRate,
          calories: data.calories,
          dragFactor: data.dragFactor,
          intervals: data.intervals as any,
          hrData: data.hrData as any,
          effortScore,
          notes: data.notes,
          workoutDate: data.workoutDate ? new Date(data.workoutDate) : new Date(),
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
      });

      // Check and update personal bests
      await updatePersonalBests(server, userId, workout);

      // Generate AI coaching insight asynchronously (don't wait for it)
      if (user) {
        generateCoachingInsightForWorkout(server, workout, user).catch(err => {
          server.log.error(err, 'Failed to generate AI coaching insight');
        });
      }

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

      const where: any = {};

      if (userId) {
        where.userId = userId;
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
              name: true,
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

      const workout = await server.prisma.workout.findUnique({
        where: { id: workoutId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
          reactions: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
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
                  name: true,
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
      const userId = request.authUser!.id;
      const { notes } = request.body;

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
        data: { notes },
        include: {
          user: {
            select: {
              id: true,
              name: true,
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
      const userId = request.authUser!.id;

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
  server.post<{ Params: WorkoutParams }>(
    '/:workoutId/reactions',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest<{ Params: WorkoutParams }>, reply: FastifyReply) => {
      const { workoutId } = request.params;
      const userId = request.authUser!.id;

      const reaction = await server.prisma.workoutReaction.upsert({
        where: {
          workoutId_userId: {
            workoutId,
            userId,
          },
        },
        update: {},
        create: {
          workoutId,
          userId,
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
      const userId = request.authUser!.id;

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
      const userId = request.authUser!.id;

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
              name: true,
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

  // Get comments for workout
  server.get<{ Params: WorkoutParams }>(
    '/:workoutId/comments',
    { preHandler: [server.optionalAuth] },
    async (request: FastifyRequest<{ Params: WorkoutParams }>, reply: FastifyReply) => {
      const { workoutId } = request.params;

      const comments = await server.prisma.workoutComment.findMany({
        where: { workoutId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      return reply.send({
        success: true,
        data: { comments },
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
      const userId = request.authUser!.id;

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

      // Check if OpenAI API key is configured
      if (!process.env.OPENAI_API_KEY) {
        request.log.error('OPENAI_API_KEY not configured');
        return reply.status(500).send({
          success: false,
          error: 'OCR service not configured',
        });
      }

      // Validate base64 image
      if (!imageBase64 || imageBase64.length < 100) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid image data',
        });
      }

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
      } catch (error: any) {
        request.log.error(error, 'OCR processing failed');

        // Provide more specific error messages
        let errorMessage = 'Failed to process image';
        if (error?.code === 'invalid_api_key') {
          errorMessage = 'OCR service authentication failed';
        } else if (error?.code === 'rate_limit_exceeded') {
          errorMessage = 'OCR service rate limit reached. Please try again later';
        } else if (error?.message?.includes('Could not parse')) {
          errorMessage = 'Could not read the erg screen. Please ensure the screen is clearly visible and shows workout data.';
        } else if (error?.message?.includes('No response')) {
          errorMessage = 'No response from OCR service. Please try again.';
        } else if (error?.message?.includes('JSON')) {
          errorMessage = 'Could not parse erg screen data. Try a clearer photo.';
        }

        request.log.error({ errorDetail: error?.message }, 'OCR error detail');

        return reply.status(500).send({
          success: false,
          error: errorMessage,
        });
      }
    }
  );
}

// Helper function to update personal bests
async function updatePersonalBests(server: FastifyInstance, userId: string, workout: any) {
  const category = distanceToPbCategory(workout.totalDistanceMetres);

  if (!category) return;

  const existing = await server.prisma.personalBest.findUnique({
    where: {
      userId_category: {
        userId,
        category,
      },
    },
  });

  const isNewPB = !existing || workout.totalTimeSeconds < (existing.timeSeconds || Infinity);

  if (isNewPB) {
    await server.prisma.personalBest.upsert({
      where: {
        userId_category: {
          userId,
          category,
        },
      },
      update: {
        timeSeconds: workout.totalTimeSeconds,
        workoutId: workout.id,
        achievedAt: workout.workoutDate,
      },
      create: {
        userId,
        category,
        timeSeconds: workout.totalTimeSeconds,
        workoutId: workout.id,
        achievedAt: workout.workoutDate,
      },
    });

    // Mark workout as PB
    await server.prisma.workout.update({
      where: { id: workout.id },
      data: {
        isPb: true,
        pbCategory: category,
      },
    });
  }
}

// Generate AI coaching insight and save to workout
async function generateCoachingInsightForWorkout(
  server: FastifyInstance,
  workout: any,
  user: { maxHr: number; heightCm: number; weightKg: number; birthDate: Date | null; gender: string | null }
) {
  try {
    // Get user's recent workout history
    const recentWorkouts = await server.prisma.workout.findMany({
      where: { userId: workout.userId },
      select: {
        workoutType: true,
        totalDistanceMetres: true,
        averageSplitSeconds: true,
        effortScore: true,
        workoutDate: true,
      },
      orderBy: { workoutDate: 'desc' },
      take: 20,
    });

    // Get user's PBs
    const pbs = await server.prisma.personalBest.findMany({
      where: { userId: workout.userId },
      select: {
        category: true,
        timeSeconds: true,
      },
    });

    // Calculate age (default to 30 if birthDate not set)
    const age = user.birthDate
      ? Math.floor((Date.now() - new Date(user.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : 30;

    const insight = await generateCoachingInsight(
      {
        workoutType: workout.workoutType,
        totalTimeSeconds: workout.totalTimeSeconds,
        totalDistanceMetres: workout.totalDistanceMetres,
        averageSplitSeconds: workout.averageSplitSeconds,
        averageRate: workout.averageRate,
        averageWatts: workout.averageWatts,
        avgHeartRate: workout.avgHeartRate,
        maxHeartRate: workout.maxHeartRate,
        effortScore: workout.effortScore,
        intervals: workout.intervals,
      },
      {
        heightCm: user.heightCm,
        weightKg: user.weightKg,
        age,
        gender: user.gender || 'prefer_not_to_say',
        maxHr: user.maxHr,
      },
      {
        recentWorkouts: recentWorkouts.filter(w => w.workoutDate < workout.workoutDate),
        pbs: pbs.map(pb => ({ category: pb.category, timeSeconds: pb.timeSeconds })),
      }
    );

    if (insight) {
      await server.prisma.workout.update({
        where: { id: workout.id },
        data: { aiInsight: insight },
      });
    }
  } catch (error) {
    server.log.error(error, 'Failed to generate AI coaching insight');
  }
}
