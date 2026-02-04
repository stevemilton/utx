import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  Share,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, G, Text as SvgText, Path, Rect } from 'react-native-svg';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '../constants/theme';
import { api } from '../services/api';
import type { RootStackScreenProps } from '../navigation/types';
import { useWorkoutStore, type Workout } from '../stores/workoutStore';
import { useAuthStore } from '../stores/authStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Types for comparison data
interface ComparisonData {
  lastSimilar: {
    id: string;
    date: string;
    totalTimeSeconds: number;
    averageSplitSeconds: number;
    avgHeartRate?: number;
    effortScore?: number;
  } | null;
  personalBest: {
    timeSeconds: number;
    achievedAt: string;
  } | null;
}

interface HrZoneBreakdown {
  zone1Seconds: number;
  zone2Seconds: number;
  zone3Seconds: number;
  zone4Seconds: number;
  zone5Seconds: number;
}

// Format time helper
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
};

// Format split time
const formatSplit = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
};

// Format date
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

// Get workout type display name
const getWorkoutTypeName = (type: string): string => {
  const typeNames: Record<string, string> = {
    'five_hundred': '500m',
    '500m': '500m',
    'one_thousand': '1K',
    '1000m': '1K',
    'two_thousand': '2K Test',
    '2000m': '2K Test',
    'five_thousand': '5K',
    '5000m': '5K',
    'six_thousand': '6K',
    '6000m': '6K',
    'ten_thousand': '10K',
    '10000m': '10K',
    half_marathon: 'Half Marathon',
    marathon: 'Marathon',
    one_minute: '1 Minute',
    steady_state: 'Steady State',
    intervals: 'Intervals',
    custom: 'Workout',
    distance: 'Distance',
    time: 'Time',
  };
  return typeNames[type] || type.replace(/_/g, ' ');
};

// ============ UTx EFFORT SCORE (0-100 EP) ============

interface EffortBreakdown {
  cardiacLoad: number; // 0-40
  workOutput: number; // 0-35
  pacing: number; // 0-15
  economy: number; // 0-10
}

interface EffortResult {
  effortPoints: number; // 0-100
  zone: 'recovery' | 'building' | 'training' | 'peak';
  zoneColor: string;
  zoneLabel: string;
  description: string;
  breakdown: EffortBreakdown;
}

interface UserProfileForEffort {
  age: number;
  weightKg: number;
  heightCm: number;
  maxHr: number;
  restingHr?: number;
}

/**
 * Calculate watts from distance and time using Concept2 formula
 * watts = 2.80 / pace^3 where pace is in seconds per meter
 */
const calculateWatts = (distanceMetres: number, timeSeconds: number): number => {
  if (distanceMetres <= 0 || timeSeconds <= 0) return 0;
  const paceMetersPerSecond = distanceMetres / timeSeconds;
  return 2.80 * Math.pow(paceMetersPerSecond, 3);
};

/**
 * Get 500m split time in seconds from distance and time
 */
const getSplitSeconds = (distanceMetres: number, timeSeconds: number): number => {
  if (distanceMetres <= 0) return 0;
  return (timeSeconds / distanceMetres) * 500;
};

/**
 * Calculate UTx Effort Score (0-100 EP)
 *
 * Components:
 * 1. Cardiac Load (40% weight) - HR-based strain using Karvonen method
 * 2. Work Output (35% weight) - Power × duration, size-adjusted
 * 3. Pacing Factor (15% weight) - Consistency bonus/penalty
 * 4. Economy Factor (10% weight) - Stroke rate efficiency
 */
