import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import { ADMIN_POLLING_INTERVAL_MS } from '../config/api';
import {
  AdminAccount,
  AdminAuditRecord,
  AdminBroadcastRecord,
  AdminDateRange,
  AdminKpiSnapshot,
  AdminOfficeRecord,
  AdminOfficeWindow,
  AdminServiceItem,
  AdminUserRecord,
  ProvisionUserInput,
  SaveOfficeInput,
  SaveServiceInput,
  SendBroadcastInput,
} from '../types/admin';
import { calculateEstimatedWaitMinutes, manilaDateString } from '../utils/waitTime';
import { useQueue } from './QueueContext';

function rangeToDates(range: AdminDateRange): { startDate: string; endDate: string } {
  const today = manilaDateString(0);
  if (range === 'Yesterday') {
    const y = manilaDateString(-1);
    return { startDate: y, endDate: y };
  }
  if (range === 'Last 7 Days') {
    return { startDate: manilaDateString(-6), endDate: today };
  }
  if (range === 'This Month') {
    return { startDate: `${today.slice(0, 8)}01`, endDate: today };
  }
  return { startDate: today, endDate: today };
}

function formatSec(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const m = String(Math.floor(safe / 60)).padStart(2, '0');
  const s = String(safe % 60).padStart(2, '0');
  return `${m}m ${s}s`;
}

interface LiveOfficeDoc {
  id: string;
  name?: string;
  shortLabel?: string;
  prefix?: string;
  description?: string;
  acceptingTickets?: boolean;
  waitingCount?: number;
  lastIssuedNumber?: number;
  nowServing?: string;
  themeColor?: string;
  services?: { id: string; name: string; duration?: number; docs?: string; available?: boolean }[];
}

interface LiveCounterDoc {
  id: string;
  name?: string;
  status?: 'online' | 'break' | 'closed';
  assignedStaffUid?: string | null;
  staffName?: string;
  staffId?: string;
}

interface LiveAccountDoc {
  id: string;
  loginId?: string;
  staffId?: string;
  usn?: string;
  fullName?: string;
  staffName?: string;
  email?: string;
  role?: string;
  accountStatus?: string;
  archivedAt?: unknown;
  officeId?: string;
  office?: string;
  counterIds?: string[];
  defaultCounterWindow?: string;
  program?: string;
  yearLevel?: string;
}

interface LiveAnalyticsResponse {
  summary: {
    issued: number;
    completed: number;
    cancelled: number;
    noShow: number;
    legacySkipped: number;
    waiting: number;
    called: number;
    serving: number;
    averageWaitMinutes: number | null;
    averageServiceMinutes: number | null;
    completionRate: number | null;
    noShowRate: number | null;
  };
  groups: {
    office: {
      id: string;
      label: string;
      waiting: number;
      averageWaitMinutes: number | null;
    }[];
    requestType?: {
      id: string;
      label: string;
      waiting: number;
    }[];
    date: { id: string; label: string; issued: number }[];
  };
}

