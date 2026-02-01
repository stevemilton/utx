import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors, spacing, fontSize, fontWeight } from '../constants/theme';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import type { RootStackScreenProps } from '../navigation/types';

interface UserProfile {
  id: string;
  name: string;
  avatarUrl?: string;
  club?: { id: string; name: string };
  squad?: { id: string; name: string };
  totalMeters: number;
  totalWorkouts: number;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  pbs?: {
    two_thousand?: { time: number };
    five_thousand?: { time: number };
  };
}

export const UserProfileScreen: React.FC = () => {
  const navigation = useNavigation<RootStackScreenProps<'UserProfile'>['navigation']>();
  const route = useRoute<RootStackScreenProps<'UserProfile'>['route']>();
  const { userId } = route.params;
  const currentUser = useAuthStore((state) => state.user);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const isOwnProfile = currentUser?.id === userId;

  const fetchProfile = useCallback(async () => {
    try {
      const response = await api.getUserProfile(userId);
      if (response.success && response.data) {
        setProfile(response.data as UserProfile);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchProfile();
  };

  const handleFollow = async () => {
    if (!profile || followLoading) return;

    setFollowLoading(true);
    try {
      if (profile.isFollowing) {
        await api.unfollowUser(userId);
        setProfile({ ...profile, isFollowing: false, followersCount: profile.followersCount - 1 });
      } else {
        await api.followUser(userId);
        setProfile({ ...profile, isFollowing: true, followersCount: profile.followersCount + 1 });
      }
    } catch (error) {
      console.error('Error updating follow status:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  const formatDistance = (meters: number): string => {
    if (meters >= 1000000) {
      return `${(meters / 1000000).toFixed(1)}M m`;
    }
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)}K m`;
    }
    return `${meters} m`;
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Profile not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile.name?.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
          <Text style={styles.name}>{profile.name}</Text>
          {profile.club && (
            <Text style={styles.clubName}>
              {profile.club.name}
              {profile.squad && ` • ${profile.squad.name}`}
            </Text>
          )}
        </View>

        {/* Follow Button */}
        {!isOwnProfile && (
          <TouchableOpacity
            style={[
              styles.followButton,
              profile.isFollowing && styles.followingButton,
            ]}
            onPress={handleFollow}
            disabled={followLoading}
          >
            {followLoading ? (
              <ActivityIndicator size="small" color={profile.isFollowing ? colors.primary : colors.white} />
            ) : (
              <Text
                style={[
                  styles.followButtonText,
                  profile.isFollowing && styles.followingButtonText,
                ]}
              >
                {profile.isFollowing ? 'Following' : 'Follow'}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.totalWorkouts}</Text>
            <Text style={styles.statLabel}>Workouts</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatDistance(profile.totalMeters)}</Text>
            <Text style={styles.statLabel}>Total Distance</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.followersCount}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.followingCount}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
        </View>

        {/* Personal Bests */}
        {profile.pbs && (profile.pbs.two_thousand || profile.pbs.five_thousand) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Bests</Text>
            <View style={styles.pbsContainer}>
              {profile.pbs.two_thousand && (
                <View style={styles.pbItem}>
                  <Text style={styles.pbDistance}>2K</Text>
                  <Text style={styles.pbTime}>
                    {formatTime(profile.pbs.two_thousand.time)}
                  </Text>
                </View>
              )}
              {profile.pbs.five_thousand && (
                <View style={styles.pbItem}>
                  <Text style={styles.pbDistance}>5K</Text>
                  <Text style={styles.pbTime}>
                    {formatTime(profile.pbs.five_thousand.time)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: fontSize.md,
    color: colors.textTertiary,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    color: colors.white,
    fontSize: 32,
    fontWeight: fontWeight.bold,
  },
  name: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  clubName: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  followButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: 24,
    alignSelf: 'center',
    marginBottom: spacing.lg,
    minWidth: 120,
    alignItems: 'center',
  },
  followingButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  followButtonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  followingButtonText: {
    color: colors.primary,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  statValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  pbsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  pbItem: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
  },
  pbDistance: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  pbTime: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
});
