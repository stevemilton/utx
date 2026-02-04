import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Switch,
  Alert,
  ActivityIndicator,
  Linking,
  TextInput,
  FlatList,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '../../constants/theme';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';
import type { MainTabScreenProps } from '../../navigation/types';

interface Club {
  id: string;
  name: string;
  location?: string;
  logoUrl?: string;
  memberCount: number;
}

// Mask email helper (e.g., s***e@example.com)
const maskEmail = (email: string): string => {
  if (!email) return '';
  const [local, domain] = email.split('@');
  if (!domain) return email;
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
};

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<MainTabScreenProps<'Profile'>['navigation']>();
  const { user, logout, updateProfile } = useAuthStore();

  // Settings state
  const [stravaConnected, setStravaConnected] = useState(false);
  const [stravaLoading, setStravaLoading] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);

  // Club management state
  const [showClubModal, setShowClubModal] = useState(false);
  const [clubSearchQuery, setClubSearchQuery] = useState('');
  const [clubSearchResults, setClubSearchResults] = useState<Club[]>([]);
  const [isSearchingClubs, setIsSearchingClubs] = useState(false);
  const [userClubs, setUserClubs] = useState<Club[]>([]);
  const [requestedClubIds, setRequestedClubIds] = useState<Set<string>>(new Set());
  const [joiningClubId, setJoiningClubId] = useState<string | null>(null);

  // Reset password modal state
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);

  useEffect(() => {
    checkStravaStatus();
    loadUserClubs();
  }, []);

  const checkStravaStatus = async () => {
    if (user?.stravaConnected) {
      setStravaConnected(true);
    }
  };

  const loadUserClubs = async () => {
    try {
      const response = await api.getMyClubs();
      if (response.success && response.data) {
        const data = response.data as { clubs: Array<{ id: string; name: string; location?: string; logoUrl?: string; role: string }> };
        setUserClubs(data.clubs.map(club => ({
          id: club.id,
          name: club.name,
          location: club.location,
          logoUrl: club.logoUrl,
          memberCount: 0, // Not returned by API but not needed for display
        })));
      }
    } catch (error) {
      console.error('Error loading user clubs:', error);
    }
  };

  const handleEditProfile = () => {
    navigation.navigate('EditProfile');
  };

  const handleConnectStrava = async () => {
    if (stravaConnected) {
      Alert.alert(
        'Disconnect Strava',
        'Are you sure you want to disconnect your Strava account?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disconnect',
            style: 'destructive',
            onPress: async () => {
              try {
                await api.disconnectStrava();
                setStravaConnected(false);
              } catch (error) {
                console.error('Error disconnecting Strava:', error);
              }
            },
          },
        ]
      );
    } else {
      try {
        setStravaLoading(true);
        const response = await api.getStravaAuthUrl();
        if (response.success && response.data?.url) {
          Linking.openURL(response.data.url);
        }
      } catch (error) {
        console.error('Error getting Strava auth URL:', error);
        Alert.alert('Error', 'Failed to connect to Strava');
      } finally {
        setStravaLoading(false);
      }
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => logout(),
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirm Deletion',
              'Type DELETE to confirm account deletion',
              [{ text: 'Cancel', style: 'cancel' }]
            );
          },
        },
      ]
    );
  };

  // Club management
  const handleClubSearch = async (query: string) => {
    setClubSearchQuery(query);

    if (query.length < 2) {
      setClubSearchResults([]);
      return;
    }

    try {
      setIsSearchingClubs(true);
      const response = await api.searchClubs(query);
      if (response.success && response.data) {
        setClubSearchResults(response.data as Club[]);
      }
    } catch (error) {
      console.error('Club search error:', error);
    } finally {
      setIsSearchingClubs(false);
    }
  };

  const handleJoinClub = async (club: Club) => {
    if (requestedClubIds.has(club.id) || joiningClubId === club.id) return;

    setJoiningClubId(club.id);

    try {
      const response = await api.requestToJoinClub(club.id);

      if (response.success) {
        // Mark as requested
        setRequestedClubIds(prev => new Set([...prev, club.id]));
        Alert.alert(
          'Request Sent!',
          `Your request to join ${club.name} has been submitted. You'll be notified when approved.`
        );
      } else {
        // Handle already member or pending cases
        if (response.error?.includes('already a member')) {
          Alert.alert('Already a Member', `You're already a member of ${club.name}!`);
          setRequestedClubIds(prev => new Set([...prev, club.id]));
        } else if (response.error?.includes('pending')) {
          Alert.alert('Request Pending', `You already have a pending request for ${club.name}.`);
          setRequestedClubIds(prev => new Set([...prev, club.id]));
        } else {
          Alert.alert('Error', response.error || 'Failed to submit request');
        }
      }
    } catch (error) {
      console.error('Join club error:', error);
      Alert.alert('Error', 'Failed to submit request. Please try again.');
    } finally {
      setJoiningClubId(null);
    }
  };

  const handleLeaveClub = (clubId: string) => {
    Alert.alert(
      'Leave Club',
      'Are you sure you want to leave this club?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            // TODO: Implement leave club API call
            setUserClubs(userClubs.filter((c) => c.id !== clubId));
          },
        },
      ]
    );
  };

  // Reset password handlers
  const handleResetPassword = async () => {
    if (!user?.email) return;

    setIsResettingPassword(true);
    setResetPasswordError(null);

    try {
      const response = await api.requestPasswordReset(user.email);
      if (response.success) {
        setResetPasswordSuccess(true);
      } else {
        setResetPasswordError(response.error || 'Something went wrong. Please try again.');
      }
    } catch (error) {
      setResetPasswordError('Something went wrong. Please try again.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleCloseResetModal = () => {
    setShowResetPasswordModal(false);
    setResetPasswordSuccess(false);
    setResetPasswordError(null);
  };

  const SettingRow: React.FC<{
    iconName?: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
    danger?: boolean;
  }> = ({ iconName, title, subtitle, onPress, rightElement, danger }) => (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={onPress}
      disabled={!onPress}
    >
      {iconName && (
        <View style={[styles.settingIcon, danger && styles.settingIconDanger]}>
          <Ionicons
            name={iconName}
            size={18}
            color={danger ? colors.error : colors.primary}
          />
        </View>
      )}
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, danger && styles.dangerText]}>
          {title}
        </Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {rightElement || (onPress && (
        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
      ))}
    </TouchableOpacity>
  );

  const renderClubSearchItem = ({ item }: { item: Club }) => {
    const isRequested = requestedClubIds.has(item.id);
    const isJoining = joiningClubId === item.id;

    return (
      <View style={styles.clubSearchItem}>
        <View style={styles.clubIcon}>
          <Text style={styles.clubIconText}>{item.name.charAt(0)}</Text>
        </View>
        <View style={styles.clubInfo}>
          <Text style={styles.clubName}>{item.name}</Text>
          {item.location && <Text style={styles.clubLocation}>{item.location}</Text>}
          <Text style={styles.clubMembers}>{item.memberCount} members</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.joinButton,
            isRequested && styles.joinButtonRequested,
          ]}
          onPress={() => handleJoinClub(item)}
          disabled={isRequested || isJoining}
        >
          {isJoining ? (
            <ActivityIndicator size="small" color={colors.textInverse} />
          ) : (
            <Text style={[
              styles.joinButtonText,
              isRequested && styles.joinButtonTextRequested,
            ]}>
              {isRequested ? 'Requested' : 'Join'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <TouchableOpacity
            style={styles.findAthletesButton}
            onPress={() => navigation.navigate('AthleteSearch' as never)}
          >
            <Ionicons name="person-add-outline" size={18} color={colors.primary} />
            <Text style={styles.findAthletesText}>Find Athletes</Text>
          </TouchableOpacity>
        </View>

        {/* Profile card */}
        <View style={styles.profileCard}>
          <TouchableOpacity style={styles.profileContent} onPress={handleEditProfile}>
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>
                  {user?.name?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <View style={styles.profileInfo}>
              <Text style={styles.userName}>{user?.name || 'Unknown'}</Text>
              <View style={styles.editTextRow}>
                <Text style={styles.editText}>Edit profile</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.primary} />
              </View>
            </View>
          </TouchableOpacity>

          {/* Stats */}
          <View style={styles.profileStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{user?.heightCm || '—'}cm</Text>
              <Text style={styles.statLabel}>Height</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{user?.weightKg || '—'}kg</Text>
              <Text style={styles.statLabel}>Weight</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{user?.maxHr || '—'}</Text>
              <Text style={styles.statLabel}>Max HR</Text>
            </View>
          </View>
        </View>

        {/* Clubs Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Clubs</Text>
            <TouchableOpacity onPress={() => setShowClubModal(true)}>
              <Text style={styles.addButton}>+ Add</Text>
            </TouchableOpacity>
          </View>
          {userClubs.length > 0 ? (
            <View style={styles.clubsList}>
              {userClubs.map((club) => (
                <TouchableOpacity
                  key={club.id}
                  style={styles.clubItem}
                  onPress={() => navigation.navigate('ClubDetail', { clubId: club.id })}
                  activeOpacity={0.7}
                >
                  {club.logoUrl ? (
                    <Image source={{ uri: club.logoUrl }} style={styles.clubLogo} />
                  ) : (
                    <View style={styles.clubIcon}>
                      <Text style={styles.clubIconText}>{club.name.charAt(0)}</Text>
                    </View>
                  )}
                  <View style={styles.clubInfo}>
                    <Text style={styles.clubName}>{club.name}</Text>
                    {club.location && (
                      <Text style={styles.clubLocation}>{club.location}</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <TouchableOpacity
              style={styles.emptyClubCard}
              onPress={() => setShowClubModal(true)}
            >
              <View style={styles.emptyClubIconContainer}>
                <Ionicons name="people-outline" size={32} color={colors.textTertiary} />
              </View>
              <Text style={styles.emptyClubText}>Join a club</Text>
              <Text style={styles.emptyClubSubtext}>
                Connect with your rowing club for squad workouts and leaderboards
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Connections */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connections</Text>
          <View style={styles.sectionContent}>
            <SettingRow
              iconName="fitness-outline"
              title="Strava"
              subtitle={stravaConnected ? 'Connected' : 'Connect to sync workouts'}
              onPress={handleConnectStrava}
              rightElement={
                stravaLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <View
                    style={[
                      styles.connectionStatus,
                      stravaConnected && styles.connected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.connectionStatusText,
                        stravaConnected && styles.connectedText,
                      ]}
                    >
                      {stravaConnected ? 'Connected' : 'Connect'}
                    </Text>
                  </View>
                )
              }
            />
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.sectionContent}>
            <SettingRow
              iconName="notifications-outline"
              title="Push Notifications"
              subtitle="Reactions, comments, club activity"
              rightElement={
                <Switch
                  value={pushNotifications}
                  onValueChange={setPushNotifications}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              }
            />
            <SettingRow
              iconName="mail-outline"
              title="Email Notifications"
              subtitle="Weekly summary, PB alerts"
              rightElement={
                <Switch
                  value={emailNotifications}
                  onValueChange={setEmailNotifications}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              }
            />
          </View>
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.sectionContent}>
            <SettingRow
              iconName="help-circle-outline"
              title="Help & FAQ"
              onPress={() => Linking.openURL('https://kind-lotus-435.notion.site/Help-2fcfeff7be008050ba24dc0ab0b51a5e')}
            />
            <SettingRow
              iconName="chatbubble-outline"
              title="Contact Support"
              onPress={() => Linking.openURL('mailto:support@polarindustries.co')}
            />
            {user?.email && (
              <SettingRow
                iconName="key-outline"
                title="Reset Password"
                onPress={() => setShowResetPasswordModal(true)}
              />
            )}
            <SettingRow
              iconName="lock-closed-outline"
              title="Privacy Policy"
              onPress={() => Linking.openURL('https://kind-lotus-435.notion.site/Privacy-Policy-2fcfeff7be0080718fccc8b94e22580d')}
            />
            <SettingRow
              iconName="document-text-outline"
              title="Terms of Service"
              onPress={() => Linking.openURL('https://kind-lotus-435.notion.site/Terms-and-Conditions-2fcfeff7be0080a986f2c832b177ddde')}
            />
          </View>
        </View>

        {/* Admin Panel - only visible to super admins */}
        {user?.isSuperAdmin && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Admin</Text>
            <View style={styles.sectionContent}>
              <SettingRow
                iconName="shield-checkmark-outline"
                title="Admin Panel"
                subtitle="Manage club verifications"
                onPress={() => navigation.navigate('Admin' as never)}
              />
            </View>
          </View>
        )}

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.sectionContent}>
            <SettingRow iconName="log-out-outline" title="Log Out" onPress={handleLogout} />
            <SettingRow
              iconName="warning-outline"
              title="Delete Account"
              danger
              onPress={handleDeleteAccount}
            />
          </View>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appName}>UTx</Text>
          <Text style={styles.appVersion}>Version 1.0.0</Text>
          <Text style={styles.tagline}>Every ERG Counts</Text>

          {/* Social Links */}
          <View style={styles.socialLinks}>
            <TouchableOpacity style={styles.socialButton} onPress={() => {}}>
              <Ionicons name="logo-twitter" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialButton} onPress={() => {}}>
              <Ionicons name="logo-instagram" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialButton} onPress={() => {}}>
              <Ionicons name="logo-tiktok" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialButton} onPress={() => {}}>
              <Ionicons name="logo-youtube" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Club Search Modal */}
      <Modal
        visible={showClubModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowClubModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowClubModal(false)}>
              <Text style={styles.modalClose}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Join a Club</Text>
            <View style={{ width: 60 }} />
          </View>

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search for your club..."
              placeholderTextColor={colors.textTertiary}
              value={clubSearchQuery}
              onChangeText={handleClubSearch}
              autoCapitalize="none"
            />
          </View>

          {isSearchingClubs ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : clubSearchQuery.length >= 2 && clubSearchResults.length === 0 ? (
            <View style={styles.emptySearchContainer}>
              <Text style={styles.emptySearchText}>No clubs found</Text>
              <TouchableOpacity onPress={() => {
                setShowClubModal(false);
                navigation.navigate('CreateClub');
              }}>
                <Text style={styles.createClubLink}>Request to create a club</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={clubSearchResults}
              keyExtractor={(item) => item.id}
              renderItem={renderClubSearchItem}
              contentContainerStyle={styles.searchResultsList}
              showsVerticalScrollIndicator={false}
            />
          )}

          {clubSearchQuery.length === 0 && (
            <View style={styles.searchHelpContainer}>
              <Text style={styles.searchHelpText}>
                Search for your rowing club to join and see squad workouts
              </Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        visible={showResetPasswordModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseResetModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleCloseResetModal}>
              <Text style={styles.modalClose}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Reset Password</Text>
            <View style={{ width: 60 }} />
          </View>

          <View style={styles.resetPasswordContent}>
            {resetPasswordSuccess ? (
              // Success State
              <>
                <View style={styles.resetSuccessIcon}>
                  <Ionicons name="checkmark-circle" size={64} color={colors.success} />
                </View>
                <Text style={styles.resetTitle}>Reset link sent!</Text>
                <Text style={styles.resetSubtitle}>
                  Check your email and follow the link to reset your password.
                </Text>
                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={handleCloseResetModal}
                >
                  <Text style={styles.resetButtonText}>Done</Text>
                </TouchableOpacity>
              </>
            ) : (
              // Initial State
              <>
                <View style={styles.resetIcon}>
                  <Ionicons name="mail-outline" size={48} color={colors.primary} />
                </View>
                <Text style={styles.resetTitle}>Reset Password</Text>
                <Text style={styles.resetSubtitle}>
                  We'll send a password reset link to:
                </Text>
                <Text style={styles.resetEmail}>{maskEmail(user?.email || '')}</Text>

                {resetPasswordError && (
                  <Text style={styles.resetError}>{resetPasswordError}</Text>
                )}

                <TouchableOpacity
                  style={[styles.resetButton, isResettingPassword && styles.resetButtonDisabled]}
                  onPress={handleResetPassword}
                  disabled={isResettingPassword}
                >
                  {isResettingPassword ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.resetButtonText}>Send Reset Link</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  findAthletesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  findAthletesText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  profileCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarPlaceholder: {
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  profileInfo: {
    marginLeft: spacing.md,
  },
  userName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  editTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  editText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    marginRight: 2,
  },
  profileStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  section: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  addButton: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  sectionContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  // Clubs styles
  clubsList: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  clubItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  clubLogo: {
    width: 44,
    height: 44,
    borderRadius: 8,
    marginRight: spacing.md,
  },
  clubIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  clubIconText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
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
  clubMembers: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
  },
  leaveText: {
    fontSize: fontSize.sm,
    color: colors.error,
    fontWeight: fontWeight.medium,
  },
  emptyClubCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyClubIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyClubText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  emptyClubSubtext: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  // Settings row styles
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderStrong,
  },
  settingIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  settingIconDanger: {
    backgroundColor: colors.errorLight,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  settingSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginTop: 2,
  },
  dangerText: {
    color: colors.error,
  },
  connectionStatus: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  connected: {
    backgroundColor: colors.successLight,
    borderColor: colors.success,
  },
  connectionStatusText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  connectedText: {
    color: colors.success,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  appName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  appVersion: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  tagline: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  socialLinks: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  socialButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
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
  modalClose: {
    fontSize: fontSize.md,
    color: colors.primary,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  searchContainer: {
    padding: spacing.lg,
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySearchContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.xxl,
  },
  emptySearchText: {
    fontSize: fontSize.md,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
  },
  createClubLink: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  searchResultsList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  clubSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  joinButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    minWidth: 80,
    alignItems: 'center',
  },
  joinButtonRequested: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  joinButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textInverse,
  },
  joinButtonTextRequested: {
    color: colors.textSecondary,
  },
  searchHelpContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  searchHelpText: {
    fontSize: fontSize.md,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  // Reset Password Modal styles
  resetPasswordContent: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  resetIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  resetSuccessIcon: {
    marginBottom: spacing.xl,
  },
  resetTitle: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  resetSubtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  resetEmail: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xl,
  },
  resetError: {
    fontSize: fontSize.sm,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  resetButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: borderRadius.lg,
    width: '100%',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  resetButtonDisabled: {
    opacity: 0.7,
  },
  resetButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
});
