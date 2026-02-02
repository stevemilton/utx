import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';

// Auth Stack
export type AuthStackParamList = {
  Welcome: undefined;
  Auth: undefined;
  PhoneAuth: undefined;
  VerifyCode: { phoneNumber: string };
};

// Onboarding Stack
export type OnboardingStackParamList = {
  ProfileIdentity: undefined;
  ProfilePhysical: undefined;
  HRSetup: undefined;
  JoinClub: undefined;
  Tutorial: undefined;
};

// OCR Data type
export interface OcrWorkoutData {
  workoutType?: string;
  totalTimeSeconds?: number;
  totalDistanceMetres?: number;
  avgSplit?: number;
  avgStrokeRate?: number;
  avgWatts?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  calories?: number;
  dragFactor?: number;
  intervals?: Array<{
    distanceMetres?: number;
    timeSeconds?: number;
    split?: number;
    strokeRate?: number;
    watts?: number;
    heartRate?: number;
  }>;
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
  SquadDetail: { squadId: string };
  EditProfile: undefined;
  PBHistory: { category: string };
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
