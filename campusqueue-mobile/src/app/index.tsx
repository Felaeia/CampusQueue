import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';

import { useQueue } from '../context/QueueContext';
import { Colors, Fonts } from '../theme/tokens';

export default function IndexRoute() {
  const { isRestoringSession, liveRole } = useQueue();

  if (isRestoringSession) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.ink} />
        <Text style={styles.label}>Restoring your session...</Text>
      </View>
    );
  }

  if (liveRole === 'admin') return <Redirect href="/admin/dashboard" />;
  if (liveRole === 'staff' || liveRole === 'registrar_staff') {
    return <Redirect href="/staff/registrar" />;
  }
  if (liveRole === 'student') return <Redirect href="/student/home" />;

  return <Redirect href="/auth/login" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  label: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    color: Colors.inkMuted,
  },
});
