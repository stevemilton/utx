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

interface PersonalBest {
  category: string;
  timeSeconds?: number;
  distanceMetres?: number;
  achievedAt: string;
}

interface Club {
  id: string;
  name: string;
  location?: string;
  memberCount: number;
}

// Format time helper
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
};

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<MainTabScreenProps<'Profile'>['navigation']>();
  const { user, logout, updateProfile } = useAuthStore();
  const [pbs, setPbs] = useState<PersonalBest[]>([]);

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

  useEffect(() => {
    loadPbs();
    checkStravaStatus();
    loadUserClubs();
  }, []);

  const loadPbs = async () => {
    try {
      const response = await api.getPbs();
      if (response.success && response.data) {
        setPbs(response.data as PersonalBest[]);
      }
    } catch (error) {
      console.error('PBs load error:', error);
    }
  };

  const checkStravaStatus = async () => {
    if (user?.stravaConnected) {
      setStravaConnected(true);
    }
  };

  const loadUserClubs = async () => {
    // TODO: Load user's clubs from API
    // For now, using placeholder
  };

  const handleEditProfile = () => {
    navigation.navigate('EditProfile');
  };

  const handlePbPress = (category: string) => {
    navigation.navigate('PBHistory', { category });
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
    // TODO: Implement join club API call
    setUserClubs([...userClubs, club]);
    setShowClubModal(false);
    setClubSearchQuery('');
    setClubSearchResults([]);
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

  const pbCategories = [
    { key: '500m', label: '500m' },
    { key: '2000m', label: '2K' },
    { key: '5000m', label: '5K' },
    { key: '10000m', label: '10K' },
    { key: '1_minute', label: '1 Min' },
  ];

  const getPbValue = (category: string): string => {
    const pb = pbs.find((p) => p.category === category);
    if (!pb) return '—';
    if (pb.timeSeconds) return formatTime(pb.timeSeconds);
    if (pb.distanceMetres) return `${pb.distanceMetres}m`;
    return '—';
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

  const renderClubSearchItem = ({ item }: { item: Club }) => (
    <TouchableOpacity
      style={styles.clubSearchItem}
      onPress={() => handleJoinClub(item)}
    >
      <View style={styles.clubIcon}>
        <Text style={styles.clubIconText}>{item.name.charAt(0)}</Text>
      </View>
      <View style={styles.clubInfo}>
        <Text style={styles.clubName}>{item.name}</Text>
        {item.location && <Text style={styles.clubLocation}>{item.location}</Text>}
        <Text style={styles.clubMembers}>{item.memberCount} members</Text>
      </View>
      <Text style={styles.joinText}>Join</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => navigation.navigate('AthleteSearch' as never)}
          >
            <Ionicons name="search-outline" size={24} color={colors.textPrimary} />
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

        {/* Personal Bests */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Bests</Text>
          <View style={styles.pbGrid}>
            {pbCategories.map((cat) => (
              <TouchableOpacity
                key={cat.key}
                style={styles.pbItem}
                onPress={() => handlePbPress(cat.key)}
              >
                <Text style={styles.pbLabel}>{cat.label}</Text>
                <Text style={styles.pbValue}>{getPbValue(cat.key)}</Text>
              </TouchableOpacity>
            ))}
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
                <View key={club.id} style={styles.clubItem}>
                  <View style={styles.clubIcon}>
                    <Text style={styles.clubIconText}>{club.name.charAt(0)}</Text>
                  </View>
                  <View style={styles.clubInfo}>
                    <Text style={styles.clubName}>{club.name}</Text>
                    {club.location && (
                      <Text style={styles.clubLocation}>{club.location}</Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => handleLeaveClub(club.id)}>
                    <Text style={styles.leaveText}>Leave</Text>
                  </TouchableOpacity>
                </View>
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
              onPress={() => Linking.openURL('https://utx.app/help')}
            />
            <SettingRow
              iconName="chatbubble-outline"
              title="Contact Support"
              onPress={() => Linking.openURL('mailto:support@utx.app')}
            />
            <SettingRow
              iconName="lock-closed-outline"
              title="Privacy Policy"
              onPress={() => Linking.openURL('https://utx.app/privacy')}
            />
            <SettingRow
              iconName="document-text-outline"
              title="Terms of Service"
              onPress={() => Linking.openURL('https://utx.app/terms')}
            />
          </View>
        </View>

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
          <Text style={styles.tagline}>Every metre counts.</Text>
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
              <TouchableOpacity>
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
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
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
  pbGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pbItem: {
    backgroundColor: colors.backgroundTertiary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    minWidth: '30%',
    flex: 1,
    alignItems: 'center',
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  pbLabel: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  pbValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.primary,
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
  clubIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  joinText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
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
});
