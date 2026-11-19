import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import { Colors, Fonts, Shadows } from '../theme/tokens';

export function CampusQueueEmblem() {
  return (
    <View style={[styles.container, Shadows.heroDark]}>
      <View style={[styles.notch, styles.notchLeft]} />
      <View style={[styles.notch, styles.notchRight]} />
      <Svg width={32} height={32} viewBox="0 0 32 32" fill="none" accessibilityLabel="CampusQueue Logo">
        <Rect x={2.5} y={2.5} width={27} height={27} rx={8} stroke={Colors.matcha} strokeWidth={2.2} />
        <SvgText
          x={16}
          y={20.5}
          textAnchor="middle"
          fill={Colors.matcha}
          fontSize={13.5}
          fontWeight="800"
          fontFamily={Fonts.displayExtraBold}
        >
          CQ
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notch: {
    position: 'absolute',
    top: '50%',
    marginTop: -6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.canvas,
  },
  notchLeft: {
    left: -6,
  },
  notchRight: {
    right: -6,
  },
});
