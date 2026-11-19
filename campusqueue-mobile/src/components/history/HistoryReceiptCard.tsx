import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { HistoryTicket } from '../../types/queue';
import {
  Colors,
  Fonts,
  getDepartmentBadgeStyle,
  getTicketStatusBadgeStyle,
  Radii,
  Shadows,
} from '../../theme/tokens';
import { DieCutNotch } from '../DieCutNotch';

interface HistoryReceiptCardProps {
  item: HistoryTicket;
  onPress: (item: HistoryTicket) => void;
}

export function HistoryReceiptCard({ item, onPress }: HistoryReceiptCardProps) {
  const dept = getDepartmentBadgeStyle(item.officeId);
  const st = getTicketStatusBadgeStyle(item.status);

  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => [styles.card, Shadows.card, pressed && styles.cardPressed]}
    >
      {/* Upper Section */}
      <View style={styles.upper}>
        <View style={styles.badgeRow}>
          <View style={[styles.deptBadge, { backgroundColor: dept.bg }]}>
            <Text style={[styles.deptBadgeText, { color: dept.text }]}>{dept.label}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
            <Text style={[styles.statusBadgeText, { color: st.text }]}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.titleRow}>
          <Text style={styles.ticketNumber}>{item.ticketNumber}</Text>
          <Text style={styles.serviceName} numberOfLines={1}>
            {item.service}
          </Text>
        </View>
      </View>

      <View style={styles.seam}>
        <DieCutNotch side="left" size={18} strokeColor={Colors.border} bgColor={Colors.canvas} />
        <View style={styles.dashedWrap}>
          <Svg width="100%" height={2}>
            <Line
              x1="0"
              y1="1"
              x2="100%"
              y2="1"
              stroke={Colors.dashedReceipt}
              strokeWidth={1.2}
              strokeDasharray="5,4"
            />
          </Svg>
        </View>
        <DieCutNotch side="right" size={18} strokeColor={Colors.border} bgColor={Colors.canvas} />
      </View>

      {/* Bottom Metadata Strip */}
      <View style={styles.bottom}>
        <Text style={styles.metaText}>{item.timestamp}</Text>
        <Text style={styles.metaText}>{item.counter}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardPressed: {
    borderColor: 'rgba(18, 20, 23, 0.25)',
    opacity: 0.96,
  },
  upper: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  deptBadge: {
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: Radii.pill,
  },
  deptBadgeText: {
    fontFamily: Fonts.displayExtraBold,
    fontSize: 9.5,
    letterSpacing: 0.7,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: Radii.pill,
  },
  statusBadgeText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
    marginTop: 10,
  },
  ticketNumber: {
    fontFamily: Fonts.displayExtraBold,
    fontSize: 22,
    lineHeight: 24,
    letterSpacing: -0.6,
    color: Colors.ink,
  },
  serviceName: {
    flex: 1,
    fontFamily: Fonts.bodyBold,
    fontSize: 13.5,
    color: Colors.ink,
  },
  seam: {
    position: 'relative',
    height: 18,
    justifyContent: 'center',
  },
  dashedWrap: {
    marginHorizontal: 14,
  },
  bottom: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaText: {
    fontFamily: Fonts.monoMedium,
    fontSize: 10.5,
    color: Colors.inkSoft,
    fontVariant: ['tabular-nums'],
  },
});
