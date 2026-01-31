import { create } from 'zustand';

export interface WorkoutInterval {
  number: number;
  distanceMetres: number;
  timeSeconds: number;
  paceSeconds: number;
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
  workoutType: string;
  totalTimeSeconds: number;
  totalDistanceMetres: number;
  averageSplitSeconds: number;
  averageRate: number;
  averageWatts?: number;
  calories?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  dragFactor?: number;
  effortScore?: number;
  intervals?: WorkoutInterval[];
  hrData?: HrDataPoint[];
  photoUrl?: string;
  aiInsight?: string;
  isPb: boolean;
  pbCategory?: string;
  squadId?: string;
  notes?: string;
  workoutDate: string;
  createdAt: string;
}

export interface WorkoutSummary {
  id: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  workoutType: string;
  totalTimeSeconds: number;
  totalDistanceMetres: number;
  averageSplitSeconds: number;
  averageRate: number;
  avgHeartRate?: number;
  effortScore?: number;
  isPb: boolean;
  reactionCount: number;
  commentCount: number;
  hasUserReacted: boolean;
  workoutDate: string;
  createdAt: string;
}

export interface PendingWorkout {
  photoUri: string;
  ocrData?: Partial<Workout>;
  isProcessing: boolean;
  error?: string;
}

interface WorkoutState {
  // Feed data
  feedWorkouts: WorkoutSummary[];
  squadFeedWorkouts: WorkoutSummary[];
  followingFeedWorkouts: WorkoutSummary[];
  feedLoading: boolean;
  feedError: string | null;

  // My workouts
  myWorkouts: Workout[];
  myWorkoutsLoading: boolean;

  // Current workout being created
  pendingWorkout: PendingWorkout | null;

  // Actions
  setFeedWorkouts: (workouts: WorkoutSummary[]) => void;
  setSquadFeedWorkouts: (workouts: WorkoutSummary[]) => void;
  setFollowingFeedWorkouts: (workouts: WorkoutSummary[]) => void;
  setFeedLoading: (loading: boolean) => void;
  setFeedError: (error: string | null) => void;
  appendFeedWorkouts: (workouts: WorkoutSummary[]) => void;

  setMyWorkouts: (workouts: Workout[]) => void;
  setMyWorkoutsLoading: (loading: boolean) => void;
  addWorkout: (workout: Workout) => void;
  updateWorkout: (id: string, updates: Partial<Workout>) => void;
  deleteWorkout: (id: string) => void;

  setPendingWorkout: (workout: PendingWorkout | null) => void;
  updatePendingWorkout: (updates: Partial<PendingWorkout>) => void;
  clearPendingWorkout: () => void;

  // Feed interactions
  toggleReaction: (workoutId: string) => void;
  incrementComments: (workoutId: string) => void;
}

export const useWorkoutStore = create<WorkoutState>()((set, get) => ({
  // Initial state
  feedWorkouts: [],
  squadFeedWorkouts: [],
  followingFeedWorkouts: [],
  feedLoading: false,
  feedError: null,
  myWorkouts: [],
  myWorkoutsLoading: false,
  pendingWorkout: null,

  // Actions
  setFeedWorkouts: (feedWorkouts) => set({ feedWorkouts }),
  setSquadFeedWorkouts: (squadFeedWorkouts) => set({ squadFeedWorkouts }),
  setFollowingFeedWorkouts: (followingFeedWorkouts) =>
    set({ followingFeedWorkouts }),
  setFeedLoading: (feedLoading) => set({ feedLoading }),
  setFeedError: (feedError) => set({ feedError }),

  appendFeedWorkouts: (workouts) =>
    set((state) => ({
      feedWorkouts: [...state.feedWorkouts, ...workouts],
    })),

  setMyWorkouts: (myWorkouts) => set({ myWorkouts }),
  setMyWorkoutsLoading: (myWorkoutsLoading) => set({ myWorkoutsLoading }),

  addWorkout: (workout) =>
    set((state) => ({
      myWorkouts: [workout, ...state.myWorkouts],
    })),

  updateWorkout: (id, updates) =>
    set((state) => ({
      myWorkouts: state.myWorkouts.map((w) =>
        w.id === id ? { ...w, ...updates } : w
      ),
    })),

  deleteWorkout: (id) =>
    set((state) => ({
      myWorkouts: state.myWorkouts.filter((w) => w.id !== id),
    })),

  setPendingWorkout: (pendingWorkout) => set({ pendingWorkout }),

  updatePendingWorkout: (updates) =>
    set((state) => ({
      pendingWorkout: state.pendingWorkout
        ? { ...state.pendingWorkout, ...updates }
        : null,
    })),

  clearPendingWorkout: () => set({ pendingWorkout: null }),

  toggleReaction: (workoutId) =>
    set((state) => ({
      feedWorkouts: state.feedWorkouts.map((w) =>
        w.id === workoutId
          ? {
              ...w,
              hasUserReacted: !w.hasUserReacted,
              reactionCount: w.hasUserReacted
                ? w.reactionCount - 1
                : w.reactionCount + 1,
            }
          : w
      ),
    })),

  incrementComments: (workoutId) =>
    set((state) => ({
      feedWorkouts: state.feedWorkouts.map((w) =>
        w.id === workoutId ? { ...w, commentCount: w.commentCount + 1 } : w
      ),
    })),
}));
