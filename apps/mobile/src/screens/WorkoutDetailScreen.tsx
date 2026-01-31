import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../constants/theme';
import { api } from '../services/api';
import type { RootStackScreenProps } from '../navigation/types';
import type { Workout } from '../stores/workoutStore';

// Format time helper
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
};

// Get workout type display name
const getWorkoutTypeName = (type: string): string => {
  const typeNames: Record<string, string> = {
    '500m': '500m',
    '1000m': '1K',
    '2000m': '2K Test',
    '5000m': '5K',
    '6000m': '6K',
    '10000m': '10K',
    half_marathon: 'Half Marathon',
    marathon: 'Marathon',
    '1_minute': '1 Minute',
    steady_state: 'Steady State',
    intervals: 'Intervals',
    custom: 'Custom',
  };
  return typeNames[type] || type;
};

// Get effort color
const getEffortColor = (score?: number): string => {
  if (!score) return colors.textTertiary;
  if (score <= 4) return colors.effortLow;
  if (score <= 7) return colors.effortMedium;
  return colors.effortHigh;
};

export const WorkoutDetailScreen: React.FC = () => {
  const navigation = useNavigation<RootStackScreenProps<'WorkoutDetail'>['navigation']>();
  const route = useRoute<RootStackScreenProps<'WorkoutDetail'>['route']>();
  const { workoutId } = route.params;

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkout();
  }, [workoutId]);

  const loadWorkout = async () => {
    try {
      setLoading(true);
      const response = await api.getWorkout(workoutId);
      if (response.success && response.data) {
        setWorkout(response.data as Workout);
      }
    } catch (error) {
      console.error('Workout load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    navigation.goBack();
  };

  const handleSync = async () => {
    // TODO: Sync to Strava
    await api.syncToStrava(workoutId);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!workout) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Workout not found</Text>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Workout Report</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Workout Type Badge */}
        <View style={styles.badgeSection}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>
              {getWorkoutTypeName(workout.workoutType)}
            </Text>
          </View>
          {workout.isPb && (
            <View style={styles.pbBadge}>
              <Text style={styles.pbBadgeText}>🏆 Personal Best</Text>
            </View>
          )}
        </View>

        {/* Key Metrics */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>
              {workout.totalDistanceMetres.toLocaleString()}m
            </Text>
            <Text style={styles.metricLabel}>Total Distance</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>
              {formatTime(workout.totalTimeSeconds)}
            </Text>
            <Text style={styles.metricLabel}>Total Time</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>
              {formatTime(workout.averageSplitSeconds)}
            </Text>
            <Text style={styles.metricLabel}>Avg Split</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{workout.averageRate} spm</Text>
            <Text style={styles.metricLabel}>Avg Rate</Text>
          </View>
        </View>

        {/* Effort Score */}
        {workout.effortScore && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Effort Score</Text>
            <View style={styles.effortContainer}>
              <Text
                style={[
                  styles.effortValue,
                  { color: getEffortColor(workout.effortScore) },
                ]}
              >
                {workout.effortScore.toFixed(1)}
              </Text>
              <Text style={styles.effortMax}>/10</Text>
            </View>
          </View>
        )}

        {/* HR Data */}
        {workout.avgHeartRate && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Heart Rate</Text>
            <View style={styles.hrRow}>
              <View style={styles.hrItem}>
                <Text style={styles.hrValue}>{workout.avgHeartRate}</Text>
                <Text style={styles.hrLabel}>Avg bpm</Text>
              </View>
              {workout.maxHeartRate && (
                <View style={styles.hrItem}>
                  <Text style={styles.hrValue}>{workout.maxHeartRate}</Text>
                  <Text style={styles.hrLabel}>Max bpm</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Intervals */}
        {workout.intervals && workout.intervals.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Splits</Text>
            <View style={styles.intervalsTable}>
              <View style={styles.intervalsHeader}>
                <Text style={styles.intervalHeaderText}>Split</Text>
                <Text style={styles.intervalHeaderText}>Dist</Text>
                <Text style={styles.intervalHeaderText}>Pace</Text>
                <Text style={styles.intervalHeaderText}>Rate</Text>
              </View>
              {workout.intervals.map((interval, index) => (
                <View key={index} style={styles.intervalRow}>
                  <Text style={styles.intervalText}>{interval.number}</Text>
                  <Text style={styles.intervalText}>{interval.distanceMetres}m</Text>
                  <Text style={styles.intervalText}>
                    {formatTime(interval.paceSeconds)}
                  </Text>
                  <Text style={styles.intervalText}>{interval.strokeRate}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* AI Coaching Insight */}
        {workout.aiInsight && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Coaching Insight</Text>
            <View style={styles.insightCard}>
              <Text style={styles.insightIcon}>🧠</Text>
              <Text style={styles.insightText}>{workout.aiInsight}</Text>
            </View>
          </View>
        )}

        {/* Original Photo */}
        {workout.photoUrl && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Original Photo</Text>
            <Image source={{ uri: workout.photoUrl }} style={styles.photo} />
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleSync}>
            <Text style={styles.actionButtonText}>Sync to Strava</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    fontSize: 24,
    color: colors.textSecondary,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  closeText: {
    fontSize: fontSize.md,
    color: colors.primary,
  },
  badgeSection: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  typeBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  typeBadgeText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  pbBadge: {
    backgroundColor: colors.pbGold,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  pbBadgeText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textInverse,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  metricLabel: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  section: {
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  effortContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  effortValue: {
    fontSize: 64,
    fontWeight: fontWeight.bold,
  },
  effortMax: {
    fontSize: fontSize.xxl,
    color: colors.textTertiary,
    marginLeft: spacing.xs,
  },
  hrRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  hrItem: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  hrValue: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  hrLabel: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  intervalsTable: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  intervalsHeader: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundTertiary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  intervalHeaderText: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  intervalRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  intervalText: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  insightCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  insightIcon: {
    fontSize: 24,
  },
  insightText: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
  },
  actions: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  actionButton: {
    backgroundColor: '#FC4C02',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
});
