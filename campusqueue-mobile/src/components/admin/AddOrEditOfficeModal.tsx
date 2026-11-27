import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Colors, Fonts, Radii, Shadows } from '../../theme/tokens';
import { AdminOfficeRecord, SaveOfficeInput } from '../../types/admin';

interface AddOrEditOfficeModalProps {
  visible: boolean;
  editingOffice: AdminOfficeRecord | null;
  onClose: () => void;
  onSave: (input: SaveOfficeInput) => { ok: boolean; error?: string } | Promise<{ ok: boolean; error?: string }>;
}

export function AddOrEditOfficeModal(props: AddOrEditOfficeModalProps) {
  return props.visible ? <AddOrEditOfficeModalForm key={props.editingOffice?.id} {...props} /> : null;
}

function AddOrEditOfficeModalForm({
  visible,
  editingOffice,
  onClose,
  onSave,
}: AddOrEditOfficeModalProps) {
  const [officeName, setOfficeName] = useState(editingOffice?.name ?? '');
  const [ticketPrefix, setTicketPrefix] = useState(editingOffice?.prefix ?? '');
  const [locationDescription, setLocationDescription] = useState(editingOffice?.locationDescription ?? '');
  const [windowCount, setWindowCount] = useState(editingOffice?.windowCount ?? 1);
  const [errorMsg, setErrorMsg] = useState('');


  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const handleSave = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const res = await onSave({
        id: editingOffice?.id, name: officeName, prefix: ticketPrefix, locationDescription, windowCount,
      });
      if (!res.ok) setErrorMsg(res.error ?? 'Failed to save office.');
      else onClose();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Failed to save office.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={[styles.card, Shadows.modal]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>
                {editingOffice ? 'Edit Campus Office' : 'Add Campus Office'}
              </Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Feather name="x" size={18} color={Colors.inkSoft} />
              </Pressable>
            </View>

            <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Office Name *</Text>
                <TextInput
                  value={officeName}
                  onChangeText={(t) => {
                    setOfficeName(t);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="e.g., Cashier / Accounting Office"
                  placeholderTextColor={Colors.inkMuted}
                  style={styles.input}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Ticket Prefix (1–2 Uppercase Letters) *</Text>
                <TextInput
                  value={ticketPrefix}
                  editable={!editingOffice}
                  onChangeText={(t) => {
                    setTicketPrefix(t.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2));
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="e.g., A"
                  placeholderTextColor={Colors.inkMuted}
                  autoCapitalize="characters"
                  maxLength={2}
                  style={[styles.input, styles.monoInput]}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Location Description</Text>
                <TextInput
                  value={locationDescription}
                  onChangeText={setLocationDescription}
                  placeholder="e.g., Ground Floor, Main Building"
                  placeholderTextColor={Colors.inkMuted}
                  style={styles.input}
                />
              </View>

              <View style={styles.rowFields}>
                <View style={[styles.fieldGroup, styles.flex]}>
                  <Text style={styles.label}>Window Count (1–10)</Text>
                  <View style={styles.stepper}>
                    <Pressable
                      disabled={!!editingOffice}
                      onPress={() => setWindowCount((c) => Math.max(1, c - 1))}
                      style={styles.stepperBtn}
                    >
                      <Feather name="minus" size={15} color={Colors.ink} />
                    </Pressable>
                    <Text style={styles.stepperVal}>{windowCount}</Text>
                    <Pressable
                      disabled={!!editingOffice}
                      onPress={() => setWindowCount((c) => Math.min(10, c + 1))}
                      style={styles.stepperBtn}
                    >
                      <Feather name="plus" size={15} color={Colors.ink} />
                    </Pressable>
                  </View>
                </View>


              </View>

              {errorMsg ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.actionsRow}>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={busy}
                onPress={handleSave}
                style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}
              >
                <Text style={styles.saveText}>Save Office</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
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
    maxHeight: '86%',
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
  formScroll: {
    maxHeight: 380,
  },
  fieldGroup: {
    marginBottom: 12,
    gap: 6,
  },
  label: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 12,
    color: Colors.ink,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.lg,
    backgroundColor: Colors.surfaceSubtle,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    color: Colors.ink,
  },
  monoInput: {
    fontFamily: Fonts.monoBold,
  },
  rowFields: {
    flexDirection: 'row',
    gap: 12,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.lg,
    backgroundColor: Colors.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  stepperBtn: {
    width: 30,
    height: 30,
    borderRadius: Radii.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperVal: {
    fontFamily: Fonts.monoBold,
    fontSize: 15,
    color: Colors.ink,
  },
  errorBanner: {
    backgroundColor: Colors.dangerSoftBg,
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
    borderRadius: Radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
  },
  errorText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 12,
    color: Colors.danger,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
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
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radii.lg,
    backgroundColor: Colors.ink,
    alignItems: 'center',
  },
  saveText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    color: Colors.surface,
  },
  pressed: { opacity: 0.84 },
});
