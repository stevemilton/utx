import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors, spacing, fontSize, fontWeight } from '../constants/theme';
import { api } from '../services/api';
import type { RootStackScreenProps } from '../navigation/types';

interface Squad {
  id: string;
  name: string;
  memberCount: number;
}

interface ClubMember {
  id: string;
  name: string;
  avatarUrl?: string;
  totalMeters: number;
}

interface Club {
  id: string;
  name: string;
  location?: string;
  inviteCode: string;
  memberCount: number;
  weeklyMeters: number;
  monthlyMeters: number;
  squads: Squad[];
  topMembers: ClubMember[];
  isOwner: boolean;
  isMember: boolean;
}

export const ClubDetailScreen: React.FC = () => {
  const navigation = useNavigation<RootStackScreenProps<'ClubDetail'>['navigation']>();
  const route = useRoute<RootStackScreenProps<'ClubDetail'>['route']>();
  const { clubId } = route.params;

  const [club, setClub] = useState<Club | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchClub = useCallback(async () => {
    try {
      const response = await api.getClub(clubId);
      if (response.success && response.data) {
        setClub(response.data as Club);
      }
    } catch (error) {
      console.error('Error fetching club:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clubId]);

  useEffect(() => {
    fetchClub();
  }, [fetchClub]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchClub();
  };

  const handleJoin = async () => {
    setActionLoading(true);
    try {
      const response = await api.joinClub(clubId);
      if (response.success) {
        setClub((prev) => prev ? { ...prev, isMember: true, memberCount: prev.memberCount + 1 } : null);
      }
    } catch (error) {
      console.error('Error joining club:', error);
      Alert.alert('Error', 'Failed to join club');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeave = async () => {
    Alert.alert(
      'Leave Club',
      `Are you sure you want to leave ${club?.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const response = await api.leaveClub(clubId);
              if (response.success) {
                navigation.goBack();
              }
            } catch (error) {
              console.error('Error leaving club:', error);
              Alert.alert('Error', 'Failed to leave club');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const formatDistance = (meters: number): string => {
    if (meters >= 1000000) {
      return `${(meters / 1000000).toFixed(1)}M`;
    }
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)}K`;
    }
    return `${meters}`;
  };

  const navigateToSquad = (squadId: string) => {
    navigation.navigate('SquadDetail', { squadId });
  };

  const navigateToProfile = (userId: string) => {
    navigation.navigate('UserProfile', { userId });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Club</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!club) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Club</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Club not found</Text>
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
        <Text style={styles.headerTitle}>{club.name}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Club Info */}
        <View style={styles.clubHeader}>
          <View style={styles.clubIcon}>
            <Text style={styles.clubIconText}>
              {club.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.clubName}>{club.name}</Text>
          {club.location && (
            <Text style={styles.clubLocation}>{club.location}</Text>
          )}
        </View>

        {/* Join/Leave Button */}
        {!club.isOwner && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              club.isMember && styles.leaveButton,
            ]}
            onPress={club.isMember ? handleLeave : handleJoin}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color={club.isMember ? colors.error : colors.white} />
            ) : (
              <Text
                style={[
                  styles.actionButtonText,
                  club.isMember && styles.leaveButtonText,
                ]}
              >
                {club.isMember ? 'Leave Club' : 'Join Club'}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{club.memberCount}</Text>
            <Text style={styles.statLabel}>Members</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatDistance(club.weeklyMeters)}m</Text>
            <Text style={styles.statLabel}>This Week</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatDistance(club.monthlyMeters)}m</Text>
            <Text style={styles.statLabel}>This Month</Text>
          </View>
        </View>

        {/* Invite Code */}
        {club.isMember && (
          <View style={styles.inviteSection}>
            <Text style={styles.sectionTitle}>Invite Code</Text>
            <View style={styles.inviteCodeContainer}>
              <Text style={styles.inviteCode}>{club.inviteCode}</Text>
              <TouchableOpacity style={styles.copyButton}>
                <Text style={styles.copyButtonText}>Copy</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Squads */}
        {club.squads && club.squads.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Squads</Text>
            {club.squads.map((squad) => (
              <TouchableOpacity
                key={squad.id}
                style={styles.squadItem}
                onPress={() => navigateToSquad(squad.id)}
              >
                <View style={styles.squadInfo}>
                  <Text style={styles.squadName}>{squad.name}</Text>
                  <Text style={styles.squadMembers}>
                    {squad.memberCount} {squad.memberCount === 1 ? 'member' : 'members'}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Top Members */}
        {club.topMembers && club.topMembers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Members</Text>
            {club.topMembers.map((member, index) => (
              <TouchableOpacity
                key={member.id}
                style={styles.memberItem}
                onPress={() => navigateToProfile(member.id)}
              >
                <View style={styles.memberRank}>
                  <Text style={styles.rankText}>{index + 1}</Text>
                </View>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>
                    {member.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  <Text style={styles.memberDistance}>
                    {formatDistance(member.totalMeters)}m total
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
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
    flex: 1,
    textAlign: 'center',
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
  clubHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  clubIcon: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  clubIconText: {
    color: colors.white,
    fontSize: 36,
    fontWeight: fontWeight.bold,
  },
  clubName: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  clubLocation: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  actionButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: 24,
    alignSelf: 'center',
    marginBottom: spacing.lg,
    minWidth: 140,
    alignItems: 'center',
  },
  leaveButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.error,
  },
  actionButtonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  leaveButtonText: {
    color: colors.error,
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
  inviteSection: {
    marginBottom: spacing.lg,
  },
  inviteCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
  },
  inviteCode: {
    flex: 1,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    letterSpacing: 2,
  },
  copyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  copyButtonText: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
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
  squadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  squadInfo: {
    flex: 1,
  },
  squadName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  squadMembers: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  chevron: {
    fontSize: 24,
    color: colors.textTertiary,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  memberRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  rankText: {
    color: colors.white,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  memberAvatarText: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  memberDistance: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
