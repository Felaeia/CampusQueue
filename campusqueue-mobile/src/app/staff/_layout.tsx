import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';

import { StaffBottomNav } from '../../components/staff/StaffBottomNav';
import { useQueue } from '../../context/QueueContext';
import { Colors } from '../../theme/tokens';

export default function StaffLayout() {
  const { liveRole, isRestoringSession } = useQueue();
  if (isRestoringSession) return <View style={styles.container} />;
  const isStaff = liveRole === 'staff' || liveRole === 'registrar_staff';
  if (!isStaff) return <Redirect href="/auth/login" />;
  return (
    <View style={styles.container}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.canvas },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="registrar" />
        <Stack.Screen name="logs" />
        <Stack.Screen name="scanner" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
      <StaffBottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
});
