import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CampusQueueEmblem } from '../../components/CampusQueueEmblem';
import { useQueue } from '../../context/QueueContext';
import { Colors, Fonts, Radii, Shadows } from '../../theme/tokens';

/**
 * Screen 1: Unified Login Screen (/auth/login)
 * Authenticates strictly against live `POST /api/auth` (JWT ID Token + Refresh Token).
 */
export default function LoginScreen() {
  const { liveRole, restoring } = useQueue();
  if (restoring) return <ActivityIndicator accessibilityLabel="Restoring session" style={styles.flex} />;
  if (liveRole) return <Redirect href={
    liveRole === 'admin' ? '/admin/dashboard' : liveRole === 'student' ? '/student/home' : '/staff/registrar'
  } />;
  return <LoginForm />;
}

function LoginForm() {
  const passwordInputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const { liveSignIn, liveRole, isRestoringSession, showToast, triggerHaptic } = useQueue();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [focusedField, setFocusedField] = useState<'usn' | 'password' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isRestoringSession || !liveRole) return;
    router.replace(
      liveRole === 'admin'
        ? '/admin/dashboard'
        : liveRole === 'registrar_staff' || liveRole === 'staff'
          ? '/staff/registrar'
          : '/student/home'
    );
  }, [isRestoringSession, liveRole, router]);

  const handleSignIn = async () => {
    if (isLoading || isRestoringSession) return;
    setErrorMsg('');
    const trimmedId = identifier.trim();
    if (!/^[a-z0-9_-]{1,100}$/i.test(trimmedId) || trimmedId.startsWith('__')) {
      setErrorMsg('Enter a valid USN or staff ID.');
      return;
    }
    if (!password || password.length > 128) {
      setErrorMsg('Enter your password (up to 128 characters).');
      return;
    }
    pending.current = true;
    setIsLoading(true);
    try {
      const result = await liveSignIn(trimmedId, password, rememberMe);
      triggerHaptic('success');
      if (result.name) showToast(`Welcome back, ${result.name}!`, 'matcha');
      router.replace(
        result.role === 'admin'
          ? '/admin/dashboard'
          : result.role === 'registrar_staff' || result.role === 'staff'
            ? '/staff/registrar'
            : '/student/home'
      );
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Sign-in failed.');
      triggerHaptic('warning');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
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
              <Text style={styles.brandSubtitle}>Live Campus Queue Portal</Text>
            </View>

            {/* Clean Minimal Unified Sign-In Card */}
            <View style={[styles.card, Shadows.card]}>
              {/* USN / Staff ID Input */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>USN / Staff ID</Text>
                <TextInput
                  value={identifier}
                  onChangeText={(text) => {
                    setIdentifier(text);
                    if (errorMsg) setErrorMsg('');
                  }}
                  onFocus={() => setFocusedField('usn')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Enter your USN or Staff ID"
                  placeholderTextColor="rgba(18, 20, 23, 0.40)"
                  keyboardType="default"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordInputRef.current?.focus()}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[
                    styles.input,
                    identifier.length > 0 && styles.inputMono,
                    focusedField === 'usn' && styles.inputFocused,
                  ]}
                />
              </View>

              {/* Password Input with Eye Toggle */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordWrap}>
                  <TextInput
                    ref={passwordInputRef}
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (errorMsg) setErrorMsg('');
                    }}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="Enter your password"
                    placeholderTextColor="rgba(18, 20, 23, 0.40)"
                    secureTextEntry={!showPwd}
                    returnKeyType="done"
                    onSubmitEditing={handleSignIn}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[
                      styles.input,
                      styles.passwordInput,
                      focusedField === 'password' && styles.inputFocused,
                    ]}
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
                      color={focusedField === 'password' ? Colors.ink : 'rgba(18, 20, 23, 0.48)'}
                    />
                  </Pressable>
                </View>
              </View>

              {/* Remember Me & Forgot Password Row */}
              <View style={styles.optionsRow}>
                <Pressable
                  onPress={() => setRememberMe((prev) => !prev)}
                  hitSlop={6}
                  style={styles.rememberRow}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: rememberMe }}
                >
                  <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                    {rememberMe ? <Feather name="check" size={11} color={Colors.surface} /> : null}
                  </View>
                  <Text style={styles.rememberText}>Keep me signed in</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    showToast(
                      'Contact your CampusQueue administrator to reset your password.',
                      'dark'
                    );
                  }}
                  hitSlop={6}
                >
                  <Text style={styles.forgotLink}>Forgot Password?</Text>
                </Pressable>
              </View>

              {/* Inline Error Banner */}
              {errorMsg || restoreError ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorBannerText}>{errorMsg || restoreError}</Text>
                  {restoreError && !errorMsg && <Text onPress={() => void restoreSession()}>Retry saved session</Text>}
                </View>
              ) : null}

              {/* Primary Obsidian Sign In Button */}
              <Pressable
                onPress={handleSignIn}
                disabled={isLoading || isRestoringSession}
                style={({ pressed }) => [
                  styles.signInButton,
                  (isLoading || isRestoringSession) && styles.signInButtonDisabled,
                  pressed && !isLoading && !isRestoringSession && styles.signInButtonPressed,
                ]}
              >
                {isLoading || isRestoringSession ? (
                  <ActivityIndicator size="small" color={Colors.matcha} />
                ) : null}
                <Text style={styles.signInText}>
                  {isRestoringSession
                    ? 'Restoring session...'
                    : isLoading
                      ? 'Signing in...'
                      : 'Sign In'}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 36,
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
  inputFocused: {
    borderColor: Colors.registrar,
    backgroundColor: Colors.surface,
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
