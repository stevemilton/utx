import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../../constants/theme';
import { api } from '../../services/api';
import type { MainTabScreenProps } from '../../navigation/types';

type LeaderboardScope = 'global' | 'club' | 'squad' | 'following';
type LeaderboardMetric = 'total_metres_monthly' | 'best_2k' | 'best_5k' | 'best_10k';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  value: number;
  formattedValue: string;
  isCurrentUser?: boolean;
}

// Format time helper
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
};

export const LeaderboardScreen: React.FC = () => {
  const navigation = useNavigation<MainTabScreenProps<'Leaderboard'>['navigation']>();
  const [scope, setScope] = useState<LeaderboardScope>('global');
  const [metric, setMetric] = useState<LeaderboardMetric>('total_metres_monthly');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      const response = await api.getLeaderboard(scope, metric);

      if (response.success && response.data) {
        setEntries(response.data as LeaderboardEntry[]);
      }
    } catch (error) {
      console.error('Leaderboard load error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, [scope, metric]);

  const handleUserPress = (userId: string) => {
    navigation.navigate('UserProfile', { userId });
  };

  const scopeOptions: { key: LeaderboardScope; label: string }[] = [
    { key: 'global', label: 'Global' },
    { key: 'club', label: 'Club' },
    { key: 'squad', label: 'Squad' },
    { key: 'following', label: 'Following' },
  ];

  const metricOptions: { key: LeaderboardMetric; label: string }[] = [
    { key: 'total_metres_monthly', label: 'Monthly Metres' },
    { key: 'best_2k', label: '2K Best' },
    { key: 'best_5k', label: '5K Best' },
    { key: 'best_10k', label: '10K Best' },
  ];

  const renderEntry = ({ item }: { item: LeaderboardEntry }) => (
    <TouchableOpacity
      style={[styles.entry, item.isCurrentUser && styles.entryCurrentUser]}
      onPress={() => handleUserPress(item.userId)}
      activeOpacity={0.8}
    >
      {/* Rank */}
      <View style={styles.rankContainer}>
        {item.rank <= 3 ? (
          <Text style={styles.rankMedal}>
            {item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : '🥉'}
          </Text>
        ) : (
          <Text style={styles.rank}>{item.rank}</Text>
        )}
      </View>

      {/* User */}
      <View style={styles.userInfo}>
        {item.userAvatarUrl ? (
          <Image source={{ uri: item.userAvatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>
              {item.userName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Text
          style={[styles.userName, item.isCurrentUser && styles.userNameCurrent]}
        >
          {item.userName}
          {item.isCurrentUser && ' (You)'}
        </Text>
      </View>

      {/* Value */}
      <Text style={styles.value}>{item.formattedValue}</Text>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🏆</Text>
      <Text style={styles.emptyTitle}>No data yet</Text>
      <Text style={styles.emptyText}>
        {scope === 'club'
          ? 'Join a club to see club leaderboards'
          : scope === 'squad'
          ? 'Join a squad to see squad leaderboards'
          : scope === 'following'
          ? 'Follow other rowers to compete'
          : 'Be the first to set a record!'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Leaderboard</Text>
      </View>

      {/* Scope filter */}
      <View style={styles.filters}>
        {scopeOptions.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.filterButton,
              scope === option.key && styles.filterButtonActive,
            ]}
            onPress={() => setScope(option.key)}
          >
            <Text
              style={[
                styles.filterText,
                scope === option.key && styles.filterTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Metric filter */}
      <View style={styles.metricFilters}>
        {metricOptions.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.metricButton,
              metric === option.key && styles.metricButtonActive,
            ]}
            onPress={() => setMetric(option.key)}
          >
            <Text
              style={[
                styles.metricText,
                metric === option.key && styles.metricTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Leaderboard */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.userId}
          renderItem={renderEntry}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
  metricFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  metricButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '20',
  },
  metricText: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
  },
  metricTextActive: {
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  entryCurrentUser: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
  },
  rank: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
  },
  rankMedal: {
    fontSize: 24,
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarPlaceholder: {
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  userName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  userNameCurrent: {
    color: colors.primary,
  },
  value: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
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
    paddingHorizontal: spacing.xxl,
  },
});
