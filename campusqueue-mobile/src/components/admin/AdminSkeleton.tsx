import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, Radii, Shadows } from '../../theme/tokens';

function usePulseOpacity() {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 720,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 720,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return opacity;
}

function SkeletonBar({
  opacity,
  style,
}: {
  opacity: Animated.Value;
  style?: StyleProp<ViewStyle>;
}) {
  return <Animated.View style={[styles.bar, { opacity }, style]} />;
}

/**
 * Animated loading skeleton for Screen 4.1: Admin Dashboard (/admin/dashboard)
 */
export function AdminDashboardSkeleton() {
  const opacity = usePulseOpacity();

  return (
    <View style={styles.stack}>
      {/* 2x2 Bento KPI Grid */}
      <View style={styles.bentoGrid}>
        <View style={[styles.kpiCard, styles.kpiCardDark, Shadows.heroDark]}>
          <SkeletonBar opacity={opacity} style={[styles.barDark, { width: '62%', height: 10 }]} />
          <SkeletonBar opacity={opacity} style={[styles.barDarkAccent, { width: '44%', height: 28 }]} />
          <SkeletonBar opacity={opacity} style={[styles.barDark, { width: '78%', height: 10 }]} />
        </View>
        {[0, 1, 2].map((idx) => (
          <View key={idx} style={[styles.kpiCard, Shadows.card]}>
            <SkeletonBar opacity={opacity} style={{ width: '58%', height: 10 }} />
            <SkeletonBar opacity={opacity} style={{ width: '38%', height: 28 }} />
            <SkeletonBar opacity={opacity} style={{ width: '74%', height: 10 }} />
          </View>
        ))}
      </View>

      {/* Live Office Load Monitor Card */}
      <View style={[styles.card, Shadows.card]}>
        <View style={styles.rowBetween}>
          <View style={styles.colGap6}>
            <SkeletonBar opacity={opacity} style={{ width: 168, height: 15 }} />
            <SkeletonBar opacity={opacity} style={{ width: 215, height: 11 }} />
          </View>
          <SkeletonBar opacity={opacity} style={{ width: 54, height: 22, borderRadius: Radii.pill }} />
        </View>
        {[0, 1, 2].map((idx) => (
          <View key={idx} style={styles.officeRow}>
            <View style={styles.rowBetween}>
              <SkeletonBar opacity={opacity} style={{ width: 140, height: 13 }} />
              <SkeletonBar opacity={opacity} style={{ width: 68, height: 12 }} />
            </View>
            <SkeletonBar opacity={opacity} style={{ width: '100%', height: 8, borderRadius: Radii.pill }} />
          </View>
        ))}
      </View>

      {/* Peak Hours / Daily Volume Card */}
      <View style={[styles.card, Shadows.card]}>
        <SkeletonBar opacity={opacity} style={{ width: 150, height: 15 }} />
        <SkeletonBar opacity={opacity} style={{ width: 200, height: 11 }} />
        <View style={styles.chartBars}>
          {[48, 82, 64, 96, 72, 54, 88].map((height, idx) => (
            <SkeletonBar
              key={idx}
              opacity={opacity}
              style={{ flex: 1, height, borderRadius: Radii.sm }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

/**
 * Animated loading skeleton for Screen 4.2: Campus Offices & Services (/admin/offices)
 */
export function AdminOfficesSkeleton() {
  const opacity = usePulseOpacity();

  return (
    <View style={styles.stack}>
      {[0, 1, 2].map((idx) => (
        <View key={idx} style={[styles.card, Shadows.card]}>
          <View style={styles.rowCenter}>
            <SkeletonBar opacity={opacity} style={{ width: 42, height: 42, borderRadius: Radii.md }} />
            <View style={[styles.flex, styles.colGap6]}>
              <View style={styles.rowCenter}>
                <SkeletonBar opacity={opacity} style={{ width: '54%', height: 14 }} />
                <SkeletonBar opacity={opacity} style={{ width: 50, height: 18, borderRadius: Radii.pill }} />
              </View>
              <SkeletonBar opacity={opacity} style={{ width: '68%', height: 11 }} />
            </View>
            <SkeletonBar opacity={opacity} style={{ width: 44, height: 24, borderRadius: Radii.pill }} />
          </View>

          <View style={styles.divider} />

          <View style={styles.rowBetween}>
            <View style={styles.rowCenter}>
              <SkeletonBar opacity={opacity} style={{ width: 82, height: 28, borderRadius: Radii.pill }} />
              <SkeletonBar opacity={opacity} style={{ width: 102, height: 28, borderRadius: Radii.pill }} />
            </View>
            <SkeletonBar opacity={opacity} style={{ width: 78, height: 18, borderRadius: Radii.sm }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Animated loading skeleton for Screen 4.3: Users & Access Directory (/admin/users)
 */
export function AdminUsersSkeleton() {
  const opacity = usePulseOpacity();

  return (
    <View style={styles.stack}>
      {[0, 1, 2, 3].map((idx) => (
        <View key={idx} style={[styles.card, Shadows.card]}>
          <View style={styles.rowCenter}>
            <SkeletonBar opacity={opacity} style={{ width: 40, height: 40, borderRadius: 20 }} />
            <View style={[styles.flex, styles.colGap6]}>
              <View style={styles.rowBetween}>
                <SkeletonBar opacity={opacity} style={{ width: '52%', height: 14 }} />
                <SkeletonBar opacity={opacity} style={{ width: 62, height: 20, borderRadius: Radii.pill }} />
              </View>
              <SkeletonBar opacity={opacity} style={{ width: '40%', height: 11 }} />
              <SkeletonBar opacity={opacity} style={{ width: '66%', height: 10 }} />
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.rowCenter}>
            <SkeletonBar opacity={opacity} style={{ flex: 1, height: 32, borderRadius: Radii.md }} />
            <SkeletonBar opacity={opacity} style={{ flex: 1, height: 32, borderRadius: Radii.md }} />
            <SkeletonBar opacity={opacity} style={{ width: 74, height: 32, borderRadius: Radii.md }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Animated loading skeleton for Screen 4.4: Audit Reports (/admin/reports)
 */
export function AdminReportsSkeleton() {
  const opacity = usePulseOpacity();

  return (
    <View style={styles.stack}>
      {[0, 1, 2, 3].map((idx) => (
        <View key={idx} style={[styles.card, Shadows.card]}>
          <View style={styles.rowBetween}>
            <View style={styles.colGap6}>
              <SkeletonBar opacity={opacity} style={{ width: 92, height: 15 }} />
              <SkeletonBar opacity={opacity} style={{ width: 132, height: 10 }} />
            </View>
            <SkeletonBar opacity={opacity} style={{ width: 76, height: 22, borderRadius: Radii.pill }} />
          </View>

          <View style={styles.colGap6}>
            <SkeletonBar opacity={opacity} style={{ width: '76%', height: 12 }} />
            <SkeletonBar opacity={opacity} style={{ width: '58%', height: 11 }} />
          </View>

          <View style={styles.rowBetween}>
            <SkeletonBar opacity={opacity} style={{ width: 96, height: 20, borderRadius: Radii.sm }} />
            <SkeletonBar opacity={opacity} style={{ width: 84, height: 20, borderRadius: Radii.sm }} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    width: '48.4%',
    minHeight: 112,
    borderRadius: Radii.card,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 15,
    justifyContent: 'space-between',
    gap: 10,
  },
  kpiCardDark: {
    backgroundColor: Colors.ink,
    borderColor: Colors.ink,
  },
  card: {
    borderRadius: Radii.card,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 12,
  },
  bar: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radii.sm,
  },
  barDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  barDarkAccent: {
    backgroundColor: 'rgba(182, 240, 118, 0.28)',
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  colGap6: {
    gap: 6,
  },
  officeRow: {
    gap: 8,
    paddingTop: 4,
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    height: 110,
    paddingTop: 12,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
});
