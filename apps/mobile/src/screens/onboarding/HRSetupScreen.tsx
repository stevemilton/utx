import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input } from '../../components';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../../constants/theme';
import { useOnboardingStore } from '../../stores/onboardingStore';
import type { OnboardingScreenProps } from '../../navigation/types';

export const HRSetupScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingScreenProps<'HRSetup'>['navigation']>();
  const { setHrData, data: onboardingData } = useOnboardingStore();
  const [knowsMaxHR, setKnowsMaxHR] = useState<boolean | null>(null);
  const [maxHR, setMaxHR] = useState('');
  const [restingHR, setRestingHR] = useState('');
  const [showRestingHr, setShowRestingHr] = useState(false);

  // Calculate estimated max HR from birth date
  const calculateEstimatedMaxHR = () => {
    if (onboardingData.birthDate) {
      const birthDate = new Date(onboardingData.birthDate);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      return Math.max(150, 220 - age);
    }
    return 190; // Default fallback
  };

  const estimatedMaxHR = calculateEstimatedMaxHR();

  const handleContinue = () => {
    const finalMaxHR = knowsMaxHR && maxHR ? parseInt(maxHR) : estimatedMaxHR;
    const finalRestingHR = restingHR ? parseInt(restingHR) : undefined;
    // Save to onboarding store
    setHrData(finalMaxHR, finalRestingHR);
    navigation.navigate('JoinClub');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.progress}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '66.66%' }]} />
            </View>
            <Text style={styles.progressText}>4 of 6</Text>
          </View>

          <View style={styles.content}>
            <Text style={styles.title}>Heart rate setup</Text>
            <Text style={styles.subtitle}>
              Your heart rate data helps us calculate accurate effort scores using
              the UTx algorithm
            </Text>

            <Text style={styles.question}>Do you know your maximum heart rate?</Text>

            {/* Options */}
            <View style={styles.options}>
              <TouchableOpacity
                style={[styles.optionButton, knowsMaxHR === true && styles.optionButtonActive]}
                onPress={() => setKnowsMaxHR(true)}
              >
                <View style={styles.optionContent}>
                  <Text
                    style={[
                      styles.optionText,
                      knowsMaxHR === true && styles.optionTextActive,
                    ]}
                  >
                    Yes, I know it
                  </Text>
                  <Text style={styles.optionHint}>Enter your tested max HR</Text>
                </View>
                <View
                  style={[styles.radio, knowsMaxHR === true && styles.radioActive]}
                >
                  {knowsMaxHR === true && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.optionButton, knowsMaxHR === false && styles.optionButtonActive]}
                onPress={() => setKnowsMaxHR(false)}
              >
                <View style={styles.optionContent}>
                  <Text
                    style={[
                      styles.optionText,
                      knowsMaxHR === false && styles.optionTextActive,
                    ]}
                  >
                    No / Not sure
                  </Text>
                  <Text style={styles.optionHint}>
                    We'll estimate from your age and refine as you train
                  </Text>
                </View>
                <View
                  style={[styles.radio, knowsMaxHR === false && styles.radioActive]}
                >
                  {knowsMaxHR === false && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>
            </View>

            {/* Max HR input (if known) */}
            {knowsMaxHR === true && (
              <View style={styles.hrInput}>
                <Input
                  label="Maximum Heart Rate"
                  placeholder="e.g., 195"
                  value={maxHR}
                  onChangeText={setMaxHR}
                  keyboardType="numeric"
                  helper="bpm"
                />
              </View>
            )}

            {/* Estimation info (if not known) */}
            {knowsMaxHR === false && (
              <View style={styles.estimateInfo}>
                <Text style={styles.estimateTitle}>Estimated Max HR</Text>
                <Text style={styles.estimateValue}>{estimatedMaxHR} bpm</Text>
                <Text style={styles.estimateNote}>
                  Based on your age. This will automatically adjust if we see higher
                  readings during your workouts.
                </Text>
              </View>
            )}

            {/* Resting HR Section (Optional) */}
            {knowsMaxHR !== null && (
              <View style={styles.restingHrSection}>
                <TouchableOpacity
                  style={styles.optionalHeader}
                  onPress={() => setShowRestingHr(!showRestingHr)}
                >
                  <View style={styles.optionalHeaderContent}>
                    <Ionicons
                      name="heart-outline"
                      size={20}
                      color={colors.primary}
                    />
                    <Text style={styles.optionalTitle}>
                      Resting Heart Rate (Good for accurate data)
                    </Text>
                  </View>
                  <Ionicons
                    name={showRestingHr ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={colors.textTertiary}
                  />
                </TouchableOpacity>

                {showRestingHr && (
                  <View style={styles.restingHrContent}>
                    <Input
                      label="Resting Heart Rate"
                      placeholder="e.g., 52"
                      value={restingHR}
                      onChangeText={setRestingHR}
                      keyboardType="numeric"
                      helper="bpm"
                    />
                    <View style={styles.restingHrInfo}>
                      <Ionicons
                        name="information-circle-outline"
                        size={16}
                        color={colors.textTertiary}
                      />
                      <Text style={styles.restingHrInfoText}>
                        Measured first thing in the morning while still in bed.
                        Improves effort score accuracy using the Karvonen method.
                        Default: 50 bpm if not provided.
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              title="Continue"
              onPress={handleContinue}
              variant="primary"
              size="lg"
              fullWidth
              disabled={knowsMaxHR === null}
            />
          </View>
        </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  backButton: {
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
    padding: spacing.xs,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xxl,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: colors.surface,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
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
    lineHeight: 24,
  },
  question: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  options: {
    gap: spacing.md,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.md,
  },
  optionButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySubtle,
  },
  optionContent: {
    flex: 1,
  },
  optionText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  optionTextActive: {
    color: colors.primary,
  },
  optionHint: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  hrInput: {
    marginTop: spacing.xl,
  },
  estimateInfo: {
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  estimateTitle: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  estimateValue: {
    fontSize: fontSize.display,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  estimateNote: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Resting HR Section
  restingHrSection: {
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  optionalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  optionalHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  optionalTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  restingHrContent: {
    padding: spacing.md,
    paddingTop: 0,
  },
  restingHrInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: borderRadius.md,
  },
  restingHrInfoText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    lineHeight: 18,
  },
  actions: {
    paddingTop: spacing.md,
  },
});
