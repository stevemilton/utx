import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';

// Auth Stack
export type AuthStackParamList = {
  Welcome: undefined;
  Auth: undefined;
  PhoneAuth: undefined;
  VerifyCode: { phoneNumber: string };
  // Email/Password auth screens
  EmailSignup: undefined;
  EmailLogin: undefined;
  VerifyEmail: { email: string };
  ForgotPassword: undefined;
  ResetPassword: { token: string };
};

// Onboarding Stack
export type OnboardingStackParamList = {
  Consent: undefined;
  ProfileIdentity: undefined;
  ProfilePhysical: undefined;
  HRSetup: undefined;
  JoinClub: undefined;
  Tutorial: undefined;
};

// OCR Data type - matches backend response from GPT-4o Vision
export interface OcrWorkoutData {
  workoutType?: string;
  totalTimeSeconds?: number;
  totalDistanceMetres?: number;
  estimatedDistanceMetres?: number; // Calculated when distance shows 0
  distanceEstimated?: boolean;
  avgSplit?: number;
  avgStrokeRate?: number;
  avgWatts?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  calories?: number;
  dragFactor?: number;
  confidence?: number; // 0-100, OCR confidence score
  validationWarning?: string; // Warning from backend validation
  intervals?: Array<{
    distanceMetres?: number;
    timeSeconds?: number;
    split?: number;
    strokeRate?: number;
    watts?: number;
    heartRate?: number;
  }>;
  rawValues?: {
    timeDisplay?: string;
    splitDisplay?: string;
    distanceDisplay?: string;
  };
}

// Main Tab Navigator
export type MainTabParamList = {
  Feed: undefined;
  Workouts: undefined;
  AddWorkout: { ocrData?: OcrWorkoutData; photoUri?: string } | undefined;
  Leaderboard: undefined;
  Profile: undefined;
};

// Root Stack (contains everything)
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Onboarding: NavigatorScreenParams<OnboardingStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;

  // Modal screens
  WorkoutDetail: { workoutId: string };
  WorkoutEdit: { workoutId?: string; photoUri?: string };
  Camera: undefined;
  AddWorkout: { ocrData?: OcrWorkoutData; photoUri?: string } | undefined;
  Comments: { workoutId: string };
  UserProfile: { userId: string };
  ClubDetail: { clubId: string };
  ClubJoinRequests: { clubId: string; clubName: string };
  SquadDetail: { squadId: string };
  EditProfile: undefined;
  PBHistory: { category: string };
  ClubSearch: undefined;
  AthleteSearch: undefined;
  CreateClub: undefined;
  Admin: undefined;
  PrivacySettings: undefined;
};

// Screen prop types
export type AuthScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<
  AuthStackParamList,
  T
>;

export type OnboardingScreenProps<T extends keyof OnboardingStackParamList> =
  NativeStackScreenProps<OnboardingStackParamList, T>;

export type MainTabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

// Declare global for type-safe navigation
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
