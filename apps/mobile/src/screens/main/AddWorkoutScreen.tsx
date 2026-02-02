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
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '../../constants/theme';
import { useWorkoutStore } from '../../stores/workoutStore';
import { api } from '../../services/api';
import type { MainTabScreenProps, MainTabParamList, OcrWorkoutData } from '../../navigation/types';

type AddWorkoutRouteProp = RouteProp<MainTabParamList, 'AddWorkout'>;

// Helper to format seconds to MM:SS.S
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
};

// Helper to parse MM:SS.S to seconds
const parseTime = (timeStr: string): number | null => {
  const match = timeStr.match(/^(\d+):(\d+\.?\d*)$/);
  if (!match) return null;
  return parseInt(match[1]) * 60 + parseFloat(match[2]);
};

export const AddWorkoutScreen: React.FC = () => {
  const navigation = useNavigation<MainTabScreenProps<'AddWorkout'>['navigation']>();
  const route = useRoute<AddWorkoutRouteProp>();
  const { addWorkout } = useWorkoutStore();

  // Check if we have OCR data from camera
  const ocrData = route.params?.ocrData;
  const photoUri = route.params?.photoUri;

  // Form state
  const [showForm, setShowForm] = useState(!!ocrData);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(photoUri || null);

  // Workout data
  const [workoutType, setWorkoutType] = useState(ocrData?.workoutType || 'distance');
  const [distance, setDistance] = useState(ocrData?.totalDistanceMetres?.toString() || '');
  const [time, setTime] = useState(
    ocrData?.totalTimeSeconds ? formatTime(ocrData.totalTimeSeconds) : ''
  );
  const [split, setSplit] = useState(ocrData?.avgSplit ? formatTime(ocrData.avgSplit) : '');
  const [strokeRate, setStrokeRate] = useState(ocrData?.avgStrokeRate?.toString() || '');
  const [watts, setWatts] = useState(ocrData?.avgWatts?.toString() || '');
  const [heartRate, setHeartRate] = useState(ocrData?.avgHeartRate?.toString() || '');
  const [calories, setCalories] = useState(ocrData?.calories?.toString() || '');
  const [dragFactor, setDragFactor] = useState(ocrData?.dragFactor?.toString() || '');
  const [notes, setNotes] = useState('');

  const handleTakePhoto = () => {
    navigation.navigate('Camera');
  };

  const handleChooseFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        'Photo Library Permission',
        'UTx needs access to your photos to upload erg screen images.',
        [{ text: 'OK' }]
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      processImage(result.assets[0].uri);
    }
  };

  const processImage = async (uri: string) => {
    setSelectedImage(uri);
    setIsProcessing(true);

    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      const response = await api.processOcr(base64);

      if (response.success && response.data?.ocrData) {
        const data = response.data.ocrData as OcrWorkoutData;

        // Pre-fill form with OCR data
        if (data.workoutType) setWorkoutType(data.workoutType);
        if (data.totalDistanceMetres) setDistance(data.totalDistanceMetres.toString());
        if (data.totalTimeSeconds) setTime(formatTime(data.totalTimeSeconds));
        if (data.avgSplit) setSplit(formatTime(data.avgSplit));
        if (data.avgStrokeRate) setStrokeRate(data.avgStrokeRate.toString());
        if (data.avgWatts) setWatts(data.avgWatts.toString());
        if (data.avgHeartRate) setHeartRate(data.avgHeartRate.toString());
        if (data.calories) setCalories(data.calories.toString());
        if (data.dragFactor) setDragFactor(data.dragFactor.toString());

        setShowForm(true);
      } else {
        Alert.alert(
          'OCR Failed',
          'Could not read the erg screen. Would you like to enter the data manually?',
          [
            { text: 'Try Again', onPress: () => setSelectedImage(null) },
            { text: 'Enter Manually', onPress: () => setShowForm(true) },
          ]
        );
      }
    } catch (error) {
      console.error('OCR failed:', error);
      Alert.alert(
        'Error',
        'Failed to process the image. Would you like to enter data manually?',
        [
          { text: 'Try Again', onPress: () => setSelectedImage(null) },
          { text: 'Enter Manually', onPress: () => setShowForm(true) },
        ]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualEntry = () => {
    setShowForm(true);
  };

  const handleSave = async () => {
    // Validate required fields
    const timeSeconds = parseTime(time);
    const distanceMetres = parseInt(distance, 10);
    const splitSeconds = parseTime(split);

    if (!timeSeconds || !distanceMetres) {
      Alert.alert('Missing Data', 'Please enter at least time and distance.');
      return;
    }

    setIsSaving(true);

    try {
      // Upload photo first if we have one
      let photoUrl: string | undefined;
      if (selectedImage) {
        // TODO: Upload photo and get URL
        // const uploadResponse = await api.uploadWorkoutPhoto(selectedImage);
        // photoUrl = uploadResponse.data?.url;
      }

      const workoutData = {
        workoutType,
        totalTimeSeconds: timeSeconds,
        totalDistanceMetres: distanceMetres,
        avgSplit: splitSeconds || (timeSeconds / distanceMetres) * 500,
        avgStrokeRate: strokeRate ? parseInt(strokeRate, 10) : undefined,
        avgWatts: watts ? parseInt(watts, 10) : undefined,
        avgHeartRate: heartRate ? parseInt(heartRate, 10) : undefined,
        calories: calories ? parseInt(calories, 10) : undefined,
        dragFactor: dragFactor ? parseInt(dragFactor, 10) : undefined,
        photoUrl,
        notes: notes || undefined,
        isPublic: true,
      };

      const response = await api.createWorkout(workoutData);

      if (response.success) {
        Alert.alert('Success', 'Workout saved!', [
          {
            text: 'OK',
            onPress: () => {
              // Reset form and navigate to workouts tab
              setShowForm(false);
              setSelectedImage(null);
              navigation.navigate('Workouts');
            },
          },
        ]);
      } else {
        Alert.alert('Error', response.error || 'Failed to save workout');
      }
    } catch (error) {
      console.error('Save failed:', error);
      Alert.alert('Error', 'Failed to save workout. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // If showing the form (either from OCR or manual entry)
  if (showForm) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => {
                  setShowForm(false);
                  setSelectedImage(null);
                }}
                style={styles.backButton}
              >
                <Ionicons name="arrow-back" size={20} color={colors.primary} />
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
              <Text style={styles.title}>Workout Details</Text>
            </View>

            {/* Photo preview */}
            {selectedImage && (
              <View style={styles.photoPreview}>
                <Image source={{ uri: selectedImage }} style={styles.previewImage} />
              </View>
            )}

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
                title={isSaving ? 'Saving...' : 'Save Workout'}
                onPress={handleSave}
                disabled={isSaving}
                style={styles.saveButton}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Show initial options screen
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Add Workout</Text>
        <Text style={styles.subtitle}>
          Take a photo of your erg screen or enter data manually
        </Text>
      </View>

      {isProcessing ? (
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.processingText}>Reading erg screen...</Text>
        </View>
      ) : (
        <View style={styles.content}>
          {/* Photo options */}
          <TouchableOpacity style={styles.option} onPress={handleTakePhoto}>
            <View style={styles.optionIcon}>
              <Ionicons name="camera" size={28} color={colors.primary} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Take Photo</Text>
              <Text style={styles.optionDescription}>
                Snap your erg screen and we'll extract the data
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.option} onPress={handleChooseFromGallery}>
            <View style={styles.optionIcon}>
              <Ionicons name="images" size={28} color={colors.primary} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Choose from Gallery</Text>
              <Text style={styles.optionDescription}>
                Upload a photo from your camera roll
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.option} onPress={handleManualEntry}>
            <View style={styles.optionIcon}>
              <Ionicons name="create" size={28} color={colors.primary} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Manual Entry</Text>
              <Text style={styles.optionDescription}>
                Type in your workout data yourself
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>

          {/* Tips */}
          <View style={styles.tips}>
            <Text style={styles.tipsTitle}>Tips for best results</Text>
            <View style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>
                Make sure the entire screen is visible in the photo
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>
                Avoid glare and reflections on the screen
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>
                Works best with PM5, but PM3 and PM4 are supported too
              </Text>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  backButtonText: {
    fontSize: fontSize.md,
    color: colors.primary,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  processingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingText: {
    marginTop: spacing.md,
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  iconText: {
    fontSize: 28,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  optionDescription: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
  },
  arrow: {
    fontSize: fontSize.xl,
    color: colors.textTertiary,
  },
  tips: {
    marginTop: spacing.xxl,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  tipsTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  tipItem: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  tipBullet: {
    fontSize: fontSize.md,
    color: colors.textTertiary,
    marginRight: spacing.sm,
  },
  tipText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  // Form styles
  photoPreview: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    height: 200,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  form: {
    paddingHorizontal: spacing.lg,
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
  saveButton: {
    marginTop: spacing.lg,
  },
});
