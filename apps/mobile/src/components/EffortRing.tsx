import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, spacing, fontSize, fontWeight } from '../constants/theme';

interface EffortRingProps {
  score: number; // 0-10
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
}

// Get color based on effort score
const getEffortColor = (score: number): string => {
  if (score <= 4) return colors.effortLow;
  if (score <= 7) return colors.effortMedium;
  return colors.effortHigh;
};

// Get contextual label based on effort score
const getEffortLabel = (score: number): string => {
  if (score <= 2) return 'Recovery Row';
  if (score <= 4) return 'Light Session';
  if (score <= 6) return 'Solid Work';
  if (score <= 8) return 'Hard Effort';
  return 'Max Effort';
};

export const EffortRing: React.FC<EffortRingProps> = ({
  score,
  size = 180,
  strokeWidth = 12,
  showLabel = true,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(score / 10, 0), 1);
  const strokeDashoffset = circumference * (1 - progress);
  const effortColor = getEffortColor(score);

  return (
    <View style={styles.container}>
      <View style={[styles.ringContainer, { width: size, height: size }]}>
        <Svg width={size} height={size} style={styles.svg}>
          {/* Background circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.backgroundTertiary}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={effortColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        {/* Center content */}
        <View style={styles.centerContent}>
          <Text style={[styles.scoreValue, { color: effortColor }]}>
            {score.toFixed(1)}
          </Text>
          <Text style={styles.scoreDenominator}>/10</Text>
        </View>
      </View>
      {showLabel && (
        <Text style={[styles.label, { color: effortColor }]}>
          {getEffortLabel(score)}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  ringContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  svg: {
    position: 'absolute',
  },
  centerContent: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  scoreValue: {
    fontSize: fontSize.display,
    fontWeight: fontWeight.bold,
  },
  scoreDenominator: {
    fontSize: fontSize.xl,
    color: colors.textTertiary,
    marginLeft: spacing.xs,
  },
  label: {
    marginTop: spacing.md,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
});