const calculateUtxEffortScore = (
  user: UserProfileForEffort,
  workout: Workout
): EffortResult => {
  const restingHr = user.restingHr || 50;
  const totalDistance = workout.totalDistanceMetres || 0;
  const totalTime = workout.totalTimeSeconds || 0;
  const totalTimeMins = totalTime / 60;
  const avgHr = workout.avgHeartRate;
  const avgStrokeRate = workout.averageRate;

  // Calculate watts
  const avgWatts = calculateWatts(totalDistance, totalTime);

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

  // ===== 3. PACING FACTOR (0-15 points) =====
  let pacingScore = 10; // default for single piece
  if (workout.intervals && workout.intervals.length > 1) {
    const splits = workout.intervals.map((i) => i.paceSeconds);
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

  const zoneInfo = getEffortZone(totalEp);

  return {
    effortPoints: Math.round(totalEp * 10) / 10,
    ...zoneInfo,
    breakdown: {
      cardiacLoad: Math.round(cardiacScore * 10) / 10,
      workOutput: Math.round(workScore * 10) / 10,
      pacing: Math.round(pacingScore * 10) / 10,
      economy: Math.round(economyScore * 10) / 10,
    },
  };
};

// Get effort zone info (0-100 scale)
const getEffortZone = (ep: number): { zone: EffortResult['zone']; zoneColor: string; zoneLabel: string; description: string } => {
  if (ep <= 25) return { zone: 'recovery', zoneColor: '#4ADE80', zoneLabel: 'Recovery', description: 'Active recovery zone' };
  if (ep <= 50) return { zone: 'building', zoneColor: '#3B82F6', zoneLabel: 'Building', description: 'Aerobic base building' };
  if (ep <= 75) return { zone: 'training', zoneColor: '#FBBF24', zoneLabel: 'Training', description: 'Fitness gains zone' };
  return { zone: 'peak', zoneColor: '#EF4444', zoneLabel: 'Peak', description: 'Maximum effort' };
};

// ============ HEART RATE ANALYSIS (HRA) ============

type EfficiencyRating = 'elite' | 'excellent' | 'good' | 'developing' | 'building';
type DriftRating = 'excellent' | 'good' | 'moderate' | 'high' | 'pacing_issue';
type TrendPattern = 'stable' | 'accelerating' | 'plateaued' | 'steady_climb';

interface HraZone {
  name: string;
  minPct: number;
  maxPct: number;
  minHr: number;
  maxHr: number;
  color: string;
  trainingEffect: string;
}

interface HraIntensity {
  percentMax: number;
  percentHrr: number;
  bpm: number;
  maxHr: number;
}

interface HraZoneInfo {
  zone: number;
  name: string;
  color: string;
  trainingEffect: string;
}

interface HraEfficiency {
  wattsPerBeat: number;
  rating: EfficiencyRating;
  insight: string;
}

interface HraDrift {
  percent: number;
  powerDropPercent: number;
  rating: DriftRating;
  insight: string;
}

interface HraTrend {
  pattern: TrendPattern;
  startHr: number;
  endHr: number;
  rise: number;
  insight: string;
}

interface HraZoneDistribution {
  [key: string]: {
    name: string;
    color: string;
    seconds: number;
    percent: number;
  };
}

interface HraResult {
  available: boolean;
  reason?: string;
  hasDetailedData?: boolean;
  intensity?: HraIntensity;
  zone?: HraZoneInfo;
  efficiency?: HraEfficiency;
  drift?: HraDrift;
  trend?: HraTrend;
  zoneDistribution?: HraZoneDistribution;
}

/**
 * Calculate personalised HR zones using Karvonen (HR Reserve) method.
 * More accurate than simple %max HR.
 */
const calculateHrZones = (maxHr: number, restingHr: number): Record<string, HraZone> => {
  const hrReserve = maxHr - restingHr;

  return {
    z1: {
      name: 'Recovery',
      minPct: 0.50,
      maxPct: 0.60,
      minHr: Math.round(restingHr + hrReserve * 0.50),
      maxHr: Math.round(restingHr + hrReserve * 0.60),
      color: '#94A3B8',
      trainingEffect: 'Active recovery, minimal stress',
    },
    z2: {
      name: 'Aerobic',
      minPct: 0.60,
      maxPct: 0.70,
      minHr: Math.round(restingHr + hrReserve * 0.60),
      maxHr: Math.round(restingHr + hrReserve * 0.70),
      color: '#4ADE80',
      trainingEffect: 'Aerobic base, fat metabolism',
    },
    z3: {
      name: 'Tempo',
      minPct: 0.70,
      maxPct: 0.80,
      minHr: Math.round(restingHr + hrReserve * 0.70),
      maxHr: Math.round(restingHr + hrReserve * 0.80),
      color: '#3B82F6',
      trainingEffect: 'Lactate threshold, sustainable pace',
    },
    z4: {
      name: 'Threshold',
      minPct: 0.80,
      maxPct: 0.90,
      minHr: Math.round(restingHr + hrReserve * 0.80),
      maxHr: Math.round(restingHr + hrReserve * 0.90),
      color: '#FBBF24',
      trainingEffect: 'VO2 max, race fitness',
    },
    z5: {
      name: 'Max',
      minPct: 0.90,
      maxPct: 1.00,
      minHr: Math.round(restingHr + hrReserve * 0.90),
      maxHr: maxHr,
      color: '#EF4444',
      trainingEffect: 'Anaerobic power, speed',
    },
  };
};

/**
 * Get zone info for a given HR
 */
const getZoneForHr = (hr: number, maxHr: number, restingHr: number): { key: string } & HraZone => {
  const zones = calculateHrZones(maxHr, restingHr);
  for (const [key, zone] of Object.entries(zones)) {
    if (hr >= zone.minHr && hr <= zone.maxHr) {
      return { key, ...zone };
    }
  }
  // Edge cases
  if (hr > zones.z5.maxHr) {
    return { key: 'z5', ...zones.z5 };
  }
  return { key: 'z1', ...zones.z1 };
};

/**
 * Calculate aerobic efficiency = watts produced per heartbeat above resting.
 * Higher = more efficient cardiovascular system.
 */
const calculateEfficiency = (avgWatts: number, avgHr: number, restingHr: number): HraEfficiency => {
  if (avgHr <= restingHr) {
    return { wattsPerBeat: 0, rating: 'building', insight: '' };
  }

  const wattsPerBeat = avgWatts / (avgHr - restingHr);

  // Benchmarks (approximate, varies by age/fitness):
  // Elite: > 3.0
  // Excellent: 2.5 - 3.0
  // Good: 2.0 - 2.5
  // Developing: 1.5 - 2.0
  // Building: < 1.5

  let rating: EfficiencyRating;
  let insight: string;

  if (wattsPerBeat >= 3.0) {
    rating = 'elite';
    insight = 'Exceptional aerobic efficiency';
  } else if (wattsPerBeat >= 2.5) {
    rating = 'excellent';
    insight = 'Strong aerobic system';
  } else if (wattsPerBeat >= 2.0) {
    rating = 'good';
    insight = 'Solid fitness foundation';
  } else if (wattsPerBeat >= 1.5) {
    rating = 'developing';
    insight = 'Aerobic base improving';
  } else {
    rating = 'building';
    insight = 'Keep building your base';
  }

  return {
    wattsPerBeat: Math.round(wattsPerBeat * 100) / 100,
    rating,
    insight,
  };
};

/**
 * Calculate cardiac drift = HR rising at same power output (fatigue).
 * Also detects pacing issues (power dropping while HR rises).
 */
const calculateDrift = (intervals: { avgHeartRate?: number; watts: number; timeSeconds: number }[]): HraDrift | null => {
  // Need at least 4 intervals with HR data
  const hrIntervals = intervals.filter((i) => i.avgHeartRate != null);
  if (hrIntervals.length < 4) {
    return null;
  }

  const mid = Math.floor(hrIntervals.length / 2);
  const firstHalf = hrIntervals.slice(0, mid);
  const secondHalf = hrIntervals.slice(mid);

  // Calculate HR per watt ratio for each half
  const firstHrPerWatt = firstHalf.reduce((sum, i) => sum + (i.avgHeartRate! / i.watts), 0) / firstHalf.length;
  const secondHrPerWatt = secondHalf.reduce((sum, i) => sum + (i.avgHeartRate! / i.watts), 0) / secondHalf.length;

  const driftPercent = ((secondHrPerWatt - firstHrPerWatt) / firstHrPerWatt) * 100;

  // Check for power drop (pacing issue indicator)
  const firstAvgWatts = firstHalf.reduce((sum, i) => sum + i.watts, 0) / firstHalf.length;
  const secondAvgWatts = secondHalf.reduce((sum, i) => sum + i.watts, 0) / secondHalf.length;
  const powerDropPercent = ((firstAvgWatts - secondAvgWatts) / firstAvgWatts) * 100;

  // Determine rating
  const isPacingIssue = powerDropPercent > 10 && driftPercent > 10;

  let rating: DriftRating;
  let insight: string;

  if (driftPercent < 3) {
    rating = 'excellent';
    insight = 'Minimal drift - excellent aerobic fitness';
  } else if (driftPercent < 6) {
    rating = 'good';
    insight = 'Normal drift - well paced';
  } else if (driftPercent < 10) {
    rating = 'moderate';
    insight = 'Some fatigue accumulation';
  } else if (isPacingIssue) {
    rating = 'pacing_issue';
    insight = `Went out too hard - power dropped ${powerDropPercent.toFixed(0)}% while HR climbed`;
  } else {
    rating = 'high';
    insight = 'High drift - review pacing, hydration, or fatigue';
  }

  return {
    percent: Math.round(driftPercent * 10) / 10,
    powerDropPercent: Math.round(powerDropPercent * 10) / 10,
    rating,
    insight,
  };
};

/**
 * Analyse how HR changed through the session.
 */
const analyseHrTrend = (intervals: { avgHeartRate?: number }[]): HraTrend | null => {
  const hrValues = intervals.filter((i) => i.avgHeartRate != null).map((i) => i.avgHeartRate!);
  if (hrValues.length < 3) {
    return null;
  }

  const earlyRise = hrValues[1] - hrValues[0];
  const lateRise = hrValues[hrValues.length - 1] - hrValues[hrValues.length - 2];
  const totalRise = hrValues[hrValues.length - 1] - hrValues[0];

  let pattern: TrendPattern;
  let insight: string;

  if (totalRise <= 0) {
    pattern = 'stable';
    insight = 'HR stayed flat - possible low intensity or excellent fitness';
  } else if (lateRise > earlyRise * 1.5 && lateRise > 5) {
    pattern = 'accelerating';
    insight = 'HR still climbing at end - longer warmup may help';
  } else if (Math.abs(lateRise) < 3 && earlyRise > 5) {
    pattern = 'plateaued';
    insight = 'HR stabilised - good pacing';
  } else {
    pattern = 'steady_climb';
    insight = 'Gradual HR rise through session';
  }

  return {
    pattern,
    startHr: hrValues[0],
    endHr: hrValues[hrValues.length - 1],
    rise: totalRise,
    insight,
  };
};

/**
 * Main HR Analysis function.
 * Provides qualitative HR insights when HRM data is available.
 */
const analyseHR = (
  user: UserProfileForEffort,
  workout: Workout
): HraResult => {
  const avgHr = workout.avgHeartRate;
  const restingHr = user.restingHr || 50;
  const maxHr = user.maxHr;

  // Check if HR data exists
  if (!avgHr) {
    return {
      available: false,
      reason: 'No heart rate data recorded',
    };
  }

  const hrReserve = maxHr - restingHr;

  // Calculate watts from workout
  const avgWatts = calculateWatts(workout.totalDistanceMetres || 0, workout.totalTimeSeconds || 0);

  // ===== INTENSITY (always available) =====
  const intensityPct = (avgHr / maxHr) * 100;
  const intensityHrr = ((avgHr - restingHr) / hrReserve) * 100; // HR reserve method

  // ===== ZONE (always available) =====
  const zone = getZoneForHr(avgHr, maxHr, restingHr);

  // ===== EFFICIENCY (always available if we have watts) =====
  const efficiency = calculateEfficiency(avgWatts, avgHr, restingHr);

  // ===== DETAILED ANALYSIS (only with interval data) =====
  let drift: HraDrift | null = null;
  let hrTrend: HraTrend | null = null;
  let zoneDistribution: HraZoneDistribution | null = null;
  let hasDetailedData = false;

  if (workout.intervals && workout.intervals.length >= 2) {
    const hrIntervals = workout.intervals.filter((i) => i.avgHeartRate != null);

    if (hrIntervals.length >= 2) {
      hasDetailedData = true;

      // Prepare intervals with watts for drift calculation
      const intervalsWithWatts = workout.intervals.map((i) => ({
        avgHeartRate: i.avgHeartRate,
        watts: calculateWatts(i.distanceMetres, i.timeSeconds),
        timeSeconds: i.timeSeconds,
      }));

      // Drift analysis
      drift = calculateDrift(intervalsWithWatts);

      // HR trend
      hrTrend = analyseHrTrend(workout.intervals);

      // Zone distribution
      const zones = calculateHrZones(maxHr, restingHr);
      const zoneTime: Record<string, number> = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };
      const totalTime = hrIntervals.reduce((sum, i) => sum + i.timeSeconds, 0);

      for (const interval of hrIntervals) {
        const z = getZoneForHr(interval.avgHeartRate!, maxHr, restingHr);
        zoneTime[z.key] += interval.timeSeconds;
      }

      zoneDistribution = {};
      for (const [key, zone] of Object.entries(zones)) {
        if (zoneTime[key] > 0) {
          zoneDistribution[key] = {
            name: zone.name,
            color: zone.color,
            seconds: Math.round(zoneTime[key] * 10) / 10,
            percent: totalTime > 0 ? Math.round((zoneTime[key] / totalTime) * 1000) / 10 : 0,
          };
        }
      }
    }
  }

  // ===== BUILD RESPONSE =====
  const result: HraResult = {
    available: true,
    hasDetailedData,
    intensity: {
      percentMax: Math.round(intensityPct * 10) / 10,
      percentHrr: Math.round(intensityHrr * 10) / 10,
      bpm: avgHr,
      maxHr,
    },
    zone: {
      zone: parseInt(zone.key.replace('z', ''), 10),
      name: zone.name,
      color: zone.color,
      trainingEffect: zone.trainingEffect,
    },
    efficiency,
  };

  // Add detailed data if available
  if (hasDetailedData) {
    if (drift) {
      result.drift = drift;
    }
    if (hrTrend) {
      result.trend = hrTrend;
    }
    if (zoneDistribution && Object.keys(zoneDistribution).length > 0) {
      result.zoneDistribution = zoneDistribution;
    }
  }

  return result;
};

