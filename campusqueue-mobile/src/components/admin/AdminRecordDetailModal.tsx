import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Colors, Fonts, Radii, Shadows, getTicketStatusBadgeStyle } from '../../theme/tokens';
import { AdminAuditRecord } from '../../types/admin';

interface AdminRecordDetailModalProps {
  record: AdminAuditRecord | null;
  onClose: () => void;
}

export function AdminRecordDetailModal({ record, onClose }: AdminRecordDetailModalProps) {
  if (!record) return null;

  const badge = getTicketStatusBadgeStyle(record.outcome);

  return (
    <Modal visible={Boolean(record)} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, Shadows.modal]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.ticketCode}>{record.ticketCode}</Text>
              <View style={[styles.outcomeBadge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.outcomeText, { color: badge.text }]}>{record.outcome}</Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={18} color={Colors.inkSoft} />
            </Pressable>
          </View>

          <ScrollView style={styles.bodyScroll} showsVerticalScrollIndicator={false}>
            {/* Core Audit Identifiers */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>AUDIT IDENTIFIERS</Text>
              <View style={styles.detailBox}>
                <DetailRow label="Document ID" value={record.documentId} mono />
                <DetailRow label="Ticket Code" value={record.ticketCode} mono />
                <DetailRow label="Student Name" value={record.studentName} />
                <DetailRow label="Student USN" value={record.studentUsn} mono />
                <DetailRow label="Campus Office" value={record.officeName} />
                <DetailRow label="Service" value={record.serviceName} />
              </View>
            </View>

            {/* Lifecycle Timestamps */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>LIFECYCLE TIMESTAMPS</Text>
              <View style={styles.detailBox}>
                <DetailRow label="Issued" value={record.issuedAt} mono />
                <DetailRow label="Approaching Alert Sent" value={record.approachingAlertAt} mono />
                <DetailRow label="Called" value={record.calledAt} mono />
                <DetailRow label="QR Verified" value={record.qrVerifiedAt} mono />
                <DetailRow label={record.outcome} value={record.closedAt} mono />
              </View>
            </View>

            {/* SLA Metrics & Handling Staff */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>SLA & VERIFICATION</Text>
              <View style={styles.detailBox}>
                <DetailRow label="Calculated Wait Time" value={record.waitDurationLabel} mono />
                <DetailRow label="Calculated Service Time" value={record.serviceDurationLabel} mono />
                <DetailRow label="Verification Method" value={record.verificationMethod} />
                <DetailRow
                  label="Handling Staff"
                  value={`${record.handledByStaffId} (${record.handledByStaffName})`}
                />
                <DetailRow label="Counter Window" value={record.counterWindow} />
              </View>
            </View>
          </ScrollView>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
          >
            <Text style={styles.closeBtnText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, mono && styles.detailValueMono]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
    maxHeight: '86%',
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ticketCode: {
    fontFamily: Fonts.monoBold,
    fontSize: 20,
    color: Colors.ink,
  },
  outcomeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.pill,
  },
  outcomeText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 11,
  },
  bodyScroll: {
    maxHeight: 420,
  },
  section: {
    marginBottom: 14,
    gap: 6,
  },
  sectionLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 10.5,
    letterSpacing: 0.7,
    color: Colors.inkMuted,
  },
  detailBox: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    gap: 10,
  },
  detailLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    color: Colors.inkSoft,
  },
  detailValue: {
    flex: 1,
    textAlign: 'right',
    fontFamily: Fonts.bodySemiBold,
    fontSize: 12,
    color: Colors.ink,
  },
  detailValueMono: {
    fontFamily: Fonts.monoSemiBold,
    fontSize: 11.5,
  },
  closeBtn: {
    paddingVertical: 12,
    borderRadius: Radii.lg,
    backgroundColor: Colors.ink,
    alignItems: 'center',
  },
  closeBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    color: Colors.surface,
  },
  pressed: { opacity: 0.84 },
});
