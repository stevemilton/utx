import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from './types';
import { colors } from '../constants/theme';

// Import screens
import { ConsentScreen } from '../screens/onboarding/ConsentScreen';
import { ProfileIdentityScreen } from '../screens/onboarding/ProfileIdentityScreen';
import { ProfilePhysicalScreen } from '../screens/onboarding/ProfilePhysicalScreen';
import { HRSetupScreen } from '../screens/onboarding/HRSetupScreen';
import { JoinClubScreen } from '../screens/onboarding/JoinClubScreen';
import { TutorialScreen } from '../screens/onboarding/TutorialScreen';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export const OnboardingNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Consent" component={ConsentScreen} />
      <Stack.Screen name="ProfileIdentity" component={ProfileIdentityScreen} />
      <Stack.Screen name="ProfilePhysical" component={ProfilePhysicalScreen} />
      <Stack.Screen name="HRSetup" component={HRSetupScreen} />
      <Stack.Screen name="JoinClub" component={JoinClubScreen} />
      <Stack.Screen name="Tutorial" component={TutorialScreen} />
    </Stack.Navigator>
  );
};
