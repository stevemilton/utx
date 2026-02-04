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
  Modal,
  TextInput,
  Clipboard,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, fontSize, fontWeight } from '../constants/theme';
import { api } from '../services/api';
import type { RootStackScreenProps } from '../navigation/types';
import { Button } from '../components/Button';
import { Input } from '../components/Input';

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
  role?: 'admin' | 'member';
  joinedAt?: string;
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
  logoUrl?: string;
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

  // Admin features state
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [selectedMember, setSelectedMember] = useState<ClubMember | null>(null);
  const [showMemberActions, setShowMemberActions] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

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

  // Admin functions
  const fetchMembers = useCallback(async () => {
    if (!club?.userRole || club.userRole !== 'admin') return;

    setLoadingMembers(true);
    try {
      const response = await api.getClubMembers(clubId);
      if (response.success && response.data) {
        setMembers(response.data as ClubMember[]);
      }
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoadingMembers(false);
    }
  }, [clubId, club?.userRole]);

  useEffect(() => {
    if (club?.userRole === 'admin') {
      fetchMembers();
    }
  }, [club?.userRole, fetchMembers]);

  const handleEditClub = () => {
    if (!club) return;
    setEditName(club.name);
    setEditLocation(club.location || '');
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      Alert.alert('Error', 'Club name is required');
      return;
    }

    setSavingEdit(true);
    try {
      const response = await api.updateClub(clubId, {
        name: editName.trim(),
        location: editLocation.trim() || undefined,
      });

      if (response.success) {
        setClub((prev) => prev ? { ...prev, name: editName.trim(), location: editLocation.trim() || undefined } : null);
        setShowEditModal(false);
        Alert.alert('Success', 'Club updated successfully');
      } else {
        Alert.alert('Error', response.error || 'Failed to update club');
      }
    } catch (error) {
      console.error('Error updating club:', error);
      Alert.alert('Error', 'Failed to update club');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleRegenerateCode = () => {
    Alert.alert(
      'Regenerate Invite Code?',
      'This will invalidate the current code. Members using the old code won\'t be able to join.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          onPress: async () => {
            setActionLoading(true);
            try {
              const response = await api.regenerateInviteCode(clubId);
              if (response.success && response.data) {
                const newCode = (response.data as { inviteCode: string }).inviteCode;
                setClub((prev) => prev ? { ...prev, inviteCode: newCode } : null);
                Alert.alert('Success', `New invite code: ${newCode}`);
              } else {
                Alert.alert('Error', response.error || 'Failed to regenerate code');
              }
            } catch (error) {
              console.error('Error regenerating code:', error);
              Alert.alert('Error', 'Failed to regenerate code');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteClub = () => {
    Alert.alert(
      'Delete Club?',
      `This will permanently delete "${club?.name}" and remove all members. This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const response = await api.deleteClub(clubId);
              if (response.success) {
                navigation.goBack();
              } else {
                Alert.alert('Error', response.error || 'Failed to delete club');
              }
            } catch (error) {
              console.error('Error deleting club:', error);
              Alert.alert('Error', 'Failed to delete club');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleCopyCode = () => {
    if (club?.inviteCode) {
      Clipboard.setString(club.inviteCode);
      Alert.alert('Copied!', 'Invite code copied to clipboard');
    }
  };

  const handleChangeLogo = async () => {
    if (club?.userRole !== 'admin') return;

    Alert.alert('Change Logo', 'Choose an option', [
      { text: 'Take Photo', onPress: handleTakeLogo },
      { text: 'Choose from Library', onPress: handlePickLogo },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handlePickLogo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant photo library access to change the club logo.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadLogo(result.assets[0].uri);
    }
  };

  const handleTakeLogo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant camera access to take a club logo photo.'
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadLogo(result.assets[0].uri);
    }
  };

  const uploadLogo = async (imageUri: string) => {
    setUploadingLogo(true);
    try {
      const response = await api.uploadClubLogo(clubId, imageUri);
      if (response.success && response.data?.logoUrl) {
        setClub((prev) => prev ? { ...prev, logoUrl: response.data.logoUrl } : null);
        Alert.alert('Success', 'Club logo updated!');
      } else {
        Alert.alert('Error', response.error || 'Failed to upload logo');
      }
    } catch (error) {
      console.error('Logo upload error:', error);
      Alert.alert('Error', 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleMemberPress = (member: ClubMember) => {
    if (club?.userRole !== 'admin') {
      navigateToProfile(member.id);
      return;
    }
    setSelectedMember(member);
    setShowMemberActions(true);
  };

  const handleChangeRole = async (newRole: 'admin' | 'member') => {
    if (!selectedMember) return;

    setShowMemberActions(false);
    setActionLoading(true);
    try {
      const response = await api.changeMemberRole(clubId, selectedMember.id, newRole);
      if (response.success) {
        setMembers((prev) =>
          prev.map((m) => (m.id === selectedMember.id ? { ...m, role: newRole } : m))
        );
        Alert.alert('Success', `${selectedMember.name} is now ${newRole === 'admin' ? 'an admin' : 'a member'}`);
      } else {
        Alert.alert('Error', response.error || 'Failed to change role');
      }
    } catch (error) {
      console.error('Error changing role:', error);
      Alert.alert('Error', 'Failed to change role');
    } finally {
      setActionLoading(false);
      setSelectedMember(null);
    }
  };

  const handleRemoveMember = async () => {
    if (!selectedMember) return;

    Alert.alert(
      'Remove Member?',
      `Are you sure you want to remove ${selectedMember.name} from the club?`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setShowMemberActions(false) },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setShowMemberActions(false);
            setActionLoading(true);
            try {
              const response = await api.removeMember(clubId, selectedMember.id);
              if (response.success) {
                setMembers((prev) => prev.filter((m) => m.id !== selectedMember.id));
                setClub((prev) => prev ? { ...prev, memberCount: prev.memberCount - 1 } : null);
                Alert.alert('Success', `${selectedMember.name} has been removed`);
              } else {
                Alert.alert('Error', response.error || 'Failed to remove member');
              }
            } catch (error) {
              console.error('Error removing member:', error);
              Alert.alert('Error', 'Failed to remove member');
            } finally {
              setActionLoading(false);
              setSelectedMember(null);
            }
          },
        },
      ]
    );
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
          {club.userRole === 'admin' ? (
            <TouchableOpacity
              style={styles.clubLogoContainer}
              onPress={handleChangeLogo}
              disabled={uploadingLogo}
            >
              {uploadingLogo ? (
                <View style={styles.clubIcon}>
                  <ActivityIndicator size="small" color={colors.white} />
                </View>
              ) : club.logoUrl ? (
                <Image source={{ uri: club.logoUrl }} style={styles.clubLogo} />
              ) : (
                <View style={styles.clubIcon}>
                  <Text style={styles.clubIconText}>
                    {club.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.cameraOverlay}>
                <Ionicons name="camera" size={14} color={colors.white} />
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.clubLogoContainer}>
              {club.logoUrl ? (
                <Image source={{ uri: club.logoUrl }} style={styles.clubLogo} />
              ) : (
                <View style={styles.clubIcon}>
                  <Text style={styles.clubIconText}>
                    {club.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          )}
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
              <TouchableOpacity style={styles.copyButton} onPress={handleCopyCode}>
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

            {/* Admin: Regenerate Code */}
            {club.userRole === 'admin' && (
              <TouchableOpacity
                style={styles.regenerateCodeButton}
                onPress={handleRegenerateCode}
                disabled={actionLoading}
              >
                <Ionicons name="refresh-outline" size={18} color={colors.textSecondary} />
                <Text style={styles.regenerateCodeText}>Regenerate Invite Code</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Admin: Members List */}
        {club.userRole === 'admin' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>All Members ({members.length})</Text>
            </View>
            {loadingMembers ? (
              <View style={styles.memberLoadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : (
              members.map((member) => (
                <TouchableOpacity
                  key={member.id}
                  style={styles.adminMemberItem}
                  onPress={() => handleMemberPress(member)}
                >
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>
                      {member.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{member.name}</Text>
                    <View style={styles.memberMeta}>
                      {member.role === 'admin' && (
                        <View style={styles.adminBadge}>
                          <Text style={styles.adminBadgeText}>Admin</Text>
                        </View>
                      )}
                      {member.totalMeters > 0 && (
                        <Text style={styles.memberDistance}>
                          {formatDistance(member.totalMeters)}m
                        </Text>
                      )}
                    </View>
                  </View>
                  <Ionicons name="ellipsis-vertical" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Admin: Club Settings */}
        {club.userRole === 'admin' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Club Settings</Text>
            <TouchableOpacity style={styles.settingItem} onPress={handleEditClub}>
              <Ionicons name="create-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.settingText}>Edit Club Details</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.settingItem, styles.dangerSettingItem]}
              onPress={handleDeleteClub}
            >
              <Ionicons name="trash-outline" size={20} color={colors.error} />
              <Text style={[styles.settingText, styles.dangerText]}>Delete Club</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
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

      {/* Edit Club Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Club</Text>
            <TouchableOpacity onPress={handleSaveEdit} disabled={savingEdit}>
              {savingEdit ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.modalSave}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <Input
              label="Club Name"
              value={editName}
              onChangeText={setEditName}
              placeholder="Enter club name"
            />
            <View style={styles.inputSpacer} />
            <Input
              label="Location (optional)"
              value={editLocation}
              onChangeText={setEditLocation}
              placeholder="e.g., Sydney, Australia"
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Member Actions Modal */}
      <Modal
        visible={showMemberActions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMemberActions(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMemberActions(false)}
        >
          <View style={styles.actionSheet}>
            <Text style={styles.actionSheetTitle}>{selectedMember?.name}</Text>

            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                setShowMemberActions(false);
                if (selectedMember) navigateToProfile(selectedMember.id);
              }}
            >
              <Ionicons name="person-outline" size={20} color={colors.textPrimary} />
              <Text style={styles.actionSheetText}>View Profile</Text>
            </TouchableOpacity>

            {selectedMember?.role === 'member' && (
              <TouchableOpacity
                style={styles.actionSheetItem}
                onPress={() => handleChangeRole('admin')}
              >
                <Ionicons name="shield-outline" size={20} color={colors.primary} />
                <Text style={[styles.actionSheetText, { color: colors.primary }]}>
                  Make Admin
                </Text>
              </TouchableOpacity>
            )}

            {selectedMember?.role === 'admin' && (
              <TouchableOpacity
                style={styles.actionSheetItem}
                onPress={() => handleChangeRole('member')}
              >
                <Ionicons name="shield-outline" size={20} color={colors.textSecondary} />
                <Text style={styles.actionSheetText}>Remove Admin Role</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionSheetItem, styles.actionSheetDanger]}
              onPress={handleRemoveMember}
            >
              <Ionicons name="remove-circle-outline" size={20} color={colors.error} />
              <Text style={[styles.actionSheetText, styles.dangerText]}>Remove from Club</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionSheetItem, styles.actionSheetCancel]}
              onPress={() => setShowMemberActions(false)}
            >
              <Text style={styles.actionSheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  clubLogoContainer: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  clubLogo: {
    width: 80,
    height: 80,
    borderRadius: 16,
  },
  clubIcon: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clubIconText: {
    color: colors.white,
    fontSize: 36,
    fontWeight: fontWeight.bold,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: colors.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.background,
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
  // Admin styles
  regenerateCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  regenerateCodeText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberLoadingContainer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  adminMemberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  memberMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  adminBadge: {
    backgroundColor: colors.primarySubtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adminBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  settingText: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  dangerSettingItem: {
    backgroundColor: colors.error + '10',
  },
  dangerText: {
    color: colors.error,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalCancel: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  modalSave: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  modalContent: {
    padding: spacing.lg,
  },
  inputSpacer: {
    height: spacing.md,
  },
  // Action sheet styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  actionSheetTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  actionSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  actionSheetText: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  actionSheetDanger: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.lg,
  },
  actionSheetCancel: {
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    justifyContent: 'center',
  },
  actionSheetCancelText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
