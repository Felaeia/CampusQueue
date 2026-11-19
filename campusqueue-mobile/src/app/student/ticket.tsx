import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Line } from 'react-native-svg';

import { DieCutNotch } from '../../components/DieCutNotch';
import { TactileQRCode } from '../../components/TactileQRCode';
import { TicketBarcode } from '../../components/TicketBarcode';
import { LiveQueueTrack } from '../../components/ticket/LiveQueueTrack';
import { useQueue } from '../../context/QueueContext';
import { Colors, Fonts, getOfficeAccent, Radii, Shadows } from '../../theme/tokens';

export default function ActiveTicketScreen() {
  const router = useRouter();
  const {
    studentProfile,
    activeTickets,
    currentHeroTicket,
    barcodePattern,
    setSelectedTicketId,
    triggerHaptic,
  } = useQueue();

  const [, setShowFullQRModal] = useState(false);
  const [, setShowCancelModal] = useState(false);

  const ticket = currentHeroTicket;

  if (!ticket) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => router.replace('/student/home')}
              accessibilityLabel="Back to Home"
              style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            >
              <Feather name="chevron-left" size={18} color={Colors.ink} />
            </Pressable>
            <Text style={styles.headerTitle}>Live Queue Pass</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={[styles.emptyCard, Shadows.card]}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="ticket-outline" size={26} color="rgba(18, 20, 23, 0.55)" />
            </View>
            <Text style={styles.emptyTitle}>No Active Queue Tickets</Text>
            <Text style={styles.emptySubtitle}>
              You don&apos;t have an active queue pass right now. Select a campus office to request
              a new ticket.
            </Text>
            <Pressable
              onPress={() => {
                triggerHaptic('light');
                router.replace('/student/home');
              }}
              style={({ pressed }) => [styles.emptyCta, pressed && styles.pressed]}
            >
              <Text style={styles.emptyCtaText}>Browse Campus Offices</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

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
            <Text style={styles.statusPillText}>{isServing ? 'YOUR TURN' : 'ACTIVE'}</Text>
          </View>
        </View>

        {activeTickets.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.switcherRow}
          >
            {activeTickets.map((item) => {
              const selected = item.id === ticket.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    triggerHaptic('light');
                    setSelectedTicketId(item.id);
                  }}
                  style={[
                    styles.switcherPill,
                    selected ? styles.switcherPillActive : styles.switcherPillIdle,
                  ]}
                >
                  <Text
                    style={[
                      styles.switcherText,
                      selected ? styles.switcherTextActive : styles.switcherTextIdle,
                    ]}
                  >
                    {item.ticketNumber} • {item.shortOffice}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

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

          <View style={styles.perforationSeam}>
            <DieCutNotch side="left" size={22} strokeColor={Colors.border} bgColor={Colors.canvas} />
            <View style={styles.dashedWrap}>
              <Svg width="100%" height={2}>
                <Line
                  x1="0"
                  y1="1"
                  x2="100%"
                  y2="1"
                  stroke={Colors.dashedTicket}
                  strokeWidth={2}
                  strokeDasharray="6,5"
                />
              </Svg>
            </View>
            <DieCutNotch side="right" size={22} strokeColor={Colors.border} bgColor={Colors.canvas} />
          </View>

          <View style={styles.ticketBottom}>
            <View style={styles.qrSection}>
              <Pressable
                onPress={() => {
                  triggerHaptic('light');
                  setShowFullQRModal(true);
                }}
                accessibilityLabel="Enlarge QR code"
                style={({ pressed }) => [pressed && styles.qrPressed]}
              >
                <TactileQRCode value={ticket.serial} size={114} />
              </Pressable>

              <View style={styles.qrMetadata}>
                <View>
                  <Text style={styles.lightLabel}>PASS SERIAL</Text>
                  <Text style={styles.lightMonoValue}>{ticket.serial}</Text>
                </View>

                <View>
                  <Text style={styles.lightLabel}>ISSUED AT</Text>
                  <Text style={styles.lightMonoValue}>{ticket.issuedAt}</Text>
                </View>

                <View style={styles.shieldNoteRow}>
                  <Ionicons name="shield-checkmark-outline" size={14} color={Colors.registrar} />
                  <Text style={styles.shieldNoteText}>Present to counter staff upon call</Text>
                </View>
              </View>
            </View>

            <View style={styles.bottomDivider} />

            <View style={styles.barcodeRow}>
              <TicketBarcode serial={ticket.serial} bars={barcodePattern} />
              <Text style={styles.studentIdCaption}>STUDENT ID {studentProfile.studentId}</Text>
            </View>
          </View>
        </View>

        {/* Cancel Ticket Button */}
        <Pressable
          onPress={() => {
            triggerHaptic('warning');
            setShowCancelModal(true);
          }}
          style={({ pressed }) => [styles.cancelButton, pressed && styles.cancelButtonPressed]}
        >
          <Text style={styles.cancelButtonText}>Leave Queue / Cancel Ticket</Text>
        </Pressable>
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
  headerSpacer: {
    width: 36,
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
  switcherRow: {
    gap: 6,
  },
  switcherPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radii.pill,
  },
  switcherPillActive: {
    backgroundColor: Colors.ink,
  },
  switcherPillIdle: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  switcherText: {
    fontFamily: Fonts.monoBold,
    fontSize: 10.5,
    fontVariant: ['tabular-nums'],
  },
  switcherTextActive: {
    color: Colors.matcha,
  },
  switcherTextIdle: {
    color: 'rgba(18, 20, 23, 0.70)',
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
  perforationSeam: {
    position: 'relative',
    backgroundColor: Colors.surface,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.border,
    height: 22,
    justifyContent: 'center',
  },
  dashedWrap: {
    marginHorizontal: 16,
  },
  ticketBottom: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: Radii.modal,
    borderBottomRightRadius: Radii.modal,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  qrSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  qrPressed: {
    transform: [{ scale: 0.96 }],
  },
  qrMetadata: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  lightLabel: {
    fontFamily: Fonts.monoSemiBold,
    fontSize: 9.5,
    letterSpacing: 0.7,
    color: Colors.inkMuted,
    fontVariant: ['tabular-nums'],
  },
  lightMonoValue: {
    fontFamily: Fonts.monoBold,
    fontSize: 13,
    color: Colors.ink,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  shieldNoteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingTop: 2,
  },
  shieldNoteText: {
    flex: 1,
    fontFamily: Fonts.bodyMedium,
    fontSize: 10.5,
    lineHeight: 14,
    color: Colors.inkSoft,
  },
  bottomDivider: {
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    marginVertical: 12,
  },
  barcodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  studentIdCaption: {
    fontFamily: Fonts.monoSemiBold,
    fontSize: 10,
    color: Colors.inkMuted,
    fontVariant: ['tabular-nums'],
  },
  cancelButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: Radii.xl,
    backgroundColor: Colors.surface,
    borderWidth: 1.2,
    borderColor: Colors.dangerOutline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonPressed: {
    backgroundColor: Colors.dangerSoftBg,
  },
  cancelButtonText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12.5,
    color: Colors.danger,
  },
  emptyCard: {
    marginTop: 24,
    backgroundColor: Colors.surface,
    borderRadius: Radii.modal,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  emptyIconBox: {
    width: 48,
    height: 48,
    borderRadius: Radii.xl,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: Fonts.displayExtraBold,
    fontSize: 19,
    letterSpacing: -0.4,
    color: Colors.ink,
  },
  emptySubtitle: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.inkSoft,
    textAlign: 'center',
  },
  emptyCta: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: Radii.lg,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCtaText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    color: Colors.matcha,
  },
  pressed: {
    opacity: 0.85,
  },
});
