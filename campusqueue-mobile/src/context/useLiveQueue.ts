import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { API_MAX_BACKOFF_MS, configuredApiUrl } from '../config/api';
import { computeOfficeEstimatedWaitMins, computeStaffWaitingEstimateMins, formatOfficeCrowdBadge, normalizeActiveTicket } from '../utils/waitTime';
import { ApiResponseError, createApiClient, type ApiDownload } from './apiClient';
import { readRefreshToken, writeRefreshToken } from './sessionStorage';
import type { ActiveTicket, HistoryTicket, IssueTicketInput, NotificationItem, Office, StudentProfile } from '../types/queue';
import type { DeskStatus, ProcessedTransaction, StaffAccountRecord, StaffQueueTicket, VerifiedTicketData } from '../types/staff';

const api = createApiClient(configuredApiUrl, __DEV__);
const request = <T,>(path: string, data?: object, token?: string) => api<T>(path, { data, token });

export type LiveRole = 'student' | 'staff' | 'registrar_staff' | 'admin';
type Tokens = { idToken: string; refreshToken: string; expiresIn: string | number };
type Identity = { role: LiveRole; staff?: StaffAccountRecord; account?: { loginId?: string; fullName?: string } };
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
type DeskTicket = StaffQueueTicket;
type DeskState = {
  officeId: string;
  counter: string;
  deskStatus: DeskStatus;
  servingTicket: DeskTicket | null;
  waitingQueue: StaffQueueTicket[];
  transactions: (ProcessedTransaction & { isMine: boolean; durationSeconds?: number })[];
};

