import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
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
  verified?: boolean;
}

export const ClubSearchScreen: React.FC = () => {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Club[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');

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

  const handleRequestToJoin = () => {
    if (!selectedClub) return;
    setShowMessageModal(true);
  };

  const handleSubmitRequest = async () => {
    if (!selectedClub) return;

    try {
      setIsRequesting(true);
      setShowMessageModal(false);

      const response = await api.requestToJoinClub(
        selectedClub.id,
        requestMessage.trim() || undefined
      );

      if (response.success) {
        Alert.alert(
          'Request Sent! 🎉',
          `Your request to join ${selectedClub.name} has been submitted. You'll be notified when an admin approves your request.`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert('Error', response.error || 'Failed to submit request');
      }
    } catch (error) {
      console.error('Join request error:', error);
      Alert.alert('Error', 'Failed to submit request. Please try again.');
    } finally {
      setIsRequesting(false);
      setRequestMessage('');
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
        <View style={styles.clubNameRow}>
          <Text style={styles.clubName}>{item.name}</Text>
          {item.verified && (
            <Ionicons name="checkmark-circle" size={16} color={colors.success} style={{ marginLeft: 4 }} />
          )}
        </View>
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
          Search for your rowing club to request membership
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

      {/* Request button */}
      {selectedClub && (
        <View style={styles.actions}>
          <Button
            title={isRequesting ? 'Requesting...' : `Request to Join ${selectedClub.name}`}
            onPress={handleRequestToJoin}
            variant="primary"
            size="lg"
            fullWidth
            disabled={isRequesting}
          />
          <Text style={styles.requestNote}>
            An admin will review your request
          </Text>
        </View>
      )}

      {/* Message Modal */}
      <Modal
        visible={showMessageModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMessageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Request to Join</Text>
            <Text style={styles.modalSubtitle}>
              Add an optional message to introduce yourself to the club admin
            </Text>

            <TextInput
              style={styles.messageInput}
              placeholder="e.g., I row at this club on Tuesday evenings..."
              placeholderTextColor={colors.textTertiary}
              value={requestMessage}
              onChangeText={setRequestMessage}
              multiline
              numberOfLines={3}
              maxLength={200}
            />

            <Text style={styles.charCount}>
              {requestMessage.length}/200
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowMessageModal(false);
                  setRequestMessage('');
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitButton}
                onPress={handleSubmitRequest}
              >
                <Text style={styles.modalSubmitText}>Send Request</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  clubNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  requestNote: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  modalSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  messageInput: {
    backgroundColor: colors.backgroundTertiary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: colors.backgroundTertiary,
  },
  modalCancelText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  modalSubmitButton: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
  },
  modalSubmitText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textInverse,
  },
});
