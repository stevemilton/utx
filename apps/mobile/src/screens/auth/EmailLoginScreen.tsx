import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input } from '../../components';
import { colors, spacing, fontSize, fontWeight } from '../../constants/theme';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';
import { validateEmail } from '../../utils/validation';
import type { AuthScreenProps } from '../../navigation/types';

export const EmailLoginScreen: React.FC = () => {
  const navigation = useNavigation<AuthScreenProps<'EmailLogin'>['navigation']>();
  const { login, setHasCompletedOnboarding } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Validation errors
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleLogin = async () => {
    // Basic validation
    const emailErr = validateEmail(email);
    const passwordErr = !password ? 'Password is required' : null;

    setEmailError(emailErr);
    setPasswordError(passwordErr);

    if (emailErr || passwordErr) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.loginWithEmail(email.trim().toLowerCase(), password);

      if (response.success && response.data) {
        const { user, token } = response.data;

        // Store auth state
        login(user as any, token);

        // Check if user has completed onboarding
        if ((user as any).hasCompletedOnboarding) {
          setHasCompletedOnboarding(true);
        }
      } else {
        // Handle specific error codes
        if ((response as any).code === 'EMAIL_NOT_VERIFIED') {
          Alert.alert(
            'Email Not Verified',
            'Please verify your email before logging in. Check your inbox for the verification link.',
            [
              { text: 'OK' },
              {
                text: 'Resend Email',
                onPress: () => navigation.navigate('VerifyEmail', { email: email.trim().toLowerCase() }),
              },
            ]
          );
        } else {
          Alert.alert('Login Failed', response.error || 'Invalid email or password');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.content}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Log in with your email</Text>

          {/* Email Input */}
          <Input
            label="Email"
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            error={emailError || undefined}
            onBlur={() => setEmailError(validateEmail(email))}
          />

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Input
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              error={passwordError || undefined}
              rightIcon={
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textTertiary}
                />
              }
              onRightIconPress={() => setShowPassword(!showPassword)}
            />
          </View>

          {/* Forgot Password Link */}
          <TouchableOpacity
            style={styles.forgotPassword}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <View style={styles.buttonContainer}>
            <Button
              title="Log In"
              onPress={handleLogin}
              loading={isLoading}
              disabled={isLoading}
              variant="primary"
              size="lg"
              fullWidth
            />
          </View>

          {/* Sign Up Link */}
          <View style={styles.signupLink}>
            <Text style={styles.signupText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('EmailSignup')}>
              <Text style={styles.signupLinkText}>Sign up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  backButton: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
    paddingTop: 0,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  inputContainer: {
    marginTop: spacing.md,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: spacing.sm,
  },
  forgotPasswordText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  buttonContainer: {
    marginTop: spacing.xl,
  },
  signupLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  signupText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  signupLinkText: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
});
