import { create } from 'zustand';

export interface ConsentData {
  termsAccepted: boolean;
  privacyAccepted: boolean;
  marketingOptIn: boolean;
  analyticsOptIn: boolean;
  coachSharingOptIn: boolean;
}

export interface OnboardingData {
  // Consent screen
  consents: ConsentData;

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
  restingHr?: number; // Optional, improves effort score accuracy
}

interface OnboardingState {
  data: OnboardingData;

  // Actions
  setConsents: (consents: ConsentData) => void;
  setCoachSharingOptIn: (optIn: boolean) => void;
  setIdentity: (name: string, avatarUri: string | null) => void;
  setPhysicalStats: (stats: {
    heightCm: number;
    weightKg: number;
    birthDate: string;
    gender: 'male' | 'female' | 'prefer_not_to_say';
  }) => void;
  setMaxHr: (maxHr: number) => void;
  setRestingHr: (restingHr: number | undefined) => void;
  setHrData: (maxHr: number, restingHr?: number) => void;
  reset: () => void;
  getData: () => OnboardingData;
}

const initialConsents: ConsentData = {
  termsAccepted: false,
  privacyAccepted: false,
  marketingOptIn: false,
  analyticsOptIn: false,
  coachSharingOptIn: false,
};

const initialData: OnboardingData = {
  consents: { ...initialConsents },
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

  setConsents: (consents) =>
    set((state) => ({
      data: { ...state.data, consents },
    })),

  setCoachSharingOptIn: (optIn) =>
    set((state) => ({
      data: {
        ...state.data,
        consents: { ...state.data.consents, coachSharingOptIn: optIn },
      },
    })),

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

  setRestingHr: (restingHr) =>
    set((state) => ({
      data: { ...state.data, restingHr },
    })),

  setHrData: (maxHr, restingHr) =>
    set((state) => ({
      data: { ...state.data, maxHr, restingHr },
    })),

  reset: () => set({ data: { ...initialData } }),

  getData: () => get().data,
}));
