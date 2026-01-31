// User types
export type Gender = 'male' | 'female' | 'prefer_not_to_say';
export type HeightUnit = 'cm' | 'ft_in';
export type WeightUnit = 'kg' | 'lbs';

export interface User {
  id: string;
  phoneNumber?: string;
  appleId?: string;
  googleId?: string;
  name: string;
  avatarUrl?: string;
  heightCm: number;
  weightKg: number;
  birthDate: string; // ISO date
  gender: Gender;
  maxHr: number;
  stravaConnected: boolean;
  stravaRefreshToken?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  name: string;
  avatarUrl?: string;
  heightCm: number;
  weightKg: number;
  birthDate: string;
  gender: Gender;
  maxHr: number;
}

// Workout types
export type WorkoutType =
  | '500m'
  | '1000m'
  | '2000m'
  | '5000m'
  | '6000m'
  | '10000m'
  | 'half_marathon'
  | 'marathon'
  | '1_minute'
  | 'steady_state'
  | 'intervals'
  | 'custom';

export interface WorkoutInterval {
  number: number;
  distanceMetres: number;
  timeSeconds: number;
  paceSeconds: number; // per 500m
  strokeRate: number;
  avgHeartRate?: number;
}

export interface HrDataPoint {
  timeSeconds: number;
  heartRate: number;
}

export interface Workout {
  id: string;
  userId: string;
  workoutType: WorkoutType;
  totalTimeSeconds: number;
  totalDistanceMetres: number;
  averageSplitSeconds: number; // per 500m
  averageRate: number; // spm
  averageWatts?: number;
  calories?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  dragFactor?: number;
  effortScore?: number; // 0-10
  intervals?: WorkoutInterval[];
  hrData?: HrDataPoint[];
  photoUrl?: string;
  aiInsight?: string;
  isPb: boolean;
  pbCategory?: string;
  stravaActivityId?: string;
  squadId?: string;
  notes?: string;
  workoutDate: string; // ISO date - when workout occurred
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutSummary {
  id: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  workoutType: WorkoutType;
  totalTimeSeconds: number;
  totalDistanceMetres: number;
  averageSplitSeconds: number;
  averageRate: number;
  avgHeartRate?: number;
  effortScore?: number;
  isPb: boolean;
  reactionCount: number;
  commentCount: number;
  workoutDate: string;
  createdAt: string;
}

// Club & Squad types
export type ClubRole = 'admin' | 'member';
export type SquadRole = 'captain' | 'member';

export interface Club {
  id: string;
  name: string;
  location?: string;
  verified: boolean;
  inviteCode: string;
  createdAt: string;
}

export interface Squad {
  id: string;
  clubId: string;
  name: string;
  inviteCode: string;
  createdAt: string;
}

export interface ClubMembership {
  id: string;
  clubId: string;
  userId: string;
  role: ClubRole;
  joinedAt: string;
}

export interface SquadMembership {
  id: string;
  squadId: string;
  userId: string;
  role: SquadRole;
  joinedAt: string;
}

// Social types
export interface Follow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: string;
}

export interface WorkoutReaction {
  id: string;
  workoutId: string;
  userId: string;
  createdAt: string;
}

export interface WorkoutComment {
  id: string;
  workoutId: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  content: string;
  createdAt: string;
}

// Personal Bests
export type PbCategory =
  | '500m'
  | '1000m'
  | '2000m'
  | '5000m'
  | '6000m'
  | '10000m'
  | 'half_marathon'
  | 'marathon'
  | '1_minute';

export interface PersonalBest {
  id: string;
  userId: string;
  category: PbCategory;
  timeSeconds?: number;
  distanceMetres?: number; // for 1-minute test
  achievedAt: string;
  workoutId: string;
}

// HR Zones
export interface HrZone {
  zone: 1 | 2 | 3 | 4 | 5;
  name: string;
  minPercent: number;
  maxPercent: number;
  color: string;
}

export const HR_ZONES: HrZone[] = [
  { zone: 1, name: 'Recovery', minPercent: 0, maxPercent: 60, color: '#94A3B8' },
  { zone: 2, name: 'Easy Aerobic', minPercent: 60, maxPercent: 70, color: '#22C55E' },
  { zone: 3, name: 'Aerobic', minPercent: 70, maxPercent: 80, color: '#EAB308' },
  { zone: 4, name: 'Threshold', minPercent: 80, maxPercent: 90, color: '#F97316' },
  { zone: 5, name: 'Max', minPercent: 90, maxPercent: 100, color: '#EF4444' },
];

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// OCR Result from Vision API
export interface OcrWorkoutData {
  totalTimeSeconds?: number;
  totalDistanceMetres?: number;
  averageSplitSeconds?: number;
  averageRate?: number;
  averageWatts?: number;
  calories?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  dragFactor?: number;
  intervals?: WorkoutInterval[];
  inferredWorkoutType?: WorkoutType;
  confidence: number; // 0-1
  rawText?: string;
}

// Leaderboard types
export type LeaderboardScope = 'global' | 'club' | 'squad' | 'following';
export type LeaderboardMetric =
  | 'total_metres_weekly'
  | 'total_metres_monthly'
  | 'total_metres_all_time'
  | 'best_2k'
  | 'best_5k'
  | 'best_10k'
  | 'consistency_streak'
  | 'workouts_monthly';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  value: number;
  formattedValue: string;
}

// Strava types
export interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}
