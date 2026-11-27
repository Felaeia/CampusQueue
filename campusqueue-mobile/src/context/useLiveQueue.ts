import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { ApiResponseError, configuredApiUrl, createApiClient, type ApiDownload } from './apiClient';
import { readRefreshToken, writeRefreshToken } from './sessionStorage';
import type { ActiveTicket, HistoryTicket, IssueTicketInput, NotificationItem, Office, StudentProfile } from '../types/queue';
import type { DeskStatus, ProcessedTransaction, StaffAccountRecord, StaffQueueTicket, VerifiedTicketData } from '../types/staff';

const api = createApiClient(configuredApiUrl, __DEV__);
const request = <T,>(path: string, data?: object, token?: string) => api<T>(path, { data, token });

type Role = 'student' | 'staff' | 'registrar_staff' | 'admin';
type Tokens = { idToken: string; refreshToken: string; expiresIn: string | number };
type Identity = { role: Role; staff?: StaffAccountRecord; account?: { loginId?: string; fullName?: string } };
type Session = { tokens: Tokens; expires: number; remember: boolean } & Identity;
type Counter = { id: string; name: string; status: DeskStatus };
type CounterDirectory = { officeId: string; defaultCounter: string | null; counters: Counter[] };
type Scope = 'student' | 'desk' | 'logs';
const invalidSession = (error: unknown) => error instanceof ApiResponseError &&
  (error.status === 401 || (error.status === 403 && error.message === 'Account is not authorized'));
function expiry(tokens: Tokens) {
  const seconds = Number(tokens.expiresIn);
  if (!tokens.idToken || !tokens.refreshToken || !(seconds > 0)) {
    throw new Error('CampusQueue returned an invalid session.');
  }
  return Date.now() + seconds * 1000;
}
type StudentState = { profile: StudentProfile; activeTickets: ActiveTicket[]; historyTickets: HistoryTicket[]; notifications: NotificationItem[] };
type DeskTicket = StaffQueueTicket & { calledAt?: string; recallCount?: number };
type DeskState = {
  counter: string;
  deskStatus: DeskStatus;
  servingTicket: DeskTicket | null;
  waitingQueue: StaffQueueTicket[];
  transactions: (ProcessedTransaction & { isMine: boolean; durationSeconds?: number })[];
};

