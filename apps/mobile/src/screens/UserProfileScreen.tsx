import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors, spacing, fontSize, fontWeight } from '../constants/theme';
import type { RootStackScreenProps } from '../navigation/types';

export const UserProfileScreen: React.FC = () => {
  const navigation = useNavigation<RootStackScreenProps<'UserProfile'>['navigation']>();
  const route = useRoute<RootStackScreenProps<'UserProfile'>['route']>();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.content}>
        <Text style={styles.placeholder}>User profile {route.params.userId}</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: { fontSize: 24, color: colors.textSecondary },
  headerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholder: { fontSize: fontSize.md, color: colors.textTertiary },
});
