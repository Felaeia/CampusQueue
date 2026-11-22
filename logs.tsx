// app/logs.tsx
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CQTheme } from '../../../../theme/campusQueueTheme';
import sampleData from './sampleData.json';

type LogOutcome = 'Completed' | 'Skipped';
type FilterTab = 'My Counter Only' | 'All Office Counters' | 'Skipped Only';

interface ProcessedTransaction {
  id: string;
  ticketNumber: string;
  studentName: string;
  usn: string;
  serviceType: string;
  outcome: LogOutcome;
  counterWindow: string;
  staffName: string;
  issuedAt: string;
  calledAt: string;
  verifiedAt?: string;
  closedAt: string;
  durationFormatted: string;
  remarks?: string;
}

const LOG_DATA = sampleData.logs;
const TODAY_TRANSACTIONS = LOG_DATA.transactions as ProcessedTransaction[];
const FILTER_TABS = LOG_DATA.filterTabs as FilterTab[];

export default function StaffDailyLog() {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('My Counter Only');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTx, setSelectedTx] = useState<ProcessedTransaction | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'CSV' | 'PDF'>('CSV');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const filteredLogs = useMemo(() => {
    return TODAY_TRANSACTIONS.filter((item) => {
      if (activeFilter === 'My Counter Only' && item.counterWindow !== 'Window 2') return false;
      if (activeFilter === 'Skipped Only' && item.outcome !== 'Skipped') return false;

      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;
      return item.ticketNumber.toLowerCase().includes(query)
        || item.usn.includes(query)
        || item.studentName.toLowerCase().includes(query);
    });
  }, [activeFilter, searchQuery]);

  const handleGenerateAndShare = async () => {
    setShowExportModal(false);
    const summaryText = [
      LOG_DATA.summaryTitle,
      `Office: ${LOG_DATA.office} | Counter: ${LOG_DATA.counter}`,
      `Staff: ${LOG_DATA.staffName} (ID: ${LOG_DATA.staffId})`,
      `Served by Me Today: ${LOG_DATA.kpis.servedByMe} | Office Completed: ${LOG_DATA.kpis.officeCompleted} | Skipped: ${LOG_DATA.kpis.skipped} | Avg Service: ${LOG_DATA.kpis.averageService}`,
      `Export Format: ${exportFormat}`,
    ].join('\n');

    try {
      await Share.share({
        title: `CampusQueue_Shift_Summary.${exportFormat.toLowerCase()}`,
        message: summaryText,
      });
      triggerToast(`Shift summary exported as ${exportFormat}.`);
    } catch {
      triggerToast('Shift summary ready.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      {toastMessage && (
        <View style={styles.toastBanner}>
          <Ionicons name="checkmark-circle" size={18} color={CQTheme.colors.limeAccent} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Daily Queue Log</Text>
          <Text style={styles.headerSub}>{LOG_DATA.office} - Today&apos;s Shift</Text>
        </View>
        <TouchableOpacity
          style={styles.exportHeaderBtn}
          onPress={() => setShowExportModal(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="share-outline" size={16} color={CQTheme.colors.textPrimary} />
          <Text style={styles.exportHeaderBtnText}>Export</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, styles.kpiCardDark]}>
            <Text style={styles.kpiLabelLight}>SERVED BY ME</Text>
            <Text style={styles.kpiValueLime}>{LOG_DATA.kpis.servedByMe}</Text>
            <Text style={styles.kpiHintLight}>{LOG_DATA.counter} Today</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>OFFICE COMPLETED</Text>
            <Text style={styles.kpiValue}>{LOG_DATA.kpis.officeCompleted}</Text>
            <Text style={styles.kpiHint}>All Counters</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>SKIPPED TICKETS</Text>
            <Text style={[styles.kpiValue, { color: CQTheme.colors.dangerText }]}>
              {LOG_DATA.kpis.skipped}
            </Text>
            <Text style={styles.kpiHint}>No-show / Invalid</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>AVG. SERVICE TIME</Text>
            <Text style={styles.kpiValue}>{LOG_DATA.kpis.averageService}</Text>
            <Text style={styles.kpiHint}>Target: &lt; 06m 00s</Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {FILTER_TABS.map((tab) => {
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
          <Ionicons name="search" size={18} color={CQTheme.colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by ticket # or student USN..."
            placeholderTextColor={CQTheme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={CQTheme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {filteredLogs.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="document-text-outline" size={32} color={CQTheme.colors.textSecondary} />
            <Text style={styles.emptyTitle}>No Transactions Found</Text>
            <Text style={styles.emptySub}>No processed transactions match today&apos;s shift filter.</Text>
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
                  <View style={[styles.outcomeBadge, isCompleted ? styles.completedBadge : styles.skippedBadge]}>
                    <Text style={[styles.outcomeText, { color: isCompleted ? '#166534' : '#9A3412' }]}>
                      {tx.outcome}
                    </Text>
                  </View>
                </View>

                <Text style={styles.ticketNumber}>{tx.ticketNumber}</Text>
                <Text style={styles.studentName}>{tx.studentName}</Text>
                <Text style={styles.studentMeta}>USN {tx.usn} • {tx.serviceType}</Text>
                <View style={styles.ticketDivider} />
                <View style={styles.ticketBottomRow}>
                  <View>
                    <Text style={styles.ticketMetaLabel}>Counter / Staff</Text>
                    <Text style={styles.ticketMetaValue}>{tx.counterWindow} • {tx.staffName}</Text>
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

      <Modal visible={showExportModal} transparent animationType="fade" onRequestClose={() => setShowExportModal(false)}>
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
                  <Text style={[styles.exportOptionText, exportFormat === format && styles.exportOptionTextActive]}>
                    {format}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSecondaryButton} onPress={() => setShowExportModal(false)}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimaryButton} onPress={handleGenerateAndShare}>
                <Text style={styles.modalPrimaryText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={selectedTx !== null} transparent animationType="slide" onRequestClose={() => setSelectedTx(null)}>
        <View style={styles.modalBackdrop}>
          {selectedTx && (
            <View style={[styles.modalCard, styles.detailModal]}>
              <View style={styles.detailHeader}>
                <View>
                  <Text style={styles.modalTitle}>{selectedTx.ticketNumber}</Text>
                  <Text style={styles.modalSub}>{selectedTx.studentName}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedTx(null)}>
                  <Ionicons name="close-circle" size={24} color={CQTheme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
              {[
                ['USN', selectedTx.usn],
                ['Service', selectedTx.serviceType],
                ['Issued', selectedTx.issuedAt],
                ['Called', selectedTx.calledAt],
                ...(selectedTx.verifiedAt ? [['Verified', selectedTx.verifiedAt] as [string, string]] : []),
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
  safeArea: { flex: 1, backgroundColor: CQTheme.colors.canvas },
  toastBanner: { position: 'absolute', top: 16, left: 20, right: 20, zIndex: 20, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: CQTheme.radii.pill, backgroundColor: CQTheme.colors.darkCard, paddingHorizontal: 16, paddingVertical: 12 },
  toastText: { color: CQTheme.colors.textInverse, fontSize: 13, fontWeight: '700' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14 },
  headerTitle: { color: CQTheme.colors.textPrimary, fontSize: 24, fontWeight: '800' },
  headerSub: { color: CQTheme.colors.textSecondary, marginTop: 3, fontSize: 13 },
  exportHeaderBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: CQTheme.colors.borderLight, borderRadius: CQTheme.radii.pill, backgroundColor: CQTheme.colors.surface, paddingHorizontal: 12, height: 38 },
  exportHeaderBtnText: { color: CQTheme.colors.textPrimary, fontSize: 13, fontWeight: '700' },
  scrollContainer: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 112 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: { width: '48.5%', minHeight: 112, borderRadius: CQTheme.radii.card, borderWidth: 1, borderColor: CQTheme.colors.borderLight, backgroundColor: CQTheme.colors.surface, padding: 14 },
  kpiCardDark: { backgroundColor: CQTheme.colors.darkCard, borderColor: CQTheme.colors.darkCard },
  kpiLabel: { color: CQTheme.colors.textSecondary, fontSize: 10, fontWeight: '800' },
  kpiLabelLight: { color: CQTheme.colors.textInverse, fontSize: 10, fontWeight: '800' },
  kpiValue: { color: CQTheme.colors.textPrimary, fontSize: 25, fontWeight: '800', marginTop: 12 },
  kpiValueLime: { color: CQTheme.colors.limeAccent, fontSize: 25, fontWeight: '800', marginTop: 12 },
  kpiHint: { color: CQTheme.colors.textSecondary, fontSize: 11, marginTop: 4 },
  kpiHintLight: { color: '#CBD0D4', fontSize: 11, marginTop: 4 },
  chipRow: { gap: 8, paddingVertical: 18 },
  filterChip: { height: 36, justifyContent: 'center', borderWidth: 1, borderColor: CQTheme.colors.borderLight, borderRadius: CQTheme.radii.pill, backgroundColor: CQTheme.colors.surface, paddingHorizontal: 14 },
  filterChipActive: { backgroundColor: CQTheme.colors.darkCard, borderColor: CQTheme.colors.darkCard },
  filterChipText: { color: CQTheme.colors.textSecondary, fontSize: 12, fontWeight: '700' },
  filterChipTextActive: { color: CQTheme.colors.textInverse },
  searchBox: { height: 46, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: CQTheme.colors.borderLight, borderRadius: CQTheme.radii.inner, backgroundColor: CQTheme.colors.surface, paddingHorizontal: 12, marginBottom: 12 },
  searchInput: { flex: 1, color: CQTheme.colors.textPrimary, fontSize: 13 },
  emptyCard: { alignItems: 'center', borderRadius: CQTheme.radii.card, borderWidth: 1, borderColor: CQTheme.colors.borderLight, backgroundColor: CQTheme.colors.surface, paddingVertical: 30, paddingHorizontal: 20 },
  emptyTitle: { color: CQTheme.colors.textPrimary, fontSize: 15, fontWeight: '800', marginTop: 8 },
  emptySub: { color: CQTheme.colors.textSecondary, textAlign: 'center', fontSize: 12, marginTop: 4 },
  ticketCard: { borderRadius: CQTheme.radii.card, backgroundColor: CQTheme.colors.surface, borderWidth: 1, borderColor: CQTheme.colors.borderLight, padding: 16, marginBottom: 10 },
  ticketTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  officeTag: { borderRadius: CQTheme.radii.pill, backgroundColor: CQTheme.colors.tealSoft, paddingHorizontal: 9, paddingVertical: 5 },
  officeTagText: { color: CQTheme.colors.tealBadge, fontSize: 9, fontWeight: '800' },
  outcomeBadge: { borderRadius: CQTheme.radii.pill, paddingHorizontal: 9, paddingVertical: 5 },
  completedBadge: { backgroundColor: CQTheme.colors.emeraldSoft },
  skippedBadge: { backgroundColor: '#FFEDD5' },
  outcomeText: { fontSize: 10, fontWeight: '800' },
  ticketNumber: { color: CQTheme.colors.tealBadge, fontSize: 13, fontWeight: '800', marginTop: 13 },
  studentName: { color: CQTheme.colors.textPrimary, fontSize: 17, fontWeight: '800', marginTop: 2 },
  studentMeta: { color: CQTheme.colors.textSecondary, fontSize: 12, marginTop: 3 },
  ticketDivider: { height: 1, backgroundColor: CQTheme.colors.borderLight, marginVertical: 12 },
  ticketBottomRow: { flexDirection: 'row', justifyContent: 'space-between' },
  ticketMetaLabel: { color: CQTheme.colors.textSecondary, fontSize: 9, fontWeight: '700' },
  ticketMetaValue: { color: CQTheme.colors.textPrimary, fontSize: 12, fontWeight: '700', marginTop: 3 },
  durationBlock: { alignItems: 'flex-end' },
  durationValue: { color: CQTheme.colors.textPrimary, fontSize: 13, fontWeight: '800', marginTop: 3 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(22, 24, 26, 0.42)' },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: CQTheme.colors.surface, padding: 20 },
  detailModal: { maxHeight: '82%' },
  modalTitle: { color: CQTheme.colors.textPrimary, fontSize: 20, fontWeight: '800' },
  modalSub: { color: CQTheme.colors.textSecondary, fontSize: 13, marginTop: 4 },
  exportOptions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  exportOption: { flex: 1, height: 46, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: CQTheme.colors.borderLight, borderRadius: CQTheme.radii.inner },
  exportOptionActive: { backgroundColor: CQTheme.colors.darkCard, borderColor: CQTheme.colors.darkCard },
  exportOptionText: { color: CQTheme.colors.textPrimary, fontWeight: '800' },
  exportOptionTextActive: { color: CQTheme.colors.textInverse },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
  modalSecondaryButton: { height: 44, justifyContent: 'center', paddingHorizontal: 16 },
  modalSecondaryText: { color: CQTheme.colors.textSecondary, fontWeight: '700' },
  modalPrimaryButton: { height: 44, justifyContent: 'center', borderRadius: CQTheme.radii.pill, backgroundColor: CQTheme.colors.darkCard, paddingHorizontal: 20 },
  modalPrimaryText: { color: CQTheme.colors.textInverse, fontWeight: '800' },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: CQTheme.colors.borderLight },
  detailLabel: { color: CQTheme.colors.textSecondary, fontSize: 12 },
  detailValue: { color: CQTheme.colors.textPrimary, fontSize: 12, fontWeight: '700' },
  remarksBox: { borderRadius: CQTheme.radii.inner, backgroundColor: CQTheme.colors.surfaceMuted, padding: 12, marginTop: 12 },
});
