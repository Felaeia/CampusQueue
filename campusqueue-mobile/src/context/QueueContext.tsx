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
import {
  ActiveTicket,
  AuthDefaults,
  HistoryFilterOption,
  HistoryTicket,
  IssueTicketInput,
  MockDataBundle,
  NotificationItem,
  Office,
  StudentProfile,
  ToastMessage,
  ToastTone,
} from '../types/queue';

const mockData = rawMockData as MockDataBundle;

function cloneInitialData(): MockDataBundle {
  return {
    authDefaults: { ...mockData.authDefaults },
    studentProfile: { ...mockData.studentProfile },
    offices: mockData.offices.map((office) => ({
      ...office,
      services: office.services.map((srv) => ({ ...srv })),
    })),
    activeTickets: mockData.activeTickets.map((ticket) => ({
      ...ticket,
      trackNodes: [...ticket.trackNodes],
    })),
    historyTickets: mockData.historyTickets.map((ticket) => ({ ...ticket })),
    notifications: mockData.notifications.map((notif) => ({ ...notif })),
    cancelReasons: [...mockData.cancelReasons],
    historyFilters: [...mockData.historyFilters],
    historicalBasePassCount: mockData.historicalBasePassCount,
    barcodePattern: [...mockData.barcodePattern],
  };
}

export interface QueueContextValue {
  authDefaults: AuthDefaults;
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
  const initial = useMemo(() => cloneInitialData(), []);

  const [studentProfile, setStudentProfile] = useState<StudentProfile>(initial.studentProfile);
  const [accountPassword, setAccountPassword] = useState<string>(
    initial.authDefaults.defaultPassword
  );
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(true);
  const [loginResetNonce, setLoginResetNonce] = useState<number>(0);

  const [offices, setOffices] = useState<Office[]>(initial.offices);
  const [activeTickets, setActiveTickets] = useState<ActiveTicket[]>(initial.activeTickets);
  const [selectedTicketId, setSelectedTicketId] = useState<string>(
    initial.activeTickets[0]?.id ?? ''
  );
  const [historyTickets, setHistoryTickets] = useState<HistoryTicket[]>(initial.historyTickets);
  const [notifications, setNotifications] = useState<NotificationItem[]>(initial.notifications);

  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [calledAlertTicket, setCalledAlertTicket] = useState<ActiveTicket | null>(null);

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

  const bumpLoginReset = useCallback(() => {
    setLoginResetNonce((prev) => prev + 1);
  }, []);

  const updatePassword = useCallback((newPassword: string) => {
    setAccountPassword(newPassword);
    setMustChangePassword(false);
  }, []);

  const togglePushAlerts = useCallback(() => {
    setStudentProfile((prev) => ({ ...prev, pushAlerts: !prev.pushAlerts }));
    showToast('Push notifications updated', 'dark');
  }, [showToast]);

