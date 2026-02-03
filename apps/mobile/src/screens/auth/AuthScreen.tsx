import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../../constants/theme';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';
import { firebaseAuth } from '../../services/firebase';
import type { AuthScreenProps } from '../../navigation/types';

// Check if running in development mode (Expo Go or dev client)
const isDev = __DEV__;

// Required for expo-auth-session
WebBrowser.maybeCompleteAuthSession();

export const AuthScreen: React.FC = () => {
  const navigation = useNavigation<AuthScreenProps<'Auth'>['navigation']>();
  const { login, setHasCompletedOnboarding } = useAuthStore();
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Google OAuth configuration
  const googleConfig = firebaseAuth.getGoogleAuthConfig();
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: googleConfig.iosClientId,
    webClientId: googleConfig.webClientId,
  });

  // Handle Google OAuth response
  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      handleGoogleToken(id_token);
    } else if (response?.type === 'error') {
      setIsGoogleLoading(false);
      Alert.alert('Error', 'Google Sign In failed. Please try again.');
    } else if (response?.type === 'dismiss') {
      setIsGoogleLoading(false);
    }
  }, [response]);

  const handleGoogleToken = async (idToken: string) => {
    try {
      // Send the Google token directly to our backend
      await handleAuthSuccess(
        idToken,
        'google',
        true, // isNewUser - backend will determine
        undefined,
        undefined
      );
    } catch (error) {
      Alert.alert('Error', 'Google Sign In failed. Please try again.');
      console.error('Google Sign In error:', error);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleAuthSuccess = async (
    token: string,
    provider: 'apple' | 'google',
    isNewUser: boolean,
    displayName?: string,
    email?: string
  ) => {
    try {
      // Register/login with our backend - send the provider token directly
      const response = await api.register({
        firebaseToken: token, // This is actually the Apple/Google token now
        provider,
        name: displayName || '',
        email: email || '',
        heightCm: 0, // Will be set in onboarding
        weightKg: 0,
        birthDate: '',
        gender: '',
        maxHr: 0,
      });

      if (response.success && response.data) {
        const { user, token: backendToken } = response.data as any;

        // Store auth state - use the backend's token
        login(user, backendToken || token);

        // If existing user with completed profile, skip onboarding
        if (!isNewUser && user.hasCompletedOnboarding) {
          setHasCompletedOnboarding(true);
        }
        // Otherwise, they'll be directed to onboarding via navigation state
      } else {
        Alert.alert('Error', response.error || 'Failed to complete sign in');
      }
    } catch (error) {
      console.error('Backend registration error:', error);
      Alert.alert('Error', 'Failed to complete sign in. Please try again.');
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setIsAppleLoading(true);

      const result = await firebaseAuth.signInWithApple();

      if (result.success && result.token) {
        await handleAuthSuccess(
          result.token,
          'apple',
          result.isNewUser ?? true,
          result.displayName,
          result.email
        );
      } else if (result.error && result.error !== 'Sign in cancelled') {
        Alert.alert('Error', result.error);
      }
    } catch (error: any) {
      console.error('Apple Sign In error:', error);
      Alert.alert('Error', 'Apple Sign In failed. Please try again.');
    } finally {
      setIsAppleLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    // This triggers the OAuth flow via expo-auth-session
    // The response is handled in the useEffect above
    promptAsync();
  };

  // Phone auth is disabled in Expo managed workflow - see CLAUDE.md

  // Dev-only login for Simulator testing
  const handleDevLogin = async () => {
    if (!isDev) return;

    const devUser = {
      id: 'dev-user-001',
      name: 'Dev User',
      username: 'devuser',
      avatarUrl: undefined,
      heightCm: 185,
      weightKg: 85,
      birthDate: '1990-01-01',
      gender: 'male' as const,
      maxHr: 185,
      stravaConnected: false,
      isPublic: true,
    };

    // Login with mock data - skip backend in dev
    login(devUser, 'dev-token-12345');
    setHasCompletedOnboarding(true); // Skip onboarding for faster dev testing
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>
          Sign in to start tracking your erg sessions
        </Text>

        {/* Auth buttons */}
        <View style={styles.authButtons}>
          {/* Apple Sign In (iOS only) */}
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={styles.appleButtonContainer}
              onPress={handleAppleSignIn}
              disabled={isAppleLoading}
            >
              {isAppleLoading ? (
                <View style={styles.loadingButton}>
                  <ActivityIndicator color={colors.background} />
                </View>
              ) : (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                  cornerRadius={borderRadius.lg}
                  style={styles.appleButton}
                  onPress={handleAppleSignIn}
                />
              )}
            </TouchableOpacity>
          )}

          {/* Google Sign In */}
          <TouchableOpacity
            style={styles.socialButton}
            onPress={handleGoogleSignIn}
            disabled={!request || isGoogleLoading}
          >
            {isGoogleLoading ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <>
                <View style={styles.socialIconPlaceholder}>
                  <Text style={styles.socialIconText}>G</Text>
                </View>
                <Text style={styles.socialButtonText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email Sign In */}
          <TouchableOpacity
            style={styles.socialButton}
            onPress={() => navigation.navigate('EmailSignup')}
          >
            <View style={styles.socialIconPlaceholder}>
              <Ionicons name="mail-outline" size={18} color={colors.textPrimary} />
            </View>
            <Text style={styles.socialButtonText}>Continue with Email</Text>
          </TouchableOpacity>

          {/* Already have account - Login link */}
          <View style={styles.loginLinkContainer}>
            <Text style={styles.loginLinkText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('EmailLogin')}>
              <Text style={styles.loginLinkAction}>Log in</Text>
            </TouchableOpacity>
          </View>

          {/* Dev Login - Only visible in development mode */}
          {isDev && (
            <TouchableOpacity
              style={[styles.socialButton, styles.devButton]}
              onPress={handleDevLogin}
            >
              <View style={styles.devIconContainer}>
                <Ionicons name="code-slash" size={18} color={colors.white} />
              </View>
              <Text style={styles.devButtonText}>Dev Login (Simulator)</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Terms */}
        <Text style={styles.terms}>
          By continuing, you agree to our{' '}
          <Text style={styles.link}>Terms of Service</Text> and{' '}
          <Text style={styles.link}>Privacy Policy</Text>
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  backButton: {
    marginBottom: spacing.lg,
  },
  backText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.xxl,
  },
  authButtons: {
    gap: spacing.md,
  },
  appleButtonContainer: {
    height: 56,
    width: '100%',
  },
  appleButton: {
    height: 56,
    width: '100%',
  },
  loadingButton: {
    height: 56,
    width: '100%',
    backgroundColor: colors.textPrimary,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    height: 56,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  phoneButton: {
    backgroundColor: colors.backgroundTertiary,
    borderColor: colors.border,
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledButtonText: {
    color: colors.textTertiary,
  },
  socialIconPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialIconText: {
    fontSize: 14,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  socialButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  terms: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.xxl,
    lineHeight: 20,
  },
  link: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  devButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    marginTop: spacing.lg,
  },
  devIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  devButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.white,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    marginHorizontal: spacing.md,
    color: colors.textTertiary,
    fontSize: fontSize.sm,
  },
  loginLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  loginLinkText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  loginLinkAction: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
});
