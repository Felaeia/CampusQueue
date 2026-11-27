import React, { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Colors, Fonts, Radii, Shadows } from '../../theme/tokens';
import { AdminUserRecord } from '../../types/admin';

interface ToggleAccountStatusModalProps {
  user: AdminUserRecord | null;
  onClose: () => void;
  onConfirm: (userId: string) => { ok: boolean; error?: string } | Promise<{ ok: boolean; error?: string }>;
}

export function ToggleAccountStatusModal(props: ToggleAccountStatusModalProps) {
  return props.user ? <ToggleAccountStatusForm key={props.user.id} {...props} /> : null;
}

function ToggleAccountStatusForm({
  user,
  onClose,
  onConfirm,
}: ToggleAccountStatusModalProps) {
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
      const response = await onConfirm(user.id);
      if (response.ok) onClose();
      else setError(response.error ?? 'Could not update account status.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not update account status.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  const isSuspending = user.status === 'active';

  return (
    <Modal visible={Boolean(user)} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, Shadows.modal]} onPress={(e) => e.stopPropagation()}>
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: isSuspending ? Colors.dangerSoftBg : Colors.matchaSoftBg },
            ]}
          >
            <Feather
              name={isSuspending ? 'shield-off' : 'shield'}
              size={22}
              color={isSuspending ? Colors.danger : Colors.successText}
            />
          </View>

          <Text style={styles.title}>
            {isSuspending ? 'Suspend Account Access?' : 'Re-Activate Account?'}
          </Text>

          <Text style={styles.userTag}>
            {user.fullName} ({user.identifier})
          </Text>

          <Text style={styles.body}>
            {isSuspending
              ? 'Suspended users lose access to protected queue actions.'
              : 'Re-activating this account restores campus queue sign-in and portal access immediately.'}
          </Text>

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
              onPress={submit}
              style={({ pressed }) => [
                styles.confirmBtn,
                { backgroundColor: isSuspending ? Colors.danger : Colors.ink },
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.confirmText}>Confirm</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Fonts.displayBold,
    fontSize: 17,
    color: Colors.ink,
    textAlign: 'center',
  },
  userTag: {
    fontFamily: Fonts.monoBold,
    fontSize: 12,
    color: Colors.ink,
    backgroundColor: Colors.surfaceSubtle,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.pill,
  },
  body: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.inkSoft,
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
    alignItems: 'center',
  },
  confirmText: { fontFamily: Fonts.bodyBold, fontSize: 13, color: Colors.surface },
  pressed: { opacity: 0.84 },
});
