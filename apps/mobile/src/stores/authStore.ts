import { create } from 'zustand';
import { createJSONStorage, persist, StateStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserProfile {
  id: string;
  username?: string;
  name: string;
  avatarUrl?: string;
  heightCm: number;
  weightKg: number;
  birthDate: string;
  gender: 'male' | 'female' | 'prefer_not_to_say';
  maxHr: number;
  restingHr?: number; // Optional, defaults to 50 if not provided
  stravaConnected: boolean;
  isPublic: boolean;
}

interface AuthState {
  // State
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasCompletedOnboarding: boolean;

  // Actions
  setUser: (user: UserProfile | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  setOnboardingComplete: (complete: boolean) => void;
  setHasCompletedOnboarding: (complete: boolean) => void;
  login: (user: UserProfile, token: string) => void;
  logout: () => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
}

// Secure storage adapter for sensitive data (token)
// Uses SecureStore for the token, AsyncStorage for non-sensitive data
const secureStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      // Get the main state from AsyncStorage
      const value = await AsyncStorage.getItem(name);
      if (!value) return null;

      const state = JSON.parse(value);

      // Get the token from SecureStore
      const token = await SecureStore.getItemAsync('utx-auth-token');
      if (token) {
        state.state.token = token;
      }

      return JSON.stringify(state);
    } catch (error) {
      console.error('Error reading auth state:', error);
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      const state = JSON.parse(value);
      const token = state.state?.token;

      // Store token securely in SecureStore
      if (token) {
        await SecureStore.setItemAsync('utx-auth-token', token);
        // Remove token from the state that goes to AsyncStorage
        state.state.token = null;
      } else {
        // Clear token from SecureStore if not present
        await SecureStore.deleteItemAsync('utx-auth-token');
      }

      // Store non-sensitive data in AsyncStorage
      await AsyncStorage.setItem(name, JSON.stringify(state));
    } catch (error) {
      console.error('Error saving auth state:', error);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(name);
      await SecureStore.deleteItemAsync('utx-auth-token');
    } catch (error) {
      console.error('Error removing auth state:', error);
    }
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      hasCompletedOnboarding: false,

      // Actions
      setUser: (user) => set({ user, isAuthenticated: !!user }),

      setToken: (token) => set({ token }),

      setLoading: (isLoading) => set({ isLoading }),

      setOnboardingComplete: (hasCompletedOnboarding) =>
        set({ hasCompletedOnboarding }),

      setHasCompletedOnboarding: (hasCompletedOnboarding) =>
        set({ hasCompletedOnboarding }),

      login: (user, token) =>
        set({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
        }),

      logout: async () => {
        // Clear secure storage on logout
        try {
          await SecureStore.deleteItemAsync('utx-auth-token');
        } catch (error) {
          console.error('Error clearing secure token:', error);
        }
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          hasCompletedOnboarding: false,
        });
      },

      updateProfile: (updates) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, ...updates } });
        }
      },
    }),
    {
      name: 'utx-auth-storage',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
      }),
    }
  )
);
