import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { ActiveTicket } from '../../types/queue';
import { Colors, Fonts, Radii } from '../../theme/tokens';

interface LiveQueueTrackProps {
  ticket: ActiveTicket;
  isServing: boolean;
}

export function LiveQueueTrack({ ticket, isServing }: LiveQueueTrackProps) {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>LIVE QUEUE TRACK</Text>
        <Text style={styles.aheadText}>
          {isServing
            ? 'Now serving you!'
            : ticket.aheadCount === 0
              ? 'Next in line'
              : `${ticket.aheadCount} ${ticket.aheadCount === 1 ? 'student' : 'students'} ahead`}
        </Text>
      </View>

      <View style={styles.trackRow}>
        {/* Station 1: SERVING */}
        <View style={styles.stationCol}>
          <View style={styles.servingPill}>
            <Text style={styles.servingPillText}>{ticket.nowServing || '—'}</Text>
          </View>
          <Text style={styles.stationCaption}>SERVING</Text>
        </View>

        <View style={styles.middleTrack}>
          <View pointerEvents="none" style={styles.dashedLineWrap}>
            <Svg width="100%" height={2}>
              <Line
                x1="0"
                y1="1"
                x2="100%"
                y2="1"
                stroke="rgba(255, 255, 255, 0.25)"
                strokeWidth={1.2}
                strokeDasharray="4,4"
              />
            </Svg>
          </View>

          {isServing ? (
            <View style={styles.atCounterPill}>
              <Text style={styles.atCounterText}>AT COUNTER</Text>
            </View>
          ) : (
            ticket.trackNodes.map((node) => (
              <View key={node} style={styles.nodeCol}>
                <View style={styles.nodeCircle}>
                  <View style={styles.nodeDot} />
                </View>
                <Text style={styles.stationCaption}>{node}</Text>
              </View>
            ))
          )}
        </View>

        {/* Final Station: YOU */}
        <View style={styles.stationCol}>
          <View style={styles.youPill}>
            <Text style={styles.youPillText}>YOU • {ticket.ticketNumber}</Text>
          </View>
          <Text style={styles.youCaption}>{isServing ? 'CALLED' : 'IN LINE'}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 14,
    backgroundColor: Colors.darkRecessed,
    borderWidth: 1,
    borderColor: Colors.darkBorder,
    borderRadius: Radii.xl,
    padding: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  heading: {
    fontFamily: Fonts.monoSemiBold,
    fontSize: 10,
    letterSpacing: 0.7,
    color: Colors.inkMuted,
    fontVariant: ['tabular-nums'],
  },
  aheadText: {
    fontFamily: Fonts.monoBold,
    fontSize: 11,
    color: Colors.matcha,
    fontVariant: ['tabular-nums'],
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 4,
  },
  stationCol: {
    alignItems: 'center',
  },
  servingPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.sm,
    backgroundColor: Colors.darkNode,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  servingPillText: {
    fontFamily: Fonts.monoBold,
    fontSize: 10.5,
    color: Colors.surface,
    fontVariant: ['tabular-nums'],
  },
  stationCaption: {
    fontFamily: Fonts.monoSemiBold,
    fontSize: 8.5,
    color: Colors.inkMuted,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  middleTrack: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    position: 'relative',
    paddingHorizontal: 4,
  },
  dashedLineWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 13,
  },
  atCounterPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 3,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(184, 242, 58, 0.20)',
  },
  atCounterText: {
    fontFamily: Fonts.monoBold,
    fontSize: 9,
    color: Colors.matcha,
    fontVariant: ['tabular-nums'],
  },
  nodeCol: {
    alignItems: 'center',
    zIndex: 2,
  },
  nodeCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.darkNode,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
  },
  youPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.sm,
    backgroundColor: Colors.matcha,
  },
  youPillText: {
    fontFamily: Fonts.monoBold,
    fontSize: 10.5,
    color: Colors.ink,
    fontVariant: ['tabular-nums'],
  },
  youCaption: {
    fontFamily: Fonts.monoBold,
    fontSize: 8.5,
    color: Colors.matcha,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
});