export function useLiveQueue(showError: (message: string) => void, onCalled: (ticket: ActiveTicket | null) => void) {
  const sessionRef = useRef<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [identity, setIdentity] = useState<Identity>();
  const pendingRestore = useRef(false);
  const [restoring, setRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState<string>();
  const [syncError, setSyncError] = useState<string>();
  const [counters, setCounters] = useState<Counter[]>([]);
  const [scope, setScope] = useState<Scope | null>(null);
  const scopeRef = useRef<Scope | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const mutationRef = useRef(false);
  const activeRead = useRef<Promise<unknown> | null>(null);
  const storageWrite = useRef(Promise.resolve());
  const persist = useCallback((token: string | null) => {
    const write = storageWrite.current.catch(() => {}).then(() => writeRefreshToken(token));
    storageWrite.current = write;
    return write;
  }, []);
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
    setIdentity(undefined);
    setCounters([]);
    setSyncError(undefined);
    setRestoreError(undefined);
    void persist(null).catch(() => showError('Could not clear the saved session on this device.'));
    setStaff(undefined);
    setDesk(undefined);
    setStudent(undefined);
    setOffices([]);
    setCounter('');
    counterRef.current = '';
  }, [onCalled, persist, showError]);

  const authorize = useCallback(async (session: Session) => {
    if (Date.now() >= session.expires - 60000) {
      if (pendingRefresh.current?.session !== session) {
        const promise = request<Tokens>('session', { refreshToken: session.tokens.refreshToken })
        .then(async (tokens) => {
          if (sessionRef.current !== session) throw new ApiResponseError('Sign in to continue.', 401);
          session.expires = expiry(tokens);
          session.tokens = tokens;
          if (session.remember) await persist(tokens.refreshToken);
        })
        .catch((error) => {
          if (invalidSession(error) && sessionRef.current === session) signOut();
          throw error;
        }).finally(() => {
          if (pendingRefresh.current?.session === session) pendingRefresh.current = null;
        });
        pendingRefresh.current = { session, promise };
      }
      await pendingRefresh.current.promise;
    }
    return session.tokens.idToken;
  }, [persist, signOut]);

  const read = useCallback(async (session: Session, selectedCounter: string, includeLogs = false, activeOnly = false) => {
    const revision = ++latestLoad.current;
    const token = await authorize(session);
    if (session.role === 'student') {
      const state = await request<Partial<StudentState>>(activeOnly ? 'student?view=active' : 'student', undefined, token);
      if (!Array.isArray(state.activeTickets) || !Array.isArray(state.notifications) ||
        (!activeOnly && (!state.profile || !Array.isArray(state.historyTickets)))) {
        throw new Error('CampusQueue returned invalid student data.');
      }
      const { activeTickets, notifications, profile, historyTickets } = state;
      if (sessionRef.current === session && revision === latestLoad.current) {
        setStudent((previous) => {
          if (profile && historyTickets) return { activeTickets, notifications, profile, historyTickets };
          return previous && { ...previous, activeTickets, notifications };
        });
        const pending = activeTickets.filter((ticket) => ticket.lifecycleStatus === 'called' && !ticket.acknowledgedAt);
        const called = pending.find((ticket) => !seenServing.current.has(ticket.id));
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
    if (!selectedCounter) return {};
    const query = new URLSearchParams({ counter: selectedCounter, includeLogs: String(includeLogs) });
    const state = await request<DeskState>('staff?' + query, undefined, token);
    if (!Array.isArray(state.waitingQueue) || !Array.isArray(state.transactions)) {
      throw new Error('CampusQueue returned invalid staff queue data.');
    }
    if (sessionRef.current === session && revision === latestLoad.current) {
      setDesk((previous) => ({ ...state, transactions: includeLogs ? state.transactions : previous?.transactions ?? [] }));
    }
    return { desk: state };
  }, [authorize, onCalled]);

  const startSession = useCallback(async (identity: Identity, tokens: Tokens, remember: boolean) => {
    if (!['student', 'staff', 'registrar_staff', 'admin'].includes(identity.role)) {
      throw new Error('This account has no supported CampusQueue role.');
    }
    const session: Session = { ...identity, tokens, remember, expires: expiry(tokens) };
    sessionRef.current = session;
    try {
      let selected = '';
      if (session.role === 'staff' || session.role === 'registrar_staff') {
        const directory = await request<CounterDirectory>('staff?view=counters', undefined, tokens.idToken);
        selected = directory.counters.find((item) => item.id === directory.defaultCounter)?.id ??
          directory.counters[0]?.id ?? '';
        setCounters(directory.counters);
      }
      if (session.role !== 'admin') {
        const directory = await request<{ offices: Office[] }>('offices', undefined, tokens.idToken);
        if (!Array.isArray(directory.offices)) throw new Error('CampusQueue returned an invalid office directory.');
        setOffices(session.role === 'student' ? directory.offices : directory.offices.filter((office) =>
          office.id === session.staff?.officeId));
      }
      counterRef.current = selected;
      const state = await read(session, selected);
      await persist(remember ? tokens.refreshToken : null);
      setCounter(selected);
      setStaff(session.staff);
      setIdentity(identity);
      setRole(session.role);
      return { role: session.role, name: identity.account?.fullName ?? session.staff?.staffName ?? state.student?.profile?.firstName };
    } catch (error) {
      if (sessionRef.current === session) {
        sessionRef.current = null;
        setCounters([]);
        setDesk(undefined);
        setStudent(undefined);
        setOffices([]);
        onCalled(null);
        if (invalidSession(error)) await persist(null);
      }
      throw error;
    }
  }, [onCalled, persist, read]);

  const signIn = useCallback(async (loginId: string, password: string, remember: boolean) => {
    const result = await request<Tokens & Identity>('auth', { action: 'sign-in', loginId, password });
    return startSession({ role: result.role, staff: result.staff, account: result.account }, result, remember);
  }, [startSession]);

  const restore = useCallback(async () => {
    if (pendingRestore.current || sessionRef.current) return;
    pendingRestore.current = true;
    setRestoring(true);
    setRestoreError(undefined);
    try {
      const refreshToken = await readRefreshToken();
      if (!refreshToken) return;
      const tokens = await request<Tokens>('session', { refreshToken });
      const identity = await request<Identity>('me', undefined, tokens.idToken);
      await startSession(identity, tokens, true);
    } catch (error) {
      if (invalidSession(error) || (error instanceof ApiResponseError && error.status === 403)) {
        await persist(null).catch(() => {});
        setRestoreError('Your session has ended. Sign in again.');
      } else {
        setRestoreError(error instanceof ApiResponseError ? error.message : 'Could not restore your session. Try again or sign in.');
      }
    } finally {
      pendingRestore.current = false;
      setRestoring(false);
    }
  }, [persist, startSession]);

  useEffect(() => {
    const timer = setTimeout(() => { void restore(); }, 0);
    return () => clearTimeout(timer);
  }, [restore]);

  const refresh = useCallback(async (requestedScope: Scope | null = scopeRef.current, refreshDirectory = true) => {
    const session = sessionRef.current;
    if (!session || !requestedScope || mutationRef.current) return;
    if (activeRead.current) await activeRead.current;
    if (sessionRef.current !== session || requestedScope !== scopeRef.current || activeRead.current || mutationRef.current) return;
    const run = (async () => {
      try {
        await read(session, counterRef.current, requestedScope === 'logs', !refreshDirectory);
        if (sessionRef.current !== session) return;
        if (refreshDirectory && requestedScope === 'student') {
          const directory = await request<{ offices: Office[] }>('offices', undefined, await authorize(session));
          if (!Array.isArray(directory.offices)) throw new Error('CampusQueue returned an invalid office directory.');
          if (sessionRef.current === session) setOffices(directory.offices);
        }
        if (sessionRef.current === session) setSyncError(undefined);
      } catch (error) {
        if (sessionRef.current !== session) return;
        if (invalidSession(error)) signOut();
        else setSyncError(error instanceof Error ? error.message : 'Could not refresh CampusQueue.');
      }
    })();
    activeRead.current = run;
    try {
      await run;
    } finally {
      if (activeRead.current === run) activeRead.current = null;
    }
  }, [authorize, read, signOut]);

  const enterScope = useCallback((next: Scope) => {
    scopeRef.current = next;
    setScope(next);
    void refresh(next);
    return () => {
      if (scopeRef.current === next) {
        scopeRef.current = null;
        setScope(null);
      }
    };
  }, [refresh]);

  useEffect(() => {
    if (!role || !scope) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => { if (timer) clearInterval(timer); timer = undefined; };
    const start = () => {
      stop();
      if (scope !== 'logs') {
        timer = setInterval(() => {
          if (!activeRead.current && !mutationRef.current) void refresh(scope, false);
        }, scope === 'desk' ? 15000 : 30000);
      }
    };
    if (AppState.currentState == null || AppState.currentState === 'active') start();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refresh(scope);
        start();
      } else stop();
    });
    return () => { stop(); subscription.remove(); };
  }, [refresh, role, scope]);

  useEffect(() => {
    if (!desk?.servingTicket?.calledAt) return;
    const interval = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [desk?.servingTicket?.calledAt]);

  const mutate = async <T,>(path: string, data: object) => {
    const session = sessionRef.current;
    if (!session) throw new Error('Sign in to continue.');
    const selectedCounter = counterRef.current;
    if (mutationRef.current) throw new ApiResponseError('An update is already in progress.', 409);
    mutationRef.current = true;
    setIsMutating(true);
    try {
      if (activeRead.current) await activeRead.current;
      if (sessionRef.current !== session) throw new ApiResponseError('Sign in to continue.', 401);
      const result = await request<T>(path, data, await authorize(session));
      const state = sessionRef.current === session
        ? await read(session, counterRef.current, scopeRef.current === 'logs').catch(() => {
          if (sessionRef.current === session) setSyncError('Saved. Refresh to retrieve the latest queue data.');
          return undefined;
        })
        : undefined;
      return { result, desk: selectedCounter === counterRef.current ? state?.desk : undefined };
    } catch (error) {
      if (invalidSession(error) && sessionRef.current === session) signOut();
      else if (error instanceof ApiResponseError && error.status === 409) {
        mutationRef.current = false;
        void refresh();
      }
      throw error;
    } finally {
      mutationRef.current = false;
      setIsMutating(false);
    }
  };

  const safely = async <T,>(action: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await action();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'CampusQueue request failed.');
      return fallback;
    }
  };

  const protectedRequest = useCallback(async <T,>(
    path: string, options: { data?: object; method?: 'GET' | 'POST' | 'PATCH'; download?: boolean } = {},
  ) => {
    const session = sessionRef.current;
    if (!session) throw new Error('Sign in to continue.');
    try {
      return await api<T>(path, { ...options, token: await authorize(session) });
    } catch (error) {
      if (invalidSession(error) && sessionRef.current === session) signOut();
      throw error;
    }
  }, [authorize, signOut]);

  const adminRequest = useCallback(<T,>(query: string, data?: object, method?: 'GET' | 'POST' | 'PATCH') =>
    protectedRequest<T>('admin?' + query, { data, method }), [protectedRequest]);
  const adminDownload = useCallback((query: string) =>
    protectedRequest<ApiDownload>('admin?' + query, { download: true }), [protectedRequest]);

  return {
    role, identity, staff, counters, counter, desk, student, offices, signIn, signOut,
    restoring, restore, restoreError, refresh, enterScope, syncError, isMutating, adminRequest, adminDownload,
    elapsed: desk?.servingTicket?.calledAt ? Math.max(0, Math.floor((clock - Date.parse(desk.servingTicket.calledAt)) / 1000)) : 0,
    changePassword: async (currentPassword: string, newPassword: string) => {
      const session = sessionRef.current;
      if (!session) throw new Error('Sign in to continue.');
      const tokens = await protectedRequest<Tokens>('password', { data: { currentPassword, newPassword } });
      if (sessionRef.current !== session) return;
      session.expires = expiry(tokens);
      session.tokens = tokens;
      if (session.remember) await persist(tokens.refreshToken);
    },
    issue: (input: IssueTicketInput) => safely(async () => {
      const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      const { result } = await mutate<{ ticket: ActiveTicket }>('student', { action: 'issue', requestId, ...input });
      return result.ticket;
    }, null),
    acknowledge: (ticketId: string) => safely(async () => {
      await mutate('student', { action: 'acknowledge', ticketId });
      return true;
    }, false),
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
      if (!session || mutationRef.current || value === counterRef.current || !counters.some((item) => item.id === value)) return;
      counterRef.current = value;
      setDesk(undefined);
      setCounter(value);
      latestLoad.current++;
      void refresh();
    },
    deskAction: async (action: string, data: object = {}) => {
      const ticket = desk?.servingTicket;
      return safely(() => mutate<{ recallCount?: number; ticketId?: string; ticket?: DeskTicket }>('staff', {
        action, counter, ticketId: ticket?.id, recallCount: ticket?.recallCount, ...data,
      }), null);
    },
    verify: async (data: { qrPayload: string } | { ticketNumber: string; usnSuffix: string }) => {
      const { result } = await mutate<{ ticket: VerifiedTicketData }>('staff', { action: 'verify', counter, ...data });
      return result.ticket;
    },
    staffDownload: (query: string) => protectedRequest<ApiDownload>('staff?' + query, { download: true }),
  };
}
