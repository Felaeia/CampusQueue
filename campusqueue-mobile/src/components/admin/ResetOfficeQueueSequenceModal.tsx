import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Colors, Fonts, Radii, Shadows } from '../../theme/tokens';
import { AdminOfficeRecord } from '../../types/admin';

interface ResetOfficeQueueSequenceModalProps {
  office: AdminOfficeRecord | null;
  onClose: () => void;
  onConfirmReset: (officeId: string) => { ok: boolean; error?: string };
}

export function ResetOfficeQueueSequenceModal(props: ResetOfficeQueueSequenceModalProps) {
  return props.office ? <ResetOfficeQueueSequenceModalForm key={props.office?.id} {...props} /> : null;
}

function ResetOfficeQueueSequenceModalForm({
  office,
  onClose,
  onConfirmReset,
}: ResetOfficeQueueSequenceModalProps) {
  const [errorMsg, setErrorMsg] = useState('');


  if (!office) return null;

  const hasActiveWaiting = office.activeWaitingCount > 0;

  const handleConfirm = () => {
    const res = onConfirmReset(office.id);
    if (!res.ok) {
      setErrorMsg(res.error ?? 'Unable to reset sequence.');
      return;
    }
    onClose();
  };

  return (
    <Modal visible={Boolean(office)} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, Shadows.modal]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.iconWrap}>
            <Feather name="alert-triangle" size={24} color={Colors.warningDark} />
          </View>

          <Text style={styles.title}>
            Reset {office.shortLabel} Ticket Counter to 001?
          </Text>

          <Text style={styles.warningBody}>
            Only reset the sequence at the start of a new operating day when no active waiting
            tickets remain.
          </Text>

          {/* Current Active Waiting Check */}
          <View
            style={[
              styles.checkBox,
              hasActiveWaiting ? styles.checkBoxDanger : styles.checkBoxClear,
            ]}
          >
            <Feather
              name={hasActiveWaiting ? 'x-circle' : 'check-circle'}
              size={16}
              color={hasActiveWaiting ? Colors.danger : Colors.successText}
            />
            <Text
              style={[
                styles.checkText,
                { color: hasActiveWaiting ? Colors.danger : Colors.successText },
              ]}
            >
              {hasActiveWaiting
                ? `Cannot reset while ${office.activeWaitingCount} tickets are still active`
                : '0 active waiting tickets — safe to reset'}
            </Text>
          </View>

          {errorMsg && !hasActiveWaiting ? (
            <Text style={styles.inlineError}>{errorMsg}</Text>
          ) : null}

          <View style={styles.actionsRow}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              style={({ pressed }) => [
                styles.confirmBtn,
                hasActiveWaiting && styles.confirmBtnBlocked,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.confirmText}>Confirm Reset</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.backdropAlert,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.alertModal,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 22,
    gap: 12,
    alignItems: 'center',
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.warningSoftBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Fonts.displayBold,
    fontSize: 17,
    color: Colors.ink,
    textAlign: 'center',
  },
  warningBody: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.inkSoft,
    textAlign: 'center',
  },
  checkBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radii.md,
    borderWidth: 1,
  },
  checkBoxDanger: {
    backgroundColor: Colors.dangerSoftBg,
    borderColor: Colors.dangerBorder,
  },
  checkBoxClear: {
    backgroundColor: Colors.matchaSoftBg,
    borderColor: Colors.borderSubtle,
  },
  checkText: {
    flex: 1,
    fontFamily: Fonts.bodySemiBold,
    fontSize: 12,
  },
  inlineError: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 12,
    color: Colors.danger,
  },
  actionsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
  },
  cancelText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    color: Colors.ink,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radii.lg,
    backgroundColor: Colors.danger,
    alignItems: 'center',
  },
  confirmBtnBlocked: {
    opacity: 0.55,
  },
  confirmText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    color: Colors.surface,
  },
  pressed: { opacity: 0.84 },
});
