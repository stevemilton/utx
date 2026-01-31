import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const STRAVA_REDIRECT_URI = process.env.STRAVA_REDIRECT_URI;

interface StravaCallbackQuery {
  code: string;
  state?: string;
}

interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete: {
    id: number;
    firstname: string;
    lastname: string;
    profile: string;
  };
}

export async function stravaRoutes(server: FastifyInstance): Promise<void> {
  // Get Strava auth URL
  server.get(
    '/auth-url',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;

      if (!STRAVA_CLIENT_ID || !STRAVA_REDIRECT_URI) {
        return reply.status(500).send({
          success: false,
          error: 'Strava integration not configured',
        });
      }

      const scope = 'read,activity:read_all';
      const authUrl = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(STRAVA_REDIRECT_URI)}&scope=${scope}&state=${userId}`;

      return reply.send({
        success: true,
        data: { authUrl },
      });
    }
  );

  // Handle Strava OAuth callback
  server.get<{ Querystring: StravaCallbackQuery }>(
    '/callback',
    async (request: FastifyRequest<{ Querystring: StravaCallbackQuery }>, reply: FastifyReply) => {
      const { code, state: userId } = request.query;

      if (!userId) {
        return reply.status(400).send({
          success: false,
          error: 'Missing user state',
        });
      }

      try {
        // Exchange code for tokens
        const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: STRAVA_CLIENT_ID,
            client_secret: STRAVA_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
          }),
        });

        if (!tokenResponse.ok) {
          throw new Error('Failed to exchange code for tokens');
        }

        const tokens: StravaTokenResponse = await tokenResponse.json();

        // Store tokens in database
        await server.prisma.user.update({
          where: { id: userId },
          data: {
            stravaAthleteId: tokens.athlete.id.toString(),
            stravaAccessToken: tokens.access_token,
            stravaRefreshToken: tokens.refresh_token,
            stravaTokenExpiry: new Date(tokens.expires_at * 1000),
          },
        });

        // Redirect back to app
        return reply.redirect('utx://strava-connected');
      } catch (error) {
        request.log.error(error, 'Strava OAuth failed');
        return reply.redirect('utx://strava-error');
      }
    }
  );

  // Check Strava connection status
  server.get(
    '/status',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;

      const user = await server.prisma.user.findUnique({
        where: { id: userId },
        select: {
          stravaAthleteId: true,
          stravaTokenExpiry: true,
        },
      });

      const isConnected = !!user?.stravaAthleteId;
      const isExpired = user?.stravaTokenExpiry
        ? user.stravaTokenExpiry < new Date()
        : false;

      return reply.send({
        success: true,
        data: {
          isConnected,
          needsReauth: isConnected && isExpired,
        },
      });
    }
  );

  // Disconnect Strava
  server.delete(
    '/disconnect',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;

      // Get current tokens to deauthorize
      const user = await server.prisma.user.findUnique({
        where: { id: userId },
        select: { stravaAccessToken: true },
      });

      if (user?.stravaAccessToken) {
        // Deauthorize on Strava
        try {
          await fetch('https://www.strava.com/oauth/deauthorize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              access_token: user.stravaAccessToken,
            }),
          });
        } catch {
          // Continue even if deauthorization fails
        }
      }

      // Clear tokens from database
      await server.prisma.user.update({
        where: { id: userId },
        data: {
          stravaAthleteId: null,
          stravaAccessToken: null,
          stravaRefreshToken: null,
          stravaTokenExpiry: null,
        },
      });

      return reply.send({
        success: true,
        message: 'Strava disconnected',
      });
    }
  );

  // Sync recent Strava activities
  server.post(
    '/sync',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;

      const user = await server.prisma.user.findUnique({
        where: { id: userId },
        select: {
          stravaAccessToken: true,
          stravaRefreshToken: true,
          stravaTokenExpiry: true,
        },
      });

      if (!user?.stravaAccessToken) {
        return reply.status(400).send({
          success: false,
          error: 'Strava not connected',
        });
      }

      let accessToken = user.stravaAccessToken;

      // Refresh token if expired
      if (user.stravaTokenExpiry && user.stravaTokenExpiry < new Date()) {
        try {
          const refreshResponse = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_id: STRAVA_CLIENT_ID,
              client_secret: STRAVA_CLIENT_SECRET,
              refresh_token: user.stravaRefreshToken,
              grant_type: 'refresh_token',
            }),
          });

          if (!refreshResponse.ok) {
            throw new Error('Failed to refresh token');
          }

          const tokens: StravaTokenResponse = await refreshResponse.json();
          accessToken = tokens.access_token;

          await server.prisma.user.update({
            where: { id: userId },
            data: {
              stravaAccessToken: tokens.access_token,
              stravaRefreshToken: tokens.refresh_token,
              stravaTokenExpiry: new Date(tokens.expires_at * 1000),
            },
          });
        } catch (error) {
          request.log.error(error, 'Failed to refresh Strava token');
          return reply.status(401).send({
            success: false,
            error: 'Strava authentication expired. Please reconnect.',
          });
        }
      }

      try {
        // Fetch recent activities (rowing only)
        const activitiesResponse = await fetch(
          'https://www.strava.com/api/v3/athlete/activities?per_page=30',
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!activitiesResponse.ok) {
          throw new Error('Failed to fetch activities');
        }

        const activities = await activitiesResponse.json();

        // Filter for rowing activities
        const rowingActivities = activities.filter(
          (a: any) => a.type === 'Rowing' || a.type === 'VirtualRide'
        );

        // Import activities that don't already exist
        let imported = 0;
        for (const activity of rowingActivities) {
          // Check if already imported
          const existing = await server.prisma.workout.findFirst({
            where: {
              userId,
              stravaActivityId: activity.id.toString(),
            },
          });

          if (existing) continue;

          // Create workout from Strava activity
          await server.prisma.workout.create({
            data: {
              userId,
              stravaActivityId: activity.id.toString(),
              workoutType: 'strava_import',
              totalTimeSeconds: activity.moving_time,
              totalDistanceMetres: Math.round(activity.distance),
              avgSplit: activity.moving_time / activity.distance * 500,
              avgWatts: activity.average_watts,
              avgHeartRate: activity.average_heartrate,
              maxHeartRate: activity.max_heartrate,
              calories: activity.calories,
              notes: activity.name,
              workoutDate: new Date(activity.start_date),
              isPublic: true,
            },
          });

          imported++;
        }

        return reply.send({
          success: true,
          data: {
            activitiesFound: rowingActivities.length,
            activitiesImported: imported,
          },
        });
      } catch (error) {
        request.log.error(error, 'Strava sync failed');
        return reply.status(500).send({
          success: false,
          error: 'Failed to sync Strava activities',
        });
      }
    }
  );
}
