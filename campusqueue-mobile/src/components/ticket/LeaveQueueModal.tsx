import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { ActiveTicket } from '../../types/queue';
import { Colors, Fonts, Radii, Shadows } from '../../theme/tokens';

interface LeaveQueueModalProps {
  visible: boolean;
  ticket: ActiveTicket;
  reasons: string[];
  onClose: () => void;
  onConfirmCancel: (reason: string) => void;
}

export function LeaveQueueModal({
  visible,
  ticket,
  reasons,
  onClose,
  onConfirmCancel,
}: LeaveQueueModalProps) {
  const [selectedReason, setSelectedReason] = useState(reasons[0] ?? 'No longer needed');

  useEffect(() => {
    if (visible) {
      setSelectedReason(reasons[0] ?? 'No longer needed');
    }
  }, [reasons, visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, Shadows.modal]}>
          <View style={styles.iconBox}>
            <Feather name="alert-triangle" size={20} color={Colors.danger} />
          </View>

          <View>
            <Text style={styles.title}>Cancel Ticket {ticket.ticketNumber}?</Text>
            <Text style={styles.subtitle}>
              Leaving the queue forfeits your current spot ({ticket.aheadCount} ahead). Select an
              optional reason below:
            </Text>
          </View>

          <View style={styles.reasonsList}>
            {reasons.map((reason) => {
              const selected = selectedReason === reason;
              return (
                <Pressable
                  key={reason}
                  onPress={() => setSelectedReason(reason)}
                  style={[
                    styles.reasonBtn,
                    selected ? styles.reasonBtnSelected : styles.reasonBtnDefault,
                  ]}
                >
                  <Text
                    style={[
                      styles.reasonText,
                      selected ? styles.reasonTextSelected : styles.reasonTextDefault,
                    ]}
                  >
                    {reason}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.keepBtn, pressed && styles.pressed]}
            >
              <Text style={styles.keepBtnText}>Keep My Spot</Text>
            </Pressable>
            <Pressable
              onPress={() => onConfirmCancel(selectedReason)}
              style={({ pressed }) => [styles.confirmBtn, pressed && styles.pressed]}
            >
              <Text style={styles.confirmBtnText}>Confirm Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.backdrop,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.surface,
    borderRadius: Radii.modal,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    gap: 14,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: Radii.xl,
    backgroundColor: Colors.dangerSoftBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Fonts.displayExtraBold,
    fontSize: 18,
    letterSpacing: -0.4,
    color: Colors.ink,
  },
  subtitle: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 11.5,
    lineHeight: 17,
    color: Colors.inkSoft,
    marginTop: 4,
  },
  reasonsList: {
    gap: 6,
  },
  reasonBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radii.md,
    borderWidth: 1,
  },
  reasonBtnDefault: {
    backgroundColor: Colors.surfaceSubtle,
    borderColor: 'transparent',
  },
  reasonBtnSelected: {
    backgroundColor: Colors.ink,
    borderColor: Colors.ink,
  },
  reasonText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 12,
  },
  reasonTextDefault: {
    color: Colors.ink,
  },
  reasonTextSelected: {
    color: Colors.surface,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 4,
  },
  keepBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: Radii.md,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keepBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    color: Colors.ink,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: Radii.md,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    color: Colors.surface,
  },
  pressed: {
    opacity: 0.85,
  },
});
