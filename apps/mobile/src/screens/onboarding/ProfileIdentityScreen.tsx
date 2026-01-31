import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Button, Input } from '../../components';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../../constants/theme';
import type { OnboardingScreenProps } from '../../navigation/types';

export const ProfileIdentityScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingScreenProps<'ProfileIdentity'>['navigation']>();
  const [displayName, setDisplayName] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleContinue = () => {
    if (!displayName.trim()) {
      Alert.alert('Name Required', 'Please enter your display name');
      return;
    }

    // Store in temporary state and continue
    // TODO: Save to store
    navigation.navigate('ProfilePhysical');
  };

  const handleSkip = () => {
    navigation.navigate('ProfilePhysical');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.progress}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '16%' }]} />
        </View>
        <Text style={styles.progressText}>1 of 6</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Let's set up your profile</Text>
        <Text style={styles.subtitle}>
          This is how you'll appear to other rowers
        </Text>

        {/* Avatar */}
        <TouchableOpacity style={styles.avatarContainer} onPress={handlePickImage}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>📷</Text>
              <Text style={styles.avatarHint}>Add photo</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Name input */}
        <Input
          label="Display Name"
          placeholder="Enter your name"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          autoComplete="name"
        />
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title="Continue"
          onPress={handleContinue}
          variant="primary"
          size="lg"
          fullWidth
        />
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
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
    marginBottom: spacing.xxl,
  },
  avatarContainer: {
    alignSelf: 'center',
    marginBottom: spacing.xxl,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  avatarHint: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
  },
  actions: {
    gap: spacing.md,
  },
  skipButton: {
    alignItems: 'center',
    padding: spacing.sm,
  },
  skipText: {
    fontSize: fontSize.md,
    color: colors.textTertiary,
  },
});
