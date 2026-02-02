import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '../../constants/theme';
import { useWorkoutStore, Workout } from '../../stores/workoutStore';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';
import type { MainTabScreenProps } from '../../navigation/types';

// ============ MINI EFFORT RING ============
interface MiniEffortRingProps {
  effortPoints: number;
  size?: number;
}

const getEffortZoneColor = (ep: number): string => {
  if (ep <= 25) return '#4ADE80'; // Recovery - Green
  if (ep <= 50) return '#3B82F6'; // Building - Blue
  if (ep <= 75) return '#FBBF24'; // Training - Amber
  return '#EF4444'; // Peak - Red
};

const MiniEffortRing: React.FC<MiniEffortRingProps> = ({ effortPoints, size = 44 }) => {
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (effortPoints / 100) * circumference;
  const center = size / 2;
  const color = getEffortZoneColor(effortPoints);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.backgroundTertiary}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${progress} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontSize: 11, fontWeight: fontWeight.bold, color: color }}>
          {Math.round(effortPoints)}
        </Text>
      </View>
    </View>
  );
};

// ============ EFFORT CALCULATION (simplified for display) ============
interface UserProfileForEffort {
  age: number;
  weightKg: number;
  heightCm: number;
  maxHr: number;
  restingHr?: number;
}

const calculateWatts = (distanceMetres: number, timeSeconds: number): number => {
  if (distanceMetres <= 0 || timeSeconds <= 0) return 0;
  const paceMetersPerSecond = distanceMetres / timeSeconds;
  return 2.80 * Math.pow(paceMetersPerSecond, 3);
};

const calculateEffortPoints = (user: UserProfileForEffort, workout: Workout): number => {
  const restingHr = user.restingHr || 50;
  const totalDistance = workout.totalDistanceMetres || 0;
  const totalTime = workout.totalTimeSeconds || 0;
  const totalTimeMins = totalTime / 60;
  const avgHr = workout.avgHeartRate;
  const avgStrokeRate = workout.averageRate;
  const avgWatts = calculateWatts(totalDistance, totalTime);

  // Cardiac Load (0-40)
  let cardiacScore = 0;
  if (avgHr && user.maxHr) {
    const hrReserve = user.maxHr - restingHr;
    const avgIntensity = hrReserve > 0 ? (avgHr - restingHr) / hrReserve : 0;
    cardiacScore = Math.pow(Math.max(0, avgIntensity), 1.5) * 40;
    const ageFactor = 1 + (user.age - 30) * 0.005;
    cardiacScore *= Math.min(ageFactor, 1.3);
  } else if (!avgHr && avgWatts > 0) {
    const bodyWeightFactor = Math.pow(user.weightKg / 75, 0.222);
    const thresholdWatts = 220 * bodyWeightFactor;
    const powerIntensity = Math.min(avgWatts / thresholdWatts, 1.3);
    const durationFactor = Math.min(Math.log10(totalTimeMins + 1) * 0.6, 0.85);
    cardiacScore = Math.pow(powerIntensity, 1.2) * durationFactor * 28;
  }
  cardiacScore = Math.min(40, Math.max(0, cardiacScore));

  // Work Output (0-35)
  const bodyWeightFactor = Math.pow(user.weightKg / 75, 0.222);
  const expectedWatts = 150 * bodyWeightFactor;
  const relativePower = expectedWatts > 0 ? avgWatts / expectedWatts : 0;
  const durationFactor = Math.log10(totalTimeMins + 1);
  let workScore = relativePower * durationFactor * 15;
  workScore = Math.min(35, Math.max(0, workScore));

  // Pacing (0-15) - simplified
  let pacingScore = 10;
  if (workout.intervals && workout.intervals.length > 1) {
    const splits = workout.intervals.map((i) => i.paceSeconds);
    const meanSplit = splits.reduce((a, b) => a + b, 0) / splits.length;
    const variance = splits.reduce((sum, s) => sum + Math.pow(s - meanSplit, 2), 0) / splits.length;
    const cv = meanSplit > 0 ? Math.sqrt(variance) / meanSplit : 0;
    const consistency = Math.max(0, 1 - cv * 10);
    pacingScore = consistency * 12;
  }
  pacingScore = Math.min(15, Math.max(0, pacingScore));

  // Economy (0-10) - simplified
  let economyScore = 5;
  if (avgStrokeRate && avgWatts) {
    const wattsPerStroke = avgWatts / avgStrokeRate;
    if (wattsPerStroke > 8) economyScore = 6;
    else if (wattsPerStroke > 6) economyScore = 8;
    else economyScore = 10;
  }

  const totalEp = cardiacScore + workScore + pacingScore + economyScore;
  return Math.max(0, Math.min(100, totalEp));
};

