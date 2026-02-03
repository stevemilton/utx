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
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input } from '../../components';
import { colors, spacing, fontSize, fontWeight } from '../../constants/theme';
import { api } from '../../services/api';
import { validatePassword, validateConfirmPassword, getPasswordStrength } from '../../utils/validation';
import type { AuthScreenProps } from '../../navigation/types';

export const ResetPasswordScreen: React.FC = () => {
  const navigation = useNavigation<AuthScreenProps<'ResetPassword'>['navigation']>();
  const route = useRoute<AuthScreenProps<'ResetPassword'>['route']>();
  const { token } = route.params;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Validation errors
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);

  const passwordStrength = getPasswordStrength(password);

  const handleResetPassword = async () => {
    const passwordErr = validatePassword(password);
    const confirmErr = validateConfirmPassword(password, confirmPassword);

    setPasswordError(passwordErr);
    setConfirmPasswordError(confirmErr);

    if (passwordErr || confirmErr) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.resetPassword(token, password);

      if (response.success) {
        setIsSuccess(true);
      } else {
        if (response.error?.includes('expired')) {
          Alert.alert(
            'Link Expired',
            'This password reset link has expired. Please request a new one.',
            [
              { text: 'OK', onPress: () => navigation.navigate('ForgotPassword') },
            ]
          );
        } else {
          Alert.alert('Error', response.error || 'Failed to reset password. Please try again.');
        }
      }
    } catch (error) {
      console.error('Reset password error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          {/* Success Icon */}
          <View style={styles.iconContainer}>
            <Ionicons name="checkmark-circle" size={64} color={colors.success} />
          </View>

          <Text style={styles.title}>Password changed!</Text>
          <Text style={styles.subtitle}>
            Your password has been reset successfully. You can now log in with your new password.
          </Text>

          {/* Login Button */}
          <View style={styles.buttonContainer}>
            <Button
              title="Log In"
              onPress={() => navigation.navigate('EmailLogin')}
              variant="primary"
              size="lg"
              fullWidth
            />
          </View>
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
          <Text style={styles.title}>Create new password</Text>
          <Text style={styles.subtitle}>
            Your new password must be different from your previous password.
          </Text>

          {/* New Password Input */}
          <Input
            label="New Password"
            placeholder="Enter new password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            error={passwordError || undefined}
            onBlur={() => setPasswordError(validatePassword(password))}
            rightIcon={
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.textTertiary}
              />
            }
            onRightIconPress={() => setShowPassword(!showPassword)}
          />

          {/* Password Requirements */}
          <View style={styles.requirements}>
            <RequirementItem met={passwordStrength.hasMinLength} text="At least 8 characters" />
            <RequirementItem met={passwordStrength.hasUppercase} text="One uppercase letter" />
            <RequirementItem met={passwordStrength.hasLowercase} text="One lowercase letter" />
            <RequirementItem met={passwordStrength.hasNumber} text="One number" />
          </View>

          {/* Confirm Password Input */}
          <View style={styles.inputContainer}>
            <Input
              label="Confirm New Password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              error={confirmPasswordError || undefined}
              onBlur={() => setConfirmPasswordError(validateConfirmPassword(password, confirmPassword))}
              rightIcon={
                <Ionicons
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textTertiary}
                />
              }
              onRightIconPress={() => setShowConfirmPassword(!showConfirmPassword)}
            />
          </View>

          {/* Reset Password Button */}
          <View style={styles.buttonContainer}>
            <Button
              title="Reset Password"
              onPress={handleResetPassword}
              loading={isLoading}
              disabled={isLoading}
              variant="primary"
              size="lg"
              fullWidth
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// Password requirement indicator
const RequirementItem: React.FC<{ met: boolean; text: string }> = ({ met, text }) => (
  <View style={styles.requirementRow}>
    <Ionicons
      name={met ? 'checkmark-circle' : 'ellipse-outline'}
      size={16}
      color={met ? colors.success : colors.textTertiary}
    />
    <Text style={[styles.requirementText, met && styles.requirementMet]}>{text}</Text>
  </View>
);

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
    marginTop: spacing.xxl,
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
  inputContainer: {
    marginTop: spacing.md,
  },
  requirements: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  requirementText: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
  },
  requirementMet: {
    color: colors.success,
  },
  buttonContainer: {
    marginTop: spacing.xl,
  },
});
