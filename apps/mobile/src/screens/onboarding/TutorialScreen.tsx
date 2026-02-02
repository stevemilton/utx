import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../../constants/theme';
import { useAuthStore } from '../../stores/authStore';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { api } from '../../services/api';

const { width } = Dimensions.get('window');

interface TutorialSlide {
  id: string;
  iconName: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}

const slides: TutorialSlide[] = [
  {
    id: '1',
    iconName: 'camera-outline',
    title: 'Snap your screen',
    description:
      'After your workout, take a photo of your erg screen. UTx handles the rest.',
  },
  {
    id: '2',
    iconName: 'sparkles-outline',
    title: 'We do the rest',
    description:
      'Our AI reads the data from your photo - time, distance, splits, heart rate, everything.',
  },
  {
    id: '3',
    iconName: 'trending-up-outline',
    title: 'Track your progress',
    description:
      'See your PBs, get coaching insights, and compare with your squad.',
  },
];

export const TutorialScreen: React.FC = () => {
  const { setOnboardingComplete, updateProfile } = useAuthStore();
  const { data: onboardingData, reset: resetOnboarding } = useOnboardingStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentIndex(index);
  };

  const handleGetStarted = async () => {
    setIsSaving(true);

    try {
      // Build profile update payload
      const profileUpdates: Record<string, unknown> = {};
      let avatarUrl: string | undefined;

      if (onboardingData.displayName) {
        profileUpdates.name = onboardingData.displayName;
      }
      if (onboardingData.heightCm > 0) {
        profileUpdates.heightCm = onboardingData.heightCm;
      }
      if (onboardingData.weightKg > 0) {
        profileUpdates.weightKg = onboardingData.weightKg;
      }
      if (onboardingData.birthDate) {
        profileUpdates.birthDate = onboardingData.birthDate;
      }
      if (onboardingData.gender) {
        profileUpdates.gender = onboardingData.gender;
      }
      if (onboardingData.maxHr > 0) {
        profileUpdates.maxHr = onboardingData.maxHr;
      }
      profileUpdates.hasCompletedOnboarding = true;

      // Upload avatar if provided during onboarding
      if (onboardingData.avatarUri) {
        try {
          const uploadResponse = await api.uploadAvatar(onboardingData.avatarUri);
          if (uploadResponse.success && uploadResponse.data?.avatarUrl) {
            avatarUrl = uploadResponse.data.avatarUrl;
          }
        } catch (uploadError) {
          console.error('Avatar upload failed:', uploadError);
          // Continue without avatar - user can add later
        }
      }

      // Save to backend
      const response = await api.updateProfile(profileUpdates);

      if (response.success) {
        // Update local auth store with the profile data
        updateProfile({
          name: onboardingData.displayName || undefined,
          heightCm: onboardingData.heightCm || undefined,
          weightKg: onboardingData.weightKg || undefined,
          birthDate: onboardingData.birthDate || undefined,
          gender: onboardingData.gender || undefined,
          maxHr: onboardingData.maxHr || undefined,
          avatarUrl: avatarUrl,
        });

        // Clear onboarding store
        resetOnboarding();

        // Complete onboarding and navigate to main app
        setOnboardingComplete(true);
      } else {
        Alert.alert('Error', 'Failed to save profile. Please try again.');
      }
    } catch (error) {
      console.error('Failed to save onboarding data:', error);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      handleGetStarted();
    }
  };

  const renderSlide = ({ item }: { item: TutorialSlide }) => (
    <View style={styles.slide}>
      <View style={styles.iconContainer}>
        <Ionicons name={item.iconName} size={56} color={colors.primary} />
      </View>
      <Text style={styles.slideTitle}>{item.title}</Text>
      <Text style={styles.slideDescription}>{item.description}</Text>
    </View>
  );

  const renderDot = (index: number) => (
    <View
      key={index}
      style={[styles.dot, currentIndex === index && styles.dotActive]}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.progress}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '100%' }]} />
        </View>
        <Text style={styles.progressText}>5 of 5</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.header}>Quick Tutorial</Text>

        <FlatList
          ref={flatListRef}
          data={slides}
          keyExtractor={(item) => item.id}
          renderItem={renderSlide}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        />

        {/* Dots */}
        <View style={styles.dots}>
          {slides.map((_, index) => renderDot(index))}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title={currentIndex === slides.length - 1 ? 'Get Started' : 'Next'}
          onPress={handleNext}
          variant="primary"
          size="lg"
          fullWidth
          loading={isSaving}
          disabled={isSaving}
        />
        {currentIndex < slides.length - 1 && (
          <Button
            title="Skip Tutorial"
            onPress={handleGetStarted}
            variant="ghost"
            size="md"
            fullWidth
            disabled={isSaving}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: colors.backgroundTertiary,
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
  header: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  slide: {
    width: width,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  slideTitle: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  slideDescription: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 28,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.backgroundTertiary,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 24,
  },
  actions: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
});