// Format time helper
const formatTime = (seconds: number | undefined | null): string => {
  if (seconds === undefined || seconds === null || isNaN(seconds)) {
    return '0:00.0';
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
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
  return typeNames[type] || type.replace(/_/g, ' ');
};

// Format date
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

type ViewMode = 'list' | 'calendar';

export const WorkoutsScreen: React.FC = () => {
  const navigation = useNavigation<MainTabScreenProps<'Workouts'>['navigation']>();
  const { myWorkouts, myWorkoutsLoading, setMyWorkouts, setMyWorkoutsLoading } =
    useWorkoutStore();
  const user = useAuthStore((state) => state.user);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  // Build user profile for effort calculation
  const userProfile: UserProfileForEffort = useMemo(() => ({
    age: user?.birthDate ? Math.floor((Date.now() - new Date(user.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 30,
    weightKg: user?.weightKg || 75,
    heightCm: user?.heightCm || 175,
    maxHr: user?.maxHr || 190,
    restingHr: user?.restingHr || 50,
  }), [user]);

  const loadWorkouts = async () => {
    try {
      setMyWorkoutsLoading(true);
      const response = await api.getWorkouts();

      if (response.success && response.data) {
        const data = response.data as { workouts: Workout[] };
        setMyWorkouts(data.workouts || []);
      }
    } catch (error) {
      console.error('Workouts load error:', error);
    } finally {
      setMyWorkoutsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadWorkouts();
    setRefreshing(false);
  };

  const handleWorkoutPress = (workoutId: string) => {
    navigation.navigate('WorkoutDetail', { workoutId });
  };

  useEffect(() => {
    loadWorkouts();
  }, []);

  const renderWorkout = ({ item }: { item: Workout }) => {
    // Calculate effort points for display
    const effortPoints = item.effortPoints || calculateEffortPoints(userProfile, item);

    return (
      <TouchableOpacity
        style={styles.workoutItem}
        onPress={() => handleWorkoutPress(item.id)}
        activeOpacity={0.8}
      >
        <View style={styles.workoutContent}>
          {/* Effort Ring */}
          <MiniEffortRing effortPoints={effortPoints} size={48} />

          {/* Main Content */}
          <View style={styles.workoutMain}>
            <View style={styles.workoutHeader}>
              <View style={styles.workoutType}>
                <Text style={styles.workoutTypeName}>
                  {getWorkoutTypeName(item.workoutType)}
                </Text>
                {item.isPb && (
                  <View style={styles.pbBadge}>
                    <Ionicons name="trophy" size={10} color={colors.black} />
                    <Text style={styles.pbText}>PB</Text>
                  </View>
                )}
              </View>
              <View style={styles.workoutMeta}>
                {!item.isPublic && (
                  <View style={styles.privateBadge}>
                    <Ionicons name="lock-closed" size={10} color={colors.textTertiary} />
                  </View>
                )}
                <Text style={styles.workoutDate}>{formatDate(item.workoutDate)}</Text>
              </View>
            </View>

            <View style={styles.workoutMetrics}>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>
                  {(item.totalDistanceMetres ?? 0).toLocaleString()}m
                </Text>
                <Text style={styles.metricLabel}>Distance</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>{formatTime(item.totalTimeSeconds)}</Text>
                <Text style={styles.metricLabel}>Time</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>
                  {formatTime(item.averageSplitSeconds)}
                </Text>
                <Text style={styles.metricLabel}>Split</Text>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="barbell-outline" size={48} color={colors.textTertiary} />
      </View>
      <Text style={styles.emptyTitle}>No workouts yet</Text>
      <Text style={styles.emptyText}>
        Tap the + button to log your first workout
      </Text>
    </View>
  );

  // ============ CALENDAR HELPERS ============
  const getDaysInMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getWorkoutsForDate = (date: Date): Workout[] => {
    return myWorkouts.filter((w) => {
      const workoutDate = new Date(w.workoutDate);
      return (
        workoutDate.getDate() === date.getDate() &&
        workoutDate.getMonth() === date.getMonth() &&
        workoutDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const navigateMonth = (direction: number) => {
    setSelectedMonth((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + direction);
      return newDate;
    });
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(selectedMonth);
    const firstDay = getFirstDayOfMonth(selectedMonth);
    const days: (number | null)[] = [];

    // Add empty cells for days before the first of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Add the days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    return (
      <ScrollView
        style={styles.calendarContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Month Navigation */}
        <View style={styles.monthHeader}>
          <TouchableOpacity onPress={() => navigateMonth(-1)} style={styles.monthNavButton}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>
            {monthNames[selectedMonth.getMonth()]} {selectedMonth.getFullYear()}
          </Text>
          <TouchableOpacity onPress={() => navigateMonth(1)} style={styles.monthNavButton}>
            <Ionicons name="chevron-forward" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Weekday Headers */}
        <View style={styles.weekdayHeader}>
          {weekDays.map((day) => (
            <Text key={day} style={styles.weekdayText}>
              {day}
            </Text>
          ))}
        </View>

        {/* Calendar Grid */}
        <View style={styles.calendarGrid}>
          {days.map((day, index) => {
            if (day === null) {
              return <View key={`empty-${index}`} style={styles.calendarCell} />;
            }

            const cellDate = new Date(
              selectedMonth.getFullYear(),
              selectedMonth.getMonth(),
              day
            );
            const workoutsOnDay = getWorkoutsForDate(cellDate);
            const hasWorkout = workoutsOnDay.length > 0;
            const isToday =
              new Date().toDateString() === cellDate.toDateString();

            // Calculate average effort for the day
            let avgEffort = 0;
            if (hasWorkout) {
              const efforts = workoutsOnDay.map(
                (w) => w.effortPoints || calculateEffortPoints(userProfile, w)
              );
              avgEffort = efforts.reduce((a, b) => a + b, 0) / efforts.length;
            }

            return (
              <TouchableOpacity
                key={`day-${day}`}
                style={[
                  styles.calendarCell,
                  isToday && styles.calendarCellToday,
                ]}
                onPress={() => {
                  if (hasWorkout && workoutsOnDay.length === 1) {
                    handleWorkoutPress(workoutsOnDay[0].id);
                  }
                }}
                disabled={!hasWorkout}
              >
                <Text
                  style={[
                    styles.calendarDayText,
                    isToday && styles.calendarDayTextToday,
                    !hasWorkout && styles.calendarDayTextInactive,
                  ]}
                >
                  {day}
                </Text>
                {hasWorkout && (
                  <View
                    style={[
                      styles.calendarDot,
                      { backgroundColor: getEffortZoneColor(avgEffort) },
                    ]}
                  />
                )}
                {workoutsOnDay.length > 1 && (
                  <Text style={styles.calendarWorkoutCount}>
                    {workoutsOnDay.length}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Workouts for selected month */}
        <View style={styles.monthWorkouts}>
          <Text style={styles.monthWorkoutsTitle}>
            {monthNames[selectedMonth.getMonth()]} Workouts
          </Text>
          {myWorkouts
            .filter((w) => {
              const d = new Date(w.workoutDate);
              return (
                d.getMonth() === selectedMonth.getMonth() &&
                d.getFullYear() === selectedMonth.getFullYear()
              );
            })
            .map((workout) => {
              const effortPoints =
                workout.effortPoints || calculateEffortPoints(userProfile, workout);
              return (
                <TouchableOpacity
                  key={workout.id}
                  style={styles.calendarWorkoutItem}
                  onPress={() => handleWorkoutPress(workout.id)}
                >
                  <MiniEffortRing effortPoints={effortPoints} size={36} />
                  <View style={styles.calendarWorkoutInfo}>
                    <Text style={styles.calendarWorkoutType}>
                      {getWorkoutTypeName(workout.workoutType)}
                    </Text>
                    <Text style={styles.calendarWorkoutDate}>
                      {formatDate(workout.workoutDate)}
                    </Text>
                  </View>
                  <View style={styles.calendarWorkoutStats}>
                    <Text style={styles.calendarWorkoutSplit}>
                      {formatTime(workout.averageSplitSeconds)}
                    </Text>
                    <Text style={styles.calendarWorkoutDistance}>
                      {(workout.totalDistanceMetres / 1000).toFixed(1)}km
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          {myWorkouts.filter((w) => {
            const d = new Date(w.workoutDate);
            return (
              d.getMonth() === selectedMonth.getMonth() &&
              d.getFullYear() === selectedMonth.getFullYear()
            );
          }).length === 0 && (
            <Text style={styles.noWorkoutsText}>
              No workouts this month
            </Text>
          )}
        </View>
      </ScrollView>
    );
  };

  // Calculate stats
  const totalWorkouts = myWorkouts.length;
  const totalMetres = myWorkouts.reduce((sum, w) => sum + w.totalDistanceMetres, 0);
  const totalTime = myWorkouts.reduce((sum, w) => sum + w.totalTimeSeconds, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Workouts</Text>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.viewToggleButton, viewMode === 'list' && styles.viewToggleButtonActive]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons
              name="list"
              size={18}
              color={viewMode === 'list' ? colors.textInverse : colors.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewToggleButton, viewMode === 'calendar' && styles.viewToggleButtonActive]}
            onPress={() => setViewMode('calendar')}
          >
            <Ionicons
              name="calendar"
              size={18}
              color={viewMode === 'calendar' ? colors.textInverse : colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats summary */}
      {totalWorkouts > 0 && viewMode === 'list' && (
        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalWorkouts}</Text>
            <Text style={styles.statLabel}>Workouts</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {(totalMetres / 1000).toFixed(1)}km
            </Text>
            <Text style={styles.statLabel}>Total Distance</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {Math.floor(totalTime / 3600)}h {Math.floor((totalTime % 3600) / 60)}m
            </Text>
            <Text style={styles.statLabel}>Total Time</Text>
          </View>
        </View>
      )}

      {/* Content based on view mode */}
      {myWorkoutsLoading && myWorkouts.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : viewMode === 'calendar' ? (
        renderCalendar()
      ) : (
        <FlatList
          data={myWorkouts}
          keyExtractor={(item) => item.id}
          renderItem={renderWorkout}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={renderEmpty}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundTertiary,
    borderRadius: borderRadius.md,
    padding: 2,
  },
  viewToggleButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  viewToggleButtonActive: {
    backgroundColor: colors.primary,
  },
  stats: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  workoutItem: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  workoutContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  workoutMain: {
    flex: 1,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  workoutType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  workoutTypeName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  pbBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.pbGold,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  pbText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.black,
  },
  workoutMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  privateBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutDate: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
  },
  workoutMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  metricLabel: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxl * 2,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  // Calendar styles
  calendarContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  monthTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  monthNavButton: {
    padding: spacing.xs,
  },
  weekdayHeader: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textTertiary,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    ...shadows.sm,
  },
  calendarCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  calendarCellToday: {
    backgroundColor: colors.primarySubtle,
    borderRadius: borderRadius.md,
  },
  calendarDayText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  calendarDayTextToday: {
    color: colors.primary,
    fontWeight: fontWeight.bold,
  },
  calendarDayTextInactive: {
    color: colors.textTertiary,
  },
  calendarDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 2,
  },
  calendarWorkoutCount: {
    fontSize: 8,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
    position: 'absolute',
    bottom: 2,
    right: 4,
  },
  monthWorkouts: {
    marginTop: spacing.lg,
    marginBottom: spacing.xxl,
  },
  monthWorkoutsTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  calendarWorkoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
    ...shadows.sm,
  },
  calendarWorkoutInfo: {
    flex: 1,
  },
  calendarWorkoutType: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  calendarWorkoutDate: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginTop: 2,
  },
  calendarWorkoutStats: {
    alignItems: 'flex-end',
  },
  calendarWorkoutSplit: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  calendarWorkoutDistance: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginTop: 2,
  },
  noWorkoutsText: {
    fontSize: fontSize.md,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
});
