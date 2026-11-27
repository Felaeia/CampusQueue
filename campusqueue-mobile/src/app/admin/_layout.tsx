import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';

import { AdminBottomNav } from '../../components/admin/AdminBottomNav';
import { useQueue } from '../../context/QueueContext';
import { Colors } from '../../theme/tokens';

export default function AdminLayout() {
  const { liveRole, isRestoringSession } = useQueue();
  if (isRestoringSession) return <View style={styles.container} />;
  if (liveRole !== 'admin') return <Redirect href="/auth/login" />;

  return (
    <View style={styles.container}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.canvas },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="dashboard" />
        <Stack.Screen name="offices" />
        <Stack.Screen name="users" />
        <Stack.Screen name="reports" />
      </Stack>
      <AdminBottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
});
