import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize } from '../constants/theme';
import { Button } from '../components/Button';
import { api } from '../services/api';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const CameraScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

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

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

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

  const takePicture = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      if (photo?.uri) {
        setCapturedPhoto(photo.uri);
      }
    } catch (error) {
      console.error('Failed to take picture:', error);
      Alert.alert('Error', 'Failed to take picture. Please try again.');
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      base64: false,
    });

    if (!result.canceled && result.assets[0]) {
      setCapturedPhoto(result.assets[0].uri);
    }
  };

  const processPhoto = async () => {
    if (!capturedPhoto) return;

    setIsProcessing(true);

    try {
      if (__DEV__) {
        console.log('[OCR] Starting image processing...');
      }

      // Read the file as base64
      const base64 = await FileSystem.readAsStringAsync(capturedPhoto, {
        encoding: 'base64',
      });

      if (__DEV__) {
        console.log('[OCR] Base64 length:', base64.length);
      }

      // Send to OCR endpoint
      const ocrResponse = await api.processOcr(base64);

      if (ocrResponse.success && ocrResponse.data) {
        // Navigate to add workout screen with OCR data pre-filled
        navigation.replace('AddWorkout', {
          ocrData: ocrResponse.data.ocrData,
          photoUri: capturedPhoto,
        });
      } else {
        const errorMsg = ocrResponse.error || 'Unable to read erg screen';
        if (__DEV__) {
          console.error('[OCR] Failed:', errorMsg);
        }
        Alert.alert(
          'OCR Failed',
          `${errorMsg}\n\nWould you like to enter the data manually?`,
          [
            {
              text: 'Try Again',
              onPress: () => setCapturedPhoto(null),
            },
            {
              text: 'Enter Manually',
              onPress: () =>
                navigation.replace('AddWorkout', {
                  photoUri: capturedPhoto,
                }),
            },
          ]
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Processing failed';
      if (__DEV__) {
        console.error('[OCR] Exception:', errorMessage);
      }

      Alert.alert(
        'Processing Error',
        `${errorMessage}\n\nWould you like to try again or enter data manually?`,
        [
          {
            text: 'Try Again',
            onPress: () => setCapturedPhoto(null),
          },
          {
            text: 'Enter Manually',
            onPress: () =>
              navigation.replace('AddWorkout', {
                photoUri: capturedPhoto,
              }),
          },
        ]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
  };

  // Show loading while checking permissions
  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  // Show permission request screen
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            UTx needs camera access to capture your erg screen and automatically extract your
            workout data.
          </Text>
          <Button title="Grant Permission" onPress={requestPermission} style={styles.permissionButton} />
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.skipButton}>
            <Text style={styles.skipText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Show preview of captured photo
  if (capturedPhoto) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Review Photo</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.previewContainer}>
          <Image source={{ uri: capturedPhoto }} style={styles.preview} resizeMode="contain" />
        </View>

        <View style={styles.previewActions}>
          {isProcessing ? (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.processingText}>{loadingMessages[loadingMessageIndex]}</Text>
            </View>
          ) : (
            <>
              <View style={styles.hintContainer}>
                <Text style={styles.hintText}>
                  Make sure the erg screen is clearly visible and in focus
                </Text>
              </View>
              <View style={styles.buttonRow}>
                <Button
                  title="Retake"
                  variant="secondary"
                  onPress={retakePhoto}
                  style={styles.actionButton}
                />
                <Button
                  title="Use Photo"
                  onPress={processPhoto}
                  style={styles.actionButton}
                />
              </View>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // Show camera view
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Capture Erg Screen</Text>
        <TouchableOpacity onPress={() => setFacing(facing === 'back' ? 'front' : 'back')} style={styles.headerButton}>
          <Ionicons name="camera-reverse-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing={facing}>
          <View style={styles.overlay}>
            <View style={styles.guideFrame}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            <Text style={styles.guideText}>Align the erg screen within the frame</Text>
          </View>
        </CameraView>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.galleryButton} onPress={pickImage}>
          <Ionicons name="images-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
          <View style={styles.captureInner} />
        </TouchableOpacity>

        <View style={styles.placeholder} />
      </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  cameraContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideFrame: {
    width: '80%',
    aspectRatio: 1, // Square for Concept2 PM5 screen
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: colors.primary,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  guideText: {
    marginTop: spacing.lg,
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  galleryButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 4,
    borderColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.textPrimary,
  },
  placeholder: {
    width: 50,
  },
  // Permission styles
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  permissionTitle: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  permissionButton: {
    width: '100%',
  },
  skipButton: {
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  skipText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
  },
  // Preview styles
  previewContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  preview: {
    flex: 1,
  },
  previewActions: {
    padding: spacing.lg,
  },
  hintContainer: {
    marginBottom: spacing.lg,
  },
  hintText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  processingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  processingText: {
    marginTop: spacing.md,
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
});
