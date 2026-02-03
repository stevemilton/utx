import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../components';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../constants/theme';
import { api } from '../services/api';
import type { RootStackScreenProps } from '../navigation/types';

// Helper to format seconds to MM:SS.S
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
};

// Helper to parse MM:SS.S to seconds
const parseTime = (timeStr: string): number | null => {
  if (!timeStr || timeStr.trim() === '') return null;

  // Try colon format: M:SS.S or MM:SS.S
  const colonMatch = timeStr.match(/^(\d+):(\d+\.?\d*)$/);
  if (colonMatch) {
    return parseInt(colonMatch[1]) * 60 + parseFloat(colonMatch[2]);
  }

  // Try dot format: M.SS.S (e.g., 1.51.9 means 1 min 51.9 sec)
  const dotMatch = timeStr.match(/^(\d+)\.(\d{2})\.(\d+)$/);
  if (dotMatch) {
    return parseInt(dotMatch[1]) * 60 + parseInt(dotMatch[2]) + parseFloat('0.' + dotMatch[3]);
  }

  return null;
};

// Calculate watts from split using Concept2 formula
const calculateWatts = (splitSeconds: number): number => {
  const pacePerMeter = splitSeconds / 500;
  return Math.round(2.80 / Math.pow(pacePerMeter, 3));
};

interface Workout {
  id: string;
  workoutType: string;
  workoutDate: string;
  totalDistanceMetres: number;
  totalTimeSeconds: number;
  avgSplit?: number;
  avgStrokeRate?: number;
  avgWatts?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  calories?: number;
  dragFactor?: number;
  notes?: string;
}

