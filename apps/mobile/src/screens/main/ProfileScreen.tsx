import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../../constants/theme';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';
import type { MainTabScreenProps } from '../../navigation/types';

interface PersonalBest {
  category: string;
  timeSeconds?: number;
  distanceMetres?: number;
  achievedAt: string;
}

// Format time helper
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
};

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<MainTabScreenProps<'Profile'>['navigation']>();
  const { user, logout } = useAuthStore();
  const [pbs, setPbs] = useState<PersonalBest[]>([]);

  useEffect(() => {
    loadPbs();
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

  const handleSettings = () => {
    navigation.navigate('Settings');
  };

  const handleEditProfile = () => {
    navigation.navigate('EditProfile');
  };

  const handlePbPress = (category: string) => {
    navigation.navigate('PBHistory', { category });
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <TouchableOpacity onPress={handleSettings}>
            <Ionicons name="settings-outline" size={24} color={colors.textSecondary} />
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
              <Text style={styles.editText}>Edit profile →</Text>
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

        {/* Strava connection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connections</Text>
          <TouchableOpacity style={styles.connectionItem}>
            <View style={styles.connectionIcon}>
              <Ionicons name="fitness-outline" size={20} color={colors.textPrimary} />
            </View>
            <View style={styles.connectionInfo}>
              <Text style={styles.connectionName}>Strava</Text>
              <Text style={styles.connectionStatus}>
                {user?.stravaConnected ? 'Connected' : 'Not connected'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
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
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  settingsIcon: {
    fontSize: 24,
  },
  profileCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
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
  editText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    marginTop: spacing.xs,
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
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  pbGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pbItem: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    minWidth: '30%',
    flex: 1,
    alignItems: 'center',
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
  connectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  connectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  connectionInfo: {
    flex: 1,
  },
  connectionName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  connectionStatus: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
  },
  connectionArrow: {
    fontSize: fontSize.lg,
    color: colors.textTertiary,
  },
  actions: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  logoutButton: {
    alignItems: 'center',
    padding: spacing.md,
  },
  logoutText: {
    fontSize: fontSize.md,
    color: colors.error,
    fontWeight: fontWeight.medium,
  },
});
