import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActiveTicket, HistoryTicket, IssueTicketInput, NotificationItem, Office, StudentProfile } from '../types/queue';
import type { DeskStatus, ProcessedTransaction, StaffAccountRecord, StaffQueueTicket, VerifiedTicketData } from '../types/staff';

export const liveEnabled = Boolean(process.env.EXPO_PUBLIC_CAMPUSQUEUE_API_URL);
const base = process.env.EXPO_PUBLIC_CAMPUSQUEUE_API_URL?.replace(/\/$/, '');

type Role = 'student' | 'staff' | 'registrar_staff' | 'admin';
type Tokens = { idToken: string; refreshToken: string; expiresIn: string };
type Session = { tokens: Tokens; expires: number; role: Role; staff?: StaffAccountRecord };
type StudentState = { profile: StudentProfile; activeTickets: ActiveTicket[]; historyTickets: HistoryTicket[]; notifications: NotificationItem[] };
type DeskTicket = StaffQueueTicket & { calledAt?: string; recallCount?: number };
type DeskState = {
  counter: string;
  deskStatus: DeskStatus;
  servingTicket: DeskTicket | null;
  waitingQueue: StaffQueueTicket[];
  transactions: (ProcessedTransaction & { isMine: boolean; durationSeconds?: number })[];
};

