import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';

import { FloatingBottomNav } from '../../components/FloatingBottomNav';
import { useQueue } from '../../context/QueueContext';
import { Colors } from '../../theme/tokens';

export default function StudentLayout() {
  const { liveEnabled, liveRole } = useQueue();
  if (liveEnabled && liveRole !== 'student') return <Redirect href="/auth/login" />;
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
