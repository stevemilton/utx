import React, { useState, useEffect, useCallback } from 'react';
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
import { WorkoutCard } from '../../components';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../../constants/theme';
import { useWorkoutStore, WorkoutSummary } from '../../stores/workoutStore';
import { api } from '../../services/api';
import type { MainTabScreenProps } from '../../navigation/types';

type FeedFilter = 'all' | 'squad' | 'following';

export const FeedScreen: React.FC = () => {
  const navigation = useNavigation<MainTabScreenProps<'Feed'>['navigation']>();
  const {
    feedWorkouts,
    squadFeedWorkouts,
    followingFeedWorkouts,
    feedLoading,
    setFeedWorkouts,
    setSquadFeedWorkouts,
    setFollowingFeedWorkouts,
    setFeedLoading,
    toggleReaction,
  } = useWorkoutStore();

  const [activeFilter, setActiveFilter] = useState<FeedFilter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const getCurrentFeed = (): WorkoutSummary[] => {
    switch (activeFilter) {
      case 'squad':
        return squadFeedWorkouts;
      case 'following':
        return followingFeedWorkouts;
      default:
        return feedWorkouts;
    }
  };

  const loadFeed = useCallback(async (filter: FeedFilter = activeFilter) => {
    try {
      setFeedLoading(true);
      const response = await api.getFeed(filter);

      if (response.success && response.data) {
        const workouts = response.data as WorkoutSummary[];
        switch (filter) {
          case 'squad':
            setSquadFeedWorkouts(workouts);
            break;
          case 'following':
            setFollowingFeedWorkouts(workouts);
            break;
          default:
            setFeedWorkouts(workouts);
        }
      }
    } catch (error) {
      console.error('Feed load error:', error);
    } finally {
      setFeedLoading(false);
    }
  }, [activeFilter]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadFeed();
    setRefreshing(false);
  };

  const handleFilterChange = (filter: FeedFilter) => {
    setActiveFilter(filter);
    loadFeed(filter);
  };

  const handleWorkoutPress = (workoutId: string) => {
    navigation.navigate('WorkoutDetail', { workoutId });
  };

  const handleReactionPress = async (workoutId: string) => {
    toggleReaction(workoutId);
    // TODO: Call API
    await api.addReaction(workoutId);
  };

  const handleCommentPress = (workoutId: string) => {
    navigation.navigate('Comments', { workoutId });
  };

  useEffect(() => {
    loadFeed();
  }, []);

  const renderWorkout = ({ item }: { item: WorkoutSummary }) => (
    <WorkoutCard
      workout={item}
      onPress={() => handleWorkoutPress(item.id)}
      onReactionPress={() => handleReactionPress(item.id)}
      onCommentPress={() => handleCommentPress(item.id)}
    />
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🚣</Text>
      <Text style={styles.emptyTitle}>No workouts yet</Text>
      <Text style={styles.emptyText}>
        {activeFilter === 'all'
          ? 'Add your first workout or follow other rowers to see their sessions'
          : activeFilter === 'squad'
          ? 'Join a squad to see workouts from your teammates'
          : 'Follow other rowers to see their workouts'}
      </Text>
    </View>
  );

  const filterOptions: { key: FeedFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'squad', label: 'Squad' },
    { key: 'following', label: 'Following' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Feed</Text>
      </View>

      {/* Filter tabs */}
      <View style={styles.filters}>
        {filterOptions.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.filterButton,
              activeFilter === option.key && styles.filterButtonActive,
            ]}
            onPress={() => handleFilterChange(option.key)}
          >
            <Text
              style={[
                styles.filterText,
                activeFilter === option.key && styles.filterTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Feed */}
      {feedLoading && getCurrentFeed().length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={getCurrentFeed()}
          keyExtractor={(item) => item.id}
          renderItem={renderWorkout}
          contentContainerStyle={styles.feedContent}
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
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  filterButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
  },
  filterText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.textPrimary,
  },
  feedContent: {
    paddingBottom: spacing.xxl,
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
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl * 2,
  },
  emptyIcon: {
    fontSize: 64,
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
    lineHeight: 24,
  },
});
