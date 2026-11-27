import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { API_BASE_URL, API_MAX_BACKOFF_MS, API_POLLING_INTERVAL_MS } from '../config/api';
import {
  ApiResponseError,
  apiDownloadFile,
  apiFetchJson,
  getFriendlyApiError,
} from '../services/apiClient';
import {
  clearPersistedSession,
  loadPersistedSession,
  savePersistedSession,
} from '../services/sessionStorage';
import { Colors, getOfficeAccent } from '../theme/tokens';
import type {
  ActiveTicket,
  HistoryTicket,
  IssueTicketInput,
  NotificationItem,
  Office,
  StudentProfile,
} from '../types/queue';
import type {
  DeskStatus,
  ProcessedTransaction,
  StaffAccountRecord,
  StaffCounterOption,
  StaffQueueTicket,
  VerifiedTicketData,
} from '../types/staff';
import { getJwtExpiryMs, isJwtExpiringSoon } from '../utils/jwt';
import {
  computeOfficeEstimatedWaitMins,
  computeStaffWaitingEstimateMins,
  formatOfficeCrowdBadge,
  isTicketCalledOrServing,
  manilaDateString,
  normalizeActiveTicket,
} from '../utils/waitTime';

export const apiBaseUrl = API_BASE_URL;

export type LiveRole = 'student' | 'staff' | 'registrar_staff' | 'admin';

type Tokens = { idToken: string; refreshToken: string; expiresIn: string };

type Session = {
  tokens: Tokens;
  expires: number;
  role: LiveRole;
  loginId: string;
  uid?: string;
  staff?: StaffAccountRecord;
  rememberMe: boolean;
};

type StudentState = {
  profile: StudentProfile;
  activeTickets: ActiveTicket[];
  historyTickets: HistoryTicket[];
  notifications: NotificationItem[];
};

type DeskState = {
  officeId: string;
  counter: string;
  deskStatus: DeskStatus;
  servingTicket: StaffQueueTicket | null;
  waitingQueue: StaffQueueTicket[];
  transactions: ProcessedTransaction[];
};

interface CountersResponse {
  officeId: string;
  defaultCounter: string | null;
  counters: StaffCounterOption[];
}

function getOfficePillColors(
  officeId: string,
  acceptingTickets?: boolean
): { bg: string; text: string } {
  if (acceptingTickets === false) {
    return { bg: Colors.surfaceMuted, text: Colors.inkNeutral };
  }
  if (officeId === 'registrar') {
    return { bg: Colors.registrarPillBg, text: Colors.registrarPillText };
  }
  if (officeId === 'accounting') {
    return { bg: Colors.accountingPillBg, text: Colors.accountingPillText };
  }
  if (officeId === 'sao') {
    return { bg: Colors.saoPillBg, text: Colors.saoPillText };
  }
  return { bg: Colors.matchaSoftBg, text: Colors.successText };
}

function normalizeOffice(raw: Partial<Office> & { id: string }): Office {
  const name = raw.name || raw.id;
  const shortLabel = raw.shortLabel || name.replace(/\s*Office$/i, '');
  const acceptingTickets = raw.acceptingTickets !== false;
  const pillColors = getOfficePillColors(raw.id, acceptingTickets);
  const services = Array.isArray(raw.services)
    ? raw.services.filter((srv) => srv && srv.available !== false)
    : [];

  const baseOffice: Office = {
    id: raw.id,
    name,
    shortLabel,
    prefix: (raw.prefix || raw.id.slice(0, 1)).toUpperCase(),
    windowLabel: raw.windowLabel || '',
    officerName: raw.officerName || '',
    nowServing: raw.nowServing || '',
    lastIssuedNumber: raw.lastIssuedNumber ?? 0,
    waitingCount: Math.max(0, raw.waitingCount ?? 0),
    crowdBadge: '',
    themeColor: raw.themeColor || getOfficeAccent(raw.id),
    crowdPillBg: acceptingTickets ? (raw.crowdPillBg || pillColors.bg) : pillColors.bg,
    crowdPillText: acceptingTickets ? (raw.crowdPillText || pillColors.text) : pillColors.text,
    acceptingTickets,
    description: raw.description,
    services,
  };

  return {
    ...baseOffice,
    estWaitMins: computeOfficeEstimatedWaitMins(baseOffice),
    crowdBadge: formatOfficeCrowdBadge(baseOffice),
  };
}

