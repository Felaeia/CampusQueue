import React, { useEffect, useState } from 'react';
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
import { AdminOfficeRecord, AdminUserRecord, ProvisionUserInput } from '../../types/admin';

interface ProvisionStaffOrAdminModalProps {
  visible: boolean;
  offices: AdminOfficeRecord[];
  existingUsers: AdminUserRecord[];
  onClose: () => void;
  onProvision: (
    input: ProvisionUserInput & { password?: string }
  ) => { ok: boolean; error?: string } | Promise<{ ok: boolean; error?: string }>;
}

export function ProvisionStaffOrAdminModal({
  visible,
  offices,
  onClose,
  onProvision,
}: ProvisionStaffOrAdminModalProps) {
  const [role, setRole] = useState<'staff' | 'admin'>('staff');
  const [identifier, setIdentifier] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [assignedOfficeId, setAssignedOfficeId] = useState(offices[0]?.id ?? '');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (visible) {
      setRole('staff');
      setIdentifier('');
      setFullName('');
      setEmail('');
      setPassword('');
      setAssignedOfficeId(offices[0]?.id ?? '');
      setErrorMsg('');
    }
  }, [offices, visible]);

  const handleRoleChange = (nextRole: 'staff' | 'admin') => {
    setRole(nextRole);
    setErrorMsg('');
  };

  const handleSubmit = async () => {
    const res = await onProvision({
      role,
      identifier,
      fullName,
      email,
      password,
      assignedOfficeId: role === 'staff' ? assignedOfficeId : undefined,
    });
    if (!res.ok) {
      setErrorMsg(res.error ?? 'Failed to provision account.');
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
              <Text style={styles.title}>Create Authorized Personnel Account</Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Feather name="x" size={18} color={Colors.inkSoft} />
              </Pressable>
            </View>

            <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
              {/* Role Radio Selector */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Account Role</Text>
                <View style={styles.radioGroup}>
                  {(
                    [
                      { value: 'staff', label: 'School Official / Campus Staff' },
                      { value: 'admin', label: 'System Administrator' },
                    ] as const
                  ).map((opt) => {
                    const active = role === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => handleRoleChange(opt.value)}
                        style={[styles.radioCard, active && styles.radioCardActive]}
                      >
                        <View style={[styles.radioOuter, active && styles.radioOuterActive]}>
                          {active ? <View style={styles.radioInner} /> : null}
                        </View>
                        <Text style={[styles.radioLabel, active && styles.radioLabelActive]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Employee / Admin ID */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>
                  {role === 'staff' ? 'Employee ID (EMP-****) *' : 'Admin ID (ADM-***) *'}
                </Text>
                <TextInput
                  value={identifier}
                  onChangeText={(t) => {
                    setIdentifier(t.toUpperCase());
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder={role === 'staff' ? 'Enter employee ID' : 'Enter admin ID'}
                  placeholderTextColor={Colors.inkMuted}
                  autoCapitalize="characters"
                  style={[styles.input, styles.monoInput]}
                />
              </View>

              {/* Full Name */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Full Name *</Text>
                <TextInput
                  value={fullName}
                  onChangeText={(t) => {
                    setFullName(t);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="e.g., Carlo Reyes"
                  placeholderTextColor={Colors.inkMuted}
                  style={styles.input}
                />
              </View>

              {/* Institutional Email */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Institutional Email (@aclc.edu.ph) *</Text>
                <TextInput
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="carlo.reyes@aclc.edu.ph"
                  placeholderTextColor={Colors.inkMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.input}
                />
              </View>

              {/* Assigned Office (Staff only) */}
              {role === 'staff' ? (
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Assigned Campus Office *</Text>
                  <View style={styles.chipRow}>
                    {offices.map((office) => {
                      const active = assignedOfficeId === office.id;
                      return (
                        <Pressable
                          key={office.id}
                          onPress={() => setAssignedOfficeId(office.id)}
                          style={[styles.officeChip, active && styles.officeChipActive]}
                        >
                          <Text
                            style={[
                              styles.officeChipText,
                              active && styles.officeChipTextActive,
                            ]}
                          >
                            {office.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {/* Initial Password */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Initial Password (min 8 characters) *</Text>
                <TextInput
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="Enter initial password"
                  placeholderTextColor={Colors.inkMuted}
                  secureTextEntry
                  autoCapitalize="none"
                  style={styles.input}
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
                onPress={handleSubmit}
                style={({ pressed }) => [styles.createBtn, pressed && styles.pressed]}
              >
                <Text style={styles.createText}>Create Account</Text>
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
    maxHeight: '88%',
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    flex: 1,
    fontFamily: Fonts.displayBold,
    fontSize: 16,
    color: Colors.ink,
  },
  formScroll: { maxHeight: 410 },
  fieldGroup: { marginBottom: 12, gap: 6 },
  label: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 12,
    color: Colors.ink,
  },
  radioGroup: { gap: 8 },
  radioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSubtle,
  },
  radioCardActive: {
    borderColor: Colors.ink,
    backgroundColor: Colors.surface,
  },
  radioOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.inkMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: { borderColor: Colors.ink },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.ink,
  },
  radioLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12.5,
    color: Colors.inkSoft,
  },
  radioLabelActive: {
    fontFamily: Fonts.bodyBold,
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
  monoInput: { fontFamily: Fonts.monoBold },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  officeChip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSubtle,
  },
  officeChipActive: {
    backgroundColor: Colors.ink,
    borderColor: Colors.ink,
  },
  officeChipText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 11.5,
    color: Colors.inkSoft,
  },
  officeChipTextActive: { color: Colors.matcha },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.registrarHistoryBg,
    borderRadius: Radii.md,
    padding: 11,
    marginBottom: 10,
  },
  noticeText: {
    flex: 1,
    fontFamily: Fonts.bodyMedium,
    fontSize: 11.5,
    lineHeight: 16,
    color: Colors.ink,
  },
  monoInline: { fontFamily: Fonts.monoBold },
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
  actionsRow: { flexDirection: 'row', gap: 10 },
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
  createBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radii.lg,
    backgroundColor: Colors.ink,
    alignItems: 'center',
  },
  createText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    color: Colors.surface,
  },
  pressed: { opacity: 0.84 },
});
