import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface InsightsQuery {
  workoutId?: string;
}

export async function coachingRoutes(server: FastifyInstance): Promise<void> {
  // Get AI coaching insights for a workout
  server.get<{ Querystring: InsightsQuery }>(
    '/insights',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest<{ Querystring: InsightsQuery }>, reply: FastifyReply) => {
      const userId = request.user!.id;
      const { workoutId } = request.query;

      // Get user profile and recent workouts
      const [user, recentWorkouts, personalBests] = await Promise.all([
        server.prisma.user.findUnique({
          where: { id: userId },
          select: {
            displayName: true,
            gender: true,
            birthDate: true,
            heightCm: true,
            weightKg: true,
            maxHr: true,
          },
        }),
        server.prisma.workout.findMany({
          where: { userId },
          orderBy: { workoutDate: 'desc' },
          take: 10,
          select: {
            id: true,
            workoutType: true,
            totalTimeSeconds: true,
            totalDistanceMetres: true,
            avgSplit: true,
            avgStrokeRate: true,
            avgWatts: true,
            avgHeartRate: true,
            effortScore: true,
            workoutDate: true,
          },
        }),
        server.prisma.personalBest.findMany({
          where: { userId },
          orderBy: { distanceMetres: 'asc' },
        }),
      ]);

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: 'User not found',
        });
      }

      // Get specific workout if requested
      let targetWorkout = null;
      if (workoutId) {
        targetWorkout = await server.prisma.workout.findUnique({
          where: { id: workoutId },
        });
      }

      // Calculate age
      const age = user.birthDate
        ? Math.floor(
            (Date.now() - new Date(user.birthDate).getTime()) /
              (365.25 * 24 * 60 * 60 * 1000)
          )
        : null;

      // Build context for AI
      const context = {
        athlete: {
          name: user.displayName,
          gender: user.gender,
          age,
          heightCm: user.heightCm,
          weightKg: user.weightKg,
          maxHr: user.maxHr,
        },
        personalBests: personalBests.map((pb) => ({
          distance: pb.distanceMetres,
          timeSeconds: pb.timeSeconds,
          split: pb.split,
          watts: pb.watts,
        })),
        recentWorkouts: recentWorkouts.map((w) => ({
          type: w.workoutType,
          date: w.workoutDate,
          distanceMetres: w.totalDistanceMetres,
          timeSeconds: w.totalTimeSeconds,
          split: w.avgSplit,
          strokeRate: w.avgStrokeRate,
          watts: w.avgWatts,
          heartRate: w.avgHeartRate,
          effortScore: w.effortScore,
        })),
        targetWorkout: targetWorkout
          ? {
              type: targetWorkout.workoutType,
              date: targetWorkout.workoutDate,
              distanceMetres: targetWorkout.totalDistanceMetres,
              timeSeconds: targetWorkout.totalTimeSeconds,
              split: targetWorkout.avgSplit,
              strokeRate: targetWorkout.avgStrokeRate,
              watts: targetWorkout.avgWatts,
              heartRate: targetWorkout.avgHeartRate,
              maxHeartRate: targetWorkout.maxHeartRate,
              calories: targetWorkout.calories,
              dragFactor: targetWorkout.dragFactor,
              effortScore: targetWorkout.effortScore,
            }
          : null,
      };

      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are an expert rowing coach providing personalized training insights. Analyze the athlete's data and provide actionable, encouraging feedback.

Your response should include:
1. A brief summary of their recent training (2-3 sentences)
2. Key observations about their performance patterns
3. 2-3 specific, actionable recommendations
4. Encouragement and motivation

Keep your response concise (under 250 words). Use rowing-specific terminology appropriately. Focus on what they're doing well and how to improve.

