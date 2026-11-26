import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import rawAdminData from '../data/adminData.json';
import {
  AdminAccount,
  AdminAuditRecord,
  AdminBroadcastRecord,
  AdminDataBundle,
  AdminDateRange,
  AdminKpiSnapshot,
  AdminOfficeRecord,
  AdminUserRecord,
  ProvisionUserInput,
  SaveOfficeInput,
  SaveServiceInput,
  SendBroadcastInput,
} from '../types/admin';
import { useQueue } from './QueueContext';

const adminSeed = rawAdminData as AdminDataBundle;

function cloneOffices(): AdminOfficeRecord[] {
  return adminSeed.offices.map((o) => ({
    ...o,
    windows: o.windows.map((w) => ({ ...w })),
    services: o.services.map((s) => ({ ...s })),
  }));
}

function cloneUsers(): AdminUserRecord[] {
  return adminSeed.users.map((u) => ({ ...u }));
}

function cloneAuditRecords(): AdminAuditRecord[] {
  return adminSeed.auditRecords.map((r) => ({ ...r }));
}

export interface AdminLoginResult {
  ok: boolean;
  admin?: AdminAccount;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface AdminContextValue {
  activeAdmin: AdminAccount;
  isAdminAuthenticated: boolean;
  loginAdmin: (adminId: string, password: string) => AdminLoginResult;
  logoutAdmin: () => void;

  // Overview & Broadcasts
  getKpiSnapshot: (range: AdminDateRange) => AdminKpiSnapshot;
  broadcasts: AdminBroadcastRecord[];
  sendBroadcast: (input: SendBroadcastInput) => { ok: boolean; recipientCount: number; error?: string };

  // Offices & Services
  offices: AdminOfficeRecord[];
  toggleOfficeStatus: (officeId: string) => void;
  toggleServiceStatus: (officeId: string, serviceId: string) => void;
  saveOffice: (input: SaveOfficeInput) => ActionResult;
  saveService: (officeId: string, input: SaveServiceInput) => ActionResult;
  resetOfficeSequence: (officeId: string) => ActionResult;

  // Users & Roles
  users: AdminUserRecord[];
  directoryTotalBadges: { staff: number; students: number; admins: number };
  provisionUser: (input: ProvisionUserInput) => ActionResult;
  updateStaffAssignment: (userId: string, officeId: string, defaultWindow: string) => ActionResult;
  resetUserPassword: (userId: string) => ActionResult;
  toggleAccountStatus: (userId: string) => ActionResult;

  // Audit Reports
  auditRecords: AdminAuditRecord[];
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const { showToast, triggerHaptic } = useQueue();

  const [activeAdmin, setActiveAdmin] = useState<AdminAccount>(
    () => ({ ...adminSeed.adminAccounts[0] })
  );
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [offices, setOffices] = useState<AdminOfficeRecord[]>(() => cloneOffices());
  const [users, setUsers] = useState<AdminUserRecord[]>(() => cloneUsers());
  const [broadcasts, setBroadcasts] = useState<AdminBroadcastRecord[]>([]);
  const [auditRecords] = useState<AdminAuditRecord[]>(() => cloneAuditRecords());

  const loginAdmin = useCallback((adminId: string, password: string): AdminLoginResult => {
    const cleanId = adminId.trim().toUpperCase();
    const match = adminSeed.adminAccounts.find(
      (acc) => acc.adminId.toUpperCase() === cleanId && acc.password === password
    );
    if (!match) return { ok: false };
    setActiveAdmin({ ...match });
    setIsAdminAuthenticated(true);
    return { ok: true, admin: match };
  }, []);

  const logoutAdmin = useCallback(() => {
    setIsAdminAuthenticated(false);
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
      const base = adminSeed.kpisByRange[range];
      return {
        ...base,
        activeWaiting: range === 'Yesterday' ? 0 : liveWaitingSum,
      };
    },
    [liveWaitingSum]
  );

  const sendBroadcast = useCallback(
    (input: SendBroadcastInput) => {
      const title = input.title.trim();
      const message = input.message.trim();
      if (!title || !message) {
        return { ok: false, recipientCount: 0, error: 'Title and message are required.' };
      }
      if (title.length > 60 || message.length > 200) {
        return { ok: false, recipientCount: 0, error: 'Broadcast exceeds maximum character limits.' };
      }

      let recipientCount = liveWaitingSum;
      let officeName: string | undefined;

      if (input.targetAudience === 'Specific Office Queue') {
        const office = offices.find((o) => o.id === input.officeId);
        if (!office) {
          return { ok: false, recipientCount: 0, error: 'Please select a target office.' };
        }
        recipientCount = office.activeWaitingCount;
        officeName = office.name;
      } else if (input.targetAudience === 'All Campus Staff') {
        recipientCount = users.filter((u) => u.role === 'staff' && u.status === 'active').length;
      }

      const record: AdminBroadcastRecord = {
        id: `bcast-${Date.now()}`,
        targetAudience: input.targetAudience,
        officeId: input.officeId,
        officeName,
        title,
        message,
        recipientCount,
        sentAt: new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }),
        sentBy: activeAdmin.adminId,
      };

      setBroadcasts((prev) => [record, ...prev]);
      triggerHaptic('success');
      const audienceNoun =
        input.targetAudience === 'All Campus Staff' ? 'active staff' : 'active students';
      showToast(`Broadcast sent to ${recipientCount} ${audienceNoun}.`, 'matcha');
      return { ok: true, recipientCount };
    },
    [activeAdmin.adminId, liveWaitingSum, offices, showToast, triggerHaptic, users]
  );

  const toggleOfficeStatus = useCallback(
    (officeId: string) => {
      let updatedName = '';
      setOffices((prev) =>
        prev.map((o) => {
          if (o.id !== officeId) return o;
          updatedName = o.shortLabel || o.name;
          return {
            ...o,
            status: o.status === 'open' ? 'closed' : 'open',
          };
        })
      );
      triggerHaptic('light');
      if (updatedName) {
        showToast(`${updatedName} queue status updated.`, 'matcha');
      }
    },
    [showToast, triggerHaptic]
  );

  const toggleServiceStatus = useCallback(
    (officeId: string, serviceId: string) => {
      setOffices((prev) =>
        prev.map((o) =>
          o.id !== officeId
            ? o
            : {
                ...o,
                services: o.services.map((s) =>
                  s.id === serviceId ? { ...s, isActive: !s.isActive } : s
                ),
              }
        )
      );
      triggerHaptic('light');
      showToast('Service catalog updated.', 'dark');
    },
    [showToast, triggerHaptic]
  );

  const saveOffice = useCallback(
    (input: SaveOfficeInput): ActionResult => {
      const cleanName = input.name.trim();
      const cleanPrefix = input.prefix.trim().toUpperCase();
      if (!cleanName) {
        return { ok: false, error: 'Office name is required.' };
      }
      if (!/^[A-Z]{1,2}$/.test(cleanPrefix)) {
        return { ok: false, error: 'Ticket prefix must be 1–2 uppercase letters (e.g., R or AC).' };
      }
      const duplicate = offices.find(
        (o) => o.prefix.toUpperCase() === cleanPrefix && o.id !== input.id
      );
      if (duplicate) {
        return { ok: false, error: `Prefix "${cleanPrefix}" is already used by ${duplicate.name}.` };
      }

      if (input.id) {
        setOffices((prev) =>
          prev.map((o) => {
            if (o.id !== input.id) return o;
            const nextWindows = Array.from({ length: input.windowCount }, (_, idx) => {
              const existing = o.windows[idx];
              return existing ?? { label: `Window ${idx + 1}`, status: 'Closed' as const };
            });
            return {
              ...o,
              name: cleanName,
              shortLabel: cleanName.replace(' Office', ''),
              prefix: cleanPrefix,
              locationDescription: input.locationDescription.trim(),
              windowCount: input.windowCount,
              dailyCapacityLimit: input.dailyCapacityLimit,
              windows: nextWindows,
            };
          })
        );
      } else {
        const slug = cleanName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
        const newOffice: AdminOfficeRecord = {
          id: `${slug || 'office'}-${Date.now().toString(36)}`,
          name: cleanName,
          shortLabel: cleanName.replace(' Office', ''),
          prefix: cleanPrefix,
          status: 'open',
          operatingHours: '08:00 AM – 05:00 PM',
          locationDescription: input.locationDescription.trim() || 'Main Campus Building',
          windowCount: input.windowCount,
          dailyCapacityLimit: input.dailyCapacityLimit,
          lastIssuedNumber: 0,
          activeWaitingCount: 0,
          avgWaitMinutes: 0,
          themeColor: '#0E8AA8',
          windows: Array.from({ length: input.windowCount }, (_, idx) => ({
            label: `Window ${idx + 1}`,
            status: idx === 0 ? 'Online' : 'Closed',
          })),
          services: [],
        };
        setOffices((prev) => [...prev, newOffice]);
      }

      triggerHaptic('success');
      showToast('Campus office saved.', 'matcha');
      return { ok: true };
    },
    [offices, showToast, triggerHaptic]
  );

  const saveService = useCallback(
    (officeId: string, input: SaveServiceInput): ActionResult => {
      const cleanName = input.name.trim();
      if (!cleanName) {
        return { ok: false, error: 'Service name is required.' };
      }
      if (!Number.isFinite(input.estimatedDurationMinutes) || input.estimatedDurationMinutes < 1) {
        return { ok: false, error: 'Estimated duration must be at least 1 minute.' };
      }

      setOffices((prev) =>
        prev.map((o) => {
          if (o.id !== officeId) return o;
          if (input.id) {
            return {
              ...o,
              services: o.services.map((s) =>
                s.id === input.id
                  ? {
                      ...s,
                      name: cleanName,
                      estimatedDurationMinutes: input.estimatedDurationMinutes,
                      requiredDocumentsNote: input.requiredDocumentsNote.trim(),
                      isActive: input.isActive,
                    }
                  : s
              ),
            };
          }
          const newService = {
            id: `srv-${Date.now().toString(36)}`,
            name: cleanName,
            estimatedDurationMinutes: input.estimatedDurationMinutes,
            requiredDocumentsNote: input.requiredDocumentsNote.trim(),
            isActive: input.isActive,
            waitingCount: 0,
          };
          return { ...o, services: [...o.services, newService] };
        })
      );

      triggerHaptic('success');
      showToast('Service catalog updated.', 'matcha');
      return { ok: true };
    },
    [showToast, triggerHaptic]
  );

  const resetOfficeSequence = useCallback(
    (officeId: string): ActionResult => {
      const target = offices.find((o) => o.id === officeId);
      if (!target) return { ok: false, error: 'Office not found.' };
      if (target.activeWaitingCount > 0) {
        triggerHaptic('warning');
        return {
          ok: false,
          error: `Cannot reset while ${target.activeWaitingCount} tickets are still active`,
        };
      }

      setOffices((prev) =>
        prev.map((o) => (o.id === officeId ? { ...o, lastIssuedNumber: 0 } : o))
      );
      triggerHaptic('success');
      showToast(`${target.shortLabel} sequence reset to ${target.prefix}-001.`, 'matcha');
      return { ok: true };
    },
    [offices, showToast, triggerHaptic]
  );

  const provisionUser = useCallback(
    (input: ProvisionUserInput): ActionResult => {
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

      let assignedOfficeName: string | undefined;
      if (input.role === 'staff') {
        const office = offices.find((o) => o.id === input.assignedOfficeId);
        if (!office) {
          return { ok: false, error: 'Please assign a campus office for staff accounts.' };
        }
        assignedOfficeName = office.name;
      }

      const newUser: AdminUserRecord = {
        id: `u-${input.role}-${Date.now().toString(36)}`,
        identifier: cleanId,
        fullName: cleanName,
        email: cleanEmail,
        role: input.role,
        status: 'active',
        assignedOfficeId: input.role === 'staff' ? input.assignedOfficeId : undefined,
        assignedOfficeName,
        defaultWindow: input.role === 'staff' ? 'Window 1' : undefined,
        mustChangePassword: true,
      };

      setUsers((prev) => [newUser, ...prev]);
      triggerHaptic('success');
      showToast(`Account ${cleanId} provisioned successfully.`, 'matcha');
      return { ok: true };
    },
    [offices, showToast, triggerHaptic, users]
  );

  const updateStaffAssignment = useCallback(
    (userId: string, officeId: string, defaultWindow: string): ActionResult => {
      const office = offices.find((o) => o.id === officeId);
      if (!office) return { ok: false, error: 'Selected office not found.' };

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                assignedOfficeId: office.id,
                assignedOfficeName: office.name,
                defaultWindow,
              }
            : u
        )
      );
      triggerHaptic('success');
      showToast('Staff office assignment updated.', 'matcha');
      return { ok: true };
    },
    [offices, showToast, triggerHaptic]
  );

  const resetUserPassword = useCallback(
    (userId: string): ActionResult => {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, mustChangePassword: true } : u))
      );
      triggerHaptic('success');
      showToast('Password reset to default.', 'matcha');
      return { ok: true };
    },
    [showToast, triggerHaptic]
  );

  const toggleAccountStatus = useCallback(
    (userId: string): ActionResult => {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, status: u.status === 'active' ? 'suspended' : 'active' }
            : u
        )
      );
      triggerHaptic('warning');
      showToast('Account status updated.', 'dark');
      return { ok: true };
    },
    [showToast, triggerHaptic]
  );

  const directoryTotalBadges = useMemo(() => {
    const baseStaffCount = adminSeed.users.filter((u) => u.role === 'staff').length;
    const baseAdminCount = adminSeed.users.filter((u) => u.role === 'admin').length;
    const currentStaffCount = users.filter((u) => u.role === 'staff').length;
    const currentAdminCount = users.filter((u) => u.role === 'admin').length;
    return {
      staff: adminSeed.directoryTotalBadges.staff + (currentStaffCount - baseStaffCount),
      students: adminSeed.directoryTotalBadges.students,
      admins: adminSeed.directoryTotalBadges.admins + (currentAdminCount - baseAdminCount),
    };
  }, [users]);

  const value = useMemo<AdminContextValue>(
    () => ({
      activeAdmin,
      isAdminAuthenticated,
      loginAdmin,
      logoutAdmin,
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
    }),
    [
      activeAdmin,
      auditRecords,
      broadcasts,
      directoryTotalBadges,
      getKpiSnapshot,
      isAdminAuthenticated,
      loginAdmin,
      logoutAdmin,
      offices,
      provisionUser,
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
