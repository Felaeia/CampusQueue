import React, { useEffect, useState } from 'react';
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

import { Colors, Fonts, Radii, Shadows } from '../../theme/tokens';

interface ChangePasswordModalProps {
  visible: boolean;
  currentAccountPassword: string;
  minLength: number;
  onClose: () => void;
  onSavePassword: (newPassword: string) => void;
}

export function ChangePasswordModal({
  visible,
  currentAccountPassword,
  minLength,
  onClose,
  onSavePassword,
}: ChangePasswordModalProps) {
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdErr, setPwdErr] = useState('');

  useEffect(() => {
    if (visible) {
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
      setPwdErr('');
    }
  }, [visible]);

  const handleSave = () => {
    setPwdErr('');
    if (currentPwd !== currentAccountPassword) {
      setPwdErr('Current password is incorrect.');
      return;
    }
    if (newPwd.length < minLength) {
      setPwdErr(`New password must be at least ${minLength} characters.`);
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdErr('New passwords do not match.');
      return;
    }
    onSavePassword(newPwd);
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
          <Text style={styles.title}>Change Password</Text>

          <View style={styles.fields}>
            <TextInput
              value={currentPwd}
              onChangeText={(text) => {
                setCurrentPwd(text);
                if (pwdErr) setPwdErr('');
              }}
              placeholder="Current password"
              placeholderTextColor="rgba(18, 20, 23, 0.42)"
              secureTextEntry
              autoCapitalize="none"
              style={styles.input}
            />
            <TextInput
              value={newPwd}
              onChangeText={(text) => {
                setNewPwd(text);
                if (pwdErr) setPwdErr('');
              }}
              placeholder={`New password (min ${minLength} characters)`}
              placeholderTextColor="rgba(18, 20, 23, 0.42)"
              secureTextEntry
              autoCapitalize="none"
              style={styles.input}
            />
            <TextInput
              value={confirmPwd}
              onChangeText={(text) => {
                setConfirmPwd(text);
                if (pwdErr) setPwdErr('');
              }}
              placeholder="Confirm new password"
              placeholderTextColor="rgba(18, 20, 23, 0.42)"
              secureTextEntry
              autoCapitalize="none"
              onSubmitEditing={handleSave}
              style={styles.input}
            />
            {pwdErr ? <Text style={styles.errorText}>{pwdErr}</Text> : null}
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}
            >
              <Text style={styles.saveBtnText}>Save Password</Text>
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
  title: {
    fontFamily: Fonts.displayExtraBold,
    fontSize: 18,
    letterSpacing: -0.4,
    color: Colors.ink,
  },
  fields: {
    gap: 8,
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
    paddingTop: 2,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: Radii.md,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    color: Colors.ink,
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: Radii.md,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    color: Colors.matcha,
  },
  pressed: {
    opacity: 0.85,
  },
});
