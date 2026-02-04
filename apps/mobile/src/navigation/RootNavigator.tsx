import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { colors } from '../constants/theme';
import { useAuthStore } from '../stores/authStore';

import { AuthNavigator } from './AuthNavigator';
import { OnboardingNavigator } from './OnboardingNavigator';
import { MainTabNavigator } from './MainTabNavigator';

// Modal screens
import { WorkoutDetailScreen } from '../screens/WorkoutDetailScreen';
import { WorkoutEditScreen } from '../screens/WorkoutEditScreen';
import { CameraScreen } from '../screens/CameraScreen';
import { CommentsScreen } from '../screens/CommentsScreen';
import { UserProfileScreen } from '../screens/UserProfileScreen';
import { ClubDetailScreen } from '../screens/ClubDetailScreen';
import { ClubJoinRequestsScreen } from '../screens/ClubJoinRequestsScreen';
import { SquadDetailScreen } from '../screens/SquadDetailScreen';
import { ClubSearchScreen } from '../screens/ClubSearchScreen';
import { CreateClubScreen } from '../screens/CreateClubScreen';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { AthleteSearchScreen } from '../screens/AthleteSearchScreen';
import { AdminScreen } from '../screens/AdminScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const { isAuthenticated, hasCompletedOnboarding, isLoading } = useAuthStore();

  if (isLoading) {
    // Could show a splash screen here
    return null;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {!isAuthenticated ? (
        // Auth flow
        <Stack.Screen name="Auth" component={AuthNavigator} />
      ) : !hasCompletedOnboarding ? (
        // Onboarding flow
        <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      ) : (
        // Main app
        <>
          <Stack.Screen name="Main" component={MainTabNavigator} />

          {/* Modal screens */}
          <Stack.Group
            screenOptions={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          >
            <Stack.Screen name="WorkoutDetail" component={WorkoutDetailScreen} />
            <Stack.Screen name="WorkoutEdit" component={WorkoutEditScreen} />
            <Stack.Screen name="Camera" component={CameraScreen} />
            <Stack.Screen name="Comments" component={CommentsScreen} />
            <Stack.Screen name="UserProfile" component={UserProfileScreen} />
            <Stack.Screen name="ClubDetail" component={ClubDetailScreen} />
            <Stack.Screen name="ClubJoinRequests" component={ClubJoinRequestsScreen} />
            <Stack.Screen name="SquadDetail" component={SquadDetailScreen} />
            <Stack.Screen name="ClubSearch" component={ClubSearchScreen} />
            <Stack.Screen name="CreateClub" component={CreateClubScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="AthleteSearch" component={AthleteSearchScreen} />
            <Stack.Screen name="Admin" component={AdminScreen} />
          </Stack.Group>
        </>
      )}
    </Stack.Navigator>
  );
};
