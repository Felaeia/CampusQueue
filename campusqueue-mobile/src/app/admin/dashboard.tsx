import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CampusQueueBroadcastModal } from '../../components/admin/CampusQueueBroadcastModal';
import { OfficeCongestionDrilldownModal } from '../../components/admin/OfficeCongestionDrilldownModal';
import { RadarPulseDot } from '../../components/RadarPulseDot';
import { useAdmin } from '../../context/AdminContext';
import { useQueue } from '../../context/QueueContext';
import { Colors, Fonts, Radii, Shadows } from '../../theme/tokens';
import { AdminDateRange, AdminOfficeRecord } from '../../types/admin';

const DATE_RANGES: AdminDateRange[] = [
  'Today (Live)',
  'Yesterday',
  'Last 7 Days',
  'This Month',
];

/**
 * Screen 4.1: Admin Operations & Analytics Dashboard (/admin/dashboard)
 */
export default function AdminOverviewScreen() {
  const router = useRouter();
  const {
    activeAdmin,
    offices,
    getKpiSnapshot,
    sendBroadcast,
    broadcasts,
    logoutAdmin,
    isLoadingLive,
    liveError,
    refreshAdminData,
  } = useAdmin();
  const { bumpLoginReset, triggerHaptic } = useQueue();

  const [selectedRange, setSelectedRange] = useState<AdminDateRange>('Today (Live)');
  const [showRangeMenu, setShowRangeMenu] = useState(false);
  const [drilldownOffice, setDrilldownOffice] = useState<AdminOfficeRecord | null>(null);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refreshAdminData(selectedRange, true);
    }, [refreshAdminData, selectedRange])
  );

  const isLoading = isLoadingLive;
  const hasError = Boolean(liveError);

  const kpi = useMemo(() => getKpiSnapshot(selectedRange), [getKpiSnapshot, selectedRange]);

  const maxPeakCount = useMemo(
    () => Math.max(1, ...kpi.peakHours.map((b) => b.count)),
    [kpi.peakHours]
  );

  const handleSelectRange = (range: AdminDateRange) => {
    setShowRangeMenu(false);
    if (range === selectedRange) return;
    triggerHaptic('light');
    setSelectedRange(range);
    void refreshAdminData(range);
  };

  const handleRetrySync = () => {
    triggerHaptic('light');
    void refreshAdminData(selectedRange);
  };

  const handleSignOut = () => {
    triggerHaptic('light');
    logoutAdmin();
    bumpLoginReset();
    router.replace('/auth/login');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="dark" />

      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.rolePill}>
            <RadarPulseDot color={Colors.matcha} size={7} />
            <Text style={styles.rolePillText}>ADMIN COMMAND</Text>
          </View>
          <Text style={styles.headerTitle}>Campus Operations</Text>
          <Text style={styles.headerSub}>
            {activeAdmin.fullName} • {activeAdmin.adminId}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => {
              triggerHaptic('light');
              setShowBroadcastModal(true);
            }}
            style={({ pressed }) => [styles.broadcastIconBtn, pressed && styles.pressed]}
            accessibilityLabel="Broadcast Campus Alert"
          >
            <Feather name="radio" size={16} color={Colors.ink} />
          </Pressable>
          <Pressable
            onPress={handleSignOut}
            style={({ pressed }) => [styles.signOutBtn, pressed && styles.pressed]}
            accessibilityLabel="Sign Out"
          >
            <Feather name="log-out" size={16} color={Colors.inkSoft} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoadingLive}
            onRefresh={() => {
              void refreshAdminData(selectedRange);
            }}
            tintColor={Colors.ink}
          />
        }
      >
        {/* Date Range Selector & Broadcast CTA */}
        <View style={styles.controlsRow}>
          <View style={styles.dropdownWrap}>
            <Pressable
              onPress={() => setShowRangeMenu((prev) => !prev)}
              style={({ pressed }) => [styles.rangePill, pressed && styles.pressed]}
            >
              <Feather name="calendar" size={13} color={Colors.ink} />
              <Text style={styles.rangePillText}>{selectedRange}</Text>
              <Feather
                name={showRangeMenu ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={Colors.inkSoft}
              />
            </Pressable>

            {showRangeMenu ? (
              <View style={[styles.dropdownMenu, Shadows.cardElevated]}>
                {DATE_RANGES.map((range) => {
                  const active = range === selectedRange;
                  return (
                    <Pressable
                      key={range}
                      onPress={() => handleSelectRange(range)}
                      style={[styles.dropdownItem, active && styles.dropdownItemActive]}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          active && styles.dropdownItemTextActive,
                        ]}
                      >
                        {range}
                      </Text>
                      {active ? <Feather name="check" size={14} color={Colors.ink} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>

          <Pressable
            onPress={() => {
              triggerHaptic('light');
              setShowBroadcastModal(true);
            }}
            style={({ pressed }) => [styles.broadcastCta, pressed && styles.pressed]}
          >
            <Feather name="radio" size={14} color={Colors.ink} />
            <Text style={styles.broadcastCtaText}>Broadcast Alert</Text>
          </Pressable>
        </View>

        {/* Error State */}
        {hasError ? (
          <Pressable onPress={handleRetrySync} style={[styles.errorCard, Shadows.card]}>
            <Feather name="alert-triangle" size={18} color={Colors.danger} />
            <View style={styles.flex}>
              <Text style={styles.errorCardTitle}>Unable to sync campus telemetry.</Text>
              <Text style={styles.errorCardSub}>Tap to retry.</Text>
            </View>
          </Pressable>
        ) : null}

        {/* Loading Skeleton State */}
        {isLoading ? (
          <View style={styles.skeletonWrap}>
            <View style={styles.bentoGrid}>
              {[0, 1, 2, 3].map((idx) => (
                <View key={idx} style={styles.skeletonKpi} />
              ))}
            </View>
            <View style={styles.skeletonChart} />
          </View>
        ) : (
          <>
            {/* Empty Day Notice Banner (keeps KPIs & Live Office Monitor visible) */}
            {kpi.totalIssued === 0 ? (
              <View style={[styles.emptyStateCard, Shadows.card]}>
                <View style={styles.emptyIconCircle}>
                  <Feather name="sunrise" size={20} color={Colors.inkSoft} />
                </View>
                <Text style={styles.emptyTitle}>0 Tickets Issued Today</Text>
                <Text style={styles.emptySub}>
                  Campus offices scheduled to open at 8:00 AM • Switch date range to view historical
                  activity.
                </Text>
              </View>
            ) : null}

            {/* Bento KPI Summary Grid */}
            <View style={styles.bentoGrid}>
              <View style={[styles.kpiCard, styles.kpiCardDark, Shadows.heroDark]}>
                <Text style={styles.kpiLabelDark}>TOTAL TICKETS ISSUED</Text>
                <Text style={styles.kpiValueMatcha}>{kpi.totalIssued.toLocaleString()}</Text>
                <Text style={styles.kpiHintDark}>{kpi.issuedDeltaLabel}</Text>
              </View>

              <View style={[styles.kpiCard, Shadows.card]}>
                <Text style={styles.kpiLabel}>COMPLETED</Text>
                <Text style={styles.kpiValue}>{kpi.completedCount.toLocaleString()}</Text>
                <Text style={styles.kpiHintGreen}>{kpi.completionRate}% completion rate</Text>
              </View>

              <View style={[styles.kpiCard, Shadows.card]}>
                <Text style={styles.kpiLabel}>ACTIVE WAITING</Text>
                <Text style={styles.kpiValue}>{kpi.activeWaiting}</Text>
                <Text style={styles.kpiHint}>Live sum across open offices</Text>
              </View>

              <View style={[styles.kpiCard, Shadows.card]}>
                <Text style={styles.kpiLabel}>SKIPPED / NO-SHOW</Text>
                <Text style={[styles.kpiValue, { color: Colors.warningDark }]}>
                  {kpi.skippedRate}%
                </Text>
                <Text style={styles.kpiHint}>{kpi.skippedCount} tickets</Text>
              </View>
            </View>

            {/* Live Office Load Monitor */}
            <View style={[styles.sectionCard, Shadows.card]}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Live Office Load Monitor</Text>
                  <Text style={styles.sectionSubtitle}>
                    Tap any office to inspect active windows & service breakdown
                  </Text>
                </View>
              </View>

              <View style={styles.officeList}>
                {offices.map((office) => {
                  const onlineCounters = office.windows.filter(
                    (w) => w.status === 'Online'
                  ).length;
                  const loadPercent = Math.min(
                    100,
                    Math.round(
                      (office.activeWaitingCount / Math.max(1, office.dailyCapacityLimit ? 25 : 20)) *
                        100
                    )
                  );
                  const isOpen = office.status === 'open';
                  const isHighLoad = office.activeWaitingCount >= 12;

                  return (
                    <Pressable
                      key={office.id}
                      onPress={() => {
                        triggerHaptic('light');
                        setDrilldownOffice(office);
                      }}
                      style={({ pressed }) => [
                        styles.officeRowCard,
                        pressed && styles.officeRowPressed,
                      ]}
                    >
                      <View style={styles.officeTopRow}>
                        <View style={styles.officeNameRow}>
                          <View
                            style={[styles.officeDot, { backgroundColor: office.themeColor }]}
                          />
                          <Text style={styles.officeName}>{office.name}</Text>
                        </View>
                        <View
                          style={[
                            styles.opBadge,
                            {
                              backgroundColor: !isOpen
                                ? Colors.surfaceMuted
                                : isHighLoad
                                  ? Colors.warningSoftBg
                                  : Colors.matchaSoftBg,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.opBadgeText,
                              {
                                color: !isOpen
                                  ? Colors.inkNeutral
                                  : isHighLoad
                                    ? Colors.warningDark
                                    : Colors.successText,
                              },
                            ]}
                          >
                            {!isOpen ? 'CLOSED' : isHighLoad ? 'BUSY' : 'NORMAL'}
                          </Text>
                        </View>
                      </View>

                      {/* Horizontal Progress Bar */}
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${isOpen ? Math.max(8, loadPercent) : 0}%`,
                              backgroundColor: isHighLoad ? Colors.warning : office.themeColor,
                            },
                          ]}
                        />
                      </View>

                      <View style={styles.officeMetaRow}>
                        <Text style={styles.officeMetaText}>
                          {onlineCounters}/{office.windowCount} counters online
                        </Text>
                        <Text style={styles.officeMetaText}>
                          {office.activeWaitingCount} waiting • ~{office.avgWaitMinutes}m avg
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Issuance Activity Chart (by date from live analytics) */}
            <View style={[styles.sectionCard, Shadows.card]}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Daily Issuance Activity</Text>
                  <Text style={styles.sectionSubtitle}>
                    Live ticket volume grouped by date
                  </Text>
                </View>
              </View>

              {kpi.peakHours.length === 0 ? (
                <Text style={styles.sectionSubtitle}>
                  No ticket issuance activity recorded for this date range.
                </Text>
              ) : (
                <View style={styles.chartWrap}>
                  {kpi.peakHours.map((bucket) => {
                    const heightPct = Math.max(8, Math.round((bucket.count / maxPeakCount) * 100));
                    const isPeak = bucket.count === maxPeakCount;
                    return (
                      <View key={bucket.hourLabel} style={styles.barColumn}>
                        <Text style={styles.barCount}>{bucket.count}</Text>
                        <View style={styles.barTrack}>
                          <View
                            style={[
                              styles.barFill,
                              {
                                height: `${heightPct}%`,
                                backgroundColor: isPeak ? Colors.ink : Colors.registrar,
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.barLabel}>{bucket.hourLabel}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Recent Campus Broadcasts */}
            {broadcasts.length > 0 ? (
              <View style={[styles.sectionCard, Shadows.card]}>
                <Text style={styles.sectionTitle}>Recent Campus Broadcasts</Text>
                {broadcasts.slice(0, 3).map((b) => (
                  <View key={b.id} style={styles.broadcastItem}>
                    <View style={styles.broadcastItemTop}>
                      <Text style={styles.broadcastTitle}>{b.title}</Text>
                      <Text style={styles.broadcastTime}>{b.sentAt}</Text>
                    </View>
                    <Text style={styles.broadcastMsg}>{b.message}</Text>
                    <Text style={styles.broadcastMeta}>
                      Sent to {b.recipientCount} • {b.officeName ?? b.targetAudience}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* Modal 4.1A: OfficeCongestionDrilldownModal */}
      <OfficeCongestionDrilldownModal
        office={drilldownOffice}
        onClose={() => setDrilldownOffice(null)}
        onManageOffice={(officeId) => {
          setDrilldownOffice(null);
          router.replace({ pathname: '/admin/offices', params: { focusOfficeId: officeId } });
        }}
      />

      {/* Modal 4.1B: CampusQueueBroadcastModal */}
      <CampusQueueBroadcastModal
        visible={showBroadcastModal}
        offices={offices}
        onClose={() => setShowBroadcastModal(false)}
        onSend={sendBroadcast}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerLeft: {
    flex: 1,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: Colors.ink,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.pill,
    marginBottom: 6,
  },
  rolePillText: {
    fontFamily: Fonts.monoBold,
    fontSize: 9.5,
    letterSpacing: 0.7,
    color: Colors.matcha,
  },
  headerTitle: {
    fontFamily: Fonts.displayExtraBold,
    fontSize: 22,
    color: Colors.ink,
    letterSpacing: -0.5,
  },
  headerSub: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    color: Colors.inkSoft,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  broadcastIconBtn: {
    width: 38,
    height: 38,
    borderRadius: Radii.pill,
    backgroundColor: Colors.matcha,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutBtn: {
    width: 38,
    height: 38,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.82,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 112,
    gap: 16,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    zIndex: 20,
  },
  dropdownWrap: {
    position: 'relative',
    zIndex: 25,
  },
  rangePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  rangePillText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12.5,
    color: Colors.ink,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 42,
    left: 0,
    minWidth: 180,
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 6,
    zIndex: 30,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: Radii.sm,
  },
  dropdownItemActive: {
    backgroundColor: Colors.surfaceSubtle,
  },
  dropdownItemText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12.5,
    color: Colors.inkSoft,
  },
  dropdownItemTextActive: {
    fontFamily: Fonts.bodyBold,
    color: Colors.ink,
  },
  broadcastCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.matcha,
    borderRadius: Radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  broadcastCtaText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12.5,
    color: Colors.ink,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.dangerSoftBg,
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
    borderRadius: Radii.lg,
    padding: 14,
  },
  errorCardTitle: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    color: Colors.danger,
  },
  errorCardSub: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    color: Colors.inkSoft,
  },
  skeletonWrap: {
    gap: 14,
  },
  skeletonKpi: {
    width: '48%',
    height: 108,
    borderRadius: Radii.card,
    backgroundColor: Colors.borderSubtle,
  },
  skeletonChart: {
    height: 190,
    borderRadius: Radii.card,
    backgroundColor: Colors.borderSubtle,
  },
  emptyStateCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: Fonts.displayBold,
    fontSize: 16,
    color: Colors.ink,
  },
  emptySub: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12.5,
    color: Colors.inkSoft,
    textAlign: 'center',
  },
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  kpiCard: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 15,
    gap: 4,
  },
  kpiCardDark: {
    backgroundColor: Colors.ink,
    borderColor: Colors.darkBorder,
  },
  kpiLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 0.6,
    color: Colors.inkMuted,
  },
  kpiLabelDark: {
    fontFamily: Fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 0.6,
    color: Colors.inkTabInactive,
  },
  kpiValue: {
    fontFamily: Fonts.monoBold,
    fontSize: 26,
    color: Colors.ink,
    fontVariant: ['tabular-nums'],
  },
  kpiValueMatcha: {
    fontFamily: Fonts.monoBold,
    fontSize: 26,
    color: Colors.matcha,
    fontVariant: ['tabular-nums'],
  },
  kpiHint: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 11.5,
    color: Colors.inkSoft,
  },
  kpiHintGreen: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 11.5,
    color: Colors.successText,
  },
  kpiHintDark: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 11.5,
    color: Colors.surfaceMuted,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: Fonts.displayBold,
    fontSize: 15.5,
    color: Colors.ink,
  },
  sectionSubtitle: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 11.5,
    color: Colors.inkSoft,
    marginTop: 2,
  },
  officeList: {
    gap: 10,
  },
  officeRowCard: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 12,
    gap: 8,
  },
  officeRowPressed: {
    backgroundColor: Colors.surfaceMuted,
  },
  officeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  officeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  officeDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  officeName: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13.5,
    color: Colors.ink,
  },
  opBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.pill,
  },
  opBadgeText: {
    fontFamily: Fonts.monoBold,
    fontSize: 10,
  },
  progressTrack: {
    height: 7,
    borderRadius: Radii.pill,
    backgroundColor: Colors.borderSubtle,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radii.pill,
  },
  officeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  officeMetaText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 11.5,
    color: Colors.inkSoft,
  },
  chartWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 146,
    paddingTop: 12,
    gap: 4,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
    gap: 5,
  },
  barCount: {
    fontFamily: Fonts.monoMedium,
    fontSize: 9.5,
    color: Colors.inkSoft,
  },
  barTrack: {
    width: '68%',
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 6,
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 6,
  },
  barLabel: {
    fontFamily: Fonts.monoMedium,
    fontSize: 9.5,
    color: Colors.inkMuted,
  },
  broadcastItem: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 12,
    gap: 4,
  },
  broadcastItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  broadcastTitle: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    color: Colors.ink,
  },
  broadcastTime: {
    fontFamily: Fonts.monoMedium,
    fontSize: 11,
    color: Colors.inkMuted,
  },
  broadcastMsg: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 12.5,
    color: Colors.inkSoft,
  },
  broadcastMeta: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 11,
    color: Colors.registrar,
    marginTop: 2,
  },
});
