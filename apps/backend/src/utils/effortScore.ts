/**
 * UTx Effort Score Algorithm
 *
 * A rowing-specific strain metric that accounts for:
 * - Cardiovascular load (HR-based using Karvonen method)
 * - Mechanical work (watts × time, size-adjusted)
 * - Pacing efficiency (consistency bonus/penalty)
 * - Stroke economy (stroke rate factor)
 *
 * Scale: 0-100 Effort Points (EP)
 * - 0-25:  Recovery (green)
 * - 26-50: Building (blue)
 * - 51-75: Training (yellow)
 * - 76-100: Peak (red)
 */

// ============ INTERFACES ============

export interface UserProfile {
  age: number;
  weightKg: number;
  heightCm: number;
  maxHr: number;
  restingHr?: number; // defaults to 50
}

export interface Interval {
  distanceMetres: number;
  timeSeconds: number;
  avgHeartRate?: number;
  strokeRate?: number;
}

export interface EffortBreakdown {
  cardiacLoad: number; // 0-40
  workOutput: number; // 0-35
  pacing: number; // 0-15
  economy: number; // 0-10
}

export interface EffortResult {
  effortPoints: number; // 0-100
  zone: 'recovery' | 'building' | 'training' | 'peak';
  zoneColor: 'green' | 'blue' | 'yellow' | 'red';
  breakdown: EffortBreakdown;
  sessionStats: {
    totalDistanceM: number;
    totalTimeMins: number;
    avgWatts: number;
    avgSplit: string;
  };
}

// Legacy interface for backward compatibility
export interface EffortScoreInput {
  avgHeartRate?: number | null;
  maxHeartRate?: number | null;
  userMaxHr: number;
  totalTimeSeconds: number;
  workoutType: string;
  hrData?: any;
}

// ============ HELPER FUNCTIONS ============

/**
 * Calculate watts from distance and time using Concept2 formula
 * watts = 2.80 / pace^3 where pace is in seconds per meter
 */
function calculateWatts(distanceMetres: number, timeSeconds: number): number {
  if (distanceMetres <= 0 || timeSeconds <= 0) return 0;
  const paceMetersPerSecond = distanceMetres / timeSeconds;
  return 2.80 * Math.pow(paceMetersPerSecond, 3);
}

/**
 * Convert seconds to M:SS.s format
 */
function formatSplit(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
}

/**
 * Get 500m split time in seconds from distance and time
 */
function getSplitSeconds(distanceMetres: number, timeSeconds: number): number {
  if (distanceMetres <= 0) return 0;
  return (timeSeconds / distanceMetres) * 500;
}

/**
 * Determine effort zone from score
 */
function getZoneInfo(ep: number): { zone: EffortResult['zone']; zoneColor: EffortResult['zoneColor'] } {
  if (ep <= 25) return { zone: 'recovery', zoneColor: 'green' };
  if (ep <= 50) return { zone: 'building', zoneColor: 'blue' };
  if (ep <= 75) return { zone: 'training', zoneColor: 'yellow' };
  return { zone: 'peak', zoneColor: 'red' };
}

// ============ MAIN CALCULATION ============

/**
 * Calculate UTx Effort Score (0-100 EP)
 *
 * Components:
 * 1. Cardiac Load (40% weight) - HR-based strain using Karvonen method
 * 2. Work Output (35% weight) - Power × duration, size-adjusted
 * 3. Pacing Factor (15% weight) - Consistency bonus/penalty
 * 4. Economy Factor (10% weight) - Stroke rate efficiency
 */
