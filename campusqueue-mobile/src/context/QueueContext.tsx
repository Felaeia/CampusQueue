import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import rawMockData from '../data/mockData.json';
import rawStaffData from '../data/staffRegistrarData.json';
import {
  ActiveTicket,
  AuthDefaults,
  HistoryFilterOption,
  HistoryTicket,
  IssueTicketInput,
  MockDataBundle,
  NotificationItem,
  Office,
  StudentAccountSeed,
  StudentProfile,
  ToastMessage,
  ToastTone,
} from '../types/queue';
import { StaffAccountRecord, StaffRegistrarDataBundle } from '../types/staff';

const mockData = rawMockData as MockDataBundle;
const staffData = rawStaffData as StaffRegistrarDataBundle;

interface StudentAccountState {
  profile: StudentProfile;
  password: string;
  mustChangePassword: boolean;
  historicalBasePassCount: number;
  activeTickets: ActiveTicket[];
  historyTickets: HistoryTicket[];
  notifications: NotificationItem[];
}

function cloneStudentAccounts(): Record<string, StudentAccountState> {
  const map: Record<string, StudentAccountState> = {};
  for (const acc of mockData.studentAccounts as StudentAccountSeed[]) {
    map[acc.profile.usn] = {
      profile: { ...acc.profile },
      password: acc.password,
      mustChangePassword: acc.mustChangePassword,
      historicalBasePassCount: acc.historicalBasePassCount,
      activeTickets: acc.activeTickets.map((t) => ({ ...t, trackNodes: [...t.trackNodes] })),
      historyTickets: acc.historyTickets.map((h) => ({ ...h })),
      notifications: acc.notifications.map((n) => ({ ...n })),
    };
  }
  return map;
}

function cloneOffices(): Office[] {
  return mockData.offices.map((office) => ({
    ...office,
    services: office.services.map((srv) => ({ ...srv })),
  }));
}

export interface StudentLoginResult {
  ok: boolean;
  requiresPasswordChange?: boolean;
  profile?: StudentProfile;
}

export interface StaffLoginResult {
  ok: boolean;
  staff?: StaffAccountRecord;
}

export interface QueueContextValue {
  authDefaults: AuthDefaults;
  studentAccounts: StudentProfile[];
  studentProfile: StudentProfile;
  accountPassword: string;
  mustChangePassword: boolean;
  offices: Office[];
  activeTickets: ActiveTicket[];
  selectedTicketId: string;
  currentHeroTicket: ActiveTicket | null;
  historyTickets: HistoryTicket[];
  notifications: NotificationItem[];
  unreadNotificationsCount: number;
  cancelReasons: string[];
  historyFilters: HistoryFilterOption[];
  historicalBasePassCount: number;
  barcodePattern: number[];
  toast: ToastMessage | null;
  calledAlertTicket: ActiveTicket | null;
  loginResetNonce: number;
  staffAccounts: StaffAccountRecord[];
  activeStaff: StaffAccountRecord;
  loginStudent: (usn: string, password: string) => StudentLoginResult;
  loginStaff: (staffId: string, password: string) => StaffLoginResult;
  setSelectedTicketId: (id: string) => void;
  setCalledAlertTicket: (ticket: ActiveTicket | null) => void;
  showToast: (message: string, tone?: ToastTone) => void;
  triggerHaptic: (kind?: 'light' | 'success' | 'warning') => void;
  bumpLoginReset: () => void;
  updatePassword: (newPassword: string) => void;
  togglePushAlerts: () => void;
  toggleSoundAndHaptics: () => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  issueTicket: (input: IssueTicketInput) => ActiveTicket | null;
  cancelTicket: (ticketId: string, reason: string) => boolean;
  advanceQueue: () => 'completed' | 'called' | 'advanced' | 'empty';
  resetSimulation: () => void;
}

const QueueContext = createContext<QueueContextValue | null>(null);

