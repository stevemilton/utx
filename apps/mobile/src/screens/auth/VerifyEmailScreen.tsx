import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../../constants/theme';
import { api } from '../../services/api';
import type { AuthScreenProps } from '../../navigation/types';

export const VerifyEmailScreen: React.FC = () => {
  const navigation = useNavigation<AuthScreenProps<'VerifyEmail'>['navigation']>();
  const route = useRoute<AuthScreenProps<'VerifyEmail'>['route']>();
  const { email } = route.params;

  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const handleResendEmail = async () => {
    if (resendCooldown > 0) return;

    setIsResending(true);

    try {
      const response = await api.resendVerificationEmail(email);

      if (response.success) {
        Alert.alert('Email Sent', 'A new verification email has been sent.');
        // Start cooldown timer
        setResendCooldown(60);
        const interval = setInterval(() => {
          setResendCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(interval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        Alert.alert('Error', response.error || 'Failed to resend email. Please try again.');
      }
    } catch (error) {
      console.error('Resend verification error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleOpenEmail = () => {
    // Try to open the default email app
    Linking.openURL('mailto:');
  };

  const handleUseDifferentEmail = () => {
    navigation.navigate('EmailSignup');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
      </TouchableOpacity>

      <View style={styles.content}>
        {/* Email Icon */}
        <View style={styles.iconContainer}>
          <Ionicons name="mail-outline" size={64} color={colors.primary} />
        </View>

        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          We've sent a verification link to
        </Text>
        <Text style={styles.email}>{email}</Text>

        <Text style={styles.instructions}>
          Click the link in the email to verify your account and complete registration.
        </Text>

        {/* Open Email Button */}
        <View style={styles.buttonContainer}>
          <Button
            title="Open Email App"
            onPress={handleOpenEmail}
            variant="primary"
            size="lg"
            fullWidth
          />
        </View>

        {/* Resend Email */}
        <TouchableOpacity
          style={styles.resendButton}
          onPress={handleResendEmail}
          disabled={isResending || resendCooldown > 0}
        >
          <Text style={[
            styles.resendText,
            (isResending || resendCooldown > 0) && styles.resendTextDisabled
          ]}>
            {isResending
              ? 'Sending...'
              : resendCooldown > 0
              ? `Resend email in ${resendCooldown}s`
              : "Didn't receive the email? Resend"}
          </Text>
        </TouchableOpacity>

        {/* Use Different Email */}
        <TouchableOpacity
          style={styles.differentEmailButton}
          onPress={handleUseDifferentEmail}
        >
          <Text style={styles.differentEmailText}>Use a different email</Text>
        </TouchableOpacity>

        {/* Help Text */}
        <View style={styles.helpContainer}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textTertiary} />
          <Text style={styles.helpText}>
            Check your spam folder if you don't see the email in your inbox.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backButton: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  email: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  instructions: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.lg,
  },
  buttonContainer: {
    width: '100%',
    marginTop: spacing.xxl,
  },
  resendButton: {
    marginTop: spacing.lg,
    padding: spacing.sm,
  },
  resendText: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  resendTextDisabled: {
    color: colors.textTertiary,
  },
  differentEmailButton: {
    marginTop: spacing.md,
    padding: spacing.sm,
  },
  differentEmailText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  helpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  helpText: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    flex: 1,
  },
});
