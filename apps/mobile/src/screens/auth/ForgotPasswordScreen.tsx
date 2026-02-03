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
import { api } from '../../services/api';
import { validateEmail } from '../../utils/validation';
import type { AuthScreenProps } from '../../navigation/types';

export const ForgotPasswordScreen: React.FC = () => {
  const navigation = useNavigation<AuthScreenProps<'ForgotPassword'>['navigation']>();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSendResetLink = async () => {
    const emailErr = validateEmail(email);
    setEmailError(emailErr);

    if (emailErr) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.requestPasswordReset(email.trim().toLowerCase());

      if (response.success) {
        setEmailSent(true);
      } else {
        // Still show success to prevent email enumeration
        setEmailSent(true);
      }
    } catch (error) {
      console.error('Password reset error:', error);
      // Still show success to prevent email enumeration
      setEmailSent(true);
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.content}>
          {/* Success Icon */}
          <View style={styles.iconContainer}>
            <Ionicons name="checkmark-circle-outline" size={64} color={colors.success} />
          </View>

          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            If an account exists for {email}, you will receive a password reset link shortly.
          </Text>

          <Text style={styles.instructions}>
            The link will expire in 1 hour. If you don't see the email, check your spam folder.
          </Text>

          {/* Back to Login Button */}
          <View style={styles.buttonContainer}>
            <Button
              title="Back to Login"
              onPress={() => navigation.navigate('EmailLogin')}
              variant="primary"
              size="lg"
              fullWidth
            />
          </View>

          {/* Try Again Link */}
          <TouchableOpacity
            style={styles.tryAgainButton}
            onPress={() => setEmailSent(false)}
          >
            <Text style={styles.tryAgainText}>Try a different email</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
          <Text style={styles.title}>Reset password</Text>
          <Text style={styles.subtitle}>
            Enter your email address and we'll send you a link to reset your password.
          </Text>

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

          {/* Send Reset Link Button */}
          <View style={styles.buttonContainer}>
            <Button
              title="Send Reset Link"
              onPress={handleSendResetLink}
              loading={isLoading}
              disabled={isLoading}
              variant="primary"
              size="lg"
              fullWidth
            />
          </View>

          {/* Back to Login Link */}
          <View style={styles.loginLink}>
            <Text style={styles.loginText}>Remember your password? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('EmailLogin')}>
              <Text style={styles.loginLinkText}>Log in</Text>
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
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.successSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.xl,
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
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  instructions: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.md,
  },
  buttonContainer: {
    marginTop: spacing.xl,
  },
  loginLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  loginText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  loginLinkText: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  tryAgainButton: {
    marginTop: spacing.lg,
    padding: spacing.sm,
    alignSelf: 'center',
  },
  tryAgainText: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
});
