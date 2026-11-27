import React, { useState, useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Colors, Fonts, Radii, Shadows } from '../../theme/tokens';
import type { ApiDownload } from '../../context/apiClient';
import { shareReport } from '../../context/shareReport';
import { AdminAuditRecord } from '../../types/admin';

interface ExportSystemReportModalProps {
  visible: boolean;
  records: AdminAuditRecord[];
  filterSummary: string;
  onClose: () => void;
  onExported: (recordCount: number) => void;
  onLiveDownload: (format: 'csv' | 'pdf') => Promise<ApiDownload>;
}

export function ExportSystemReportModal({
  visible,
  records,
  filterSummary,
  onClose,
  onExported,
  onLiveDownload,
}: ExportSystemReportModalProps) {
  const [format, setFormat] = useState<'CSV' | 'PDF'>('CSV');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);

  const handleDownloadAndShare = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await shareReport(await onLiveDownload(format === 'CSV' ? 'csv' : 'pdf'));
      onExported(records.length);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to export the report.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, Shadows.modal]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Export Master Report</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={18} color={Colors.inkSoft} />
            </Pressable>
          </View>

          {/* Active Filter Summary */}
          <View style={styles.summaryBox}>
            <Text style={styles.summaryCount}>{records.length} matching records</Text>
            <Text style={styles.summaryMeta}>{filterSummary}</Text>
          </View>

          {/* Format Radio Group */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Export Format</Text>
            {(
              [
                { value: 'CSV', label: 'CSV Spreadsheet', sub: 'Raw rows for Excel / Sheets' },
                {
                  value: 'PDF',
                  label: 'PDF Executive Summary',
                  sub: 'Formatted institutional report',
                },
              ] as const
            ).map((opt) => {
              const active = format === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setFormat(opt.value)}
                  style={[styles.radioCard, active && styles.radioCardActive]}
                >
                  <View style={[styles.radioOuter, active && styles.radioOuterActive]}>
                    {active ? <View style={styles.radioInner} /> : null}
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.radioLabel}>{opt.label}</Text>
                    <Text style={styles.radioSub}>{opt.sub}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.toggleHint}>The backend exports analytics for the selected date range and office.</Text>
          {!!error && <Text accessibilityRole="alert">{error}</Text>}

          <View style={styles.actionsRow}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={handleDownloadAndShare}
              style={({ pressed }) => [styles.exportBtn, pressed && styles.pressed]}
            >
              <Feather name="download" size={14} color={Colors.ink} />
              <Text style={styles.exportText}>{busy ? 'Downloading…' : 'Download & Share'}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: Colors.backdrop,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.modal,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: Fonts.displayBold,
    fontSize: 17,
    color: Colors.ink,
  },
  summaryBox: {
    backgroundColor: Colors.ink,
    borderRadius: Radii.lg,
    padding: 13,
    gap: 3,
  },
  summaryCount: {
    fontFamily: Fonts.monoBold,
    fontSize: 15,
    color: Colors.matcha,
  },
  summaryMeta: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 11.5,
    color: Colors.surfaceMuted,
  },
  fieldGroup: { gap: 8 },
  label: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 12,
    color: Colors.ink,
  },
  radioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSubtle,
  },
  radioCardActive: {
    borderColor: Colors.ink,
    backgroundColor: Colors.surface,
  },
  radioOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.inkMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: { borderColor: Colors.ink },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.ink,
  },
  radioLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    color: Colors.ink,
  },
  radioSub: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 11.5,
    color: Colors.inkSoft,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  toggleHint: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 11.5,
    color: Colors.inkSoft,
  },
  actionsRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
  },
  cancelText: { fontFamily: Fonts.bodyBold, fontSize: 13, color: Colors.ink },
  exportBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    paddingVertical: 12,
    borderRadius: Radii.lg,
    backgroundColor: Colors.matcha,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportText: { fontFamily: Fonts.bodyBold, fontSize: 13, color: Colors.ink },
  pressed: { opacity: 0.84 },
});
