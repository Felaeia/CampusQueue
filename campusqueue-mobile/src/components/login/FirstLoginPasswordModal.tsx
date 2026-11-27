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
import { Ionicons } from '@expo/vector-icons';

import { Colors, Fonts, Radii, Shadows } from '../../theme/tokens';

interface FirstLoginPasswordModalProps {
  visible: boolean;
  defaultPassword: string;
  minLength: number;
  onSkip: () => void;
  onUpdatePassword: (newPassword: string) => void;
}

export function FirstLoginPasswordModal(props: FirstLoginPasswordModalProps) {
  return props.visible ? <FirstLoginPasswordModalForm {...props} /> : null;
}

function FirstLoginPasswordModalForm({
  visible,
  defaultPassword,
  minLength,
  onSkip,
  onUpdatePassword,
}: FirstLoginPasswordModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorText, setErrorText] = useState('');


  const handleSubmit = () => {
    setErrorText('');
    if (newPassword.length < minLength) {
      setErrorText(`New password must be at least ${minLength} characters.`);
      return;
    }
    if (newPassword.toLowerCase() === defaultPassword.toLowerCase()) {
      setErrorText(`You cannot reuse the default password "${defaultPassword}".`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorText('Passwords do not match.');
      return;
    }
    onUpdatePassword(newPassword);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onSkip}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.backdrop}
      >
        <View style={[styles.card, Shadows.modal]}>
          <View style={styles.iconBox}>
            <Ionicons name="key-outline" size={20} color={Colors.matcha} />
          </View>

          <View>
            <Text style={styles.title}>Update Default Password</Text>
            <Text style={styles.subtitle}>
              You signed in using a default campus password. Set a personal password to protect your
              queue passes.
            </Text>
          </View>

          <View style={styles.fields}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>New Password</Text>
              <TextInput
                value={newPassword}
                onChangeText={(text) => {
                  setNewPassword(text);
                  if (errorText) setErrorText('');
                }}
                placeholder={`Min. ${minLength} characters`}
                placeholderTextColor="rgba(18, 20, 23, 0.40)"
                secureTextEntry
                autoCapitalize="none"
                style={styles.input}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Confirm New Password</Text>
              <TextInput
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (errorText) setErrorText('');
                }}
                placeholder="Re-enter new password"
                placeholderTextColor="rgba(18, 20, 23, 0.40)"
                secureTextEntry
                autoCapitalize="none"
                onSubmitEditing={handleSubmit}
                style={styles.input}
              />
            </View>

            {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={onSkip}
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryBtnText}>Skip for Now</Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            >
              <Text style={styles.primaryBtnText}>Update Password</Text>
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
    gap: 14,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: Radii.xl,
    backgroundColor: Colors.ink,
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
  fields: {
    gap: 10,
  },
  fieldGroup: {
    gap: 4,
  },
  label: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 11,
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
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 4,
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
