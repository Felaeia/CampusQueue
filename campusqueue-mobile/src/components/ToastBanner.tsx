import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useQueue } from '../context/QueueContext';
import { Colors, Fonts, Radii, Shadows } from '../theme/tokens';

export function ToastBanner() {
  const { toast } = useQueue();
  const insets = useSafeAreaInsets();

  if (!toast) return null;

  const isMatcha = toast.tone === 'matcha';
  const isWarning = toast.tone === 'warning';

  const bgColor = isMatcha ? Colors.matcha : isWarning ? Colors.warning : Colors.ink;
  const textColor = isMatcha ? Colors.ink : Colors.surface;
  const borderColor = isMatcha
    ? 'rgba(18, 20, 23, 0.20)'
    : isWarning
      ? 'rgba(18, 20, 23, 0.12)'
      : 'rgba(255, 255, 255, 0.16)';

  return (
    <View
      pointerEvents="none"
      style={[
        styles.overlay,
        {
          top: Math.max(insets.top + 8, 18),
        },
      ]}
    >
      <View
        style={[
          styles.banner,
          Shadows.heroDark,
          {
            backgroundColor: bgColor,
            borderColor,
          },
        ]}
      >
        <Text style={[styles.message, { color: textColor }]} numberOfLines={2}>
          {toast.message}
        </Text>
        <Feather name="check-circle" size={16} color={textColor} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 100,
  },
  banner: {
    borderRadius: Radii.xl,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  message: {
    flex: 1,
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    lineHeight: 16,
  },
});
