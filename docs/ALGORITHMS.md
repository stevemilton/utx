# UTx Proprietary Algorithms

**CONFIDENTIAL - UTx Secret Sauce**

This document contains the proprietary algorithms that power UTx's workout analysis. These algorithms are our competitive advantage and differentiate us from other rowing apps.

---

## Table of Contents

1. [UTx Effort Score (0-100 EP)](#utx-effort-score-0-100-ep)
2. [Heart Rate Analysis (HRA)](#heart-rate-analysis-hra)
3. [Implementation Locations](#implementation-locations)

---

## UTx Effort Score (0-100 EP)

### Overview

The UTx Effort Score measures total training load on a 0-100 scale called "Effort Points" (EP). Unlike simple HR-based metrics, it combines cardiovascular strain, mechanical work, pacing quality, and stroke efficiency into a single actionable score.

### Why This Matters

- **Whoop/Garmin** use HR alone → misses work done at lower HR
- **Strava** uses "Suffer Score" → arbitrary, not rowing-specific
- **UTx** combines HR + Power + Pacing + Economy → complete picture

### The Four Components

| Component | Max Points | Weight | What It Measures |
|-----------|------------|--------|------------------|
| Cardiac Load | 40 | 40% | Cardiovascular strain via HR Reserve method |
| Work Output | 35 | 35% | Power × duration, adjusted for body size |
| Pacing | 15 | 15% | Split consistency and negative split bonus |
| Economy | 10 | 10% | Stroke efficiency (watts per stroke) |

### Effort Zones

| EP Range | Zone | Color | Description |
|----------|------|-------|-------------|
| 0-25 | Recovery | Green (#4ADE80) | Active recovery zone |
| 26-50 | Building | Blue (#3B82F6) | Aerobic base building |
| 51-75 | Training | Amber (#FBBF24) | Fitness gains zone |
| 76-100 | Peak | Red (#EF4444) | Maximum effort |

---

### Algorithm Detail: Cardiac Load (0-40 points)

Uses the **Karvonen (HR Reserve) method** for accurate intensity measurement.

```typescript
// WITH HEART RATE DATA
const hrReserve = maxHr - restingHr;
const avgIntensity = (avgHr - restingHr) / hrReserve;

// Non-linear scaling: 90% HRR is disproportionately harder than 70%
let cardiacScore = Math.pow(Math.max(0, avgIntensity), 1.5) * 40;

// Age adjustment: older athletes get credit for same HR effort
const ageFactor = 1 + (age - 30) * 0.005; // +0.5% per year over 30
cardiacScore *= Math.min(ageFactor, 1.3); // cap at 30% bonus

cardiacScore = Math.min(40, Math.max(0, cardiacScore));
```

**NO HEART RATE DATA - Power-Based Estimation:**

When HR data isn't available, we estimate cardiac load from power output:

```typescript
// Estimate cardiac load from power (conservative - caps at ~28/40)
const bodyWeightFactor = Math.pow(weightKg / 75, 0.222);
const thresholdWatts = 220 * bodyWeightFactor; // Expected threshold power

const powerIntensity = Math.min(avgWatts / thresholdWatts, 1.3);
const durationFactor = Math.min(Math.log10(totalTimeMins + 1) * 0.6, 0.85);

// Conservative estimate - caps at ~28/40 since it's power-based
cardiacScore = Math.pow(powerIntensity, 1.2) * durationFactor * 28;

// Age adjustment still applies
const ageFactor = 1 + (age - 30) * 0.005;
cardiacScore *= Math.min(ageFactor, 1.3);
```

**Why this works:**
- Power output correlates with HR at a given fitness level
- Using `thresholdWatts = 220 * bodyWeightFactor` as baseline
- Capped at 28/40 (not full 40) since it's an estimate
- Workouts without HR can still reach ~70 EP instead of being capped at 60

---

### Algorithm Detail: Work Output (0-35 points)

Measures mechanical work done, normalized for body size using the Concept2 weight adjustment formula.

```typescript
// Size-adjusted power expectation
const bodyWeightFactor = Math.pow(weightKg / 75, 0.222); // diminishing returns on size
const expectedWatts = 150 * bodyWeightFactor; // baseline expectation for "average" effort

const relativePower = avgWatts / expectedWatts;
const durationFactor = Math.log10(totalTimeMins + 1); // diminishing returns on duration

let workScore = relativePower * durationFactor * 15;
workScore = Math.min(35, Math.max(0, workScore));
```

**Key insights:**
- `Math.pow(weight/75, 0.222)` mirrors Concept2's weight adjustment
- Heavier athletes expected to produce more watts
- Duration has diminishing returns (log scale) - 60 mins isn't 6x harder than 10 mins

---

### Algorithm Detail: Pacing (0-15 points)

Rewards consistent pacing and negative splits.

```typescript
let pacingScore = 10; // default for single piece

if (intervals.length > 1) {
  const splits = intervals.map(i => i.paceSeconds);
  const meanSplit = splits.reduce((a, b) => a + b, 0) / splits.length;
  const variance = splits.reduce((sum, s) => sum + Math.pow(s - meanSplit, 2), 0) / splits.length;
  const cv = Math.sqrt(variance) / meanSplit; // coefficient of variation

  // Check for negative splits (getting faster = good)
  const halfIndex = Math.floor(splits.length / 2);
  const firstHalfAvg = splits.slice(0, halfIndex).reduce((a, b) => a + b, 0) / halfIndex;
  const secondHalfAvg = splits.slice(halfIndex).reduce((a, b) => a + b, 0) / (splits.length - halfIndex);
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
```

**Why this matters:**
- Even pacing = better racing
- Negative splits = excellent execution
- High variance = poor pacing strategy

---

### Algorithm Detail: Economy (0-10 points)

Measures stroke efficiency using watts per stroke.

```typescript
let economyScore = 5; // default if no stroke rate

if (avgStrokeRate && avgWatts) {
  const wattsPerStroke = avgWatts / avgStrokeRate;

  // Higher watts per stroke = more efficient
  // But high stroke rate = more cardiovascular demand
  // Balance: reward efficiency but acknowledge high-rate work
  if (wattsPerStroke > 8) {
    economyScore = 6;  // Very efficient (low rate, high power)
  } else if (wattsPerStroke > 6) {
    economyScore = 8;  // Good balance
  } else {
    economyScore = 10; // Grinding at high rate (more work)
  }
}
```

**The logic:**
- Low W/stroke + high rate = working harder = more effort credit
- High W/stroke + low rate = efficient but less cardiovascular demand
- This counterbalances the pacing component

---

## Heart Rate Analysis (HRA)

### Overview

HRA provides qualitative insights when heart rate monitor data is available. It complements the Effort Score with detailed HR-specific analysis.

### Prerequisites

- Requires `avgHeartRate` from workout
- Uses user's `maxHr` and `restingHr` from profile
- Enhanced analysis with per-interval HR data

---

### HR Zones (Karvonen Method)

We use the **HR Reserve method** (not simple %maxHR) for more accurate personalised zones:

```typescript
const calculateHrZones = (maxHr: number, restingHr: number) => {
  const hrReserve = maxHr - restingHr;

  return {
    z1: {
      name: 'Recovery',
      minHr: Math.round(restingHr + hrReserve * 0.50),
      maxHr: Math.round(restingHr + hrReserve * 0.60),
      color: '#94A3B8',
      trainingEffect: 'Active recovery, minimal stress',
    },
    z2: {
      name: 'Aerobic',
      minHr: Math.round(restingHr + hrReserve * 0.60),
      maxHr: Math.round(restingHr + hrReserve * 0.70),
      color: '#4ADE80',
      trainingEffect: 'Aerobic base, fat metabolism',
    },
    z3: {
      name: 'Tempo',
      minHr: Math.round(restingHr + hrReserve * 0.70),
      maxHr: Math.round(restingHr + hrReserve * 0.80),
      color: '#3B82F6',
      trainingEffect: 'Lactate threshold, sustainable pace',
    },
    z4: {
      name: 'Threshold',
      minHr: Math.round(restingHr + hrReserve * 0.80),
      maxHr: Math.round(restingHr + hrReserve * 0.90),
      color: '#FBBF24',
      trainingEffect: 'VO2 max, race fitness',
    },
    z5: {
      name: 'Max',
      minHr: Math.round(restingHr + hrReserve * 0.90),
      maxHr: maxHr,
      color: '#EF4444',
      trainingEffect: 'Anaerobic power, speed',
    },
  };
};
```

**Why HR Reserve is better:**
- Simple %maxHR: 70% of 190 = 133 bpm (same for everyone with 190 max)
- HR Reserve: 50 resting + 70% of (190-50) = 148 bpm (personalised)
- Athletes with lower resting HR have higher actual training zones

---

### Intensity Calculation

```typescript
// Percentage of max HR (traditional)
const intensityPct = (avgHr / maxHr) * 100;

// Percentage of HR Reserve (Karvonen - more accurate)
const intensityHrr = ((avgHr - restingHr) / hrReserve) * 100;
```

---

### Aerobic Efficiency

Measures watts produced per heartbeat above resting - a key fitness indicator.

```typescript
const calculateEfficiency = (avgWatts: number, avgHr: number, restingHr: number) => {
  const wattsPerBeat = avgWatts / (avgHr - restingHr);

  // Benchmarks (approximate, varies by age/fitness):
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

  return { wattsPerBeat, rating, insight };
};
```

**Benchmarks:**
| W/beat | Rating | Typical Athlete |
|--------|--------|-----------------|
| > 3.0 | Elite | International-level rower |
| 2.5 - 3.0 | Excellent | Club competitive |
| 2.0 - 2.5 | Good | Regular trainer |
| 1.5 - 2.0 | Developing | Building base |
| < 1.5 | Building | New to training |

---

### Cardiac Drift (Fatigue Indicator)

Measures how HR rises relative to power output over the session - a key indicator of fatigue and hydration.

```typescript
const calculateDrift = (intervals: { avgHeartRate: number; watts: number }[]) => {
  // Need at least 4 intervals with HR data
  if (intervals.length < 4) return null;

  const mid = Math.floor(intervals.length / 2);
  const firstHalf = intervals.slice(0, mid);
  const secondHalf = intervals.slice(mid);

  // Calculate HR per watt ratio for each half
  const firstHrPerWatt = firstHalf.reduce((sum, i) => sum + (i.avgHeartRate / i.watts), 0) / firstHalf.length;
  const secondHrPerWatt = secondHalf.reduce((sum, i) => sum + (i.avgHeartRate / i.watts), 0) / secondHalf.length;

  const driftPercent = ((secondHrPerWatt - firstHrPerWatt) / firstHrPerWatt) * 100;

  // Check for power drop (pacing issue indicator)
  const firstAvgWatts = firstHalf.reduce((sum, i) => sum + i.watts, 0) / firstHalf.length;
  const secondAvgWatts = secondHalf.reduce((sum, i) => sum + i.watts, 0) / secondHalf.length;
  const powerDropPercent = ((firstAvgWatts - secondAvgWatts) / firstAvgWatts) * 100;

  const isPacingIssue = powerDropPercent > 10 && driftPercent > 10;

  // Rating logic
  if (driftPercent < 3) return { rating: 'excellent', insight: 'Minimal drift - excellent aerobic fitness' };
  if (driftPercent < 6) return { rating: 'good', insight: 'Normal drift - well paced' };
  if (driftPercent < 10) return { rating: 'moderate', insight: 'Some fatigue accumulation' };
  if (isPacingIssue) return { rating: 'pacing_issue', insight: `Went out too hard - power dropped ${powerDropPercent}% while HR climbed` };
  return { rating: 'high', insight: 'High drift - review pacing, hydration, or fatigue' };
};
```

**What drift tells us:**
- < 3%: Excellent aerobic fitness, well-adapted
- 3-6%: Normal range for most sessions
- 6-10%: Some fatigue - may need recovery
- > 10%: High drift - check hydration, sleep, or overtraining
- Power drop + HR rise: Pacing issue (went out too hard)

---

### HR Trend Analysis

Detects patterns in how HR changes through the session.

```typescript
const analyseHrTrend = (intervals: { avgHeartRate: number }[]) => {
  const hrValues = intervals.map(i => i.avgHeartRate);
  if (hrValues.length < 3) return null;

  const earlyRise = hrValues[1] - hrValues[0];
  const lateRise = hrValues[hrValues.length - 1] - hrValues[hrValues.length - 2];
  const totalRise = hrValues[hrValues.length - 1] - hrValues[0];

  if (totalRise <= 0) {
    return { pattern: 'stable', insight: 'HR stayed flat - possible low intensity or excellent fitness' };
  } else if (lateRise > earlyRise * 1.5 && lateRise > 5) {
    return { pattern: 'accelerating', insight: 'HR still climbing at end - longer warmup may help' };
  } else if (Math.abs(lateRise) < 3 && earlyRise > 5) {
    return { pattern: 'plateaued', insight: 'HR stabilised - good pacing' };
  } else {
    return { pattern: 'steady_climb', insight: 'Gradual HR rise through session' };
  }
};
```

**Patterns:**
| Pattern | Description | Coaching Insight |
|---------|-------------|------------------|
| Stable | HR flat throughout | Low intensity or excellent fitness |
| Plateaued | Rose then levelled | Good warmup and pacing |
| Steady Climb | Gradual rise | Normal response to sustained effort |
| Accelerating | Still rising at end | May need longer warmup |

---

## Implementation Locations

### Backend (Server-side calculation)

```
apps/backend/src/utils/effortScore.ts
```

Contains:
- `calculateUtxEffortScore()` - Main effort calculation
- `calculateEffortScore()` - Legacy 0-10 scale (backward compatibility)
- `UserProfile` and `Interval` types

### Frontend (Client-side calculation for UI)

```
apps/mobile/src/screens/WorkoutDetailScreen.tsx
```

Contains:
- `calculateUtxEffortScore()` - Mirrors backend logic
- `analyseHR()` - HRA analysis
- `calculateHrZones()` - Karvonen zone calculation
- `calculateEfficiency()` - W/beat calculation
- `calculateDrift()` - Cardiac drift analysis
- `analyseHrTrend()` - HR pattern detection

### Database Storage

```
apps/backend/prisma/schema.prisma
```

Workout model fields:
- `effortScore Float?` - Legacy 0-10
- `effortPoints Float?` - UTx 0-100
- `effortZone String?` - recovery/building/training/peak
- `effortBreakdown Json?` - { cardiacLoad, workOutput, pacing, economy }

User model fields:
- `maxHr Int @default(0)` - Max heart rate
- `restingHr Int?` - Resting heart rate (optional, improves accuracy)

---

## Future Enhancements

### Planned
- [ ] Weekly/monthly load tracking (sum of EP over time)
- [ ] Recovery recommendation based on accumulated load
- [ ] Fitness trend (efficiency improvement over time)
- [ ] Personalised zone thresholds based on test data

### Considered
- [ ] Sleep/recovery integration (if we add wearable sync)
- [ ] Training plan load balancing
- [ ] Peer comparison (same age/weight bracket)

---

**Document Version:** 1.0
**Last Updated:** 2 February 2026
**Author:** UTx Engineering
