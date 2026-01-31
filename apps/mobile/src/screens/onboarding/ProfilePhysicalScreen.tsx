import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Button, Input } from '../../components';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../../constants/theme';
import type { OnboardingScreenProps } from '../../navigation/types';

type Gender = 'male' | 'female' | 'prefer_not_to_say';
type HeightUnit = 'cm' | 'ft';
type WeightUnit = 'kg' | 'lbs';

export const ProfilePhysicalScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingScreenProps<'ProfilePhysical'>['navigation']>();

  const [height, setHeight] = useState('');
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('cm');
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [birthDate, setBirthDate] = useState(new Date(2000, 0, 1));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState<Gender | null>(null);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleContinue = () => {
    if (!height || !weight || !gender) {
      Alert.alert('Required Fields', 'Please fill in all fields to continue');
      return;
    }

    const heightNum = parseFloat(height);
    const weightNum = parseFloat(weight);

    if (isNaN(heightNum) || isNaN(weightNum)) {
      Alert.alert('Invalid Values', 'Please enter valid numbers');
      return;
    }

    // Convert to metric if needed
    const heightCm = heightUnit === 'cm' ? heightNum : heightNum * 30.48; // rough ft to cm
    const weightKg = weightUnit === 'kg' ? weightNum : weightNum * 0.453592;

    // TODO: Save to store
    console.log({ heightCm, weightKg, birthDate: birthDate.toISOString(), gender });

    navigation.navigate('HRSetup');
  };

  const genderOptions: { value: Gender; label: string }[] = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'prefer_not_to_say', label: 'Prefer not to say' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.progress}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '33%' }]} />
        </View>
        <Text style={styles.progressText}>2 of 6</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Physical stats</Text>
        <Text style={styles.subtitle}>
          These help us provide accurate AI coaching and calculate metrics like
          watts/kg
        </Text>

        {/* Height */}
        <View style={styles.inputRow}>
          <View style={styles.inputWithUnit}>
            <Input
              label="Height"
              placeholder={heightUnit === 'cm' ? '180' : '5\'11"'}
              value={height}
              onChangeText={setHeight}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.unitToggle}>
            <TouchableOpacity
              style={[styles.unitButton, heightUnit === 'cm' && styles.unitButtonActive]}
              onPress={() => setHeightUnit('cm')}
            >
              <Text
                style={[
                  styles.unitText,
                  heightUnit === 'cm' && styles.unitTextActive,
                ]}
              >
                cm
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.unitButton, heightUnit === 'ft' && styles.unitButtonActive]}
              onPress={() => setHeightUnit('ft')}
            >
              <Text
                style={[
                  styles.unitText,
                  heightUnit === 'ft' && styles.unitTextActive,
                ]}
              >
                ft/in
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Weight */}
        <View style={styles.inputRow}>
          <View style={styles.inputWithUnit}>
            <Input
              label="Weight"
              placeholder={weightUnit === 'kg' ? '75' : '165'}
              value={weight}
              onChangeText={setWeight}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.unitToggle}>
            <TouchableOpacity
              style={[styles.unitButton, weightUnit === 'kg' && styles.unitButtonActive]}
              onPress={() => setWeightUnit('kg')}
            >
              <Text
                style={[
                  styles.unitText,
                  weightUnit === 'kg' && styles.unitTextActive,
                ]}
              >
                kg
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.unitButton, weightUnit === 'lbs' && styles.unitButtonActive]}
              onPress={() => setWeightUnit('lbs')}
            >
              <Text
                style={[
                  styles.unitText,
                  weightUnit === 'lbs' && styles.unitTextActive,
                ]}
              >
                lbs
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Birth Date */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Date of Birth</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.dateText}>{formatDate(birthDate)}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={birthDate}
              mode="date"
              display="spinner"
              onChange={(event, date) => {
                setShowDatePicker(false);
                if (date) setBirthDate(date);
              }}
              maximumDate={new Date()}
              minimumDate={new Date(1940, 0, 1)}
            />
          )}
        </View>

        {/* Gender */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Gender</Text>
          <View style={styles.genderOptions}>
            {genderOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.genderButton,
                  gender === option.value && styles.genderButtonActive,
                ]}
                onPress={() => setGender(option.value)}
              >
                <Text
                  style={[
                    styles.genderText,
                    gender === option.value && styles.genderTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title="Continue"
          onPress={handleContinue}
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
    lineHeight: 24,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  inputWithUnit: {
    flex: 1,
  },
  unitToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: 2,
    marginBottom: spacing.md,
  },
  unitButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md - 2,
  },
  unitButtonActive: {
    backgroundColor: colors.primary,
  },
  unitText: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    fontWeight: fontWeight.medium,
  },
  unitTextActive: {
    color: colors.textPrimary,
  },
  fieldContainer: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  dateButton: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  dateText: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  genderOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  genderButton: {
    flex: 1,
    minWidth: 90,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
  },
  genderButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDark + '20',
  },
  genderText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  genderTextActive: {
    color: colors.primary,
  },
  actions: {
    paddingTop: spacing.md,
  },
});
