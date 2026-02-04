import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../../constants/theme';
import { api } from '../../services/api';
import type { RootStackScreenProps } from '../../navigation/types';

// Policy URLs
const TERMS_URL = 'https://kind-lotus-435.notion.site/Terms-and-Conditions-2fcfeff7be0080a986f2c832b177ddde';
const PRIVACY_URL = 'https://kind-lotus-435.notion.site/Privacy-Policy-2fcfeff7be0080718fccc8b94e22580d';

interface ConsentStatus {
  consentType: string;
  granted: boolean;
  grantedAt?: string;
  revokedAt?: string;
}

export const PrivacySettingsScreen: React.FC = () => {
  const navigation = useNavigation<RootStackScreenProps<'PrivacySettings'>['navigation']>();
  const [isLoading, setIsLoading] = useState(true);
  const [consents, setConsents] = useState<ConsentStatus[]>([]);
  const [isSaving, setIsSaving] = useState<string | null>(null);

  useEffect(() => {
    loadConsents();
  }, []);

  const loadConsents = async () => {
    try {
      const response = await api.getConsents();
      if (response.success && response.data) {
        const data = response.data as { consents: ConsentStatus[] };
        setConsents(data.consents);
      }
    } catch (error) {
      console.error('Failed to load consents:', error);
      Alert.alert('Error', 'Failed to load privacy settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleConsent = async (type: string, currentValue: boolean) => {
    // Prevent toggling required consents off
    if ((type === 'terms' || type === 'privacy') && currentValue) {
      Alert.alert(
        'Required Consent',
        'You cannot revoke required consents. To withdraw consent, you must delete your account.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsSaving(type);
    const appVersion = Constants.expoConfig?.version || '1.0.0';

    try {
      const response = await api.updateConsent(type, !currentValue, appVersion);
      if (response.success) {
        // Update local state
        setConsents((prev) =>
          prev.map((c) =>
            c.consentType === type
              ? { ...c, granted: !currentValue, grantedAt: new Date().toISOString() }
              : c
          )
        );
      } else {
        Alert.alert('Error', response.error || 'Failed to update setting');
      }
    } catch (error) {
      console.error('Failed to update consent:', error);
      Alert.alert('Error', 'Failed to update setting');
    } finally {
      setIsSaving(null);
    }
  };

  const handleOpenTerms = async () => {
    await WebBrowser.openBrowserAsync(TERMS_URL);
  };

  const handleOpenPrivacy = async () => {
    await WebBrowser.openBrowserAsync(PRIVACY_URL);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getConsent = (type: string): ConsentStatus | undefined => {
    return consents.find((c) => c.consentType === type);
  };

  const getDisplayName = (type: string): { title: string; description: string } => {
    switch (type) {
      case 'terms':
        return {
          title: 'Terms & Conditions',
          description: 'Required to use UTx',
        };
      case 'privacy':
        return {
          title: 'Privacy Policy',
          description: 'Required to use UTx',
        };
      case 'marketing':
        return {
          title: 'Marketing Communications',
          description: 'Receive training tips, updates, and offers via email',
        };
      case 'analytics':
        return {
          title: 'Usage Analytics',
          description: 'Help improve UTx with anonymous usage data',
        };
      case 'coach_sharing':
        return {
          title: 'Coach Data Sharing',
          description: 'Allow club coaches to view your workout data',
        };
      default:
        return { title: type, description: '' };
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Privacy Settings</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const requiredConsents = ['terms', 'privacy'];
  const optionalConsents = ['marketing', 'analytics', 'coach_sharing'];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Required Consents */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Required Agreements</Text>
          <Text style={styles.sectionSubtitle}>
            These are required to use UTx and cannot be revoked
          </Text>

          {requiredConsents.map((type) => {
            const consent = getConsent(type);
            const { title, description } = getDisplayName(type);
            return (
              <View key={type} style={styles.consentRow}>
                <View style={styles.consentInfo}>
                  <View style={styles.consentHeader}>
                    <Text style={styles.consentTitle}>{title}</Text>
                    {consent?.granted && (
                      <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                    )}
                  </View>
                  <Text style={styles.consentDescription}>{description}</Text>
                  {consent?.grantedAt && (
                    <Text style={styles.consentDate}>
                      Accepted {formatDate(consent.grantedAt)}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  onPress={type === 'terms' ? handleOpenTerms : handleOpenPrivacy}
                  style={styles.viewButton}
                >
                  <Text style={styles.viewButtonText}>View</Text>
                  <Ionicons name="open-outline" size={14} color={colors.primary} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* Optional Consents */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Optional Permissions</Text>
          <Text style={styles.sectionSubtitle}>
            You can change these settings at any time
          </Text>

          {optionalConsents.map((type) => {
            const consent = getConsent(type);
            const { title, description } = getDisplayName(type);
            const isGranted = consent?.granted ?? false;

            return (
              <View key={type} style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.consentTitle}>{title}</Text>
                  <Text style={styles.consentDescription}>{description}</Text>
                </View>
                {isSaving === type ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Switch
                    value={isGranted}
                    onValueChange={() => handleToggleConsent(type, isGranted)}
                    trackColor={{ false: colors.surface, true: colors.primaryLight }}
                    thumbColor={isGranted ? colors.primary : colors.textTertiary}
                  />
                )}
              </View>
            );
          })}
        </View>

        {/* Data Controller Info */}
        <View style={styles.infoBox}>
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.textTertiary} />
          <Text style={styles.infoText}>
            Your data is protected by UK GDPR.{'\n'}
            Data Controller: Polar Industries Ltd.
          </Text>
        </View>
      </ScrollView>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginBottom: spacing.md,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  consentInfo: {
    flex: 1,
  },
  consentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2,
  },
  consentTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  consentDescription: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  consentDate: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: spacing.sm,
  },
  viewButtonText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  toggleInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.backgroundTertiary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.xxl,
  },
  infoText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    lineHeight: 18,
  },
});
