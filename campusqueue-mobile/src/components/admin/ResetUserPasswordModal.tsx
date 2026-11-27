import React, { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Colors, Fonts, Radii, Shadows } from '../../theme/tokens';
import { AdminUserRecord } from '../../types/admin';

interface ResetUserPasswordModalProps {
  user: AdminUserRecord | null;
  onClose: () => void;
  onConfirmReset: (userId: string, password: string) => { ok: boolean; error?: string } | Promise<{ ok: boolean; error?: string }>;
}

export function ResetUserPasswordModal(props: ResetUserPasswordModalProps) {
  return props.user ? <ResetUserPasswordModalForm key={props.user?.id} {...props} /> : null;
}

function ResetUserPasswordModalForm({
  user,
  onClose,
  onConfirmReset,
}: ResetUserPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  if (!user) return null;

  const submit = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await onConfirmReset(user.id, password);
      if (result.ok) onClose();
      else setError(result.error ?? 'Could not reset the password.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not reset the password.');
    } finally {
      pending.current = false;
      setBusy(false);
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
            Reset password for <Text style={styles.bold}>{user.fullName}</Text> (
            <Text style={styles.mono}>{user.identifier}</Text>).
          </Text>
          <TextInput accessibilityLabel="New password" placeholder="New password" secureTextEntry
            autoCapitalize="none" autoCorrect={false} maxLength={128} value={password} onChangeText={setPassword}
            style={styles.passwordInput} />
          {!!error && <Text accessibilityRole="alert" style={styles.subNote}>{error}</Text>}

          <View style={styles.actionsRow}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={busy || password.length < 8}
              onPress={submit}
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
  passwordInput: { width: '100%', borderWidth: 1, borderColor: Colors.border, borderRadius: Radii.lg, padding: 10 },
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
