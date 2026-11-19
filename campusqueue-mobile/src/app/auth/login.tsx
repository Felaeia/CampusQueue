import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CampusQueueEmblem } from '../../components/CampusQueueEmblem';
import { Colors, Fonts, Radii, Shadows } from '../../theme/tokens';

/**
 * Screen 1: Unified Login Screen (/auth/login)
 * Inputs strictly initialize empty per prototype specification.
 */
export default function LoginScreen() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberSession, setRememberSession] = useState(true);
  const [showPwd, setShowPwd] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* Institutional Header */}
          <View style={styles.header}>
            <CampusQueueEmblem />
            <Text style={styles.brandTitle}>CampusQueue</Text>
            <Text style={styles.brandSubtitle}>ACLC College of Mandaue</Text>
          </View>

          {/* Clean Minimal Unified Sign-In Card */}
          <View style={[styles.card, Shadows.card]}>
            {/* USN Input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>USN</Text>
              <TextInput
                value={identifier}
                onChangeText={setIdentifier}
                placeholder="Enter your USN"
                placeholderTextColor="rgba(18, 20, 23, 0.40)"
                keyboardType="number-pad"
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, styles.inputMono]}
              />
            </View>

            {/* Password Input with Eye Toggle */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor="rgba(18, 20, 23, 0.40)"
                  secureTextEntry={!showPwd}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, styles.passwordInput]}
                />
                <Pressable
                  onPress={() => setShowPwd((prev) => !prev)}
                  accessibilityLabel={showPwd ? 'Hide password' : 'Show password'}
                  hitSlop={8}
                  style={styles.eyeButton}
                >
                  <Feather
                    name={showPwd ? 'eye-off' : 'eye'}
                    size={16}
                    color="rgba(18, 20, 23, 0.48)"
                  />
                </Pressable>
              </View>
            </View>

            {/* Remember Session & Forgot Password Row */}
            <View style={styles.optionsRow}>
              <Pressable
                onPress={() => setRememberSession((prev) => !prev)}
                style={styles.rememberRow}
              >
                <View
                  style={[
                    styles.checkbox,
                    rememberSession && styles.checkboxChecked,
                  ]}
                >
                  {rememberSession ? (
                    <Feather name="check" size={11} color={Colors.surface} />
                  ) : null}
                </View>
                <Text style={styles.rememberText}>Remember session</Text>
              </Pressable>

              <Pressable onPress={() => undefined} hitSlop={6}>
                <Text style={styles.forgotLink}>Forgot Password?</Text>
              </Pressable>
            </View>

            {/* Primary Obsidian Sign In Button */}
            <Pressable
              onPress={() => undefined}
              style={({ pressed }) => [
                styles.signInButton,
                pressed && styles.signInButtonPressed,
              ]}
            >
              <Text style={styles.signInText}>Sign In</Text>
            </Pressable>
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
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 32,
  },
  container: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: 32,
  },
  header: {
    alignItems: 'center',
  },
  brandTitle: {
    fontFamily: Fonts.displayExtraBold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.9,
    color: Colors.ink,
    marginTop: 16,
  },
  brandSubtitle: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12.5,
    color: 'rgba(18, 20, 23, 0.60)',
    marginTop: 4,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.modal,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    gap: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 12,
    color: Colors.ink,
  },
  input: {
    width: '100%',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radii.lg,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    color: Colors.ink,
  },
  inputMono: {
    fontFamily: Fonts.monoMedium,
    fontVariant: ['tabular-nums'],
  },
  passwordWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 44,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.4,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.ink,
    borderColor: Colors.ink,
  },
  rememberText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    color: 'rgba(18, 20, 23, 0.75)',
  },
  forgotLink: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    color: Colors.registrar,
  },
  signInButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: Radii.lg,
    backgroundColor: Colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  signInButtonPressed: {
    backgroundColor: Colors.inkHover,
    transform: [{ scale: 0.99 }],
  },
  signInText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13.5,
    color: Colors.surface,
  },
});
