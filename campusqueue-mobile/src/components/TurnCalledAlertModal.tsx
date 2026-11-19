import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useQueue } from '../context/QueueContext';
import { Colors, Fonts, Radii, Shadows } from '../theme/tokens';
import { TactileQRCode } from './TactileQRCode';

export function TurnCalledAlertModal() {
  const router = useRouter();
  const {
    calledAlertTicket,
    setCalledAlertTicket,
    setSelectedTicketId,
    showToast,
    triggerHaptic,
  } = useQueue();

  if (!calledAlertTicket) return null;

  const handleOnMyWay = () => {
    const ticketId = calledAlertTicket.id;
    setCalledAlertTicket(null);
    setSelectedTicketId(ticketId);
    triggerHaptic('success');
    showToast('Counter notified: Student is on the way!', 'matcha');
    router.replace('/student/ticket');
  };

  return (
    <Modal
      visible={Boolean(calledAlertTicket)}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleOnMyWay}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, Shadows.modal]}>
          <View style={styles.badge}>
            <Ionicons name="sparkles" size={14} color={Colors.ink} />
            <Text style={styles.badgeText}>NOW SERVING AT COUNTER</Text>
          </View>

          <View style={styles.copyBlock}>
            <Text style={styles.title}>
              It&apos;s Your Turn! Ticket {calledAlertTicket.ticketNumber}
            </Text>
            <Text style={styles.subtitle}>
              Please proceed immediately to{' '}
              <Text style={styles.subtitleBold}>
                {calledAlertTicket.officeName} ({calledAlertTicket.counter})
              </Text>{' '}
              and present your QR pass.
            </Text>
          </View>

          <View style={styles.qrWrap}>
            <TactileQRCode value={calledAlertTicket.serial} size={136} />
          </View>

          <Pressable
            onPress={handleOnMyWay}
            style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaPressed]}
          >
            <Text style={styles.ctaText}>I&apos;m On My Way</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.backdropAlert,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.surface,
    borderRadius: Radii.alertModal,
    padding: 20,
    borderWidth: 2,
    borderColor: Colors.matcha,
    alignItems: 'center',
    gap: 14,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radii.pill,
    backgroundColor: Colors.matcha,
  },
  badgeText: {
    fontFamily: Fonts.monoBold,
    fontSize: 10.5,
    color: Colors.ink,
    fontVariant: ['tabular-nums'],
  },
  copyBlock: {
    alignItems: 'center',
  },
  title: {
    fontFamily: Fonts.displayExtraBold,
    fontSize: 22,
    lineHeight: 27,
    letterSpacing: -0.6,
    color: Colors.ink,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 12.5,
    lineHeight: 19,
    color: 'rgba(18, 20, 23, 0.72)',
    textAlign: 'center',
    marginTop: 6,
  },
  subtitleBold: {
    fontFamily: Fonts.bodyBold,
    color: Colors.ink,
  },
  qrWrap: {
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: Radii.xl,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  ctaText: {
    fontFamily: Fonts.displayExtraBold,
    fontSize: 13.5,
    color: Colors.matcha,
  },
});
