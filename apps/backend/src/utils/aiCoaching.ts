import OpenAI from 'openai';

// AI Coaching Insights Generator
// Uses GPT-4 to generate personalized coaching feedback

interface WorkoutData {
  workoutType: string;
  totalTimeSeconds: number;
  totalDistanceMetres: number;
  averageSplitSeconds: number;
  averageRate: number;
  averageWatts?: number | null;
  avgHeartRate?: number | null;
  maxHeartRate?: number | null;
  effortScore?: number | null;
  intervals?: any; // JSON
}

interface UserProfile {
  heightCm: number;
  weightKg: number;
  age: number; // calculated from birthDate
  gender: string;
  maxHr: number;
}

interface WorkoutHistory {
  recentWorkouts: Array<{
    workoutType: string;
    totalDistanceMetres: number;
    averageSplitSeconds: number;
    effortScore?: number | null;
    workoutDate: Date;
  }>;
  pbs: Array<{
    category: string;
    timeSeconds?: number | null;
  }>;
}

export async function generateCoachingInsight(
  workout: WorkoutData,
  userProfile: UserProfile,
  history: WorkoutHistory
): Promise<string | null> {
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!openaiApiKey) {
    console.warn('OpenAI API key not configured, skipping AI coaching');
    return null;
  }

  const openai = new OpenAI({ apiKey: openaiApiKey });

  // Build the prompt
  const prompt = buildCoachingPrompt(workout, userProfile, history);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Use the cheaper model for coaching
      messages: [
        {
          role: 'system',
          content: `You are a knowledgeable rowing coach analyzing workout data.
Your tone is supportive, evidence-based, and occasionally challenging.
The athlete knows their programme - you help them see patterns they might miss.
Keep insights to 2-3 sentences max. Be specific and actionable.
Never be patronizing. Focus on the data, not generic advice.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 200,
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || null;
  } catch (error) {
    console.error('Failed to generate AI coaching insight:', error);
    return null;
  }
}

function buildCoachingPrompt(
  workout: WorkoutData,
  userProfile: UserProfile,
  history: WorkoutHistory
): string {
  const workoutTypeDisplay = formatWorkoutType(workout.workoutType);

  // Build athlete profile section
  const profileSection = `Athlete profile:
- Height: ${userProfile.heightCm}cm
- Weight: ${userProfile.weightKg}kg
- Age: ${userProfile.age}
- Gender: ${userProfile.gender}
- Max HR: ${userProfile.maxHr} bpm`;

  // Build current workout section
  const workoutSection = `Current workout (${workoutTypeDisplay}):
- Distance: ${workout.totalDistanceMetres}m
- Time: ${formatTime(workout.totalTimeSeconds)}
- Avg Split: ${formatSplit(workout.averageSplitSeconds)}/500m
- Avg Rate: ${workout.averageRate} spm${workout.averageWatts ? `
- Avg Watts: ${Math.round(workout.averageWatts)}W` : ''}${workout.avgHeartRate ? `
- Avg HR: ${workout.avgHeartRate} bpm (${Math.round((workout.avgHeartRate / userProfile.maxHr) * 100)}% of max)` : ''}${workout.maxHeartRate ? `
- Max HR: ${workout.maxHeartRate} bpm` : ''}${workout.effortScore ? `
- Effort Score: ${workout.effortScore.toFixed(1)}/10` : ''}`;

  // Build history section
  let historySection = '';
  if (history.recentWorkouts.length > 0) {
    const similarWorkouts = history.recentWorkouts.filter(
      w => w.workoutType === workout.workoutType
    );

    if (similarWorkouts.length > 0) {
      const lastSimilar = similarWorkouts[0];
      historySection = `
Previous ${workoutTypeDisplay} (${formatDateAgo(lastSimilar.workoutDate)}):
- Distance: ${lastSimilar.totalDistanceMetres}m
- Avg Split: ${formatSplit(lastSimilar.averageSplitSeconds)}/500m${lastSimilar.effortScore ? `
- Effort Score: ${lastSimilar.effortScore.toFixed(1)}/10` : ''}`;
    }

    // Add training load context
    const lastWeekWorkouts = history.recentWorkouts.filter(w => {
      const daysDiff = (Date.now() - new Date(w.workoutDate).getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 7;
    });

    if (lastWeekWorkouts.length > 0) {
      const weeklyVolume = lastWeekWorkouts.reduce((sum, w) => sum + w.totalDistanceMetres, 0);
      const avgEffort = lastWeekWorkouts.filter(w => w.effortScore).length > 0
        ? lastWeekWorkouts.filter(w => w.effortScore).reduce((sum, w) => sum + (w.effortScore || 0), 0) / lastWeekWorkouts.filter(w => w.effortScore).length
        : null;

      historySection += `

Last 7 days:
- ${lastWeekWorkouts.length} workouts
- ${Math.round(weeklyVolume / 1000)}km total${avgEffort ? `
- Avg Effort: ${avgEffort.toFixed(1)}/10` : ''}`;
    }
  }

  // Build PBs section
  let pbSection = '';
  if (history.pbs.length > 0) {
    const relevantPb = history.pbs.find(pb => pb.category === workout.workoutType);
    if (relevantPb && relevantPb.timeSeconds) {
      pbSection = `

Current PB for ${workoutTypeDisplay}: ${formatTime(relevantPb.timeSeconds)}`;
    }
  }

  return `${profileSection}

${workoutSection}${historySection}${pbSection}

Provide 1-2 specific, actionable coaching insights about this workout. Be supportive but honest.`;
}

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
    custom: 'Custom Workout',
  };
  return typeMap[type] || type;
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

function formatDateAgo(date: Date): string {
  const daysDiff = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff === 0) return 'today';
  if (daysDiff === 1) return 'yesterday';
  if (daysDiff < 7) return `${daysDiff} days ago`;
  if (daysDiff < 30) return `${Math.floor(daysDiff / 7)} weeks ago`;
  return `${Math.floor(daysDiff / 30)} months ago`;
}
