import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../components';
import { colors, spacing, fontSize, fontWeight } from '../../constants/theme';
import type { AuthScreenProps } from '../../navigation/types';

export const WelcomeScreen: React.FC = () => {
  const navigation = useNavigation<AuthScreenProps<'Welcome'>['navigation']>();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Tagline */}
        <Text style={styles.tagline}>Every ERG Counts</Text>

        {/* Description */}
        <Text style={styles.description}>
          Turn your erg screen photos into structured training data with AI-powered
          analysis.
        </Text>
      </View>

      {/* Buttons */}
      <View style={styles.buttons}>
        <Button
          title="Sign Up"
          onPress={() => navigation.navigate('Auth')}
          variant="primary"
          size="lg"
          fullWidth
        />
        <Button
          title="Log In"
          onPress={() => navigation.navigate('Auth')}
          variant="outline"
          size="lg"
          fullWidth
        />
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
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: spacing.xl,
  },
  logo: {
    width: 140,
    height: 140,
    borderRadius: 28,
  },
  tagline: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  description: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: spacing.xl,
  },
  buttons: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
});
