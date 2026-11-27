import React, { useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { shareReport } from '../../context/shareReport';
import { useQueue, useQueueFocus } from '../../context/QueueContext';
import { useStaffQueue } from '../../context/StaffQueueContext';
import { Colors, Fonts, Radii } from '../../theme/tokens';
import { LogFilterTab, ProcessedTransaction } from '../../types/staff';

export default function StaffDailyLog() {
  useQueueFocus('logs');
  const { showToast } = useQueue();
  const {
    logsConfig,
    counterWindow,
    transactions,
    servedByMeCount,
    officeCompletedCount,
    skippedCount,
  } = useStaffQueue();

  const [activeFilter, setActiveFilter] = useState<LogFilterTab>('My Counter Only');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTx, setSelectedTx] = useState<ProcessedTransaction | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'CSV' | 'PDF'>('CSV');

  const filteredLogs = useMemo(() => {
    return transactions.filter((item) => {
      if (activeFilter === 'My Counter Only' && item.counterWindow !== counterWindow) return false;
      if (activeFilter === 'Skipped Only' && item.outcome !== 'Skipped') return false;

      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;
      return (
        item.ticketNumber.toLowerCase().includes(query) ||
        item.usn.includes(query) ||
        item.studentName.toLowerCase().includes(query)
      );
    });
  }, [activeFilter, counterWindow, searchQuery, transactions]);

  const { staffDownload, syncError, refresh } = useQueue();
  const [exporting, setExporting] = useState(false);
  const handleGenerateAndShare = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const date = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
      const query = new URLSearchParams({ counter: counterWindow, format: exportFormat.toLowerCase(), startDate: date, endDate: date });
      await shareReport(await staffDownload(query.toString()));
      showToast('Shift report ready.', 'matcha');
      setShowExportModal(false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not export the shift.', 'warning');
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Daily Queue Log</Text>
          <Text style={styles.headerSub}>{logsConfig.office} - Today&apos;s Shift</Text>
        </View>
        <TouchableOpacity
          style={styles.exportHeaderBtn}
          onPress={() => setShowExportModal(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="share-outline" size={16} color={Colors.ink} />
          <Text style={styles.exportHeaderBtnText}>Export</Text>
        </TouchableOpacity>
      </View>
      {!!syncError && <Text accessibilityRole="button" onPress={() => void refresh()}>{syncError} Tap to retry.</Text>}

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, styles.kpiCardDark]}>
            <Text style={styles.kpiLabelLight}>SERVED BY ME</Text>
            <Text style={styles.kpiValueLime}>{servedByMeCount}</Text>
            <Text style={styles.kpiHintLight}>{counterWindow} Today</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>OFFICE COMPLETED</Text>
            <Text style={styles.kpiValue}>{officeCompletedCount}</Text>
            <Text style={styles.kpiHint}>All Counters</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>SKIPPED TICKETS</Text>
            <Text style={[styles.kpiValue, { color: Colors.danger }]}>{skippedCount}</Text>
            <Text style={styles.kpiHint}>No-show / Invalid</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>AVG. SERVICE TIME</Text>
            <Text style={styles.kpiValue}>{logsConfig.kpis.averageService}</Text>
            <Text style={styles.kpiHint}>Target: &lt; 06m 00s</Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {logsConfig.filterTabs.map((tab) => {
            const active = activeFilter === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setActiveFilter(tab)}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={Colors.inkSoft} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by ticket # or student USN..."
            placeholderTextColor={Colors.inkSoft}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={Colors.inkSoft} />
            </TouchableOpacity>
          )}
        </View>

        {filteredLogs.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="document-text-outline" size={32} color={Colors.inkSoft} />
            <Text style={styles.emptyTitle}>No Transactions Found</Text>
            <Text style={styles.emptySub}>
              No processed transactions match today&apos;s shift filter.
            </Text>
          </View>
        ) : (
          filteredLogs.map((tx) => {
            const isCompleted = tx.outcome === 'Completed';
            return (
              <TouchableOpacity
                key={tx.id}
                style={styles.ticketCard}
                onPress={() => setSelectedTx(tx)}
                activeOpacity={0.85}
              >
                <View style={styles.ticketTopRow}>
                  <View style={styles.officeTag}>
                    <Text style={styles.officeTagText}>REGISTRAR</Text>
                  </View>
                  <View
                    style={[
                      styles.outcomeBadge,
                      isCompleted ? styles.completedBadge : styles.skippedBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.outcomeText,
                        { color: isCompleted ? '#166534' : '#9A3412' },
                      ]}
                    >
                      {tx.outcome}
                    </Text>
                  </View>
                </View>

                <Text style={styles.ticketNumber}>{tx.ticketNumber}</Text>
                <Text style={styles.studentName}>{tx.studentName}</Text>
                <Text style={styles.studentMeta}>
                  USN {tx.usn} • {tx.serviceType}
                </Text>
                <View style={styles.ticketDivider} />
                <View style={styles.ticketBottomRow}>
                  <View>
                    <Text style={styles.ticketMetaLabel}>Counter / Staff</Text>
                    <Text style={styles.ticketMetaValue}>
                      {tx.counterWindow} • {tx.staffName}
                    </Text>
                  </View>
                  <View style={styles.durationBlock}>
                    <Text style={styles.ticketMetaLabel}>Duration</Text>
                    <Text style={styles.durationValue}>{tx.durationFormatted}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={showExportModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowExportModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Export Shift Summary</Text>
            <Text style={styles.modalSub}>Choose a format for sharing.</Text>
            <View style={styles.exportOptions}>
              {(['CSV', 'PDF'] as const).map((format) => (
                <TouchableOpacity
                  key={format}
                  style={[styles.exportOption, exportFormat === format && styles.exportOptionActive]}
                  onPress={() => setExportFormat(format)}
                >
                  <Text
                    style={[
                      styles.exportOptionText,
                      exportFormat === format && styles.exportOptionTextActive,
                    ]}
                  >
                    {format}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalSecondaryButton}
                onPress={() => setShowExportModal(false)}
              >
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalPrimaryButton}
                disabled={exporting || !counterWindow}
                onPress={handleGenerateAndShare}
              >
                <Text style={styles.modalPrimaryText}>{exporting ? 'Downloading…' : 'Share'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={selectedTx !== null}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setSelectedTx(null)}
      >
        <View style={styles.modalBackdrop}>
          {selectedTx && (
            <View style={[styles.modalCard, styles.detailModal]}>
              <View style={styles.detailHeader}>
                <View>
                  <Text style={styles.modalTitle}>{selectedTx.ticketNumber}</Text>
                  <Text style={styles.modalSub}>{selectedTx.studentName}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedTx(null)}>
                  <Ionicons name="close-circle" size={24} color={Colors.inkSoft} />
                </TouchableOpacity>
              </View>
              {[
                ['USN', selectedTx.usn],
                ['Service', selectedTx.serviceType],
                ['Issued', selectedTx.issuedAt],
                ['Called', selectedTx.calledAt],
                ...(selectedTx.verifiedAt
                  ? ([['Verified', selectedTx.verifiedAt]] as [string, string][])
                  : []),
                ['Closed', selectedTx.closedAt],
              ].map(([label, value]) => (
                <View key={label} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{label}</Text>
                  <Text style={styles.detailValue}>{value}</Text>
                </View>
              ))}
              {selectedTx.remarks && (
                <View style={styles.remarksBox}>
                  <Text style={styles.detailLabel}>Remarks</Text>
                  <Text style={styles.detailValue}>{selectedTx.remarks}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.canvas },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
  },
  headerTitle: {
    color: Colors.ink,
    fontFamily: Fonts.displayExtraBold,
    fontSize: 24,
    letterSpacing: -0.6,
  },
  headerSub: {
    color: Colors.inkSoft,
    fontFamily: Fonts.bodyMedium,
    marginTop: 3,
    fontSize: 13,
  },
  exportHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    height: 38,
  },
  exportHeaderBtnText: {
    color: Colors.ink,
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
  },
  scrollContainer: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 116 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: {
    width: '48.2%',
    minHeight: 112,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: 14,
  },
  kpiCardDark: { backgroundColor: Colors.ink, borderColor: Colors.ink },
  kpiLabel: {
    color: Colors.inkSoft,
    fontFamily: Fonts.monoBold,
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
  kpiLabelLight: {
    color: Colors.surface,
    fontFamily: Fonts.monoBold,
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
  kpiValue: {
    color: Colors.ink,
    fontFamily: Fonts.displayExtraBold,
    fontSize: 24,
    marginTop: 12,
  },
  kpiValueLime: {
    color: Colors.matcha,
    fontFamily: Fonts.displayExtraBold,
    fontSize: 24,
    marginTop: 12,
  },
  kpiHint: {
    color: Colors.inkSoft,
    fontFamily: Fonts.bodyMedium,
    fontSize: 11,
    marginTop: 4,
  },
  kpiHintLight: {
    color: '#CBD0D4',
    fontFamily: Fonts.bodyMedium,
    fontSize: 11,
    marginTop: 4,
  },
  chipRow: { gap: 8, paddingVertical: 16 },
  filterChip: {
    height: 36,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
  },
  filterChipActive: { backgroundColor: Colors.ink, borderColor: Colors.ink },
  filterChipText: { color: Colors.inkSoft, fontFamily: Fonts.bodyBold, fontSize: 12 },
  filterChipTextActive: { color: Colors.surface },
  searchBox: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.lg,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: Colors.ink,
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
  },
  emptyCard: {
    alignItems: 'center',
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: Colors.ink,
    fontFamily: Fonts.displayBold,
    fontSize: 15,
    marginTop: 8,
  },
  emptySub: {
    color: Colors.inkSoft,
    fontFamily: Fonts.bodyRegular,
    textAlign: 'center',
    fontSize: 12,
    marginTop: 4,
  },
  ticketCard: {
    borderRadius: Radii.card,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 10,
  },
  ticketTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  officeTag: {
    borderRadius: Radii.pill,
    backgroundColor: Colors.registrarPillBg,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  officeTagText: {
    color: Colors.registrar,
    fontFamily: Fonts.displayExtraBold,
    fontSize: 9.5,
    letterSpacing: 0.5,
  },
  outcomeBadge: { borderRadius: Radii.pill, paddingHorizontal: 10, paddingVertical: 4 },
  completedBadge: { backgroundColor: Colors.matchaSoftBg },
  skippedBadge: { backgroundColor: '#FFEDD5' },
  outcomeText: { fontFamily: Fonts.bodyBold, fontSize: 10 },
  ticketNumber: {
    color: Colors.registrar,
    fontFamily: Fonts.monoBold,
    fontSize: 13,
    marginTop: 12,
    fontVariant: ['tabular-nums'],
  },
  studentName: {
    color: Colors.ink,
    fontFamily: Fonts.displayBold,
    fontSize: 17,
    marginTop: 2,
  },
  studentMeta: {
    color: Colors.inkSoft,
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    marginTop: 3,
  },
  ticketDivider: { height: 1, backgroundColor: Colors.divider, marginVertical: 12 },
  ticketBottomRow: { flexDirection: 'row', justifyContent: 'space-between' },
  ticketMetaLabel: { color: Colors.inkSoft, fontFamily: Fonts.bodySemiBold, fontSize: 10 },
  ticketMetaValue: {
    color: Colors.ink,
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    marginTop: 3,
  },
  durationBlock: { alignItems: 'flex-end' },
  durationValue: {
    color: Colors.ink,
    fontFamily: Fonts.monoBold,
    fontSize: 12.5,
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: Colors.backdropSheet,
  },
  modalCard: {
    borderTopLeftRadius: Radii.modal,
    borderTopRightRadius: Radii.modal,
    backgroundColor: Colors.surface,
    padding: 20,
    paddingBottom: 28,
  },
  detailModal: { maxHeight: '82%' },
  modalTitle: {
    color: Colors.ink,
    fontFamily: Fonts.displayExtraBold,
    fontSize: 20,
    letterSpacing: -0.4,
  },
  modalSub: {
    color: Colors.inkSoft,
    fontFamily: Fonts.bodyRegular,
    fontSize: 13,
    marginTop: 4,
  },
  exportOptions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  exportOption: {
    flex: 1,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.lg,
  },
  exportOptionActive: { backgroundColor: Colors.ink, borderColor: Colors.ink },
  exportOptionText: { color: Colors.ink, fontFamily: Fonts.bodyBold },
  exportOptionTextActive: { color: Colors.surface },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
  modalSecondaryButton: { height: 44, justifyContent: 'center', paddingHorizontal: 16 },
  modalSecondaryText: { color: Colors.inkSoft, fontFamily: Fonts.bodyBold },
  modalPrimaryButton: {
    height: 44,
    justifyContent: 'center',
    borderRadius: Radii.pill,
    backgroundColor: Colors.ink,
    paddingHorizontal: 20,
  },
  modalPrimaryText: { color: Colors.matcha, fontFamily: Fonts.bodyBold },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  detailLabel: { color: Colors.inkSoft, fontFamily: Fonts.bodyMedium, fontSize: 12 },
  detailValue: { color: Colors.ink, fontFamily: Fonts.bodyBold, fontSize: 12 },
  remarksBox: {
    borderRadius: Radii.lg,
    backgroundColor: Colors.surfaceSubtle,
    padding: 12,
    marginTop: 12,
    gap: 4,
  },
});
