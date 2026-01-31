import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../constants/theme';
import type { WorkoutSummary } from '../stores/workoutStore';

interface WorkoutCardProps {
  workout: WorkoutSummary;
  onPress: () => void;
  onReactionPress: () => void;
  onCommentPress: () => void;
}

// Format time helper
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
};

// Format distance helper
const formatDistance = (metres: number): string => {
  return `${metres.toLocaleString()}m`;
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

export const WorkoutCard: React.FC<WorkoutCardProps> = ({
  workout,
  onPress,
  onReactionPress,
  onCommentPress,
}) => {
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
        <View style={styles.workoutBadge}>
          <Text style={styles.workoutType}>
            {getWorkoutTypeName(workout.workoutType)}
          </Text>
        </View>
      </View>

      {/* Key Metrics */}
      <View style={styles.metrics}>
        <View style={styles.metricItem}>
          <Text style={styles.metricValue}>
            {formatDistance(workout.totalDistanceMetres)}
          </Text>
          <Text style={styles.metricLabel}>Distance</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricValue}>
            {formatTime(workout.totalTimeSeconds)}
          </Text>
          <Text style={styles.metricLabel}>Time</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricValue}>
            {formatTime(workout.averageSplitSeconds)}
          </Text>
          <Text style={styles.metricLabel}>Avg Split</Text>
        </View>
        {workout.avgHeartRate && (
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{workout.avgHeartRate}</Text>
            <Text style={styles.metricLabel}>Avg HR</Text>
          </View>
        )}
      </View>

      {/* Effort Score & PB Badge */}
      <View style={styles.badges}>
        {workout.effortScore && (
          <View style={styles.effortBadge}>
            <Text
              style={[
                styles.effortScore,
                { color: getEffortColor(workout.effortScore) },
              ]}
            >
              {workout.effortScore.toFixed(1)}
            </Text>
            <Text style={styles.effortLabel}>Effort</Text>
          </View>
        )}
        {workout.isPb && (
          <View style={styles.pbBadge}>
            <Text style={styles.pbText}>PB</Text>
          </View>
        )}
      </View>

      {/* Engagement */}
      <View style={styles.engagement}>
        <TouchableOpacity style={styles.engagementButton} onPress={onReactionPress}>
          <Text style={styles.reactionIcon}>{workout.hasUserReacted ? '🔥' : '🔥'}</Text>
          <Text
            style={[
              styles.engagementCount,
              workout.hasUserReacted && styles.engagementActive,
            ]}
          >
            {workout.reactionCount}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.engagementButton} onPress={onCommentPress}>
          <Text style={styles.commentIcon}>💬</Text>
          <Text style={styles.engagementCount}>{workout.commentCount}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    ...shadows.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
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
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
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
  },
  workoutBadge: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  workoutType: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  metrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  metricLabel: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  effortBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.backgroundTertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  effortScore: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  effortLabel: {
    color: colors.textTertiary,
    fontSize: fontSize.sm,
  },
  pbBadge: {
    backgroundColor: colors.pbGold,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pbText: {
    color: colors.textInverse,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  engagement: {
    flexDirection: 'row',
    gap: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  engagementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  reactionIcon: {
    fontSize: 18,
  },
  commentIcon: {
    fontSize: 18,
  },
  engagementCount: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
  },
  engagementActive: {
    color: colors.primary,
  },
});
