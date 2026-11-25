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
import {
  DeskStatus,
  ProcessedTransaction,
  StaffAccountRecord,
  StaffQueueTicket,
  StaffRegistrarDataBundle,
} from '../types/staff';

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

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}m ${seconds}s`;
}

function getCurrentClockLabel(): string {
  const now = new Date();
  return now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function getShortTimestampLabel(): string {
  return `Nov 25, 2026 • ${getCurrentClockLabel()}`;
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

function cloneInitialRegistrarQueue() {
  return {
    serving: { ...staffData.desk.initialServing },
    waiting: staffData.desk.initialWaiting.map((t) => ({ ...t })),
    transactions: staffData.logs.transactions.map((tx) => ({ ...tx })),
  };
}

/**
 * Recomputes a student's active Registrar ticket position against the live Registrar queue.
 */
function syncStudentRegistrarTickets(
  accounts: Record<string, StudentAccountState>,
  serving: StaffQueueTicket | null,
  waiting: StaffQueueTicket[],
  counterWindow: string
): Record<string, StudentAccountState> {
  const nowServingCode = serving?.ticketNumber ?? '—';
  const nextAccounts: Record<string, StudentAccountState> = {};

  for (const [usn, acc] of Object.entries(accounts)) {
    let changed = false;
    const updatedActive = acc.activeTickets.map((ticket) => {
      if (ticket.officeId !== 'registrar') return ticket;

      if (serving && serving.ticketNumber === ticket.ticketNumber) {
        changed = true;
        return {
          ...ticket,
          status: 'serving' as const,
          aheadCount: 0,
          estWaitMins: 0,
          nowServing: serving.ticketNumber,
          trackNodes: [],
          counter: counterWindow,
        };
      }

      const waitIndex = waiting.findIndex((w) => w.ticketNumber === ticket.ticketNumber);
      if (waitIndex !== -1) {
        const ahead = waitIndex + (serving ? 1 : 0);
        const nodes = waiting
          .slice(0, waitIndex)
          .slice(0, 2)
          .map((w) => w.ticketNumber.split('-')[1] ?? w.ticketNumber);
        changed = true;
        return {
          ...ticket,
          status: 'waiting' as const,
          aheadCount: ahead,
          estWaitMins: ahead * 4,
          nowServing: nowServingCode,
          trackNodes: nodes,
          counter: counterWindow,
        };
      }

      return ticket;
    });

    nextAccounts[usn] = changed ? { ...acc, activeTickets: updatedActive } : acc;
  }

  return nextAccounts;
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

  // Staff Registrar synced state
  staffAccounts: StaffAccountRecord[];
  activeStaff: StaffAccountRecord;
  deskConfig: StaffRegistrarDataBundle['desk'];
  scannerConfig: StaffRegistrarDataBundle['scanner'];
  logsConfig: StaffRegistrarDataBundle['logs'];
  staffCounterWindow: string;
  staffDeskStatus: DeskStatus;
  staffServingTicket: StaffQueueTicket | null;
  staffWaitingQueue: StaffQueueTicket[];
  staffElapsedSeconds: number;
  staffRecallCount: number;
  staffTransactions: ProcessedTransaction[];
  staffServedByMeCount: number;
  staffOfficeCompletedCount: number;
  staffSkippedCount: number;

  // Auth & profile actions
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

  // Student queue actions
  issueTicket: (input: IssueTicketInput) => ActiveTicket | null;
  cancelTicket: (ticketId: string, reason: string) => boolean;
  advanceQueue: () => 'completed' | 'called' | 'advanced' | 'empty';
  resetSimulation: () => void;

  // Staff registrar actions (synced with student portal)
  setStaffCounterWindow: (windowLabel: string) => void;
  setStaffDeskStatus: (status: DeskStatus) => void;
  staffCallNext: () => StaffQueueTicket | null;
  staffCompleteCurrent: (
    advance: boolean,
    remarks?: string
  ) => { completedNumber?: string; nextTicket?: StaffQueueTicket };
  staffSendRecall: () => number;
  staffSkipCurrent: (reason?: string) => {
    skippedNumber?: string;
    nextTicket?: StaffQueueTicket;
  };
  staffMarkTicketVerified: (ticketNumber: string) => void;
}

const QueueContext = createContext<QueueContextValue | null>(null);

export function QueueProvider({ children }: { children: React.ReactNode }) {
  const initialStudentMap = useMemo(() => cloneStudentAccounts(), []);
  const initialRegistrar = useMemo(() => cloneInitialRegistrarQueue(), []);

  const [studentMap, setStudentMap] = useState<Record<string, StudentAccountState>>(
    initialStudentMap
  );
  const [activeStudentUsn, setActiveStudentUsn] = useState<string>(mockData.authDefaults.defaultUsn);
  const [loginResetNonce, setLoginResetNonce] = useState<number>(0);

  const [offices, setOffices] = useState<Office[]>(() => cloneOffices());
  const [selectedTicketId, setSelectedTicketId] = useState<string>(
    initialStudentMap[mockData.authDefaults.defaultUsn]?.activeTickets[0]?.id ?? ''
  );

  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [calledAlertTicket, setCalledAlertTicket] = useState<ActiveTicket | null>(null);

  // Shared live Registrar Staff state
  const [activeStaff, setActiveStaff] = useState<StaffAccountRecord>(
    () => ({ ...staffData.staffAccounts[0] })
  );
  const [staffCounterWindow, setStaffCounterWindowState] = useState<string>(
    staffData.staffAccounts[0].defaultCounterWindow
  );
  const [staffDeskStatus, setStaffDeskStatus] = useState<DeskStatus>('online');
  const [staffServingTicket, setStaffServingTicket] = useState<StaffQueueTicket | null>(
    initialRegistrar.serving
  );
  const [staffWaitingQueue, setStaffWaitingQueue] = useState<StaffQueueTicket[]>(
    initialRegistrar.waiting
  );
  const [staffElapsedSeconds, setStaffElapsedSeconds] = useState<number>(
    staffData.desk.initialElapsedSeconds
  );
  const [staffRecallCount, setStaffRecallCount] = useState<number>(0);
  const [staffTransactions, setStaffTransactions] = useState<ProcessedTransaction[]>(
    initialRegistrar.transactions
  );
  const [staffServedByMeCount, setStaffServedByMeCount] = useState<number>(
    parseInt(staffData.logs.kpis.servedByMe, 10) || 34
  );
  const [staffOfficeCompletedCount, setStaffOfficeCompletedCount] = useState<number>(
    parseInt(staffData.logs.kpis.officeCompleted, 10) || 68
  );
  const [staffSkippedCount, setStaffSkippedCount] = useState<number>(
    parseInt(staffData.logs.kpis.skipped, 10) || 3
  );

  const currentAccount =
    studentMap[activeStudentUsn] ?? Object.values(studentMap)[0];
  const studentProfile = currentAccount.profile;
  const activeTickets = currentAccount.activeTickets;
  const historyTickets = currentAccount.historyTickets;
  const notifications = currentAccount.notifications;

  // Live service timer on Registrar Desk
  useEffect(() => {
    if (!staffServingTicket || staffDeskStatus !== 'online') return;
    const interval = setInterval(() => {
      setStaffElapsedSeconds((seconds) => seconds + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [staffServingTicket, staffDeskStatus]);

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

  const syncRegistrarOfficeSummary = useCallback(
    (
      nextServing: StaffQueueTicket | null,
      nextWaiting: StaffQueueTicket[],
      windowLabel: string,
      officerName: string
    ) => {
      setOffices((prev) =>
        prev.map((office) =>
          office.id === 'registrar'
            ? {
                ...office,
                nowServing: nextServing?.ticketNumber ?? office.nowServing,
                waitingCount: nextWaiting.length,
                windowLabel,
                officerName,
              }
            : office
        )
      );
    },
    []
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

  const loginStaff = useCallback(
    (staffId: string, password: string): StaffLoginResult => {
      const cleanId = staffId.trim().toUpperCase();
      const match = staffData.staffAccounts.find(
        (acc) => acc.staffId.toUpperCase() === cleanId && acc.password === password
      );
      if (!match) return { ok: false };

      setActiveStaff({ ...match });
      setStaffCounterWindowState(match.defaultCounterWindow);
      syncRegistrarOfficeSummary(
        staffServingTicket,
        staffWaitingQueue,
        match.defaultCounterWindow,
        match.staffName
      );
      return { ok: true, staff: match };
    },
    [staffServingTicket, staffWaitingQueue, syncRegistrarOfficeSummary]
  );

  const setStaffCounterWindow = useCallback(
    (windowLabel: string) => {
      setStaffCounterWindowState(windowLabel);
      syncRegistrarOfficeSummary(
        staffServingTicket,
        staffWaitingQueue,
        windowLabel,
        activeStaff.staffName
      );
      setStudentMap((prev) =>
        syncStudentRegistrarTickets(prev, staffServingTicket, staffWaitingQueue, windowLabel)
      );
    },
    [activeStaff.staffName, staffServingTicket, staffWaitingQueue, syncRegistrarOfficeSummary]
  );

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
          [activeStudentUsn]: {
            ...acc,
            password: newPassword,
            mustChangePassword: false,
          },
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
      const nowTime = getCurrentClockLabel();
      const serial = `CQ-2026-${formattedCode}`;
      const qrPayload = `cq:v1:${formattedCode}:${studentProfile.usn}`;

      let ahead: number;
      let intermediateNodes: string[];
      let nowServingCode: string;
      let counterLabel = office.windowLabel;

      if (officeId === 'registrar') {
        const nextStaffTicket: StaffQueueTicket = {
          id: formattedCode,
          ticketNumber: formattedCode,
          studentName: studentProfile.fullName,
          usn: studentProfile.usn,
          program: studentProfile.program,
          serviceType: serviceName,
          waitMinutes: Math.max(4, (staffWaitingQueue.length + 1) * 4),
          issuedAt: nowTime,
          notes: notes?.trim() || undefined,
          isQrVerified: false,
        };
        const updatedWaiting = [...staffWaitingQueue, nextStaffTicket];
        setStaffWaitingQueue(updatedWaiting);

        ahead = staffWaitingQueue.length + (staffServingTicket ? 1 : 0);
        intermediateNodes = staffWaitingQueue
          .slice(0, 2)
          .map((w) => w.ticketNumber.split('-')[1] ?? w.ticketNumber);
        nowServingCode = staffServingTicket?.ticketNumber ?? office.nowServing;
        counterLabel = staffCounterWindow;
      } else {
        const servingSeq = parseInt(office.nowServing.split('-')[1] || '1', 10);
        ahead = Math.max(1, nextSeq - servingSeq);
        intermediateNodes = [];
        for (let n = servingSeq + 1; n < nextSeq && intermediateNodes.length < 2; n++) {
          intermediateNodes.push(String(n).padStart(3, '0'));
        }
        nowServingCode = office.nowServing;
      }

      const newTicket: ActiveTicket = {
        id: formattedCode,
        ticketNumber: formattedCode,
        sequence: nextSeq,
        officeId: office.id,
        officeName: office.name,
        shortOffice: office.name.replace(' Office', ''),
        counter: counterLabel,
        status: 'waiting',
        service: serviceName,
        holderShort: studentProfile.holderShort,
        studentUsn: studentProfile.usn,
        serial,
        qrPayload,
        issuedAt: `11-25 ${nowTime}`,
        estWaitMins: ahead * 4,
        aheadCount: ahead,
        nowServing: nowServingCode,
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
            notifications: [
              {
                id: `n-${Date.now()}`,
                title: `Queue Pass ${formattedCode} Issued`,
                message: `${office.name} • ${serviceName}`,
                time: 'Just now',
                read: false,
                dotColor: office.themeColor,
              },
              ...acc.notifications,
            ],
          },
        };
      });

      setOffices((prev) =>
        prev.map((o) =>
          o.id === officeId
            ? {
                ...o,
                lastIssuedNumber: nextSeq,
                waitingCount: o.waitingCount + 1,
              }
            : o
        )
      );

      setSelectedTicketId(formattedCode);
      triggerHaptic('success');
      showToast(`Ticket ${formattedCode} issued!`, 'matcha');
      return newTicket;
    },
    [
      activeStudentUsn,
      offices,
      showToast,
      staffCounterWindow,
      staffServingTicket,
      staffWaitingQueue,
      studentProfile,
      triggerHaptic,
    ]
  );

  const cancelTicket = useCallback(
    (ticketId: string, reason: string): boolean => {
      const target = activeTickets.find((t) => t.id === ticketId);
      if (!target) return false;

      let nextServing = staffServingTicket;
      let nextWaiting = staffWaitingQueue;

      if (target.officeId === 'registrar') {
        if (staffServingTicket?.ticketNumber === target.ticketNumber) {
          nextServing = null;
          setStaffServingTicket(null);
          setStaffElapsedSeconds(0);
        } else {
          nextWaiting = staffWaitingQueue.filter((t) => t.ticketNumber !== target.ticketNumber);
          setStaffWaitingQueue(nextWaiting);
        }
      }

      setStudentMap((prev) => {
        const acc = prev[activeStudentUsn];
        if (!acc) return prev;
        const updatedMap: Record<string, StudentAccountState> = {
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
                timestamp: getShortTimestampLabel(),
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
        return target.officeId === 'registrar'
          ? syncStudentRegistrarTickets(updatedMap, nextServing, nextWaiting, staffCounterWindow)
          : updatedMap;
      });

      setOffices((prev) =>
        prev.map((o) =>
          o.id === target.officeId
            ? {
                ...o,
                waitingCount:
                  target.officeId === 'registrar'
                    ? nextWaiting.length
                    : Math.max(0, o.waitingCount - 1),
              }
            : o
        )
      );

      triggerHaptic('warning');
      showToast(`Ticket ${target.ticketNumber} cancelled`, 'warning');
      return true;
    },
    [
      activeStudentUsn,
      activeTickets,
      showToast,
      staffCounterWindow,
      staffServingTicket,
      staffWaitingQueue,
      triggerHaptic,
    ]
  );

  // Helper to record a completed/skipped Registrar ticket into the matching Student's History & remove from Active
  const finalizeStudentRegistrarTicket = useCallback(
    (
      processed: StaffQueueTicket | null,
      outcome: 'Completed' | 'Skipped',
      nextServing: StaffQueueTicket | null,
      nextWaiting: StaffQueueTicket[],
      durationLabel: string
    ) => {
      setStudentMap((prev) => {
        const nextMap: Record<string, StudentAccountState> = { ...prev };

        if (processed && nextMap[processed.usn]) {
          const owner = nextMap[processed.usn];
          const activeMatch = owner.activeTickets.find(
            (t) => t.ticketNumber === processed.ticketNumber
          );
          if (activeMatch) {
            nextMap[processed.usn] = {
              ...owner,
              activeTickets: owner.activeTickets.filter(
                (t) => t.ticketNumber !== processed.ticketNumber
              ),
              historyTickets: [
                {
                  id: `${processed.ticketNumber}-${Date.now()}`,
                  ticketNumber: processed.ticketNumber,
                  officeId: 'registrar',
                  officeName: 'Registrar Office',
                  service: processed.serviceType,
                  status: outcome,
                  timestamp: getShortTimestampLabel(),
                  issuedAt: activeMatch.issuedAt,
                  calledAt: getShortTimestampLabel(),
                  counter: staffCounterWindow,
                  waitDuration: durationLabel,
                },
                ...owner.historyTickets,
              ],
            };
          }
        }

        if (nextServing && nextMap[nextServing.usn]) {
          const calledOwner = nextMap[nextServing.usn];
          nextMap[nextServing.usn] = {
            ...calledOwner,
            notifications: [
              {
                id: `n-${Date.now()}`,
                title: `It's Your Turn! Ticket ${nextServing.ticketNumber}`,
                message: `Please proceed immediately to Registrar Office (${staffCounterWindow}).`,
                time: 'Just now',
                read: false,
                dotColor: '#B8F23A',
              },
              ...calledOwner.notifications,
            ],
          };
        }

        return syncStudentRegistrarTickets(nextMap, nextServing, nextWaiting, staffCounterWindow);
      });
    },
    [staffCounterWindow]
  );

  const staffCallNext = useCallback((): StaffQueueTicket | null => {
    if (staffWaitingQueue.length === 0) return null;
    const [nextTicket, ...rest] = staffWaitingQueue;
    setStaffServingTicket(nextTicket);
    setStaffWaitingQueue(rest);
    setStaffElapsedSeconds(0);
    setStaffRecallCount(0);

    syncRegistrarOfficeSummary(nextTicket, rest, staffCounterWindow, activeStaff.staffName);
    finalizeStudentRegistrarTicket(null, 'Completed', nextTicket, rest, '00m 00s');
    return nextTicket;
  }, [
    activeStaff.staffName,
    finalizeStudentRegistrarTicket,
    staffCounterWindow,
    staffWaitingQueue,
    syncRegistrarOfficeSummary,
  ]);

  const staffCompleteCurrent = useCallback(
    (advance: boolean, remarks?: string) => {
      const completed = staffServingTicket;
      const durationLabel = formatDuration(staffElapsedSeconds);
      setStaffRecallCount(0);

      if (completed) {
        const nowLabel = getCurrentClockLabel();
        const newTx: ProcessedTransaction = {
          id: `tx-${Date.now()}`,
          ticketNumber: completed.ticketNumber,
          studentName: completed.studentName,
          usn: completed.usn,
          serviceType: completed.serviceType,
          outcome: 'Completed',
          counterWindow: staffCounterWindow,
          staffName: activeStaff.staffName,
          issuedAt: completed.issuedAt,
          calledAt: nowLabel,
          verifiedAt: completed.isQrVerified ? nowLabel : undefined,
          closedAt: nowLabel,
          durationFormatted: durationLabel,
          remarks: remarks?.trim() || undefined,
        };
        setStaffTransactions((prev) => [newTx, ...prev]);
        setStaffServedByMeCount((count) => count + 1);
        setStaffOfficeCompletedCount((count) => count + 1);
      }

      if (advance && staffWaitingQueue.length > 0) {
        const [nextTicket, ...rest] = staffWaitingQueue;
        setStaffServingTicket(nextTicket);
        setStaffWaitingQueue(rest);
        setStaffElapsedSeconds(0);
        syncRegistrarOfficeSummary(nextTicket, rest, staffCounterWindow, activeStaff.staffName);
        finalizeStudentRegistrarTicket(completed, 'Completed', nextTicket, rest, durationLabel);
        return { completedNumber: completed?.ticketNumber, nextTicket };
      }

      setStaffServingTicket(null);
      setStaffElapsedSeconds(0);
      syncRegistrarOfficeSummary(null, staffWaitingQueue, staffCounterWindow, activeStaff.staffName);
      finalizeStudentRegistrarTicket(
        completed,
        'Completed',
        null,
        staffWaitingQueue,
        durationLabel
      );
      return { completedNumber: completed?.ticketNumber };
    },
    [
      activeStaff.staffName,
      finalizeStudentRegistrarTicket,
      staffCounterWindow,
      staffElapsedSeconds,
      staffServingTicket,
      staffWaitingQueue,
      syncRegistrarOfficeSummary,
    ]
  );

  const staffSendRecall = useCallback(() => {
    const next = Math.min(staffRecallCount + 1, 3);
    setStaffRecallCount(next);

    if (staffServingTicket) {
      setStudentMap((prev) => {
        const owner = prev[staffServingTicket.usn];
        if (!owner) return prev;
        return {
          ...prev,
          [staffServingTicket.usn]: {
            ...owner,
            notifications: [
              {
                id: `n-recall-${Date.now()}`,
                title: `Counter Recall (${next}/3): ${staffServingTicket.ticketNumber}`,
                message: `Please proceed immediately to Registrar Office (${staffCounterWindow}).`,
                time: 'Just now',
                read: false,
                dotColor: '#FF6B2C',
              },
              ...owner.notifications,
            ],
          },
        };
      });
    }
    return next;
  }, [staffCounterWindow, staffRecallCount, staffServingTicket]);

  const staffSkipCurrent = useCallback(
    (reason?: string) => {
      const skipped = staffServingTicket;
      const durationLabel = formatDuration(staffElapsedSeconds);
      setStaffRecallCount(0);

      if (skipped) {
        const nowLabel = getCurrentClockLabel();
        const newTx: ProcessedTransaction = {
          id: `tx-${Date.now()}`,
          ticketNumber: skipped.ticketNumber,
          studentName: skipped.studentName,
          usn: skipped.usn,
          serviceType: skipped.serviceType,
          outcome: 'Skipped',
          counterWindow: staffCounterWindow,
          staffName: activeStaff.staffName,
          issuedAt: skipped.issuedAt,
          calledAt: nowLabel,
          closedAt: nowLabel,
          durationFormatted: durationLabel,
          remarks: reason?.trim() || undefined,
        };
        setStaffTransactions((prev) => [newTx, ...prev]);
        setStaffSkippedCount((count) => count + 1);
      }

      if (staffWaitingQueue.length > 0) {
        const [nextTicket, ...rest] = staffWaitingQueue;
        setStaffServingTicket(nextTicket);
        setStaffWaitingQueue(rest);
        setStaffElapsedSeconds(0);
        syncRegistrarOfficeSummary(nextTicket, rest, staffCounterWindow, activeStaff.staffName);
        finalizeStudentRegistrarTicket(skipped, 'Skipped', nextTicket, rest, durationLabel);
        return { skippedNumber: skipped?.ticketNumber, nextTicket };
      }

      setStaffServingTicket(null);
      setStaffElapsedSeconds(0);
      syncRegistrarOfficeSummary(null, [], staffCounterWindow, activeStaff.staffName);
      finalizeStudentRegistrarTicket(skipped, 'Skipped', null, [], durationLabel);
      return { skippedNumber: skipped?.ticketNumber };
    },
    [
      activeStaff.staffName,
      finalizeStudentRegistrarTicket,
      staffCounterWindow,
      staffElapsedSeconds,
      staffServingTicket,
      staffWaitingQueue,
      syncRegistrarOfficeSummary,
    ]
  );

  const staffMarkTicketVerified = useCallback((ticketNumber: string) => {
    const target = ticketNumber.trim().toUpperCase();
    setStaffServingTicket((prev) =>
      prev && prev.ticketNumber.toUpperCase() === target
        ? { ...prev, isQrVerified: true }
        : prev
    );
    setStaffWaitingQueue((prev) =>
      prev.map((ticket) =>
        ticket.ticketNumber.toUpperCase() === target
          ? { ...ticket, isQrVerified: true }
          : ticket
      )
    );
  }, []);

  /**
   * Student-side queue simulator step (stays synced with Staff Registrar queue when advancing Registrar tickets).
   */
  const advanceQueue = useCallback((): 'completed' | 'called' | 'advanced' | 'empty' => {
    if (!currentHeroTicket) {
      showToast('No active ticket to advance. Issue a ticket from Home.', 'warning');
      return 'empty';
    }

    if (currentHeroTicket.officeId === 'registrar') {
      if (currentHeroTicket.status === 'serving' || currentHeroTicket.aheadCount === 0) {
        staffCompleteCurrent(true);
        setCalledAlertTicket(null);
        triggerHaptic('success');
        showToast(
          `Ticket ${currentHeroTicket.ticketNumber} completed & saved to History`,
          'matcha'
        );
        return 'completed';
      }

      const { nextTicket } = staffCompleteCurrent(true);
      if (nextTicket && nextTicket.ticketNumber === currentHeroTicket.ticketNumber) {
        const calledVersion: ActiveTicket = {
          ...currentHeroTicket,
          status: 'serving',
          aheadCount: 0,
          estWaitMins: 0,
          nowServing: currentHeroTicket.ticketNumber,
          trackNodes: [],
        };
        setCalledAlertTicket(calledVersion);
        triggerHaptic('success');
        return 'called';
      }

      const nextAhead = Math.max(0, currentHeroTicket.aheadCount - 1);
      triggerHaptic('light');
      showToast(
        `Now serving ${nextTicket?.ticketNumber ?? 'next'} — ${nextAhead} ${
          nextAhead === 1 ? 'student' : 'students'
        } ahead of ${currentHeroTicket.ticketNumber}`,
        'dark'
      );
      return 'advanced';
    }

    // Non-registrar offices (Accounting / SAO)
    if (currentHeroTicket.status === 'serving' || currentHeroTicket.aheadCount === 0) {
      const completedStub: HistoryTicket = {
        id: `${currentHeroTicket.ticketNumber}-${Date.now()}`,
        ticketNumber: currentHeroTicket.ticketNumber,
        officeId: currentHeroTicket.officeId,
        officeName: currentHeroTicket.officeName,
        service: currentHeroTicket.service,
        status: 'Completed',
        timestamp: getShortTimestampLabel(),
        issuedAt: currentHeroTicket.issuedAt,
        calledAt: getShortTimestampLabel(),
        counter: currentHeroTicket.counter,
        waitDuration: '12 mins',
      };

      setStudentMap((prev) => {
        const acc = prev[activeStudentUsn];
        if (!acc) return prev;
        return {
          ...prev,
          [activeStudentUsn]: {
            ...acc,
            historyTickets: [completedStub, ...acc.historyTickets],
            activeTickets: acc.activeTickets.filter((t) => t.id !== currentHeroTicket.id),
          },
        };
      });
      setOffices((prev) =>
        prev.map((o) =>
          o.id === currentHeroTicket.officeId
            ? {
                ...o,
                nowServing: currentHeroTicket.ticketNumber,
                waitingCount: Math.max(0, o.waitingCount - 1),
              }
            : o
        )
      );
      setCalledAlertTicket(null);
      triggerHaptic('success');
      showToast(
        `Ticket ${currentHeroTicket.ticketNumber} completed & saved to History`,
        'matcha'
      );
      return 'completed';
    }

    const nextAhead = Math.max(0, currentHeroTicket.aheadCount - 1);
    const currentNum = parseInt(currentHeroTicket.nowServing.split('-')[1] || '1', 10);
    const prefix = currentHeroTicket.ticketNumber.split('-')[0];
    const nextServing =
      nextAhead === 0
        ? currentHeroTicket.ticketNumber
        : `${prefix}-${String(currentNum + 1).padStart(3, '0')}`;

    const updatedTicket: ActiveTicket = {
      ...currentHeroTicket,
      aheadCount: nextAhead,
      estWaitMins: nextAhead * 4,
      nowServing: nextServing,
      status: nextAhead === 0 ? 'serving' : 'waiting',
      trackNodes: currentHeroTicket.trackNodes.slice(1),
    };

    setStudentMap((prev) => {
      const acc = prev[activeStudentUsn];
      if (!acc) return prev;
      return {
        ...prev,
        [activeStudentUsn]: {
          ...acc,
          activeTickets: acc.activeTickets.map((t) =>
            t.id === currentHeroTicket.id ? updatedTicket : t
          ),
          notifications:
            nextAhead === 0
              ? [
                  {
                    id: `n-${Date.now()}`,
                    title: `It's Your Turn! Ticket ${updatedTicket.ticketNumber}`,
                    message: `Please proceed immediately to ${updatedTicket.officeName} (${updatedTicket.counter}).`,
                    time: 'Just now',
                    read: false,
                    dotColor: '#B8F23A',
                  },
                  ...acc.notifications,
                ]
              : acc.notifications,
        },
      };
    });

    setOffices((prev) =>
      prev.map((o) =>
        o.id === currentHeroTicket.officeId
          ? {
              ...o,
              nowServing: nextServing,
              waitingCount: Math.max(0, o.waitingCount - 1),
            }
          : o
      )
    );

    if (nextAhead === 0) {
      setCalledAlertTicket(updatedTicket);
      triggerHaptic('success');
      return 'called';
    }

    triggerHaptic('light');
    showToast(
      `Now serving ${nextServing} — ${nextAhead} ${
        nextAhead === 1 ? 'student' : 'students'
      } ahead of ${updatedTicket.ticketNumber}`,
      'dark'
    );
    return 'advanced';
  }, [
    activeStudentUsn,
    currentHeroTicket,
    showToast,
    staffCompleteCurrent,
    triggerHaptic,
  ]);

  const resetSimulation = useCallback(() => {
    const freshStudents = cloneStudentAccounts();
    const freshRegistrar = cloneInitialRegistrarQueue();
    setStudentMap(freshStudents);
    setOffices(cloneOffices());
    setSelectedTicketId(freshStudents[activeStudentUsn]?.activeTickets[0]?.id ?? '');
    setCalledAlertTicket(null);

    setStaffServingTicket(freshRegistrar.serving);
    setStaffWaitingQueue(freshRegistrar.waiting);
    setStaffElapsedSeconds(staffData.desk.initialElapsedSeconds);
    setStaffRecallCount(0);
    setStaffTransactions(freshRegistrar.transactions);
    setStaffServedByMeCount(parseInt(staffData.logs.kpis.servedByMe, 10) || 34);
    setStaffOfficeCompletedCount(parseInt(staffData.logs.kpis.officeCompleted, 10) || 68);
    setStaffSkippedCount(parseInt(staffData.logs.kpis.skipped, 10) || 3);

    triggerHaptic('light');
    showToast('Queue reset to initial synced state', 'dark');
  }, [activeStudentUsn, showToast, triggerHaptic]);

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
    deskConfig: staffData.desk,
    scannerConfig: staffData.scanner,
    logsConfig: staffData.logs,
    staffCounterWindow,
    staffDeskStatus,
    staffServingTicket,
    staffWaitingQueue,
    staffElapsedSeconds,
    staffRecallCount,
    staffTransactions,
    staffServedByMeCount,
    staffOfficeCompletedCount,
    staffSkippedCount,

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

    setStaffCounterWindow,
    setStaffDeskStatus,
    staffCallNext,
    staffCompleteCurrent,
    staffSendRecall,
    staffSkipCurrent,
    staffMarkTicketVerified,
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
