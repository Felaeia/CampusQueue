import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Colors, Fonts, Radii, Shadows } from '../../theme/tokens';

interface ForgotPasswordModalProps {
  visible: boolean;
  onClose: () => void;
  onSendResetLink: (email: string) => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordModal(props: ForgotPasswordModalProps) {
  return props.visible ? <ForgotPasswordModalForm {...props} /> : null;
}

function ForgotPasswordModalForm({
  visible,
  onClose,
  onSendResetLink,
}: ForgotPasswordModalProps) {
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryError, setRecoveryError] = useState('');


  const handleSubmit = () => {
    setRecoveryError('');
    const trimmed = recoveryEmail.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setRecoveryError('Please enter a valid connected email address.');
      return;
    }
    onSendResetLink(trimmed);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.backdrop}
      >
        <View style={[styles.card, Shadows.modal]}>
          <View style={styles.topRow}>
            <View style={styles.iconBox}>
              <Feather name="mail" size={19} color={Colors.ink} />
            </View>
            <Pressable
              onPress={onClose}
              accessibilityLabel="Close modal"
              hitSlop={8}
              style={styles.closeBtn}
            >
              <Feather name="x" size={16} color="rgba(18, 20, 23, 0.70)" />
            </Pressable>
          </View>

          <View>
            <Text style={styles.title}>Reset Account Password</Text>
            <Text style={styles.subtitle}>
              Enter the email address connected to your CampusQueue account to receive a password
              reset link.
            </Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Connected Email Address</Text>
            <TextInput
              value={recoveryEmail}
              onChangeText={(text) => {
                setRecoveryEmail(text);
                if (recoveryError) setRecoveryError('');
              }}
              placeholder="name@aclc.edu.ph"
              placeholderTextColor="rgba(18, 20, 23, 0.40)"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleSubmit}
              style={styles.input}
            />
            {recoveryError ? <Text style={styles.errorText}>{recoveryError}</Text> : null}
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            >
              <Text style={styles.primaryBtnText}>Send Reset Link</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    gap: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: Radii.xl,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Fonts.displayExtraBold,
    fontSize: 19,
    letterSpacing: -0.4,
    color: Colors.ink,
  },
  subtitle: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(18, 20, 23, 0.65)',
    marginTop: 4,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 11.5,
    color: Colors.ink,
  },
  input: {
    width: '100%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radii.md,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    fontFamily: Fonts.bodyMedium,
    fontSize: 12.5,
    color: Colors.ink,
  },
  errorText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 11,
    color: Colors.danger,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 2,
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
    fontSize: 12.5,
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
    fontSize: 12.5,
    color: Colors.matcha,
  },
  pressed: {
    opacity: 0.85,
  },
});
