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
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '../constants/theme';
import { api } from '../services/api';
import { EffortRing, ZoneBar, ComparisonCard } from '../components';
import type { RootStackScreenProps } from '../navigation/types';
import type { Workout } from '../stores/workoutStore';

// Types for comparison data
interface ComparisonData {
  lastSimilar: {
    id: string;
    date: string;
    totalTimeSeconds: number;
    averageSplitSeconds: number;
    avgHeartRate?: number;
    effortScore?: number;
  } | null;
  personalBest: {
    timeSeconds: number;
    achievedAt: string;
  } | null;
}

interface HrZoneBreakdown {
  zone1Seconds: number;
  zone2Seconds: number;
  zone3Seconds: number;
  zone4Seconds: number;
  zone5Seconds: number;
}

// Format time helper (for total time)
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
};

// Format split time (M:SS.S per 500m)
const formatSplit = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
};

// Format date relative or absolute
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else if (diffDays === 1) {
    return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

// Get workout type display name
const getWorkoutTypeName = (type: string): string => {
  const typeNames: Record<string, string> = {
    'five_hundred': '500m',
    '500m': '500m',
    'one_thousand': '1K',
    '1000m': '1K',
    'two_thousand': '2K Test',
    '2000m': '2K Test',
    'five_thousand': '5K',
    '5000m': '5K',
    'six_thousand': '6K',
    '6000m': '6K',
    'ten_thousand': '10K',
    '10000m': '10K',
    half_marathon: 'Half Marathon',
    marathon: 'Marathon',
    one_minute: '1 Minute',
    steady_state: 'Steady State',
    intervals: 'Intervals',
    custom: 'Workout',
    distance: 'Workout',
    time: 'Workout',
  };
  return typeNames[type] || type.replace(/_/g, ' ');
};

// Safe number formatter
const formatNumber = (num: number | undefined | null): string => {
  if (num === undefined || num === null) return '—';
  return num.toLocaleString();
};

export const WorkoutDetailScreen: React.FC = () => {
  const navigation = useNavigation<RootStackScreenProps<'WorkoutDetail'>['navigation']>();
  const route = useRoute<RootStackScreenProps<'WorkoutDetail'>['route']>();
  const { workoutId } = route.params;

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [hrZones, setHrZones] = useState<HrZoneBreakdown | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkout();
  }, [workoutId]);

  const loadWorkout = async () => {
    try {
      setLoading(true);
      const response = await api.getWorkout(workoutId);
      if (response.success && response.data) {
        // Backend returns { workout: {...} } inside data
        const data = response.data as {
          workout: Workout;
          comparison?: ComparisonData;
          hrZoneBreakdown?: HrZoneBreakdown;
        };
        setWorkout(data.workout);
        if (data.comparison) setComparison(data.comparison);
        if (data.hrZoneBreakdown) setHrZones(data.hrZoneBreakdown);
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

  const handleShare = () => {
    // TODO: Implement share
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
          <Ionicons name="alert-circle-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.errorText}>Workout not found</Text>
          <TouchableOpacity onPress={handleClose} style={styles.errorButton}>
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Workout Report</Text>
        <TouchableOpacity onPress={handleShare} style={styles.headerButton}>
          <Ionicons name="share-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          {/* Badges */}
          <View style={styles.badgeRow}>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>
                {getWorkoutTypeName(workout.workoutType)}
              </Text>
            </View>
            {workout.isPb && (
              <View style={styles.pbBadge}>
                <Ionicons name="trophy" size={14} color={colors.textInverse} />
                <Text style={styles.pbBadgeText}>Personal Best</Text>
              </View>
            )}
          </View>

          {/* Date */}
          <Text style={styles.dateText}>
            {workout.workoutDate ? formatDate(workout.workoutDate) : formatDate(workout.createdAt)}
          </Text>

          {/* Hero Split Time */}
          <View style={styles.heroMetricContainer}>
            <Text style={styles.heroMetricValue}>
              {workout.averageSplitSeconds ? formatSplit(workout.averageSplitSeconds) : '—'}
            </Text>
            <Text style={styles.heroMetricLabel}>/500m</Text>
          </View>
          <Text style={styles.heroMetricSubtitle}>Average Split</Text>
        </View>

        {/* Quick Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {formatNumber(workout.totalDistanceMetres)}m
            </Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {workout.totalTimeSeconds ? formatTime(workout.totalTimeSeconds) : '—'}
            </Text>
            <Text style={styles.statLabel}>Time</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{workout.averageRate ?? '—'}</Text>
            <Text style={styles.statLabel}>SPM</Text>
          </View>
          {workout.averageWatts && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{workout.averageWatts}</Text>
                <Text style={styles.statLabel}>Watts</Text>
              </View>
            </>
          )}
        </View>

        {/* Effort Ring Section */}
        {workout.effortScore !== undefined && workout.effortScore !== null && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Effort Score</Text>
            <View style={styles.effortCard}>
              <EffortRing score={workout.effortScore} size={160} />
            </View>
          </View>
        )}

        {/* HR Analysis Section */}
        {(workout.avgHeartRate || hrZones) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Heart Rate Analysis</Text>
            <View style={styles.hrCard}>
              {/* HR Stats */}
              <View style={styles.hrStatsRow}>
                {workout.avgHeartRate && (
                  <View style={styles.hrStatItem}>
                    <Text style={styles.hrStatValue}>{workout.avgHeartRate}</Text>
                    <Text style={styles.hrStatLabel}>Avg BPM</Text>
                  </View>
                )}
                {workout.maxHeartRate && (
                  <View style={styles.hrStatItem}>
                    <Text style={styles.hrStatValue}>{workout.maxHeartRate}</Text>
                    <Text style={styles.hrStatLabel}>Max BPM</Text>
                  </View>
                )}
              </View>

              {/* Zone Distribution */}
              {hrZones && (
                <View style={styles.zoneBarContainer}>
                  <ZoneBar
                    zoneTimes={{
                      zone1: hrZones.zone1Seconds,
                      zone2: hrZones.zone2Seconds,
                      zone3: hrZones.zone3Seconds,
                      zone4: hrZones.zone4Seconds,
                      zone5: hrZones.zone5Seconds,
                    }}
                    totalTime={workout.totalTimeSeconds}
                  />
                </View>
              )}
            </View>
          </View>
        )}

        {/* Splits/Intervals Table */}
        {workout.intervals && workout.intervals.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Splits</Text>
            <View style={styles.splitsCard}>
              {/* Header */}
              <View style={styles.splitsHeader}>
                <Text style={[styles.splitsHeaderText, { flex: 0.5 }]}>#</Text>
                <Text style={[styles.splitsHeaderText, { flex: 1 }]}>Dist</Text>
                <Text style={[styles.splitsHeaderText, { flex: 1.2 }]}>Pace</Text>
                <Text style={[styles.splitsHeaderText, { flex: 0.8 }]}>Rate</Text>
              </View>

              {/* Find fastest/slowest for highlighting */}
              {(() => {
                const paces = workout.intervals!.map(i => i.paceSeconds);
                const minPace = Math.min(...paces);
                const maxPace = Math.max(...paces);
                const avgPace = paces.reduce((a, b) => a + b, 0) / paces.length;

                return workout.intervals!.map((interval, index) => {
                  const isFastest = interval.paceSeconds === minPace && paces.length > 1;
                  const isSlowest = interval.paceSeconds === maxPace && paces.length > 1;
                  const paceVariance = ((interval.paceSeconds - avgPace) / avgPace) * 100;

                  return (
                    <View
                      key={index}
                      style={[
                        styles.splitsRow,
                        isFastest && styles.fastestRow,
                        isSlowest && styles.slowestRow,
                      ]}
                    >
                      <Text style={[styles.splitsText, { flex: 0.5 }]}>
                        {interval.number || index + 1}
                      </Text>
                      <Text style={[styles.splitsText, { flex: 1 }]}>
                        {interval.distanceMetres}m
                      </Text>
                      <View style={{ flex: 1.2, flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[
                          styles.splitsText,
                          isFastest && styles.fastestText,
                          isSlowest && styles.slowestText,
                        ]}>
                          {formatSplit(interval.paceSeconds)}
                        </Text>
                        {isFastest && (
                          <View style={styles.paceTag}>
                            <Text style={styles.paceTagText}>Best</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.splitsText, { flex: 0.8 }]}>
                        {interval.strokeRate}
                      </Text>
                    </View>
                  );
                });
              })()}
            </View>
          </View>
        )}

        {/* Comparison Section */}
        {comparison?.lastSimilar && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Performance Comparison</Text>
            <ComparisonCard
              title={`vs Last ${getWorkoutTypeName(workout.workoutType)}`}
              subtitle={formatDate(comparison.lastSimilar.date)}
              rows={[
                {
                  label: 'Time',
                  currentValue: workout.totalTimeSeconds,
                  previousValue: comparison.lastSimilar.totalTimeSeconds,
                  format: 'time',
                },
                {
                  label: 'Split',
                  currentValue: workout.averageSplitSeconds,
                  previousValue: comparison.lastSimilar.averageSplitSeconds,
                  format: 'split',
                },
                {
                  label: 'Avg HR',
                  currentValue: workout.avgHeartRate || null,
                  previousValue: comparison.lastSimilar.avgHeartRate || null,
                  format: 'hr',
                },
                {
                  label: 'Effort',
                  currentValue: workout.effortScore || null,
                  previousValue: comparison.lastSimilar.effortScore || null,
                  format: 'number',
                },
              ]}
            />
          </View>
        )}

        {/* Personal Best Gap */}
        {comparison?.personalBest && !workout.isPb && (
          <View style={styles.section}>
            <View style={styles.pbGapCard}>
              <View style={styles.pbGapHeader}>
                <Ionicons name="trophy-outline" size={20} color={colors.pbGold} />
                <Text style={styles.pbGapTitle}>Personal Best Gap</Text>
              </View>
              <View style={styles.pbGapContent}>
                <View style={styles.pbGapTimes}>
                  <View style={styles.pbGapTimeItem}>
                    <Text style={styles.pbGapTimeLabel}>Your PB</Text>
                    <Text style={styles.pbGapTimeValue}>
                      {formatTime(comparison.personalBest.timeSeconds)}
                    </Text>
                  </View>
                  <View style={styles.pbGapTimeItem}>
                    <Text style={styles.pbGapTimeLabel}>Today</Text>
                    <Text style={styles.pbGapTimeValue}>
                      {formatTime(workout.totalTimeSeconds)}
                    </Text>
                  </View>
                </View>
                <View style={styles.pbGapDelta}>
                  <Text style={styles.pbGapDeltaLabel}>Gap</Text>
                  <Text style={styles.pbGapDeltaValue}>
                    +{(workout.totalTimeSeconds - comparison.personalBest.timeSeconds).toFixed(1)}s
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Social Section */}
        {(workout.reactions?.length || workout.comments?.length) ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Activity</Text>
            <View style={styles.socialCard}>
              {/* Reactions */}
              {workout.reactions && workout.reactions.length > 0 && (
                <View style={styles.reactionsRow}>
                  <View style={styles.reactionAvatars}>
                    {workout.reactions.slice(0, 3).map((reaction, index) => (
                      <View
                        key={reaction.id}
                        style={[
                          styles.reactionAvatar,
                          { marginLeft: index > 0 ? -8 : 0, zIndex: 3 - index },
                        ]}
                      >
                        {reaction.user.avatarUrl ? (
                          <Image
                            source={{ uri: reaction.user.avatarUrl }}
                            style={styles.avatarImage}
                          />
                        ) : (
                          <View style={styles.avatarPlaceholder}>
                            <Text style={styles.avatarInitial}>
                              {reaction.user.name?.charAt(0).toUpperCase() || '?'}
                            </Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                  <View style={styles.reactionTextContainer}>
                    <Ionicons name="flame" size={16} color={colors.error} />
                    <Text style={styles.reactionText}>
                      {workout.reactions.length === 1
                        ? `${workout.reactions[0].user.name} gave props`
                        : `${workout.reactions.length} people gave props`}
                    </Text>
                  </View>
                </View>
              )}

              {/* Comments Preview */}
              {workout.comments && workout.comments.length > 0 && (
                <View style={styles.commentsPreview}>
                  {workout.comments.slice(0, 2).map((comment) => (
                    <View key={comment.id} style={styles.commentItem}>
                      <View style={styles.commentAvatar}>
                        {comment.user.avatarUrl ? (
                          <Image
                            source={{ uri: comment.user.avatarUrl }}
                            style={styles.commentAvatarImage}
                          />
                        ) : (
                          <View style={styles.commentAvatarPlaceholder}>
                            <Text style={styles.commentAvatarInitial}>
                              {comment.user.name?.charAt(0).toUpperCase() || '?'}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.commentContent}>
                        <Text style={styles.commentAuthor}>{comment.user.name}</Text>
                        <Text style={styles.commentText} numberOfLines={2}>
                          {comment.content}
                        </Text>
                      </View>
                    </View>
                  ))}
                  {workout.comments.length > 2 && (
                    <TouchableOpacity style={styles.viewAllComments}>
                      <Text style={styles.viewAllCommentsText}>
                        View all {workout.comments.length} comments
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </View>
        ) : null}

        {/* AI Coaching Insight */}
        {workout.aiInsight && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Coach's Analysis</Text>
            <View style={styles.insightCard}>
              <View style={styles.insightHeader}>
                <View style={styles.insightIconContainer}>
                  <Ionicons name="sparkles" size={20} color={colors.primary} />
                </View>
                <Text style={styles.insightLabel}>AI Insight</Text>
              </View>
              <Text style={styles.insightText}>{workout.aiInsight}</Text>
            </View>
          </View>
        )}

        {/* Notes Section */}
        {workout.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{workout.notes}</Text>
            </View>
          </View>
        )}

        {/* Original Photo */}
        {workout.photoUrl && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Erg Screen</Text>
            <Image source={{ uri: workout.photoUrl }} style={styles.photo} />
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsSection}>
          <TouchableOpacity style={styles.stravaButton}>
            <Ionicons name="logo-buffer" size={20} color={colors.textInverse} />
            <Text style={styles.stravaButtonText}>Sync to Strava</Text>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  errorText: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  errorButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  errorButtonText: {
    color: colors.textInverse,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerButton: {
    padding: spacing.sm,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },

  // Hero Section
  heroSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.backgroundSecondary,
    borderBottomLeftRadius: borderRadius.xxl,
    borderBottomRightRadius: borderRadius.xxl,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  typeBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  typeBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textInverse,
  },
  pbBadge: {
    backgroundColor: colors.pbGold,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pbBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textInverse,
  },
  dateText: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginBottom: spacing.lg,
  },
  heroMetricContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  heroMetricValue: {
    fontSize: fontSize.hero,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  heroMetricLabel: {
    fontSize: fontSize.xl,
    color: colors.textTertiary,
    marginLeft: spacing.xs,
  },
  heroMetricSubtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  // Quick Stats
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: -spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    ...shadows.md,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },

  // Sections
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },

  // Effort Ring
  effortCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadows.sm,
  },

  // HR Analysis
  hrCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  hrStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.lg,
  },
  hrStatItem: {
    alignItems: 'center',
  },
  hrStatValue: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  hrStatLabel: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  zoneBarContainer: {
    marginTop: spacing.md,
  },

  // Splits Table
  splitsCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadows.sm,
  },
  splitsHeader: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.backgroundTertiary,
  },
  splitsHeaderText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  splitsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  splitsText: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  fastestRow: {
    backgroundColor: colors.successLight,
  },
  slowestRow: {
    backgroundColor: colors.warningLight,
  },
  fastestText: {
    color: colors.success,
    fontWeight: fontWeight.semibold,
  },
  slowestText: {
    color: colors.warning,
  },
  paceTag: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.sm,
  },
  paceTagText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textInverse,
  },

  // PB Gap
  pbGapCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.pbGold,
    ...shadows.sm,
  },
  pbGapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  pbGapTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  pbGapContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pbGapTimes: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  pbGapTimeItem: {
    alignItems: 'center',
  },
  pbGapTimeLabel: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  pbGapTimeValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  pbGapDelta: {
    alignItems: 'center',
  },
  pbGapDeltaLabel: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  pbGapDeltaValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.error,
  },

  // Social Section
  socialCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  reactionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  reactionAvatars: {
    flexDirection: 'row',
  },
  reactionAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.surface,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textInverse,
  },
  reactionTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  reactionText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  commentsPreview: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  commentItem: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  commentAvatarImage: {
    width: '100%',
    height: '100%',
  },
  commentAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarInitial: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textInverse,
  },
  commentContent: {
    flex: 1,
  },
  commentAuthor: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  commentText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  viewAllComments: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  viewAllCommentsText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.primary,
  },

  // AI Insight
  insightCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  insightIconContainer: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.primary,
  },
  insightText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 22,
  },

  // Notes
  notesCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  notesText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 22,
  },

  // Photo
  photo: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.backgroundTertiary,
  },

  // Actions
  actionsSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  stravaButton: {
    backgroundColor: colors.strava,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  stravaButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textInverse,
  },
});
