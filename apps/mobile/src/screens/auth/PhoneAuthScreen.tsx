import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Button, Input } from '../../components';
import { colors, spacing, fontSize, fontWeight } from '../../constants/theme';
import { firebaseAuth } from '../../services/firebase';
import type { AuthScreenProps } from '../../navigation/types';

export const PhoneAuthScreen: React.FC = () => {
  const navigation = useNavigation<AuthScreenProps<'PhoneAuth'>['navigation']>();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendCode = async () => {
    // Basic validation
    const digitsOnly = phoneNumber.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      Alert.alert('Invalid Number', 'Please enter a valid phone number');
      return;
    }

    try {
      setIsLoading(true);

      const result = await firebaseAuth.sendPhoneVerificationCode(phoneNumber);

      if (result.success && result.verificationId) {
        navigation.navigate('VerifyCode', {
          phoneNumber,
          verificationId: result.verificationId,
        });
      } else {
        Alert.alert('Error', result.error || 'Failed to send verification code');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send verification code. Please try again.');
      console.error('Phone auth error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Format phone number as user types
  const formatPhoneInput = (text: string) => {
    // Allow only digits, +, spaces, dashes, and parentheses
    const cleaned = text.replace(/[^\d+\s\-()]/g, '');
    setPhoneNumber(cleaned);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>Enter your phone number</Text>
        <Text style={styles.subtitle}>
          We'll send you a verification code to confirm your identity
        </Text>

        <Input
          label="Phone Number"
          placeholder="+1 (555) 123-4567"
          value={phoneNumber}
          onChangeText={formatPhoneInput}
          keyboardType="phone-pad"
          autoComplete="tel"
          autoFocus
        />

        <Text style={styles.hint}>
          Include your country code (e.g., +1 for US, +44 for UK)
        </Text>

        <Button
          title="Send Code"
          onPress={handleSendCode}
          loading={isLoading}
          disabled={phoneNumber.replace(/\D/g, '').length < 10}
          variant="primary"
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
  backButton: {
    marginBottom: spacing.lg,
  },
  backText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
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
    lineHeight: 24,
  },
  hint: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
});
