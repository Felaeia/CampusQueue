import React, { useMemo, useState } from 'react';
import {
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

import { useStaffQueue } from '../../context/StaffQueueContext';
import { Colors, Fonts, Radii } from '../../theme/tokens';
import { LogFilterTab } from '../../types/staff';

export default function StaffDailyLog() {
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Daily Queue Log</Text>
          <Text style={styles.headerSub}>{logsConfig.office} - Today&apos;s Shift</Text>
        </View>
      </View>

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
              <View key={tx.id} style={styles.ticketCard}>
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
              </View>
            );
          })
        )}
      </ScrollView>
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
});
