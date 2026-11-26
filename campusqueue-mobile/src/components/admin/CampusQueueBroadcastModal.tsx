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
import { AdminOfficeRecord, BroadcastAudience, SendBroadcastInput } from '../../types/admin';

const AUDIENCE_OPTIONS: BroadcastAudience[] = [
  'All Active Waiting Students',
  'Specific Office Queue',
  'All Campus Staff',
];

interface CampusQueueBroadcastModalProps {
  visible: boolean;
  offices: AdminOfficeRecord[];
  onClose: () => void;
  onSend: (input: SendBroadcastInput) => { ok: boolean; error?: string };
}

export function CampusQueueBroadcastModal({
  visible,
  offices,
  onClose,
  onSend,
}: CampusQueueBroadcastModalProps) {
  const [targetAudience, setTargetAudience] = useState<BroadcastAudience>(
    'All Active Waiting Students'
  );
  const [selectedOfficeId, setSelectedOfficeId] = useState<string>(offices[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (visible) {
      setTargetAudience('All Active Waiting Students');
      setSelectedOfficeId(offices[0]?.id ?? '');
      setTitle('');
      setMessage('');
      setErrorMsg('');
    }
  }, [offices, visible]);

  const handleSubmit = () => {
    const res = onSend({
      targetAudience,
      officeId: targetAudience === 'Specific Office Queue' ? selectedOfficeId : undefined,
      title,
      message,
    });
    if (!res.ok) {
      setErrorMsg(res.error ?? 'Unable to send broadcast.');
      return;
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <Pressable style={styles.backdropTouch} onPress={onClose}>
          <Pressable style={[styles.card, Shadows.modal]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <View style={styles.iconCircle}>
                  <Feather name="radio" size={16} color={Colors.ink} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.title}>Send Campus-Wide Queue Notice</Text>
                  <Text style={styles.subtitle}>Push real-time in-app alerts to active users</Text>
                </View>
              </View>
              <Pressable onPress={onClose} hitSlop={8}>
                <Feather name="x" size={18} color={Colors.inkSoft} />
              </Pressable>
            </View>

            <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
              {/* Target Audience */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Target Audience</Text>
                <View style={styles.audienceList}>
                  {AUDIENCE_OPTIONS.map((option) => {
                    const active = targetAudience === option;
                    return (
                      <Pressable
                        key={option}
                        onPress={() => {
                          setTargetAudience(option);
                          setErrorMsg('');
                        }}
                        style={[styles.audienceOption, active && styles.audienceOptionActive]}
                      >
                        <View style={[styles.radioOuter, active && styles.radioOuterActive]}>
                          {active ? <View style={styles.radioInner} /> : null}
                        </View>
                        <Text
                          style={[
                            styles.audienceText,
                            active && styles.audienceTextActive,
                          ]}
                        >
                          {option}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Specific Office Selector */}
              {targetAudience === 'Specific Office Queue' ? (
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Select Office Queue</Text>
                  <View style={styles.officeChipRow}>
                    {offices.map((office) => {
                      const active = selectedOfficeId === office.id;
                      return (
                        <Pressable
                          key={office.id}
                          onPress={() => setSelectedOfficeId(office.id)}
                          style={[styles.officeChip, active && styles.officeChipActive]}
                        >
                          <Text
                            style={[
                              styles.officeChipText,
                              active && styles.officeChipTextActive,
                            ]}
                          >
                            {office.shortLabel} ({office.activeWaitingCount})
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {/* Alert Title */}
              <View style={styles.fieldGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Alert Title</Text>
                  <Text style={styles.charCount}>{title.length}/60</Text>
                </View>
                <TextInput
                  value={title}
                  onChangeText={(t) => {
                    setTitle(t.slice(0, 60));
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="e.g., Lunch Break Notice"
                  placeholderTextColor={Colors.inkMuted}
                  maxLength={60}
                  style={styles.input}
                />
              </View>

              {/* Alert Message */}
              <View style={styles.fieldGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Alert Message</Text>
                  <Text style={styles.charCount}>{message.length}/200</Text>
                </View>
                <TextInput
                  value={message}
                  onChangeText={(t) => {
                    setMessage(t.slice(0, 200));
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="Enter announcement details for waiting students or staff..."
                  placeholderTextColor={Colors.inkMuted}
                  maxLength={200}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  style={[styles.input, styles.textArea]}
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
                style={({ pressed }) => [styles.cancelBtn, pressed && styles.btnPressed]}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmit}
                style={({ pressed }) => [styles.sendBtn, pressed && styles.btnPressed]}
              >
                <Feather name="send" size={14} color={Colors.ink} />
                <Text style={styles.sendBtnText}>Send Broadcast</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  backdropTouch: {
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
    gap: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: Radii.pill,
    backgroundColor: Colors.matcha,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Fonts.displayBold,
    fontSize: 16,
    color: Colors.ink,
  },
  subtitle: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    color: Colors.inkSoft,
    marginTop: 2,
  },
  formScroll: {
    maxHeight: 400,
  },
  fieldGroup: {
    marginBottom: 14,
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 12,
    color: Colors.ink,
  },
  charCount: {
    fontFamily: Fonts.monoMedium,
    fontSize: 11,
    color: Colors.inkMuted,
  },
  audienceList: {
    gap: 8,
  },
  audienceOption: {
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
  audienceOptionActive: {
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
  radioOuterActive: {
    borderColor: Colors.ink,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.ink,
  },
  audienceText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    color: Colors.inkSoft,
  },
  audienceTextActive: {
    fontFamily: Fonts.bodyBold,
    color: Colors.ink,
  },
  officeChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  officeChip: {
    paddingHorizontal: 12,
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
    fontSize: 12,
    color: Colors.inkSoft,
  },
  officeChipTextActive: {
    color: Colors.matcha,
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
  textArea: {
    minHeight: 88,
  },
  errorBanner: {
    backgroundColor: Colors.dangerSoftBg,
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
    borderRadius: Radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
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
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    color: Colors.ink,
  },
  sendBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    paddingVertical: 12,
    borderRadius: Radii.lg,
    backgroundColor: Colors.matcha,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    color: Colors.ink,
  },
  btnPressed: {
    opacity: 0.85,
  },
});
