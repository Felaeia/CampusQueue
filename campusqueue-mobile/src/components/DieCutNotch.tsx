import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Colors } from '../theme/tokens';

interface DieCutNotchProps {
  side?: 'left' | 'right';
  size?: number;
  strokeColor?: string | null;
  bgColor?: string;
}

export function DieCutNotch({
  side = 'left',
  size = 20,
  strokeColor = Colors.border,
  bgColor = Colors.canvas,
}: DieCutNotchProps) {
  const r = size / 2;
  const w = r + 3;
  const isLeft = side === 'left';

  return (
    <View
      pointerEvents="none"
      style={[
        styles.wrapper,
        {
          height: size,
          marginTop: -r,
          left: isLeft ? -1.5 : undefined,
          right: !isLeft ? -1.5 : undefined,
        },
      ]}
    >
      <Svg width={w} height={size} viewBox={`0 0 ${w} ${size}`} fill="none">
        {isLeft ? (
          <>
            <Path d={`M 0 0 L 1.5 0 A ${r} ${r} 0 0 1 1.5 ${size} L 0 ${size} Z`} fill={bgColor} />
            {strokeColor ? (
              <Path
                d={`M 1.5 0.5 A ${r - 0.5} ${r - 0.5} 0 0 1 1.5 ${size - 0.5}`}
                stroke={strokeColor}
                strokeWidth={1}
                fill="none"
              />
            ) : null}
          </>
        ) : (
          <>
            <Path
              d={`M ${w} 0 L ${w - 1.5} 0 A ${r} ${r} 0 0 0 ${w - 1.5} ${size} L ${w} ${size} Z`}
              fill={bgColor}
            />
            {strokeColor ? (
              <Path
                d={`M ${w - 1.5} 0.5 A ${r - 0.5} ${r - 0.5} 0 0 0 ${w - 1.5} ${size - 0.5}`}
                stroke={strokeColor}
                strokeWidth={1}
                fill="none"
              />
            ) : null}
          </>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: '50%',
    zIndex: 10,
  },
});
