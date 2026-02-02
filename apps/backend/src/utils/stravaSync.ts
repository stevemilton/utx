import { PrismaClient } from '@prisma/client';

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;

interface StravaUser {
  stravaConnected: boolean;
  stravaAutoSync: boolean;
  stravaAccessToken: string | null;
  stravaRefreshToken: string | null;
  stravaTokenExpiresAt: Date | null;
}

interface WorkoutData {
  id: string;
  userId: string;
  workoutType: string;
  totalTimeSeconds: number;
  totalDistanceMetres: number;
  averageSplitSeconds: number;
  averageRate: number;
  averageWatts: number | null;
  avgHeartRate: number | null;
  effortScore: number | null;
  workoutDate: Date;
  stravaActivityId: string | null;
}

/**
 * Automatically sync a workout to Strava if the user has it enabled
 * This runs asynchronously and should not block workout creation
 */
export async function autoSyncToStrava(
  prisma: PrismaClient,
  workout: WorkoutData,
  logger?: { info: (msg: string) => void; error: (err: any, msg: string) => void }
): Promise<void> {
  const log = logger || { info: console.log, error: console.error };

  try {
    // Check if Strava is configured
    if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
      return;
    }

    // Get user's Strava settings
    const user = await prisma.user.findUnique({
      where: { id: workout.userId },
      select: {
        stravaConnected: true,
        stravaAutoSync: true,
        stravaAccessToken: true,
        stravaRefreshToken: true,
        stravaTokenExpiresAt: true,
      },
    });

    // Check if user has Strava connected and auto-sync enabled
    if (!user?.stravaConnected || !user.stravaAutoSync || !user.stravaAccessToken) {
      return;
    }

    // Skip if workout already synced
    if (workout.stravaActivityId) {
      return;
    }

    log.info(`Auto-syncing workout ${workout.id} to Strava`);

    // Refresh token if expired
    let accessToken = user.stravaAccessToken;
    if (user.stravaTokenExpiresAt && user.stravaTokenExpiresAt < new Date()) {
      accessToken = await refreshStravaToken(prisma, workout.userId, user.stravaRefreshToken!);
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
      throw new Error(`Strava API error: ${JSON.stringify(error)}`);
    }

    const activity = await response.json() as { id: number };

    // Save Strava activity ID
    await prisma.workout.update({
      where: { id: workout.id },
      data: { stravaActivityId: String(activity.id) },
    });

    log.info(`Workout ${workout.id} synced to Strava (activity ${activity.id})`);
  } catch (error) {
    log.error(error, `Failed to auto-sync workout ${workout.id} to Strava`);
    // Don't throw - auto-sync failures shouldn't affect workout creation
  }
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
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
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
function formatWorkoutDescription(workout: WorkoutData): string {
  const parts = [
    `UTx Workout Report`,
    ``,
    `Distance: ${workout.totalDistanceMetres}m`,
    `Time: ${formatTime(workout.totalTimeSeconds)}`,
    `Avg Split: ${formatSplit(workout.averageSplitSeconds)}/500m`,
    `Avg Rate: ${workout.averageRate} spm`,
  ];

  if (workout.averageWatts) {
    parts.push(`Avg Watts: ${Math.round(workout.averageWatts)}W`);
  }

  if (workout.avgHeartRate) {
    parts.push(`Avg HR: ${workout.avgHeartRate} bpm`);
  }

  if (workout.effortScore) {
    parts.push(`Effort Score: ${workout.effortScore.toFixed(1)}/10`);
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
