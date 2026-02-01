import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';

// Strava OAuth & Export Routes
export async function stravaRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma;

  const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
  const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
  const STRAVA_REDIRECT_URI = process.env.STRAVA_REDIRECT_URI || 'utx://strava-callback';

  // Get Strava auth URL
  fastify.get('/auth-url', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    if (!STRAVA_CLIENT_ID) {
      return reply.status(503).send({
        success: false,
        error: 'Strava integration not configured',
      });
    }

    const userId = (request as any).userId;
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');

    const authUrl = new URL('https://www.strava.com/oauth/authorize');
    authUrl.searchParams.set('client_id', STRAVA_CLIENT_ID);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', STRAVA_REDIRECT_URI);
    authUrl.searchParams.set('scope', 'activity:write,activity:read_all');
    authUrl.searchParams.set('state', state);

    return {
      success: true,
      data: {
        url: authUrl.toString(),
      },
    };
  });

  // Handle Strava OAuth callback
  fastify.post<{
    Body: { code: string; state?: string };
  }>('/callback', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = (request as any).userId;
    const { code } = request.body;

    if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
      return reply.status(503).send({
        success: false,
        error: 'Strava integration not configured',
      });
    }

    try {
      // Exchange code for tokens
      const response = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: STRAVA_CLIENT_ID,
          client_secret: STRAVA_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to exchange code for tokens');
      }

      const data = await response.json() as {
        access_token: string;
        refresh_token: string;
        expires_at: number;
      };

      // Save tokens to user
      await prisma.user.update({
        where: { id: userId },
        data: {
          stravaConnected: true,
          stravaAccessToken: data.access_token,
          stravaRefreshToken: data.refresh_token,
          stravaTokenExpiresAt: new Date(data.expires_at * 1000),
        },
      });

      return {
        success: true,
        message: 'Strava connected successfully',
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to connect Strava',
      });
    }
  });

  // Disconnect Strava
  fastify.post('/disconnect', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = (request as any).userId;

    await prisma.user.update({
      where: { id: userId },
      data: {
        stravaConnected: false,
        stravaAccessToken: null,
        stravaRefreshToken: null,
        stravaTokenExpiresAt: null,
      },
    });

    return {
      success: true,
      message: 'Strava disconnected',
    };
  });

  // Sync a specific workout to Strava
  fastify.post<{
    Params: { workoutId: string };
  }>('/sync/:workoutId', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = (request as any).userId;
    const { workoutId } = request.params;

    // Get user with Strava tokens
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        stravaConnected: true,
        stravaAccessToken: true,
        stravaRefreshToken: true,
        stravaTokenExpiresAt: true,
      },
    });

    if (!user?.stravaConnected || !user.stravaAccessToken) {
      return reply.status(400).send({
        success: false,
        error: 'Strava not connected',
      });
    }

    // Get workout
    const workout = await prisma.workout.findFirst({
      where: { id: workoutId, userId },
    });

    if (!workout) {
      return reply.status(404).send({
        success: false,
        error: 'Workout not found',
      });
    }

    if (workout.stravaActivityId) {
      return reply.status(409).send({
        success: false,
        error: 'Workout already synced to Strava',
        stravaActivityId: workout.stravaActivityId,
      });
    }

    try {
      // Refresh token if expired
      let accessToken = user.stravaAccessToken;
      if (user.stravaTokenExpiresAt && user.stravaTokenExpiresAt < new Date()) {
        accessToken = await refreshStravaToken(prisma, userId, user.stravaRefreshToken!);
      }

      // Format workout description
      const description = formatWorkoutDescription(workout);

      // Create Strava activity
      const response = await fetch('https://www.strava.com/api/v3/activities', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `${formatWorkoutType(workout.workoutType)} - ${workout.totalDistanceMetres}m`,
          type: 'Rowing',
          sport_type: 'Rowing',
          start_date_local: workout.workoutDate.toISOString(),
          elapsed_time: Math.round(workout.totalTimeSeconds),
          distance: workout.totalDistanceMetres,
          description,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(JSON.stringify(error));
      }

      const activity = await response.json() as { id: number };

      // Save Strava activity ID
      await prisma.workout.update({
        where: { id: workoutId },
        data: { stravaActivityId: String(activity.id) },
      });

      return {
        success: true,
        message: 'Workout synced to Strava',
        data: {
          stravaActivityId: activity.id,
        },
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to sync to Strava',
      });
    }
  });

  // Get Strava connection status
  fastify.get('/status', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = (request as any).userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stravaConnected: true },
    });

    return {
      success: true,
      data: {
        connected: user?.stravaConnected || false,
      },
    };
  });
}

// Helper to refresh Strava token
async function refreshStravaToken(
  prisma: PrismaClient,
  userId: string,
  refreshToken: string
): Promise<string> {
  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh Strava token');
  }

  const data = await response.json() as {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };

  await prisma.user.update({
    where: { id: userId },
    data: {
      stravaAccessToken: data.access_token,
      stravaRefreshToken: data.refresh_token,
      stravaTokenExpiresAt: new Date(data.expires_at * 1000),
    },
  });

  return data.access_token;
}

// Format workout type for Strava title
function formatWorkoutType(type: string): string {
  const typeMap: Record<string, string> = {
    five_hundred: '500m',
    one_thousand: '1000m',
    two_thousand: '2K',
    five_thousand: '5K',
    six_thousand: '6K',
    ten_thousand: '10K',
    half_marathon: 'Half Marathon',
    marathon: 'Marathon',
    one_minute: '1 Minute',
    steady_state: 'Steady State',
    intervals: 'Intervals',
    custom: 'Erg Workout',
  };
  return typeMap[type] || 'Erg Workout';
}

// Format workout description for Strava
function formatWorkoutDescription(workout: any): string {
  const parts = [
    `📊 UTx Workout Report`,
    ``,
    `🚣 Distance: ${workout.totalDistanceMetres}m`,
    `⏱️ Time: ${formatTime(workout.totalTimeSeconds)}`,
    `💨 Avg Split: ${formatSplit(workout.averageSplitSeconds)}/500m`,
    `🔄 Avg Rate: ${workout.averageRate} spm`,
  ];

  if (workout.averageWatts) {
    parts.push(`⚡ Avg Watts: ${Math.round(workout.averageWatts)}W`);
  }

  if (workout.avgHeartRate) {
    parts.push(`❤️ Avg HR: ${workout.avgHeartRate} bpm`);
  }

  if (workout.effortScore) {
    parts.push(`💪 Effort Score: ${workout.effortScore.toFixed(1)}/10`);
  }

  parts.push(``, `Logged with UTx - Every metre counts.`);

  return parts.join('\n');
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  return `${mins}:${secs.padStart(4, '0')}`;
}

function formatSplit(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  return `${mins}:${secs.padStart(4, '0')}`;
}
