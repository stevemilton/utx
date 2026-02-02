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
import { Ionicons } from '@expo/vector-icons';
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

interface JoinRequest {
  id: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requestedAt: string;
  rejectionReason?: string;
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
  userRole?: 'admin' | 'member';
  pendingRequestCount?: number;
  userJoinRequest?: JoinRequest;
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

  const handleRequestToJoin = async () => {
    setActionLoading(true);
    try {
      const response = await api.requestToJoinClub(clubId);
      if (response.success) {
        Alert.alert(
          'Request Sent! 🎉',
          'Your request has been submitted. You\'ll be notified when an admin approves it.',
        );
        // Update local state to show pending request
        setClub((prev) => prev ? {
          ...prev,
          userJoinRequest: {
            id: response.data?.requestId || '',
            status: 'pending',
            requestedAt: new Date().toISOString()
          }
        } : null);
      } else {
        Alert.alert('Error', response.error || 'Failed to send request');
      }
    } catch (error) {
      console.error('Error requesting to join:', error);
      Alert.alert('Error', 'Failed to send request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!club?.userJoinRequest) return;

    Alert.alert(
      'Cancel Request',
      'Are you sure you want to cancel your join request?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const response = await api.cancelJoinRequest(clubId, club.userJoinRequest!.id);
              if (response.success) {
                setClub((prev) => prev ? { ...prev, userJoinRequest: undefined } : null);
              }
            } catch (error) {
              console.error('Error cancelling request:', error);
              Alert.alert('Error', 'Failed to cancel request');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const navigateToJoinRequests = () => {
    navigation.navigate('ClubJoinRequests', { clubId, clubName: club?.name || 'Club' });
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
            <Ionicons name="close" size={24} color={colors.textSecondary} />
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
            <Ionicons name="close" size={24} color={colors.textSecondary} />
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
          <Ionicons name="close" size={24} color={colors.textSecondary} />
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

        {/* Admin: Pending Requests Badge */}
        {club.userRole === 'admin' && club.pendingRequestCount && club.pendingRequestCount > 0 && (
          <TouchableOpacity
            style={styles.pendingRequestsBanner}
            onPress={navigateToJoinRequests}
          >
            <View style={styles.pendingRequestsLeft}>
              <Ionicons name="people" size={20} color={colors.warning} />
              <Text style={styles.pendingRequestsText}>
                {club.pendingRequestCount} pending join request{club.pendingRequestCount > 1 ? 's' : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}

        {/* Join/Leave Button */}
        {!club.isOwner && (
          club.isMember ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.leaveButton]}
              onPress={handleLeave}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <Text style={[styles.actionButtonText, styles.leaveButtonText]}>
                  Leave Club
                </Text>
              )}
            </TouchableOpacity>
          ) : club.userJoinRequest?.status === 'pending' ? (
            <View style={styles.pendingRequestContainer}>
              <View style={styles.pendingBadge}>
                <Ionicons name="time-outline" size={16} color={colors.warning} />
                <Text style={styles.pendingBadgeText}>Request Pending</Text>
              </View>
              <TouchableOpacity
                style={styles.cancelRequestButton}
                onPress={handleCancelRequest}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color={colors.textSecondary} />
                ) : (
                  <Text style={styles.cancelRequestText}>Cancel Request</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : club.userJoinRequest?.status === 'rejected' ? (
            <View style={styles.rejectedContainer}>
              <View style={styles.rejectedBadge}>
                <Ionicons name="close-circle-outline" size={16} color={colors.error} />
                <Text style={styles.rejectedBadgeText}>Request Rejected</Text>
              </View>
              {club.userJoinRequest.rejectionReason && (
                <Text style={styles.rejectionReason}>
                  "{club.userJoinRequest.rejectionReason}"
                </Text>
              )}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleRequestToJoin}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.actionButtonText}>Request Again</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleRequestToJoin}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.actionButtonText}>Request to Join</Text>
              )}
            </TouchableOpacity>
          )
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

        {/* Invite Code & Admin Actions */}
        {club.isMember && (
          <View style={styles.inviteSection}>
            <Text style={styles.sectionTitle}>Invite Code</Text>
            <View style={styles.inviteCodeContainer}>
              <Text style={styles.inviteCode}>{club.inviteCode}</Text>
              <TouchableOpacity style={styles.copyButton}>
                <Text style={styles.copyButtonText}>Copy</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.inviteHint}>
              Share this code with athletes to let them join instantly
            </Text>

            {/* Admin: Manage Requests Link */}
            {club.userRole === 'admin' && (
              <TouchableOpacity
                style={styles.manageRequestsButton}
                onPress={navigateToJoinRequests}
              >
                <Ionicons name="people-outline" size={18} color={colors.primary} />
                <Text style={styles.manageRequestsText}>Manage Join Requests</Text>
                {club.pendingRequestCount && club.pendingRequestCount > 0 && (
                  <View style={styles.requestCountBadge}>
                    <Text style={styles.requestCountText}>{club.pendingRequestCount}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
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
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
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
  pendingRequestsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.warning + '15',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning + '30',
  },
  pendingRequestsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pendingRequestsText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  pendingRequestContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.warning + '15',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
  },
  pendingBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.warning,
  },
  cancelRequestButton: {
    paddingVertical: spacing.xs,
  },
  cancelRequestText: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    textDecorationLine: 'underline',
  },
  rejectedContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  rejectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.error + '15',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
  },
  rejectedBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.error,
  },
  rejectionReason: {
    fontSize: fontSize.sm,
    fontStyle: 'italic',
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
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
  inviteHint: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: spacing.sm,
  },
  manageRequestsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primarySubtle,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  manageRequestsText: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  requestCountBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  requestCountText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.white,
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
