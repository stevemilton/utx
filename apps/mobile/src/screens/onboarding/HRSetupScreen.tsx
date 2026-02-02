import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Button, Input } from '../../components';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../../constants/theme';
import { useOnboardingStore } from '../../stores/onboardingStore';
import type { OnboardingScreenProps } from '../../navigation/types';

export const HRSetupScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingScreenProps<'HRSetup'>['navigation']>();
  const { setMaxHr, data: onboardingData } = useOnboardingStore();
  const [knowsMaxHR, setKnowsMaxHR] = useState<boolean | null>(null);
  const [maxHR, setMaxHR] = useState('');

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
    // Save to onboarding store
    setMaxHr(finalMaxHR);
    navigation.navigate('JoinClub');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.progress}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '60%' }]} />
        </View>
        <Text style={styles.progressText}>3 of 5</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Heart rate setup</Text>
        <Text style={styles.subtitle}>
          Knowing your max heart rate helps us calculate accurate HR zones and
          effort scores
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
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
    backgroundColor: colors.primaryDark + '10',
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
  actions: {
    paddingTop: spacing.md,
  },
});
