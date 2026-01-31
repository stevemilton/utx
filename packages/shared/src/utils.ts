import { HR_ZONES, HrZone, HrDataPoint } from './types';

/**
 * Format seconds as time string (e.g., "7:23.4" or "42:15.6")
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const secsStr = secs.toFixed(1).padStart(4, '0');
  return `${mins}:${secsStr}`;
}

/**
 * Format split time (per 500m pace)
 */
export function formatSplit(seconds: number): string {
  return `${formatTime(seconds)} /500m`;
}

/**
 * Format distance with commas
 */
export function formatDistance(metres: number): string {
  return `${metres.toLocaleString()}m`;
}

/**
 * Calculate estimated max HR from age (220 - age formula)
 */
export function estimateMaxHr(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return 220 - age;
}

/**
 * Get HR zone for a given heart rate
 */
export function getHrZone(heartRate: number, maxHr: number): HrZone {
  const percent = (heartRate / maxHr) * 100;
  for (const zone of HR_ZONES) {
    if (percent >= zone.minPercent && percent < zone.maxPercent) {
      return zone;
    }
  }
  return HR_ZONES[4]; // Zone 5 for anything >= 90%
}

/**
 * Calculate time spent in each HR zone
 */
export function calculateZoneBreakdown(
  hrData: HrDataPoint[],
  maxHr: number
): Map<number, number> {
  const zoneTime = new Map<number, number>();
  HR_ZONES.forEach((z) => zoneTime.set(z.zone, 0));

  for (let i = 1; i < hrData.length; i++) {
    const duration = hrData[i].timeSeconds - hrData[i - 1].timeSeconds;
    const zone = getHrZone(hrData[i].heartRate, maxHr);
    zoneTime.set(zone.zone, (zoneTime.get(zone.zone) || 0) + duration);
  }

  return zoneTime;
}

/**
 * Calculate UTx Effort Score (0-10)
 * Based on: time in zones 4-5, total duration, workout type, avg HR as % of max
 */
export function calculateEffortScore(
  totalTimeSeconds: number,
  hrData: HrDataPoint[] | undefined,
  maxHr: number,
  avgHr: number | undefined
): number {
  if (!hrData || hrData.length === 0 || !avgHr) {
    // Without HR data, estimate from duration (very rough)
    const durationScore = Math.min(totalTimeSeconds / 3600, 1) * 3; // up to 3 points for duration
    return Math.round(durationScore * 10) / 10;
  }

  const zoneBreakdown = calculateZoneBreakdown(hrData, maxHr);
  const totalTime = hrData[hrData.length - 1].timeSeconds - hrData[0].timeSeconds;

  // Time in high zones (4-5) - up to 4 points
  const highZoneTime = (zoneBreakdown.get(4) || 0) + (zoneBreakdown.get(5) || 0);
  const highZonePercent = totalTime > 0 ? highZoneTime / totalTime : 0;
  const highZoneScore = highZonePercent * 4;

  // Duration factor - up to 2 points (60 mins = max)
  const durationScore = Math.min(totalTimeSeconds / 3600, 1) * 2;

  // Average HR as % of max - up to 3 points
  const avgHrPercent = avgHr / maxHr;
  const avgHrScore = Math.min(avgHrPercent, 1) * 3;

  // Zone 5 bonus - up to 1 point
  const zone5Time = zoneBreakdown.get(5) || 0;
  const zone5Percent = totalTime > 0 ? zone5Time / totalTime : 0;
  const zone5Score = zone5Percent * 1;

  const total = highZoneScore + durationScore + avgHrScore + zone5Score;
  return Math.round(Math.min(total, 10) * 10) / 10;
}

/**
 * Determine workout type from distance or time
 */
export function inferWorkoutType(
  distanceMetres: number,
  timeSeconds: number,
  hasIntervals: boolean
): string {
  if (hasIntervals) return 'intervals';

  // Check for standard test distances (with 5% tolerance)
  const standardDistances: [number, string][] = [
    [500, '500m'],
    [1000, '1000m'],
    [2000, '2000m'],
    [5000, '5000m'],
    [6000, '6000m'],
    [10000, '10000m'],
    [21097, 'half_marathon'],
    [42195, 'marathon'],
  ];

  for (const [distance, type] of standardDistances) {
    if (Math.abs(distanceMetres - distance) / distance < 0.05) {
      return type;
    }
  }

  // Check for 1-minute test (around 60 seconds)
  if (Math.abs(timeSeconds - 60) < 5) {
    return '1_minute';
  }

  // Default to steady state for longer pieces
  if (timeSeconds > 1200) {
    // > 20 minutes
    return 'steady_state';
  }

  return 'custom';
}

/**
 * Convert height from feet/inches to cm
 */
export function feetInchesToCm(feet: number, inches: number): number {
  return Math.round((feet * 12 + inches) * 2.54);
}

/**
 * Convert cm to feet/inches
 */
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { feet, inches };
}

/**
 * Convert lbs to kg
 */
export function lbsToKg(lbs: number): number {
  return Math.round(lbs * 0.453592 * 10) / 10;
}

/**
 * Convert kg to lbs
 */
export function kgToLbs(kg: number): number {
  return Math.round(kg * 2.20462 * 10) / 10;
}

/**
 * Generate a random invite code
 */
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Get age from birth date
 */
export function getAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/**
 * Check if user is a lightweight (based on gender)
 * Men: <75kg, Women: <61.5kg
 */
export function isLightweight(
  weightKg: number,
  gender: 'male' | 'female' | 'prefer_not_to_say'
): boolean {
  if (gender === 'male') return weightKg < 75;
  if (gender === 'female') return weightKg < 61.5;
  return false; // Can't determine for 'prefer not to say'
}
