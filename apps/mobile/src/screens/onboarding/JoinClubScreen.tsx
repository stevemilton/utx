import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Button, Input } from '../../components';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../../constants/theme';
import { api } from '../../services/api';
import type { OnboardingScreenProps } from '../../navigation/types';

interface Club {
  id: string;
  name: string;
  location?: string;
  memberCount: number;
}

export const JoinClubScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingScreenProps<'JoinClub'>['navigation']>();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Club[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);

    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const response = await api.searchClubs(query);

      if (response.success && response.data) {
        setSearchResults(response.data as Club[]);
      }
    } catch (error) {
      console.error('Club search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectClub = (club: Club) => {
    setSelectedClub(club);
  };

  const handleJoinClub = async () => {
    if (!selectedClub) return;

    // TODO: Implement join club flow
    // After joining, navigate to tutorial
    navigation.navigate('Tutorial');
  };

  const handleCreateClub = () => {
    // TODO: Implement create club flow
    navigation.navigate('Tutorial');
  };

  const handleSkip = () => {
    navigation.navigate('Tutorial');
  };

  const renderClubItem = ({ item }: { item: Club }) => (
    <TouchableOpacity
      style={[styles.clubItem, selectedClub?.id === item.id && styles.clubItemSelected]}
      onPress={() => handleSelectClub(item)}
    >
      <View style={styles.clubIcon}>
        <Text style={styles.clubIconText}>{item.name.charAt(0)}</Text>
      </View>
      <View style={styles.clubInfo}>
        <Text style={styles.clubName}>{item.name}</Text>
        {item.location && <Text style={styles.clubLocation}>{item.location}</Text>}
        <Text style={styles.clubMembers}>{item.memberCount} members</Text>
      </View>
      <View
        style={[styles.radio, selectedClub?.id === item.id && styles.radioSelected]}
      >
        {selectedClub?.id === item.id && <View style={styles.radioInner} />}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.progress}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '80%' }]} />
        </View>
        <Text style={styles.progressText}>4 of 5</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Join a club</Text>
        <Text style={styles.subtitle}>
          Connect with your rowing club to see squad workouts and leaderboards
        </Text>

        {/* Search */}
        <Input
          placeholder="Search for your club..."
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
            <Text style={styles.emptyText}>No clubs found</Text>
            <TouchableOpacity onPress={handleCreateClub}>
              <Text style={styles.createLink}>Create a new club</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            renderItem={renderClubItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Can't find club? */}
        {searchQuery.length === 0 && (
          <View style={styles.helpSection}>
            <Text style={styles.helpText}>Can't find your club?</Text>
            <TouchableOpacity onPress={handleCreateClub}>
              <Text style={styles.createLink}>Request to create a club</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {selectedClub ? (
          <Button
            title={`Join ${selectedClub.name}`}
            onPress={handleJoinClub}
            variant="primary"
            size="lg"
            fullWidth
          />
        ) : (
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xxl,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: colors.surface,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  listContent: {
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  clubItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
  },
  clubItemSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySubtle,
  },
  clubIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  clubIconText: {
    fontSize: fontSize.xl,
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
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.xxl,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
  },
  helpSection: {
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  helpText: {
    fontSize: fontSize.md,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  createLink: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  actions: {
    paddingTop: spacing.md,
  },
  skipButton: {
    alignItems: 'center',
    padding: spacing.md,
  },
  skipText: {
    fontSize: fontSize.md,
    color: colors.textTertiary,
  },
});