// Get HR zone info
const getHrZoneInfo = (zone: number): { name: string; color: string; range: string } => {
  const zones: Record<number, { name: string; color: string; range: string }> = {
    1: { name: 'Recovery', color: '#94A3B8', range: '50-60%' },
    2: { name: 'Easy', color: '#4ADE80', range: '60-70%' },
    3: { name: 'Aerobic', color: '#FBBF24', range: '70-80%' },
    4: { name: 'Threshold', color: '#F97316', range: '80-90%' },
    5: { name: 'Max', color: '#EF4444', range: '90-100%' },
  };
  return zones[zone] || zones[1];
};

// Effort Ring Component (0-100 EP scale)
const EffortRing: React.FC<{ effortResult: EffortResult; size?: number }> = ({ effortResult, size = 180 }) => {
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (effortResult.effortPoints / 100) * circumference;
  const center = size / 2;

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        {/* Background circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress arc */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={effortResult.zoneColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${progress} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
        {/* Center text - properly centered */}
        <SvgText
          x={center}
          y={center - 5}
          textAnchor="middle"
          alignmentBaseline="middle"
          fontSize={42}
          fontWeight="bold"
          fill={colors.textPrimary}
        >
          {effortResult.effortPoints.toFixed(1)}
        </SvgText>
        <SvgText
          x={center}
          y={center + 28}
          textAnchor="middle"
          alignmentBaseline="middle"
          fontSize={14}
          fill={colors.textTertiary}
        >
          EFFORT
        </SvgText>
      </Svg>
      <View style={[styles.strainZoneBadge, { backgroundColor: effortResult.zoneColor }]}>
        <Text style={styles.strainZoneText}>{effortResult.zoneLabel}</Text>
      </View>
      <Text style={styles.strainDescription}>{effortResult.description}</Text>
    </View>
  );
};

// Effort Breakdown Bar Component
const EffortBreakdownBar: React.FC<{ breakdown: EffortBreakdown }> = ({ breakdown }) => {
  const components = [
    { label: 'Cardiac Load', value: breakdown.cardiacLoad, max: 40, color: '#EF4444' },
    { label: 'Work Output', value: breakdown.workOutput, max: 35, color: '#3B82F6' },
    { label: 'Pacing', value: breakdown.pacing, max: 15, color: '#10B981' },
    { label: 'Economy', value: breakdown.economy, max: 10, color: '#F59E0B' },
  ];

  return (
    <View style={styles.breakdownContainer}>
      {components.map((comp) => {
        const percent = (comp.value / comp.max) * 100;
        return (
          <View key={comp.label} style={styles.breakdownRow}>
            <View style={styles.breakdownLabelContainer}>
              <View style={[styles.breakdownDot, { backgroundColor: comp.color }]} />
              <Text style={styles.breakdownLabel}>{comp.label}</Text>
            </View>
            <View style={styles.breakdownBarContainer}>
              <View
                style={[
                  styles.breakdownBarFill,
                  { width: `${Math.max(percent, 2)}%`, backgroundColor: comp.color },
                ]}
              />
            </View>
            <Text style={styles.breakdownValue}>
              {comp.value.toFixed(1)}/{comp.max}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

// HR Zone Bar Component
const HrZoneBar: React.FC<{ zones: HrZoneBreakdown; totalTime: number }> = ({ zones, totalTime }) => {
  const zoneData = [
    { zone: 5, seconds: zones.zone5Seconds, ...getHrZoneInfo(5) },
    { zone: 4, seconds: zones.zone4Seconds, ...getHrZoneInfo(4) },
    { zone: 3, seconds: zones.zone3Seconds, ...getHrZoneInfo(3) },
    { zone: 2, seconds: zones.zone2Seconds, ...getHrZoneInfo(2) },
    { zone: 1, seconds: zones.zone1Seconds, ...getHrZoneInfo(1) },
  ];

  return (
    <View style={styles.hrZoneContainer}>
      {zoneData.map((z) => {
        const percent = totalTime > 0 ? (z.seconds / totalTime) * 100 : 0;
        const minutes = Math.floor(z.seconds / 60);
        const secs = z.seconds % 60;

        return (
          <View key={z.zone} style={styles.hrZoneRow}>
            <View style={styles.hrZoneLabelContainer}>
              <View style={[styles.hrZoneDot, { backgroundColor: z.color }]} />
              <Text style={styles.hrZoneName}>{z.name}</Text>
            </View>
            <View style={styles.hrZoneBarContainer}>
              <View
                style={[
                  styles.hrZoneBarFill,
                  { width: `${Math.max(percent, 2)}%`, backgroundColor: z.color },
                ]}
              />
            </View>
            <Text style={styles.hrZoneTime}>
              {minutes > 0 ? `${minutes}m ${Math.round(secs)}s` : `${Math.round(secs)}s`}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

// HRA Card Component - Heart Rate Analysis
const HRACard: React.FC<{ hraResult: HraResult }> = ({ hraResult }) => {
  if (!hraResult.available) {
    return null;
  }

  const getEfficiencyColor = (rating: EfficiencyRating): string => {
    const colorMap: Record<EfficiencyRating, string> = {
      elite: '#10B981',
      excellent: '#22C55E',
      good: '#3B82F6',
      developing: '#FBBF24',
      building: '#94A3B8',
    };
    return colorMap[rating];
  };

  const getDriftColor = (rating: DriftRating): string => {
    const colorMap: Record<DriftRating, string> = {
      excellent: '#10B981',
      good: '#22C55E',
      moderate: '#FBBF24',
      high: '#F97316',
      pacing_issue: '#EF4444',
    };
    return colorMap[rating];
  };

  const formatRating = (rating: string): string => {
    return rating.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <View style={styles.hraCard}>
      {/* Intensity Section */}
      <View style={styles.hraSection}>
        <View style={styles.hraSectionHeader}>
          <Ionicons name="heart" size={18} color={hraResult.zone?.color || '#EF4444'} />
          <Text style={styles.hraSectionTitle}>Intensity</Text>
        </View>
        <View style={styles.hraIntensityRow}>
          <View style={styles.hraIntensityItem}>
            <Text style={styles.hraIntensityValue}>{hraResult.intensity?.bpm}</Text>
            <Text style={styles.hraIntensityLabel}>Avg BPM</Text>
          </View>
          <View style={styles.hraIntensityItem}>
            <Text style={styles.hraIntensityValue}>{hraResult.intensity?.percentMax.toFixed(0)}%</Text>
            <Text style={styles.hraIntensityLabel}>of Max</Text>
          </View>
          <View style={styles.hraIntensityItem}>
            <Text style={styles.hraIntensityValue}>{hraResult.intensity?.percentHrr.toFixed(0)}%</Text>
            <Text style={styles.hraIntensityLabel}>HR Reserve</Text>
          </View>
        </View>
      </View>

      {/* Zone & Efficiency Row */}
      <View style={styles.hraDoubleSection}>
        {/* Zone Section */}
        <View style={styles.hraHalfSection}>
          <View style={styles.hraSectionHeader}>
            <Ionicons name="speedometer" size={16} color={hraResult.zone?.color || '#3B82F6'} />
            <Text style={styles.hraSectionTitle}>Zone</Text>
          </View>
          <Text style={[styles.hraMainValue, { color: hraResult.zone?.color }]}>
            {hraResult.zone?.zone}
          </Text>
          <View style={[styles.hraSmallBadge, { backgroundColor: hraResult.zone?.color }]}>
            <Text style={styles.hraSmallBadgeText}>{hraResult.zone?.name}</Text>
          </View>
          <Text style={styles.hraSubtext}>{hraResult.zone?.trainingEffect}</Text>
        </View>

        {/* Efficiency Section */}
        <View style={styles.hraHalfSection}>
          <View style={styles.hraSectionHeader}>
            <Ionicons name="flash" size={16} color={getEfficiencyColor(hraResult.efficiency?.rating || 'building')} />
            <Text style={styles.hraSectionTitle}>Efficiency</Text>
          </View>
          <Text style={[styles.hraMainValue, { color: getEfficiencyColor(hraResult.efficiency?.rating || 'building') }]}>
            {hraResult.efficiency?.wattsPerBeat.toFixed(2)}
          </Text>
          <View style={[styles.hraSmallBadge, { backgroundColor: getEfficiencyColor(hraResult.efficiency?.rating || 'building') }]}>
            <Text style={styles.hraSmallBadgeText}>{formatRating(hraResult.efficiency?.rating || 'building')}</Text>
          </View>
          <Text style={styles.hraSubtext}>W/beat</Text>
        </View>
      </View>

      {/* Drift Section (only with detailed data) */}
      {hraResult.drift && (
        <View style={styles.hraSection}>
          <View style={styles.hraSectionHeader}>
            <Ionicons name="trending-up" size={18} color={getDriftColor(hraResult.drift.rating)} />
            <Text style={styles.hraSectionTitle}>Cardiac Drift</Text>
          </View>
          <View style={styles.hraDriftRow}>
            <View style={styles.hraDriftItem}>
              <Text style={styles.hraDriftValue}>{hraResult.drift.percent.toFixed(1)}%</Text>
              <Text style={styles.hraDriftLabel}>Drift</Text>
            </View>
            <View style={styles.hraDriftMeta}>
              <View style={[styles.hraDriftBadge, { backgroundColor: getDriftColor(hraResult.drift.rating) }]}>
                <Text style={styles.hraDriftBadgeText}>{formatRating(hraResult.drift.rating)}</Text>
              </View>
              <Text style={styles.hraDriftInsight}>{hraResult.drift.insight}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Trend Section (only with detailed data) */}
      {hraResult.trend && (
        <View style={styles.hraSection}>
          <View style={styles.hraSectionHeader}>
            <Ionicons name="analytics" size={18} color="#3B82F6" />
            <Text style={styles.hraSectionTitle}>HR Trend</Text>
          </View>
          <View style={styles.hraTrendRow}>
            <Text style={styles.hraTrendValue}>
              {hraResult.trend.startHr} → {hraResult.trend.endHr} bpm
              <Text style={styles.hraTrendDelta}>
                {' '}({hraResult.trend.rise > 0 ? '+' : ''}{hraResult.trend.rise})
              </Text>
            </Text>
            <Text style={styles.hraTrendInsight}>{hraResult.trend.insight}</Text>
          </View>
        </View>
      )}

      {/* Zone Distribution (only with detailed data) */}
      {hraResult.zoneDistribution && Object.keys(hraResult.zoneDistribution).length > 0 && (
        <View style={styles.hraSection}>
          <View style={styles.hraSectionHeader}>
            <Ionicons name="pie-chart" size={18} color="#8B5CF6" />
            <Text style={styles.hraSectionTitle}>Zone Distribution</Text>
          </View>
          <View style={styles.hraZoneDistContainer}>
            {Object.entries(hraResult.zoneDistribution).map(([key, zone]) => {
              const mins = Math.floor(zone.seconds / 60);
              const secs = Math.round(zone.seconds % 60);
              return (
                <View key={key} style={styles.hraZoneDistRow}>
                  <View style={styles.hraZoneDistLabel}>
                    <View style={[styles.hraZoneDistDot, { backgroundColor: zone.color }]} />
                    <Text style={styles.hraZoneDistName}>{zone.name}</Text>
                  </View>
                  <View style={styles.hraZoneDistBarContainer}>
                    <View
                      style={[
                        styles.hraZoneDistBarFill,
                        { width: `${Math.max(zone.percent, 2)}%`, backgroundColor: zone.color },
                      ]}
                    />
                  </View>
                  <Text style={styles.hraZoneDistTime}>
                    {mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Limited Data Notice */}
      {!hraResult.hasDetailedData && (
        <View style={styles.hraNotice}>
          <Ionicons name="information-circle-outline" size={14} color={colors.textTertiary} />
          <Text style={styles.hraNoticeText}>
            Detailed analysis (drift, trend) requires per-interval HR data
          </Text>
        </View>
      )}
    </View>
  );
};

// Splits Visualization
const SplitsChart: React.FC<{ intervals: Workout['intervals'] }> = ({ intervals }) => {
  if (!intervals || intervals.length === 0) return null;

  const paces = intervals.map((i) => i.paceSeconds);
  const minPace = Math.min(...paces);
  const maxPace = Math.max(...paces);
  const avgPace = paces.reduce((a, b) => a + b, 0) / paces.length;
  const range = maxPace - minPace || 1;

  return (
    <View style={styles.splitsContainer}>
      {intervals.map((interval, index) => {
        const normalizedPace = (interval.paceSeconds - minPace) / range;
        const isFastest = interval.paceSeconds === minPace;
        const isSlowest = interval.paceSeconds === maxPace;
        // Darker = faster (lower pace)
        const opacity = 1 - normalizedPace * 0.6;

        return (
          <View key={index} style={styles.splitRow}>
            <Text style={styles.splitNumber}>{index + 1}</Text>
            <View style={styles.splitBarContainer}>
              <View
                style={[
                  styles.splitBarFill,
                  {
                    width: `${100 - normalizedPace * 40}%`,
                    backgroundColor: isFastest
                      ? colors.success
                      : isSlowest
                      ? colors.warning
                      : colors.primary,
                    opacity,
                  },
                ]}
              />
            </View>
            <View style={styles.splitPaceContainer}>
              <Text
                style={[
                  styles.splitPace,
                  isFastest && styles.fastestPace,
                  isSlowest && styles.slowestPace,
                ]}
              >
                {formatSplit(interval.paceSeconds)}
              </Text>
              {isFastest && (
                <View style={styles.fastestBadge}>
                  <Ionicons name="flash" size={10} color={colors.textInverse} />
                </View>
              )}
            </View>
          </View>
        );
      })}
      <View style={styles.splitAvgRow}>
        <Text style={styles.splitAvgLabel}>Average</Text>
        <Text style={styles.splitAvgValue}>{formatSplit(avgPace)}</Text>
      </View>
    </View>
  );
};

// Comparison Metric Row
const ComparisonRow: React.FC<{
  label: string;
  current: number | null;
  previous: number | null;
  format: 'time' | 'split' | 'number' | 'hr';
  lowerIsBetter?: boolean;
}> = ({ label, current, previous, format, lowerIsBetter = true }) => {
  if (current === null || previous === null) return null;

  const diff = current - previous;
  const isImproved = lowerIsBetter ? diff < 0 : diff > 0;
  const formatValue = (val: number) => {
    if (format === 'time' || format === 'split') return formatSplit(val);
    if (format === 'hr') return `${Math.round(val)} bpm`;
    return val.toFixed(1);
  };

  return (
    <View style={styles.comparisonRow}>
      <Text style={styles.comparisonLabel}>{label}</Text>
      <View style={styles.comparisonValues}>
        <Text style={styles.comparisonCurrent}>{formatValue(current)}</Text>
        <View style={[styles.comparisonDelta, isImproved ? styles.deltaPositive : styles.deltaNegative]}>
          <Ionicons
            name={isImproved ? 'arrow-down' : 'arrow-up'}
            size={12}
            color={isImproved ? colors.success : colors.error}
          />
          <Text style={[styles.comparisonDeltaText, { color: isImproved ? colors.success : colors.error }]}>
            {Math.abs(diff).toFixed(1)}{format === 'hr' ? '' : 's'}
          </Text>
        </View>
      </View>
    </View>
  );
};

export const WorkoutDetailScreen: React.FC = () => {
  const navigation = useNavigation<RootStackScreenProps<'WorkoutDetail'>['navigation']>();
  const route = useRoute<RootStackScreenProps<'WorkoutDetail'>['route']>();
  const { workoutId } = route.params;

  const myWorkouts = useWorkoutStore((state) => state.myWorkouts);
  const user = useAuthStore((state) => state.user);

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [hrZones, setHrZones] = useState<HrZoneBreakdown | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkout();
  }, [workoutId]);

  const loadWorkout = async () => {
    try {
      setLoading(true);

      // Check for dev-mode workout first
      if (workoutId.startsWith('dev-workout-')) {
        const localWorkout = myWorkouts.find((w) => w.id === workoutId);
        if (localWorkout) {
          setWorkout(localWorkout);
          setLoading(false);
          return;
        }
      }

      const response = await api.getWorkout(workoutId);
      if (response.success && response.data) {
        const data = response.data as {
          workout: Workout;
          comparison?: ComparisonData;
          hrZoneBreakdown?: HrZoneBreakdown;
        };
        setWorkout(data.workout);
        if (data.comparison) setComparison(data.comparison);
        if (data.hrZoneBreakdown) setHrZones(data.hrZoneBreakdown);
      }
    } catch (error) {
      console.error('Workout load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => navigation.goBack();

  // Check if this is the user's own workout
  const isOwner = workout?.user?.id === user?.id;

  const handleEdit = () => {
    if (!workout) return;
    navigation.navigate('WorkoutEdit', { workoutId: workout.id });
  };

  const handleDelete = () => {
    if (!workout) return;

    Alert.alert(
      'Delete Workout',
      'Are you sure you want to delete this workout? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await api.deleteWorkout(workout.id);
              if (response.success) {
                Alert.alert('Deleted', 'Workout has been deleted.');
                navigation.goBack();
              } else {
                Alert.alert('Error', response.error || 'Failed to delete workout');
              }
            } catch (error) {
              console.error('Delete error:', error);
              Alert.alert('Error', 'Failed to delete workout');
            }
          },
        },
      ]
    );
  };

  const handleShare = async () => {
    if (!workout) return;

    const workoutType = getWorkoutTypeName(workout.workoutType);
    const date = formatDate(workout.workoutDate || workout.createdAt);

    // Build user profile for effort calculation (needed for share message)
    const userProfileForShare: UserProfileForEffort = {
      age: user?.birthDate ? Math.floor((Date.now() - new Date(user.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 30,
      weightKg: user?.weightKg || 75,
      heightCm: user?.heightCm || 175,
      maxHr: user?.maxHr || 190,
      restingHr: user?.restingHr || 50,
    };
    const effortForShare = calculateUtxEffortScore(userProfileForShare, workout);

    const message = [
      `🚣 ${workoutType} - ${date}`,
      ``,
      `📊 ${effortForShare.effortPoints.toFixed(1)} EP (${effortForShare.zoneLabel})`,
      `⏱️ ${formatTime(workout.totalTimeSeconds)}`,
      `📏 ${workout.totalDistanceMetres?.toLocaleString()}m`,
      `⚡ ${formatSplit(workout.averageSplitSeconds)}/500m`,
      workout.avgHeartRate ? `❤️ ${workout.avgHeartRate} bpm avg` : '',
      ``,
      `Tracked with UTx 🏆`,
    ].filter(Boolean).join('\n');

    try {
      await Share.share({
        message,
        title: `${workoutType} Workout`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!workout) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.errorText}>Workout not found</Text>
          <TouchableOpacity onPress={handleClose} style={styles.errorButton}>
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Build user profile for effort calculation
  const userProfile: UserProfileForEffort = {
    age: user?.birthDate ? Math.floor((Date.now() - new Date(user.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 30,
    weightKg: user?.weightKg || 75,
    heightCm: user?.heightCm || 175,
    maxHr: user?.maxHr || 190,
    restingHr: user?.restingHr || 50,
  };

  // Calculate UTx Effort Score (0-100 EP)
  const effortResult = calculateUtxEffortScore(userProfile, workout);

  // Calculate Heart Rate Analysis (HRA)
  const hraResult = analyseHR(userProfile, workout);

  // Generate AI insight based on workout data
  const generateInsight = (): string => {
    const insights: string[] = [];

    if (workout.isPb) {
      insights.push('Congratulations on the personal best! Your training is paying off.');
    }

    if (effortResult.zone === 'peak') {
      insights.push(`Peak effort workout at ${effortResult.effortPoints.toFixed(1)} EP - make sure to prioritize recovery.`);
    } else if (effortResult.zone === 'training') {
      insights.push(`Training zone workout at ${effortResult.effortPoints.toFixed(1)} EP - great for building fitness.`);
    } else if (effortResult.zone === 'building') {
      insights.push('Building zone - this helps maintain your aerobic base.');
    }

    if (effortResult.breakdown.cardiacLoad > 30) {
      insights.push('High cardiac demand - ensure adequate recovery before intense sessions.');
    }

    if (comparison?.lastSimilar) {
      const timeDiff = workout.totalTimeSeconds - comparison.lastSimilar.totalTimeSeconds;
      if (timeDiff < 0) {
        insights.push(`You\'re ${Math.abs(timeDiff).toFixed(1)}s faster than your last similar workout!`);
      }
    }

    return insights.length > 0
      ? insights.join(' ')
      : 'Keep up the consistent training. Every stroke counts toward your goals.';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Workout Analysis</Text>
        <View style={styles.headerActions}>
          {isOwner && (
            <>
              <TouchableOpacity onPress={handleEdit} style={styles.headerButton}>
                <Ionicons name="pencil-outline" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} style={styles.headerButton}>
                <Ionicons name="trash-outline" size={22} color={colors.error} />
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity onPress={handleShare} style={styles.headerButton}>
            <Ionicons name="share-outline" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* AI Insight Banner */}
        <View style={styles.insightBanner}>
          <View style={styles.insightIconContainer}>
            <Ionicons name="sparkles" size={18} color={colors.primary} />
          </View>
          <Text style={styles.insightText}>{workout.aiInsight || generateInsight()}</Text>
        </View>

        {/* Hero Section - Workout Type & Date */}
        <View style={styles.heroSection}>
          <View style={styles.badgeRow}>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{getWorkoutTypeName(workout.workoutType)}</Text>
            </View>
            {workout.isPb && (
              <View style={styles.pbBadge}>
                <Ionicons name="trophy" size={12} color="#FFF" />
                <Text style={styles.pbBadgeText}>PB</Text>
              </View>
            )}
          </View>
          {/* Machine Type Indicator */}
          <View style={styles.machineTypeIndicator}>
            <Ionicons
              name={
                workout.machineType === 'bike' ? 'bicycle-outline' :
                workout.machineType === 'ski' ? 'snow-outline' : 'boat-outline'
              }
              size={14}
              color={colors.textTertiary}
            />
            <Text style={styles.machineTypeIndicatorText}>
              {workout.machineType === 'bike' ? 'Bike' :
               workout.machineType === 'ski' ? 'Ski' : 'Row'}
            </Text>
          </View>
          <Text style={styles.dateText}>
            {workout.workoutDate ? formatDate(workout.workoutDate) : formatDate(workout.createdAt)}
          </Text>
        </View>

        {/* Effort Score Section */}
        <View style={styles.section}>
          <EffortRing effortResult={effortResult} size={180} />
        </View>

        {/* Effort Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Effort Breakdown</Text>
          <View style={styles.breakdownCard}>
            <EffortBreakdownBar breakdown={effortResult.breakdown} />
          </View>
        </View>

        {/* Key Metrics Grid */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{workout.totalDistanceMetres?.toLocaleString()}m</Text>
            <Text style={styles.metricLabel}>Distance</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{formatTime(workout.totalTimeSeconds)}</Text>
            <Text style={styles.metricLabel}>Time</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{formatSplit(workout.averageSplitSeconds)}</Text>
            <Text style={styles.metricLabel}>Avg Split</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{workout.averageRate || '—'}</Text>
            <Text style={styles.metricLabel}>Stroke Rate</Text>
          </View>
        </View>

        {/* Heart Rate Analysis */}
        {hraResult.available && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Heart Rate Analysis</Text>
            <HRACard hraResult={hraResult} />
          </View>
        )}

        {/* Effort & HRA Explanations */}
        <View style={styles.breakdownInfoSection}>
          <Text style={styles.breakdownInfoTitle}>Effort Breakdown</Text>
          <Text style={styles.breakdownInfoText}>
            <Text style={styles.breakdownInfoBold}>Cardiac Load:</Text> Cardiovascular strain from heart rate intensity{'\n'}
            <Text style={styles.breakdownInfoBold}>Work Output:</Text> Power × duration, adjusted for body size{'\n'}
            <Text style={styles.breakdownInfoBold}>Pacing:</Text> Consistency bonus - even/negative splits rewarded{'\n'}
            <Text style={styles.breakdownInfoBold}>Economy:</Text> Stroke efficiency (watts per stroke)
          </Text>

          {hraResult.available && (
            <>
              <Text style={[styles.breakdownInfoTitle, { marginTop: spacing.md }]}>Heart Rate Analysis</Text>
              <Text style={styles.breakdownInfoText}>
                <Text style={styles.breakdownInfoBold}>Intensity:</Text> Avg HR as percentage of max and HR reserve{'\n'}
                <Text style={styles.breakdownInfoBold}>Zone:</Text> Training zone based on Karvonen HR Reserve method{'\n'}
                <Text style={styles.breakdownInfoBold}>Efficiency:</Text> Watts produced per heartbeat above resting{'\n'}
                <Text style={styles.breakdownInfoBold}>HR Reserve:</Text> Difference between max HR and resting HR - provides more accurate personalised zone calculations than max HR alone
              </Text>
            </>
          )}
        </View>

        {/* Splits Analysis */}
        {workout.intervals && workout.intervals.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Splits Analysis</Text>
            <View style={styles.splitsCard}>
              <SplitsChart intervals={workout.intervals} />
            </View>
          </View>
        )}

        {/* Performance Comparison */}
        {comparison?.lastSimilar && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>vs Last {getWorkoutTypeName(workout.workoutType)}</Text>
            <View style={styles.comparisonCard}>
              <Text style={styles.comparisonSubtitle}>{formatDate(comparison.lastSimilar.date)}</Text>
              <ComparisonRow
                label="Total Time"
                current={workout.totalTimeSeconds}
                previous={comparison.lastSimilar.totalTimeSeconds}
                format="time"
              />
              <ComparisonRow
                label="Avg Split"
                current={workout.averageSplitSeconds}
                previous={comparison.lastSimilar.averageSplitSeconds}
                format="split"
              />
              {workout.avgHeartRate && comparison.lastSimilar.avgHeartRate && (
                <ComparisonRow
                  label="Avg HR"
                  current={workout.avgHeartRate}
                  previous={comparison.lastSimilar.avgHeartRate}
                  format="hr"
                  lowerIsBetter={false}
                />
              )}
            </View>
          </View>
        )}

        {/* PB Gap */}
        {comparison?.personalBest && !workout.isPb && (
          <View style={styles.section}>
            <View style={styles.pbGapCard}>
              <View style={styles.pbGapHeader}>
                <Ionicons name="trophy-outline" size={20} color={colors.pbGold} />
                <Text style={styles.pbGapTitle}>Gap to Personal Best</Text>
              </View>
              <View style={styles.pbGapContent}>
                <Text style={styles.pbGapValue}>
                  +{(workout.totalTimeSeconds - comparison.personalBest.timeSeconds).toFixed(1)}s
                </Text>
                <Text style={styles.pbGapSubtext}>
                  PB: {formatTime(comparison.personalBest.timeSeconds)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Additional Stats */}
        {(workout.averageWatts || workout.calories || workout.dragFactor) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Stats</Text>
            <View style={styles.additionalStatsGrid}>
              {workout.averageWatts && (
                <View style={styles.additionalStatItem}>
                  <Ionicons name="flash-outline" size={20} color={colors.primary} />
                  <Text style={styles.additionalStatValue}>{workout.averageWatts}W</Text>
                  <Text style={styles.additionalStatLabel}>Avg Power</Text>
                </View>
              )}
              {workout.calories && (
                <View style={styles.additionalStatItem}>
                  <Ionicons name="flame-outline" size={20} color={colors.error} />
                  <Text style={styles.additionalStatValue}>{workout.calories}</Text>
                  <Text style={styles.additionalStatLabel}>Calories</Text>
                </View>
              )}
              {workout.dragFactor && (
                <View style={styles.additionalStatItem}>
                  <Ionicons name="speedometer-outline" size={20} color={colors.textSecondary} />
                  <Text style={styles.additionalStatValue}>{workout.dragFactor}</Text>
                  <Text style={styles.additionalStatLabel}>Drag Factor</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Notes */}
        {workout.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{workout.notes}</Text>
            </View>
          </View>
        )}

        {/* Photo */}
        {workout.photoUrl && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Erg Screen</Text>
            <Image source={{ uri: workout.photoUrl }} style={styles.photo} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  errorText: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  errorButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  errorButtonText: {
    color: colors.textInverse,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerButton: {
    padding: spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },

  // AI Insight Banner
  insightBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primarySubtle,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  insightIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    lineHeight: 20,
  },

  // Hero Section
  heroSection: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  typeBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  typeBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textInverse,
  },
  pbBadge: {
    backgroundColor: colors.pbGold,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pbBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: '#FFF',
  },
  machineTypeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.xs,
  },
  machineTypeIndicatorText: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },
  dateText: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
  },

  // Section
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },

  // Effort Ring
  strainZoneBadge: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  strainZoneText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: '#FFF',
  },
  strainDescription: {
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
    color: colors.textTertiary,
  },

  // Effort Breakdown
  breakdownCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  breakdownContainer: {
    gap: spacing.md,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breakdownLabelContainer: {
    width: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  breakdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  breakdownLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  breakdownBarContainer: {
    flex: 1,
    height: 20,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: borderRadius.sm,
    marginHorizontal: spacing.sm,
    overflow: 'hidden',
  },
  breakdownBarFill: {
    height: '100%',
    borderRadius: borderRadius.sm,
  },
  breakdownValue: {
    width: 50,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'right',
    fontWeight: fontWeight.medium,
  },
  breakdownInfoSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  breakdownInfoTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  breakdownInfoText: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    lineHeight: 18,
  },
  breakdownInfoBold: {
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },

  // Metrics Grid
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  metricCard: {
    width: (SCREEN_WIDTH - spacing.md * 2 - spacing.sm * 3) / 4,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    alignItems: 'center',
    ...shadows.sm,
  },
  metricValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  metricLabel: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },

  // HR Card
  hrCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  hrStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.lg,
  },
  hrStatItem: {
    alignItems: 'center',
  },
  hrStatValue: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  hrStatLabel: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },

  // HR Zone Bar
  hrZoneContainer: {
    gap: spacing.sm,
  },
  hrZoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hrZoneLabelContainer: {
    width: 80,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  hrZoneDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  hrZoneName: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  hrZoneBarContainer: {
    flex: 1,
    height: 16,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: borderRadius.sm,
    marginHorizontal: spacing.sm,
    overflow: 'hidden',
  },
  hrZoneBarFill: {
    height: '100%',
    borderRadius: borderRadius.sm,
  },
  hrZoneTime: {
    width: 60,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'right',
  },

  // HRA Card
  hraCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  hraSection: {
    marginBottom: spacing.lg,
  },
  hraDoubleSection: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  hraHalfSection: {
    flex: 1,
    alignItems: 'center',
  },
  hraSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  hraSectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  hraIntensityRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  hraIntensityItem: {
    alignItems: 'center',
  },
  hraIntensityValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  hraIntensityLabel: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
  hraZoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  hraZoneBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  hraZoneBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: '#FFF',
  },
  hraZoneEffect: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  hraZoneEffectSmall: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  hraMainValue: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    marginTop: spacing.xs,
  },
  hraSmallBadge: {
    alignSelf: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
  },
  hraSmallBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: '#FFF',
  },
  hraSubtext: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
    textAlign: 'center',
  },
  hraEfficiencyCompact: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  hraEfficiencyValueLarge: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  hraEfficiencyUnit: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },
  hraEfficiencyBadgeSmall: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
  },
  hraEfficiencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  hraEfficiencyItem: {
    alignItems: 'center',
    minWidth: 60,
  },
  hraEfficiencyValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  hraEfficiencyLabel: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
  hraEfficiencyMeta: {
    flex: 1,
  },
  hraEfficiencyBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginBottom: 4,
  },
  hraEfficiencyBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: '#FFF',
  },
  hraEfficiencyInsight: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  hraDriftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  hraDriftItem: {
    alignItems: 'center',
    minWidth: 60,
  },
  hraDriftValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  hraDriftLabel: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
  hraDriftMeta: {
    flex: 1,
  },
  hraDriftBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginBottom: 4,
  },
  hraDriftBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: '#FFF',
  },
  hraDriftInsight: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  hraTrendRow: {
    gap: spacing.xs,
  },
  hraTrendValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  hraTrendDelta: {
    color: colors.textTertiary,
  },
  hraTrendInsight: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  hraZoneDistContainer: {
    gap: spacing.sm,
  },
  hraZoneDistRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hraZoneDistLabel: {
    width: 80,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  hraZoneDistDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  hraZoneDistName: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  hraZoneDistBarContainer: {
    flex: 1,
    height: 16,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: borderRadius.sm,
    marginHorizontal: spacing.sm,
    overflow: 'hidden',
  },
  hraZoneDistBarFill: {
    height: '100%',
    borderRadius: borderRadius.sm,
  },
  hraZoneDistTime: {
    width: 60,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  hraNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  hraNoticeText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },

  // Splits
  splitsCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  splitsContainer: {
    gap: spacing.sm,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  splitNumber: {
    width: 24,
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    fontWeight: fontWeight.medium,
  },
  splitBarContainer: {
    flex: 1,
    height: 24,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: borderRadius.sm,
    marginHorizontal: spacing.sm,
    overflow: 'hidden',
  },
  splitBarFill: {
    height: '100%',
    borderRadius: borderRadius.sm,
  },
  splitPaceContainer: {
    width: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  splitPace: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  fastestPace: {
    color: colors.success,
    fontWeight: fontWeight.bold,
  },
  slowestPace: {
    color: colors.warning,
  },
  fastestBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitAvgRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  splitAvgLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  splitAvgValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },

  // Comparison
  comparisonCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  comparisonSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginBottom: spacing.md,
  },
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  comparisonLabel: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  comparisonValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  comparisonCurrent: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  comparisonDelta: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    gap: 2,
  },
  deltaPositive: {
    backgroundColor: '#DCFCE7',
  },
  deltaNegative: {
    backgroundColor: '#FEE2E2',
  },
  comparisonDeltaText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },

  // PB Gap
  pbGapCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.pbGold,
    ...shadows.sm,
  },
  pbGapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  pbGapTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  pbGapContent: {
    alignItems: 'center',
  },
  pbGapValue: {
    fontSize: fontSize.hero,
    fontWeight: fontWeight.bold,
    color: colors.error,
  },
  pbGapSubtext: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },

  // Additional Stats
  additionalStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  additionalStatItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  additionalStatValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  additionalStatLabel: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },

  // Notes
  notesCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  notesText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 22,
  },

  // Photo
  photo: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.backgroundTertiary,
  },
});
