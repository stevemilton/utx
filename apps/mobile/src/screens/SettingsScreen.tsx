import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight } from '../constants/theme';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user, logout } = useAuthStore();

  const [stravaConnected, setStravaConnected] = useState(false);
  const [stravaAutoSync, setStravaAutoSync] = useState(true);
  const [loading, setLoading] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [isProfilePublic, setIsProfilePublic] = useState(user?.isPublic ?? true);

  useEffect(() => {
    checkStravaStatus();
  }, []);

  useEffect(() => {
    if (user?.isPublic !== undefined) {
      setIsProfilePublic(user.isPublic);
    }
  }, [user?.isPublic]);

  const handlePrivacyToggle = async (value: boolean) => {
    setIsProfilePublic(value);
    try {
      await api.updateProfile({ isPublic: value });
    } catch (error) {
      console.error('Error updating privacy setting:', error);
      setIsProfilePublic(!value); // Revert on error
      Alert.alert('Error', 'Failed to update privacy setting');
    }
  };

  const checkStravaStatus = async () => {
    try {
      const response = await api.getStravaStatus();
      if (response.success && response.data) {
        setStravaConnected(response.data.connected);
        setStravaAutoSync(response.data.autoSync);
      }
    } catch (error) {
      console.error('Error checking Strava status:', error);
    }
  };

  const handleAutoSyncToggle = async (value: boolean) => {
    setStravaAutoSync(value);
    try {
      const response = await api.updateStravaSettings(value);
      if (!response.success) {
        setStravaAutoSync(!value); // Revert on error
        Alert.alert('Error', 'Failed to update auto-sync setting');
      }
    } catch (error) {
      console.error('Error updating auto-sync:', error);
      setStravaAutoSync(!value); // Revert on error
      Alert.alert('Error', 'Failed to update auto-sync setting');
    }
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
        setLoading(true);
        const response = await api.getStravaAuthUrl();
        if (response.success && response.data?.url) {
          Linking.openURL(response.data.url);
        }
      } catch (error) {
        console.error('Error getting Strava auth URL:', error);
        Alert.alert('Error', 'Failed to connect to Strava');
      } finally {
        setLoading(false);
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
          onPress: () => {
            logout();
          },
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
              [
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          },
        },
      ]
    );
  };

  const SettingRow: React.FC<{
    title: string;
    subtitle?: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
    danger?: boolean;
  }> = ({ title, subtitle, onPress, rightElement, danger }) => (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, danger && styles.dangerText]}>
          {title}
        </Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {rightElement || (onPress && <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />)}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <View style={styles.sectionContent}>
            <SettingRow
              title="Edit Profile"
              subtitle="Name, weight, height, max HR"
              onPress={() => {
                navigation.navigate('EditProfile' as never);
              }}
            />
            <SettingRow
              title="Change Photo"
              onPress={() => {
                navigation.navigate('EditProfile' as never);
              }}
            />
          </View>
        </View>

        {/* Privacy */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          <View style={styles.sectionContent}>
            <SettingRow
              title="Public Profile"
              subtitle={isProfilePublic ? 'Anyone can find and follow you' : 'Only you can see your profile'}
              rightElement={
                <Switch
                  value={isProfilePublic}
                  onValueChange={handlePrivacyToggle}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              }
            />
          </View>
        </View>

        {/* Social */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Social</Text>
          <View style={styles.sectionContent}>
            <SettingRow
              title="Find Athletes"
              subtitle="Search and follow other rowers"
              onPress={() => {
                navigation.navigate('AthleteSearch' as never);
              }}
            />
          </View>
        </View>

        {/* Club */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Club</Text>
          <View style={styles.sectionContent}>
            <SettingRow
              title="Change Club"
              subtitle="Find or join a club"
              onPress={() => {
                navigation.navigate('ClubSearch' as never);
              }}
            />
          </View>
        </View>

        {/* Connected Accounts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connected Accounts</Text>
          <View style={styles.sectionContent}>
            <SettingRow
              title="Strava"
              subtitle={stravaConnected ? 'Connected - tap to disconnect' : 'Connect to sync workouts'}
              onPress={handleConnectStrava}
              rightElement={
                loading ? (
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
            {stravaConnected && (
              <SettingRow
                title="Auto-sync Workouts"
                subtitle="Automatically push new workouts to Strava"
                rightElement={
                  <Switch
                    value={stravaAutoSync}
                    onValueChange={handleAutoSyncToggle}
                    trackColor={{ false: colors.border, true: colors.primary }}
                  />
                }
              />
            )}
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.sectionContent}>
            <SettingRow
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
              title="Help & FAQ"
              onPress={() => Linking.openURL('https://utx.app/help')}
            />
            <SettingRow
              title="Contact Support"
              onPress={() => Linking.openURL('mailto:support@utx.app')}
            />
            <SettingRow
              title="Privacy Policy"
              onPress={() => Linking.openURL('https://utx.app/privacy')}
            />
            <SettingRow
              title="Terms of Service"
              onPress={() => Linking.openURL('https://utx.app/terms')}
            />
          </View>
        </View>

        {/* Account Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.sectionContent}>
            <SettingRow
              title="Log Out"
              onPress={handleLogout}
            />
            <SettingRow
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
  scrollContent: {
    paddingBottom: spacing.xl * 2,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textTertiary,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionContent: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    marginTop: spacing.xs,
  },
  dangerText: {
    color: colors.error,
  },
  chevron: {
    fontSize: 24,
    color: colors.textTertiary,
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
});