export function calculateUtxEffortScore(
  user: UserProfile,
  intervals: Interval[]
): EffortResult {
  if (!intervals || intervals.length === 0) {
    return {
      effortPoints: 0,
      zone: 'recovery',
      zoneColor: 'green',
      breakdown: { cardiacLoad: 0, workOutput: 0, pacing: 0, economy: 0 },
      sessionStats: { totalDistanceM: 0, totalTimeMins: 0, avgWatts: 0, avgSplit: '0:00.0' },
    };
  }

  const restingHr = user.restingHr || 50;

  // Calculate aggregate stats
  const totalDistance = intervals.reduce((sum, i) => sum + i.distanceMetres, 0);
  const totalTime = intervals.reduce((sum, i) => sum + i.timeSeconds, 0);
  const totalTimeMins = totalTime / 60;

  // Calculate watts per interval and average
  const intervalWatts = intervals.map((i) => calculateWatts(i.distanceMetres, i.timeSeconds));
  const avgWatts = intervalWatts.reduce((a, b) => a + b, 0) / intervalWatts.length;

  // Calculate average HR (only from intervals that have HR data)
  const intervalsWithHr = intervals.filter((i) => i.avgHeartRate && i.avgHeartRate > 0);
  const avgHr =
    intervalsWithHr.length > 0
      ? intervalsWithHr.reduce((sum, i) => sum + (i.avgHeartRate || 0), 0) / intervalsWithHr.length
      : null;

  // Calculate average stroke rate
  const intervalsWithSr = intervals.filter((i) => i.strokeRate && i.strokeRate > 0);
  const avgStrokeRate =
    intervalsWithSr.length > 0
      ? intervalsWithSr.reduce((sum, i) => sum + (i.strokeRate || 0), 0) / intervalsWithSr.length
      : null;

  // Calculate split times for pacing analysis
  const splits = intervals.map((i) => getSplitSeconds(i.distanceMetres, i.timeSeconds));
  const avgSplit = splits.reduce((a, b) => a + b, 0) / splits.length;

  // ===== 1. CARDIAC LOAD (0-40 points) =====
  let cardiacScore = 0;
  if (avgHr && user.maxHr) {
    // Use HR Reserve method (Karvonen) for accuracy
    const hrReserve = user.maxHr - restingHr;
    const avgIntensity = hrReserve > 0 ? (avgHr - restingHr) / hrReserve : 0;

    // Non-linear: working at 90% HRR is disproportionately harder than 70%
    cardiacScore = Math.pow(Math.max(0, avgIntensity), 1.5) * 40;

    // Age adjustment: older athletes get credit for same HR effort
    const ageFactor = 1 + (user.age - 30) * 0.005; // +0.5% per year over 30
    cardiacScore *= Math.min(ageFactor, 1.3); // cap at 30% bonus
  } else if (!avgHr && avgWatts > 0) {
    // NO HR DATA: Estimate cardiac load from power output
    // This is a conservative estimate - caps at ~28/40 instead of 40/40
    const bodyWeightFactorForCardiac = Math.pow(user.weightKg / 75, 0.222);
    const thresholdWatts = 220 * bodyWeightFactorForCardiac; // Expected threshold power

    const powerIntensity = Math.min(avgWatts / thresholdWatts, 1.3);
    const durationFactorForCardiac = Math.min(Math.log10(totalTimeMins + 1) * 0.6, 0.85);

    // Conservative estimate - caps at ~28/40 since it's power-based not HR-based
    cardiacScore = Math.pow(powerIntensity, 1.2) * durationFactorForCardiac * 28;

    // Age adjustment still applies
    const ageFactor = 1 + (user.age - 30) * 0.005;
    cardiacScore *= Math.min(ageFactor, 1.3);
  }
  cardiacScore = Math.min(40, Math.max(0, cardiacScore));

  // ===== 2. WORK OUTPUT (0-35 points) =====
  // Size-adjusted power expectation using Concept2 weight adjustment formula basis
  const bodyWeightFactor = Math.pow(user.weightKg / 75, 0.222); // diminishing returns on size
  const expectedWatts = 150 * bodyWeightFactor; // baseline expectation

  const relativePower = expectedWatts > 0 ? avgWatts / expectedWatts : 0;
  const durationFactor = Math.log10(totalTimeMins + 1); // diminishing returns on duration

  let workScore = relativePower * durationFactor * 15;
  workScore = Math.min(35, Math.max(0, workScore));

  // ===== 3. PACING FACTOR (0-15 points, can go slightly negative for bad pacing) =====
  let pacingScore = 10; // default for single piece
  if (splits.length > 1) {
    // Calculate coefficient of variation
    const meanSplit = splits.reduce((a, b) => a + b, 0) / splits.length;
    const variance = splits.reduce((sum, s) => sum + Math.pow(s - meanSplit, 2), 0) / splits.length;
    const cv = meanSplit > 0 ? Math.sqrt(variance) / meanSplit : 0;

    // Check for negative splits (getting faster = good)
    const halfIndex = Math.floor(splits.length / 2);
    const firstHalf = splits.slice(0, halfIndex);
    const secondHalf = splits.slice(halfIndex);
    const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const negativeSplit = secondHalfAvg < firstHalfAvg;

    // Base pacing score - penalise high variance
    const consistency = Math.max(0, 1 - cv * 10);
    pacingScore = consistency * 12;

    // Bonus for negative splits
    if (negativeSplit) {
      pacingScore += 3;
    }
  }
  pacingScore = Math.min(15, Math.max(0, pacingScore));

  // ===== 4. ECONOMY FACTOR (0-10 points) =====
  let economyScore = 5; // default if no stroke rate
  if (avgStrokeRate && avgWatts) {
    // Watts per stroke = efficiency
    const wattsPerStroke = avgWatts / avgStrokeRate;

    // Higher watts per stroke = more efficient = less total body strain
    // But high stroke rate = more cardiovascular demand
    // Balance: reward efficiency but acknowledge high-rate work
    if (wattsPerStroke > 8) {
      // Very efficient
      economyScore = 6;
    } else if (wattsPerStroke > 6) {
      // Good
      economyScore = 8;
    } else {
      // Grinding at high rate
      economyScore = 10;
    }
  }

  // ===== TOTAL EFFORT SCORE =====
  let totalEp = cardiacScore + workScore + pacingScore + economyScore;
  totalEp = Math.max(0, Math.min(100, totalEp)); // clamp 0-100

  const { zone, zoneColor } = getZoneInfo(totalEp);

  return {
    effortPoints: Math.round(totalEp * 10) / 10,
    zone,
    zoneColor,
    breakdown: {
      cardiacLoad: Math.round(cardiacScore * 10) / 10,
      workOutput: Math.round(workScore * 10) / 10,
      pacing: Math.round(pacingScore * 10) / 10,
      economy: Math.round(economyScore * 10) / 10,
    },
    sessionStats: {
      totalDistanceM: totalDistance,
      totalTimeMins: Math.round(totalTimeMins * 10) / 10,
      avgWatts: Math.round(avgWatts * 10) / 10,
      avgSplit: formatSplit(avgSplit),
    },
  };
}

// ============ LEGACY FUNCTION (for backward compatibility) ============

/**
 * Legacy effort score calculation (0-10 scale)
 * Maintained for backward compatibility with existing workouts
 */
export function calculateEffortScore(input: EffortScoreInput): number {
  const {
    avgHeartRate,
    maxHeartRate,
    userMaxHr,
    totalTimeSeconds,
    workoutType,
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
  const durationMinutes = durationSeconds / 60;

  const baseScores: Record<string, number> = {
    two_thousand: 8.5,
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

// ============ HR ZONE CALCULATION ============

export interface HrZoneTimes {
  zone1: number; // Recovery (<60% max)
  zone2: number; // Easy Aerobic (60-70%)
  zone3: number; // Aerobic (70-80%)
  zone4: number; // Threshold (80-90%)
  zone5: number; // Max (90%+)
}

export function calculateHrZones(hrData: number[], maxHr: number): HrZoneTimes {
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
