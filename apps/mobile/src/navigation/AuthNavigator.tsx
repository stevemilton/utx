import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AuthStackParamList } from './types';
import { colors } from '../constants/theme';

// Import screens (we'll create these next)
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { AuthScreen } from '../screens/auth/AuthScreen';
import { PhoneAuthScreen } from '../screens/auth/PhoneAuthScreen';
import { VerifyCodeScreen } from '../screens/auth/VerifyCodeScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Auth" component={AuthScreen} />
      <Stack.Screen name="PhoneAuth" component={PhoneAuthScreen} />
      <Stack.Screen name="VerifyCode" component={VerifyCodeScreen} />
    </Stack.Navigator>
  );
};
