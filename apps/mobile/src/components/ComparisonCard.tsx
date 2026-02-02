import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '../constants/theme';

interface ComparisonRowProps {
  label: string;
  currentValue: number | null;
  previousValue: number | null;
  format: 'time' | 'split' | 'number' | 'hr';
  higherIsBetter?: boolean; // default false (lower is better, like time/split)
}

interface ComparisonCardProps {
  title: string;
  subtitle?: string;
  rows: ComparisonRowProps[];
}

// Format time as M:SS.S
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
};

// Format a value based on type
const formatValue = (value: number | null, format: string): string => {
  if (value === null || value === undefined) return '—';
  switch (format) {
    case 'time':
      return formatTime(value);
    case 'split':
      return formatTime(value);
    case 'hr':
      return `${Math.round(value)}`;
    case 'number':
    default:
      return value.toLocaleString();
  }
};

// Format the delta value
const formatDelta = (delta: number, format: string): string => {
  const sign = delta > 0 ? '+' : '';
  switch (format) {
    case 'time':
    case 'split':
      const absDelta = Math.abs(delta);
      if (absDelta >= 60) {
        return `${sign}${formatTime(delta)}`;
      }
      return `${sign}${delta.toFixed(1)}s`;
    case 'hr':
      return `${sign}${Math.round(delta)} bpm`;
    case 'number':
    default:
      return `${sign}${delta.toFixed(1)}`;
  }
};

const ComparisonRow: React.FC<ComparisonRowProps> = ({
  label,
  currentValue,
  previousValue,
  format,
  higherIsBetter = false,
}) => {
  if (currentValue === null || previousValue === null) {
    return null;
  }

  const delta = currentValue - previousValue;
  const isImprovement = higherIsBetter ? delta > 0 : delta < 0;
  const isNeutral = Math.abs(delta) < 0.5; // Negligible difference

  const iconName = isNeutral
    ? 'remove-outline'
    : isImprovement
    ? 'checkmark-circle'
    : 'close-circle';

  const iconColor = isNeutral
    ? colors.textTertiary
    : isImprovement
    ? colors.success
    : colors.error;

  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowCurrent}>{formatValue(currentValue, format)}</Text>
      <Text style={styles.rowPrevious}>{formatValue(previousValue, format)}</Text>
      <View style={styles.rowDelta}>
        <Text style={[styles.deltaText, { color: iconColor }]}>
          {formatDelta(delta, format)}
        </Text>
        <Ionicons name={iconName} size={16} color={iconColor} />
      </View>
    </View>
  );
};

export const ComparisonCard: React.FC<ComparisonCardProps> = ({
  title,
  subtitle,
  rows,
}) => {
  // Filter out rows where both values are null
  const validRows = rows.filter(
    (r) => r.currentValue !== null || r.previousValue !== null
  );

  if (validRows.length === 0) {
    return null;
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>

      {/* Column headers */}
      <View style={styles.headerRow}>
        <Text style={styles.headerLabel}>Metric</Text>
        <Text style={styles.headerValue}>Now</Text>
        <Text style={styles.headerValue}>Then</Text>
        <Text style={styles.headerDelta}>Delta</Text>
      </View>

      {/* Data rows */}
      {validRows.map((row, index) => (
        <ComparisonRow key={index} {...row} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  header: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.sm,
  },
  headerLabel: {
    flex: 2,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  headerValue: {
    flex: 1.5,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textTertiary,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  headerDelta: {
    flex: 2,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textTertiary,
    textAlign: 'right',
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  rowLabel: {
    flex: 2,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  rowCurrent: {
    flex: 1.5,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  rowPrevious: {
    flex: 1.5,
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  rowDelta: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
  deltaText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
});
