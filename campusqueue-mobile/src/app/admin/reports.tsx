import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdminRecordDetailModal } from '../../components/admin/AdminRecordDetailModal';
import { ExportSystemReportModal } from '../../components/admin/ExportSystemReportModal';
import { useAdmin } from '../../context/AdminContext';
import { useQueue } from '../../context/QueueContext';
import { Colors, Fonts, Radii, Shadows, getTicketStatusBadgeStyle } from '../../theme/tokens';
import { AdminAuditRecord, AuditOutcome } from '../../types/admin';
import { manilaDateString } from '../../utils/waitTime';

const OUTCOME_FILTERS: ('All Outcomes' | AuditOutcome)[] = [
  'All Outcomes',
  'Completed',
  'Skipped',
  'Cancelled',
];

const PAGE_SIZE = 25;

function formatAvgDuration(totalSeconds: number, count: number): string {
  if (!count) return '00m 00s';
  const avg = Math.round(totalSeconds / count);
  const mins = String(Math.floor(avg / 60)).padStart(2, '0');
  const secs = String(avg % 60).padStart(2, '0');
  return `${mins}m ${secs}s`;
}

/**
 * Screen 4.4: System Audit Trail & Daily Transaction Records (/admin/reports)
 */
export default function AdminReportsScreen() {
  const {
    offices,
    auditRecords,
    isLoadingLive,
    fetchLiveAuditLogs,
    downloadAnalyticsReport,
  } = useAdmin();
  const { showToast, triggerHaptic } = useQueue();

  const todayManila = useMemo(() => manilaDateString(0), []);
  const [startDate, setStartDate] = useState(todayManila);
  const [endDate, setEndDate] = useState(todayManila);
  const [officeFilter, setOfficeFilter] = useState('all');
  const [outcomeFilter, setOutcomeFilter] = useState<'All Outcomes' | AuditOutcome>('All Outcomes');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const [selectedRecord, setSelectedRecord] = useState<AdminAuditRecord | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  const officeFilters = useMemo(
    () => [
      { id: 'all', label: 'All Offices' },
      ...offices.map((o) => ({ id: o.id, label: o.name })),
    ],
    [offices]
  );

  const dateRangeInvalid = Boolean(startDate && endDate && startDate > endDate);

  useEffect(() => {
    if (dateRangeInvalid) return;
    void fetchLiveAuditLogs(startDate, endDate, officeFilter);
  }, [dateRangeInvalid, endDate, fetchLiveAuditLogs, officeFilter, startDate]);

  const filteredRecords = useMemo(() => {
    if (dateRangeInvalid) return [];
    const q = searchQuery.trim().toLowerCase();
    return auditRecords.filter((rec) => {
      if (startDate && rec.dateKey < startDate) return false;
      if (endDate && rec.dateKey > endDate) return false;
      if (officeFilter !== 'all' && rec.officeId !== officeFilter) return false;
      if (outcomeFilter !== 'All Outcomes' && rec.outcome !== outcomeFilter) return false;
      if (!q) return true;
      return (
        rec.ticketCode.toLowerCase().includes(q) ||
        rec.studentUsn.toLowerCase().includes(q) ||
        rec.handledByStaffId.toLowerCase().includes(q) ||
        rec.studentName.toLowerCase().includes(q)
      );
    });
  }, [auditRecords, dateRangeInvalid, endDate, officeFilter, outcomeFilter, searchQuery, startDate]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const paginatedRecords = useMemo(
    () => filteredRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredRecords, page]
  );

  const aggregates = useMemo(() => {
    const waitSum = filteredRecords.reduce((acc, r) => acc + r.waitDurationSeconds, 0);
    const completed = filteredRecords.filter((r) => r.serviceDurationSeconds > 0);
    const serviceSum = completed.reduce((acc, r) => acc + r.serviceDurationSeconds, 0);
    return {
      count: filteredRecords.length,
      avgWait: formatAvgDuration(waitSum, filteredRecords.length),
      avgService: formatAvgDuration(serviceSum, completed.length),
    };
  }, [filteredRecords]);

  const activeOfficeLabel =
    officeFilters.find((o) => o.id === officeFilter)?.label ?? 'All Offices';
  const filterSummary = `${startDate} to ${endDate} • ${activeOfficeLabel} • ${outcomeFilter}`;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={styles.headerTitle}>Audit Reports</Text>
          <Text style={styles.headerSub}>Historical transactions & SLA evaluation</Text>
        </View>
        <Pressable
          onPress={() => {
            triggerHaptic('light');
            setShowExportModal(true);
          }}
          style={({ pressed }) => [styles.exportBtn, pressed && styles.pressed]}
        >
          <Feather name="download" size={14} color={Colors.ink} />
          <Text style={styles.exportBtnText}>Export</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isLoadingLive}
            onRefresh={() => {
              void fetchLiveAuditLogs(startDate, endDate, officeFilter);
            }}
            tintColor={Colors.ink}
          />
        }
      >
        {/* Filtered Aggregate Strip */}
        <View style={[styles.aggregateStrip, Shadows.heroDark]}>
          <View style={styles.aggItem}>
            <Text style={styles.aggLabel}>MATCHING</Text>
            <Text style={styles.aggValueMatcha}>{aggregates.count}</Text>
          </View>
          <View style={styles.aggDivider} />
          <View style={styles.aggItem}>
            <Text style={styles.aggLabel}>AVG WAIT</Text>
            <Text style={styles.aggValue}>{aggregates.avgWait}</Text>
          </View>
          <View style={styles.aggDivider} />
          <View style={styles.aggItem}>
            <Text style={styles.aggLabel}>AVG SERVICE</Text>
            <Text style={styles.aggValue}>{aggregates.avgService}</Text>
          </View>
        </View>

        {/* Date Range Inputs + Quick Presets */}
        <View style={[styles.filterCard, Shadows.card]}>
          <View style={styles.dateRow}>
            <View style={styles.flex}>
              <Text style={styles.dateLabel}>Start Date</Text>
              <TextInput
                value={startDate}
                onChangeText={(t) => {
                  setStartDate(t);
                  setPage(1);
                }}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.inkMuted}
                style={styles.dateInput}
              />
            </View>
            <View style={styles.flex}>
              <Text style={styles.dateLabel}>End Date</Text>
              <TextInput
                value={endDate}
                onChangeText={(t) => {
                  setEndDate(t);
                  setPage(1);
                }}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.inkMuted}
                style={styles.dateInput}
              />
            </View>
          </View>

          <View style={styles.presetRow}>
            <Pressable
              onPress={() => {
                const today = manilaDateString(0);
                setStartDate(today);
                setEndDate(today);
                setPage(1);
              }}
              style={styles.presetChip}
            >
              <Text style={styles.presetText}>Today</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setStartDate(manilaDateString(-6));
                setEndDate(manilaDateString(0));
                setPage(1);
              }}
              style={styles.presetChip}
            >
              <Text style={styles.presetText}>Last 7 Days</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const today = manilaDateString(0);
                setStartDate(`${today.slice(0, 8)}01`);
                setEndDate(today);
                setPage(1);
              }}
              style={styles.presetChip}
            >
              <Text style={styles.presetText}>This Month</Text>
            </Pressable>
          </View>

          {/* Search Input */}
          <View style={styles.searchWrap}>
            <Feather name="search" size={14} color={Colors.inkMuted} />
            <TextInput
              value={searchQuery}
              onChangeText={(t) => {
                setSearchQuery(t);
                setPage(1);
              }}
              placeholder="Search Ticket #, Student USN, or Staff ID..."
              placeholderTextColor={Colors.inkMuted}
              style={styles.searchInput}
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <Feather name="x-circle" size={14} color={Colors.inkMuted} />
              </Pressable>
            ) : null}
          </View>

          {/* Office Filter Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillRow}
          >
            {officeFilters.map((opt) => {
              const active = officeFilter === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => {
                    setOfficeFilter(opt.id);
                    setPage(1);
                  }}
                  style={[styles.filterPill, active && styles.filterPillActive]}
                >
                  <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Outcome Filter Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillRow}
          >
            {OUTCOME_FILTERS.map((outcome) => {
              const active = outcomeFilter === outcome;
              return (
                <Pressable
                  key={outcome}
                  onPress={() => {
                    setOutcomeFilter(outcome);
                    setPage(1);
                  }}
                  style={[styles.filterPill, active && styles.filterPillActive]}
                >
                  <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                    {outcome}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Error State */}
        {dateRangeInvalid ? (
          <View style={styles.errorCard}>
            <Feather name="alert-circle" size={18} color={Colors.danger} />
            <Text style={styles.errorText}>
              Error querying transaction records. Please narrow your date range and retry.
            </Text>
          </View>
        ) : paginatedRecords.length === 0 ? (
          <View style={[styles.emptyCard, Shadows.card]}>
            <Feather name="file-text" size={24} color={Colors.inkMuted} />
            <Text style={styles.emptyText}>
              No transaction records found for the selected date range and filters.
            </Text>
          </View>
        ) : (
          <>
            {paginatedRecords.map((rec) => {
              const badge = getTicketStatusBadgeStyle(rec.outcome);
              return (
                <Pressable
                  key={rec.id}
                  onPress={() => {
                    triggerHaptic('light');
                    setSelectedRecord(rec);
                  }}
                  style={({ pressed }) => [
                    styles.recordCard,
                    Shadows.card,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.recordTopRow}>
                    <View style={styles.recordTitleGroup}>
                      <Text style={styles.ticketNum}>{rec.ticketCode}</Text>
                      <Text style={styles.recordDate}>{rec.dateTimeLabel}</Text>
                    </View>
                    <View style={[styles.outcomeBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.outcomeBadgeText, { color: badge.text }]}>
                        {rec.outcome}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.recordService}>
                    {rec.officeName} • {rec.serviceName}
                  </Text>

                  <View style={styles.recordMetaRow}>
                    <Text style={styles.recordMeta}>
                      USN: <Text style={styles.monoInline}>{rec.studentUsn}</Text>
                    </Text>
                    <Text style={styles.recordMeta}>
                      Wait: <Text style={styles.monoInline}>{rec.waitDurationLabel}</Text>
                    </Text>
                    <Text style={styles.recordMeta}>
                      By: <Text style={styles.monoInline}>{rec.handledByStaffId}</Text>
                    </Text>
                  </View>
                </Pressable>
              );
            })}

            {/* Pagination Footer */}
            {totalPages > 1 ? (
              <View style={styles.paginationRow}>
                <Pressable
                  disabled={page <= 1}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                  style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
                >
                  <Text style={styles.pageBtnText}>Previous</Text>
                </Pressable>
                <Text style={styles.pageInfo}>
                  Page {page} of {totalPages}
                </Text>
                <Pressable
                  disabled={page >= totalPages}
                  onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                  style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}
                >
                  <Text style={styles.pageBtnText}>Next</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* Modal 4.4A: AdminRecordDetailModal */}
      <AdminRecordDetailModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />

      {/* Modal 4.4B: ExportSystemReportModal */}
      <ExportSystemReportModal
        visible={showExportModal}
        records={filteredRecords}
        filterSummary={filterSummary}
        onClose={() => setShowExportModal(false)}
        onLiveDownload={(fmt) => downloadAnalyticsReport(startDate, endDate, fmt, officeFilter)}
        onExported={(count) => {
          triggerHaptic('success');
          showToast(`Master transaction report exported (${count} records).`, 'matcha');
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
  flex: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
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
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.matcha,
    borderRadius: Radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  exportBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12.5,
    color: Colors.ink,
  },
  pressed: { opacity: 0.84 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 112,
    gap: 12,
  },
  aggregateStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.ink,
    borderRadius: Radii.card,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  aggItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  aggDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.darkDivider,
  },
  aggLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 9.5,
    letterSpacing: 0.6,
    color: Colors.inkTabInactive,
  },
  aggValueMatcha: {
    fontFamily: Fonts.monoBold,
    fontSize: 18,
    color: Colors.matcha,
  },
  aggValue: {
    fontFamily: Fonts.monoBold,
    fontSize: 15,
    color: Colors.surface,
  },
  filterCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 10,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateLabel: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 11,
    color: Colors.inkSoft,
    marginBottom: 4,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    backgroundColor: Colors.surfaceSubtle,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: Fonts.monoSemiBold,
    fontSize: 12,
    color: Colors.ink,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  presetText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 11,
    color: Colors.ink,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.bodyMedium,
    fontSize: 12.5,
    color: Colors.ink,
    padding: 0,
  },
  pillRow: {
    gap: 7,
  },
  filterPill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSubtle,
  },
  filterPillActive: {
    backgroundColor: Colors.ink,
    borderColor: Colors.ink,
  },
  filterPillText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 11.5,
    color: Colors.inkSoft,
  },
  filterPillTextActive: {
    color: Colors.surface,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.dangerSoftBg,
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
    borderRadius: Radii.lg,
    padding: 14,
  },
  errorText: {
    flex: 1,
    fontFamily: Fonts.bodySemiBold,
    fontSize: 12.5,
    color: Colors.danger,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12.5,
    color: Colors.inkSoft,
    textAlign: 'center',
  },
  recordCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 7,
  },
  recordTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  recordTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ticketNum: {
    fontFamily: Fonts.monoBold,
    fontSize: 15,
    color: Colors.ink,
  },
  recordDate: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 11.5,
    color: Colors.inkSoft,
  },
  outcomeBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: Radii.pill,
  },
  outcomeBadgeText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 10.5,
  },
  recordService: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 13,
    color: Colors.ink,
  },
  recordMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: 7,
  },
  recordMeta: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 11.5,
    color: Colors.inkSoft,
  },
  monoInline: {
    fontFamily: Fonts.monoSemiBold,
    color: Colors.ink,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  pageBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radii.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pageBtnDisabled: {
    opacity: 0.45,
  },
  pageBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    color: Colors.ink,
  },
  pageInfo: {
    fontFamily: Fonts.monoMedium,
    fontSize: 12,
    color: Colors.inkSoft,
  },
});
