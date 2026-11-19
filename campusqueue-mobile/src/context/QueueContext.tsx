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

  const issueTicket = useCallback((): ActiveTicket | null => null, []);
  const cancelTicket = useCallback((): boolean => false, []);
  const advanceQueue = useCallback((): 'completed' | 'called' | 'advanced' | 'empty' => 'empty', []);
  const resetSimulation = useCallback(() => {
    const fresh = cloneInitialData();
    setOffices(fresh.offices);
    setActiveTickets(fresh.activeTickets);
    setSelectedTicketId(fresh.activeTickets[0]?.id ?? '');
    setHistoryTickets(fresh.historyTickets);
    setNotifications(fresh.notifications);
    setCalledAlertTicket(null);
  }, []);

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
