import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChangePasswordModal } from '../../components/profile/ChangePasswordModal';
import { LogoutConfirmModal } from '../../components/profile/LogoutConfirmModal';
import { useQueue } from '../../context/QueueContext';
import { Colors, Fonts, Radii, Shadows } from '../../theme/tokens';

interface TactileSwitchProps {
  value: boolean;
  onToggle: () => void;
  accessibilityLabel: string;
}

function TactileSwitch({ value, onToggle, accessibilityLabel }: TactileSwitchProps) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      style={[styles.switchTrack, value ? styles.switchTrackOn : styles.switchTrackOff]}
    >
      <View style={[styles.switchThumb, value ? styles.switchThumbOn : styles.switchThumbOff]} />
    </Pressable>
  );
}

export default function StudentProfileScreen() {
  const router = useRouter();
  const {
    minPasswordLength,
    studentProfile,
    liveChangePassword,
    togglePushAlerts,
    toggleSoundAndHaptics,
    bumpLoginReset,
    showToast,
    triggerHaptic,
  } = useQueue();

  const [showChangePwdModal, setShowChangePwdModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Bar */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => {
              triggerHaptic('light');
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/student/home');
              }
            }}
            accessibilityLabel="Back to Home"
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <Feather name="chevron-left" size={18} color={Colors.ink} />
          </Pressable>

          <Text style={styles.headerTitle}>Student Profile</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={[styles.identityCard, Shadows.heroDark]}>
          <View style={styles.identityTop}>
            <View style={styles.avatarRing}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarLetter}>{studentProfile.firstLetter}</Text>
              </View>
            </View>

            <View style={styles.identityInfo}>
              <Text style={styles.fullName} numberOfLines={1}>
                {studentProfile.fullName}
              </Text>
              <Text style={styles.programLine} numberOfLines={1}>
                {studentProfile.program} • {studentProfile.institution}
              </Text>

              <View style={styles.verifiedPill}>
                <View style={styles.verifiedDot} />
                <Text style={styles.verifiedText}>VERIFIED ACTIVE</Text>
              </View>
            </View>
          </View>

          <View style={styles.identityGrid}>
            <View style={styles.idRow}>
              <View style={styles.idCol}>
                <Text style={styles.gridLabel}>STUDENT ID</Text>
                <Text style={styles.gridValue}>{studentProfile.studentId}</Text>
              </View>
              <View style={styles.idCol}>
                <Text style={styles.gridLabel}>USN</Text>
                <Text style={styles.gridValue}>{studentProfile.usn}</Text>
              </View>
            </View>

            <View style={styles.emailBlock}>
              <Text style={styles.gridLabel}>EMAIL</Text>
              <Text style={styles.emailValue}>{studentProfile.email || 'Not provided'}</Text>
            </View>
          </View>
        </View>

        {/* Notification Preferences Card */}
        <View style={[styles.sectionCard, Shadows.card]}>
          <Text style={styles.sectionLabel}>NOTIFICATION PREFERENCES</Text>

          <View style={styles.prefRow}>
            <View style={styles.prefCopy}>
              <Text style={styles.prefTitle}>Push Notifications for Approaching Turn</Text>
              <Text style={styles.prefSubtitle}>Approaching turn &amp; called alerts</Text>
            </View>
            <TactileSwitch
              value={studentProfile.pushAlerts}
              onToggle={() => {
                triggerHaptic('light');
                togglePushAlerts();
              }}
              accessibilityLabel="Push Notifications for Approaching Turn"
            />
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.prefRow}>
            <View style={styles.prefCopy}>
              <Text style={styles.prefTitle}>Sound &amp; Vibration Alerts</Text>
              <Text style={styles.prefSubtitle}>
                Haptic feedback when your number is called
              </Text>
            </View>
            <TactileSwitch
              value={studentProfile.soundAndHaptics}
              onToggle={() => {
                triggerHaptic('light');
                toggleSoundAndHaptics();
              }}
              accessibilityLabel="Sound and Vibration Alerts"
            />
          </View>
        </View>

        {/* Account & Security Card */}
        <View style={[styles.sectionCard, Shadows.card]}>
          <Text style={styles.sectionLabel}>ACCOUNT &amp; SECURITY</Text>

          <Pressable
            onPress={() => {
              triggerHaptic('light');
              setShowChangePwdModal(true);
            }}
            style={({ pressed }) => [styles.securityRow, pressed && styles.pressed]}
          >
            <View style={styles.securityLeft}>
              <View style={styles.securityIconBox}>
                <Ionicons name="key-outline" size={16} color={Colors.ink} />
              </View>
              <View style={styles.securityCopy}>
                <Text style={styles.prefTitle}>Change Password</Text>
                <Text style={styles.prefSubtitle}>Update your CampusQueue login password</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={16} color={Colors.inkSoft} />
          </Pressable>
        </View>

        {/* Sign Out Button */}
        <Pressable
          onPress={() => {
            triggerHaptic('warning');
            setShowLogoutModal(true);
          }}
          style={({ pressed }) => [styles.signOutBtn, pressed && styles.signOutPressed]}
        >
          <Feather name="log-out" size={16} color={Colors.danger} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>

      <ChangePasswordModal
        visible={showChangePwdModal}
        minLength={minPasswordLength}
        onClose={() => setShowChangePwdModal(false)}
        onSavePassword={async (newPwd, currentPwd) => {
          await liveChangePassword(currentPwd, newPwd);
          setShowChangePwdModal(false);
          triggerHaptic('success');
          showToast('Password updated successfully', 'matcha');
        }}
      />

      <LogoutConfirmModal
        visible={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirmSignOut={() => {
          setShowLogoutModal(false);
          bumpLoginReset();
          triggerHaptic('light');
          showToast('Signed out of CampusQueue', 'dark');
          router.replace('/auth/login');
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.displayExtraBold,
    fontSize: 17,
    letterSpacing: -0.4,
    color: Colors.ink,
  },
  headerSpacer: {
    width: 36,
  },
  identityCard: {
    borderRadius: Radii.modal,
    backgroundColor: Colors.ink,
    padding: 20,
  },
  identityTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    borderColor: 'rgba(184, 242, 58, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.matcha,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: Fonts.displayExtraBold,
    fontSize: 26,
    lineHeight: 28,
    color: Colors.ink,
  },
  identityInfo: {
    flex: 1,
    minWidth: 0,
  },
  fullName: {
    fontFamily: Fonts.displayExtraBold,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.5,
    color: Colors.surface,
  },
  programLine: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 11.5,
    color: Colors.inkTabInactive,
    marginTop: 2,
  },
  verifiedPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radii.pill,
    backgroundColor: Colors.successDarkBg,
    borderWidth: 1,
    borderColor: 'rgba(184, 242, 58, 0.35)',
  },
  verifiedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.matcha,
  },
  verifiedText: {
    fontFamily: Fonts.monoBold,
    fontSize: 9.5,
    color: Colors.matcha,
    fontVariant: ['tabular-nums'],
  },
  identityGrid: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.10)',
    gap: 10,
  },
  idRow: {
    flexDirection: 'row',
    gap: 12,
  },
  idCol: {
    flex: 1,
  },
  gridLabel: {
    fontFamily: Fonts.monoSemiBold,
    fontSize: 9.5,
    letterSpacing: 0.7,
    color: 'rgba(255, 255, 255, 0.45)',
    fontVariant: ['tabular-nums'],
  },
  gridValue: {
    fontFamily: Fonts.monoBold,
    fontSize: 12,
    color: Colors.surface,
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },
  emailBlock: {
    paddingTop: 2,
  },
  emailValue: {
    fontFamily: Fonts.monoMedium,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.90)',
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 14,
  },
  sectionLabel: {
    fontFamily: Fonts.monoBold,
    fontSize: 10,
    letterSpacing: 0.7,
    color: Colors.inkSoft,
    fontVariant: ['tabular-nums'],
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  prefCopy: {
    flex: 1,
  },
  prefTitle: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    color: Colors.ink,
  },
  prefSubtitle: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 11,
    color: Colors.inkSoft,
    marginTop: 2,
  },
  cardDivider: {
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  switchTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  switchTrackOn: {
    backgroundColor: Colors.matcha,
  },
  switchTrackOff: {
    backgroundColor: 'rgba(18, 20, 23, 0.20)',
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.ink,
  },
  switchThumbOn: {
    transform: [{ translateX: 20 }],
  },
  switchThumbOff: {
    transform: [{ translateX: 0 }],
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  securityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  securityIconBox: {
    width: 36,
    height: 36,
    borderRadius: Radii.md,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityCopy: {
    flex: 1,
  },
  signOutBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: Radii.xl,
    backgroundColor: Colors.surface,
    borderWidth: 1.2,
    borderColor: Colors.dangerOutlineStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  signOutPressed: {
    backgroundColor: Colors.dangerSoftBg,
    transform: [{ scale: 0.99 }],
  },
  signOutText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    color: Colors.danger,
  },
  pressed: {
    opacity: 0.8,
  },
});
