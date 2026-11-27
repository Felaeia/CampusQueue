import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DieCutNotch } from '../../components/DieCutNotch';
import { ActiveConflictModal } from '../../components/home/ActiveConflictModal';
import { NotificationDrawer } from '../../components/home/NotificationDrawer';
import { OfficeCard } from '../../components/home/OfficeCard';
import { RequestTicketSheet } from '../../components/home/RequestTicketSheet';
import { RadarPulseDot } from '../../components/RadarPulseDot';
import { useQueue, useQueueFocus } from '../../context/QueueContext';
import { ActiveTicket, Office } from '../../types/queue';
import { Colors, Fonts, Radii, Shadows } from '../../theme/tokens';
import { isTicketCalledOrServing } from '../../utils/waitTime';

export default function StudentHomeScreen() {
  useQueueFocus('student');
  const router = useRouter();
  const {
    isSyncingLive,
    hasLoadedLive,
    liveSyncError,
    refreshLiveQueue,
    studentProfile,
    offices,
    activeTickets,
    notifications,
    unreadNotificationsCount,
    setSelectedTicketId,
    markNotificationRead,
    markAllNotificationsRead,
    issueTicket,
    showToast,
    triggerHaptic,
  } = useQueue();

  const [requestSheetOffice, setRequestSheetOffice] = useState<Office | null>(null);
  const [conflictTicket, setConflictTicket] = useState<ActiveTicket | null>(null);
  const [showNotifDrawer, setShowNotifDrawer] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refreshLiveQueue(true, true);
    }, [refreshLiveQueue])
  );

  const primaryActive = activeTickets[0] ?? null;
  const primaryIsServing = isTicketCalledOrServing(primaryActive);
  const openOfficesCount = offices.filter((o) => o.acceptingTickets !== false).length;
  const isInitialLoading = !hasLoadedLive && offices.length === 0;

  const handleOpenTicket = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    triggerHaptic('light');
    router.replace('/student/ticket');
  };

  const handleRequestTicketTrigger = (office: Office) => {
    const existing = activeTickets.find((t) => t.officeId === office.id);
    if (existing) {
      triggerHaptic('warning');
      setConflictTicket(existing);
      return;
    }
    if (office.acceptingTickets === false) {
      triggerHaptic('warning');
      showToast(`${office.name} is currently not accepting new tickets.`, 'warning');
      return;
    }
    triggerHaptic('light');
    setRequestSheetOffice(office);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isSyncingLive}
            onRefresh={() => {
              void refreshLiveQueue();
            }}
            tintColor={Colors.ink}
          />
        }
      >
        {/* Top Header Row */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.metaRow}>
              <View style={styles.idPill}>
                <Text style={styles.idPillText}>ID: {studentProfile.studentId}</Text>
              </View>
              <Text style={styles.campusText} numberOfLines={1}>
                {studentProfile.campusShort}
              </Text>
            </View>
            <Text style={styles.greeting}>Good morning, {studentProfile.firstName}</Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              onPress={() => {
                triggerHaptic('light');
                setShowNotifDrawer(true);
              }}
              accessibilityLabel="Open Notifications"
              style={({ pressed }) => [styles.bellButton, pressed && styles.pressed]}
            >
              <Feather name="bell" size={17} color={Colors.ink} />
              {unreadNotificationsCount > 0 ? <View style={styles.unreadDot} /> : null}
            </Pressable>

            <Pressable
              onPress={() => {
                triggerHaptic('light');
                router.push('/student/profile');
              }}
              accessibilityLabel="Open Student Profile"
              style={({ pressed }) => [styles.avatarButton, pressed && styles.avatarPressed]}
            >
              <Text style={styles.avatarLetter}>{studentProfile.firstLetter}</Text>
            </Pressable>
          </View>
        </View>

        {/* Live Sync Error Banner */}
        {liveSyncError ? (
          <Pressable
            onPress={() => {
              triggerHaptic('light');
              void refreshLiveQueue();
            }}
            style={styles.syncErrorCard}
          >
            <Feather name="wifi-off" size={16} color={Colors.danger} />
            <View style={styles.syncErrorCopy}>
              <Text style={styles.syncErrorTitle}>{liveSyncError}</Text>
              <Text style={styles.syncErrorSub}>Tap to refresh live queue data</Text>
            </View>
          </Pressable>
        ) : null}

        {/* Live Active Ticket Hero Banner */}
        {primaryActive ? (
          <Pressable
            onPress={() => handleOpenTicket(primaryActive.id)}
            style={({ pressed }) => [
              styles.heroBanner,
              Shadows.heroDark,
              pressed && styles.heroBannerPressed,
            ]}
          >
            <DieCutNotch side="left" size={18} strokeColor={null} bgColor={Colors.canvas} />
            <DieCutNotch side="right" size={18} strokeColor={null} bgColor={Colors.canvas} />

            <View style={styles.heroBannerInner}>
              <View style={styles.heroLeft}>
                <View style={styles.liveTagRow}>
                  <RadarPulseDot color={Colors.matcha} size={10} />
                  <Text style={styles.liveTagText}>
                    {primaryIsServing ? 'YOUR TURN NOW' : 'LIVE ACTIVE TICKET'}
                  </Text>
                </View>

                <View style={styles.heroStatsRow}>
                  <Text style={styles.heroTicketNumber}>{primaryActive.ticketNumber}</Text>
                  <View style={styles.heroMetaCol}>
                    <Text style={styles.heroAheadText}>
                      {primaryIsServing
                        ? 'Proceed to counter!'
                        : primaryActive.aheadCount === 0
                          ? `Next in line • ~${primaryActive.estWaitMins}m`
                          : `${primaryActive.aheadCount} ${
                              primaryActive.aheadCount === 1 ? 'student' : 'students'
                            } ahead • ~${primaryActive.estWaitMins}m`}
                    </Text>
                    <Text style={styles.heroOfficeText}>
                      {primaryActive.shortOffice} • {primaryActive.counter}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.viewPassPill}>
                <Text style={styles.viewPassText}>View Pass</Text>
              </View>
            </View>
          </Pressable>
        ) : null}

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>CAMPUS OFFICES</Text>
          <Text style={styles.sectionCount}>{openOfficesCount} OPEN NOW</Text>
        </View>

        {/* Campus Office Cards */}
        <View style={styles.officesList}>
          {isInitialLoading ? (
            <View style={[styles.stateCard, Shadows.card]}>
              <ActivityIndicator size="small" color={Colors.ink} />
              <Text style={styles.stateCardTitle}>Loading campus offices...</Text>
              <Text style={styles.stateCardSub}>Syncing live queue counts and wait estimates.</Text>
            </View>
          ) : offices.length === 0 ? (
            <View style={[styles.stateCard, Shadows.card]}>
              <Feather name="layers" size={22} color={Colors.inkSoft} />
              <Text style={styles.stateCardTitle}>No Campus Offices Available</Text>
              <Text style={styles.stateCardSub}>
                Pull down to refresh or check back when campus offices open.
              </Text>
            </View>
          ) : (
            offices.map((office) => {
              const activeForOffice = activeTickets.find((t) => t.officeId === office.id);
              return (
                <OfficeCard
                  key={office.id}
                  office={office}
                  activeTicket={activeForOffice}
                  onPressCard={handleRequestTicketTrigger}
                  onPressActiveTicket={(ticket) => {
                    triggerHaptic('warning');
                    setConflictTicket(ticket);
                  }}
                />
              );
            })
          )}
        </View>
      </ScrollView>

      <RequestTicketSheet
        office={requestSheetOffice}
        onClose={() => setRequestSheetOffice(null)}
        onConfirm={async ({ serviceId, serviceName, notes, requestId }) => {
          if (!requestSheetOffice) return;
          const issued = await issueTicket({
            officeId: requestSheetOffice.id,
            serviceId,
            serviceName,
            notes,
            requestId,
          });
          if (issued) {
            setRequestSheetOffice(null);
            router.replace('/student/ticket');
          }
        }}
      />

      <ActiveConflictModal
        ticket={conflictTicket}
        onClose={() => setConflictTicket(null)}
        onViewTicket={(ticketId) => {
          setConflictTicket(null);
          handleOpenTicket(ticketId);
        }}
      />

      <NotificationDrawer
        visible={showNotifDrawer}
        notifications={notifications}
        onClose={() => setShowNotifDrawer(false)}
        onMarkAllRead={markAllNotificationsRead}
        onPressNotification={(item) => {
          markNotificationRead(item.id);
          setShowNotifDrawer(false);
          if (activeTickets[0]) {
            handleOpenTicket(activeTickets[0].id);
          }
        }}
      />
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
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerLeft: {
    flex: 1,
    minWidth: 0,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  idPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  idPillText: {
    fontFamily: Fonts.monoBold,
    fontSize: 11,
    color: Colors.ink,
    fontVariant: ['tabular-nums'],
  },
  campusText: {
    flexShrink: 1,
    fontFamily: Fonts.bodyMedium,
    fontSize: 11,
    color: 'rgba(18, 20, 23, 0.55)',
  },
  greeting: {
    fontFamily: Fonts.displayExtraBold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.7,
    color: Colors.ink,
    marginTop: 6,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 2,
  },
  bellButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: 6,
    right: 7,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.warning,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  avatarButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPressed: {
    transform: [{ scale: 0.95 }],
  },
  avatarLetter: {
    fontFamily: Fonts.displayExtraBold,
    fontSize: 15,
    color: Colors.matcha,
  },
  pressed: {
    opacity: 0.8,
  },
  heroBanner: {
    borderRadius: Radii.card,
    backgroundColor: Colors.ink,
    paddingHorizontal: 16,
    paddingVertical: 14,
    position: 'relative',
  },
  heroBannerPressed: {
    transform: [{ scale: 0.99 }],
  },
  heroBannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingLeft: 6,
    paddingRight: 4,
  },
  heroLeft: {
    flex: 1,
  },
  liveTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveTagText: {
    fontFamily: Fonts.monoBold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: Colors.matcha,
    fontVariant: ['tabular-nums'],
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  heroTicketNumber: {
    fontFamily: Fonts.displayExtraBold,
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: -0.9,
    color: Colors.surface,
  },
  heroMetaCol: {
    flexShrink: 1,
  },
  heroAheadText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    lineHeight: 15,
    color: Colors.surface,
  },
  heroOfficeText: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 11,
    lineHeight: 14,
    color: Colors.inkTabInactive,
    marginTop: 2,
  },
  viewPassPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radii.pill,
    backgroundColor: Colors.matcha,
  },
  viewPassText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    color: Colors.ink,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontFamily: Fonts.displayExtraBold,
    fontSize: 13,
    letterSpacing: 0.4,
    color: Colors.ink,
  },
  sectionCount: {
    fontFamily: Fonts.monoSemiBold,
    fontSize: 10.5,
    color: Colors.inkSoft,
    fontVariant: ['tabular-nums'],
  },
  officesList: {
    gap: 12,
  },
  syncErrorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.dangerSoftBg,
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
    borderRadius: Radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  syncErrorCopy: {
    flex: 1,
  },
  syncErrorTitle: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    color: Colors.danger,
  },
  syncErrorSub: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 11,
    color: Colors.inkSoft,
    marginTop: 1,
  },
  stateCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  stateCardTitle: {
    fontFamily: Fonts.displayBold,
    fontSize: 14,
    color: Colors.ink,
  },
  stateCardSub: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 12,
    color: Colors.inkSoft,
    textAlign: 'center',
  },
});
