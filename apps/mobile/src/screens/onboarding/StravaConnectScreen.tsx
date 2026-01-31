import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../components';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '../../constants/theme';
import { api } from '../../services/api';
import type { OnboardingScreenProps } from '../../navigation/types';

export const StravaConnectScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingScreenProps<'StravaConnect'>['navigation']>();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const handleConnectStrava = async () => {
    try {
      setIsConnecting(true);

      // Get Strava auth URL from backend
      const response = await api.getStravaAuthUrl();

      if (response.success && response.data?.url) {
        // Open Strava auth in browser
        await Linking.openURL(response.data.url);
        // The app will handle the callback via deep link
      } else {
        Alert.alert('Error', 'Failed to connect to Strava. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to connect to Strava. Please try again.');
      console.error('Strava connect error:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSkip = () => {
    navigation.navigate('JoinClub');
  };

  const handleContinue = () => {
    navigation.navigate('JoinClub');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.progress}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '66%' }]} />
        </View>
        <Text style={styles.progressText}>4 of 6</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Connect to Strava</Text>
        <Text style={styles.subtitle}>
          Sync your workouts automatically to Strava and keep all your training in
          one place
        </Text>

        {/* Strava benefits */}
        <View style={styles.benefits}>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>🔄</Text>
            <View style={styles.benefitText}>
              <Text style={styles.benefitTitle}>Auto-sync workouts</Text>
              <Text style={styles.benefitDescription}>
                Every erg session appears on your Strava feed
              </Text>
            </View>
          </View>

          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>📊</Text>
            <View style={styles.benefitText}>
              <Text style={styles.benefitTitle}>Full data export</Text>
              <Text style={styles.benefitDescription}>
                Distance, time, HR, and more get synced
              </Text>
            </View>
          </View>

          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>👥</Text>
            <View style={styles.benefitText}>
              <Text style={styles.benefitTitle}>Share with friends</Text>
              <Text style={styles.benefitDescription}>
                Your Strava followers see your progress
              </Text>
            </View>
          </View>
        </View>

        {/* Connect button or connected state */}
        {isConnected ? (
          <View style={styles.connectedState}>
            <Text style={styles.connectedIcon}>✓</Text>
            <Text style={styles.connectedText}>Connected to Strava</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.stravaButton}
            onPress={handleConnectStrava}
            disabled={isConnecting}
          >
            <View style={styles.stravaLogo}>
              <Text style={styles.stravaLogoText}>S</Text>
            </View>
            <Text style={styles.stravaButtonText}>
              {isConnecting ? 'Connecting...' : 'Connect Strava'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {isConnected ? (
          <Button
            title="Continue"
            onPress={handleContinue}
            variant="primary"
            size="lg"
            fullWidth
          />
        ) : (
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
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
  benefits: {
    gap: spacing.lg,
    marginBottom: spacing.xxl,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  benefitIcon: {
    fontSize: 24,
  },
  benefitText: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  benefitDescription: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    lineHeight: 20,
  },
  stravaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FC4C02', // Strava orange
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.md,
  },
  stravaLogo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stravaLogoText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  stravaButtonText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  connectedState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success + '20',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  connectedIcon: {
    fontSize: 24,
    color: colors.success,
  },
  connectedText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.success,
  },
  actions: {
    paddingTop: spacing.md,
  },
  skipButton: {
    alignItems: 'center',
    padding: spacing.md,
  },
  skipText: {
    fontSize: fontSize.md,
    color: colors.textTertiary,
  },
});