export function useLiveQueue(showError: (message: string) => void, onCalled: (ticket: ActiveTicket | null) => void, onCompleted: (ticketNumber: string) => void) {
  const sessionRef = useRef<Session | null>(null);
  const [role, setRole] = useState<LiveRole | null>(null);
  const [identity, setIdentity] = useState<Identity>();
  const pendingRestore = useRef(false);
  const [restoring, setRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState<string>();
  const [isSyncing, setIsSyncing] = useState(false);
  const failures = useRef(0);
  const activeNumbers = useRef(new Map<string, string>());
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
  const officesRef = useRef<Office[]>([]);
  const loadOffices = useCallback(async (session: Session, token: string) => {
    const all: Office[] = [];
    let cursor: string | undefined;
    do {
      const query = cursor ? '?cursor=' + encodeURIComponent(cursor) : '';
      const page = await request<{ offices: Office[]; nextCursor?: string }>('offices' + query, undefined, token);
      if (!Array.isArray(page.offices)) throw new Error('CampusQueue returned an invalid office directory.');
      all.push(...page.offices);
      cursor = page.nextCursor;
    } while (cursor);
    const visible = session.role === 'student' ? all : all.filter((office) => office.id === session.staff?.officeId);
    if (sessionRef.current === session) {
      const catalog = visible.map((office) => ({
        ...office, estWaitMins: computeOfficeEstimatedWaitMins(office), crowdBadge: formatOfficeCrowdBadge(office),
      }));
      officesRef.current = catalog;
      setOffices(catalog);
    }
  }, []);

  const pendingRefresh = useRef<{ session: Session; promise: Promise<void> } | null>(null);
  const [clock, setClock] = useState(Date.now);
  const latestLoad = useRef(0);
  const seenServing = useRef(new Set<string>());

  const signOut = useCallback(() => {
    sessionRef.current = null;
    latestLoad.current++;
    seenServing.current.clear();
    activeNumbers.current.clear();
    officesRef.current = [];
    failures.current = 0;
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
      let state = await request<Partial<StudentState>>(activeOnly ? 'student?view=active' : 'student', undefined, token);
      const currentTickets = state.activeTickets;
      const ticketClosed = Array.isArray(currentTickets) &&
        [...activeNumbers.current.keys()].some((id) => !currentTickets.some((ticket) => ticket.id === id));
      if (activeOnly && ticketClosed && sessionRef.current === session) {
        state = await request<StudentState>('student', undefined, token);
        activeOnly = false;
      }
      if (!Array.isArray(state.activeTickets) || !Array.isArray(state.notifications) ||
        (!activeOnly && (!state.profile || !Array.isArray(state.historyTickets)))) {
        throw new Error('CampusQueue returned invalid student data.');
      }
      const { notifications, profile, historyTickets } = state;
      const activeTickets = state.activeTickets.map((ticket) =>
        normalizeActiveTicket(ticket, officesRef.current.find((office) => office.id === ticket.officeId)));
      if (sessionRef.current === session && revision === latestLoad.current) {
        setStudent((previous) => {
          if (profile && historyTickets) return { activeTickets, notifications, profile, historyTickets };
          return previous && { ...previous, activeTickets, notifications };
        });
        if (historyTickets) {
          for (const [id, number] of activeNumbers.current) {
            if (!activeTickets.some((ticket) => ticket.id === id) &&
              historyTickets.some((ticket) => ticket.ticketNumber === number && ticket.status === 'Completed')) {
              onCompleted(number);
            }
          }
          activeNumbers.current = new Map(activeTickets.map((ticket) => [ticket.id, ticket.ticketNumber]));
        }
        const key = (ticket: ActiveTicket) => ticket.id + ':' + (ticket.calledAt ?? ticket.issuedAt);
        const called = activeTickets.find((ticket) =>
          (ticket.lifecycleStatus === 'called' || ticket.lifecycleStatus === 'serving') &&
          !ticket.acknowledgedAt && !seenServing.current.has(key(ticket)));
        if (called) {
          seenServing.current.add(key(called));
          onCalled(called);
        }
      }
      return { student: { ...state, activeTickets } };
    }
    if (session.role === 'admin') {
      return {};
    }
    if (!selectedCounter) return {};
    const query = new URLSearchParams({ counter: selectedCounter, includeLogs: String(includeLogs) });
    const raw = await request<DeskState>('staff?' + query, undefined, token);
    if (!Array.isArray(raw.waitingQueue) || !Array.isArray(raw.transactions)) {
      throw new Error('CampusQueue returned invalid staff queue data.');
    }
    const currentOffice = officesRef.current.find((office) => office.id === raw.officeId);
    const state = { ...raw, waitingQueue: raw.waitingQueue.map((ticket, index) => ({
      ...ticket, estWaitMins: computeStaffWaitingEstimateMins(index, Boolean(raw.servingTicket), raw.officeId,
        currentOffice?.name, currentOffice?.services.find((service) => service.name === ticket.serviceType)?.duration),
    })) };
    if (sessionRef.current === session && revision === latestLoad.current) {
      setDesk((previous) => ({ ...state, transactions: includeLogs ? state.transactions : previous?.transactions ?? [] }));
    }
    return { desk: state };
  }, [authorize, onCalled, onCompleted]);

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
        if (session.staff) session.staff = { ...session.staff, officeId: directory.officeId };
        setCounters(directory.counters);
      }
      if (session.role !== 'admin') await loadOffices(session, tokens.idToken);
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
  }, [loadOffices, onCalled, persist, read]);

  const signIn = useCallback(async (loginId: string, password: string, remember: boolean) => {
    const result = await request<Tokens & Identity>('auth', { action: 'sign-in', loginId, password });
    return startSession({ role: result.role, staff: result.staff, account: result.account ?? { loginId } }, result, remember);
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
    if (refreshDirectory) setIsSyncing(true);
    const run = (async () => {
      try {
        await read(session, counterRef.current, requestedScope === 'logs', !refreshDirectory);
        if (sessionRef.current !== session) return;
        if (refreshDirectory && requestedScope === 'student') await loadOffices(session, await authorize(session));
        failures.current = 0;
        if (sessionRef.current === session) setSyncError(undefined);
      } catch (error) {
        if (sessionRef.current !== session) return;
        if (invalidSession(error)) signOut();
        else {
          failures.current++;
          setSyncError(error instanceof Error ? error.message : 'Could not refresh CampusQueue.');
        }
      }
    })();
    activeRead.current = run;
    try {
      await run;
    } finally {
      if (activeRead.current === run) activeRead.current = null;
      if (refreshDirectory) setIsSyncing(false);
    }
  }, [authorize, loadOffices, read, signOut]);

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
    let timer: ReturnType<typeof setTimeout> | undefined;
    let generation = 0;
    const stop = () => { generation++; if (timer) clearTimeout(timer); };
    const start = () => {
      stop();
      if (scope === 'logs') return;
      const current = generation;
      const base = scope === 'desk' ? 15000 : 30000;
      const schedule = () => {
        timer = setTimeout(async () => {
          if (!activeRead.current && !mutationRef.current) await refresh(scope, false);
          if (current === generation) schedule();
        }, Math.min(API_MAX_BACKOFF_MS, base * 2 ** Math.min(failures.current, 3)));
      };
      schedule();
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
    restoring, restore, restoreError, refresh, enterScope, syncError, isMutating, isSyncing,
    hasLoaded: Boolean(student || desk || (role && !counter)), adminRequest, adminDownload,
    elapsed: desk?.servingTicket ? Math.max(0, Math.floor(
      (clock - Date.parse(desk.servingTicket.startedAt ?? desk.servingTicket.calledAt ?? desk.servingTicket.issuedAt)) / 1000,
    )) : 0,
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
      return normalizeActiveTicket(result.ticket, offices.find((office) => office.id === input.officeId));
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
      return true;
    }, false),
    notification: (id?: string) => safely(async () => {
      await mutate('student', id ? { action: 'read-notification', id } : { action: 'read-all' });
      return true;
    }, false),
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
