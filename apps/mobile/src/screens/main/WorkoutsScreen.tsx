import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '../../constants/theme';
import { useWorkoutStore, Workout } from '../../stores/workoutStore';
import { api } from '../../services/api';
import type { MainTabScreenProps } from '../../navigation/types';

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

export const WorkoutsScreen: React.FC = () => {
  const navigation = useNavigation<MainTabScreenProps<'Workouts'>['navigation']>();
  const { myWorkouts, myWorkoutsLoading, setMyWorkouts, setMyWorkoutsLoading } =
    useWorkoutStore();
  const [refreshing, setRefreshing] = useState(false);

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

  const renderWorkout = ({ item }: { item: Workout }) => (
    <TouchableOpacity
      style={styles.workoutItem}
      onPress={() => handleWorkoutPress(item.id)}
      activeOpacity={0.8}
    >
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
        <Text style={styles.workoutDate}>{formatDate(item.workoutDate)}</Text>
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
        {item.effortScore && (
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{item.effortScore.toFixed(1)}</Text>
            <Text style={styles.metricLabel}>Effort</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

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

  // Calculate stats
  const totalWorkouts = myWorkouts.length;
  const totalMetres = myWorkouts.reduce((sum, w) => sum + w.totalDistanceMetres, 0);
  const totalTime = myWorkouts.reduce((sum, w) => sum + w.totalTimeSeconds, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Workouts</Text>
      </View>

      {/* Stats summary */}
      {totalWorkouts > 0 && (
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

      {/* Workouts list */}
      {myWorkoutsLoading && myWorkouts.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
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
});
