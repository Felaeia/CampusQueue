import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActiveTicket, StudentProfile } from '../../types/queue';
import { Colors, Fonts, Radii } from '../../theme/tokens';
import { TactileQRCode } from '../TactileQRCode';

interface FullScreenQRModalProps {
  visible: boolean;
  ticket: ActiveTicket;
  studentProfile: StudentProfile;
  onClose: () => void;
}

export function FullScreenQRModal({
  visible,
  ticket,
  studentProfile,
  onClose,
}: FullScreenQRModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.topRow}>
          <View style={styles.brightnessBadge}>
            <Text style={styles.brightnessText}>BRIGHTNESS BOOSTED</Text>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityLabel="Close full-screen QR"
            style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
          >
            <Feather name="x" size={18} color={Colors.ink} />
          </Pressable>
        </View>

        <View style={styles.centerBlock}>
          <Text style={styles.ticketNumber}>{ticket.ticketNumber}</Text>
          <View style={styles.identityBlock}>
            <Text style={styles.studentName}>{studentProfile.fullName}</Text>
            <Text style={styles.studentId}>Student ID {studentProfile.studentId}</Text>
            <Text style={styles.studentUsn}>USN {studentProfile.usn}</Text>
          </View>

          <View style={styles.qrWrap}>
            <TactileQRCode value={ticket.serial} size={244} />
          </View>

          <Text style={styles.caption}>
            Present this QR code to the {ticket.officeName} counter scanner
          </Text>
        </View>

        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.closeCta, pressed && styles.pressed]}
        >
          <Text style={styles.closeCtaText}>Close Full-Screen Pass</Text>
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
    paddingHorizontal: 24,
    paddingVertical: 20,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brightnessBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radii.pill,
    backgroundColor: Colors.matcha,
  },
  brightnessText: {
    fontFamily: Fonts.monoBold,
    fontSize: 10.5,
    color: Colors.ink,
    fontVariant: ['tabular-nums'],
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerBlock: {
    alignItems: 'center',
    gap: 10,
  },
  ticketNumber: {
    fontFamily: Fonts.displayExtraBold,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -1.4,
    color: Colors.ink,
  },
  identityBlock: {
    alignItems: 'center',
    gap: 2,
  },
  studentName: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13.5,
    color: Colors.ink,
  },
  studentId: {
    fontFamily: Fonts.monoBold,
    fontSize: 11,
    color: Colors.inkSoft,
    fontVariant: ['tabular-nums'],
  },
  studentUsn: {
    fontFamily: Fonts.monoSemiBold,
    fontSize: 10.5,
    color: Colors.inkMuted,
    fontVariant: ['tabular-nums'],
  },
  qrWrap: {
    paddingVertical: 8,
  },
  caption: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.inkSoft,
    textAlign: 'center',
    maxWidth: 250,
  },
  closeCta: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: Radii.xl,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeCtaText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    color: Colors.surface,
  },
  pressed: {
    opacity: 0.85,
  },
});
