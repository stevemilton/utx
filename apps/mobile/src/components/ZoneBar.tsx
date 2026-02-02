import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../constants/theme';

interface ZoneBarProps {
  zoneTimes: {
    zone1: number; // seconds
    zone2: number;
    zone3: number;
    zone4: number;
    zone5: number;
  };
  totalTime: number; // seconds
  showLabels?: boolean;
}

const ZONE_COLORS = [
  colors.zone1,
  colors.zone2,
  colors.zone3,
  colors.zone4,
  colors.zone5,
];

const ZONE_LABELS = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'];
const ZONE_NAMES = ['Recovery', 'Easy', 'Aerobic', 'Threshold', 'Max'];

export const ZoneBar: React.FC<ZoneBarProps> = ({
  zoneTimes,
  totalTime,
  showLabels = true,
}) => {
  const zones = [
    zoneTimes.zone1,
    zoneTimes.zone2,
    zoneTimes.zone3,
    zoneTimes.zone4,
    zoneTimes.zone5,
  ];

  const percentages = zones.map((time) =>
    totalTime > 0 ? (time / totalTime) * 100 : 0
  );

  // Filter out zones with 0%
  const activeZones = percentages
    .map((pct, i) => ({ pct, color: ZONE_COLORS[i], label: ZONE_LABELS[i], name: ZONE_NAMES[i], index: i }))
    .filter((z) => z.pct > 0);

  return (
    <View style={styles.container}>
      {/* Zone bar */}
      <View style={styles.barContainer}>
        {activeZones.map((zone, i) => (
          <View
            key={zone.index}
            style={[
              styles.segment,
              {
                backgroundColor: zone.color,
                flex: zone.pct,
                borderTopLeftRadius: i === 0 ? borderRadius.sm : 0,
                borderBottomLeftRadius: i === 0 ? borderRadius.sm : 0,
                borderTopRightRadius: i === activeZones.length - 1 ? borderRadius.sm : 0,
                borderBottomRightRadius: i === activeZones.length - 1 ? borderRadius.sm : 0,
              },
            ]}
          />
        ))}
      </View>

      {/* Labels */}
      {showLabels && (
        <View style={styles.labelsContainer}>
          {activeZones.map((zone) => (
            <View key={zone.index} style={[styles.labelItem, { flex: zone.pct }]}>
              {zone.pct >= 10 && (
                <>
                  <Text style={[styles.labelText, { color: zone.color }]}>
                    {zone.label}
                  </Text>
                  <Text style={styles.percentText}>
                    {Math.round(zone.pct)}%
                  </Text>
                </>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Legend */}
      <View style={styles.legendContainer}>
        {ZONE_COLORS.map((color, i) => (
          <View key={i} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={styles.legendText}>{ZONE_NAMES[i]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  barContainer: {
    flexDirection: 'row',
    height: 24,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  segment: {
    height: '100%',
  },
  labelsContainer: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  labelItem: {
    alignItems: 'center',
    minWidth: 30,
  },
  labelText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  percentText: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.md,
    gap: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
});
