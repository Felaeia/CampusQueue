import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { Platform } from 'react-native';

import {
  CANCEL_REASONS,
  DEFAULT_BARCODE_WIDTHS,
  HISTORY_FILTERS,
  MIN_PASSWORD_LENGTH,
  STAFF_LOG_FILTERS,
} from '../constants/ui';
import {
  ActiveTicket,
  HistoryFilterOption,
  HistoryTicket,
  IssueTicketInput,
  NotificationItem,
  Office,
  StudentProfile,
  ToastMessage,
  ToastTone,
} from '../types/queue';
import {
  DeskStatus,
  LogFilterTab,
  ProcessedTransaction,
  StaffAccountRecord,
  StaffCounterOption,
  StaffQueueTicket,
  VerifiedTicketData,
} from '../types/staff';
import { useLiveQueue, type LiveRole } from './useLiveQueue';

function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (safe % 60).toString().padStart(2, '0');
  return `${minutes}m ${seconds}s`;
}

const EMPTY_STUDENT_PROFILE: StudentProfile = {
  fullName: '',
  firstName: '',
  firstLetter: '',
  holderShort: '',
  usn: '',
  studentId: '',
  program: '',
  institution: '',
  campusShort: '',
  email: '',
  pushAlerts: true,
  soundAndHaptics: true,
};

const EMPTY_STAFF_PROFILE: StaffAccountRecord = {
  staffId: '',
  staffName: '',
  office: '',
  officeShort: '',
  officeId: '',
  defaultCounterWindow: '',
  counterIds: [],
  role: 'staff',
};

