import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Button } from '../../components';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../../constants/theme';
import { useAuthStore } from '../../stores/authStore';
import { firebaseAuth } from '../../services/firebase';
import { api } from '../../services/api';
import type { AuthScreenProps } from '../../navigation/types';

const CODE_LENGTH = 6;

export const VerifyCodeScreen: React.FC = () => {
  const navigation = useNavigation<AuthScreenProps<'VerifyCode'>['navigation']>();
  const route = useRoute<AuthScreenProps<'VerifyCode'>['route']>();
  const { phoneNumber } = route.params;

  const { login, setHasCompletedOnboarding } = useAuthStore();
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Cooldown timer for resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleCodeChange = (text: string) => {
    // Only allow numbers
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH);
    setCode(cleaned);

    // Auto-submit when complete
    if (cleaned.length === CODE_LENGTH) {
      handleVerify(cleaned);
    }
  };

  const handleVerify = async (verificationCode: string = code) => {
    if (verificationCode.length !== CODE_LENGTH) {
      Alert.alert('Invalid Code', 'Please enter the 6-digit code');
      return;
    }

    try {
      setIsLoading(true);

      // Verify the code with Firebase (verificationId is stored in the service)
      const result = await firebaseAuth.verifyPhoneCode(verificationCode);

      if (result.success && result.token) {
        // Register/login with our backend
        const response = await api.register({
          firebaseToken: result.token,
          provider: 'apple', // Phone auth would need its own provider type
          name: '',
          heightCm: 0,
          weightKg: 0,
          birthDate: '',
          gender: '',
          maxHr: 0,
        });

        if (response.success && response.data) {
          const { user, token: backendToken } = response.data as any;

          // Store auth state - use the backend's token
          login(user, backendToken || result.token);

          // If existing user with completed profile, skip onboarding
          if (!result.isNewUser && user.hasCompletedOnboarding) {
            setHasCompletedOnboarding(true);
          }
          // Otherwise, navigation will direct to onboarding
        } else {
          Alert.alert('Error', response.error || 'Failed to complete sign in');
        }
      } else {
        Alert.alert('Error', result.error || 'Invalid verification code');
        setCode('');
      }
    } catch (error) {
      Alert.alert('Error', 'Verification failed. Please try again.');
      console.error('Verification error:', error);
      setCode('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;

    try {
      setIsResending(true);

      const result = await firebaseAuth.sendPhoneVerificationCode(phoneNumber);

      if (result.success) {
        Alert.alert('Code Sent', 'A new verification code has been sent to your phone.');
        setResendCooldown(60); // 60 second cooldown
        setCode('');
      } else {
        Alert.alert('Error', result.error || 'Failed to resend code');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to resend code. Please try again.');
      console.error('Resend error:', error);
    } finally {
      setIsResending(false);
    }
  };

  const renderCodeBoxes = () => {
    const boxes = [];
    for (let i = 0; i < CODE_LENGTH; i++) {
      const char = code[i] || '';
      const isFilled = char !== '';
      const isActive = i === code.length;

      boxes.push(
        <View
          key={i}
          style={[
            styles.codeBox,
            isFilled && styles.codeBoxFilled,
            isActive && styles.codeBoxActive,
          ]}
        >
          <Text style={styles.codeChar}>{char}</Text>
        </View>
      );
    }
    return boxes;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>Enter verification code</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to {phoneNumber}
        </Text>

        {/* Hidden input for keyboard */}
        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          value={code}
          onChangeText={handleCodeChange}
          keyboardType="number-pad"
          maxLength={CODE_LENGTH}
          autoFocus
        />

        {/* Visible code boxes */}
        <TouchableOpacity
          style={styles.codeContainer}
          onPress={() => inputRef.current?.focus()}
          activeOpacity={1}
        >
          {renderCodeBoxes()}
        </TouchableOpacity>

        <Button
          title="Verify"
          onPress={() => handleVerify()}
          loading={isLoading}
          disabled={code.length !== CODE_LENGTH || isLoading}
          variant="primary"
          size="lg"
          fullWidth
        />

        <TouchableOpacity
          style={styles.resendButton}
          onPress={handleResend}
          disabled={resendCooldown > 0 || isResending}
        >
          <Text style={styles.resendText}>
            Didn't receive the code?{' '}
            <Text style={[styles.resendLink, resendCooldown > 0 && styles.resendDisabled]}>
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend'}
            </Text>
          </Text>
        </TouchableOpacity>
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
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 0,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xxl,
    gap: spacing.sm,
  },
  codeBox: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 52,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBoxFilled: {
    borderColor: colors.primary,
  },
  codeBoxActive: {
    borderColor: colors.primary,
    backgroundColor: colors.backgroundTertiary,
  },
  codeChar: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  resendButton: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  resendText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  resendLink: {
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  resendDisabled: {
    color: colors.textTertiary,
  },
});
