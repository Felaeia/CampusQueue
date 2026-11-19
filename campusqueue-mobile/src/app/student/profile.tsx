import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useQueue } from '../../context/QueueContext';
import { Colors, Fonts, Radii, Shadows } from '../../theme/tokens';

export default function StudentProfileScreen() {
  const router = useRouter();
  const { studentProfile, triggerHaptic } = useQueue();

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
              <Text style={styles.emailValue}>{studentProfile.email}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
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
  pressed: {
    opacity: 0.8,
  },
});
