import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { HistoryTicket } from '../../types/queue';
import { Colors, Fonts, Radii, Shadows } from '../../theme/tokens';

interface RequeueConfirmModalProps {
  target: HistoryTicket | null;
  waitingCount?: number;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (target: HistoryTicket) => void;
}

export function RequeueConfirmModal({
  target,
  waitingCount,
  busy,
  onClose,
  onConfirm,
}: RequeueConfirmModalProps) {
  if (!target) return null;

  return (
    <Modal
      visible={Boolean(target)}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, Shadows.modal]}>
          <Text style={styles.title}>Request Same Service Again?</Text>
          <Text style={styles.body}>
            Issue a fresh queue pass for{' '}
            <Text style={styles.bodyBold}>
              {target.officeName} — {target.service}
            </Text>
            ? {waitingCount !== undefined && <Text style={styles.monoBold}>{waitingCount} currently waiting.</Text>}
          </Text>

          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={() => onConfirm(target)}
              style={({ pressed }) => [styles.confirmBtn, pressed && styles.pressed]}
            >
              <Text style={styles.confirmBtnText}>Issue New Ticket</Text>
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
  title: {
    fontFamily: Fonts.displayExtraBold,
    fontSize: 18,
    letterSpacing: -0.4,
    color: Colors.ink,
  },
  body: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.inkSoft,
  },
  bodyBold: {
    fontFamily: Fonts.bodyBold,
    color: Colors.ink,
  },
  monoBold: {
    fontFamily: Fonts.monoBold,
    color: Colors.ink,
    fontVariant: ['tabular-nums'],
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: Radii.md,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    color: Colors.ink,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: Radii.md,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    color: Colors.matcha,
  },
  pressed: {
    opacity: 0.85,
  },
});
