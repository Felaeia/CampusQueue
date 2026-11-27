import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';

import { FloatingBottomNav } from '../../components/FloatingBottomNav';
import { useQueue } from '../../context/QueueContext';
import { Colors } from '../../theme/tokens';

export default function StudentLayout() {
  const { restoring, liveRole } = useQueue();
  if (restoring) return <ActivityIndicator accessibilityLabel="Restoring session" />;
  if (liveRole !== 'student') return <Redirect href="/auth/login" />;
  return (
    <View style={styles.container}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.canvas },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="home" />
        <Stack.Screen name="ticket" />
        <Stack.Screen name="history" />
        <Stack.Screen name="profile" options={{ animation: 'slide_from_right' }} />
      </Stack>
      <FloatingBottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
});
