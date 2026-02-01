// Effort Score Calculation (0-10 scale, Whoop-style)
// Based on: HR zones, duration, workout type, avg HR as % of max

interface EffortScoreInput {
  avgHeartRate?: number | null;
  maxHeartRate?: number | null;
  userMaxHr: number;
  totalTimeSeconds: number;
  workoutType: string;
  hrData?: any; // JSON array of HR readings
}

interface HrZoneTimes {
  zone1: number; // Recovery (<60% max)
  zone2: number; // Easy Aerobic (60-70%)
  zone3: number; // Aerobic (70-80%)
  zone4: number; // Threshold (80-90%)
  zone5: number; // Max (90%+)
}

export function calculateEffortScore(input: EffortScoreInput): number {
  const {
    avgHeartRate,
    maxHeartRate,
    userMaxHr,
    totalTimeSeconds,
    workoutType,
    hrData,
  } = input;

  // If no HR data, estimate based on workout type and duration
  if (!avgHeartRate) {
    return estimateEffortFromWorkoutType(workoutType, totalTimeSeconds);
  }

  // Calculate base score from avg HR as percentage of max
  const avgHrPercentage = avgHeartRate / userMaxHr;
  let score = 0;

  // HR intensity factor (0-6 points)
  if (avgHrPercentage >= 0.9) {
    score += 6;
  } else if (avgHrPercentage >= 0.8) {
    score += 5 + (avgHrPercentage - 0.8) * 10;
  } else if (avgHrPercentage >= 0.7) {
    score += 3 + (avgHrPercentage - 0.7) * 20;
  } else if (avgHrPercentage >= 0.6) {
    score += 1 + (avgHrPercentage - 0.6) * 20;
  } else {
    score += avgHrPercentage * 1.67;
  }

  // Duration factor (0-2 points)
  // Longer workouts = more effort
  const durationMinutes = totalTimeSeconds / 60;
  if (durationMinutes >= 60) {
    score += 2;
  } else if (durationMinutes >= 30) {
    score += 1 + (durationMinutes - 30) / 30;
  } else if (durationMinutes >= 10) {
    score += (durationMinutes - 10) / 20;
  }

  // Workout type modifier (0-1 points)
  const typeModifier = getWorkoutTypeModifier(workoutType);
  score += typeModifier;

  // Max HR spike bonus (0-1 point)
  if (maxHeartRate && maxHeartRate / userMaxHr >= 0.95) {
    score += 1;
  } else if (maxHeartRate && maxHeartRate / userMaxHr >= 0.9) {
    score += 0.5;
  }

  // Clamp to 0-10 range
  return Math.min(10, Math.max(0, Math.round(score * 10) / 10));
}

function estimateEffortFromWorkoutType(workoutType: string, durationSeconds: number): number {
  // Estimate effort score when no HR data available
  const durationMinutes = durationSeconds / 60;

  const baseScores: Record<string, number> = {
    two_thousand: 8.5, // 2K tests are brutal
    one_thousand: 8.0,
    five_hundred: 7.5,
    five_thousand: 7.0,
    six_thousand: 6.5,
    ten_thousand: 6.0,
    half_marathon: 5.5,
    marathon: 5.0,
    intervals: 7.0,
    steady_state: 4.0,
    one_minute: 8.0,
    custom: 5.0,
  };

  const baseScore = baseScores[workoutType] || 5.0;

  // Adjust for duration
  let durationAdjustment = 0;
  if (workoutType === 'steady_state' || workoutType === 'custom') {
    if (durationMinutes >= 60) {
      durationAdjustment = 1.5;
    } else if (durationMinutes >= 30) {
      durationAdjustment = 0.75;
    }
  }

  return Math.min(10, baseScore + durationAdjustment);
}

function getWorkoutTypeModifier(workoutType: string): number {
  // Test pieces and intervals are harder than steady state
  const modifiers: Record<string, number> = {
    two_thousand: 1.0,
    one_thousand: 0.8,
    five_hundred: 0.6,
    one_minute: 0.8,
    intervals: 0.7,
    five_thousand: 0.5,
    six_thousand: 0.4,
    ten_thousand: 0.3,
    half_marathon: 0.2,
    marathon: 0.1,
    steady_state: 0,
    custom: 0.3,
  };

  return modifiers[workoutType] || 0.3;
}

// Calculate time spent in each HR zone
export function calculateHrZones(
  hrData: number[],
  maxHr: number
): HrZoneTimes {
  const zones: HrZoneTimes = {
    zone1: 0,
    zone2: 0,
    zone3: 0,
    zone4: 0,
    zone5: 0,
  };

  if (!hrData || hrData.length === 0) {
    return zones;
  }

  // Assuming each reading is 1 second apart
  for (const hr of hrData) {
    const percentage = hr / maxHr;

    if (percentage >= 0.9) {
      zones.zone5++;
    } else if (percentage >= 0.8) {
      zones.zone4++;
    } else if (percentage >= 0.7) {
      zones.zone3++;
    } else if (percentage >= 0.6) {
      zones.zone2++;
    } else {
      zones.zone1++;
    }
  }

  return zones;
}
