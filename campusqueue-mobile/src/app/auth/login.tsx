import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CampusQueueEmblem } from '../../components/CampusQueueEmblem';
import { FirstLoginPasswordModal } from '../../components/login/FirstLoginPasswordModal';
import { ForgotPasswordModal } from '../../components/login/ForgotPasswordModal';
import { useQueue } from '../../context/QueueContext';
import { Colors, Fonts, Radii, Shadows } from '../../theme/tokens';

export default function LoginScreen() {
  const router = useRouter();
  const {
    authDefaults,
    studentProfile,
    accountPassword,
    mustChangePassword,
    loginResetNonce,
    updatePassword,
    showToast,
    triggerHaptic,
  } = useQueue();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberSession, setRememberSession] = useState(true);
  const [showPwd, setShowPwd] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showFirstLoginModal, setShowFirstLoginModal] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  useEffect(() => {
    setIdentifier('');
    setPassword('');
    setErrorMsg('');
    setShowPwd(false);
    setShowFirstLoginModal(false);
    setShowForgotModal(false);
  }, [loginResetNonce]);

  const handleSignIn = () => {
    setErrorMsg('');

    const trimmedUsn = identifier.trim();
    if (!trimmedUsn || !password) {
      setErrorMsg('Please enter your USN and password.');
      triggerHaptic('warning');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);

      const isValidUsn = trimmedUsn === studentProfile.usn;
      const isValidPassword = password === accountPassword;

      if (!isValidUsn || !isValidPassword) {
        setErrorMsg('Invalid USN or password. Please try again.');
        triggerHaptic('warning');
        return;
      }

      if (password === authDefaults.defaultPassword && mustChangePassword) {
        setShowFirstLoginModal(true);
        return;
      }

      triggerHaptic('success');
      showToast(`Welcome back, ${studentProfile.firstName}!`, 'matcha');
      router.replace('/student/home');
    }, 400);
  };

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
            <Text style={styles.brandSubtitle}>{studentProfile.institution}</Text>
          </View>

          {/* Sign-In Card */}
          <View style={[styles.card, Shadows.card]}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>USN</Text>
              <TextInput
                value={identifier}
                onChangeText={(text) => {
                  setIdentifier(text);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="Enter your USN"
                placeholderTextColor="rgba(18, 20, 23, 0.40)"
                keyboardType="number-pad"
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, identifier.length > 0 && styles.inputMono]}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errorMsg) setErrorMsg('');
                  }}
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

              <Pressable onPress={() => setShowForgotModal(true)} hitSlop={6}>
                <Text style={styles.forgotLink}>Forgot Password?</Text>
              </Pressable>
            </View>

            {errorMsg ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{errorMsg}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={handleSignIn}
              disabled={isLoading}
              style={({ pressed }) => [
                styles.signInButton,
                isLoading && styles.signInButtonDisabled,
                pressed && !isLoading && styles.signInButtonPressed,
              ]}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={Colors.matcha} />
              ) : null}
              <Text style={styles.signInText}>
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <FirstLoginPasswordModal
        visible={showFirstLoginModal}
        defaultPassword={authDefaults.defaultPassword}
        minLength={authDefaults.minPasswordLength}
        onSkip={() => {
          setShowFirstLoginModal(false);
          triggerHaptic('success');
          showToast(`Welcome back, ${studentProfile.firstName}!`, 'matcha');
          router.replace('/student/home');
        }}
        onUpdatePassword={(newPwd) => {
          updatePassword(newPwd);
          setShowFirstLoginModal(false);
          triggerHaptic('success');
          showToast('Password updated successfully', 'matcha');
          router.replace('/student/home');
        }}
      />

      <ForgotPasswordModal
        visible={showForgotModal}
        onClose={() => setShowForgotModal(false)}
        onSendResetLink={(email) => {
          setShowForgotModal(false);
          triggerHaptic('light');
          showToast(`Password reset link sent to ${email}`, 'dark');
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
  errorBanner: {
    borderRadius: Radii.md,
    backgroundColor: Colors.dangerSoftBg,
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorBannerText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 11.5,
    color: Colors.danger,
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
  signInButtonDisabled: {
    opacity: 0.8,
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
