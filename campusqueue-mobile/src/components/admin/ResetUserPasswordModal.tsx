import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Colors, Fonts, Radii, Shadows } from '../../theme/tokens';
import { AdminUserRecord } from '../../types/admin';

interface ResetUserPasswordModalProps {
  user: AdminUserRecord | null;
  onClose: () => void;
  onConfirmReset: (
    userId: string,
    newPassword: string
  ) => { ok: boolean; error?: string } | Promise<{ ok: boolean; error?: string }>;
}

export function ResetUserPasswordModal({
  user,
  onClose,
  onConfirmReset,
}: ResetUserPasswordModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setNewPassword('');
      setErrorMsg('');
      setSaving(false);
    }
  }, [user]);

  if (!user) return null;

  const handleConfirm = async () => {
    if (saving) return;
    if (newPassword.trim().length < 8) {
      setErrorMsg('New password must be at least 8 characters.');
      return;
    }
    setSaving(true);
    try {
      const res = await onConfirmReset(user.id, newPassword.trim());
      if (!res.ok) {
        setErrorMsg(res.error ?? 'Failed to reset password.');
        return;
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={Boolean(user)} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, Shadows.modal]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.iconWrap}>
            <Feather name="key" size={22} color={Colors.registrar} />
          </View>
          <Text style={styles.title}>Reset User Password</Text>
          <Text style={styles.body}>
            Set a new password for <Text style={styles.bold}>{user.fullName}</Text> (
            <Text style={styles.mono}>{user.identifier}</Text>). Existing sessions will be signed
            out immediately.
          </Text>

          <TextInput
            value={newPassword}
            onChangeText={(t) => {
              setNewPassword(t);
              if (errorMsg) setErrorMsg('');
            }}
            placeholder="New password (min 8 characters)"
            placeholderTextColor={Colors.inkMuted}
            secureTextEntry
            autoCapitalize="none"
            style={styles.input}
          />

          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

          <View style={styles.actionsRow}>
            <Pressable
              onPress={onClose}
              disabled={saving}
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                void handleConfirm();
              }}
              disabled={saving}
              style={({ pressed }) => [styles.confirmBtn, (pressed || saving) && styles.pressed]}
            >
              <Text style={styles.confirmText}>{saving ? 'Saving...' : 'Confirm Reset'}</Text>
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
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.lg,
    backgroundColor: Colors.surfaceSubtle,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    color: Colors.ink,
    marginTop: 4,
  },
  errorText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 12,
    color: Colors.danger,
    alignSelf: 'flex-start',
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
