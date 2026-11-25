import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Colors, Fonts } from '../theme/tokens';

interface TactileQRCodeProps {
  value?: string;
  size?: number;
}

/**
 * Scannable QR code powered by react-native-qrcode-svg (EC Level H)
 * with a centered Acid Matcha "CQ" emblem overlay.
 */
export function TactileQRCode({
  value = 'cq:v1:R-042:23000440130',
  size = 114,
}: TactileQRCodeProps) {
  const innerSize = Math.max(56, size - 16);
  const badgeOuterSize = Math.round(innerSize * 0.23);
  const badgeInnerSize = Math.max(14, badgeOuterSize - 4);
  const badgeFontSize = Math.max(8, Math.round(badgeInnerSize * 0.48));

  return (
    <View style={[styles.frame, { width: size, height: size }]}>
      <QRCode
        value={value}
        size={innerSize}
        ecl="H"
        quietZone={4}
        color={Colors.ink}
        backgroundColor={Colors.surface}
      />
      <View
        pointerEvents="none"
        style={[
          styles.badgeOuter,
          {
            width: badgeOuterSize,
            height: badgeOuterSize,
            borderRadius: Math.max(5, Math.round(badgeOuterSize * 0.24)),
          },
        ]}
      >
        <View
          style={[
            styles.badgeInner,
            {
              width: badgeInnerSize,
              height: badgeInnerSize,
              borderRadius: Math.max(4, Math.round(badgeInnerSize * 0.22)),
            },
          ]}
        >
          <Text style={[styles.badgeText, { fontSize: badgeFontSize }]}>CQ</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    position: 'relative',
    borderRadius: 14,
    backgroundColor: Colors.surface,
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeOuter: {
    position: 'absolute',
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeInner: {
    backgroundColor: Colors.matcha,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: Fonts.displayExtraBold,
    color: Colors.ink,
    letterSpacing: -0.4,
    includeFontPadding: false,
  },
});