class ApiResponseError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function request<T>(path: string, data?: object, token?: string): Promise<T> {
  const response = await fetch(`${base}/api/${path}`, {
    method: data ? 'POST' : 'GET',
    headers: {
      ...(data ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  const result = await response.json();
  if (!response.ok) throw new ApiResponseError(result.error ?? 'CampusQueue request failed.', response.status);
  return result as T;
}

export function useLiveQueue(showError: (message: string) => void, onCalled: (ticket: ActiveTicket | null) => void) {
  const sessionRef = useRef<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [staff, setStaff] = useState<StaffAccountRecord>();
  const [counter, setCounter] = useState('');
  const counterRef = useRef('');
  const [desk, setDesk] = useState<DeskState>();
  const [student, setStudent] = useState<StudentState>();
  const [offices, setOffices] = useState<Office[]>([]);
  const pendingRefresh = useRef<{ session: Session; promise: Promise<void> } | null>(null);
  const [clock, setClock] = useState(Date.now);
  const latestLoad = useRef(0);
  const seenServing = useRef(new Set<string>());

  const signOut = useCallback(() => {
    sessionRef.current = null;
    latestLoad.current++;
    seenServing.current.clear();
    onCalled(null);
    setRole(null);
    setStaff(undefined);
    setDesk(undefined);
    setStudent(undefined);
    setOffices([]);
    setCounter('');
    counterRef.current = '';
  }, [onCalled]);

  const authorize = useCallback(async (session: Session) => {
    if (Date.now() >= session.expires - 60000) {
      if (pendingRefresh.current?.session !== session) {
        const promise = request<Tokens>('session', { refreshToken: session.tokens.refreshToken })
        .then((tokens) => {
          session.tokens = tokens;
          session.expires = Date.now() + Number(tokens.expiresIn) * 1000;
        })
        .catch((error) => {
          if (sessionRef.current === session) signOut();
          throw error;
        }).finally(() => {
          if (pendingRefresh.current?.session === session) pendingRefresh.current = null;
        });
        pendingRefresh.current = { session, promise };
      }
      await pendingRefresh.current.promise;
    }
    return session.tokens.idToken;
  }, [signOut]);

  const read = useCallback(async (session: Session, selectedCounter: string) => {
    const revision = ++latestLoad.current;
    const token = await authorize(session);
    if (session.role === 'student') {
      const [state, directory] = await Promise.all([
        request<StudentState>('student', undefined, token),
        request<{ offices: Office[] }>('offices', undefined, token),
      ]);
      if (sessionRef.current === session && revision === latestLoad.current) {
        setStudent(state);
        setOffices(directory.offices);
        const called = state.activeTickets.find((ticket) => ticket.status === "serving" && !seenServing.current.has(ticket.id));
        if (called) {
          seenServing.current.add(called.id);
          onCalled(called);
        }
      }
      return { student: state };
    }
    if (session.role === 'admin') {
      return {};
    }
    const state = await request<DeskState>(`registrar?counter=${encodeURIComponent(selectedCounter)}`, undefined, token);
    if (sessionRef.current === session && revision === latestLoad.current) setDesk(state);
    return { desk: state };
  }, [authorize, onCalled]);

  const signIn = async (loginId: string, password: string) => {
    const result = await request<Tokens & { role: Role; staff?: StaffAccountRecord }>(
      'auth', { action: 'sign-in', loginId, password },
    );
    const session: Session = {
      tokens: result, expires: Date.now() + Number(result.expiresIn) * 1000,
      role: result.role, staff: result.staff,
    };
    counterRef.current = result.staff?.defaultCounterWindow ?? '';
    sessionRef.current = session;
    try {
      const state = await read(session, counterRef.current);
      setCounter(counterRef.current);
      setStaff(result.staff);
      setRole(result.role);
      return { role: result.role, name: result.staff?.staffName ?? state.student?.profile.firstName };
    } catch (error) {
      if (sessionRef.current === session) signOut();
      throw error;
    }
  };

  useEffect(() => {
    if (!role) return;
    const interval = setInterval(() => {
      const session = sessionRef.current;
      if (session) void read(session, counterRef.current).catch((error) => {
        if (error instanceof ApiResponseError && [401, 403].includes(error.status) && sessionRef.current === session) signOut();
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [read, role, signOut]);

  useEffect(() => {
    if (!desk?.servingTicket?.calledAt) return;
    const interval = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [desk?.servingTicket?.calledAt]);

  const mutate = async <T,>(path: string, data: object) => {
    const session = sessionRef.current;
    if (!session) throw new Error('Sign in to continue.');
    const selectedCounter = counterRef.current;
    const result = await request<T>(path, data, await authorize(session));
    const state = sessionRef.current === session
      ? await read(session, counterRef.current).catch(() => {
        showError('Saved. Waiting for the latest queue data.');
        return undefined;
      })
      : undefined;
    return { result, desk: selectedCounter === counterRef.current ? state?.desk : undefined };
  };

  const safely = async <T,>(action: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await action();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'CampusQueue request failed.');
      return fallback;
    }
  };

  return {
    role, staff, counter, desk, student, offices, signIn, signOut,
    elapsed: desk?.servingTicket?.calledAt ? Math.max(0, Math.floor((clock - Date.parse(desk.servingTicket.calledAt)) / 1000)) : 0,
    changePassword: async (currentPassword: string, newPassword: string) => {
      const session = sessionRef.current;
      if (!session) throw new Error('Sign in to continue.');
      const tokens = await request<Tokens>('password', { currentPassword, newPassword }, await authorize(session));
      session.tokens = tokens;
      session.expires = Date.now() + Number(tokens.expiresIn) * 1000;
    },
    issue: (input: IssueTicketInput) => safely(async () => {
      const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      const { result } = await mutate<{ ticket: ActiveTicket }>('student', { action: 'issue', requestId, ...input });
      return result.ticket;
    }, null),
    cancel: (ticketId: string, reason: string) => safely(async () => {
      await mutate('student', { action: 'cancel', ticketId, reason });
      return true;
    }, false),
    preferences: (name: 'pushAlerts' | 'soundAndHaptics') => safely(async () => {
      await mutate('student', { action: 'preferences', [name]: !student?.profile[name] });
    }, undefined),
    notification: (id?: string) => safely(async () => {
      await mutate('student', id ? { action: 'read-notification', id } : { action: 'read-all' });
    }, undefined),
    selectCounter: (value: string) => {
      const session = sessionRef.current;
      if (!session || value === counterRef.current) return;
      counterRef.current = value;
      setDesk(undefined);
      setCounter(value);
      void safely(() => read(session, value), undefined);
    },
    deskAction: async (action: string, data: object = {}) => {
      const ticket = desk?.servingTicket;
      return safely(() => mutate<{ recallCount?: number; ticketId?: string }>('registrar', {
        action, counter, ticketId: ticket?.id, recallCount: ticket?.recallCount, ...data,
      }), null);
    },
    verify: async (data: { qrPayload: string } | { ticketNumber: string; usnSuffix: string }) => {
      const { result } = await mutate<{ ticket: VerifiedTicketData }>('registrar', { action: 'verify', counter, ...data });
      return result.ticket;
    },
    adminRequest: async <T,>(query: string, data?: object, method?: 'GET' | 'POST' | 'PATCH'): Promise<T> => {
      const session = sessionRef.current;
      if (!session) throw new Error('Sign in to continue.');
      const token = await authorize(session);
      const httpMethod = method ?? (data ? 'POST' : 'GET');
      const response = await fetch(`${base}/api/admin?${query}`, {
        method: httpMethod,
        headers: {
          ...(data ? { 'Content-Type': 'application/json' } : {}),
          Authorization: `Bearer ${token}`,
        },
        body: data ? JSON.stringify(data) : undefined,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        if ([401, 403].includes(response.status) && sessionRef.current === session) signOut();
        throw new ApiResponseError(result?.error ?? `Admin request failed (${response.status}).`, response.status);
      }
      return result as T;
    },
    adminDownload: async (query: string): Promise<string> => {
      const session = sessionRef.current;
      if (!session) throw new Error('Sign in to continue.');
      const token = await authorize(session);
      const response = await fetch(`${base}/api/admin?${query}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await response.text();
      if (!response.ok) {
        if ([401, 403].includes(response.status) && sessionRef.current === session) signOut();
        throw new ApiResponseError(text || `Report download failed (${response.status}).`, response.status);
      }
      return text;
    },
  };
}