interface LiveActivityLogDoc {
  id: string;
  createdAt: string;
  action?: string;
  actorId?: string;
  officeId?: string;
  targetId?: string;
  ticketId?: string;
  outcome?: string;
  details?: Record<string, unknown>;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface AdminContextValue {
  activeAdmin: AdminAccount;
  isLoadingLive: boolean;
  isLoadingLogs: boolean;
  hasLoadedLive: boolean;
  liveError: string | null;
  logsError: string | null;
  logoutAdmin: () => void;
  refreshAdminData: (range?: AdminDateRange, silent?: boolean) => Promise<void>;
  fetchLiveAuditLogs: (
    startDate: string,
    endDate: string,
    officeId?: string
  ) => Promise<void>;

  // Overview & Broadcasts
  getKpiSnapshot: (range: AdminDateRange) => AdminKpiSnapshot;
  broadcasts: AdminBroadcastRecord[];
  sendBroadcast: (
    input: SendBroadcastInput
  ) => { ok: boolean; recipientCount: number; error?: string };

  // Offices & Services
  offices: AdminOfficeRecord[];
  toggleOfficeStatus: (officeId: string) => Promise<void>;
  toggleServiceStatus: (officeId: string, serviceId: string) => Promise<void>;
  saveOffice: (input: SaveOfficeInput) => Promise<ActionResult>;
  saveService: (officeId: string, input: SaveServiceInput) => Promise<ActionResult>;
  resetOfficeSequence: (officeId: string) => ActionResult;

  // Users & Roles
  users: AdminUserRecord[];
  directoryTotalBadges: { staff: number; students: number; admins: number };
  provisionUser: (input: ProvisionUserInput & { password?: string }) => Promise<ActionResult>;
  updateStaffAssignment: (
    userId: string,
    officeId: string,
    defaultWindow: string
  ) => Promise<ActionResult>;
  resetUserPassword: (userId: string, newPassword?: string) => Promise<ActionResult>;
  toggleAccountStatus: (userId: string) => Promise<ActionResult>;

  // Audit Reports
  auditRecords: AdminAuditRecord[];
  downloadAnalyticsReport: (
    startDate: string,
    endDate: string,
    format: 'csv' | 'pdf',
    officeId?: string
  ) => Promise<string | null>;
}

const AdminContext = createContext<AdminContextValue | null>(null);

function mapActivityLogsToAuditRecords(
  items: LiveActivityLogDoc[],
  officeNameById: Map<string, string>,
  staffByUid: Map<string, LiveAccountDoc>
): AdminAuditRecord[] {
  return items.map((log) => {
    const created = new Date(log.createdAt);
    const dateKey = log.createdAt.slice(0, 10);
    const timeLabel = Number.isFinite(created.valueOf())
      ? created.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
      : log.createdAt;
    const actionText = (log.action || 'event').toLowerCase();
    const outcome = actionText.includes('cancel')
      ? 'Cancelled'
      : actionText.includes('skip') || actionText.includes('no_show')
        ? 'Skipped'
        : 'Completed';
    const actorAccount = log.actorId ? staffByUid.get(log.actorId) : undefined;
    const actorIdentifier =
      actorAccount?.loginId || actorAccount?.staffId || log.actorId || 'system';
    const actorName = actorAccount?.fullName || actorAccount?.staffName || actorIdentifier;

    return {
      id: log.id,
      documentId: `activityLogs/${log.id}`,
      ticketCode: log.ticketId || log.targetId || log.id.slice(0, 8),
      dateKey,
      dateTimeLabel: `${dateKey} • ${timeLabel}`,
      officeId: log.officeId || 'campus',
      officeName:
        (log.officeId && officeNameById.get(log.officeId)) || log.officeId || 'Campus-Wide',
      serviceName: (log.action || 'System Event').replace(/_/g, ' '),
      studentName: String(log.details?.studentName ?? log.targetId ?? '—'),
      studentUsn: String(log.details?.usn ?? log.targetId ?? '—'),
      outcome,
      issuedAt: timeLabel,
      approachingAlertAt: '—',
      calledAt: '—',
      qrVerifiedAt: '—',
      closedAt: timeLabel,
      waitDurationSeconds: 0,
      serviceDurationSeconds: 0,
      waitDurationLabel: formatSec(0),
      serviceDurationLabel: formatSec(0),
      verificationMethod: actionText.includes('verified') ? 'QR Scan' : 'Manual',
      handledByStaffId: actorIdentifier,
      handledByStaffName: actorName,
      counterWindow: String(log.details?.counter ?? log.outcome ?? '—'),
    };
  });
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const {
    liveRole,
    liveLoginId,
    liveAdminRequest,
    liveAdminDownload,
    showToast,
    triggerHaptic,
  } = useQueue();

  const [isLoadingLive, setIsLoadingLive] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [hasLoadedLive, setHasLoadedLive] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [offices, setOffices] = useState<AdminOfficeRecord[]>([]);
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [broadcasts] = useState<AdminBroadcastRecord[]>([]);
  const [auditRecords, setAuditRecords] = useState<AdminAuditRecord[]>([]);
  const [liveKpis, setLiveKpis] = useState<Partial<Record<AdminDateRange, AdminKpiSnapshot>>>({});

  const staffByUidRef = useRef<Map<string, LiveAccountDoc>>(new Map());
  const officeNameByIdRef = useRef<Map<string, string>>(new Map());
  const activeRangeRef = useRef<AdminDateRange>('Today (Live)');
  const appStateRef = useRef<string>(AppState.currentState ?? 'active');
  const consecutiveFailuresRef = useRef(0);

  const isLiveAdmin = liveRole === 'admin';

  const activeAdmin = useMemo<AdminAccount>(
    () => ({
      id: liveLoginId || '',
      adminId: liveLoginId ? liveLoginId.toUpperCase() : '',
      password: '',
      fullName: 'Administrator',
      email: '',
      role: 'admin',
      institution: '',
    }),
    [liveLoginId]
  );

  const fetchAllAdminPages = useCallback(
    async <T,>(baseQuery: string, maxPages = 5, silent = false): Promise<T[]> => {
      const items: T[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < maxPages; page++) {
        const query: string = cursor
          ? `${baseQuery}&cursor=${encodeURIComponent(cursor)}`
          : baseQuery;
        const response: { items?: T[]; nextCursor?: string | null } =
          await liveAdminRequest<{ items?: T[]; nextCursor?: string | null }>(
            query,
            undefined,
            'GET',
            silent
          );
        if (Array.isArray(response.items)) {
          items.push(...response.items);
        }
        cursor = response.nextCursor ?? null;
        if (!cursor) break;
      }
      return items;
    },
    [liveAdminRequest]
  );

  const refreshAdminData = useCallback(
    async (range: AdminDateRange = activeRangeRef.current, silent = false) => {
      if (!isLiveAdmin) return;
      activeRangeRef.current = range;
      if (!silent) setIsLoadingLive(true);
      setLiveError(null);

      try {
        const { startDate, endDate } = rangeToDates(range);

        // Wave 1: Core telemetry (offices + analytics) — silent=true prevents LogBox RedBox spam on transient timeouts
        const [officesSettled, analyticsSettled] = await Promise.allSettled([
          fetchAllAdminPages<LiveOfficeDoc>('resource=offices&limit=100', 3, true),
          liveAdminRequest<LiveAnalyticsResponse>(
            `resource=analytics&startDate=${startDate}&endDate=${endDate}`,
            undefined,
            'GET',
            true
          ),
        ]);

        // Wave 2: Directory accounts + recent activity logs (staggered to avoid saturating local dev/Firestore connections)
        const [staffSettled, studentsSettled, logsSettled] = await Promise.allSettled([
          fetchAllAdminPages<LiveAccountDoc>('resource=staff&archived=true&limit=100', 3, true),
          fetchAllAdminPages<LiveAccountDoc>('resource=students&archived=true&limit=100', 3, true),
          fetchAllAdminPages<LiveActivityLogDoc>(
            `resource=activity-logs&startDate=${startDate}&endDate=${endDate}&limit=50`,
            1,
            true
          ),
        ]);

        const officeDocs =
          officesSettled.status === 'fulfilled' ? officesSettled.value : [];
        const staffDocs =
          staffSettled.status === 'fulfilled' ? staffSettled.value : [];
        const studentDocs =
          studentsSettled.status === 'fulfilled' ? studentsSettled.value : [];
        const analyticsRes: LiveAnalyticsResponse =
          analyticsSettled.status === 'fulfilled'
            ? analyticsSettled.value
            : {
                summary: {
                  issued: 0,
                  completed: 0,
                  cancelled: 0,
                  noShow: 0,
                  legacySkipped: 0,
                  waiting: 0,
                  called: 0,
                  serving: 0,
                  averageWaitMinutes: null,
                  averageServiceMinutes: null,
                  completionRate: null,
                  noShowRate: null,
                },
                groups: { office: [], requestType: [], date: [] },
              };
        const logDocs =
          logsSettled.status === 'fulfilled' ? logsSettled.value : [];

        const coreSettled = [officesSettled, staffSettled, studentsSettled, analyticsSettled];
        const firstRejection = [...coreSettled, logsSettled].find((r) => r.status === 'rejected');
        if (firstRejection && firstRejection.status === 'rejected') {
          consecutiveFailuresRef.current += 1;
          const reason = firstRejection.reason;
          setLiveError(
            reason instanceof Error ? reason.message : 'Unable to sync campus telemetry.'
          );
        } else {
          consecutiveFailuresRef.current = 0;
        }

        const staffByUid = new Map(staffDocs.map((doc) => [doc.id, doc]));
        staffByUidRef.current = staffByUid;

        const officeMetricsMap = new Map(
          analyticsRes.groups.office.map((g) => [g.id, g])
        );
        const requestTypeWaitingMap = new Map(
          (analyticsRes.groups.requestType ?? []).map((g) => [g.id, g.waiting])
        );

        // Wave 3: Hydrate counters & services per office sequentially so we don't burst concurrent connections
        const hydratedOffices: AdminOfficeRecord[] = [];
        for (const o of officeDocs) {
          const [countersRes, servicesRes] = await Promise.all([
            fetchAllAdminPages<LiveCounterDoc>(
              `resource=counters&officeId=${encodeURIComponent(o.id)}&limit=100`,
              2,
              true
            ).catch(() => [] as LiveCounterDoc[]),
            liveAdminRequest<{
              items: {
                id: string;
                name: string;
                duration?: number;
                docs?: string;
                available?: boolean;
              }[];
            }>(`resource=request-types&officeId=${encodeURIComponent(o.id)}`, undefined, 'GET', true).catch(
              () => ({
                items: o.services ?? [],
              })
            ),
          ]);

          const officeStaff = staffDocs.filter(
            (s) => s.officeId === o.id && s.accountStatus !== 'archived' && !s.archivedAt
          );

          const windows: AdminOfficeWindow[] = countersRes.map((c) => {
            const assignedByUid = c.assignedStaffUid
              ? staffByUid.get(c.assignedStaffUid)
              : undefined;
            const fallbackStaff = officeStaff.find(
              (s) =>
                s.defaultCounterWindow === c.id ||
                s.defaultCounterWindow === c.name ||
                s.counterIds?.includes(c.id)
            );
            const matchedStaff = assignedByUid ?? fallbackStaff;

            return {
              label: c.name || c.id,
              status:
                c.status === 'online' ? 'Online' : c.status === 'break' ? 'Break' : 'Closed',
              staffName: c.staffName || matchedStaff?.fullName || matchedStaff?.staffName,
              staffId: c.staffId || matchedStaff?.loginId || matchedStaff?.staffId,
            };
          });

          const services: AdminServiceItem[] = (
            servicesRes.items.length ? servicesRes.items : (o.services ?? [])
          ).map((s) => ({
            id: s.id,
            name: s.name,
            estimatedDurationMinutes: s.duration ?? 0,
            requiredDocumentsNote: s.docs ?? '',
            isActive: s.available !== false,
            waitingCount:
              requestTypeWaitingMap.get(`${o.id}/${s.id}`) ??
              requestTypeWaitingMap.get(`${o.id}/${s.name}`) ??
              0,
          }));

          const officeMetric = officeMetricsMap.get(o.id);
          const activeWaitingCount = Math.max(
            0,
            o.waitingCount ?? officeMetric?.waiting ?? 0
          );
          const liveEstimatedWait = calculateEstimatedWaitMinutes({
            officeId: o.id,
            officeName: o.name,
            peopleAhead:
              activeWaitingCount + (o.nowServing && o.nowServing.trim() ? 1 : 0),
            backendEstimate: officeMetric?.averageWaitMinutes,
          });

          hydratedOffices.push({
            id: o.id,
            name: o.name || o.id,
            shortLabel: o.shortLabel || (o.name || o.id).replace(' Office', ''),
            prefix: (o.prefix || o.id.slice(0, 1)).toUpperCase(),
            status: o.acceptingTickets === false ? 'closed' : 'open',
            operatingHours: '',
            locationDescription: o.description || '',
            windowCount: windows.length,
            lastIssuedNumber: o.lastIssuedNumber ?? 0,
            activeWaitingCount,
            avgWaitMinutes:
              officeMetric?.averageWaitMinutes != null && officeMetric.averageWaitMinutes > 0
                ? Math.round(officeMetric.averageWaitMinutes)
                : liveEstimatedWait,
            themeColor: o.themeColor || '#0E8AA8',
            windows,
            services,
          });
        }

        const officeNameById = new Map(hydratedOffices.map((o) => [o.id, o.name]));
        officeNameByIdRef.current = officeNameById;

        const mapAccount = (
          doc: LiveAccountDoc,
          fallbackRole: 'staff' | 'student'
        ): AdminUserRecord => {
          const isSuspended = doc.accountStatus === 'archived' || Boolean(doc.archivedAt);
          return {
            id: doc.id,
            identifier: doc.loginId || doc.staffId || doc.usn || doc.id,
            fullName: doc.fullName || doc.staffName || 'Unnamed Account',
            email: doc.email || '—',
            role: fallbackRole,
            status: isSuspended ? 'suspended' : 'active',
            assignedOfficeId: doc.officeId,
            assignedOfficeName:
              doc.office || (doc.officeId ? officeNameById.get(doc.officeId) : undefined),
            defaultWindow: doc.defaultCounterWindow,
            courseYear:
              doc.program || doc.yearLevel
                ? [doc.program, doc.yearLevel].filter(Boolean).join(' - ')
                : undefined,
            mustChangePassword: false,
          };
        };

        const mappedUsers: AdminUserRecord[] = [
          ...staffDocs.map((d) => mapAccount(d, 'staff')),
          ...studentDocs.map((d) => mapAccount(d, 'student')),
        ];

        const s = analyticsRes.summary;
        const skippedTotal = s.noShow + s.legacySkipped;
        const peakHours = analyticsRes.groups.date.slice(0, 10).map((d) => ({
          hourLabel: d.label.slice(5),
          count: d.issued,
        }));

        const liveSnapshot: AdminKpiSnapshot = {
          totalIssued: s.issued,
          issuedDeltaLabel: `${startDate} to ${endDate}`,
          completedCount: s.completed,
          completionRate: s.completionRate ?? 0,
          activeWaiting: s.waiting + s.called + s.serving,
          skippedCount: skippedTotal,
          skippedRate: s.noShowRate ?? 0,
          peakHours,
        };

        const mappedLogs = mapActivityLogsToAuditRecords(
          logDocs,
          officeNameById,
          staffByUid
        );

        if (officesSettled.status === 'fulfilled') setOffices(hydratedOffices);
        if (staffSettled.status === 'fulfilled' || studentsSettled.status === 'fulfilled') {
          setUsers(mappedUsers);
        }
        if (logsSettled.status === 'fulfilled') {
          setAuditRecords(mappedLogs);
          setLogsError(null);
        }
        if (analyticsSettled.status === 'fulfilled' || officesSettled.status === 'fulfilled') {
          setLiveKpis((prev) => ({ ...prev, [range]: liveSnapshot }));
        }
      } catch (err) {
        consecutiveFailuresRef.current += 1;
        const msg = err instanceof Error ? err.message : 'Unable to sync campus telemetry.';
        setLiveError(msg);
      } finally {
        setHasLoadedLive(true);
        if (!silent) setIsLoadingLive(false);
      }
    },
    [fetchAllAdminPages, isLiveAdmin, liveAdminRequest]
  );

  const fetchLiveAuditLogs = useCallback(
    async (startDate: string, endDate: string, officeId?: string) => {
      if (!isLiveAdmin) return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return;
      if (startDate > endDate) return;

      setIsLoadingLogs(true);
      setLogsError(null);
      try {
        const parts = [
          'resource=activity-logs',
          `startDate=${encodeURIComponent(startDate)}`,
          `endDate=${encodeURIComponent(endDate)}`,
          officeId && officeId !== 'all' ? `officeId=${encodeURIComponent(officeId)}` : '',
          'limit=50',
        ].filter(Boolean);
        const logDocs = await fetchAllAdminPages<LiveActivityLogDoc>(parts.join('&'), 2, true);
        const mapped = mapActivityLogsToAuditRecords(
          logDocs,
          officeNameByIdRef.current,
          staffByUidRef.current
        );
        setAuditRecords(mapped);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to load activity logs for selected dates.';
        setLogsError(message);
      } finally {
        setIsLoadingLogs(false);
      }
    },
    [fetchAllAdminPages, isLiveAdmin]
  );

  useEffect(() => {
    if (!isLiveAdmin) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;

    const getPollDelay = () => {
      const failures = consecutiveFailuresRef.current;
      if (failures <= 0) return ADMIN_POLLING_INTERVAL_MS;
      return Math.min(60_000, ADMIN_POLLING_INTERVAL_MS * Math.pow(2, Math.min(failures, 3)));
    };

    const scheduleNext = () => {
      if (cancelled) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void runPoll();
      }, getPollDelay());
    };

    const runPoll = async (initial = false) => {
      if (cancelled || inFlight || (!initial && appStateRef.current !== 'active')) {
        scheduleNext();
        return;
      }
      inFlight = true;
      try {
        await refreshAdminData(activeRangeRef.current, !initial);
      } finally {
        inFlight = false;
        scheduleNext();
      }
    };

    void runPoll(true);

    const sub = AppState.addEventListener('change', (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;
      if (prev !== 'active' && nextState === 'active') {
        consecutiveFailuresRef.current = 0;
        void runPoll(false);
      }
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, [isLiveAdmin, refreshAdminData]);

  const logoutAdmin = useCallback(() => {
    consecutiveFailuresRef.current = 0;
    setHasLoadedLive(false);
    setIsLoadingLive(false);
    setIsLoadingLogs(false);
    setLiveError(null);
    setLogsError(null);
    setOffices([]);
    setUsers([]);
    setAuditRecords([]);
    setLiveKpis({});
  }, []);

  const liveWaitingSum = useMemo(
    () =>
      offices
        .filter((o) => o.status === 'open')
        .reduce((sum, o) => sum + o.activeWaitingCount, 0),
    [offices]
  );

  const getKpiSnapshot = useCallback(
    (range: AdminDateRange): AdminKpiSnapshot => {
      if (liveKpis[range]) {
        return {
          ...liveKpis[range]!,
          activeWaiting:
            range === 'Today (Live)'
              ? Math.max(liveWaitingSum, liveKpis[range]!.activeWaiting)
              : liveKpis[range]!.activeWaiting,
        };
      }
      return {
        totalIssued: 0,
        issuedDeltaLabel: 'Live backend data',
        completedCount: 0,
        completionRate: 0,
        activeWaiting: liveWaitingSum,
        skippedCount: 0,
        skippedRate: 0,
        peakHours: [],
      };
    },
    [liveKpis, liveWaitingSum]
  );

  const sendBroadcast = useCallback(
    (_input: SendBroadcastInput) => {
      const error = 'Campus-wide broadcasts are not supported by the backend API yet.';
      showToast(error, 'warning');
      return { ok: false, recipientCount: 0, error };
    },
    [showToast]
  );

  const toggleOfficeStatus = useCallback(
    async (officeId: string) => {
      const target = offices.find((o) => o.id === officeId);
      if (!target) return;
      const nextAccepting = target.status !== 'open';

      try {
        await liveAdminRequest('resource=offices', {
          action: 'update',
          id: officeId,
          acceptingTickets: nextAccepting,
        });
        await refreshAdminData(activeRangeRef.current, true);
        triggerHaptic('light');
        showToast(`${target.shortLabel} queue status updated.`, 'matcha');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to update office.', 'warning');
      }
    },
    [liveAdminRequest, offices, refreshAdminData, showToast, triggerHaptic]
  );

  const toggleServiceStatus = useCallback(
    async (officeId: string, serviceId: string) => {
      const office = offices.find((o) => o.id === officeId);
      const service = office?.services.find((s) => s.id === serviceId);
      if (!service) return;
      const nextAvailable = !service.isActive;

      try {
        await liveAdminRequest('resource=request-types', {
          action: 'update',
          officeId,
          id: serviceId,
          available: nextAvailable,
        });
        await refreshAdminData(activeRangeRef.current, true);
        triggerHaptic('light');
        showToast('Service catalog updated.', 'dark');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to update service.', 'warning');
      }
    },
    [liveAdminRequest, offices, refreshAdminData, showToast, triggerHaptic]
  );

  const saveOffice = useCallback(
    async (input: SaveOfficeInput): Promise<ActionResult> => {
      const cleanName = input.name.trim();
      const cleanPrefix = input.prefix.trim().toUpperCase();
      if (!cleanName) return { ok: false, error: 'Office name is required.' };
      if (!/^[A-Z]{1,4}$/.test(cleanPrefix)) {
        return {
          ok: false,
          error: 'Ticket prefix must be 1–4 uppercase letters.',
        };
      }
      const duplicate = offices.find(
        (o) => o.prefix.toUpperCase() === cleanPrefix && o.id !== input.id
      );
      if (duplicate) {
        return {
          ok: false,
          error: `Prefix "${cleanPrefix}" is already used by ${duplicate.name}.`,
        };
      }

      const slug = cleanName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const officeId = input.id ?? `${slug || 'office'}-${Date.now().toString(36)}`;

      try {
        if (input.id) {
          await liveAdminRequest('resource=offices', {
            action: 'update',
            id: officeId,
            name: cleanName,
            shortLabel: cleanName.replace(' Office', ''),
            description: input.locationDescription.trim(),
          });
        } else {
          await liveAdminRequest('resource=offices', {
            action: 'create',
            id: officeId,
            name: cleanName,
            shortLabel: cleanName.replace(' Office', ''),
            prefix: cleanPrefix,
            description: input.locationDescription.trim(),
            acceptingTickets: true,
          });
          const count = Math.max(1, Math.min(10, input.windowCount || 1));
          for (let idx = 1; idx <= count; idx++) {
            await liveAdminRequest('resource=counters', {
              action: 'create',
              officeId,
              id: `Window ${idx}`,
              name: `Window ${idx}`,
              status: idx === 1 ? 'online' : 'closed',
            });
          }
        }
        await refreshAdminData();
        triggerHaptic('success');
        showToast('Campus office saved.', 'matcha');
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Failed to save office.',
        };
      }
    },
    [liveAdminRequest, offices, refreshAdminData, showToast, triggerHaptic]
  );

  const saveService = useCallback(
    async (officeId: string, input: SaveServiceInput): Promise<ActionResult> => {
      const cleanName = input.name.trim();
      if (!cleanName) return { ok: false, error: 'Service name is required.' };
      if (!Number.isFinite(input.estimatedDurationMinutes) || input.estimatedDurationMinutes < 1) {
        return { ok: false, error: 'Estimated duration must be at least 1 minute.' };
      }

      const serviceId =
        input.id ??
        `${officeId}-${cleanName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .slice(0, 24)}-${Date.now().toString(36).slice(-4)}`;

      try {
        await liveAdminRequest('resource=request-types', {
          action: input.id ? 'update' : 'create',
          officeId,
          id: serviceId,
          name: cleanName,
          duration: input.estimatedDurationMinutes,
          docs: input.requiredDocumentsNote.trim(),
          available: input.isActive,
        });
        await refreshAdminData();
        triggerHaptic('success');
        showToast('Service catalog updated.', 'matcha');
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Failed to save service.',
        };
      }
    },
    [liveAdminRequest, refreshAdminData, showToast, triggerHaptic]
  );

