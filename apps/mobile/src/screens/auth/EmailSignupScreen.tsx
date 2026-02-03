import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input } from '../../components';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../../constants/theme';
import { api } from '../../services/api';
import {
  validateEmail,
  validatePassword,
  validateConfirmPassword,
  validateName,
  getPasswordStrength,
} from '../../utils/validation';
import type { AuthScreenProps } from '../../navigation/types';

export const EmailSignupScreen: React.FC = () => {
  const navigation = useNavigation<AuthScreenProps<'EmailSignup'>['navigation']>();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Validation errors (shown on blur or submit)
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);

  const passwordStrength = getPasswordStrength(password);

  const handleSignup = async () => {
    // Validate all fields
    const nameErr = validateName(name);
    const emailErr = validateEmail(email);
    const passwordErr = validatePassword(password);
    const confirmErr = validateConfirmPassword(password, confirmPassword);

    setNameError(nameErr);
    setEmailError(emailErr);
    setPasswordError(passwordErr);
    setConfirmPasswordError(confirmErr);

    if (nameErr || emailErr || passwordErr || confirmErr) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.registerWithEmail({
        email: email.trim().toLowerCase(),
        password,
        name: name.trim(),
      });

      if (response.success) {
        // Navigate to verify email screen
        navigation.navigate('VerifyEmail', { email: email.trim().toLowerCase() });
      } else {
        Alert.alert('Registration Failed', response.error || 'Please try again.');
      }
    } catch (error) {
      console.error('Signup error:', error);
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

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Sign up with your email address</Text>

          {/* Name Input */}
          <Input
            label="Name"
            placeholder="Enter your name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            error={nameError || undefined}
            onBlur={() => setNameError(validateName(name))}
          />

          {/* Email Input */}
          <View style={styles.inputContainer}>
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
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Input
              label="Password"
              placeholder="Create a password"
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
          </View>

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
              label="Confirm Password"
              placeholder="Confirm your password"
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

          {/* Sign Up Button */}
          <View style={styles.buttonContainer}>
            <Button
              title="Sign Up"
              onPress={handleSignup}
              loading={isLoading}
              disabled={isLoading}
              variant="primary"
              size="lg"
              fullWidth
            />
          </View>

          {/* Login Link */}
          <View style={styles.loginLink}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('EmailLogin')}>
              <Text style={styles.loginLinkText}>Log in</Text>
            </TouchableOpacity>
          </View>

          {/* Terms */}
          <Text style={styles.terms}>
            By signing up, you agree to our{' '}
            <Text style={styles.link}>Terms of Service</Text> and{' '}
            <Text style={styles.link}>Privacy Policy</Text>
          </Text>
        </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
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
  terms: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.xl,
    lineHeight: 20,
  },
  link: {
    color: colors.primary,
  },
});
