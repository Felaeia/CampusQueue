import React from 'react';
import Svg, { Rect } from 'react-native-svg';

import mockData from '../data/mockData.json';
import { Colors } from '../theme/tokens';

interface TicketBarcodeProps {
  serial?: string;
  bars?: number[];
}

export function TicketBarcode({
  serial = 'CQ-2026-R042',
  bars = mockData.barcodePattern,
}: TicketBarcodeProps) {
  let cursor = 0;

  return (
    <Svg
      width={88}
      height={16}
      viewBox="0 0 88 16"
      fill="none"
      accessibilityLabel={`Barcode ${serial}`}
    >
      {bars.map((w, idx) => {
        const x = cursor;
        cursor += w + (idx % 2 === 0 ? 1.5 : 2.1);
        if (idx % 2 !== 0) return null;
        return (
          <Rect
            key={idx}
            x={x}
            y={0}
            width={w}
            height={16}
            rx={0.4}
            fill={Colors.ink}
            fillOpacity={0.72}
          />
        );
      })}
    </Svg>
  );
}
