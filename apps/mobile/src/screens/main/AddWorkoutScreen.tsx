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
  Switch,
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

// Helper to parse MM:SS.S or M.SS.S to seconds
// Accepts both 1:51.9 (colon) and 1.51.9 (dots) formats
const parseTime = (timeStr: string): number | null => {
  if (!timeStr || timeStr.trim() === '') return null;

  // Try colon format first: M:SS.S or MM:SS.S
  const colonMatch = timeStr.match(/^(\d+):(\d+\.?\d*)$/);
  if (colonMatch) {
    return parseInt(colonMatch[1]) * 60 + parseFloat(colonMatch[2]);
  }

  // Try dot format: M.SS.S (e.g., 1.51.9 means 1 min 51.9 sec)
  const dotMatch = timeStr.match(/^(\d+)\.(\d{2})\.(\d+)$/);
  if (dotMatch) {
    return parseInt(dotMatch[1]) * 60 + parseInt(dotMatch[2]) + parseFloat('0.' + dotMatch[3]);
  }

  // Try simple dot format: M.SS (e.g., 7.23 means 7 min 23 sec)
  const simpleDotMatch = timeStr.match(/^(\d+)\.(\d{2})$/);
  if (simpleDotMatch) {
    return parseInt(simpleDotMatch[1]) * 60 + parseInt(simpleDotMatch[2]);
  }

  return null;
};

// Calculate watts from split using Concept2 formula
const calculateWatts = (splitSeconds: number): number => {
  const pacePerMeter = splitSeconds / 500;
  return Math.round(2.80 / Math.pow(pacePerMeter, 3));
};

// Calculate distance from time and split
const calculateDistance = (timeSeconds: number, splitSeconds: number): number => {
  return Math.round((timeSeconds / splitSeconds) * 500 / 10) * 10; // Round to nearest 10m
};

