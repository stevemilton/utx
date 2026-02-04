import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { WorkoutType, PbCategory, MachineType } from '@prisma/client';
import OpenAI from 'openai';
import { calculateEffortScore, calculateUtxEffortScore, type UserProfile, type Interval } from '../utils/effortScore.js';
import { generateCoachingInsight } from '../utils/aiCoaching.js';
import { Sentry } from '../instrument.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface CreateWorkoutBody {
  photoUrl?: string;
  workoutType: string;
  machineType?: 'row' | 'bike' | 'ski';
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
  isPublic?: boolean;
}

interface UpdateWorkoutBody {
  notes?: string;
  workoutType?: string;
  workoutDate?: string;
  totalDistanceMetres?: number;
  totalTimeSeconds?: number;
  avgSplit?: number;
  avgStrokeRate?: number;
  avgWatts?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  calories?: number;
  dragFactor?: number;
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

// Map string machine types to enum
function mapMachineType(type?: string): MachineType {
  if (type === 'bike') return 'bike';
  if (type === 'ski') return 'ski';
  return 'row'; // default
}

// Validate and fix common OCR errors
function validateOcrData(data: any): any {
  // 1. Check for split confused with time (split should be 80-180 seconds typically)
  if (data.totalTimeSeconds && data.totalTimeSeconds < 120) {
    // Total time under 2 minutes is almost certainly the split value
    console.warn('OCR Warning: totalTimeSeconds seems too low, may be split');
    data.confidence = Math.min(data.confidence || 100, 30);
    data.validationWarning = 'Time seems too short. May be confused with split.';
  }

  // 2. Check if split seems too high (probably got total time instead)
  if (data.avgSplit && data.avgSplit > 200) {
    // Split over 3:20/500m is very slow, might be total time
    console.warn('OCR Warning: avgSplit seems too high, may be total time');
    data.confidence = Math.min(data.confidence || 100, 30);
    data.validationWarning = 'Split seems too slow. May be confused with time.';
  }

  // 3. Auto-swap if split > total time (they're definitely confused)
  if (data.avgSplit && data.totalTimeSeconds) {
    if (data.avgSplit > data.totalTimeSeconds) {
      console.warn('OCR: Auto-swapping split and time (split was greater than total time)');
      const temp = data.avgSplit;
      data.avgSplit = data.totalTimeSeconds;
      data.totalTimeSeconds = temp;
      data.wasSwapped = true;
      data.confidence = Math.min(data.confidence || 100, 60);
    }
  }

  // 4. Estimate distance if missing but we have time and split
  if ((!data.totalDistanceMetres || data.totalDistanceMetres === 0) && data.totalTimeSeconds && data.avgSplit) {
    data.estimatedDistanceMetres = Math.round(
      ((data.totalTimeSeconds / data.avgSplit) * 500) / 10
    ) * 10; // Round to nearest 10m
    data.distanceEstimated = true;
  }

  // 5. Cross-validate distance against time/split calculation
  if (data.totalDistanceMetres && data.totalTimeSeconds && data.avgSplit) {
    const expectedDistance = (data.totalTimeSeconds / data.avgSplit) * 500;
    const variance = Math.abs(data.totalDistanceMetres - expectedDistance) / expectedDistance;

    if (variance > 0.15) {
      // More than 15% variance - something is wrong
      console.warn(`OCR Warning: distance doesn't match time/split. Expected ~${Math.round(expectedDistance)}m, got ${data.totalDistanceMetres}m`);
      data.confidence = Math.min(data.confidence || 100, 50);
      data.validationWarning = `Distance mismatch: expected ~${Math.round(expectedDistance)}m`;
    }
  }

  // 6. Sanity check heart rate
  if (data.avgHeartRate && (data.avgHeartRate < 40 || data.avgHeartRate > 220)) {
    data.avgHeartRate = null;
    data.confidence = Math.min(data.confidence || 100, 70);
  }

  // 7. Sanity check stroke rate
  if (data.avgStrokeRate && (data.avgStrokeRate < 14 || data.avgStrokeRate > 50)) {
    console.warn(`OCR Warning: stroke rate ${data.avgStrokeRate} seems unrealistic`);
    data.confidence = Math.min(data.confidence || 100, 70);
  }

  // Ensure confidence is set
  if (!data.confidence) {
    data.confidence = 80; // Default confidence if not set by model
  }

  return data;
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

      // Input validation
      if (!data.totalTimeSeconds || data.totalTimeSeconds <= 0 || data.totalTimeSeconds > 86400) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid total time (must be between 1 second and 24 hours)',
        });
      }

      if (!data.totalDistanceMetres || data.totalDistanceMetres <= 0 || data.totalDistanceMetres > 100000) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid distance (must be between 1m and 100km)',
        });
      }

      if (data.avgStrokeRate && (data.avgStrokeRate < 10 || data.avgStrokeRate > 60)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid stroke rate (must be between 10 and 60 SPM)',
        });
      }

      if (data.avgHeartRate && (data.avgHeartRate < 30 || data.avgHeartRate > 250)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid heart rate (must be between 30 and 250 BPM)',
        });
      }

      if (data.maxHeartRate && (data.maxHeartRate < 30 || data.maxHeartRate > 250)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid max heart rate (must be between 30 and 250 BPM)',
        });
      }

      // Get user for effort score calculation and AI coaching
      const user = await server.prisma.user.findUnique({
        where: { id: userId },
        select: { maxHr: true, restingHr: true, heightCm: true, weightKg: true, birthDate: true, gender: true },
      });

      // Calculate age from birthDate
      const age = user?.birthDate
        ? Math.floor((Date.now() - new Date(user.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        : 30;

      // Build user profile for UTx effort calculation
      const userProfile: UserProfile = {
        age,
        weightKg: user?.weightKg || 75,
        heightCm: user?.heightCm || 175,
        maxHr: user?.maxHr || 190,
        restingHr: user?.restingHr || 50,
      };

      // Build intervals array for effort calculation
      const intervals: Interval[] = data.intervals
        ? (data.intervals as any[]).map((i: any) => ({
            distanceMetres: i.distanceMetres || i.distance || 0,
            timeSeconds: i.timeSeconds || i.time || 0,
            avgHeartRate: i.heartRate || i.avgHeartRate,
            strokeRate: i.strokeRate || i.rate,
          }))
        : [{
            distanceMetres: data.totalDistanceMetres,
            timeSeconds: data.totalTimeSeconds,
            avgHeartRate: data.avgHeartRate,
            strokeRate: data.avgStrokeRate,
          }];

      // Calculate UTx Effort Score (0-100 EP)
      const utxResult = calculateUtxEffortScore(userProfile, intervals);

      // Also calculate legacy effort score (0-10) for backward compatibility
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
          machineType: mapMachineType(data.machineType),
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
          effortScore, // Legacy 0-10 scale
          effortPoints: utxResult.effortPoints, // New UTx 0-100 scale
          effortZone: utxResult.zone, // recovery | building | training | peak
          effortBreakdown: utxResult.breakdown as any, // { cardiacLoad, workOutput, pacing, economy }
          notes: data.notes,
          isPublic: data.isPublic ?? false,
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
      const currentUserId = (request as any).userId; // From auth middleware

      const where: any = {};

      // If userId is provided, filter by that user
      // Otherwise, default to the authenticated user's workouts
      if (userId) {
        where.userId = userId;
        // If viewing someone else's workouts, only show public ones
        if (currentUserId !== userId) {
          where.isPublic = true;
        }
      } else if (currentUserId) {
        // Viewing own workouts - show all (public and private)
        where.userId = currentUserId;
      } else {
        // No auth and no userId specified - return empty to prevent data leak
        return reply.send({
          success: true,
          data: {
            workouts: [],
            nextCursor: null,
            hasMore: false,
          },
        });
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
              maxHr: true,
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

      // Get comparison data: last similar workout
      let lastSimilar = null;
      try {
        const previousWorkout = await server.prisma.workout.findFirst({
          where: {
            userId: workout.userId,
            workoutType: workout.workoutType,
            id: { not: workout.id },
            workoutDate: { lt: workout.workoutDate },
          },
          orderBy: { workoutDate: 'desc' },
          select: {
            id: true,
            workoutDate: true,
            totalTimeSeconds: true,
            averageSplitSeconds: true,
            avgHeartRate: true,
            effortScore: true,
          },
        });

        if (previousWorkout) {
          lastSimilar = {
            id: previousWorkout.id,
            date: previousWorkout.workoutDate.toISOString(),
            totalTimeSeconds: previousWorkout.totalTimeSeconds,
            averageSplitSeconds: previousWorkout.averageSplitSeconds,
            avgHeartRate: previousWorkout.avgHeartRate,
            effortScore: previousWorkout.effortScore,
          };
        }
      } catch (err) {
        request.log.error(err, 'Failed to fetch comparison data');
      }

      // Get personal best for this workout type
      let personalBest = null;
      try {
        const pbCategory = distanceToPbCategory(workout.totalDistanceMetres);
        if (pbCategory) {
          const pb = await server.prisma.personalBest.findUnique({
            where: {
              userId_category: {
                userId: workout.userId,
                category: pbCategory,
              },
            },
            select: {
              timeSeconds: true,
              achievedAt: true,
            },
          });

          if (pb && pb.timeSeconds !== workout.totalTimeSeconds) {
            personalBest = {
              timeSeconds: pb.timeSeconds,
              achievedAt: pb.achievedAt.toISOString(),
            };
          }
        }
      } catch (err) {
        request.log.error(err, 'Failed to fetch personal best');
      }

      // Calculate HR zone breakdown if hrData exists
      let hrZoneBreakdown = null;
      if (workout.hrData && workout.user?.maxHr) {
        try {
          const hrDataArray = workout.hrData as Array<{ timeSeconds: number; heartRate: number }>;
          const maxHr = workout.user.maxHr;

          // Calculate time in each zone
          let zone1Seconds = 0;
          let zone2Seconds = 0;
          let zone3Seconds = 0;
          let zone4Seconds = 0;
          let zone5Seconds = 0;

          for (let i = 0; i < hrDataArray.length - 1; i++) {
            const hr = hrDataArray[i].heartRate;
            const duration = hrDataArray[i + 1].timeSeconds - hrDataArray[i].timeSeconds;
            const hrPercent = (hr / maxHr) * 100;

            if (hrPercent < 60) zone1Seconds += duration;
            else if (hrPercent < 70) zone2Seconds += duration;
            else if (hrPercent < 80) zone3Seconds += duration;
            else if (hrPercent < 90) zone4Seconds += duration;
            else zone5Seconds += duration;
          }

          hrZoneBreakdown = {
            zone1Seconds: Math.round(zone1Seconds),
            zone2Seconds: Math.round(zone2Seconds),
            zone3Seconds: Math.round(zone3Seconds),
            zone4Seconds: Math.round(zone4Seconds),
            zone5Seconds: Math.round(zone5Seconds),
          };
        } catch (err) {
          request.log.error(err, 'Failed to calculate HR zones');
        }
      }

      const comparison = (lastSimilar || personalBest) ? {
        lastSimilar,
        personalBest,
      } : null;

      return reply.send({
        success: true,
        data: {
          workout,
          comparison,
          hrZoneBreakdown,
        },
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
      const {
        notes,
        workoutType,
        workoutDate,
        totalDistanceMetres,
        totalTimeSeconds,
        avgSplit,
        avgStrokeRate,
        avgWatts,
        avgHeartRate,
        maxHeartRate,
        calories,
        dragFactor,
      } = request.body;

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

      // Build update data object with only provided fields
      const updateData: Record<string, unknown> = {};

      if (notes !== undefined) updateData.notes = notes;
      if (workoutType !== undefined) updateData.workoutType = mapWorkoutType(workoutType);
      if (workoutDate !== undefined) updateData.workoutDate = new Date(workoutDate);
      if (totalDistanceMetres !== undefined) updateData.totalDistanceMetres = totalDistanceMetres;
      if (totalTimeSeconds !== undefined) updateData.totalTimeSeconds = totalTimeSeconds;
      if (avgSplit !== undefined) updateData.averageSplitSeconds = avgSplit;
      if (avgStrokeRate !== undefined) updateData.averageRate = avgStrokeRate;
      if (avgWatts !== undefined) updateData.averageWatts = avgWatts;
      if (avgHeartRate !== undefined) updateData.avgHeartRate = avgHeartRate;
      if (maxHeartRate !== undefined) updateData.maxHeartRate = maxHeartRate;
      if (calories !== undefined) updateData.calories = calories;
      if (dragFactor !== undefined) updateData.dragFactor = dragFactor;

      // Recalculate effort score if metrics changed
      const metricsChanged = totalTimeSeconds !== undefined ||
        totalDistanceMetres !== undefined ||
        avgHeartRate !== undefined ||
        maxHeartRate !== undefined ||
        avgStrokeRate !== undefined;

      if (metricsChanged) {
        // Get user for effort score calculation
        const user = await server.prisma.user.findUnique({
          where: { id: userId },
          select: { maxHr: true, restingHr: true, heightCm: true, weightKg: true, birthDate: true },
        });

        // Calculate age from birthDate
        const age = user?.birthDate
          ? Math.floor((Date.now() - new Date(user.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
          : 30;

        // Build user profile for UTx effort calculation
        const userProfile: UserProfile = {
          age,
          weightKg: user?.weightKg || 75,
          heightCm: user?.heightCm || 175,
          maxHr: user?.maxHr || 190,
          restingHr: user?.restingHr || 50,
        };

        // Use new values if provided, otherwise use existing
        const finalTimeSeconds = totalTimeSeconds ?? existing.totalTimeSeconds;
        const finalDistanceMetres = totalDistanceMetres ?? existing.totalDistanceMetres;
        const finalAvgHeartRate = avgHeartRate ?? existing.avgHeartRate;
        const finalAvgStrokeRate = avgStrokeRate ?? existing.averageRate;

        // Build intervals array for effort calculation
        const intervals: Interval[] = [{
          distanceMetres: finalDistanceMetres,
          timeSeconds: finalTimeSeconds,
          avgHeartRate: finalAvgHeartRate ?? undefined,
          strokeRate: finalAvgStrokeRate ?? undefined,
        }];

        // Calculate UTx Effort Score (0-100 EP)
        const utxResult = calculateUtxEffortScore(userProfile, intervals);

        // Also calculate legacy effort score (0-10) for backward compatibility
        const effortScore = user?.maxHr
          ? calculateEffortScore({
              avgHeartRate: finalAvgHeartRate,
              maxHeartRate: maxHeartRate ?? existing.maxHeartRate,
              userMaxHr: user.maxHr,
              totalTimeSeconds: finalTimeSeconds,
              workoutType: workoutType ? mapWorkoutType(workoutType) : existing.workoutType,
            })
          : calculateEffortScore({
              avgHeartRate: null,
              maxHeartRate: null,
              userMaxHr: 180,
              totalTimeSeconds: finalTimeSeconds,
              workoutType: workoutType ? mapWorkoutType(workoutType) : existing.workoutType,
            });

        updateData.effortScore = effortScore;
        updateData.effortPoints = utxResult.effortPoints;
        updateData.effortZone = utxResult.zone;
        updateData.effortBreakdown = utxResult.breakdown as any;
      }

      const workout = await server.prisma.workout.update({
        where: { id: workoutId },
        data: updateData,
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

      // Input validation
      if (!content || typeof content !== 'string') {
        return reply.status(400).send({
          success: false,
          error: 'Comment content is required',
        });
      }

      const trimmedContent = content.trim();
      if (trimmedContent.length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'Comment cannot be empty',
        });
      }

      if (trimmedContent.length > 1000) {
        return reply.status(400).send({
          success: false,
          error: 'Comment cannot exceed 1000 characters',
        });
      }

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

      request.log.info(`OCR request received, image size: ${imageBase64?.length || 0} chars`);

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
        request.log.error(`Invalid image data: length=${imageBase64?.length || 0}`);
        return reply.status(400).send({
          success: false,
          error: 'Invalid image data',
        });
      }

      request.log.info('Sending image to OpenAI GPT-4o Vision...');

      // Comprehensive prompt for Concept2 erg screen OCR
      const ocrPrompt = `You are extracting workout data from a Concept2 rowing machine (PM5/PM4) display photo.

YOUR TASK: Extract all visible workout metrics and return as JSON.

FIELDS TO EXTRACT:
{
  "workoutType": "time" | "distance" | "intervals" | "just_row",
  "totalDistanceMetres": integer or null,
  "totalTimeSeconds": float (convert M:SS.s to seconds),
  "avgSplit": float (in seconds per 500m, convert M:SS.s to seconds),
  "avgStrokeRate": integer,
  "avgWatts": integer or null,
  "avgHeartRate": integer or null,
  "maxHeartRate": integer or null,
  "calories": integer or null,
  "dragFactor": integer or null,
  "intervals": [
    {
      "distanceMetres": integer,
      "timeSeconds": float,
      "split": float,
      "strokeRate": integer,
      "heartRate": integer or null
    }
  ] or null if not an interval workout,
  "estimatedDistanceMetres": integer or null (calculate if distance shows 0),
  "confidence": integer 0-100,
  "rawValues": {
    "timeDisplay": "string as shown on screen",
    "splitDisplay": "string as shown on screen",
    "distanceDisplay": "string as shown on screen"
  }
}

CRITICAL RULES:

1. SPLIT vs TIME - Do NOT confuse these:
   - Split/Pace: Always 1:20 - 3:00 range (per 500m)
   - Total Time: Always 5:00 - 90:00+ range (whole workout)
   - If you see "/500m" label, that's the split
   - If you see "time" label, that's total time

2. DISTANCE SHOWING 0:
   - If distance displays "0m", this means END of a timed piece
   - Calculate: estimatedDistanceMetres = (totalTimeSeconds / avgSplit) * 500
   - Round to nearest 10m

3. INTERVAL WORKOUTS:
   - Look for "View Detail" or multiple rows of data
   - Format like "7x500m" indicates intervals
   - Extract each interval's split, time, stroke rate, HR if visible

4. TIME CONVERSION:
   - "9:57.5" = 597.5 seconds
   - "1:51.9" = 111.9 seconds
   - Always output as float seconds

5. VALIDATION CHECK:
   - Verify: (totalTimeSeconds / avgSplit) * 500 ≈ totalDistanceMetres (±5%)
   - If mismatch, flag in confidence score

6. SCREEN TYPES - recognize these:
   - "Just Row" screen: shows live data, distance counting up
   - "Workout Summary": shows final totals
   - "View Detail": shows interval breakdown
   - "In Progress": shows projected finish time

7. WHAT TO IGNORE:
   - Button labels (Units, Display, Menu)
   - PM5 branding
   - Partial/blurry numbers - return null, don't guess

Return ONLY valid JSON. No explanation or markdown.`;

      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: ocrPrompt,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${imageBase64}`,
                    detail: 'high', // Use high detail for small text on erg screens
                  },
                },
              ],
            },
          ],
          max_tokens: 1500,
          response_format: { type: 'json_object' }, // Enforce JSON response
        });

        // Log full OpenAI response metadata
        request.log.info({
          openaiResponseId: response.id,
          model: response.model,
          finishReason: response.choices[0]?.finish_reason,
          promptTokens: response.usage?.prompt_tokens,
          completionTokens: response.usage?.completion_tokens,
          totalTokens: response.usage?.total_tokens,
        }, 'OpenAI response metadata');

        const content = response.choices[0]?.message?.content;

        // Log the raw content from OpenAI
        request.log.info({ rawContent: content }, 'OpenAI raw response content');

        if (!content) {
          throw new Error('No response from OpenAI');
        }

        // Parse the JSON response
        let ocrData;
        try {
          ocrData = JSON.parse(content);
          request.log.info({ ocrData }, 'Parsed OCR data directly from JSON');
        } catch {
          // Fallback: try to extract JSON from response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            request.log.error({ content }, 'Could not find JSON in OpenAI response');
            throw new Error('Could not parse OCR response');
          }
          request.log.info({ jsonString: jsonMatch[0] }, 'Extracted JSON from response (fallback)');
          ocrData = JSON.parse(jsonMatch[0]);
          request.log.info({ ocrData }, 'Parsed OCR data from extracted JSON');
        }

        // Validate and fix common OCR errors
        ocrData = validateOcrData(ocrData);

        request.log.info({ ocrData, confidence: ocrData.confidence }, 'OCR successful after validation')

        return reply.send({
          success: true,
          data: { ocrData },
        });
      } catch (error: any) {
        request.log.error({ err: error, code: error?.code, message: error?.message }, 'OCR processing failed');

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

        // Capture OCR errors in Sentry
        Sentry.captureException(error, {
          tags: { route: 'ocr', errorCode: error?.code },
          extra: { errorMessage, imageSize: imageBase64?.length },
        });

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
