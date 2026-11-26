import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Colors, Fonts, Radii, Shadows } from '../../theme/tokens';
import { AdminUserRecord } from '../../types/admin';

interface ResetUserPasswordModalProps {
  user: AdminUserRecord | null;
  onClose: () => void;
  onConfirmReset: (userId: string) => void;
}

export function ResetUserPasswordModal({
  user,
  onClose,
  onConfirmReset,
}: ResetUserPasswordModalProps) {
  if (!user) return null;

  const defaultPwd =
    user.role === 'admin' ? 'admin123' : user.role === 'staff' ? 'staff123' : 'student123';

  return (
    <Modal visible={Boolean(user)} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, Shadows.modal]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.iconWrap}>
            <Feather name="key" size={22} color={Colors.registrar} />
          </View>
          <Text style={styles.title}>Reset User Password</Text>
          <Text style={styles.body}>
            Reset password for <Text style={styles.bold}>{user.fullName}</Text> (
            <Text style={styles.mono}>{user.identifier}</Text>) back to the default role password (
            <Text style={styles.mono}>{defaultPwd}</Text>)?
          </Text>
          <Text style={styles.subNote}>
            The user will be required to change their password on their next sign-in.
          </Text>

          <View style={styles.actionsRow}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                onConfirmReset(user.id);
                onClose();
              }}
              style={({ pressed }) => [styles.confirmBtn, pressed && styles.pressed]}
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
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.registrarHistoryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Fonts.displayBold,
    fontSize: 17,
    color: Colors.ink,
  },
  body: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.inkSoft,
    textAlign: 'center',
  },
  bold: {
    fontFamily: Fonts.bodyBold,
    color: Colors.ink,
  },
  mono: {
    fontFamily: Fonts.monoBold,
    color: Colors.ink,
  },
  subNote: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 11.5,
    color: Colors.inkMuted,
    textAlign: 'center',
  },
  actionsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
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
  cancelText: { fontFamily: Fonts.bodyBold, fontSize: 13, color: Colors.ink },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radii.lg,
    backgroundColor: Colors.ink,
    alignItems: 'center',
  },
  confirmText: { fontFamily: Fonts.bodyBold, fontSize: 13, color: Colors.surface },
  pressed: { opacity: 0.84 },
});
