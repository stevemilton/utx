import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input } from '../components';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../constants/theme';
import { api } from '../services/api';

interface Club {
  id: string;
  name: string;
  location?: string;
  memberCount: number;
}

export const ClubSearchScreen: React.FC = () => {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Club[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [isJoining, setIsJoining] = useState(false);

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

    try {
      setIsJoining(true);
      const response = await api.joinClub(selectedClub.id);

      if (response.success) {
        Alert.alert('Success', `You've joined ${selectedClub.name}!`, [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else {
        Alert.alert('Error', response.error || 'Failed to join club');
      }
    } catch (error) {
      console.error('Join club error:', error);
      Alert.alert('Error', 'Failed to join club. Please try again.');
    } finally {
      setIsJoining(false);
    }
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find a Club</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.subtitle}>
          Search for your rowing club to join and see squad workouts
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
            <Text style={styles.emptyHint}>Try a different search term</Text>
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

        {/* Helpful hint */}
        {searchQuery.length === 0 && (
          <View style={styles.helpSection}>
            <Ionicons name="search" size={48} color={colors.textTertiary} style={styles.helpIcon} />
            <Text style={styles.helpText}>Enter at least 2 characters to search</Text>
          </View>
        )}
      </View>

      {/* Join button */}
      {selectedClub && (
        <View style={styles.actions}>
          <Button
            title={isJoining ? 'Joining...' : `Join ${selectedClub.name}`}
            onPress={handleJoinClub}
            variant="primary"
            size="lg"
            fullWidth
            disabled={isJoining}
          />
        </View>
      )}
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
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
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
    backgroundColor: colors.primaryDark + '10',
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
    marginBottom: spacing.xs,
  },
  emptyHint: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
  },
  helpSection: {
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  helpIcon: {
    marginBottom: spacing.md,
  },
  helpText: {
    fontSize: fontSize.md,
    color: colors.textTertiary,
  },
  actions: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
