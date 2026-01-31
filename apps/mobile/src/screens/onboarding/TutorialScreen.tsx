import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../../constants/theme';
import { useAuthStore } from '../../stores/authStore';

const { width } = Dimensions.get('window');

interface TutorialSlide {
  id: string;
  icon: string;
  title: string;
  description: string;
}

const slides: TutorialSlide[] = [
  {
    id: '1',
    icon: '📸',
    title: 'Snap your screen',
    description:
      'After your workout, take a photo of your erg screen. UTx handles the rest.',
  },
  {
    id: '2',
    icon: '🤖',
    title: 'We do the rest',
    description:
      'Our AI reads the data from your photo - time, distance, splits, heart rate, everything.',
  },
  {
    id: '3',
    icon: '📈',
    title: 'Track your progress',
    description:
      'See your PBs, get coaching insights, and compare with your squad.',
  },
];

export const TutorialScreen: React.FC = () => {
  const { setOnboardingComplete } = useAuthStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentIndex(index);
  };

  const handleGetStarted = () => {
    // Complete onboarding and navigate to main app
    setOnboardingComplete(true);
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
        <Text style={styles.icon}>{item.icon}</Text>
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
        <Text style={styles.progressText}>6 of 6</Text>
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
        />
        {currentIndex < slides.length - 1 && (
          <Button
            title="Skip Tutorial"
            onPress={handleGetStarted}
            variant="ghost"
            size="md"
            fullWidth
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
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  icon: {
    fontSize: 56,
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
    backgroundColor: colors.surface,
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
