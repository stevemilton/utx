import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight } from '../constants/theme';
import { api } from '../services/api';
import type { RootStackScreenProps } from '../navigation/types';

interface SquadMember {
  id: string;
  name: string;
  avatarUrl?: string;
  role?: 'captain' | 'member';
  joinedAt?: string;
}

interface Squad {
  id: string;
  name: string;
  inviteCode?: string;
  club: {
    id: string;
    name: string;
    verified?: boolean;
  };
  memberCount: number;
  members: SquadMember[];
  isMember: boolean;
  isClubMember: boolean;
  userRole?: 'captain' | 'member' | null;
}

export const SquadDetailScreen: React.FC = () => {
  const navigation = useNavigation<RootStackScreenProps<'SquadDetail'>['navigation']>();
  const route = useRoute<RootStackScreenProps<'SquadDetail'>['route']>();
  const { squadId } = route.params;

  const [squad, setSquad] = useState<Squad | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchSquad = useCallback(async () => {
    try {
      const response = await api.getSquad(squadId);
      if (response.success && response.data) {
        setSquad(response.data as Squad);
      }
    } catch (error) {
      console.error('Error fetching squad:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [squadId]);

  useEffect(() => {
    fetchSquad();
  }, [fetchSquad]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchSquad();
  };

  const handleJoin = async () => {
    setActionLoading(true);
    try {
      const response = await api.joinSquad(squadId);
      if (response.success) {
        setSquad((prev) =>
          prev ? { ...prev, isMember: true, memberCount: prev.memberCount + 1 } : null
        );
      }
    } catch (error) {
      console.error('Error joining squad:', error);
      Alert.alert('Error', 'Failed to join squad');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeave = async () => {
    Alert.alert(
      'Leave Squad',
      `Are you sure you want to leave ${squad?.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const response = await api.leaveSquad(squadId);
              if (response.success) {
                navigation.goBack();
              }
            } catch (error) {
              console.error('Error leaving squad:', error);
              Alert.alert('Error', 'Failed to leave squad');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const navigateToProfile = (userId: string) => {
    navigation.navigate('UserProfile', { userId });
  };

  const navigateToClub = () => {
    if (squad?.club) {
      navigation.navigate('ClubDetail', { clubId: squad.club.id });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Squad</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!squad) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Squad</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Squad not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{squad.name}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Squad Info */}
        <View style={styles.squadHeader}>
          <View style={styles.squadIcon}>
            <Text style={styles.squadIconText}>
              {squad.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.squadName}>{squad.name}</Text>
          <TouchableOpacity onPress={navigateToClub}>
            <Text style={styles.clubName}>{squad.club.name}</Text>
          </TouchableOpacity>
        </View>

        {/* Join/Leave Button - only show if user is a club member */}
        {squad.isClubMember && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              squad.isMember && styles.leaveButton,
            ]}
            onPress={squad.isMember ? handleLeave : handleJoin}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator
                size="small"
                color={squad.isMember ? colors.error : colors.white}
              />
            ) : (
              <Text
                style={[
                  styles.actionButtonText,
                  squad.isMember && styles.leaveButtonText,
                ]}
              >
                {squad.isMember ? 'Leave Squad' : 'Join Squad'}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* Not a club member notice */}
        {!squad.isClubMember && (
          <View style={styles.notMemberNotice}>
            <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.notMemberText}>
              Join {squad.club.name} to become a member of this squad
            </Text>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{squad.memberCount}</Text>
            <Text style={styles.statLabel}>Members</Text>
          </View>
        </View>

        {/* Members */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Members</Text>
          {squad.members.map((member) => (
            <TouchableOpacity
              key={member.id}
              style={styles.memberItem}
              onPress={() => navigateToProfile(member.id)}
            >
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>
                  {member.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{member.name}</Text>
                {member.role === 'captain' && (
                  <View style={styles.captainBadge}>
                    <Text style={styles.captainBadgeText}>Captain</Text>
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          ))}

          {squad.members.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No members yet</Text>
              <Text style={styles.emptySubtext}>Be the first to join!</Text>
            </View>
          )}
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
  squadHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  squadIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  squadIconText: {
    color: colors.white,
    fontSize: 32,
    fontWeight: fontWeight.bold,
  },
  squadName: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  clubName: {
    fontSize: fontSize.md,
    color: colors.primary,
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
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  notMemberNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  notMemberText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  captainBadge: {
    backgroundColor: colors.primarySubtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
  captainBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    fontSize: fontSize.md,
    color: colors.textTertiary,
  },
});
