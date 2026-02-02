import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Modal,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Line, Rect, G, Text as SvgText } from 'react-native-svg';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../constants/theme';
import { api } from '../services/api';
import type { RootStackScreenProps } from '../navigation/types';
import type { Workout, WorkoutInterval, HrDataPoint } from '../stores/workoutStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Light mode colors for premium look
const lightColors = {
  background: '#FFFFFF',
  backgroundSecondary: '#F8F9FA',
  backgroundTertiary: '#F0F2F4',
  surface: '#FFFFFF',
  textPrimary: '#1A1A1A',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  border: 'rgba(0, 0, 0, 0.06)',
  borderStrong: 'rgba(0, 0, 0, 0.12)',
  primary: colors.primary,
  primarySubtle: 'rgba(13, 79, 79, 0.08)',
};

// Format time helper (MM:SS.S)
const formatTime = (seconds: number | null | undefined): string => {
  if (seconds === null || seconds === undefined) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
};

// Format split time (M:SS.S)
const formatSplit = (seconds: number | null | undefined): string => {
  if (seconds === null || seconds === undefined) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
};

// Format distance with commas
const formatDistance = (metres: number | null | undefined): string => {
  if (metres === null || metres === undefined) return '—';
  return metres.toLocaleString();
};

// Format date
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

