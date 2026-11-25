import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { ActiveTicket } from '../../types/queue';
import { Colors, Fonts, Radii, Shadows } from '../../theme/tokens';

interface ActiveConflictModalProps {
  ticket: ActiveTicket | null;
  onClose: () => void;
  onViewTicket: (ticketId: string) => void;
}

export function ActiveConflictModal({ ticket, onClose, onViewTicket }: ActiveConflictModalProps) {
  if (!ticket) return null;

  return (
    <Modal
      visible={Boolean(ticket)}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, Shadows.modal]}>
          <View style={styles.iconBox}>
            <Feather name="alert-triangle" size={20} color={Colors.warningDark} />
          </View>

          <View>
            <Text style={styles.title}>Active Ticket Exists</Text>
            <Text style={styles.body}>
              You already hold active ticket{' '}
              <Text style={styles.bodyBold}>{ticket.ticketNumber}</Text> for {ticket.officeName}.
              Only one active ticket per office is allowed.
            </Text>
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryBtnText}>Close</Text>
            </Pressable>
            <Pressable
              onPress={() => onViewTicket(ticket.id)}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            >
              <Text style={styles.primaryBtnText}>View Active Ticket</Text>
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
    backgroundColor: Colors.warningSoftBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Fonts.displayExtraBold,
    fontSize: 18,
    letterSpacing: -0.4,
    color: Colors.ink,
  },
  body: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(18, 20, 23, 0.70)',
    marginTop: 4,
  },
  bodyBold: {
    fontFamily: Fonts.bodyBold,
    color: Colors.ink,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: Radii.md,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    color: Colors.ink,
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: Radii.md,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    color: Colors.matcha,
  },
  pressed: {
    opacity: 0.85,
  },
});
