import { Platform } from 'react-native';

import type { StaffAccountRecord } from '../types/staff';

const SESSION_STORAGE_KEY = 'campusqueue.jwt.session.v1';

export interface PersistedSession {
  tokens: {
    idToken: string;
    refreshToken: string;
    expiresIn: string;
  };
  expires: number;
  role: 'student' | 'staff' | 'registrar_staff' | 'admin';
  loginId: string;
  uid?: string;
  staff?: StaffAccountRecord;
  counter?: string;
  rememberMe: boolean;
}

type WebStorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

let memoryFallback: string | null = null;

function getWebStorage(persistent: boolean): WebStorageLike | null {
  if (Platform.OS !== 'web') return null;
  try {
    const target = persistent ? globalThis.localStorage : globalThis.sessionStorage;
    return target ?? null;
  } catch {
    return null;
  }
}

export async function savePersistedSession(session: PersistedSession): Promise<void> {
  const serialized = JSON.stringify(session);
  memoryFallback = serialized;

  if (Platform.OS === 'web') {
    const primary = getWebStorage(session.rememberMe);
    const secondary = getWebStorage(!session.rememberMe);
    try {
      secondary?.removeItem(SESSION_STORAGE_KEY);
      primary?.setItem(SESSION_STORAGE_KEY, serialized);
    } catch {
      // Ignore storage quota or private browsing errors
    }
  }
}

export async function loadPersistedSession(): Promise<PersistedSession | null> {
  let raw: string | null = null;

  if (Platform.OS === 'web') {
    try {
      raw =
        getWebStorage(true)?.getItem(SESSION_STORAGE_KEY) ??
        getWebStorage(false)?.getItem(SESSION_STORAGE_KEY) ??
        null;
    } catch {
      raw = null;
    }
  }

  if (!raw) raw = memoryFallback;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedSession>;
    if (
      !parsed ||
      !parsed.tokens ||
      typeof parsed.tokens.idToken !== 'string' ||
      typeof parsed.tokens.refreshToken !== 'string' ||
      typeof parsed.role !== 'string' ||
      typeof parsed.loginId !== 'string'
    ) {
      return null;
    }
    return {
      tokens: parsed.tokens,
      expires: typeof parsed.expires === 'number' ? parsed.expires : 0,
      role: parsed.role,
      loginId: parsed.loginId,
      uid: parsed.uid,
      staff: parsed.staff,
      counter: parsed.counter,
      rememberMe: parsed.rememberMe !== false,
    };
  } catch {
    return null;
  }
}

export async function clearPersistedSession(): Promise<void> {
  memoryFallback = null;
  if (Platform.OS === 'web') {
    try {
      getWebStorage(true)?.removeItem(SESSION_STORAGE_KEY);
      getWebStorage(false)?.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }
}
