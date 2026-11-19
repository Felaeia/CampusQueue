import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useQueue } from '../context/QueueContext';
import { Colors, Fonts, Radii, Shadows } from '../theme/tokens';

const NAV_TABS = [
  { route: '/student/home' as const, label: 'Home', key: 'home' },
  { route: '/student/ticket' as const, label: 'Ticket', key: 'ticket' },
  { route: '/student/history' as const, label: 'History', key: 'history' },
];

export function FloatingBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeTickets, triggerHaptic } = useQueue();

  const shouldShow =
    pathname === '/student/home' ||
    pathname === '/student/ticket' ||
    pathname === '/student/history';

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
        {NAV_TABS.map((tab) => {
          const isActive = pathname === tab.route;
          const showActiveDot = tab.key === 'ticket' && activeTickets.length > 0 && !isActive;
          const iconColor = isActive ? Colors.ink : Colors.inkTabInactive;

          return (
            <Pressable
              key={tab.route}
              onPress={() => {
                if (!isActive) {
                  triggerHaptic('light');
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
              <View style={styles.iconWrap}>
                {tab.key === 'home' ? (
                  <Feather name="home" size={18} color={iconColor} />
                ) : tab.key === 'ticket' ? (
                  <Ionicons name="ticket-outline" size={19} color={iconColor} />
                ) : (
                  <Feather name="clock" size={18} color={iconColor} />
                )}
                {showActiveDot ? <View style={styles.activeDot} /> : null}
              </View>
              <Text
                style={[
                  styles.label,
                  isActive ? styles.labelActive : styles.labelInactive,
                ]}
              >
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
  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDot: {
    position: 'absolute',
    top: -2,
    right: -5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.matcha,
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
