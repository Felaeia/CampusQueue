import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import { Colors, Fonts } from '../theme/tokens';

interface TactileQRCodeProps {
  value?: string;
  size?: number;
}

export function TactileQRCode({ value = 'CQ-2026-R042', size = 114 }: TactileQRCodeProps) {
  const modules = 21;

  const grid = useMemo(() => {
    let seed = 0;
    for (let i = 0; i < value.length; i++) {
      seed = (seed * 31 + value.charCodeAt(i)) % 9973;
    }

    const matrix: boolean[][] = Array.from({ length: modules }, () =>
      Array<boolean>(modules).fill(false)
    );

    const placeFinder = (rOff: number, cOff: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const isOuter = r === 0 || r === 6 || c === 0 || c === 6;
          const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          matrix[rOff + r][cOff + c] = isOuter || isInner;
        }
      }
    };

    placeFinder(0, 0);
    placeFinder(0, modules - 7);
    placeFinder(modules - 7, 0);

    for (let i = 8; i < modules - 8; i++) {
      matrix[6][i] = i % 2 === 0;
      matrix[i][6] = i % 2 === 0;
    }

    for (let r = 0; r < modules; r++) {
      for (let c = 0; c < modules; c++) {
        const inTL = r < 8 && c < 8;
        const inTR = r < 8 && c >= modules - 8;
        const inBL = r >= modules - 8 && c < 8;
        const inCenter = r >= 8 && r <= 12 && c >= 8 && c <= 12;
        if (inTL || inTR || inBL || inCenter || r === 6 || c === 6) continue;
        seed = (seed * 16807 + 19) % 2147483647;
        matrix[r][c] = seed % 100 < 54;
      }
    }

    return matrix;
  }, [value]);

  const cell = 100 / modules;
  const innerSize = Math.max(40, size - 16);

  return (
    <View style={[styles.frame, { width: size, height: size }]}>
      <Svg width={innerSize} height={innerSize} viewBox="0 0 100 100">
        {grid.map((row, rIdx) =>
          row.map((on, cIdx) =>
            on ? (
              <Rect
                key={`${rIdx}-${cIdx}`}
                x={cIdx * cell}
                y={rIdx * cell}
                width={cell + 0.16}
                height={cell + 0.16}
                rx={cell * 0.16}
                fill={Colors.ink}
              />
            ) : null
          )
        )}
        <Rect x={35.5} y={35.5} width={29} height={29} rx={7} fill={Colors.ink} />
        <Rect x={38} y={38} width={24} height={24} rx={5.5} fill={Colors.matcha} />
        <SvgText
          x={50}
          y={53.8}
          textAnchor="middle"
          fill={Colors.ink}
          fontSize={11.5}
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
  frame: {
    borderRadius: 14,
    backgroundColor: Colors.surface,
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