export const WorkoutEditScreen: React.FC = () => {
  const navigation = useNavigation<RootStackScreenProps<'WorkoutEdit'>['navigation']>();
  const route = useRoute<RootStackScreenProps<'WorkoutEdit'>['route']>();
  const { workoutId } = route.params || {};

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [workout, setWorkout] = useState<Workout | null>(null);

  // Form state
  const [workoutType, setWorkoutType] = useState('distance');
  const [distance, setDistance] = useState('');
  const [time, setTime] = useState('');
  const [split, setSplit] = useState('');
  const [strokeRate, setStrokeRate] = useState('');
  const [watts, setWatts] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [calories, setCalories] = useState('');
  const [dragFactor, setDragFactor] = useState('');
  const [notes, setNotes] = useState('');

  // Load workout data
  useEffect(() => {
    const loadWorkout = async () => {
      if (!workoutId) {
        Alert.alert('Error', 'No workout ID provided');
        navigation.goBack();
        return;
      }

      try {
        const response = await api.getWorkout(workoutId);
        if (response.success && response.data) {
          const w = response.data as Workout;
          setWorkout(w);

          // Pre-fill form
          setWorkoutType(w.workoutType || 'distance');
          setDistance(w.totalDistanceMetres?.toString() || '');
          setTime(w.totalTimeSeconds ? formatTime(w.totalTimeSeconds) : '');
          setSplit(w.avgSplit ? formatTime(w.avgSplit) : '');
          setStrokeRate(w.avgStrokeRate?.toString() || '');
          setWatts(w.avgWatts?.toString() || '');
          setHeartRate(w.avgHeartRate?.toString() || '');
          setCalories(w.calories?.toString() || '');
          setDragFactor(w.dragFactor?.toString() || '');
          setNotes(w.notes || '');
        } else {
          Alert.alert('Error', response.error || 'Failed to load workout');
          navigation.goBack();
        }
      } catch (error) {
        console.error('Failed to load workout:', error);
        Alert.alert('Error', 'Failed to load workout');
        navigation.goBack();
      } finally {
        setIsLoading(false);
      }
    };

    loadWorkout();
  }, [workoutId, navigation]);

  // Computed values
  const splitSeconds = parseTime(split);
  const calculatedWatts = splitSeconds ? calculateWatts(splitSeconds) : null;

  const handleSave = async () => {
    if (!workout) return;

    const timeSeconds = parseTime(time);
    const distanceMetres = parseInt(distance, 10);

    if (!timeSeconds || !distanceMetres) {
      Alert.alert('Missing Data', 'Please enter at least time and distance.');
      return;
    }

    setIsSaving(true);

    try {
      const updateData: Record<string, unknown> = {
        workoutType,
        totalTimeSeconds: timeSeconds,
        totalDistanceMetres: distanceMetres,
      };

      // Only include optional fields if they have values
      const splitSecs = parseTime(split);
      if (splitSecs) updateData.avgSplit = splitSecs;
      if (strokeRate) updateData.avgStrokeRate = parseInt(strokeRate, 10);
      if (watts) updateData.avgWatts = parseInt(watts, 10);
      if (heartRate) updateData.avgHeartRate = parseInt(heartRate, 10);
      if (calories) updateData.calories = parseInt(calories, 10);
      if (dragFactor) updateData.dragFactor = parseInt(dragFactor, 10);
      if (notes !== undefined) updateData.notes = notes;

      const response = await api.updateWorkout(workout.id, updateData);

      if (response.success) {
        Alert.alert('Success', 'Workout updated!', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      } else {
        Alert.alert('Error', response.error || 'Failed to update workout');
      }
    } catch (error) {
      console.error('Save failed:', error);
      Alert.alert('Error', 'Failed to save workout. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Workout</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading workout...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Workout</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Form */}
          <View style={styles.form}>
            {/* Workout Type */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Workout Type</Text>
              <View style={styles.typeButtons}>
                {['distance', 'time', 'intervals'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeButton,
                      workoutType === type && styles.typeButtonActive,
                    ]}
                    onPress={() => setWorkoutType(type)}
                  >
                    <Text
                      style={[
                        styles.typeButtonText,
                        workoutType === type && styles.typeButtonTextActive,
                      ]}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Distance */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Distance (metres)</Text>
              <TextInput
                style={styles.input}
                value={distance}
                onChangeText={setDistance}
                keyboardType="numeric"
                placeholder="e.g., 2000"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            {/* Time */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Time (m:ss.s)</Text>
              <TextInput
                style={styles.input}
                value={time}
                onChangeText={setTime}
                placeholder="e.g., 7:23.4"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            {/* Split */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Average Split (m:ss.s / 500m)</Text>
              <TextInput
                style={styles.input}
                value={split}
                onChangeText={setSplit}
                placeholder="e.g., 1:51.2"
                placeholderTextColor={colors.textTertiary}
              />
              {calculatedWatts && (
                <Text style={styles.calculatedText}>≈ {calculatedWatts}W</Text>
              )}
            </View>

            {/* Row of smaller inputs */}
            <View style={styles.row}>
              <View style={[styles.fieldGroup, styles.halfWidth]}>
                <Text style={styles.label}>Stroke Rate</Text>
                <TextInput
                  style={styles.input}
                  value={strokeRate}
                  onChangeText={setStrokeRate}
                  keyboardType="numeric"
                  placeholder="e.g., 28"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
              <View style={[styles.fieldGroup, styles.halfWidth]}>
                <Text style={styles.label}>Watts</Text>
                <TextInput
                  style={styles.input}
                  value={watts}
                  onChangeText={setWatts}
                  keyboardType="numeric"
                  placeholder="e.g., 250"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.fieldGroup, styles.halfWidth]}>
                <Text style={styles.label}>Heart Rate</Text>
                <TextInput
                  style={styles.input}
                  value={heartRate}
                  onChangeText={setHeartRate}
                  keyboardType="numeric"
                  placeholder="e.g., 165"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
              <View style={[styles.fieldGroup, styles.halfWidth]}>
                <Text style={styles.label}>Calories</Text>
                <TextInput
                  style={styles.input}
                  value={calories}
                  onChangeText={setCalories}
                  keyboardType="numeric"
                  placeholder="e.g., 150"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
            </View>

            {/* Drag Factor */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Drag Factor</Text>
              <TextInput
                style={styles.input}
                value={dragFactor}
                onChangeText={setDragFactor}
                keyboardType="numeric"
                placeholder="e.g., 120"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            {/* Notes */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="How did it feel? Any notes about the workout..."
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Save Button */}
            <Button
              title={isSaving ? 'Saving...' : 'Save Changes'}
              onPress={handleSave}
              disabled={isSaving}
              style={styles.saveButton}
            />
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
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  form: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  fieldGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfWidth: {
    flex: 1,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  typeButtonTextActive: {
    color: colors.textInverse,
  },
  calculatedText: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  saveButton: {
    marginTop: spacing.lg,
  },
});
