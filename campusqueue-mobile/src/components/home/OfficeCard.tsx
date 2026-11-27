import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { ActiveTicket, Office } from '../../types/queue';
import { Colors, Fonts, Radii, Shadows } from '../../theme/tokens';

interface OfficeCardProps {
  office: Office;
  activeTicket?: ActiveTicket;
  onPressCard: (office: Office) => void;
  onPressActiveTicket: (ticket: ActiveTicket) => void;
}

export function OfficeCard({
  office,
  activeTicket,
  onPressCard,
  onPressActiveTicket,
}: OfficeCardProps) {
  const hasActivePass = Boolean(activeTicket);
  const isClosed = office.acceptingTickets === false;
  const metaLabel =
    [office.windowLabel, office.officerName].filter(Boolean).join(' • ') ||
    office.description ||
    'Active Campus Counter';

  return (
    <Pressable
      onPress={() => onPressCard(office)}
      style={({ pressed }) => [
        styles.card,
        Shadows.card,
        hasActivePass ? styles.cardActiveBorder : styles.cardDefaultBorder,
        pressed && styles.cardPressed,
      ]}
    >
      {/* Top Row */}
      <View style={styles.topRow}>
        <View style={styles.officeIdentity}>
          <View style={[styles.iconBox, { backgroundColor: office.themeColor }]}>
            {office.id === 'registrar' ? (
              <Feather name="file-text" size={19} color={Colors.surface} />
            ) : office.id === 'accounting' ? (
              <MaterialCommunityIcons name="cash" size={22} color={Colors.surface} />
            ) : (
              <Feather name="box" size={19} color={Colors.surface} />
            )}
          </View>
          <View style={styles.titleCol}>
            <Text style={styles.officeName} numberOfLines={1}>
              {office.name}
            </Text>
            <Text style={styles.officeMeta} numberOfLines={1}>
              {metaLabel}
            </Text>
          </View>
        </View>

        <View style={[styles.crowdPill, { backgroundColor: office.crowdPillBg }]}>
          <Text style={[styles.crowdPillText, { color: office.crowdPillText }]}>
            {office.acceptingTickets === false ? 'Closed' : office.crowdBadge}
          </Text>
        </View>
      </View>

      <View style={styles.metricPanel}>
        <View style={styles.metricColLeft}>
          <Text style={styles.metricLabel}>NOW SERVING</Text>
          <Text style={styles.metricServingValue}>{office.nowServing || '—'}</Text>
        </View>
        <View style={styles.metricColRight}>
          <Text style={styles.metricLabel}>QUEUE LINE</Text>
          <Text style={styles.metricWaitingValue}>{office.waitingCount} waiting</Text>
        </View>
      </View>

      {/* Footer Row */}
      <View style={styles.footerRow}>
        <Text style={styles.servicesCount}>{office.services.length} services available</Text>

        {activeTicket ? (
          <Pressable
            onPress={() => onPressActiveTicket(activeTicket)}
            style={({ pressed }) => [styles.activeCta, pressed && styles.ctaPressed]}
          >
            <Ionicons name="qr-code-outline" size={14} color={Colors.matcha} />
            <Text style={styles.activeCtaText}>Active: {activeTicket.ticketNumber}</Text>
          </Pressable>
        ) : isClosed ? (
          <View style={[styles.requestCta, { backgroundColor: Colors.surfaceMuted }]}>
            <Feather name="lock" size={13} color={Colors.inkNeutral} />
            <Text style={[styles.requestCtaText, { color: Colors.inkNeutral }]}>
              Queue Closed
            </Text>
          </View>
        ) : (
          <Pressable
            onPress={() => onPressCard(office)}
            style={({ pressed }) => [
              styles.requestCta,
              { backgroundColor: office.themeColor },
              pressed && styles.ctaPressed,
            ]}
          >
            <Ionicons name="ticket-outline" size={14} color={Colors.surface} />
            <Text style={styles.requestCtaText}>Get Queue Ticket</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.officeCard,
    padding: 16,
    gap: 12,
  },
  cardDefaultBorder: {
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardActiveBorder: {
    borderWidth: 1.5,
    borderColor: Colors.registrarActiveBorder,
  },
  cardPressed: {
    opacity: 0.96,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  officeIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCol: {
    flex: 1,
    minWidth: 0,
  },
  officeName: {
    fontFamily: Fonts.displayExtraBold,
    fontSize: 15.5,
    lineHeight: 19,
    letterSpacing: -0.4,
    color: Colors.ink,
  },
  officeMeta: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 11,
    color: 'rgba(18, 20, 23, 0.55)',
    marginTop: 2,
  },
  crowdPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.pill,
  },
  crowdPillText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 10,
  },
  metricPanel: {
    borderRadius: Radii.lg,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
  },
  metricColLeft: {
    flex: 1,
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: 'rgba(18, 20, 23, 0.10)',
  },
  metricColRight: {
    flex: 1,
    paddingLeft: 14,
    justifyContent: 'center',
  },
  metricLabel: {
    fontFamily: Fonts.monoSemiBold,
    fontSize: 9.5,
    letterSpacing: 0.7,
    color: Colors.inkSoft,
    fontVariant: ['tabular-nums'],
  },
  metricServingValue: {
    fontFamily: Fonts.monoBold,
    fontSize: 18,
    lineHeight: 22,
    color: Colors.ink,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  metricWaitingValue: {
    fontFamily: Fonts.monoBold,
    fontSize: 15,
    lineHeight: 19,
    color: Colors.ink,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
    gap: 8,
  },
  servicesCount: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 11.5,
    color: Colors.inkSoft,
  },
  activeCta: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radii.md,
    backgroundColor: Colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeCtaText: {
    fontFamily: Fonts.monoBold,
    fontSize: 11,
    color: Colors.matcha,
    fontVariant: ['tabular-nums'],
  },
  requestCta: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  requestCtaText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 11.5,
    color: Colors.surface,
  },
  ctaPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
});
