import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useQueue } from '../../context/QueueContext';
import { Colors, Fonts, Radii, Shadows } from '../../theme/tokens';

const ADMIN_TABS = [
  { route: '/admin/dashboard' as const, label: 'Overview', icon: 'activity' as const },
  { route: '/admin/offices' as const, label: 'Offices', icon: 'layers' as const },
  { route: '/admin/users' as const, label: 'Users', icon: 'users' as const },
  { route: '/admin/reports' as const, label: 'Reports', icon: 'file-text' as const },
];

export function AdminBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { triggerHaptic } = useQueue();

  const shouldShow = ADMIN_TABS.some((tab) => tab.route === pathname);
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
        {ADMIN_TABS.map((tab) => {
          const isActive = pathname === tab.route;
          const iconColor = isActive ? Colors.ink : Colors.inkTabInactive;

          return (
            <Pressable
              key={tab.route}
              onPress={() => {
                if (isActive) return;
                triggerHaptic('light');
                router.replace(tab.route);
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
              <Feather name={tab.icon} size={17} color={iconColor} />
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
    left: 16,
    right: 16,
    zIndex: 30,
    alignItems: 'center',
  },
  pillBar: {
    width: '100%',
    maxWidth: 420,
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
    fontSize: 10,
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