// Get workout type display name - complete mapping
const getWorkoutTypeName = (type: string | null | undefined): string => {
  if (!type) return 'Workout';
  const typeNames: Record<string, string> = {
    // Backend Prisma enum values
    'five_hundred': '500m',
    'one_thousand': '1K',
    'two_thousand': '2K Test',
    'five_thousand': '5K',
    'six_thousand': '6K',
    'ten_thousand': '10K',
    'half_marathon': 'Half Marathon',
    'marathon': 'Marathon',
    'one_minute': '1 Min Test',
    'steady_state': 'Steady State',
    'intervals': 'Intervals',
    'custom': 'Workout',
    // Legacy format values
    '500m': '500m',
    '1000m': '1K',
    '2000m': '2K Test',
    '5000m': '5K',
    '6000m': '6K',
    '10000m': '10K',
    '1_minute': '1 Min Test',
  };
  return typeNames[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// Check if workout type is a test (for badge styling)
const isTestWorkout = (type: string | null | undefined): boolean => {
  if (!type) return false;
  const testTypes = ['two_thousand', '2000m', 'one_minute', '1_minute', 'five_hundred', '500m'];
  return testTypes.includes(type);
};

// Get effort color
const getEffortColor = (score?: number | null): string => {
  if (!score) return lightColors.textTertiary;
  if (score <= 4) return colors.effortLow;
  if (score <= 7) return colors.effortMedium;
  return colors.effortHigh;
};

// Calculate HR zones from hrData and maxHR
interface HrZone {
  name: string;
  minPercent: number;
  maxPercent: number;
  color: string;
  seconds: number;
  percentage: number;
}

const calculateHrZones = (hrData: HrDataPoint[] | undefined, maxHr: number): HrZone[] => {
  const zones: HrZone[] = [
    { name: 'Recovery', minPercent: 0, maxPercent: 60, color: colors.zone1, seconds: 0, percentage: 0 },
    { name: 'Easy Aerobic', minPercent: 60, maxPercent: 70, color: colors.zone2, seconds: 0, percentage: 0 },
    { name: 'Aerobic', minPercent: 70, maxPercent: 80, color: colors.zone3, seconds: 0, percentage: 0 },
    { name: 'Threshold', minPercent: 80, maxPercent: 90, color: colors.zone4, seconds: 0, percentage: 0 },
    { name: 'Max', minPercent: 90, maxPercent: 100, color: colors.zone5, seconds: 0, percentage: 0 },
  ];

  if (!hrData || hrData.length < 2 || !maxHr) return zones;

  let totalSeconds = 0;
  for (let i = 1; i < hrData.length; i++) {
    const duration = hrData[i].timeSeconds - hrData[i - 1].timeSeconds;
    const hrPercent = (hrData[i].heartRate / maxHr) * 100;

    for (const zone of zones) {
      if (hrPercent >= zone.minPercent && hrPercent < zone.maxPercent) {
        zone.seconds += duration;
        break;
      }
    }
    totalSeconds += duration;
  }

  // Calculate percentages
  if (totalSeconds > 0) {
    for (const zone of zones) {
      zone.percentage = Math.round((zone.seconds / totalSeconds) * 100);
    }
  }

  return zones;
};

// Format duration (MM:SS)
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const WorkoutDetailScreen: React.FC = () => {
  const navigation = useNavigation<RootStackScreenProps<'WorkoutDetail'>['navigation']>();
  const route = useRoute<RootStackScreenProps<'WorkoutDetail'>['route']>();
  const { workoutId } = route.params;

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [insightExpanded, setInsightExpanded] = useState(false);

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

  const handleShare = () => {
    // TODO: Implement share
    Alert.alert('Share', 'Share feature coming soon!');
  };

  const handleEdit = () => {
    // TODO: Navigate to edit screen
    Alert.alert('Edit', 'Edit feature coming soon!');
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Workout',
      'Are you sure you want to delete this workout? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteWorkout(workoutId);
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete workout');
            }
          },
        },
      ]
    );
  };

  const handleSync = async () => {
    try {
      await api.syncToStrava(workoutId);
      Alert.alert('Success', 'Workout synced to Strava!');
    } catch (error) {
      Alert.alert('Error', 'Failed to sync to Strava');
    }
  };

  // Calculate average pace from intervals
  const getAvgPace = (): number | null => {
    if (!workout?.intervals || workout.intervals.length === 0) return null;
    const total = workout.intervals.reduce((sum, int) => sum + (int.paceSeconds || 0), 0);
    return total / workout.intervals.length;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={lightColors.primary} />
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

  const hrZones = calculateHrZones(workout.hrData, workout.maxHeartRate || 185);
  const avgPace = getAvgPace();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={24} color={lightColors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerDate}>{formatDate(workout.workoutDate)}</Text>
        <TouchableOpacity onPress={handleShare} style={styles.headerButton}>
          <Ionicons name="share-outline" size={22} color={lightColors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Workout Type & Badges */}
        <View style={styles.badgeSection}>
          <View style={[styles.typeBadge, isTestWorkout(workout.workoutType) && styles.typeBadgePrimary]}>
            <Text style={[styles.typeBadgeText, isTestWorkout(workout.workoutType) && styles.typeBadgeTextPrimary]}>
              {getWorkoutTypeName(workout.workoutType)}
            </Text>
          </View>
          {workout.isPb && (
            <View style={styles.pbBadge}>
              <Ionicons name="trophy" size={14} color="#000" />
              <Text style={styles.pbBadgeText}>Personal Best</Text>
            </View>
          )}
        </View>

        {/* Hero Split Time */}
        <View style={styles.heroSection}>
          <Text style={styles.heroSplit}>
            {formatSplit(workout.averageSplitSeconds)}
          </Text>
          <Text style={styles.heroLabel}>AVG SPLIT /500M</Text>
        </View>

        {/* Key Metrics Grid */}
        <View style={styles.metricsCard}>
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{formatDistance(workout.totalDistanceMetres)}</Text>
              <Text style={styles.metricLabel}>Distance</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{formatTime(workout.totalTimeSeconds)}</Text>
              <Text style={styles.metricLabel}>Time</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{workout.averageRate ?? '—'}</Text>
              <Text style={styles.metricLabel}>SPM</Text>
            </View>
            {workout.avgHeartRate && (
              <>
                <View style={styles.metricDivider} />
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>{workout.avgHeartRate}</Text>
                  <Text style={styles.metricLabel}>Avg HR</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Secondary Metrics */}
        <View style={styles.secondaryMetrics}>
          {workout.averageWatts && (
            <View style={styles.secondaryMetricCard}>
              <Text style={styles.secondaryMetricValue}>{workout.averageWatts}</Text>
              <Text style={styles.secondaryMetricLabel}>Avg Watts</Text>
            </View>
          )}
          {workout.maxHeartRate && (
            <View style={styles.secondaryMetricCard}>
              <Text style={styles.secondaryMetricValue}>{workout.maxHeartRate}</Text>
              <Text style={styles.secondaryMetricLabel}>Max HR</Text>
            </View>
          )}
          {workout.calories && (
            <View style={styles.secondaryMetricCard}>
              <Text style={styles.secondaryMetricValue}>{workout.calories}</Text>
              <Text style={styles.secondaryMetricLabel}>Calories</Text>
            </View>
          )}
          {workout.dragFactor && (
            <View style={styles.secondaryMetricCard}>
              <Text style={styles.secondaryMetricValue}>{workout.dragFactor}</Text>
              <Text style={styles.secondaryMetricLabel}>Drag</Text>
            </View>
          )}
        </View>

        {/* Effort Score */}
        {workout.effortScore && (
          <View style={styles.effortCard}>
            <View style={styles.effortHeader}>
              <Ionicons name="fitness" size={20} color={lightColors.primary} />
              <Text style={styles.effortTitle}>Effort Score</Text>
            </View>
            <View style={styles.effortContent}>
              <Text style={[styles.effortValue, { color: getEffortColor(workout.effortScore) }]}>
                {workout.effortScore.toFixed(1)}
              </Text>
              <Text style={styles.effortMax}>/10</Text>
            </View>
            <View style={styles.effortBar}>
              <View
                style={[
                  styles.effortBarFill,
                  {
                    width: `${(workout.effortScore / 10) * 100}%`,
                    backgroundColor: getEffortColor(workout.effortScore),
                  }
                ]}
              />
            </View>
          </View>
        )}

        {/* HR Section */}
        {workout.hrData && workout.hrData.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="heart" size={20} color={colors.error} />
              <Text style={styles.sectionTitle}>Heart Rate Analysis</Text>
            </View>

            {/* HR Graph */}
            <View style={styles.hrGraphContainer}>
              <HrGraph hrData={workout.hrData} maxHr={workout.maxHeartRate || 185} />
            </View>

            {/* HR Zone Breakdown */}
            <View style={styles.zoneTable}>
              <View style={styles.zoneHeader}>
                <Text style={[styles.zoneHeaderText, { flex: 2 }]}>Zone</Text>
                <Text style={[styles.zoneHeaderText, { flex: 1 }]}>Time</Text>
                <Text style={[styles.zoneHeaderText, { flex: 1, textAlign: 'right' }]}>%</Text>
              </View>
              {hrZones.map((zone, i) => (
                <View key={i} style={styles.zoneRow}>
                  <View style={[styles.zoneBadge, { backgroundColor: zone.color }]}>
                    <Text style={styles.zoneBadgeText}>Z{i + 1}</Text>
                  </View>
                  <Text style={styles.zoneName}>{zone.name}</Text>
                  <Text style={styles.zoneTime}>{formatDuration(zone.seconds)}</Text>
                  <View style={styles.zoneBarContainer}>
                    <View style={[styles.zoneBar, { width: `${zone.percentage}%`, backgroundColor: zone.color }]} />
                    <Text style={styles.zonePercent}>{zone.percentage}%</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* HR Summary */}
            <View style={styles.hrSummary}>
              <View style={styles.hrSummaryItem}>
                <Text style={styles.hrSummaryValue}>{workout.maxHeartRate || '—'}</Text>
                <Text style={styles.hrSummaryLabel}>Max</Text>
              </View>
              <View style={styles.hrSummaryItem}>
                <Text style={styles.hrSummaryValue}>{workout.avgHeartRate || '—'}</Text>
                <Text style={styles.hrSummaryLabel}>Avg</Text>
              </View>
              <View style={styles.hrSummaryItem}>
                <Text style={styles.hrSummaryValue}>
                  {workout.hrData ? Math.min(...workout.hrData.map(d => d.heartRate)) : '—'}
                </Text>
                <Text style={styles.hrSummaryLabel}>Min</Text>
              </View>
            </View>
          </View>
        )}

        {/* Splits/Intervals Section */}
        {workout.intervals && workout.intervals.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="list" size={20} color={lightColors.primary} />
              <Text style={styles.sectionTitle}>Splits</Text>
            </View>

            {/* Split Consistency Visualization */}
            {avgPace && (
              <View style={styles.consistencyGraph}>
                {workout.intervals.map((interval, i) => {
                  const delta = (interval.paceSeconds || 0) - avgPace;
                  const maxDelta = Math.max(...workout.intervals!.map(int => Math.abs((int.paceSeconds || 0) - avgPace)));
                  const heightPercent = maxDelta > 0 ? (Math.abs(delta) / maxDelta) * 100 : 0;
                  const isSlower = delta > 0;

                  return (
                    <View key={i} style={styles.consistencyBarContainer}>
                      <View style={styles.consistencyBarWrapper}>
                        {isSlower ? (
                          <View style={[styles.consistencyBar, styles.consistencyBarSlow, { height: `${Math.min(heightPercent, 100)}%` }]} />
                        ) : (
                          <View style={[styles.consistencyBar, styles.consistencyBarFast, { height: `${Math.min(heightPercent, 100)}%` }]} />
                        )}
                      </View>
                      <Text style={styles.consistencySplitNum}>{i + 1}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Detailed Splits Table */}
            <View style={styles.splitsTable}>
              <View style={styles.splitsHeader}>
                <Text style={[styles.splitsHeaderText, { flex: 0.5 }]}>#</Text>
                <Text style={[styles.splitsHeaderText, { flex: 1 }]}>Dist</Text>
                <Text style={[styles.splitsHeaderText, { flex: 1 }]}>Time</Text>
                <Text style={[styles.splitsHeaderText, { flex: 1 }]}>Pace</Text>
                <Text style={[styles.splitsHeaderText, { flex: 0.7 }]}>SPM</Text>
                <Text style={[styles.splitsHeaderText, { flex: 0.7 }]}>HR</Text>
              </View>
              {workout.intervals.map((interval, i) => {
                const paceStyle = avgPace && interval.paceSeconds
                  ? interval.paceSeconds < avgPace ? styles.paceFast : interval.paceSeconds > avgPace ? styles.paceSlow : {}
                  : {};

                return (
                  <View key={i} style={styles.splitsRow}>
                    <Text style={[styles.splitsCell, { flex: 0.5 }]}>{interval.number || i + 1}</Text>
                    <Text style={[styles.splitsCell, { flex: 1 }]}>{interval.distanceMetres}m</Text>
                    <Text style={[styles.splitsCell, { flex: 1 }]}>{formatTime(interval.timeSeconds)}</Text>
                    <Text style={[styles.splitsCell, styles.paceCell, paceStyle, { flex: 1 }]}>
                      {formatSplit(interval.paceSeconds)}
                    </Text>
                    <Text style={[styles.splitsCell, { flex: 0.7 }]}>{interval.strokeRate || '—'}</Text>
                    <Text style={[styles.splitsCell, { flex: 0.7 }]}>{interval.avgHeartRate || '—'}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* AI Coaching Insight */}
        {workout.aiInsight && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.insightCard}
              onPress={() => setInsightExpanded(!insightExpanded)}
              activeOpacity={0.7}
            >
              <View style={styles.insightHeader}>
                <View style={styles.insightIconContainer}>
                  <Ionicons name="analytics" size={20} color={lightColors.primary} />
                </View>
                <Text style={styles.insightTitle}>Coaching Insight</Text>
                <Ionicons
                  name={insightExpanded ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={lightColors.textTertiary}
                />
              </View>
              <Text
                style={styles.insightText}
                numberOfLines={insightExpanded ? undefined : 3}
              >
                {workout.aiInsight}
              </Text>
              {!insightExpanded && workout.aiInsight.length > 150 && (
                <Text style={styles.readMore}>Tap to read more</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Original Photo */}
        {workout.photoUrl && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="image" size={20} color={lightColors.primary} />
              <Text style={styles.sectionTitle}>Original Photo</Text>
            </View>
            <TouchableOpacity onPress={() => setPhotoModalVisible(true)}>
              <Image source={{ uri: workout.photoUrl }} style={styles.photoThumbnail} />
              <View style={styles.photoOverlay}>
                <Ionicons name="expand" size={24} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          {/* Strava Sync */}
          <TouchableOpacity style={styles.stravaButton} onPress={handleSync}>
            <View style={styles.stravaIcon}>
              <Text style={styles.stravaIconText}>S</Text>
            </View>
            <Text style={styles.stravaButtonText}>Sync to Strava</Text>
          </TouchableOpacity>

          {/* Secondary Actions */}
          <View style={styles.secondaryActions}>
            <TouchableOpacity style={styles.secondaryActionButton} onPress={handleEdit}>
              <Ionicons name="create-outline" size={20} color={lightColors.primary} />
              <Text style={styles.secondaryActionText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryActionButton, styles.deleteButton]} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={20} color={colors.error} />
              <Text style={[styles.secondaryActionText, styles.deleteText]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Photo Modal */}
      <Modal
        visible={photoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPhotoModalVisible(false)}
        >
          <Image
            source={{ uri: workout.photoUrl }}
            style={styles.fullPhoto}
            resizeMode="contain"
          />
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setPhotoModalVisible(false)}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

// HR Graph Component
const HrGraph: React.FC<{ hrData: HrDataPoint[]; maxHr: number }> = ({ hrData, maxHr }) => {
  const graphWidth = SCREEN_WIDTH - 64;
  const graphHeight = 120;
  const padding = { top: 10, right: 10, bottom: 20, left: 35 };
  const chartWidth = graphWidth - padding.left - padding.right;
  const chartHeight = graphHeight - padding.top - padding.bottom;

  if (!hrData || hrData.length < 2) {
    return (
      <View style={[styles.hrGraph, { height: graphHeight, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: lightColors.textTertiary }}>No HR data available</Text>
      </View>
    );
  }

  const minTime = hrData[0].timeSeconds;
  const maxTime = hrData[hrData.length - 1].timeSeconds;
  const timeRange = maxTime - minTime || 1;

  const minHr = Math.min(...hrData.map(d => d.heartRate));
  const maxHrValue = Math.max(...hrData.map(d => d.heartRate));
  const hrRange = maxHrValue - minHr || 1;

  // Create path
  const points = hrData.map((d, i) => {
    const x = padding.left + ((d.timeSeconds - minTime) / timeRange) * chartWidth;
    const y = padding.top + chartHeight - ((d.heartRate - minHr) / hrRange) * chartHeight;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  // Get color for HR value
  const getHrColor = (hr: number): string => {
    const percent = (hr / maxHr) * 100;
    if (percent < 60) return colors.zone1;
    if (percent < 70) return colors.zone2;
    if (percent < 80) return colors.zone3;
    if (percent < 90) return colors.zone4;
    return colors.zone5;
  };

  return (
    <Svg width={graphWidth} height={graphHeight}>
      {/* Y-axis labels */}
      <SvgText x={5} y={padding.top + 4} fontSize="10" fill={lightColors.textTertiary}>{maxHrValue}</SvgText>
      <SvgText x={5} y={padding.top + chartHeight + 4} fontSize="10" fill={lightColors.textTertiary}>{minHr}</SvgText>

      {/* Grid lines */}
      <Line x1={padding.left} y1={padding.top} x2={padding.left + chartWidth} y2={padding.top} stroke={lightColors.border} strokeWidth={1} />
      <Line x1={padding.left} y1={padding.top + chartHeight / 2} x2={padding.left + chartWidth} y2={padding.top + chartHeight / 2} stroke={lightColors.border} strokeWidth={1} strokeDasharray="4,4" />
      <Line x1={padding.left} y1={padding.top + chartHeight} x2={padding.left + chartWidth} y2={padding.top + chartHeight} stroke={lightColors.border} strokeWidth={1} />

      {/* HR Line */}
      <Path d={points} fill="none" stroke={colors.error} strokeWidth={2} />

      {/* X-axis labels */}
      <SvgText x={padding.left} y={graphHeight - 4} fontSize="10" fill={lightColors.textTertiary}>0:00</SvgText>
      <SvgText x={graphWidth - padding.right - 20} y={graphHeight - 4} fontSize="10" fill={lightColors.textTertiary}>
        {formatDuration(maxTime)}
      </SvgText>
    </Svg>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: lightColors.background,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  headerButton: {
    padding: spacing.xs,
  },
  headerDate: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: lightColors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
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
    color: lightColors.textSecondary,
    marginBottom: spacing.md,
  },
  closeText: {
    fontSize: fontSize.md,
    color: lightColors.primary,
  },

  // Badges
  badgeSection: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: lightColors.background,
  },
  typeBadge: {
    backgroundColor: lightColors.backgroundTertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  typeBadgePrimary: {
    backgroundColor: lightColors.primary,
  },
  typeBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: lightColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  typeBadgeTextPrimary: {
    color: '#fff',
  },
  pbBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.pbGold,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  pbBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: '#000',
  },

  // Hero Split
  heroSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: lightColors.background,
  },
  heroSplit: {
    fontSize: fontSize.hero,
    fontWeight: fontWeight.light,
    color: lightColors.textPrimary,
    letterSpacing: -3,
    fontVariant: ['tabular-nums'],
  },
  heroLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: lightColors.textTertiary,
    letterSpacing: 1.5,
    marginTop: spacing.sm,
  },

  // Metrics Card
  metricsCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: lightColors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  metricLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: lightColors.textTertiary,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricDivider: {
    width: 1,
    height: 32,
    backgroundColor: lightColors.border,
  },

  // Secondary Metrics
  secondaryMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  secondaryMetricCard: {
    flex: 1,
    minWidth: '22%',
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  secondaryMetricValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: lightColors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  secondaryMetricLabel: {
    fontSize: fontSize.xs,
    color: lightColors.textTertiary,
    marginTop: 2,
  },

  // Effort Card
  effortCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  effortHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  effortTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: lightColors.textPrimary,
  },
  effortContent: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  effortValue: {
    fontSize: 48,
    fontWeight: fontWeight.light,
  },
  effortMax: {
    fontSize: fontSize.xl,
    color: lightColors.textTertiary,
    marginLeft: spacing.xs,
  },
  effortBar: {
    height: 6,
    backgroundColor: lightColors.backgroundTertiary,
    borderRadius: 3,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  effortBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Section
  section: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: lightColors.textPrimary,
  },

  // HR Graph
  hrGraphContainer: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  hrGraph: {
    width: '100%',
  },

  // Zone Table
  zoneTable: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  zoneHeader: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: lightColors.backgroundTertiary,
  },
  zoneHeaderText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: lightColors.textSecondary,
    textTransform: 'uppercase',
  },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: lightColors.border,
  },
  zoneBadge: {
    width: 28,
    height: 20,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  zoneBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: '#fff',
  },
  zoneName: {
    flex: 1,
    fontSize: fontSize.sm,
    color: lightColors.textSecondary,
  },
  zoneTime: {
    width: 50,
    fontSize: fontSize.sm,
    color: lightColors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  zoneBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  zoneBar: {
    height: 8,
    borderRadius: 4,
    minWidth: 4,
  },
  zonePercent: {
    marginLeft: spacing.sm,
    fontSize: fontSize.sm,
    color: lightColors.textSecondary,
    fontVariant: ['tabular-nums'],
    width: 36,
    textAlign: 'right',
  },

  // HR Summary
  hrSummary: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  hrSummaryItem: {
    flex: 1,
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  hrSummaryValue: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.semibold,
    color: lightColors.textPrimary,
  },
  hrSummaryLabel: {
    fontSize: fontSize.xs,
    color: lightColors.textTertiary,
    marginTop: 2,
  },

  // Consistency Graph
  consistencyGraph: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    height: 100,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  consistencyBarContainer: {
    flex: 1,
    alignItems: 'center',
    maxWidth: 40,
  },
  consistencyBarWrapper: {
    height: 50,
    width: 12,
    justifyContent: 'flex-end',
  },
  consistencyBar: {
    width: '100%',
    borderRadius: 2,
    minHeight: 4,
  },
  consistencyBarFast: {
    backgroundColor: colors.success,
  },
  consistencyBarSlow: {
    backgroundColor: colors.error,
  },
  consistencySplitNum: {
    fontSize: fontSize.xs,
    color: lightColors.textTertiary,
    marginTop: spacing.xs,
  },

  // Splits Table
  splitsTable: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  splitsHeader: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: lightColors.backgroundTertiary,
  },
  splitsHeaderText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: lightColors.textSecondary,
    textTransform: 'uppercase',
  },
  splitsRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: lightColors.border,
  },
  splitsCell: {
    fontSize: fontSize.sm,
    color: lightColors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  paceCell: {
    fontWeight: fontWeight.medium,
  },
  paceFast: {
    color: colors.success,
  },
  paceSlow: {
    color: colors.error,
  },

  // Insight Card
  insightCard: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  insightIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: lightColors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  insightTitle: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: lightColors.textPrimary,
  },
  insightText: {
    fontSize: fontSize.md,
    color: lightColors.textSecondary,
    lineHeight: 24,
  },
  readMore: {
    fontSize: fontSize.sm,
    color: lightColors.primary,
    marginTop: spacing.sm,
    fontWeight: fontWeight.medium,
  },

  // Photo
  photoThumbnail: {
    width: '100%',
    height: 180,
    borderRadius: borderRadius.xl,
    backgroundColor: lightColors.backgroundTertiary,
  },
  photoOverlay: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Actions
  actions: {
    marginTop: spacing.xl,
    marginHorizontal: spacing.md,
    gap: spacing.md,
  },
  stravaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FC4C02',
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  stravaIcon: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stravaIconText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: '#FC4C02',
  },
  stravaButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: '#fff',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  secondaryActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  secondaryActionText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: lightColors.primary,
  },
  deleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  deleteText: {
    color: colors.error,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullPhoto: {
    width: SCREEN_WIDTH - 32,
    height: SCREEN_WIDTH - 32,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
