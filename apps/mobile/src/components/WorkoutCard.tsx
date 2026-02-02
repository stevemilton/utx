import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../constants/theme';
import type { WorkoutSummary } from '../stores/workoutStore';

interface WorkoutCardProps {
  workout: WorkoutSummary;
  onPress: () => void;
  onReactionPress: () => void;
  onCommentPress: () => void;
}

// Format split time (seconds to m:ss.t)
const formatSplit = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
};

// Format total time (seconds to m:ss or h:mm:ss)
const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Format distance helper
const formatDistance = (metres: number): string => {
  return `${metres.toLocaleString()}m`;
};

// Get workout type display name - complete mapping for all backend enum values
const getWorkoutTypeName = (type: string | null | undefined): string => {
  if (!type) return 'WORKOUT';
  const typeNames: Record<string, string> = {
    // Backend Prisma enum values
    'five_hundred': '500M',
    'one_thousand': '1K',
    'two_thousand': '2K TEST',
    'five_thousand': '5K',
    'six_thousand': '6K',
    'ten_thousand': '10K',
    'half_marathon': 'HALF MARATHON',
    'marathon': 'MARATHON',
    'one_minute': '1 MIN TEST',
    'steady_state': 'STEADY STATE',
    'intervals': 'INTERVALS',
    'custom': 'WORKOUT',
    // Legacy format values
    '500m': '500M',
    '1000m': '1K',
    '2000m': '2K TEST',
    '5000m': '5K',
    '6000m': '6K',
    '10000m': '10K',
    '1_minute': '1 MIN TEST',
  };
  return typeNames[type] || type.replace(/_/g, ' ').toUpperCase();
};

// Get relative time
const getRelativeTime = (date: string): string => {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString();
};

// Get effort score color
const getEffortColor = (score?: number): string => {
  if (!score) return colors.textTertiary;
  if (score <= 4) return colors.effortLow;
  if (score <= 7) return colors.effortMedium;
  return colors.effortHigh;
};

// Check if workout type is a test/race (gets primary badge color)
const isTestWorkout = (type: string): boolean => {
  const testTypes = [
    // Backend enum values
    'two_thousand', 'five_hundred', 'one_thousand', 'five_thousand',
    'six_thousand', 'ten_thousand', 'half_marathon', 'marathon', 'one_minute',
    // Legacy values
    '2000m', '500m', '1000m', '5000m', '6000m', '10000m', '1_minute',
  ];
  return testTypes.includes(type);
};

export const WorkoutCard: React.FC<WorkoutCardProps> = ({
  workout,
  onPress,
  onReactionPress,
  onCommentPress,
}) => {
  const isTest = isTestWorkout(workout.workoutType);

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.9}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          {workout.userAvatarUrl ? (
            <Image source={{ uri: workout.userAvatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {workout.userName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View>
            <Text style={styles.userName}>{workout.userName}</Text>
            <Text style={styles.timeAgo}>{getRelativeTime(workout.createdAt)}</Text>
          </View>
        </View>
        <View style={[styles.workoutBadge, !isTest && styles.workoutBadgeSecondary]}>
          <Text style={[styles.workoutType, !isTest && styles.workoutTypeSecondary]}>
            {getWorkoutTypeName(workout.workoutType)}
          </Text>
        </View>
      </View>

      {/* Hero Split Time */}
      <View style={styles.heroSection}>
        <Text style={styles.heroSplit}>{formatSplit(workout.averageSplitSeconds)}</Text>
        <Text style={styles.heroLabel}>AVG SPLIT /500M</Text>
      </View>

      {/* Secondary Metrics Grid */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricItem}>
          <Text style={styles.metricValue}>{formatDistance(workout.totalDistanceMetres)}</Text>
          <Text style={styles.metricLabel}>DIST</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Text style={styles.metricValue}>{formatTime(workout.totalTimeSeconds)}</Text>
          <Text style={styles.metricLabel}>TIME</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Text style={styles.metricValue}>{workout.avgSpm || '—'}</Text>
          <Text style={styles.metricLabel}>SPM</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Text style={styles.metricValue}>{workout.avgHeartRate || '—'}</Text>
          <Text style={styles.metricLabel}>HR</Text>
        </View>
      </View>

      {/* Badges Row */}
      <View style={styles.badges}>
        {workout.effortScore && (
          <View style={styles.effortBadge}>
            <Text style={[styles.effortScore, { color: getEffortColor(workout.effortScore) }]}>
              {workout.effortScore.toFixed(1)}
            </Text>
            <Text style={styles.effortLabel}>Effort</Text>
          </View>
        )}
        {workout.isPb && (
          <View style={styles.pbBadge}>
            <Ionicons name="trophy" size={12} color={colors.black} />
            <Text style={styles.pbText}>PB</Text>
          </View>
        )}
      </View>

      {/* Engagement */}
      <View style={styles.engagement}>
        <TouchableOpacity style={styles.engagementButton} onPress={onReactionPress}>
          <Ionicons
            name={workout.hasUserReacted ? "flame" : "flame-outline"}
            size={20}
            color={workout.hasUserReacted ? colors.primary : colors.textTertiary}
          />
          <Text style={[styles.engagementCount, workout.hasUserReacted && styles.engagementActive]}>
            {workout.reactionCount}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.engagementButton} onPress={onCommentPress}>
          <Ionicons name="chatbubble-outline" size={18} color={colors.textTertiary} />
          <Text style={styles.engagementCount}>{workout.commentCount}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xxl,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    overflow: 'hidden',
    ...shadows.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.textInverse,
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },
  userName: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  timeAgo: {
    color: colors.textTertiary,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  workoutBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
  },
  workoutBadgeSecondary: {
    backgroundColor: colors.backgroundTertiary,
  },
  workoutType: {
    color: colors.textInverse,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.5,
  },
  workoutTypeSecondary: {
    color: colors.textSecondary,
  },
  // Hero section with large split time
  heroSection: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  heroSplit: {
    fontSize: fontSize.hero,
    fontWeight: fontWeight.light,
    color: colors.textPrimary,
    letterSpacing: -3,
    lineHeight: fontSize.hero,
  },
  heroLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: spacing.sm,
    fontWeight: fontWeight.medium,
  },
  // Secondary metrics grid
  metricsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.borderStrong,
  },
  metricValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  metricLabel: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
    fontWeight: fontWeight.medium,
  },
  // Badges row
  badges: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  effortBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primarySubtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
  },
  effortScore: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  effortLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  pbBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.pbGold,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
  },
  pbText: {
    color: colors.black,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.3,
  },
  // Engagement row
  engagement: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  engagementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  engagementCount: {
    color: colors.textTertiary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },
  engagementActive: {
    color: colors.primary,
  },
});
