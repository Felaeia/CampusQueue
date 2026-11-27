import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { HistoryTicket, StudentProfile } from '../../types/queue';
import { Colors, Fonts, getTicketStatusBadgeStyle, Radii, Shadows } from '../../theme/tokens';
import { formatDisplayTimestamp } from '../../utils/waitTime';

interface ReceiptDetailModalProps {
  receipt: HistoryTicket | null;
  studentProfile: StudentProfile;
  onClose: () => void;
  onRequestAgain: (receipt: HistoryTicket) => void;
}

export function ReceiptDetailModal({
  receipt,
  studentProfile,
  onClose,
  onRequestAgain,
}: ReceiptDetailModalProps) {
  if (!receipt) return null;

  const badge = getTicketStatusBadgeStyle(receipt.status);

  return (
    <Modal
      visible={Boolean(receipt)}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, Shadows.modal]}>
          <View style={styles.topRow}>
            <Text style={styles.ticketNumber}>{receipt.ticketNumber}</Text>
            <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.statusText, { color: badge.text }]}>{receipt.status}</Text>
            </View>
          </View>

          <View>
            <Text style={styles.serviceTitle}>{receipt.service}</Text>
            <Text style={styles.officeName}>{receipt.officeName}</Text>
          </View>

          <View style={styles.detailsBox}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Student ID</Text>
              <Text style={styles.detailValue}>{studentProfile.studentId}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>USN</Text>
              <Text style={styles.detailValue}>{studentProfile.usn}</Text>
            </View>

            <View style={styles.detailDivider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Issued At</Text>
              <Text style={styles.detailValue}>
                {formatDisplayTimestamp(receipt.issuedAt, 'datetime')}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Called At</Text>
              <Text style={styles.detailValue}>
                {formatDisplayTimestamp(receipt.calledAt, 'datetime')}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Closed At</Text>
              <Text style={styles.detailValue}>
                {formatDisplayTimestamp(receipt.timestamp, 'datetime')}
              </Text>
            </View>

            <View style={styles.detailDivider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Wait Duration</Text>
              <Text style={styles.detailValue}>
                {receipt.waitDuration} • {receipt.counter}
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
            >
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
            <Pressable
              onPress={() => onRequestAgain(receipt)}
              style={({ pressed }) => [styles.requeueBtn, pressed && styles.pressed]}
            >
              <Text style={styles.requeueBtnText}>Request Same Service Again</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.backdrop,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.surface,
    borderRadius: Radii.modal,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    gap: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ticketNumber: {
    fontFamily: Fonts.displayExtraBold,
    fontSize: 24,
    letterSpacing: -0.7,
    color: Colors.ink,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Radii.pill,
  },
  statusText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 10.5,
  },
  serviceTitle: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    color: Colors.ink,
  },
  officeName: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 11.5,
    color: Colors.inkSoft,
    marginTop: 2,
  },
  detailsBox: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: Radii.xl,
    padding: 14,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  detailLabel: {
    fontFamily: Fonts.monoMedium,
    fontSize: 11,
    color: Colors.inkSoft,
    fontVariant: ['tabular-nums'],
  },
  detailValue: {
    fontFamily: Fonts.monoBold,
    fontSize: 11,
    color: Colors.ink,
    textAlign: 'right',
    flexShrink: 1,
    fontVariant: ['tabular-nums'],
  },
  detailDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(18, 20, 23, 0.10)',
    marginVertical: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 2,
  },
  closeBtn: {
    flex: 0.78,
    paddingVertical: 11,
    borderRadius: Radii.md,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    color: Colors.ink,
  },
  requeueBtn: {
    flex: 1.4,
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: Radii.md,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requeueBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 11,
    color: Colors.matcha,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
});