Format your response as JSON with these fields:
{
  "summary": "Brief training summary",
  "observations": ["observation 1", "observation 2"],
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"],
  "motivation": "Encouraging closing message"
}`,
            },
            {
              role: 'user',
              content: `Please analyze this athlete's data and provide coaching insights:\n\n${JSON.stringify(context, null, 2)}`,
            },
          ],
          max_tokens: 500,
          response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No response from AI');
        }

        const insights = JSON.parse(content);

        return reply.send({
          success: true,
          data: { insights },
        });
      } catch (error) {
        request.log.error(error, 'AI coaching insights failed');
        return reply.status(500).send({
          success: false,
          error: 'Failed to generate coaching insights',
        });
      }
    }
  );

  // Get training plan suggestion
  server.get(
    '/training-plan',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;

      // Get user data
      const [user, recentWorkouts, personalBests] = await Promise.all([
        server.prisma.user.findUnique({
          where: { id: userId },
          select: {
            displayName: true,
            gender: true,
            birthDate: true,
            maxHr: true,
          },
        }),
        server.prisma.workout.findMany({
          where: { userId },
          orderBy: { workoutDate: 'desc' },
          take: 20,
          select: {
            workoutType: true,
            totalTimeSeconds: true,
            totalDistanceMetres: true,
            avgHeartRate: true,
            effortScore: true,
            workoutDate: true,
          },
        }),
        server.prisma.personalBest.findMany({
          where: { userId },
        }),
      ]);

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: 'User not found',
        });
      }

      // Calculate training load and patterns
      const totalMetresLast7Days = recentWorkouts
        .filter(
          (w) =>
            new Date(w.workoutDate) >
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        )
        .reduce((sum, w) => sum + w.totalDistanceMetres, 0);

      const avgEffort =
        recentWorkouts.length > 0
          ? recentWorkouts.reduce((sum, w) => sum + (w.effortScore || 0), 0) /
            recentWorkouts.length
          : 0;

      const context = {
        athlete: {
          name: user.displayName,
          gender: user.gender,
          maxHr: user.maxHr,
        },
        trainingLoad: {
          metresLast7Days: totalMetresLast7Days,
          workoutsLast7Days: recentWorkouts.filter(
            (w) =>
              new Date(w.workoutDate) >
              new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          ).length,
          avgEffortScore: avgEffort,
        },
        personalBests: personalBests.map((pb) => ({
          distance: pb.distanceMetres,
          timeSeconds: pb.timeSeconds,
        })),
        recentWorkoutTypes: recentWorkouts.map((w) => w.workoutType),
      };

      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are an expert rowing coach creating a weekly training plan. Based on the athlete's recent training load and performance, suggest a balanced week of training.

Consider:
- Appropriate volume based on recent training
- Mix of steady state, intervals, and technique work
- Adequate recovery
- Progressive overload principles

Format your response as JSON:
{
  "weeklyGoal": "Brief goal for the week",
  "totalMetresTarget": number,
  "sessions": [
    {
      "day": "Monday",
      "type": "steady_state | intervals | technique | rest",
      "description": "Brief workout description",
      "targetMetres": number or null,
      "targetTime": number (seconds) or null,
      "intensity": "low | medium | high"
    }
  ],
  "notes": "Any additional coaching notes"
}`,
            },
            {
              role: 'user',
              content: `Create a weekly training plan for this athlete:\n\n${JSON.stringify(context, null, 2)}`,
            },
          ],
          max_tokens: 800,
          response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No response from AI');
        }

        const plan = JSON.parse(content);

        return reply.send({
          success: true,
          data: { plan },
        });
      } catch (error) {
        request.log.error(error, 'Training plan generation failed');
        return reply.status(500).send({
          success: false,
          error: 'Failed to generate training plan',
        });
      }
    }
  );

  // Analyze workout comparison
  server.get<{ Querystring: { workoutIds: string } }>(
    '/compare',
    { preHandler: [server.authenticate] },
    async (
      request: FastifyRequest<{ Querystring: { workoutIds: string } }>,
      reply: FastifyReply
    ) => {
      const userId = request.user!.id;
      const workoutIds = request.query.workoutIds.split(',');

      if (workoutIds.length < 2 || workoutIds.length > 5) {
        return reply.status(400).send({
          success: false,
          error: 'Please provide 2-5 workout IDs to compare',
        });
      }

      const workouts = await server.prisma.workout.findMany({
        where: {
          id: { in: workoutIds },
          userId, // Ensure user owns all workouts
        },
        orderBy: { workoutDate: 'asc' },
      });

      if (workouts.length < 2) {
        return reply.status(400).send({
          success: false,
          error: 'Could not find enough workouts to compare',
        });
      }

      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are an expert rowing coach analyzing workout progressions. Compare the provided workouts and identify trends, improvements, and areas for focus.

Format your response as JSON:
{
  "trend": "improving | stable | declining",
  "keyChanges": ["change 1", "change 2"],
  "analysis": "Detailed analysis paragraph",
  "recommendations": ["recommendation 1", "recommendation 2"]
}`,
            },
            {
              role: 'user',
              content: `Compare these workouts in chronological order:\n\n${JSON.stringify(
                workouts.map((w) => ({
                  date: w.workoutDate,
                  type: w.workoutType,
                  distanceMetres: w.totalDistanceMetres,
                  timeSeconds: w.totalTimeSeconds,
                  split: w.avgSplit,
                  strokeRate: w.avgStrokeRate,
                  watts: w.avgWatts,
                  heartRate: w.avgHeartRate,
                  effortScore: w.effortScore,
                })),
                null,
                2
              )}`,
            },
          ],
          max_tokens: 500,
          response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No response from AI');
        }

        const comparison = JSON.parse(content);

        return reply.send({
          success: true,
          data: { comparison },
        });
      } catch (error) {
        request.log.error(error, 'Workout comparison failed');
        return reply.status(500).send({
          success: false,
          error: 'Failed to compare workouts',
        });
      }
    }
  );
}