function normalizeStudentProfile(
  raw: Partial<StudentProfile> | undefined,
  loginId: string
): StudentProfile {
  const fullName = raw?.fullName?.trim() || loginId;
  const firstName = raw?.firstName?.trim() || fullName.split(/\s+/)[0] || loginId;
  const firstLetter = (raw?.firstLetter?.trim() || firstName[0] || 'S').toUpperCase();
  const nameParts = fullName.split(/\s+/);
  const defaultHolder =
    nameParts.length > 1
      ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`
      : fullName;

  return {
    fullName,
    firstName,
    firstLetter,
    holderShort: raw?.holderShort?.trim() || defaultHolder,
    usn: raw?.usn?.trim() || loginId,
    studentId: raw?.studentId?.trim() || raw?.usn?.trim() || loginId,
    program: raw?.program?.trim() || '',
    institution: raw?.institution?.trim() || '',
    campusShort: raw?.campusShort?.trim() || '',
    email: raw?.email?.trim() || '',
    pushAlerts: raw?.pushAlerts ?? true,
    soundAndHaptics: raw?.soundAndHaptics ?? true,
  };
}

function normalizeStudentState(
  raw: {
    profile?: Partial<StudentProfile>;
    activeTickets?: ActiveTicket[];
    historyTickets?: HistoryTicket[];
    notifications?: NotificationItem[];
  },
  officeList: Office[],
  loginId: string
): StudentState {
  const officeById = new Map(officeList.map((office) => [office.id, office]));
  const profile = normalizeStudentProfile(raw.profile, loginId);
  const activeTickets = (raw.activeTickets ?? []).map((ticket) =>
    normalizeActiveTicket(ticket, officeById.get(ticket.officeId))
  );
  const historyTickets = (raw.historyTickets ?? []).map((item) => ({
    ...item,
    calledAt: item.calledAt || '—',
    counter: item.counter || '—',
  }));
  const notifications = (raw.notifications ?? []).map((item) => ({
    ...item,
    dotColor: item.dotColor || Colors.registrar,
  }));

  return { profile, activeTickets, historyTickets, notifications };
}

function normalizeDeskState(
  raw: Omit<DeskState, 'officeId'> & { officeId?: string },
  officeList: Office[],
  fallbackOfficeId?: string,
  previousTransactions: ProcessedTransaction[] = [],
  includeLogs = true
): DeskState {
  const officeId = raw.officeId || fallbackOfficeId || '';
  const office = officeList.find((item) => item.id === officeId);
  const hasServing = Boolean(raw.servingTicket);

  const waitingQueue = (raw.waitingQueue ?? []).map((ticket, index) => {
    const matchedService = office?.services.find((srv) => srv.name === ticket.serviceType);
    return {
      ...ticket,
      estWaitMins: computeStaffWaitingEstimateMins(
        index,
        hasServing,
        officeId,
        office?.name,
        matchedService?.duration
      ),
    };
  });

  return {
    officeId,
    counter: raw.counter,
    deskStatus: raw.deskStatus,
    servingTicket: raw.servingTicket ?? null,
    waitingQueue,
    transactions: includeLogs ? (raw.transactions ?? []) : previousTransactions,
  };
}

export function useLiveQueue(
  showError: (message: string) => void,
  onCalled: (ticket: ActiveTicket | null) => void,
  onTicketCompleted?: (ticketNumber: string) => void
) {
  const sessionRef = useRef<Session | null>(null);
  const [role, setRole] = useState<LiveRole | null>(null);
  const [loginId, setLoginId] = useState('');
  const [staff, setStaff] = useState<StaffAccountRecord | null>(null);
  const [counters, setCounters] = useState<StaffCounterOption[]>([]);
  const [counter, setCounter] = useState('');
  const counterRef = useRef('');
  const [desk, setDesk] = useState<DeskState | null>(null);
  const deskRef = useRef<DeskState | null>(null);
  const [student, setStudent] = useState<StudentState | null>(null);
  const [offices, setOffices] = useState<Office[]>([]);
  const officesRef = useRef<Office[]>([]);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const pendingRefresh = useRef<{ session: Session; promise: Promise<void> } | null>(null);
  const [clock, setClock] = useState(Date.now);
  const latestLoad = useRef(0);
  const seenCalled = useRef(new Map<string, number>());
  const prevActiveTickets = useRef(new Map<string, string>());
  const appStateRef = useRef<string>(AppState.currentState ?? 'active');

  const persistSession = useCallback((session: Session, selectedCounter?: string) => {
    void savePersistedSession({
      tokens: session.tokens,
      expires: session.expires,
      role: session.role,
      loginId: session.loginId,
      uid: session.uid,
      staff: session.staff,
      counter: selectedCounter ?? counterRef.current,
      rememberMe: session.rememberMe,
    });
  }, []);

  useEffect(() => {
    deskRef.current = desk;
  }, [desk]);

  useEffect(() => {
    officesRef.current = offices;
  }, [offices]);

  const signOut = useCallback(() => {
    sessionRef.current = null;
    latestLoad.current++;
    seenCalled.current.clear();
    prevActiveTickets.current.clear();
    void clearPersistedSession();
    onCalled(null);
    setRole(null);
    setLoginId('');
    setStaff(null);
    setCounters([]);
    setDesk(null);
    deskRef.current = null;
    setStudent(null);
    setOffices([]);
    officesRef.current = [];
    setCounter('');
    counterRef.current = '';
    setHasLoaded(false);
    setSyncError(null);
    setIsSyncing(false);
    setIsMutating(false);
  }, [onCalled]);

  const authorize = useCallback(
    async (session: Session, forceRefresh = false, silent = false) => {
      if (forceRefresh || isJwtExpiringSoon(session.expires, 90_000)) {
        if (pendingRefresh.current?.session !== session) {
          const promise = apiFetchJson<Tokens>('session', {
            method: 'POST',
            data: { refreshToken: session.tokens.refreshToken },
            silent,
          })
            .then((tokens) => {
              session.tokens = tokens;
              session.expires = getJwtExpiryMs(tokens.idToken, tokens.expiresIn);
              persistSession(session);
            })
            .catch((error) => {
              if (
                error instanceof ApiResponseError &&
                [401, 403].includes(error.status) &&
                sessionRef.current === session
              ) {
                signOut();
              }
              throw error;
            })
            .finally(() => {
              if (pendingRefresh.current?.session === session) {
                pendingRefresh.current = null;
              }
            });
          pendingRefresh.current = { session, promise };
        }
        await pendingRefresh.current.promise;
      }
      return session.tokens.idToken;
    },
    [persistSession, signOut]
  );

  const authedRequest = useCallback(
    async <T,>(
      session: Session,
      path: string,
      options: {
        method?: 'GET' | 'POST' | 'PATCH';
        data?: object;
        allowAuthRetry?: boolean;
        silent?: boolean;
      } = {}
    ): Promise<T> => {
      const method = options.method ?? (options.data ? 'POST' : 'GET');
      const allowRetry = options.allowAuthRetry ?? method === 'GET';
      const token = await authorize(session, false, options.silent);
      try {
        return await apiFetchJson<T>(path, {
          method,
          data: options.data,
          token,
          silent: options.silent,
        });
      } catch (error) {
        if (error instanceof ApiResponseError && error.status === 401 && allowRetry) {
          const refreshedToken = await authorize(session, true, options.silent);
          return apiFetchJson<T>(path, {
            method,
            data: options.data,
            token: refreshedToken,
            silent: options.silent,
          });
        }
        throw error;
      }
    },
    [authorize]
  );

  const fetchAllOffices = useCallback(
    async (session: Session, silent = false): Promise<Office[]> => {
      const collected: Office[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < 5; page++) {
        const query: string = cursor
          ? `offices?cursor=${encodeURIComponent(cursor)}`
          : 'offices';
        const result: { offices: Office[]; nextCursor?: string | null } =
          await authedRequest<{ offices: Office[]; nextCursor?: string | null }>(
            session,
            query,
            { silent }
          );
        for (const raw of result.offices ?? []) {
          collected.push(normalizeOffice(raw));
        }
        cursor = result.nextCursor ?? null;
        if (!cursor) break;
      }
      return collected;
    },
    [authedRequest]
  );

  const read = useCallback(
    async (
      session: Session,
      selectedCounter: string,
      options: { includeLogs?: boolean; silent?: boolean } = {}
    ) => {
      const revision = ++latestLoad.current;
      const includeLogs = options.includeLogs ?? true;
      if (!options.silent) setIsSyncing(true);

      try {
        if (session.role === 'student') {
          const [rawStudent, officeList] = await Promise.all([
            authedRequest<{
              profile: Partial<StudentProfile>;
              activeTickets: ActiveTicket[];
              historyTickets: HistoryTicket[];
              notifications: NotificationItem[];
            }>(session, 'student', { silent: options.silent }),
            fetchAllOffices(session, options.silent),
          ]);

          const normalized = normalizeStudentState(rawStudent, officeList, session.loginId);
          if (sessionRef.current === session && revision === latestLoad.current) {
            const nextIds = new Set(normalized.activeTickets.map((t) => t.id));
            for (const [prevId, prevNumber] of prevActiveTickets.current.entries()) {
              if (!nextIds.has(prevId)) {
                const completedMatch = normalized.historyTickets.find(
                  (h) => h.id === prevId && h.status === 'Completed'
                );
                if (completedMatch) {
                  onCalled(null);
                  onTicketCompleted?.(prevNumber);
                }
                seenCalled.current.delete(prevId);
              }
            }
            prevActiveTickets.current = new Map(
              normalized.activeTickets.map((t) => [t.id, t.ticketNumber])
            );

            const alertCandidate = normalized.activeTickets.find((ticket) => {
              if (!isTicketCalledOrServing(ticket)) return false;
              const prevRecall = seenCalled.current.get(ticket.id);
              const currentRecall = ticket.recallCount ?? 0;
              return prevRecall === undefined || currentRecall > prevRecall;
            });

            setStudent(normalized);
            setOffices(officeList);
            setHasLoaded(true);
            setSyncError(null);

            if (alertCandidate) {
              seenCalled.current.set(alertCandidate.id, alertCandidate.recallCount ?? 0);
              onCalled(alertCandidate);
            }
          }
          return { student: normalized };
        }

        if (session.role === 'admin') {
          const me = await authedRequest<{
            success: boolean;
            uid: string;
            role: string;
            firestoreConnected: boolean;
          }>(session, 'me', { silent: options.silent });
          session.uid = me.uid;
          if (sessionRef.current === session && revision === latestLoad.current) {
            setHasLoaded(true);
            setSyncError(null);
          }
          return {};
        }

        const queryParts = [
          selectedCounter ? `counter=${encodeURIComponent(selectedCounter)}` : '',
          includeLogs ? '' : 'includeLogs=false',
        ].filter(Boolean);
        const staffPath = queryParts.length ? `staff?${queryParts.join('&')}` : 'staff';

        const [rawDesk, officeList] = await Promise.all([
          authedRequest<Omit<DeskState, 'officeId'> & { officeId?: string }>(session, staffPath, {
            silent: options.silent,
          }),
          fetchAllOffices(session, options.silent),
        ]);

        const normalizedDesk = normalizeDeskState(
          rawDesk,
          officeList,
          session.staff?.officeId,
          deskRef.current?.transactions ?? [],
          includeLogs
        );

        if (sessionRef.current === session && revision === latestLoad.current) {
          setDesk(normalizedDesk);
          deskRef.current = normalizedDesk;
          setOffices(officeList);
          if (normalizedDesk.counter && normalizedDesk.counter !== counterRef.current) {
            counterRef.current = normalizedDesk.counter;
            setCounter(normalizedDesk.counter);
          }
          setHasLoaded(true);
          setSyncError(null);
        }
        return { desk: normalizedDesk };
      } catch (error) {
        const message = getFriendlyApiError(error);
        if (sessionRef.current === session && revision === latestLoad.current) {
          setSyncError(message);
        }
        throw error;
      } finally {
        if (!options.silent && sessionRef.current === session && revision === latestLoad.current) {
          setIsSyncing(false);
        }
      }
    },
    [authedRequest, fetchAllOffices, onCalled, onTicketCompleted]
  );

  const hydrateSession = useCallback(
    async (session: Session, preferredCounter = '', silent = false) => {
      sessionRef.current = session;
      seenCalled.current.clear();
      prevActiveTickets.current.clear();

      let resolvedStaff: StaffAccountRecord | null = session.staff ?? null;
      let selectedCounter = preferredCounter || session.staff?.defaultCounterWindow || '';

      if (session.role === 'staff' || session.role === 'registrar_staff') {
        const counterData = await authedRequest<CountersResponse>(
          session,
          'staff?view=counters',
          { silent }
        );
        const availableCounters = counterData.counters ?? [];
        setCounters(availableCounters);
        selectedCounter =
          selectedCounter ||
          counterData.defaultCounter ||
          availableCounters[0]?.id ||
          '';

        resolvedStaff = {
          staffId: session.staff?.staffId || session.loginId.toUpperCase(),
          staffName: session.staff?.staffName || session.loginId.toUpperCase(),
          office: session.staff?.office || counterData.officeId,
          officeShort:
            session.staff?.officeShort ||
            session.staff?.office ||
            counterData.officeId,
          officeId: session.staff?.officeId || counterData.officeId,
          defaultCounterWindow: selectedCounter,
          counterIds: availableCounters.map((c) => c.id),
          role: session.role,
        };
        session.staff = resolvedStaff;
      } else {
        setCounters([]);
      }

      counterRef.current = selectedCounter;
      const state = await read(session, selectedCounter, { includeLogs: true, silent });

      setCounter(counterRef.current);
      setStaff(resolvedStaff);
      setLoginId(session.loginId);
      setRole(session.role);
      persistSession(session, counterRef.current);

      return {
        role: session.role,
        name:
          resolvedStaff?.staffName ??
          state.student?.profile.firstName ??
          (session.role === 'admin' ? session.loginId.toUpperCase() : undefined),
      };
    },
    [authedRequest, persistSession, read]
  );

  const signIn = useCallback(
    async (rawLoginId: string, password: string, rememberMe = true) => {
      const cleanLoginId = rawLoginId.trim();
      const result = await apiFetchJson<
        Tokens & { role: LiveRole; staff?: StaffAccountRecord }
      >('auth', {
        method: 'POST',
        data: { action: 'sign-in', loginId: cleanLoginId, password },
      });

      const session: Session = {
        tokens: result,
        expires: getJwtExpiryMs(result.idToken, result.expiresIn),
        role: result.role,
        loginId: cleanLoginId,
        staff: result.staff,
        rememberMe,
      };

      try {
        return await hydrateSession(session, result.staff?.defaultCounterWindow ?? '', false);
      } catch (error) {
        if (sessionRef.current === session) signOut();
        throw error;
      }
    },
    [hydrateSession, signOut]
  );

  // Restore persisted JWT session automatically on mount
  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      try {
        const saved = await loadPersistedSession();
        if (!saved || cancelled) return;

        const session: Session = {
          tokens: saved.tokens,
          expires: saved.expires || getJwtExpiryMs(saved.tokens.idToken, saved.tokens.expiresIn),
          role: saved.role,
          loginId: saved.loginId,
          uid: saved.uid,
          staff: saved.staff,
          rememberMe: saved.rememberMe,
        };

        await hydrateSession(session, saved.counter ?? '', true);
      } catch (error) {
        if (error instanceof ApiResponseError && [401, 403].includes(error.status)) {
          await clearPersistedSession();
        }
        if (sessionRef.current) signOut();
      } finally {
        if (!cancelled) setIsRestoringSession(false);
      }
    };

    void restore();
    return () => {
      cancelled = true;
    };
  }, [hydrateSession, signOut]);

  // Foreground resume & serialized REST polling with exponential backoff (never overlaps)
  useEffect(() => {
    if (!role || role === 'admin') return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;
    let consecutiveFailures = 0;

    const getNextDelay = () => {
      if (consecutiveFailures <= 0) return API_POLLING_INTERVAL_MS;
      return Math.min(
        API_MAX_BACKOFF_MS,
        API_POLLING_INTERVAL_MS * Math.pow(2, Math.min(consecutiveFailures, 4))
      );
    };

    const scheduleNext = () => {
      if (cancelled) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void poll();
      }, getNextDelay());
    };

    const poll = async () => {
      if (cancelled) return;
      if (inFlight || appStateRef.current !== 'active') {
        scheduleNext();
        return;
      }
      const session = sessionRef.current;
      if (!session) return;

      inFlight = true;
      try {
        await read(session, counterRef.current, {
          includeLogs: false,
          silent: true,
        });
        consecutiveFailures = 0;
      } catch (error) {
        consecutiveFailures += 1;
        if (
          error instanceof ApiResponseError &&
          [401, 403].includes(error.status) &&
          sessionRef.current === session
        ) {
          signOut();
          showError('Your session expired. Please sign in again.');
          return;
        }
      } finally {
        inFlight = false;
        scheduleNext();
      }
    };

    scheduleNext();
    const subscription = AppState.addEventListener('change', (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;
      if (prev !== 'active' && nextState === 'active') {
        consecutiveFailures = 0;
        void poll();
      }
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      subscription.remove();
    };
  }, [read, role, showError, signOut]);

  // Live service elapsed timer on Staff Desk derived strictly from server timestamps
  useEffect(() => {
    const startRef = desk?.servingTicket?.startedAt || desk?.servingTicket?.calledAt;
    if (!startRef) return;
    setClock(Date.now());
    const interval = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [desk?.servingTicket?.startedAt, desk?.servingTicket?.calledAt]);

  const mutate = useCallback(
    async <T,>(
      path: string,
      data: object,
      options: { reloadLogs?: boolean; allowAuthRetry?: boolean } = {}
    ) => {
      const session = sessionRef.current;
      if (!session) throw new Error('Sign in to continue.');
      const selectedCounter = counterRef.current;
      setIsMutating(true);
      try {
        const result = await authedRequest<T>(session, path, {
          method: 'POST',
          data,
          allowAuthRetry: options.allowAuthRetry ?? false,
        });
        const state =
          sessionRef.current === session
            ? await read(session, counterRef.current, {
                includeLogs: options.reloadLogs ?? true,
                silent: true,
              }).catch(() => {
                showError('Saved. Refreshing latest queue data...');
                return undefined;
              })
            : undefined;
        return {
          result,
          desk: selectedCounter === counterRef.current ? state?.desk : undefined,
        };
      } catch (error) {
        if (
          error instanceof ApiResponseError &&
          error.status === 409 &&
          sessionRef.current === session
        ) {
          void read(session, counterRef.current, { includeLogs: true, silent: true }).catch(
            () => {}
          );
        }
        if (
          error instanceof ApiResponseError &&
          [401, 403].includes(error.status) &&
          path !== 'password' &&
          sessionRef.current === session
        ) {
          signOut();
        }
        throw error;
      } finally {
        setIsMutating(false);
      }
    },
    [authedRequest, read, showError, signOut]
  );

  const safely = useCallback(
    async <T,>(action: () => Promise<T>, fallback: T): Promise<T> => {
      try {
        return await action();
      } catch (error) {
        showError(getFriendlyApiError(error));
        return fallback;
      }
    },
    [showError]
  );

  const refreshNow = useCallback(
    async (includeLogs = true, silent = false) => {
      const session = sessionRef.current;
      if (!session) return;
      try {
        if (session.role === 'staff' || session.role === 'registrar_staff') {
          const counterData = await authedRequest<CountersResponse>(
            session,
            'staff?view=counters'
          );
          if (counterData?.counters) {
            setCounters(counterData.counters);
          }
        }
        await read(session, counterRef.current, { includeLogs, silent });
      } catch (error) {
        if (
          error instanceof ApiResponseError &&
          [401, 403].includes(error.status) &&
          sessionRef.current === session
        ) {
          signOut();
          showError('Your session expired. Please sign in again.');
          return;
        }
        if (!silent) {
          showError(getFriendlyApiError(error));
        }
      }
    },
    [authedRequest, read, showError, signOut]
  );

  const ensureServiceStarted = useCallback(
    async (session: Session, ticketId: string, ticketStatus?: string) => {
      if (ticketStatus !== 'called') return;
      try {
        await authedRequest(session, 'staff', {
          method: 'POST',
          data: { action: 'start', counter: counterRef.current || undefined, ticketId },
        });
      } catch (error) {
        if (!(error instanceof ApiResponseError && error.status === 409)) {
          throw error;
        }
      }
    },
    [authedRequest]
  );

  const activeTimerBase = desk?.servingTicket?.startedAt || desk?.servingTicket?.calledAt;
  const elapsed = activeTimerBase
    ? Math.max(0, Math.floor((clock - Date.parse(activeTimerBase)) / 1000))
    : 0;

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
    role,
    loginId,
    staff,
    counters,
    counter,
    desk,
    student,
    offices,
    elapsed,
    isRestoringSession,
    isSyncing,
    isMutating,
    hasLoaded,
    syncError,
    signIn,
    signOut,
    refreshNow,

    changePassword: async (currentPassword: string, newPassword: string) => {
      const session = sessionRef.current;
      if (!session) throw new Error('Sign in to continue.');
      const tokens = await authedRequest<Tokens>(session, 'password', {
        method: 'POST',
        data: { currentPassword, newPassword },
        allowAuthRetry: false,
      });
      session.tokens = tokens;
      session.expires = getJwtExpiryMs(tokens.idToken, tokens.expiresIn);
      persistSession(session);
    },

    issue: (input: IssueTicketInput) =>
      safely(async () => {
        const requestId =
          input.requestId ||
          `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
        const payload: Record<string, unknown> = {
          action: 'issue',
          officeId: input.officeId,
          requestId,
          ...(input.serviceId
            ? { serviceId: input.serviceId }
            : { serviceName: input.serviceName }),
          ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
        };
        const { result } = await mutate<{ ticket: ActiveTicket }>('student', payload, {
          allowAuthRetry: true,
        });
        const matchedOffice = officesRef.current.find((o) => o.id === input.officeId);
        return normalizeActiveTicket(result.ticket, matchedOffice);
      }, null),

    cancel: (ticketId: string, reason: string) =>
      safely(async () => {
        await mutate('student', { action: 'cancel', ticketId, reason });
        return true;
      }, false),

    acknowledge: (ticketId: string) =>
      safely(async () => {
        await mutate('student', { action: 'acknowledge', ticketId }, { allowAuthRetry: true });
        return true;
      }, false),

    preferences: (name: 'pushAlerts' | 'soundAndHaptics') =>
      safely(async () => {
        await mutate('student', {
          action: 'preferences',
          [name]: !(student?.profile[name] ?? true),
        });
      }, undefined),

    notification: (id?: string) =>
      safely(async () => {
        const session = sessionRef.current;
        if (!session) throw new Error('Sign in to continue.');
        if (id) {
          await mutate('student', { action: 'read-notification', id });
          return;
        }
        for (let batch = 0; batch < 10; batch++) {
          const res = await authedRequest<{ success: boolean; more?: boolean }>(
            session,
            'student',
            { method: 'POST', data: { action: 'read-all' } }
          );
          if (!res.more) break;
        }
        await read(session, counterRef.current, { silent: true });
      }, undefined),

    selectCounter: (value: string) => {
      const session = sessionRef.current;
      if (!session || mutationRef.current || value === counterRef.current || !counters.some((item) => item.id === value)) return;
      counterRef.current = value;
      setDesk(null);
      deskRef.current = null;
      setCounter(value);
      void safely(() => read(session, value, { includeLogs: true }), undefined);
    },

    deskAction: async (action: string, data: Record<string, unknown> = {}) => {
      const session = sessionRef.current;
      if (!session) {
        showError('Sign in to continue.');
        return null;
      }
      const ticket = deskRef.current?.servingTicket;
      const activeCounter = counterRef.current || undefined;

      return safely(async () => {
        if (action === 'complete') {
          if (!ticket) throw new Error('No active ticket to complete.');
          await ensureServiceStarted(session, ticket.id, ticket.status);
          return mutate<{ ticketId?: string | null; ticket?: StaffQueueTicket | null }>('staff', {
            action: 'complete',
            counter: activeCounter,
            ticketId: ticket.id,
            advance: Boolean(data.advance),
            ...(typeof data.remarks === 'string' && data.remarks.trim()
              ? { remarks: data.remarks.trim() }
              : {}),
          });
        }

        if (action === 'cancel') {
          if (!ticket) throw new Error('No active ticket to cancel.');
          return mutate<{ ticketId?: string | null; ticket?: StaffQueueTicket | null }>('staff', {
            action: 'cancel',
            counter: activeCounter,
            ticketId: ticket.id,
            advance: data.advance !== false,
            ...(typeof data.reason === 'string' && data.reason.trim()
              ? { reason: data.reason.trim() }
              : {}),
          });
        }

        if (action === 'skip' || action === 'no-show') {
          if (!ticket) throw new Error('No active ticket to mark as no-show.');
          const payload = {
            action: 'no-show',
            counter: activeCounter,
            ticketId: ticket.id,
            advance: data.advance !== false,
            ...(typeof data.reason === 'string' && data.reason.trim()
              ? { reason: data.reason.trim() }
              : {}),
          };
          try {
            return await mutate<{ ticketId?: string | null; ticket?: StaffQueueTicket | null }>(
              'staff',
              payload
            );
          } catch (error) {
            if (
              error instanceof ApiResponseError &&
              error.status === 409 &&
              /grace period must be configured/i.test(error.message) &&
              (deskRef.current?.officeId === 'registrar' || session.staff?.officeId === 'registrar')
            ) {
              return mutate<{ ticketId?: string | null; ticket?: StaffQueueTicket | null }>(
                'registrar',
                {
                  action: 'skip',
                  counter: activeCounter,
                  ticketId: ticket.id,
                  ...(typeof data.reason === 'string' && data.reason.trim()
                    ? { reason: data.reason.trim() }
                    : {}),
                }
              );
            }
            throw error;
          }
        }

        if (action === 'start') {
          if (!ticket) throw new Error('No called ticket to start.');
          return mutate<{ ticketId: string; status: string; startedAt: string }>('staff', {
            action: 'start',
            counter: activeCounter,
            ticketId: ticket.id,
          });
        }

        if (action === 'recall') {
          if (!ticket) throw new Error('No active ticket to recall.');
          return mutate<{ recallCount: number }>('staff', {
            action: 'recall',
            counter: activeCounter,
            ticketId: ticket.id,
            recallCount: ticket.recallCount ?? 0,
          });
        }

        if (action === 'requeue') {
          return mutate<{ ticketId: string; requeueCount: number; status: string }>('staff', {
            action: 'requeue',
            counter: activeCounter,
            ticketId: data.ticketId,
          });
        }

        if (action === 'status') {
          const response = await mutate<{ status: DeskStatus }>('staff', {
            action: 'status',
            counter: activeCounter,
            status: data.status,
          });
          const counterData = await authedRequest<CountersResponse>(
            session,
            'staff?view=counters'
          );
          if (counterData?.counters) setCounters(counterData.counters);
          return response;
        }

        return mutate<{
          recallCount?: number;
          ticketId?: string | null;
          ticket?: StaffQueueTicket | null;
        }>('staff', {
          action,
          counter: activeCounter,
          ...data,
        });
      }, null);
    },

    verify: async (
      data: { qrPayload: string } | { ticketNumber: string; usnSuffix: string }
    ): Promise<VerifiedTicketData> => {
      const session = sessionRef.current;
      if (!session) throw new Error('Sign in to continue.');
      const activeCounter = counterRef.current || undefined;

      setIsMutating(true);
      try {
        let verifiedTicket: VerifiedTicketData;
        try {
          const response = await authedRequest<{ ticket: VerifiedTicketData }>(session, 'staff', {
            method: 'POST',
            data: { action: 'verify', counter: activeCounter, ...data },
          });
          verifiedTicket = response.ticket;
        } catch (error) {
          if (
            error instanceof ApiResponseError &&
            error.status === 409 &&
            /already verified/i.test(error.message)
          ) {
            const refreshed = await read(session, counterRef.current, {
              includeLogs: true,
              silent: true,
            });
            const current = refreshed.desk?.servingTicket;
            if (current && current.isQrVerified) {
              verifiedTicket = {
                id: current.id,
                ticketNumber: current.ticketNumber,
                studentName: current.studentName,
                usn: current.usn,
                program: current.program,
                serviceType: current.serviceType,
                issuedAt: current.issuedAt,
                status: current.status,
                isQrVerified: true,
                method: 'qrPayload' in data ? 'qr_scan' : 'manual_usn_check',
              };
            } else {
              throw error;
            }
          } else {
            throw error;
          }
        }

        const ticketId = verifiedTicket.id || deskRef.current?.servingTicket?.id;
        const ticketStatus = verifiedTicket.status || deskRef.current?.servingTicket?.status;
        if (ticketId && ticketStatus === 'called') {
          await ensureServiceStarted(session, ticketId, ticketStatus);
        }

        await read(session, counterRef.current, { includeLogs: true, silent: true });
        return { ...verifiedTicket, isQrVerified: true };
      } finally {
        setIsMutating(false);
      }
    },

    downloadShiftReport: async (format: 'csv' | 'pdf'): Promise<string> => {
      const session = sessionRef.current;
      if (!session) throw new Error('Sign in to continue.');
      const today = manilaDateString(0);
      const query = [
        `format=${format}`,
        `startDate=${encodeURIComponent(today)}`,
        `endDate=${encodeURIComponent(today)}`,
        counterRef.current ? `counter=${encodeURIComponent(counterRef.current)}` : '',
      ]
        .filter(Boolean)
        .join('&');
      const token = await authorize(session, false);
      return apiDownloadFile(
        `staff?${query}`,
        token,
        `CampusQueue Shift Report (${counterRef.current || 'Counter'} • ${today})`
      );
    },

    adminRequest: async <T,>(
      query: string,
      data?: object,
      method?: 'GET' | 'POST' | 'PATCH',
      silent = false
    ): Promise<T> => {
      const session = sessionRef.current;
      if (!session) throw new Error('Sign in to continue.');
      const httpMethod = method ?? (data ? 'POST' : 'GET');
      try {
        return await authedRequest<T>(session, `admin?${query}`, {
          method: httpMethod,
          data,
          allowAuthRetry: httpMethod === 'GET',
          silent,
        });
      } catch (error) {
        if (
          error instanceof ApiResponseError &&
          [401, 403].includes(error.status) &&
          sessionRef.current === session
        ) {
          signOut();
        }
        throw error;
      }
    },

    adminDownload: async (query: string): Promise<string> => {
      const session = sessionRef.current;
      if (!session) throw new Error('Sign in to continue.');
      const token = await authorize(session, false);
      try {
        return await apiDownloadFile(`admin?${query}`, token, 'CampusQueue Analytics Report');
      } catch (error) {
        if (
          error instanceof ApiResponseError &&
          [401, 403].includes(error.status) &&
          sessionRef.current === session
        ) {
          signOut();
        }
        throw error;
      }
    },
  };
}
