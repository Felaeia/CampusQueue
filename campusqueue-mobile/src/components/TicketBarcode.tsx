import React from 'react';
import Svg, { Rect } from 'react-native-svg';

import { Colors } from '../theme/tokens';

interface TicketBarcodeProps {
  serial?: string;
  bars?: number[];
}

export function TicketBarcode({
  serial = 'CQ-2026-R042',
  bars = [2, 1, 3, 1, 2, 2, 1, 3, 2, 1],
}: TicketBarcodeProps) {

  return (
    <Svg
      width={88}
      height={16}
      viewBox="0 0 88 16"
      fill="none"
      accessibilityLabel={`Barcode ${serial}`}
    >
      {bars.map((w, idx) => {
        const x = bars.slice(0, idx).reduce((offset, width, index) => offset + width + (index % 2 === 0 ? 1.5 : 2.1), 0);
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
