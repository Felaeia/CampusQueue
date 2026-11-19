import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiveQueueTrack } from '../../components/ticket/LiveQueueTrack';
import { useQueue } from '../../context/QueueContext';
import { Colors, Fonts, getOfficeAccent, Radii, Shadows } from '../../theme/tokens';

export default function ActiveTicketScreen() {
  const router = useRouter();
  const { currentHeroTicket } = useQueue();

  const ticket = currentHeroTicket;
  if (!ticket) return null;

  const isServing = ticket.aheadCount === 0 || ticket.status === 'serving';
  const officePillColor = getOfficeAccent(ticket.officeId);

  const ordinalText =
    ticket.aheadCount === 1
      ? 'next'
      : ticket.aheadCount === 2
        ? '2nd'
        : ticket.aheadCount === 3
          ? '3rd'
          : `${ticket.aheadCount}th`;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header */}
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.replace('/student/home')}
            accessibilityLabel="Back to Home"
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <Feather name="chevron-left" size={18} color={Colors.ink} />
          </Pressable>

          <Text style={styles.headerTitle}>Live Queue Pass</Text>

          <View style={[styles.statusPill, isServing && styles.statusPillServing]}>
            <Text style={[styles.statusPillText, isServing && styles.statusPillTextServing]}>
              {isServing ? 'YOUR TURN' : 'ACTIVE'}
            </Text>
          </View>
        </View>

        {/* Approaching Turn Alert Banner */}
        <View style={styles.alertBanner}>
          <View style={styles.alertIconCircle}>
            <Text style={styles.alertIconMark}>!</Text>
          </View>
          <Text style={styles.alertText}>
            {isServing
              ? `It's Your Turn! Please proceed to ${ticket.counter} now.`
              : `Heads up! You are ${ordinalText} in line. Please head to the ${ticket.shortOffice} lobby now.`}
          </Text>
        </View>

        {/* Hero Perforated Ticket Card */}
        <View style={[styles.ticketWrap, Shadows.heroDark]}>
          <View style={styles.ticketTop}>
            <View style={styles.ticketTopHeader}>
              <View style={[styles.officeBadge, { backgroundColor: officePillColor }]}>
                <Text style={styles.officeBadgeText}>{ticket.shortOffice.toUpperCase()}</Text>
              </View>
              <Text style={styles.counterText}>{ticket.counter}</Text>
            </View>

            <View style={styles.numbersRow}>
              <View>
                <Text style={styles.darkLabel}>QUEUE NUMBER</Text>
                <Text style={styles.queueNumber}>{ticket.ticketNumber}</Text>
              </View>

              <View style={styles.rightAlign}>
                <Text style={styles.darkLabel}>EST. WAIT TIME</Text>
                <Text style={styles.waitValue}>
                  {isServing ? 'NOW' : `~${ticket.estWaitMins}mins`}
                </Text>
              </View>
            </View>

            <View style={styles.darkDivider} />

            <View style={styles.detailsRow}>
              <View style={styles.detailColLeft}>
                <Text style={styles.darkLabel}>SERVICE TRANSACTION</Text>
                <Text style={styles.detailValue}>{ticket.service}</Text>
              </View>

              <View style={styles.rightAlign}>
                <Text style={styles.darkLabel}>HOLDER</Text>
                <Text style={styles.detailValue}>{ticket.holderShort}</Text>
              </View>
            </View>

            <LiveQueueTrack ticket={ticket} isServing={isServing} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 118,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.displayExtraBold,
    fontSize: 17,
    letterSpacing: -0.4,
    color: Colors.ink,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusPillServing: {
    backgroundColor: Colors.matcha,
    borderColor: Colors.ink,
  },
  statusPillText: {
    fontFamily: Fonts.monoBold,
    fontSize: 10.5,
    color: Colors.ink,
    fontVariant: ['tabular-nums'],
  },
  statusPillTextServing: {
    color: Colors.ink,
  },
  alertBanner: {
    borderRadius: Radii.xl,
    backgroundColor: Colors.matcha,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  alertIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertIconMark: {
    fontFamily: Fonts.displayExtraBold,
    fontSize: 13,
    color: Colors.matcha,
  },
  alertText: {
    flex: 1,
    fontFamily: Fonts.bodyBold,
    fontSize: 11.5,
    lineHeight: 16,
    color: Colors.ink,
  },
  ticketWrap: {
    borderRadius: Radii.modal,
  },
  ticketTop: {
    backgroundColor: Colors.ink,
    borderTopLeftRadius: Radii.modal,
    borderTopRightRadius: Radii.modal,
    padding: 18,
    paddingBottom: 16,
  },
  ticketTopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  officeBadge: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: Radii.pill,
  },
  officeBadgeText: {
    fontFamily: Fonts.displayExtraBold,
    fontSize: 10.5,
    letterSpacing: 0.7,
    color: Colors.surface,
  },
  counterText: {
    fontFamily: Fonts.monoSemiBold,
    fontSize: 11.5,
    color: Colors.inkTabInactive,
    fontVariant: ['tabular-nums'],
  },
  numbersRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  darkLabel: {
    fontFamily: Fonts.monoSemiBold,
    fontSize: 10,
    letterSpacing: 0.7,
    color: Colors.inkMuted,
    fontVariant: ['tabular-nums'],
  },
  queueNumber: {
    fontFamily: Fonts.displayExtraBold,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -1.4,
    color: Colors.surface,
    marginTop: 4,
  },
  rightAlign: {
    alignItems: 'flex-end',
  },
  waitValue: {
    fontFamily: Fonts.monoBold,
    fontSize: 24,
    lineHeight: 28,
    color: Colors.matcha,
    marginTop: 6,
    fontVariant: ['tabular-nums'],
  },
  darkDivider: {
    marginVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.darkDivider,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  detailColLeft: {
    flex: 1,
  },
  detailValue: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13.5,
    color: Colors.surface,
    marginTop: 3,
  },
  pressed: {
    opacity: 0.8,
  },
});
