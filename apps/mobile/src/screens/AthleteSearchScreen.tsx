import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../components';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../constants/theme';
import { api } from '../services/api';

interface Athlete {
  id: string;
  username?: string;
  name: string;
  avatarUrl?: string;
  isFollowing: boolean;
  _count: {
    workouts: number;
    followers: number;
  };
}

export const AthleteSearchScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Athlete[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [followingStates, setFollowingStates] = useState<Record<string, boolean>>({});

  const handleSearch = async (query: string) => {
    setSearchQuery(query);

    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const response = await api.searchUsers(query);

      if (response.success && response.data) {
        const athletes = response.data as Athlete[];
        setSearchResults(athletes);
        // Initialize following states
        const states: Record<string, boolean> = {};
        athletes.forEach((a) => {
          states[a.id] = a.isFollowing;
        });
        setFollowingStates(states);
      }
    } catch (error) {
      console.error('User search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleFollow = async (userId: string) => {
    const isCurrentlyFollowing = followingStates[userId];

    // Optimistic update
    setFollowingStates((prev) => ({ ...prev, [userId]: !isCurrentlyFollowing }));

    try {
      if (isCurrentlyFollowing) {
        await api.unfollowUser(userId);
      } else {
        await api.followUser(userId);
      }
    } catch (error) {
      // Revert on error
      setFollowingStates((prev) => ({ ...prev, [userId]: isCurrentlyFollowing }));
      console.error('Follow/unfollow error:', error);
    }
  };

  const handleViewProfile = (userId: string) => {
    navigation.navigate('UserProfile', { userId });
  };

  const renderAthleteItem = ({ item }: { item: Athlete }) => {
    const isFollowing = followingStates[item.id] ?? item.isFollowing;

    return (
      <TouchableOpacity
        style={styles.athleteItem}
        onPress={() => handleViewProfile(item.id)}
      >
        {item.avatarUrl ? (
          <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.athleteInfo}>
          <Text style={styles.athleteName}>{item.name}</Text>
          {item.username && (
            <Text style={styles.athleteUsername}>@{item.username}</Text>
          )}
          <Text style={styles.athleteStats}>
            {item._count.workouts} workouts · {item._count.followers} followers
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.followButton, isFollowing && styles.followingButton]}
          onPress={() => handleFollow(item.id)}
        >
          <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find Athletes</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.subtitle}>
          Search for athletes to follow and see their workouts in your feed
        </Text>

        {/* Search */}
        <Input
          placeholder="Search by name..."
          value={searchQuery}
          onChangeText={handleSearch}
          autoCapitalize="none"
        />

        {/* Search results */}
        {isSearching ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : searchQuery.length >= 2 && searchResults.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No athletes found</Text>
            <Text style={styles.emptyHint}>Try a different search term</Text>
          </View>
        ) : searchQuery.length < 2 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyText}>Search for athletes</Text>
            <Text style={styles.emptyHint}>Enter at least 2 characters to search</Text>
          </View>
        ) : (
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            renderItem={renderAthleteItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
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
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 24,
  },
  listContent: {
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  athleteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  athleteInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  athleteName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  athleteUsername: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 1,
  },
  athleteStats: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginTop: 2,
  },
  followButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  followingButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  followButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  followingButtonText: {
    color: colors.textSecondary,
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
    paddingTop: spacing.xxl,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptyHint: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
});
