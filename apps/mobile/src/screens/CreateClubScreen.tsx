import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input } from '../components';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../constants/theme';
import { api } from '../services/api';

export const CreateClubScreen: React.FC = () => {
  const navigation = useNavigation();
  const [clubName, setClubName] = useState('');
  const [location, setLocation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async () => {
    if (clubName.trim().length < 2) {
      Alert.alert('Invalid Name', 'Club name must be at least 2 characters.');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await api.createClub({
        name: clubName.trim(),
        location: location.trim() || undefined,
      });

      if (response.success) {
        setIsSuccess(true);
      } else {
        Alert.alert('Error', response.error || 'Failed to create club. Please try again.');
      }
    } catch (error: any) {
      console.error('Create club error:', error);
      Alert.alert('Error', error.message || 'Failed to create club. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={80} color={colors.success} />
          </View>
          <Text style={styles.successTitle}>Club Submitted!</Text>
          <Text style={styles.successMessage}>
            Your club "{clubName}" has been submitted for verification.
          </Text>
          <Text style={styles.successSubtext}>
            We'll review your club within 24-48 hours. You'll receive an email once it's approved with your invite code to share with members.
          </Text>
          <Button
            title="Done"
            onPress={() => navigation.goBack()}
            style={styles.doneButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create a Club</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Info Card */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={24} color={colors.primary} />
            <Text style={styles.infoText}>
              Create a club for your rowing team, school, or group. Once approved, you'll get an invite code to share with members.
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.label}>Club Name *</Text>
            <Input
              value={clubName}
              onChangeText={setClubName}
              placeholder="e.g., Cambridge Rowing Club"
              autoCapitalize="words"
              maxLength={100}
            />
            <Text style={styles.helperText}>
              {clubName.length}/100 characters
            </Text>

            <Text style={[styles.label, styles.labelMargin]}>Location (Optional)</Text>
            <Input
              value={location}
              onChangeText={setLocation}
              placeholder="e.g., Cambridge, UK"
              autoCapitalize="words"
              maxLength={100}
            />
            <Text style={styles.helperText}>
              City, region, or country where the club is based
            </Text>
          </View>

          {/* Submit Button */}
          <Button
            title={isSubmitting ? 'Submitting...' : 'Submit for Verification'}
            onPress={handleSubmit}
            disabled={isSubmitting || clubName.trim().length < 2}
            style={styles.submitButton}
          />

          <Text style={styles.disclaimer}>
            By creating a club, you agree to manage it responsibly and ensure it represents a legitimate rowing organization.
          </Text>
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
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  headerSpacer: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  form: {
    marginBottom: spacing.xl,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  labelMargin: {
    marginTop: spacing.lg,
  },
  helperText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  submitButton: {
    marginBottom: spacing.md,
  },
  disclaimer: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  successIcon: {
    marginBottom: spacing.lg,
  },
  successTitle: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  successMessage: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  successSubtext: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  doneButton: {
    width: '100%',
    maxWidth: 200,
  },
});

export default CreateClubScreen;
