import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HistoryReceiptCard } from '../../components/history/HistoryReceiptCard';
import { useQueue } from '../../context/QueueContext';
import { HistoryFilterOption, HistoryTicket } from '../../types/queue';
import { Colors, Fonts, Radii } from '../../theme/tokens';

export default function StudentHistoryScreen() {
  const { historyTickets, historyFilters, historicalBasePassCount, triggerHaptic } = useQueue();

  const [statusFilter, setStatusFilter] = useState<HistoryFilterOption>('All');
  const [, setSelectedReceipt] = useState<HistoryTicket | null>(null);

  const filteredList = useMemo(() => {
    if (statusFilter === 'All') return historyTickets;
    return historyTickets.filter(
      (item) => item.status.toLowerCase() === statusFilter.toLowerCase()
    );
  }, [historyTickets, statusFilter]);

  const totalPassesCount = historicalBasePassCount + historyTickets.length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.title}>Transaction History</Text>
          <View style={styles.passesPill}>
            <Text style={styles.passesPillText}>{totalPassesCount} PASSES</Text>
          </View>
        </View>

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersRow}
        >
          {historyFilters.map((chip) => {
            const active = statusFilter === chip;
            return (
              <Pressable
                key={chip}
                onPress={() => {
                  triggerHaptic('light');
                  setStatusFilter(chip);
                }}
                style={[
                  styles.filterChip,
                  active ? styles.filterChipActive : styles.filterChipIdle,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    active ? styles.filterChipTextActive : styles.filterChipTextIdle,
                  ]}
                >
                  {chip}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Receipt Stubs */}
        <View style={styles.listWrap}>
          {filteredList.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No {statusFilter} passes found</Text>
              <Text style={styles.emptySubtitle}>
                Transactions matching this filter will appear here.
              </Text>
            </View>
          ) : (
            filteredList.map((item) => (
              <HistoryReceiptCard
                key={item.id}
                item={item}
                onPress={(receipt) => {
                  triggerHaptic('light');
                  setSelectedReceipt(receipt);
                }}
              />
            ))
          )}
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
    paddingTop: 10,
    paddingBottom: 118,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontFamily: Fonts.displayExtraBold,
    fontSize: 24,
    letterSpacing: -0.7,
    color: Colors.ink,
  },
  passesPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  passesPillText: {
    fontFamily: Fonts.monoBold,
    fontSize: 11,
    color: Colors.ink,
    fontVariant: ['tabular-nums'],
  },
  filtersRow: {
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radii.pill,
  },
  filterChipActive: {
    backgroundColor: Colors.ink,
  },
  filterChipIdle: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 11.5,
  },
  filterChipTextActive: {
    color: Colors.surface,
  },
  filterChipTextIdle: {
    color: Colors.ink,
  },
  listWrap: {
    gap: 12,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12.5,
    color: Colors.ink,
  },
  emptySubtitle: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 11,
    color: Colors.inkSoft,
    marginTop: 4,
    textAlign: 'center',
  },
});
