import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input } from '../components';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../constants/theme';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';

export const EditProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user, updateProfile } = useAuthStore();

  const [username, setUsername] = useState(user?.username || '');
  const [name, setName] = useState(user?.name || '');
  const [heightCm, setHeightCm] = useState(user?.heightCm?.toString() || '');
  const [weightKg, setWeightKg] = useState(user?.weightKg?.toString() || '');
  const [maxHr, setMaxHr] = useState(user?.maxHr?.toString() || '');
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatarUrl || null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant photo library access to change your profile photo.'
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
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant camera access to take a profile photo.'
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleChangePhoto = () => {
    Alert.alert('Change Photo', 'Choose an option', [
      { text: 'Take Photo', onPress: handleTakePhoto },
      { text: 'Choose from Library', onPress: handlePickImage },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    setIsSaving(true);

    try {
      // Upload avatar if changed
      let newAvatarUrl = user?.avatarUrl;
      if (avatarUri && avatarUri !== user?.avatarUrl) {
        setIsUploadingPhoto(true);
        try {
          const uploadResponse = await api.uploadAvatar(avatarUri);
          if (uploadResponse.success && uploadResponse.data?.avatarUrl) {
            newAvatarUrl = uploadResponse.data.avatarUrl;
          }
        } catch (uploadError) {
          console.error('Avatar upload failed:', uploadError);
          // Continue with profile update even if avatar upload fails
        }
        setIsUploadingPhoto(false);
      }

      // Update profile
      const updates: Record<string, unknown> = {
        name: name.trim(),
      };

      // Add username if provided (or empty string to clear)
      if (username !== user?.username) {
        updates.username = username.trim() || '';
      }

      if (heightCm) {
        updates.heightCm = parseFloat(heightCm);
      }
      if (weightKg) {
        updates.weightKg = parseFloat(weightKg);
      }
      if (maxHr) {
        updates.maxHr = parseInt(maxHr, 10);
      }

      const response = await api.updateProfile(updates);

      if (response.success && response.data) {
        // Update local state
        const responseData = response.data as { username?: string };
        updateProfile({
          username: responseData.username || undefined,
          name: name.trim(),
          heightCm: heightCm ? parseFloat(heightCm) : user?.heightCm || 0,
          weightKg: weightKg ? parseFloat(weightKg) : user?.weightKg || 0,
          maxHr: maxHr ? parseInt(maxHr, 10) : user?.maxHr || 0,
          avatarUrl: newAvatarUrl,
        });

        Alert.alert('Success', 'Profile updated!', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        // Show username-specific error
        if (response.error?.toLowerCase().includes('username')) {
          setUsernameError(response.error);
        } else {
          Alert.alert('Error', response.error || 'Failed to update profile');
        }
      }
    } catch (error) {
      console.error('Profile update error:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={isSaving}>
          <Text style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}>
            {isSaving ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Avatar */}
          <TouchableOpacity style={styles.avatarSection} onPress={handleChangePhoto}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={48} color={colors.textTertiary} />
              </View>
            )}
            <View style={styles.changePhotoButton}>
              <Ionicons name="camera" size={16} color={colors.textPrimary} />
            </View>
            <Text style={styles.changePhotoText}>Change Photo</Text>
          </TouchableOpacity>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Username</Text>
              <View style={styles.usernameInputWrapper}>
                <Text style={styles.usernamePrefix}>@</Text>
                <Input
                  placeholder="your_username"
                  value={username}
                  onChangeText={(text) => {
                    setUsernameError(null);
                    // Auto-sanitize: lowercase, remove invalid chars
                    setUsername(text.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.usernameInput}
                />
              </View>
              {usernameError ? (
                <Text style={styles.errorText}>{usernameError}</Text>
              ) : (
                <Text style={styles.hint}>
                  3-20 characters. Letters, numbers, and underscores only. Others can find you by @username.
                </Text>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Display Name</Text>
              <Input
                placeholder="Your name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
              <Text style={styles.hint}>
                This is how your name appears on your profile and workouts.
              </Text>
            </View>

            <View style={styles.row}>
              <View style={[styles.fieldGroup, styles.halfWidth]}>
                <Text style={styles.label}>Height (cm)</Text>
                <Input
                  placeholder="e.g., 180"
                  value={heightCm}
                  onChangeText={setHeightCm}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.fieldGroup, styles.halfWidth]}>
                <Text style={styles.label}>Weight (kg)</Text>
                <Input
                  placeholder="e.g., 75"
                  value={weightKg}
                  onChangeText={setWeightKg}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Max Heart Rate</Text>
              <Input
                placeholder="e.g., 190"
                value={maxHr}
                onChangeText={setMaxHr}
                keyboardType="numeric"
              />
              <Text style={styles.hint}>
                Used to calculate effort scores. If unsure, use 220 minus your age.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  saveButton: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhotoButton: {
    position: 'absolute',
    bottom: 24,
    right: '35%',
    backgroundColor: colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.background,
  },
  changePhotoText: {
    marginTop: spacing.sm,
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  form: {
    gap: spacing.lg,
  },
  fieldGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  hint: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.error,
    marginTop: spacing.xs,
  },
  usernameInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  usernamePrefix: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    marginRight: spacing.xs,
    fontWeight: fontWeight.medium,
  },
  usernameInput: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfWidth: {
    flex: 1,
  },
});