  const toggleSoundAndHaptics = useCallback(() => {
    setStudentProfile((prev) => ({
      ...prev,
      soundAndHaptics: !prev.soundAndHaptics,
    }));
    showToast('Sound & vibration alerts updated', 'dark');
  }, [showToast]);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, read: true } : item))
    );
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    showToast('All notifications marked as read', 'dark');
  }, [showToast]);

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
        serial: `CQ-2026-${formattedCode}`,
        issuedAt: '11-19 6:07 PM',
        estWaitMins: ahead * 4,
        aheadCount: ahead,
        nowServing: office.nowServing,
        trackNodes: intermediateNodes,
        notes: notes || '',
      };

      setActiveTickets((prev) => [...prev, newTicket]);
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
      setNotifications((prev) => [
        {
          id: `n-${Date.now()}`,
          title: `Queue Pass ${formattedCode} Issued`,
          message: `${office.name} • ${serviceName}`,
          time: 'Just now',
          read: false,
          dotColor: office.themeColor,
        },
        ...prev,
      ]);

      setSelectedTicketId(formattedCode);
      triggerHaptic('success');
      showToast(`Ticket ${formattedCode} issued!`, 'matcha');
      return newTicket;
    },
    [offices, showToast, studentProfile.holderShort, triggerHaptic]
  );

  const cancelTicket = useCallback(
    (ticketId: string, reason: string): boolean => {
      const target = activeTickets.find((t) => t.id === ticketId);
      if (!target) return false;

      setActiveTickets((prev) => prev.filter((t) => t.id !== ticketId));
      setHistoryTickets((prev) => [
        {
          id: `${target.ticketNumber}-${Date.now()}`,
          ticketNumber: target.ticketNumber,
          officeId: target.officeId,
          officeName: target.officeName,
          service: target.service,
          status: 'Cancelled',
          timestamp: 'Nov 19, 2026 • 06:07 PM',
          issuedAt: target.issuedAt,
          calledAt: '—',
          counter: target.counter,
          waitDuration: '02 mins',
          reason,
        },
        ...prev,
      ]);
      setOffices((prev) =>
        prev.map((o) =>
          o.id === target.officeId
            ? { ...o, waitingCount: Math.max(0, o.waitingCount - 1) }
            : o
        )
      );

      triggerHaptic('warning');
      showToast(`Ticket ${target.ticketNumber} cancelled`, 'warning');
      return true;
    },
    [activeTickets, showToast, triggerHaptic]
  );

  const advanceQueue = useCallback((): 'completed' | 'called' | 'advanced' | 'empty' => {
    if (!currentHeroTicket) {
      showToast('No active ticket to advance. Issue a ticket from Home.', 'warning');
      return 'empty';
    }

    if (currentHeroTicket.status === 'serving' || currentHeroTicket.aheadCount === 0) {
      const completedStub: HistoryTicket = {
        id: `${currentHeroTicket.ticketNumber}-${Date.now()}`,
        ticketNumber: currentHeroTicket.ticketNumber,
        officeId: currentHeroTicket.officeId,
        officeName: currentHeroTicket.officeName,
        service: currentHeroTicket.service,
        status: 'Completed',
        timestamp: 'Nov 19, 2026 • 06:07 PM',
        issuedAt: currentHeroTicket.issuedAt,
        calledAt: 'Nov 19, 2026 • 06:02 PM',
        counter: currentHeroTicket.counter,
        waitDuration: '12 mins',
      };

      setHistoryTickets((prev) => [completedStub, ...prev]);
      setActiveTickets((prev) => prev.filter((t) => t.id !== currentHeroTicket.id));
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
    const currentNum = parseInt(currentHeroTicket.nowServing.split('-')[1] || '39', 10);
    const prefix = currentHeroTicket.ticketNumber.split('-')[0];
    const nextServing =
      nextAhead === 0
        ? currentHeroTicket.ticketNumber
        : `${prefix}-${String(currentNum + 1).padStart(3, '0')}`;

    const nextNodes = currentHeroTicket.trackNodes.slice(1);

    const updatedTicket: ActiveTicket = {
      ...currentHeroTicket,
      aheadCount: nextAhead,
      estWaitMins: nextAhead * 4,
      nowServing: nextServing,
      status: nextAhead === 0 ? 'serving' : 'waiting',
      trackNodes: nextNodes,
    };

    setActiveTickets((prev) =>
      prev.map((t) => (t.id === currentHeroTicket.id ? updatedTicket : t))
    );
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
      setNotifications((prev) => [
        {
          id: `n-${Date.now()}`,
          title: `It's Your Turn! Ticket ${updatedTicket.ticketNumber}`,
          message: `Please proceed immediately to ${updatedTicket.officeName} (${updatedTicket.counter}).`,
          time: 'Just now',
          read: false,
          dotColor: '#B8F23A',
        },
        ...prev,
      ]);
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
  }, [currentHeroTicket, showToast, triggerHaptic]);

  const resetSimulation = useCallback(() => {
    const fresh = cloneInitialData();
    setOffices(fresh.offices);
    setActiveTickets(fresh.activeTickets);
    setSelectedTicketId(fresh.activeTickets[0]?.id ?? '');
    setHistoryTickets(fresh.historyTickets);
    setNotifications(fresh.notifications);
    setCalledAlertTicket(null);
    triggerHaptic('light');
    showToast('Queue reset to R-042 (3 students ahead)', 'dark');
  }, [showToast, triggerHaptic]);

  const value: QueueContextValue = {
    authDefaults: initial.authDefaults,
    studentProfile,
    accountPassword,
    mustChangePassword,
    offices,
    activeTickets,
    selectedTicketId,
    currentHeroTicket,
    historyTickets,
    notifications,
    unreadNotificationsCount,
    cancelReasons: initial.cancelReasons,
    historyFilters: initial.historyFilters,
    historicalBasePassCount: initial.historicalBasePassCount,
    barcodePattern: initial.barcodePattern,
    toast,
    calledAlertTicket,
    loginResetNonce,
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
