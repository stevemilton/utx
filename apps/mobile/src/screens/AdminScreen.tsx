import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../constants/theme';
import { api } from '../services/api';

interface ClubCreator {
  id: string;
  name: string;
  email?: string;
}

interface PendingClub {
  id: string;
  name: string;
  location?: string;
  inviteCode: string;
  createdAt: string;
  memberCount: number;
  creator: ClubCreator | null;
}

interface VerifiedClub {
  id: string;
  name: string;
  location?: string;
  verified: boolean;
  inviteCode: string;
  createdAt: string;
  memberCount: number;
  squadCount: number;
}

export const AdminScreen: React.FC = () => {
  const navigation = useNavigation();
  const [pendingClubs, setPendingClubs] = useState<PendingClub[]>([]);
  const [verifiedClubs, setVerifiedClubs] = useState<VerifiedClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [pendingRes, allRes] = await Promise.all([
        api.getPendingClubs(),
        api.getAllClubs(),
      ]);

      if (pendingRes.success && pendingRes.data) {
        setPendingClubs(pendingRes.data as PendingClub[]);
      }

      if (allRes.success && allRes.data) {
        const all = allRes.data as VerifiedClub[];
        setVerifiedClubs(all.filter(c => c.verified));
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
      Alert.alert('Error', 'Failed to load admin data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleVerify = async (club: PendingClub) => {
    Alert.alert(
      'Verify Club',
      `Are you sure you want to verify "${club.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Verify',
          onPress: async () => {
            setActionLoading(club.id);
            try {
              const response = await api.verifyClub(club.id);
              if (response.success) {
                Alert.alert('Success', `"${club.name}" has been verified`);
                fetchData();
              } else {
                Alert.alert('Error', response.error || 'Failed to verify club');
              }
            } catch (error) {
              console.error('Verify error:', error);
              Alert.alert('Error', 'Failed to verify club');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleReject = async (club: PendingClub) => {
    Alert.prompt(
      'Reject Club',
      `Enter a reason for rejecting "${club.name}" (optional):`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async (reason?: string) => {
            setActionLoading(club.id);
            try {
              const response = await api.rejectClub(club.id, reason);
              if (response.success) {
                Alert.alert('Success', `"${club.name}" has been rejected`);
                fetchData();
              } else {
                Alert.alert('Error', response.error || 'Failed to reject club');
              }
            } catch (error) {
              console.error('Reject error:', error);
              Alert.alert('Error', 'Failed to reject club');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderPendingClub = ({ item }: { item: PendingClub }) => (
    <View style={styles.clubCard}>
      <View style={styles.clubHeader}>
        <View style={styles.clubIcon}>
          <Text style={styles.clubIconText}>{item.name.charAt(0)}</Text>
        </View>
        <View style={styles.clubInfo}>
          <Text style={styles.clubName}>{item.name}</Text>
          {item.location && <Text style={styles.clubLocation}>{item.location}</Text>}
          <Text style={styles.clubMeta}>
            Created {formatDate(item.createdAt)}
          </Text>
          {item.creator && (
            <Text style={styles.clubCreator}>
              By: {item.creator.name} {item.creator.email ? `(${item.creator.email})` : ''}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.clubActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.verifyButton]}
          onPress={() => handleVerify(item)}
          disabled={actionLoading === item.id}
        >
          {actionLoading === item.id ? (
            <ActivityIndicator size="small" color={colors.textInverse} />
          ) : (
            <>
              <Ionicons name="checkmark" size={16} color={colors.textInverse} />
              <Text style={styles.verifyButtonText}>Verify</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => handleReject(item)}
          disabled={actionLoading === item.id}
        >
          <Ionicons name="close" size={16} color={colors.error} />
          <Text style={styles.rejectButtonText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderVerifiedClub = ({ item }: { item: VerifiedClub }) => (
    <View style={styles.verifiedClubCard}>
      <View style={styles.clubIcon}>
        <Text style={styles.clubIconText}>{item.name.charAt(0)}</Text>
      </View>
      <View style={styles.clubInfo}>
        <View style={styles.verifiedRow}>
          <Text style={styles.clubName}>{item.name}</Text>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
        </View>
        {item.location && <Text style={styles.clubLocation}>{item.location}</Text>}
        <Text style={styles.clubMeta}>
          {item.memberCount} members · {item.squadCount} squads
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Panel</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <>
            {/* Pending Clubs Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Pending Verification ({pendingClubs.length})
              </Text>
              {pendingClubs.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="checkmark-circle-outline" size={48} color={colors.textTertiary} />
                  <Text style={styles.emptyText}>No pending clubs</Text>
                </View>
              ) : (
                pendingClubs.map(club => (
                  <View key={club.id}>
                    {renderPendingClub({ item: club })}
                  </View>
                ))
              )}
            </View>

            {/* Verified Clubs Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Verified Clubs ({verifiedClubs.length})
              </Text>
              {verifiedClubs.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No verified clubs yet</Text>
                </View>
              ) : (
                verifiedClubs.map(club => (
                  <View key={club.id}>
                    {renderVerifiedClub({ item: club })}
                  </View>
                ))
              )}
            </View>
          </>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  listContent: {
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  clubCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clubHeader: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  clubIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  clubIconText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  clubInfo: {
    flex: 1,
  },
  clubName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  clubLocation: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  clubMeta: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  clubCreator: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  clubActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  verifyButton: {
    backgroundColor: colors.primary,
  },
  verifyButtonText: {
    color: colors.textInverse,
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.sm,
  },
  rejectButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.error,
  },
  rejectButtonText: {
    color: colors.error,
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.sm,
  },
  verifiedClubCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginTop: spacing.sm,
  },
});

export default AdminScreen;
