import { create } from 'zustand';

export interface OnboardingData {
  // Identity screen
  displayName: string;
  avatarUri: string | null;

  // Physical stats screen
  heightCm: number;
  weightKg: number;
  birthDate: string;
  gender: 'male' | 'female' | 'prefer_not_to_say' | null;

  // HR setup screen
  maxHr: number;
}

interface OnboardingState {
  data: OnboardingData;

  // Actions
  setIdentity: (name: string, avatarUri: string | null) => void;
  setPhysicalStats: (stats: {
    heightCm: number;
    weightKg: number;
    birthDate: string;
    gender: 'male' | 'female' | 'prefer_not_to_say';
  }) => void;
  setMaxHr: (maxHr: number) => void;
  reset: () => void;
  getData: () => OnboardingData;
}

const initialData: OnboardingData = {
  displayName: '',
  avatarUri: null,
  heightCm: 0,
  weightKg: 0,
  birthDate: '',
  gender: null,
  maxHr: 0,
};

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  data: { ...initialData },

  setIdentity: (displayName, avatarUri) =>
    set((state) => ({
      data: { ...state.data, displayName, avatarUri },
    })),

  setPhysicalStats: (stats) =>
    set((state) => ({
      data: { ...state.data, ...stats },
    })),

  setMaxHr: (maxHr) =>
    set((state) => ({
      data: { ...state.data, maxHr },
    })),

  reset: () => set({ data: { ...initialData } }),

  getData: () => get().data,
}));
