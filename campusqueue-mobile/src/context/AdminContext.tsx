import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { ApiDownload } from './apiClient';
import {
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
import { useQueue } from './QueueContext';

// Demo accounts, KPIs and audit records are disabled. The original fixture is retained in src/data.

const noBroadcasts: AdminBroadcastRecord[] = [];

export function manilaDateString(offsetDays = 0): string {
  const manilaMs = Date.now() + 8 * 60 * 60 * 1000 + offsetDays * 86_400_000;
  return new Date(manilaMs).toISOString().slice(0, 10);
}

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

// Live API response shapes
interface LiveOfficeDoc {
  id: string;
  name?: string;
  shortLabel?: string;
  prefix?: string;
  description?: string;
  acceptingTickets?: boolean;
  waitingCount?: number;
  lastIssuedNumber?: number;
  themeColor?: string;
  services?: { id: string; name: string; duration?: number; docs?: string; available?: boolean }[];
}

interface LiveCounterDoc {
  id: string;
  name?: string;
  status?: 'online' | 'break' | 'closed';
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
  details?: Record<string, unknown>;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export type MaybePromise<T> = T | Promise<T>;

export interface AdminContextValue {
  activeAdmin: { fullName: string; adminId: string };
  isLoadingLive: boolean;
  liveError: string | null;
  refreshAdminData: (range?: AdminDateRange) => Promise<void>;

  // Overview & Broadcasts
  getKpiSnapshot: (range: AdminDateRange) => AdminKpiSnapshot;
  broadcasts: AdminBroadcastRecord[];
  sendBroadcast: (
    input: SendBroadcastInput
  ) => { ok: boolean; recipientCount: number; error?: string };

  // Offices & Services
  offices: AdminOfficeRecord[];
  toggleOfficeStatus: (officeId: string) => MaybePromise<void>;
  toggleServiceStatus: (officeId: string, serviceId: string) => MaybePromise<void>;
  saveOffice: (input: SaveOfficeInput) => MaybePromise<ActionResult>;
  saveService: (officeId: string, input: SaveServiceInput) => MaybePromise<ActionResult>;
  resetOfficeSequence: (officeId: string) => ActionResult;

  // Users & Roles
  users: AdminUserRecord[];
  directoryTotalBadges: { staff: number; students: number; admins: number };
  provisionUser: (input: ProvisionUserInput) => MaybePromise<ActionResult>;
  updateStaffAssignment: (
    userId: string,
    officeId: string,
    defaultWindow: string
  ) => MaybePromise<ActionResult>;
  resetUserPassword: (userId: string, password: string) => MaybePromise<ActionResult>;
  toggleAccountStatus: (userId: string) => MaybePromise<ActionResult>;

  // Audit Reports
  loadAuditRecords: (startDate: string, endDate: string, officeId?: string) => Promise<AdminAuditRecord[]>;
  downloadAnalyticsReport: (
    startDate: string,
    endDate: string,
    format: 'csv' | 'pdf',
    officeId?: string
  ) => Promise<ApiDownload>;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {

  const {
    adminIdentity,
    liveRole,
    liveAdminRequest,
    liveAdminDownload,
    showToast,
    triggerHaptic,
  } = useQueue();

  const activeAdmin = useMemo(() => ({
    fullName: adminIdentity?.fullName ?? 'Administrator',
    adminId: adminIdentity?.loginId ?? '',
  }), [adminIdentity]);
  const [isLoadingLive, setIsLoadingLive] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [offices, setOffices] = useState<AdminOfficeRecord[]>([]);
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [liveKpis, setLiveKpis] = useState<Partial<Record<AdminDateRange, AdminKpiSnapshot>>>({});
  const isLiveAdmin = liveRole === 'admin';
  const revision = useRef(0);
  const invalidateRefresh = useCallback(() => { revision.current++; }, []);

  const refreshAdminData = useCallback(
    async (range: AdminDateRange = 'Today (Live)') => {
      if (!isLiveAdmin) return;
      const load = ++revision.current;
      setIsLoadingLive(true);
      setLiveError(null);
      try {
        const { startDate, endDate } = rangeToDates(range);
        const [officesRes, staffRes, studentsRes, analyticsRes] =
          await Promise.all([
            liveAdminRequest<{ items: LiveOfficeDoc[] }>('resource=offices&limit=100'),
            liveAdminRequest<{ items: LiveAccountDoc[] }>('resource=staff&archived=true&limit=100'),
            liveAdminRequest<{ items: LiveAccountDoc[] }>(
              'resource=students&archived=true&limit=100'
            ),
            liveAdminRequest<LiveAnalyticsResponse>(
              `resource=analytics&startDate=${startDate}&endDate=${endDate}`
            ),
          ]);

        // Hydrate counters + request-types per office
        const officeMetricsMap = new Map(
          analyticsRes.groups.office.map((g) => [g.id, g])
        );

        const hydratedOffices: AdminOfficeRecord[] = await Promise.all(
          officesRes.items.map(async (o) => {
            const [countersRes, servicesRes] = await Promise.all([
              liveAdminRequest<{ items: LiveCounterDoc[] }>(
                `resource=counters&officeId=${encodeURIComponent(o.id)}&limit=100`
              ),
              liveAdminRequest<{
                items: {
                  id: string;
                  name: string;
                  duration?: number;
                  docs?: string;
                  available?: boolean;
                }[];
              }>(`resource=request-types&officeId=${encodeURIComponent(o.id)}&limit=100`),
            ]);

            const windows: AdminOfficeWindow[] = countersRes.items.map((c) => ({
              id: c.id,
              label: c.name || c.id,
              status:
                c.status === 'online' ? 'Online' : c.status === 'break' ? 'Break' : 'Closed',
              staffName: c.staffName,
              staffId: c.staffId,
            }));

            const services: AdminServiceItem[] = (
              servicesRes.items.length ? servicesRes.items : (o.services ?? [])
            ).map((s) => ({
              id: s.id,
              name: s.name,
              estimatedDurationMinutes: s.duration ?? 0,
              requiredDocumentsNote: s.docs ?? '',
              isActive: s.available !== false,
              waitingCount: 0,
            }));

            const officeMetric = officeMetricsMap.get(o.id);

            return {
              id: o.id,
              name: o.name || o.id,
              shortLabel: o.shortLabel || (o.name || o.id).replace(' Office', ''),
              prefix: (o.prefix || o.id.slice(0, 1)).toUpperCase(),
              status: o.acceptingTickets === false ? 'closed' : 'open',
              operatingHours: '—',
              locationDescription: o.description || '—',
              windowCount: windows.length,
              lastIssuedNumber: o.lastIssuedNumber ?? 0,
              activeWaitingCount: o.waitingCount ?? officeMetric?.waiting ?? 0,
              avgWaitMinutes: officeMetric?.averageWaitMinutes == null ? undefined : Math.round(officeMetric.averageWaitMinutes),
              themeColor: o.themeColor || '#0E8AA8',
              windows,
              services,
            };
          })
        );

        const officeNameById = new Map(hydratedOffices.map((o) => [o.id, o.name]));

        const mapAccount = (doc: LiveAccountDoc, fallbackRole: 'staff' | 'student'): AdminUserRecord => {
          const isSuspended = doc.accountStatus === 'archived' || Boolean(doc.archivedAt);
          return {
            id: doc.id,
            identifier: doc.loginId || doc.staffId || doc.usn || doc.id,
            fullName: doc.fullName || doc.staffName || 'Unnamed Account',
            email: doc.email || '—',
            role: fallbackRole,
            status: isSuspended ? 'suspended' : 'active',
            assignedOfficeId: doc.officeId,
            assignedOfficeName: doc.office || (doc.officeId ? officeNameById.get(doc.officeId) : undefined),
            defaultWindow: doc.defaultCounterWindow,
            courseYear:
              doc.program || doc.yearLevel
                ? [doc.program, doc.yearLevel].filter(Boolean).join(' - ')
                : undefined,
            mustChangePassword: false,
          };
        };

        const mappedUsers: AdminUserRecord[] = [
          ...staffRes.items.map((d) => mapAccount(d, 'staff')),
          ...studentsRes.items.map((d) => mapAccount(d, 'student')),
        ];

        const s = analyticsRes.summary;
        const skippedTotal = s.noShow + s.legacySkipped;
        const peakHours =
          analyticsRes.groups.date.length > 0
            ? analyticsRes.groups.date.slice(0, 10).map((d) => ({
                hourLabel: d.label.slice(5),
                count: d.issued,
              }))
            : [];

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

        if (load !== revision.current) return;
        setOffices(hydratedOffices);
        setUsers(mappedUsers);
        setLiveKpis((prev) => ({ ...prev, [range]: liveSnapshot }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to sync campus telemetry.';
        if (load === revision.current) setLiveError(msg);
      } finally {
        if (load === revision.current) setIsLoadingLive(false);
      }
    },
    [isLiveAdmin, liveAdminRequest]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLiveAdmin) {
        void refreshAdminData();
      } else {
        setOffices([]);
        setUsers([]);
        setLiveKpis({});
        setLiveError(null);
        setIsLoadingLive(false);
      }
    }, 0);
    return () => { clearTimeout(timer); invalidateRefresh(); };
  }, [invalidateRefresh, isLiveAdmin, refreshAdminData]);

  const getKpiSnapshot = useCallback((range: AdminDateRange): AdminKpiSnapshot =>
    liveKpis[range] ?? {
      totalIssued: 0, issuedDeltaLabel: '—', completedCount: 0, completionRate: 0,
      activeWaiting: 0, skippedCount: 0, skippedRate: 0, peakHours: [],
    }, [liveKpis]);

  const broadcasts: AdminBroadcastRecord[] = noBroadcasts;
  const sendBroadcast = useCallback((_input: SendBroadcastInput) => ({
    ok: false, recipientCount: 0, error: 'CampusQueue does not currently have a broadcast endpoint.',
  }), []);

  const toggleOfficeStatus = useCallback(
    async (officeId: string) => {
      const target = offices.find((o) => o.id === officeId);
      if (!target) return;
      const nextAccepting = target.status !== 'open';

      if (!isLiveAdmin) return;
      try {
        await liveAdminRequest('resource=offices', {
          action: 'update',
          id: officeId,
          acceptingTickets: nextAccepting,
        });
        setOffices((prev) =>
          prev.map((o) =>
            o.id === officeId ? { ...o, status: nextAccepting ? 'open' : 'closed' } : o
          )
        );
        triggerHaptic('light');
        showToast(`${target.shortLabel} queue status updated.`, 'matcha');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to update office.', 'warning');
      }
      return;
    },
    [isLiveAdmin, liveAdminRequest, offices, showToast, triggerHaptic]
  );

  const toggleServiceStatus = useCallback(
    async (officeId: string, serviceId: string) => {
      const office = offices.find((o) => o.id === officeId);
      const service = office?.services.find((s) => s.id === serviceId);
      if (!service) return;
      const nextAvailable = !service.isActive;

      if (!isLiveAdmin) return;
      try {
        await liveAdminRequest('resource=request-types', {
          action: 'update',
          officeId,
          id: serviceId,
          available: nextAvailable,
        });
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to update service.', 'warning');
        return;
      }

      setOffices((prev) =>
        prev.map((o) =>
          o.id !== officeId
            ? o
            : {
                ...o,
                services: o.services.map((s) =>
                  s.id === serviceId ? { ...s, isActive: nextAvailable } : s
                ),
              }
        )
      );
      triggerHaptic('light');
      showToast('Service catalog updated.', 'dark');
    },
    [isLiveAdmin, liveAdminRequest, offices, showToast, triggerHaptic]
  );

  const saveOffice = useCallback(
    async (input: SaveOfficeInput): Promise<ActionResult> => {
      const cleanName = input.name.trim();
      const cleanPrefix = input.prefix.trim().toUpperCase();
      if (!cleanName) return { ok: false, error: 'Office name is required.' };
      if (!/^[A-Z]{1,2}$/.test(cleanPrefix)) {
        return { ok: false, error: 'Ticket prefix must be 1–2 uppercase letters (e.g., R or AC).' };
      }
      const duplicate = offices.find(
        (o) => o.prefix.toUpperCase() === cleanPrefix && o.id !== input.id
      );
      if (duplicate) {
        return { ok: false, error: `Prefix "${cleanPrefix}" is already used by ${duplicate.name}.` };
      }

      const slug = cleanName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const officeId = input.id ?? `${slug || 'office'}-${Date.now().toString(36)}`;

      if (!isLiveAdmin) return { ok: false, error: 'Administrator access required.' };
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
          try {
            for (let number = 1; number <= input.windowCount; number++) {
              await liveAdminRequest('resource=counters', {
                action: 'create', officeId, id: 'window-' + number, name: 'Window ' + number,
              });
            }
          } catch (error) {
            await refreshAdminData();
            return {
              ok: false, error: error instanceof Error
                ? 'Office created, but some counters could not be saved. ' + error.message
                : 'Office created, but some counters could not be saved.',
            };
          }
        }
        await refreshAdminData();
        triggerHaptic('success');
        showToast('Campus office saved.', 'matcha');
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Failed to save office.' };
      }
    },
    [isLiveAdmin, liveAdminRequest, offices, refreshAdminData, showToast, triggerHaptic]
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
        `${officeId}-${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}-${Date.now().toString(36).slice(-4)}`;

      if (!isLiveAdmin) return { ok: false, error: 'Administrator access required.' };
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
    [isLiveAdmin, liveAdminRequest, refreshAdminData, showToast, triggerHaptic]
  );

  const resetOfficeSequence = useCallback((_officeId: string): ActionResult => ({
    ok: false, error: 'CampusQueue does not currently have a queue sequence reset endpoint.',
  }), []);

  const provisionUser = useCallback(
    async (input: ProvisionUserInput): Promise<ActionResult> => {
      const cleanId = input.identifier.trim().toUpperCase();
      const cleanName = input.fullName.trim();
      const cleanEmail = input.email.trim().toLowerCase();

      if (!cleanId) return { ok: false, error: 'Employee or Admin ID is required.' };
      if (input.role === 'staff' && !/^EMP-\d{4}$/.test(cleanId)) {
        return { ok: false, error: 'Staff ID must match format EMP-**** (e.g., EMP-1043).' };
      }
      if (input.role === 'admin' && !/^ADM-\d{3}$/.test(cleanId)) {
        return { ok: false, error: 'Admin ID must match format ADM-*** (e.g., ADM-004).' };
      }
      if (users.some((u) => u.identifier.toUpperCase() === cleanId)) {
        return { ok: false, error: `Account ${cleanId} already exists.` };
      }
      if (!cleanName) return { ok: false, error: 'Full name is required.' };
      if (!cleanEmail || !cleanEmail.endsWith('@aclc.edu.ph')) {
        return { ok: false, error: 'Institutional email must end with @aclc.edu.ph.' };
      }

      const assignedOffice = offices.find((o) => o.id === input.assignedOfficeId);
      if (input.role === 'staff') {
        const office = offices.find((o) => o.id === input.assignedOfficeId);
        if (!office) {
          return { ok: false, error: 'Please assign a campus office for staff accounts.' };
        }

      }

      if (!isLiveAdmin) return { ok: false, error: 'Administrator access required.' };
      if (input.role === 'admin') {
        return {
          ok: false,
          error: 'Admin accounts must be provisioned using the backend CLI provisioning script.',
        };
      }
      const counter = assignedOffice?.windows[0]?.id;
      if (!counter) return { ok: false, error: 'Assign an office with a configured counter.' };
      if (input.password.length < 8 || input.password.length > 128) {
        return { ok: false, error: 'Enter an initial password between 8 and 128 characters.' };
      }
      try {
        await liveAdminRequest('resource=staff', {
          action: 'create',
          loginId: cleanId,
          fullName: cleanName,
          password: input.password,
          email: cleanEmail,
          officeId: input.assignedOfficeId,
          counterIds: [counter],
          defaultCounterWindow: counter,
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
    [isLiveAdmin, liveAdminRequest, offices, refreshAdminData, showToast, triggerHaptic, users]
  );

  const updateStaffAssignment = useCallback(
    async (userId: string, officeId: string, defaultWindow: string): Promise<ActionResult> => {
      const office = offices.find((o) => o.id === officeId);
      if (!office) return { ok: false, error: 'Selected office not found.' };

      if (!isLiveAdmin) return { ok: false, error: 'Administrator access required.' };
      try {
        await liveAdminRequest('resource=staff', {
          action: 'update',
          id: userId,
          officeId,
          counterIds: [defaultWindow],
          defaultCounterWindow: defaultWindow,
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
    [isLiveAdmin, liveAdminRequest, offices, refreshAdminData, showToast, triggerHaptic]
  );

  const resetUserPassword = useCallback(
    async (userId: string, password: string): Promise<ActionResult> => {
      const target = users.find((u) => u.id === userId);
      if (!target) return { ok: false, error: 'User not found.' };

      if (!isLiveAdmin) return { ok: false, error: 'Administrator access required.' };
      if (target.role === 'admin') {
        showToast('Admin passwords must be reset via backend CLI.', 'warning');
        return { ok: false, error: 'Admin passwords must be reset via backend CLI.' };
      }
      try {
        const resource = target.role === 'staff' ? 'staff' : 'students';
        if (password.length < 8 || password.length > 128) return { ok: false, error: 'Enter a password between 8 and 128 characters.' };
        await liveAdminRequest(`resource=${resource}`, {
          action: 'reset-password',
          id: userId,
          password,
        });
        triggerHaptic('success');
        showToast('Password reset.', 'matcha');
        return { ok: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to reset password.';
        showToast(msg, 'warning');
        return { ok: false, error: msg };
      }
    },
    [isLiveAdmin, liveAdminRequest, showToast, triggerHaptic, users]
  );

  const toggleAccountStatus = useCallback(
    async (userId: string): Promise<ActionResult> => {
      const target = users.find((u) => u.id === userId);
      if (!target) return { ok: false, error: 'User not found.' };

      if (!isLiveAdmin) return { ok: false, error: 'Administrator access required.' };
      if (target.role === 'admin') {
        showToast('Admin accounts cannot be suspended from the mobile UI.', 'warning');
        return { ok: false };
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
    [isLiveAdmin, liveAdminRequest, refreshAdminData, showToast, triggerHaptic, users]
  );

  const loadAuditRecords = useCallback(async (startDate: string, endDate: string, officeId?: string): Promise<AdminAuditRecord[]> => {
    const params = new URLSearchParams({ resource: 'activity-logs', startDate, endDate, limit: '100' });
    if (officeId && officeId !== 'all') params.set('officeId', officeId);
    const logs: LiveActivityLogDoc[] = [];
    do {
      const result = await liveAdminRequest<{ items: LiveActivityLogDoc[]; nextCursor?: string }>(params.toString());
      logs.push(...result.items);
      if (!result.nextCursor) break;
      params.set('cursor', result.nextCursor);
    } while (logs.length < 500);
    const officeNameById = new Map(offices.map((office) => [office.id, office.name]));
      return logs.map((log) => {
        const created = new Date(log.createdAt);
        const dateKey = log.createdAt.slice(0, 10);
        const timeLabel = Number.isFinite(created.valueOf())
          ? created.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
          : log.createdAt;
        const actionText = (log.action || 'event').toLowerCase();
        const outcome = actionText === 'ticket_cancelled'
          ? 'Cancelled'
          : actionText === 'ticket_skipped' || actionText === 'ticket_no_show'
            ? 'Skipped'
            : actionText === 'service_completed' ? 'Completed' : 'Activity';

        return {
          id: log.id,
          documentId: `activityLogs/${log.id}`,
          ticketCode: log.ticketId || '—',
          dateKey,
          dateTimeLabel: `${dateKey} • ${timeLabel}`,
          officeId: log.officeId || 'campus',
          officeName: (log.officeId && officeNameById.get(log.officeId)) || log.officeId || 'Campus-Wide',
          serviceName: log.action || 'System Event',
          studentName: String(log.details?.studentName ?? '—'),
          studentUsn: String(log.details?.usn ?? '—'),
          outcome,
          issuedAt: '—',
          approachingAlertAt: '—',
          calledAt: '—',
          qrVerifiedAt: '—',
          closedAt: outcome === 'Activity' ? '—' : timeLabel,
          waitDurationSeconds: 0,
          serviceDurationSeconds: 0,
          waitDurationLabel: '—',
          serviceDurationLabel: '—',
          verificationMethod: '—',
          handledByStaffId: log.actorId || 'system',
          handledByStaffName: log.actorId || 'System',
          counterWindow: String(log.details?.counter ?? '—'),
        };
      });
  }, [liveAdminRequest, offices]);

  const downloadAnalyticsReport = useCallback(
    async (
      startDate: string,
      endDate: string,
      format: 'csv' | 'pdf',
      officeId?: string
    ): Promise<ApiDownload> => {
      if (!isLiveAdmin) throw new Error('Administrator access required.');
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

  const directoryTotalBadges = useMemo(() => ({
    staff: users.filter((user) => user.role === 'staff').length,
    students: users.filter((user) => user.role === 'student').length,
    admins: 0,
  }), [users]);

  const value = useMemo<AdminContextValue>(
    () => ({
      activeAdmin,
      isLoadingLive,
      liveError,
      refreshAdminData,
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
      loadAuditRecords,
      downloadAnalyticsReport,
    }),
    [
      activeAdmin,
      loadAuditRecords,
      broadcasts,
      directoryTotalBadges,
      downloadAnalyticsReport,
      getKpiSnapshot,
      isLoadingLive,
      liveError,
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
