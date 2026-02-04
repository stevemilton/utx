import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../../constants/theme';
import { useOnboardingStore } from '../../stores/onboardingStore';
import type { OnboardingScreenProps } from '../../navigation/types';

// Policy URLs
const TERMS_URL = 'https://kind-lotus-435.notion.site/Terms-and-Conditions-2fcfeff7be0080a986f2c832b177ddde';
const PRIVACY_URL = 'https://kind-lotus-435.notion.site/Privacy-Policy-2fcfeff7be0080718fccc8b94e22580d';

export const ConsentScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingScreenProps<'Consent'>['navigation']>();
  const { setConsents } = useOnboardingStore();

  // Required consents
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  // Optional consents (OFF by default per GDPR)
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [analyticsOptIn, setAnalyticsOptIn] = useState(false);

  const canContinue = termsAccepted && privacyAccepted;

  const handleOpenTerms = async () => {
    await WebBrowser.openBrowserAsync(TERMS_URL);
  };

  const handleOpenPrivacy = async () => {
    await WebBrowser.openBrowserAsync(PRIVACY_URL);
  };

  const handleContinue = () => {
    // Save consents to onboarding store
    setConsents({
      termsAccepted,
      privacyAccepted,
      marketingOptIn,
      analyticsOptIn,
      coachSharingOptIn: false, // Will be set in JoinClub if applicable
    });
    navigation.navigate('ProfileIdentity');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.progress}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '16.66%' }]} />
        </View>
        <Text style={styles.progressText}>1 of 6</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.title}>Before we start</Text>
          <Text style={styles.subtitle}>
            Please review and accept our terms to continue
          </Text>

          {/* Required Consents */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Required</Text>

            {/* Terms & Conditions */}
            <TouchableOpacity
              style={styles.consentRow}
              onPress={() => setTermsAccepted(!termsAccepted)}
              activeOpacity={0.7}
            >
              <TouchableOpacity
                style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}
                onPress={() => setTermsAccepted(!termsAccepted)}
              >
                {termsAccepted && (
                  <Ionicons name="checkmark" size={16} color={colors.white} />
                )}
              </TouchableOpacity>
              <View style={styles.consentText}>
                <Text style={styles.consentTitle}>Terms & Conditions</Text>
                <Text style={styles.consentDescription}>
                  I agree to the Terms & Conditions
                </Text>
              </View>
              <TouchableOpacity onPress={handleOpenTerms} style={styles.linkButton}>
                <Text style={styles.linkText}>View</Text>
                <Ionicons name="open-outline" size={14} color={colors.primary} />
              </TouchableOpacity>
            </TouchableOpacity>

            {/* Privacy Policy */}
            <TouchableOpacity
              style={styles.consentRow}
              onPress={() => setPrivacyAccepted(!privacyAccepted)}
              activeOpacity={0.7}
            >
              <TouchableOpacity
                style={[styles.checkbox, privacyAccepted && styles.checkboxChecked]}
                onPress={() => setPrivacyAccepted(!privacyAccepted)}
              >
                {privacyAccepted && (
                  <Ionicons name="checkmark" size={16} color={colors.white} />
                )}
              </TouchableOpacity>
              <View style={styles.consentText}>
                <Text style={styles.consentTitle}>Privacy Policy</Text>
                <Text style={styles.consentDescription}>
                  I have read and acknowledge the Privacy Policy
                </Text>
              </View>
              <TouchableOpacity onPress={handleOpenPrivacy} style={styles.linkButton}>
                <Text style={styles.linkText}>View</Text>
                <Ionicons name="open-outline" size={14} color={colors.primary} />
              </TouchableOpacity>
            </TouchableOpacity>
          </View>

          {/* Optional Consents */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Optional</Text>

            {/* Marketing */}
            <View style={styles.optionalRow}>
              <View style={styles.optionalText}>
                <Text style={styles.consentTitle}>Marketing Communications</Text>
                <Text style={styles.consentDescription}>
                  Receive training tips, product updates, and offers via email
                </Text>
              </View>
              <Switch
                value={marketingOptIn}
                onValueChange={setMarketingOptIn}
                trackColor={{ false: colors.surface, true: colors.primaryLight }}
                thumbColor={marketingOptIn ? colors.primary : colors.textTertiary}
              />
            </View>

            {/* Analytics */}
            <View style={styles.optionalRow}>
              <View style={styles.optionalText}>
                <Text style={styles.consentTitle}>Usage Analytics</Text>
                <Text style={styles.consentDescription}>
                  Help improve UTx by sharing anonymous usage data
                </Text>
              </View>
              <Switch
                value={analyticsOptIn}
                onValueChange={setAnalyticsOptIn}
                trackColor={{ false: colors.surface, true: colors.primaryLight }}
                thumbColor={analyticsOptIn ? colors.primary : colors.textTertiary}
              />
            </View>
          </View>

          {/* Data Controller Info */}
          <View style={styles.infoBox}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.textTertiary} />
            <Text style={styles.infoText}>
              Your data is protected by UK GDPR. Data Controller: Polar Industries Ltd.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title="Continue"
          onPress={handleContinue}
          variant="primary"
          size="lg"
          fullWidth
          disabled={!canContinue}
        />
        {!canContinue && (
          <Text style={styles.hintText}>
            Please accept the required terms to continue
          </Text>
        )}
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
    marginBottom: spacing.xl,
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
  scrollView: {
    flex: 1,
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
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  consentText: {
    flex: 1,
  },
  consentTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  consentDescription: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: spacing.sm,
  },
  linkText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  optionalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  optionalText: {
    flex: 1,
    marginRight: spacing.md,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundTertiary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    lineHeight: 18,
  },
  actions: {
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  hintText: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