export interface QueueContextValue {
  liveRole: LiveRole | null;
  liveLoginId: string;
  isRestoringSession: boolean;
  isSyncingLive: boolean;
  isMutatingLive: boolean;
  hasLoadedLive: boolean;
  liveSyncError: string | null;
  refreshLiveQueue: (includeLogs?: boolean, silent?: boolean) => Promise<void>;
  liveSignIn: (
    loginId: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<{ role: LiveRole; name?: string }>;
  liveChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  liveVerify: (
    data: { qrPayload: string } | { ticketNumber: string; usnSuffix: string }
  ) => Promise<VerifiedTicketData>;
  liveAdminRequest: <T>(
    query: string,
    data?: object,
    method?: 'GET' | 'POST' | 'PATCH',
    silent?: boolean
  ) => Promise<T>;
  liveAdminDownload: (query: string) => Promise<string>;
  downloadStaffShiftReport: (format: 'csv' | 'pdf') => Promise<string>;

  minPasswordLength: number;
  studentProfile: StudentProfile;
  offices: Office[];
  activeTickets: ActiveTicket[];
  selectedTicketId: string;
  currentHeroTicket: ActiveTicket | null;
  historyTickets: HistoryTicket[];
  notifications: NotificationItem[];
  unreadNotificationsCount: number;
  cancelReasons: string[];
  historyFilters: HistoryFilterOption[];
  barcodePattern: number[];
  toast: ToastMessage | null;
  calledAlertTicket: ActiveTicket | null;
  loginResetNonce: number;

  // Live Staff state
  activeStaff: StaffAccountRecord;
  staffCounters: StaffCounterOption[];
  staffOfficeServices: string[];
  staffLogFilters: LogFilterTab[];
  staffAverageServiceLabel: string;
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

  // UI & session actions
  setSelectedTicketId: (id: string) => void;
  setCalledAlertTicket: (ticket: ActiveTicket | null) => void;
  showToast: (message: string, tone?: ToastTone) => void;
  triggerHaptic: (kind?: 'light' | 'success' | 'warning') => void;
  bumpLoginReset: () => void;
  togglePushAlerts: () => void;
  toggleSoundAndHaptics: () => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  // Student live API actions
  issueTicket: (input: IssueTicketInput) => Promise<ActiveTicket | null>;
  cancelTicket: (ticketId: string, reason: string) => Promise<boolean>;
  acknowledgeTicket: (ticketId: string) => Promise<boolean>;

  // Staff live API actions
  setStaffCounterWindow: (windowLabel: string) => void;
  setStaffDeskStatus: (status: DeskStatus) => void;
  staffCallNext: () => Promise<StaffQueueTicket | null>;
  staffStartService: () => Promise<boolean>;
  staffCompleteCurrent: (
    advance: boolean,
    remarks?: string
  ) => Promise<{ completedNumber?: string; nextTicket?: StaffQueueTicket }>;
  staffSendRecall: () => Promise<number>;
  staffSkipCurrent: (
    reason?: string
  ) => Promise<{ skippedNumber?: string; nextTicket?: StaffQueueTicket }>;
  staffCancelCurrent: (
    reason?: string
  ) => Promise<{ cancelledNumber?: string; nextTicket?: StaffQueueTicket }>;
  staffRequeueTicket: (ticketId: string) => Promise<boolean>;
}

const QueueContext = createContext<QueueContextValue | null>(null);

export function QueueProvider({ children }: { children: React.ReactNode }) {
  const [loginResetNonce, setLoginResetNonce] = useState(0);
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [calledAlertTicket, setCalledAlertTicket] = useState<ActiveTicket | null>(null);

  const showToast = useCallback((message: string, tone: ToastTone = 'dark') => {
    setToast({ message, tone, id: Date.now() });
  }, []);

  const handleLiveError = useCallback(
    (message: string) => {
      showToast(message, 'warning');
    },
    [showToast]
  );

  const handleLiveCompleted = useCallback(
    (ticketNumber: string) => {
      showToast(`Ticket ${ticketNumber} completed & saved to History`, 'matcha');
    },
    [showToast]
  );

  const live = useLiveQueue(handleLiveError, setCalledAlertTicket, handleLiveCompleted);

  const soundAndHapticsEnabled = live.student?.profile.soundAndHaptics ?? true;

  const triggerHaptic = useCallback(
    (kind: 'light' | 'success' | 'warning' = 'light') => {
      if (!soundAndHapticsEnabled || Platform.OS === 'web') return;
      if (kind === 'success') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (kind === 'warning') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    [soundAndHapticsEnabled]
  );

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const bumpLoginReset = useCallback(() => {
    live.signOut();
    setSelectedTicketId('');
    setLoginResetNonce((prev) => prev + 1);
  }, [live]);

  const activeTickets = live.student?.activeTickets ?? [];
  const currentHeroTicket = useMemo(
    () =>
      activeTickets.find((ticket) => ticket.id === selectedTicketId) ??
      activeTickets[0] ??
      null,
    [activeTickets, selectedTicketId]
  );

  const logs = live.desk?.transactions ?? [];
  const timing = logs.filter(
    (log) => log.outcome === 'Completed' && typeof log.durationSeconds === 'number'
  );
  const averageSeconds = timing.length
    ? Math.round(
        timing.reduce((total, log) => total + (log.durationSeconds ?? 0), 0) / timing.length
      )
    : 0;

  const staffOfficeId = live.desk?.officeId || live.staff?.officeId;
  const matchedStaffOffice = live.offices.find((o) => o.id === staffOfficeId);
  const staffOfficeServices = matchedStaffOffice?.services.length
    ? ['All Services', ...matchedStaffOffice.services.map((s) => s.name)]
    : ['All Services'];

  const activeStaff: StaffAccountRecord = live.staff
    ? {
        ...live.staff,
        office: matchedStaffOffice?.name || live.staff.office,
        officeShort: matchedStaffOffice?.shortLabel || live.staff.officeShort,
      }
    : EMPTY_STAFF_PROFILE;

  const value: QueueContextValue = {
    liveRole: live.role,
    liveLoginId: live.loginId,
    isRestoringSession: live.isRestoringSession,
    isSyncingLive: live.isSyncing,
    isMutatingLive: live.isMutating,
    hasLoadedLive: live.hasLoaded,
    liveSyncError: live.syncError,
    refreshLiveQueue: live.refreshNow,
    liveSignIn: live.signIn,
    liveChangePassword: live.changePassword,
    liveVerify: live.verify,
    liveAdminRequest: live.adminRequest,
    liveAdminDownload: live.adminDownload,
    downloadStaffShiftReport: live.downloadShiftReport,

    minPasswordLength: MIN_PASSWORD_LENGTH,
    studentProfile: live.student?.profile ?? EMPTY_STUDENT_PROFILE,
    offices: live.offices,
    activeTickets,
    selectedTicketId: currentHeroTicket?.id ?? '',
    currentHeroTicket,
    historyTickets: live.student?.historyTickets ?? [],
    notifications: live.student?.notifications ?? [],
    unreadNotificationsCount:
      live.student?.notifications.filter((notification) => !notification.read).length ?? 0,
    cancelReasons: CANCEL_REASONS,
    historyFilters: HISTORY_FILTERS,
    barcodePattern: DEFAULT_BARCODE_WIDTHS,
    toast,
    calledAlertTicket,
    loginResetNonce,

    activeStaff,
    staffCounters: live.counters,
    staffOfficeServices,
    staffLogFilters: STAFF_LOG_FILTERS,
    staffAverageServiceLabel: formatDuration(averageSeconds),
    staffCounterWindow: live.counter,
    staffDeskStatus: live.desk?.deskStatus ?? 'closed',
    staffServingTicket: live.desk?.servingTicket ?? null,
    staffWaitingQueue: live.desk?.waitingQueue ?? [],
    staffElapsedSeconds: live.elapsed,
    staffRecallCount: live.desk?.servingTicket?.recallCount ?? 0,
    staffTransactions: logs,
    staffServedByMeCount: logs.filter((log) => log.isMine && log.outcome === 'Completed').length,
    staffOfficeCompletedCount: logs.filter((log) => log.outcome === 'Completed').length,
    staffSkippedCount: logs.filter((log) => log.outcome === 'Skipped').length,

    setSelectedTicketId,
    setCalledAlertTicket,
    showToast,
    triggerHaptic,
    bumpLoginReset,

    issueTicket: async (input: IssueTicketInput) => {
      const ticket = await live.issue(input);
      if (ticket) {
        setSelectedTicketId(ticket.id);
        triggerHaptic('success');
        showToast(`Ticket ${ticket.ticketNumber} issued!`, 'matcha');
      }
      return ticket;
    },
    cancelTicket: async (ticketId: string, reason: string) => {
      const ok = await live.cancel(ticketId, reason);
      if (ok) {
        triggerHaptic('warning');
        showToast('Queue ticket cancelled', 'warning');
      }
      return ok;
    },
    acknowledgeTicket: live.acknowledge,

    togglePushAlerts: () => {
      void live.preferences('pushAlerts').then(() => {
        showToast('Push alert preference saved', 'dark');
      });
    },
    toggleSoundAndHaptics: () => {
      void live.preferences('soundAndHaptics').then(() => {
        showToast('Sound & vibration preference saved', 'dark');
      });
    },
    markNotificationRead: (id: string) => {
      void live.notification(id);
    },
    markAllNotificationsRead: () => {
      void live.notification().then(() => {
        showToast('All notifications marked as read', 'dark');
      });
    },

    setStaffCounterWindow: live.selectCounter,
    setStaffDeskStatus: (status: DeskStatus) => {
      void live.deskAction('status', { status }).then((res) => {
        if (res) showToast(`Desk status set to ${status}`, 'dark');
      });
    },
    staffCallNext: async () => (await live.deskAction('call-next'))?.desk?.servingTicket ?? null,
    staffStartService: async () => Boolean(await live.deskAction('start')),
    staffCompleteCurrent: async (advance: boolean, remarks?: string) => {
      const previousNumber = live.desk?.servingTicket?.ticketNumber;
      const response = await live.deskAction('complete', { advance, remarks });
      return response
        ? {
            completedNumber: previousNumber,
            nextTicket: response.desk?.servingTicket ?? undefined,
          }
        : {};
    },
    staffSendRecall: async () => {
      const response = await live.deskAction('recall');
      return (response?.result as { recallCount?: number } | undefined)?.recallCount ?? 0;
    },
    staffSkipCurrent: async (reason?: string) => {
      const previousNumber = live.desk?.servingTicket?.ticketNumber;
      const response = await live.deskAction('skip', { reason });
      return response
        ? {
            skippedNumber: previousNumber,
            nextTicket: response.desk?.servingTicket ?? undefined,
          }
        : {};
    },
    staffCancelCurrent: async (reason?: string) => {
      const previousNumber = live.desk?.servingTicket?.ticketNumber;
      const response = await live.deskAction('cancel', { reason, advance: true });
      return response
        ? {
            cancelledNumber: previousNumber,
            nextTicket: response.desk?.servingTicket ?? undefined,
          }
        : {};
    },
    staffRequeueTicket: async (ticketId: string) => {
      const response = await live.deskAction('requeue', { ticketId });
      if (response) {
        triggerHaptic('success');
        showToast('Student ticket returned to queue.', 'matcha');
        return true;
      }
      return false;
    },
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

export function useQueueFocus(scope: Parameters<QueueContextValue['enterScope']>[0]) {
  const { enterScope } = useQueue();
  useFocusEffect(useCallback(() => enterScope(scope), [enterScope, scope]));
}