  const resetOfficeSequence = useCallback(
    (_officeId: string): ActionResult => {
      const error = 'Resetting office ticket sequence is not supported by the backend API yet.';
      triggerHaptic('warning');
      showToast(error, 'warning');
      return { ok: false, error };
    },
    [showToast, triggerHaptic]
  );

  const provisionUser = useCallback(
    async (input: ProvisionUserInput & { password?: string }): Promise<ActionResult> => {
      const cleanId = input.identifier.trim().toUpperCase();
      const cleanName = input.fullName.trim();
      const cleanEmail = input.email.trim().toLowerCase();
      const initialPassword = (input.password ?? '').trim();

      if (input.role === 'admin') {
        return {
          ok: false,
          error: 'Admin accounts can only be provisioned via the backend CLI script.',
        };
      }
      if (!cleanId) return { ok: false, error: 'Employee ID is required.' };
      if (!cleanName) return { ok: false, error: 'Full name is required.' };
      if (initialPassword.length < 8 || initialPassword.length > 128) {
        return { ok: false, error: 'Initial password must be 8 to 128 characters.' };
      }
      const assignedOffice = offices.find((o) => o.id === input.assignedOfficeId);
      if (!assignedOffice) {
        return { ok: false, error: 'Please assign a campus office for staff accounts.' };
      }

      try {
        const officeCounterIds = assignedOffice.windows.map((w) => w.label);
        const defaultCounterWindow = officeCounterIds[0];
        await liveAdminRequest('resource=staff', {
          action: 'create',
          loginId: cleanId,
          fullName: cleanName,
          password: initialPassword,
          ...(cleanEmail ? { email: cleanEmail } : {}),
          officeId: input.assignedOfficeId,
          ...(officeCounterIds.length > 0
            ? { counterIds: officeCounterIds, defaultCounterWindow }
            : { counterIds: [] }),
        });
        await refreshAdminData();
        triggerHaptic('success');
        showToast(`Account ${cleanId} provisioned successfully.`, 'matcha');
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Failed to provision account.',
        };
      }
    },
    [liveAdminRequest, offices, refreshAdminData, showToast, triggerHaptic]
  );

  const updateStaffAssignment = useCallback(
    async (userId: string, officeId: string, defaultWindow: string): Promise<ActionResult> => {
      const office = offices.find((o) => o.id === officeId);
      if (!office) return { ok: false, error: 'Selected office not found.' };

      try {
        const availableLabels = office.windows.map((w) => w.label);
        const counterIds = availableLabels.includes(defaultWindow)
          ? availableLabels
          : defaultWindow
            ? [defaultWindow]
            : availableLabels;

        await liveAdminRequest('resource=staff', {
          action: 'update',
          id: userId,
          officeId,
          counterIds,
          ...(defaultWindow ? { defaultCounterWindow: defaultWindow } : {}),
        });
        await refreshAdminData();
        triggerHaptic('success');
        showToast('Staff office assignment updated.', 'matcha');
        return { ok: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to update assignment.';
        showToast(msg, 'warning');
        return { ok: false, error: msg };
      }
    },
    [liveAdminRequest, offices, refreshAdminData, showToast, triggerHaptic]
  );

  const resetUserPassword = useCallback(
    async (userId: string, newPassword?: string): Promise<ActionResult> => {
      const target = users.find((u) => u.id === userId);
      if (!target) return { ok: false, error: 'User not found.' };
      if (target.role === 'admin') {
        const error = 'Admin passwords must be reset via the backend CLI.';
        showToast(error, 'warning');
        return { ok: false, error };
      }
      const password = (newPassword ?? '').trim();
      if (password.length < 8 || password.length > 128) {
        return { ok: false, error: 'New password must be 8 to 128 characters.' };
      }

      try {
        const resource = target.role === 'staff' ? 'staff' : 'students';
        await liveAdminRequest(`resource=${resource}`, {
          action: 'reset-password',
          id: userId,
          password,
        });
        triggerHaptic('success');
        showToast('Password updated on backend.', 'matcha');
        return { ok: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to reset password.';
        showToast(msg, 'warning');
        return { ok: false, error: msg };
      }
    },
    [liveAdminRequest, showToast, triggerHaptic, users]
  );

  const toggleAccountStatus = useCallback(
    async (userId: string): Promise<ActionResult> => {
      const target = users.find((u) => u.id === userId);
      if (!target) return { ok: false, error: 'User not found.' };
      if (target.role === 'admin') {
        const error = 'Admin accounts cannot be suspended from the mobile UI.';
        showToast(error, 'warning');
        return { ok: false, error };
      }

      try {
        const resource = target.role === 'staff' ? 'staff' : 'students';
        const action = target.status === 'active' ? 'archive' : 'restore';
        await liveAdminRequest(`resource=${resource}`, { action, id: userId });
        await refreshAdminData();
        triggerHaptic('warning');
        showToast('Account status updated.', 'dark');
        return { ok: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to update account status.';
        showToast(msg, 'warning');
        return { ok: false, error: msg };
      }
    },
    [liveAdminRequest, refreshAdminData, showToast, triggerHaptic, users]
  );

  const downloadAnalyticsReport = useCallback(
    async (
      startDate: string,
      endDate: string,
      format: 'csv' | 'pdf',
      officeId?: string
    ): Promise<string | null> => {
      if (!isLiveAdmin) return null;
      const params = [
        'resource=analytics',
        `startDate=${encodeURIComponent(startDate)}`,
        `endDate=${encodeURIComponent(endDate)}`,
        `format=${format}`,
        officeId && officeId !== 'all' ? `officeId=${encodeURIComponent(officeId)}` : '',
      ]
        .filter(Boolean)
        .join('&');
      return liveAdminDownload(params);
    },
    [isLiveAdmin, liveAdminDownload]
  );

  const directoryTotalBadges = useMemo(
    () => ({
      staff: users.filter((u) => u.role === 'staff').length,
      students: users.filter((u) => u.role === 'student').length,
      admins: users.filter((u) => u.role === 'admin').length,
    }),
    [users]
  );

  const value = useMemo<AdminContextValue>(
    () => ({
      activeAdmin,
      isLoadingLive,
      isLoadingLogs,
      hasLoadedLive,
      liveError,
      logsError,
      logoutAdmin,
      refreshAdminData,
      fetchLiveAuditLogs,
      getKpiSnapshot,
      broadcasts,
      sendBroadcast,
      offices,
      toggleOfficeStatus,
      toggleServiceStatus,
      saveOffice,
      saveService,
      resetOfficeSequence,
      users,
      directoryTotalBadges,
      provisionUser,
      updateStaffAssignment,
      resetUserPassword,
      toggleAccountStatus,
      auditRecords,
      downloadAnalyticsReport,
    }),
    [
      activeAdmin,
      auditRecords,
      broadcasts,
      directoryTotalBadges,
      downloadAnalyticsReport,
      fetchLiveAuditLogs,
      getKpiSnapshot,
      hasLoadedLive,
      isLoadingLive,
      isLoadingLogs,
      liveError,
      logsError,
      logoutAdmin,
      offices,
      provisionUser,
      refreshAdminData,
      resetOfficeSequence,
      resetUserPassword,
      saveOffice,
      saveService,
      sendBroadcast,
      toggleAccountStatus,
      toggleOfficeStatus,
      toggleServiceStatus,
      updateStaffAssignment,
      users,
    ]
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return ctx;
}
