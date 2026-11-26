import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Colors, Fonts, Radii, Shadows } from '../../theme/tokens';
import { AdminServiceItem, SaveServiceInput } from '../../types/admin';

interface AddOrEditServiceModalProps {
  visible: boolean;
  parentOfficeName: string;
  editingService: AdminServiceItem | null;
  onClose: () => void;
  onSave: (input: SaveServiceInput) => { ok: boolean; error?: string };
}

export function AddOrEditServiceModal({
  visible,
  parentOfficeName,
  editingService,
  onClose,
  onSave,
}: AddOrEditServiceModalProps) {
  const [serviceName, setServiceName] = useState('');
  const [durationText, setDurationText] = useState('10');
  const [docsNote, setDocsNote] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (visible) {
      setServiceName(editingService?.name ?? '');
      setDurationText(String(editingService?.estimatedDurationMinutes ?? 10));
      setDocsNote(editingService?.requiredDocumentsNote ?? '');
      setIsActive(editingService?.isActive ?? true);
      setErrorMsg('');
    }
  }, [editingService, visible]);

  const handleSave = () => {
    const duration = parseInt(durationText.trim(), 10);
    const res = onSave({
      id: editingService?.id,
      name: serviceName,
      estimatedDurationMinutes: Number.isFinite(duration) ? duration : 0,
      requiredDocumentsNote: docsNote,
      isActive,
    });
    if (!res.ok) {
      setErrorMsg(res.error ?? 'Failed to save service.');
      return;
    }
    onClose();
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
                {editingService ? 'Edit Service' : 'Add Service'}
              </Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Feather name="x" size={18} color={Colors.inkSoft} />
              </Pressable>
            </View>

            <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
              {/* Parent Office Read-Only */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Parent Office</Text>
                <View style={styles.readOnlyBox}>
                  <Feather name="layers" size={14} color={Colors.inkSoft} />
                  <Text style={styles.readOnlyText}>{parentOfficeName}</Text>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Service Name *</Text>
                <TextInput
                  value={serviceName}
                  onChangeText={(t) => {
                    setServiceName(t);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="e.g., Transcript of Records (TOR)"
                  placeholderTextColor={Colors.inkMuted}
                  style={styles.input}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Estimated Duration (Minutes)</Text>
                <TextInput
                  value={durationText}
                  onChangeText={(t) => setDurationText(t.replace(/[^0-9]/g, ''))}
                  placeholder="10"
                  placeholderTextColor={Colors.inkMuted}
                  keyboardType="number-pad"
                  style={[styles.input, styles.monoInput]}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Required Documents Note (Optional)</Text>
                <TextInput
                  value={docsNote}
                  onChangeText={setDocsNote}
                  placeholder="e.g., Bring valid Student ID and Clearance Form"
                  placeholderTextColor={Colors.inkMuted}
                  multiline
                  numberOfLines={2}
                  style={[styles.input, styles.noteInput]}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={styles.flex}>
                  <Text style={styles.label}>Service Active</Text>
                  <Text style={styles.switchHint}>
                    Students can request tickets for active services
                  </Text>
                </View>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{ false: Colors.border, true: Colors.ink }}
                  thumbColor={isActive ? Colors.matcha : Colors.surface}
                />
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
                onPress={handleSave}
                style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}
              >
                <Text style={styles.saveText}>Save Service</Text>
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
  readOnlyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: Radii.lg,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  readOnlyText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    color: Colors.inkSoft,
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
  noteInput: {
    minHeight: 62,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 6,
    marginBottom: 8,
  },
  switchHint: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 11.5,
    color: Colors.inkSoft,
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
