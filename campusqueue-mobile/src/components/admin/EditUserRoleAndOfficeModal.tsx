import React, { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Colors, Fonts, Radii, Shadows } from '../../theme/tokens';
import { AdminOfficeRecord, AdminUserRecord } from '../../types/admin';


interface EditUserRoleAndOfficeModalProps {
  user: AdminUserRecord | null;
  offices: AdminOfficeRecord[];
  onClose: () => void;
  onSave: (userId: string, officeId: string, defaultWindow: string) => { ok: boolean; error?: string } | Promise<{ ok: boolean; error?: string }>;
}

export function EditUserRoleAndOfficeModal(props: EditUserRoleAndOfficeModalProps) {
  return props.user ? <EditUserRoleAndOfficeModalForm key={props.user?.id} {...props} /> : null;
}

function EditUserRoleAndOfficeModalForm({
  user,
  offices,
  onClose,
  onSave,
}: EditUserRoleAndOfficeModalProps) {
  const [selectedOfficeId, setSelectedOfficeId] = useState(user?.assignedOfficeId ?? offices[0]?.id ?? '');
  const [selectedWindow, setSelectedWindow] = useState(user?.defaultWindow ?? '');


  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  if (!user) return null;
  const windows = offices.find((office) => office.id === selectedOfficeId)?.windows ?? [];

  const submit = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await onSave(user.id, selectedOfficeId, selectedWindow);
      if (result.ok) onClose();
      else setError(result.error ?? 'Unable to save the assignment.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to save the assignment.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal visible={Boolean(user)} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, Shadows.modal]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.headerRow}>
            <View style={styles.flex}>
              <Text style={styles.title}>Edit Staff Assignment</Text>
              <Text style={styles.subtitle}>
                {user.fullName} • {user.identifier}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={18} color={Colors.inkSoft} />
            </Pressable>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Assigned Campus Office</Text>
            <View style={styles.chipRow}>
              {offices.map((office) => {
                const active = selectedOfficeId === office.id;
                return (
                  <Pressable
                    key={office.id}
                    onPress={() => { setSelectedOfficeId(office.id); setSelectedWindow(office.windows[0]?.id ?? ''); }}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {office.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Default Counter Window</Text>
            <View style={styles.chipRow}>
              {windows.map((win) => {
                const active = selectedWindow === win.id;
                return (
                  <Pressable
                    key={win.id}
                    onPress={() => setSelectedWindow(win.id)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{win.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {!!error && <Text accessibilityRole="alert">{error}</Text>}
          <View style={styles.actionsRow}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={busy || !windows.some((window) => window.id === selectedWindow)}
              onPress={submit}
              style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}
            >
              <Text style={styles.saveText}>Save Assignment</Text>
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
    gap: 8,
  },
  title: {
    fontFamily: Fonts.displayBold,
    fontSize: 16.5,
    color: Colors.ink,
  },
  subtitle: {
    fontFamily: Fonts.monoMedium,
    fontSize: 12,
    color: Colors.inkSoft,
    marginTop: 2,
  },
  fieldGroup: { gap: 8 },
  label: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 12,
    color: Colors.ink,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSubtle,
  },
  chipActive: {
    backgroundColor: Colors.ink,
    borderColor: Colors.ink,
  },
  chipText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 12,
    color: Colors.inkSoft,
  },
  chipTextActive: { color: Colors.matcha },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
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
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radii.lg,
    backgroundColor: Colors.ink,
    alignItems: 'center',
  },
  saveText: { fontFamily: Fonts.bodyBold, fontSize: 13, color: Colors.surface },
  pressed: { opacity: 0.84 },
});