// Validation warning type
interface ValidationWarning {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

// Validate workout data and return warnings
const validateWorkoutData = (
  timeSeconds: number | null,
  distanceMetres: number | null,
  splitSeconds: number | null,
  strokeRate: number | null,
  heartRate: number | null
): ValidationWarning[] => {
  const warnings: ValidationWarning[] = [];

  // Split vs Time confusion detection
  if (timeSeconds && timeSeconds < 120) {
    warnings.push({
      field: 'time',
      message: 'Time seems very short. Did you enter the split by mistake?',
      severity: 'warning',
    });
  }

  if (splitSeconds && splitSeconds > 240) {
    warnings.push({
      field: 'split',
      message: 'Split seems very slow (over 4:00/500m). Is this correct?',
      severity: 'warning',
    });
  }

  if (splitSeconds && splitSeconds < 70) {
    warnings.push({
      field: 'split',
      message: 'Split seems very fast (under 1:10/500m). Is this correct?',
      severity: 'warning',
    });
  }

  // Cross-validation: split should be less than total time
  if (splitSeconds && timeSeconds && splitSeconds >= timeSeconds) {
    warnings.push({
      field: 'split',
      message: 'Split cannot be longer than total time. These may be swapped.',
      severity: 'error',
    });
  }

  // Cross-validation: distance should match time/split calculation
  if (distanceMetres && timeSeconds && splitSeconds) {
    const expectedDistance = calculateDistance(timeSeconds, splitSeconds);
    const variance = Math.abs(distanceMetres - expectedDistance) / expectedDistance;

    if (variance > 0.15) {
      warnings.push({
        field: 'distance',
        message: `Distance doesn't match time/split. Expected ~${expectedDistance}m`,
        severity: 'warning',
      });
    }
  }

  // Stroke rate sanity check
  if (strokeRate && (strokeRate < 16 || strokeRate > 45)) {
    warnings.push({
      field: 'strokeRate',
      message: 'Stroke rate seems unusual (typically 18-38 s/m)',
      severity: 'warning',
    });
  }

  // Heart rate sanity check
  if (heartRate && (heartRate < 80 || heartRate > 220)) {
    warnings.push({
      field: 'heartRate',
      message: 'Heart rate seems unusual',
      severity: 'warning',
    });
  }

  return warnings;
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

  // Cycling loading messages
  const loadingMessages = [
    'Reading erg screen...',
    'Paddling...',
    'Erging...',
    'Stretching...',
    'Settling...',
    'Please wait...',
    'Can take 20 seconds...',
  ];
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  // Cycle through loading messages while processing
  useEffect(() => {
    if (!isProcessing) {
      setLoadingMessageIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [isProcessing]);

  // Workout data - handle both old and new OCR field names
  const [workoutType, setWorkoutType] = useState(ocrData?.workoutType || 'distance');
  const [distance, setDistance] = useState(
    (ocrData?.totalDistanceMetres || ocrData?.estimatedDistanceMetres)?.toString() || ''
  );
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
  const [isPublic, setIsPublic] = useState(false); // Default to private
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(ocrData?.confidence || null);
  const [distanceWasEstimated, setDistanceWasEstimated] = useState(
    ocrData?.distanceEstimated || ocrData?.estimatedDistanceMetres ? true : false
  );

  // Computed values for validation
  const timeSeconds = parseTime(time);
  const distanceMetres = distance ? parseInt(distance, 10) : null;
  const splitSeconds = parseTime(split);
  const strokeRateNum = strokeRate ? parseInt(strokeRate, 10) : null;
  const heartRateNum = heartRate ? parseInt(heartRate, 10) : null;

  // Auto-calculate watts from split
  const calculatedWatts = splitSeconds ? calculateWatts(splitSeconds) : null;

  // Auto-calculate estimated distance if we have time and split but no distance
  const estimatedDistance = (!distanceMetres && timeSeconds && splitSeconds)
    ? calculateDistance(timeSeconds, splitSeconds)
    : null;

  // Validation warnings
  const validationWarnings = validateWorkoutData(
    timeSeconds,
    distanceMetres,
    splitSeconds,
    strokeRateNum,
    heartRateNum
  );

  // Get warning for a specific field
  const getFieldWarning = (field: string) => validationWarnings.find(w => w.field === field);

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
        const data = response.data.ocrData as any; // Allow new field names

        // Pre-fill form with OCR data
        if (data.workoutType) setWorkoutType(data.workoutType);

        // Handle distance - prefer actual, fall back to estimated
        if (data.totalDistanceMetres) {
          setDistance(data.totalDistanceMetres.toString());
          setDistanceWasEstimated(false);
        } else if (data.estimatedDistanceMetres) {
          setDistance(data.estimatedDistanceMetres.toString());
          setDistanceWasEstimated(true);
        }

        if (data.totalTimeSeconds) setTime(formatTime(data.totalTimeSeconds));
        if (data.avgSplit) setSplit(formatTime(data.avgSplit));
        if (data.avgStrokeRate) setStrokeRate(data.avgStrokeRate.toString());
        if (data.avgWatts) setWatts(data.avgWatts.toString());
        if (data.avgHeartRate) setHeartRate(data.avgHeartRate.toString());
        if (data.calories) setCalories(data.calories.toString());
        if (data.dragFactor) setDragFactor(data.dragFactor.toString());

        // Store OCR confidence for display
        if (data.confidence) setOcrConfidence(data.confidence);

        setShowForm(true);

        // Show low confidence warning
        if (data.confidence && data.confidence < 70) {
          Alert.alert(
            'Low Confidence',
            'The OCR reading has low confidence. Please verify the data is correct.',
            [{ text: 'OK' }]
          );
        }
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
        isPublic,
      };

      // In dev mode, skip API and save locally for testing
      if (__DEV__) {
        const mockWorkout = {
          id: `dev-workout-${Date.now()}`,
          userId: 'dev-user-001',
          workoutType,
          totalTimeSeconds: timeSeconds,
          totalDistanceMetres: distanceMetres,
          averageSplitSeconds: splitSeconds || (timeSeconds / distanceMetres) * 500,
          averageRate: strokeRate ? parseInt(strokeRate, 10) : 0,
          averageWatts: watts ? parseInt(watts, 10) : undefined,
          avgHeartRate: heartRate ? parseInt(heartRate, 10) : undefined,
          calories: calories ? parseInt(calories, 10) : undefined,
          dragFactor: dragFactor ? parseInt(dragFactor, 10) : undefined,
          photoUrl,
          notes: notes || undefined,
          isPublic,
          isPb: false,
          workoutDate: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };

        addWorkout(mockWorkout);

        Alert.alert('Success', 'Workout saved! (Dev mode - local only)', [
          {
            text: 'OK',
            onPress: () => {
              setShowForm(false);
              setSelectedImage(null);
              navigation.navigate('Workouts');
            },
          },
        ]);
        return;
      }

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
                <Text style={styles.label}>
                  Distance (metres)
                  {distanceWasEstimated && (
                    <Text style={styles.estimatedLabel}> (estimated)</Text>
                  )}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    getFieldWarning('distance') && styles.inputWarning,
                  ]}
                  value={distance}
                  onChangeText={(val) => {
                    setDistance(val);
                    setDistanceWasEstimated(false);
                  }}
                  keyboardType="numeric"
                  placeholder="e.g., 2000"
                  placeholderTextColor={colors.textTertiary}
                />
                {getFieldWarning('distance') && (
                  <Text style={styles.warningText}>
                    ⚠️ {getFieldWarning('distance')?.message}
                  </Text>
                )}
                {estimatedDistance && !distanceMetres && (
                  <Text style={styles.estimatedText}>
                    📊 Estimated: ~{estimatedDistance}m
                  </Text>
                )}
              </View>

