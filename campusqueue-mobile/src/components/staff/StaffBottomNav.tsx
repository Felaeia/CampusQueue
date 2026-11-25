import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useQueue } from '../../context/QueueContext';
import { Colors, Fonts, Radii, Shadows } from '../../theme/tokens';

const STAFF_TABS = [
  { route: '/staff/registrar' as const, label: 'Desk', icon: 'desktop-outline' as const },
  { route: '/staff/scanner' as const, label: 'Scanner', icon: 'qr-code-outline' as const },
  { route: '/staff/logs' as const, label: 'Logs', icon: 'document-text-outline' as const },
];

/**
 * Floating Obsidian pill bottom navigation bar for Registrar Staff screens.
 * Hidden on the full-bleed camera scanner screen.
 */
export function StaffBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { triggerHaptic } = useQueue();

  const shouldShow = pathname === '/staff/registrar' || pathname === '/staff/logs';
  if (!shouldShow) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.outer,
        {
          bottom: Math.max(insets.bottom + 10, 20),
        },
      ]}
    >
      <View style={[styles.pillBar, Shadows.floatingNav]}>
        {STAFF_TABS.map((tab) => {
          const isActive = pathname === tab.route;
          const iconColor = isActive ? Colors.ink : Colors.inkTabInactive;

          return (
            <Pressable
              key={tab.route}
              onPress={() => {
                if (isActive) return;
                triggerHaptic('light');
                if (tab.route === '/staff/scanner') {
                  router.push(tab.route);
                } else {
                  router.replace(tab.route);
                }
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
              style={({ pressed }) => [
                styles.tabButton,
                isActive && styles.tabButtonActive,
                pressed && !isActive && styles.tabButtonPressed,
              ]}
            >
              <Ionicons name={tab.icon} size={18} color={iconColor} />
              <Text style={[styles.label, isActive ? styles.labelActive : styles.labelInactive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 30,
    alignItems: 'center',
  },
  pillBar: {
    width: '100%',
    maxWidth: 380,
    height: 64,
    padding: 6,
    borderRadius: Radii.pill,
    backgroundColor: Colors.ink,
    flexDirection: 'row',
    gap: 4,
  },
  tabButton: {
    flex: 1,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: Colors.surface,
  },
  tabButtonPressed: {
    opacity: 0.78,
  },
  label: {
    fontSize: 10.5,
    marginTop: 3,
    lineHeight: 12,
  },
  labelActive: {
    fontFamily: Fonts.bodyBold,
    color: Colors.ink,
  },
  labelInactive: {
    fontFamily: Fonts.bodyMedium,
    color: Colors.inkTabInactive,
  },
});
