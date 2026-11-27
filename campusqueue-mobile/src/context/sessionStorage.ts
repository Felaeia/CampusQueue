import { configuredApiUrl } from '../config/api';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { apiOrigin } from './apiClient';

const key = 'campusqueue.session.v1';

export async function readRefreshToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return null;
  const saved = JSON.parse(raw);
  return saved.origin === apiOrigin(configuredApiUrl, __DEV__) && typeof saved.token === 'string'
    ? saved.token
    : null;
}

export async function writeRefreshToken(token: string | null): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!token) {
    await SecureStore.deleteItemAsync(key);
    return;
  }
  await SecureStore.setItemAsync(key, JSON.stringify({
    origin: apiOrigin(configuredApiUrl, __DEV__), token,
  }));
}