              {/* Time */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Time (m:ss.s)</Text>
                <TextInput
                  style={[
                    styles.input,
                    getFieldWarning('time') && styles.inputWarning,
                  ]}
                  value={time}
                  onChangeText={setTime}
                  placeholder="e.g., 7:23.4"
                  placeholderTextColor={colors.textTertiary}
                />
                {getFieldWarning('time') && (
                  <Text style={styles.warningText}>
                    ⚠️ {getFieldWarning('time')?.message}
                  </Text>
                )}
              </View>

              {/* Split */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Average Split (m:ss.s / 500m)</Text>
                <TextInput
                  style={[
                    styles.input,
                    getFieldWarning('split') && styles.inputError,
                  ]}
                  value={split}
                  onChangeText={setSplit}
                  placeholder="e.g., 1:51.2"
                  placeholderTextColor={colors.textTertiary}
                />
                {getFieldWarning('split') && (
                  <Text style={[
                    styles.warningText,
                    getFieldWarning('split')?.severity === 'error' && styles.errorText,
                  ]}>
                    {getFieldWarning('split')?.severity === 'error' ? '❌' : '⚠️'} {getFieldWarning('split')?.message}
                  </Text>
                )}
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

              {/* Privacy Toggle */}
              <View style={styles.privacySection}>
                <View style={styles.privacyRow}>
                  <View style={styles.privacyIconContainer}>
                    <Ionicons
                      name={isPublic ? 'globe-outline' : 'lock-closed-outline'}
                      size={20}
                      color={isPublic ? colors.primary : colors.textSecondary}
                    />
                  </View>
                  <View style={styles.privacyContent}>
                    <Text style={styles.privacyTitle}>
                      {isPublic ? 'Public' : 'Private'}
                    </Text>
                    <Text style={styles.privacyDescription}>
                      {isPublic
                        ? 'Visible on the public feed and leaderboards'
                        : 'Only visible on your personal workouts list'}
                    </Text>
                  </View>
                  <Switch
                    value={isPublic}
                    onValueChange={setIsPublic}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={colors.white}
                  />
                </View>
              </View>

              {/* OCR Confidence Indicator */}
              {ocrConfidence && (
                <View style={[
                  styles.confidenceBar,
                  ocrConfidence >= 80 ? styles.confidenceHigh :
                  ocrConfidence >= 50 ? styles.confidenceMedium : styles.confidenceLow,
                ]}>
                  <Ionicons
                    name={ocrConfidence >= 80 ? 'checkmark-circle' : 'warning'}
                    size={16}
                    color={ocrConfidence >= 80 ? colors.success : colors.warning}
                  />
                  <Text style={styles.confidenceText}>
                    OCR Confidence: {ocrConfidence}%
                    {ocrConfidence < 70 && ' - Please verify data'}
                  </Text>
                </View>
              )}

              {/* Validation Warnings Summary */}
              {validationWarnings.length > 0 && (
                <View style={styles.validationSummary}>
                  <Text style={styles.validationTitle}>⚠️ Please review:</Text>
                  {validationWarnings.map((warning, index) => (
                    <Text key={index} style={[
                      styles.validationItem,
                      warning.severity === 'error' && styles.validationError,
                    ]}>
                      • {warning.message}
                    </Text>
                  ))}
                </View>
              )}

              {/* Save Button */}
              <Button
                title={isSaving ? 'Saving...' : 'Save Workout'}
                onPress={handleSave}
                disabled={isSaving || validationWarnings.some(w => w.severity === 'error')}
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
          <Text style={styles.processingText}>{loadingMessages[loadingMessageIndex]}</Text>
        </View>
      ) : (
        <View style={styles.content}>
          {/* Photo options */}
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
  // Validation styles
  inputWarning: {
    borderColor: colors.warning,
    backgroundColor: 'rgba(251, 191, 36, 0.05)',
  },
  inputError: {
    borderColor: colors.error,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  warningText: {
    fontSize: fontSize.xs,
    color: colors.warning,
    marginTop: spacing.xs,
  },
  errorText: {
    color: colors.error,
  },
  estimatedLabel: {
    fontSize: fontSize.xs,
    color: colors.primary,
    fontWeight: fontWeight.regular,
  },
  estimatedText: {
    fontSize: fontSize.xs,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  calculatedText: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  // Confidence indicator
  confidenceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  confidenceHigh: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  confidenceMedium: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
  },
  confidenceLow: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  confidenceText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  // Validation summary
  validationSummary: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  validationTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.warning,
    marginBottom: spacing.xs,
  },
  validationItem: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  validationError: {
    color: colors.error,
  },
  // Privacy toggle styles
  privacySection: {
    marginBottom: spacing.lg,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  privacyIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  privacyContent: {
    flex: 1,
  },
  privacyTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  privacyDescription: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
});