export function QueueProvider({ children }: { children: React.ReactNode }) {
  const initialStudentMap = useMemo(() => cloneStudentAccounts(), []);

  const [studentMap, setStudentMap] = useState<Record<string, StudentAccountState>>(
    initialStudentMap
  );
  const [activeStudentUsn, setActiveStudentUsn] = useState<string>(mockData.authDefaults.defaultUsn);
  const [activeStaff, setActiveStaff] = useState<StaffAccountRecord>(() => ({
    ...staffData.staffAccounts[0],
  }));
  const [loginResetNonce, setLoginResetNonce] = useState<number>(0);

  const [offices, setOffices] = useState<Office[]>(() => cloneOffices());
  const [selectedTicketId, setSelectedTicketId] = useState<string>(
    initialStudentMap[mockData.authDefaults.defaultUsn]?.activeTickets[0]?.id ?? ''
  );

  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [calledAlertTicket, setCalledAlertTicket] = useState<ActiveTicket | null>(null);

  const currentAccount = studentMap[activeStudentUsn] ?? Object.values(studentMap)[0];
  const studentProfile = currentAccount.profile;
  const activeTickets = currentAccount.activeTickets;
  const historyTickets = currentAccount.historyTickets;
  const notifications = currentAccount.notifications;

  const triggerHaptic = useCallback(
    (kind: 'light' | 'success' | 'warning' = 'light') => {
      if (!studentProfile.soundAndHaptics || Platform.OS === 'web') return;
      if (kind === 'success') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (kind === 'warning') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    [studentProfile.soundAndHaptics]
  );

  const showToast = useCallback((message: string, tone: ToastTone = 'dark') => {
    setToast({ message, tone, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (activeTickets.length === 0) return;
    if (!activeTickets.some((ticket) => ticket.id === selectedTicketId)) {
      setSelectedTicketId(activeTickets[0].id);
    }
  }, [activeTickets, selectedTicketId]);

  const currentHeroTicket = useMemo(
    () => activeTickets.find((ticket) => ticket.id === selectedTicketId) ?? activeTickets[0] ?? null,
    [activeTickets, selectedTicketId]
  );

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications]
  );

  const studentAccountsList = useMemo(
    () => Object.values(studentMap).map((acc) => acc.profile),
    [studentMap]
  );

  const loginStudent = useCallback(
    (usn: string, password: string): StudentLoginResult => {
      const cleanUsn = usn.trim();
      const account = studentMap[cleanUsn];
      if (!account || account.password !== password) {
        return { ok: false };
      }
      setActiveStudentUsn(cleanUsn);
      setSelectedTicketId(account.activeTickets[0]?.id ?? '');
      const requiresPasswordChange =
        password === mockData.authDefaults.defaultPassword && account.mustChangePassword;
      return { ok: true, requiresPasswordChange, profile: account.profile };
    },
    [studentMap]
  );

  const loginStaff = useCallback((staffId: string, password: string): StaffLoginResult => {
    const cleanId = staffId.trim().toUpperCase();
    const match = staffData.staffAccounts.find(
      (acc) => acc.staffId.toUpperCase() === cleanId && acc.password === password
    );
    if (!match) return { ok: false };
    setActiveStaff({ ...match });
    return { ok: true, staff: match };
  }, []);

  const bumpLoginReset = useCallback(() => {
    setLoginResetNonce((prev) => prev + 1);
  }, []);

  const updatePassword = useCallback(
    (newPassword: string) => {
      setStudentMap((prev) => {
        const acc = prev[activeStudentUsn];
        if (!acc) return prev;
        return {
          ...prev,
          [activeStudentUsn]: { ...acc, password: newPassword, mustChangePassword: false },
        };
      });
    },
    [activeStudentUsn]
  );

  const togglePushAlerts = useCallback(() => {
    setStudentMap((prev) => {
      const acc = prev[activeStudentUsn];
      if (!acc) return prev;
      return {
        ...prev,
        [activeStudentUsn]: {
          ...acc,
          profile: { ...acc.profile, pushAlerts: !acc.profile.pushAlerts },
        },
      };
    });
    showToast('Push notifications updated', 'dark');
  }, [activeStudentUsn, showToast]);

  const toggleSoundAndHaptics = useCallback(() => {
    setStudentMap((prev) => {
      const acc = prev[activeStudentUsn];
      if (!acc) return prev;
      return {
        ...prev,
        [activeStudentUsn]: {
          ...acc,
          profile: { ...acc.profile, soundAndHaptics: !acc.profile.soundAndHaptics },
        },
      };
    });
    showToast('Sound & vibration alerts updated', 'dark');
  }, [activeStudentUsn, showToast]);

  const markNotificationRead = useCallback(
    (id: string) => {
      setStudentMap((prev) => {
        const acc = prev[activeStudentUsn];
        if (!acc) return prev;
        return {
          ...prev,
          [activeStudentUsn]: {
            ...acc,
            notifications: acc.notifications.map((item) =>
              item.id === id ? { ...item, read: true } : item
            ),
          },
        };
      });
    },
    [activeStudentUsn]
  );

  const markAllNotificationsRead = useCallback(() => {
    setStudentMap((prev) => {
      const acc = prev[activeStudentUsn];
      if (!acc) return prev;
      return {
        ...prev,
        [activeStudentUsn]: {
          ...acc,
          notifications: acc.notifications.map((item) => ({ ...item, read: true })),
        },
      };
    });
    showToast('All notifications marked as read', 'dark');
  }, [activeStudentUsn, showToast]);

  const issueTicket = useCallback(
    ({ officeId, serviceName, notes }: IssueTicketInput): ActiveTicket | null => {
      const office = offices.find((o) => o.id === officeId);
      if (!office) return null;

      const nextSeq = office.lastIssuedNumber + 1;
      const formattedCode = `${office.prefix}-${String(nextSeq).padStart(3, '0')}`;
      const servingSeq = parseInt(office.nowServing.split('-')[1] || '1', 10);
      const ahead = Math.max(1, nextSeq - servingSeq);
      const intermediateNodes: string[] = [];
      for (let n = servingSeq + 1; n < nextSeq && intermediateNodes.length < 2; n++) {
        intermediateNodes.push(String(n).padStart(3, '0'));
      }

      const newTicket: ActiveTicket = {
        id: formattedCode,
        ticketNumber: formattedCode,
        sequence: nextSeq,
        officeId: office.id,
        officeName: office.name,
        shortOffice: office.name.replace(' Office', ''),
        counter: office.windowLabel,
        status: 'waiting',
        service: serviceName,
        holderShort: studentProfile.holderShort,
        studentUsn: studentProfile.usn,
        serial: `CQ-2026-${formattedCode}`,
        qrPayload: `cq:v1:${formattedCode}:${studentProfile.usn}`,
        issuedAt: '11-23 11:58 AM',
        estWaitMins: ahead * 4,
        aheadCount: ahead,
        nowServing: office.nowServing,
        trackNodes: intermediateNodes,
        notes: notes || '',
      };

      setStudentMap((prev) => {
        const acc = prev[activeStudentUsn];
        if (!acc) return prev;
        return {
          ...prev,
          [activeStudentUsn]: {
            ...acc,
            activeTickets: [...acc.activeTickets, newTicket],
          },
        };
      });
      setOffices((prev) =>
        prev.map((o) =>
          o.id === officeId
            ? { ...o, lastIssuedNumber: nextSeq, waitingCount: o.waitingCount + 1 }
            : o
        )
      );
      setSelectedTicketId(formattedCode);
      triggerHaptic('success');
      showToast(`Ticket ${formattedCode} issued!`, 'matcha');
      return newTicket;
    },
    [activeStudentUsn, offices, showToast, studentProfile, triggerHaptic]
  );

  const cancelTicket = useCallback(
    (ticketId: string, reason: string): boolean => {
      const target = activeTickets.find((t) => t.id === ticketId);
      if (!target) return false;
      setStudentMap((prev) => {
        const acc = prev[activeStudentUsn];
        if (!acc) return prev;
        return {
          ...prev,
          [activeStudentUsn]: {
            ...acc,
            activeTickets: acc.activeTickets.filter((t) => t.id !== ticketId),
            historyTickets: [
              {
                id: `${target.ticketNumber}-${Date.now()}`,
                ticketNumber: target.ticketNumber,
                officeId: target.officeId,
                officeName: target.officeName,
                service: target.service,
                status: 'Cancelled',
                timestamp: 'Nov 23, 2026 • 11:58 AM',
                issuedAt: target.issuedAt,
                calledAt: '—',
                counter: target.counter,
                waitDuration: '02 mins',
                reason,
              },
              ...acc.historyTickets,
            ],
          },
        };
      });
      triggerHaptic('warning');
      showToast(`Ticket ${target.ticketNumber} cancelled`, 'warning');
      return true;
    },
    [activeStudentUsn, activeTickets, showToast, triggerHaptic]
  );

  const advanceQueue = useCallback((): 'completed' | 'called' | 'advanced' | 'empty' => {
    if (!currentHeroTicket) return 'empty';
    return 'advanced';
  }, [currentHeroTicket]);

  const resetSimulation = useCallback(() => {
    const fresh = cloneStudentAccounts();
    setStudentMap(fresh);
    setOffices(cloneOffices());
    setSelectedTicketId(fresh[activeStudentUsn]?.activeTickets[0]?.id ?? '');
    setCalledAlertTicket(null);
  }, [activeStudentUsn]);

  const value: QueueContextValue = {
    authDefaults: mockData.authDefaults,
    studentAccounts: studentAccountsList,
    studentProfile,
    accountPassword: currentAccount.password,
    mustChangePassword: currentAccount.mustChangePassword,
    offices,
    activeTickets,
    selectedTicketId,
    currentHeroTicket,
    historyTickets,
    notifications,
    unreadNotificationsCount,
    cancelReasons: mockData.cancelReasons,
    historyFilters: mockData.historyFilters,
    historicalBasePassCount: currentAccount.historicalBasePassCount,
    barcodePattern: mockData.barcodePattern,
    toast,
    calledAlertTicket,
    loginResetNonce,
    staffAccounts: staffData.staffAccounts,
    activeStaff,
    loginStudent,
    loginStaff,
    setSelectedTicketId,
    setCalledAlertTicket,
    showToast,
    triggerHaptic,
    bumpLoginReset,
    updatePassword,
    togglePushAlerts,
    toggleSoundAndHaptics,
    markNotificationRead,
    markAllNotificationsRead,
    issueTicket,
    cancelTicket,
    advanceQueue,
    resetSimulation,
  };

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}

export function useQueue(): QueueContextValue {
  const ctx = useContext(QueueContext);
  if (!ctx) {
    throw new Error('useQueue must be used within a QueueProvider');
  }
  return ctx;
}
