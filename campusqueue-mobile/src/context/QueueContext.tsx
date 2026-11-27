import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { useLiveQueue } from './useLiveQueue';
import type { ActiveTicket, HistoryFilterOption, IssueTicketInput, StudentProfile, ToastMessage, ToastTone } from '../types/queue';
import type { DeskStatus, LogFilterTab, StaffAccountRecord } from '../types/staff';

// Demo accounts, offices and queue records are disabled. The original JSON fixtures are retained in src/data.
const emptyProfile: StudentProfile = {
  fullName: '', firstName: '', firstLetter: '', holderShort: '', usn: '', studentId: '',
  program: '', institution: '', campusShort: '', email: '', pushAlerts: false, soundAndHaptics: false,
};
const emptyStaff: StaffAccountRecord = {
  staffId: '', staffName: '', office: '', officeShort: '', defaultCounterWindow: '', role: 'staff',
};
const cancelReasons = ['Change of plans', 'Wrong service selected', 'Unable to wait', 'Other'];
const historyFilters: HistoryFilterOption[] = ['All', 'Completed', 'Skipped', 'Cancelled'];
const barcodePattern = [2, 1, 3, 1, 2, 2, 1, 3, 2, 1];
const filterTabs: LogFilterTab[] = ['My Counter Only', 'All Office Counters', 'Skipped Only'];

function useQueueValue() {
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [calledAlertTicket, setCalledAlertTicket] = useState<ActiveTicket | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const showError = useCallback((message: string) => {
    setToast({ message, tone: 'warning', id: Date.now() });
  }, []);
  const live = useLiveQueue(showError, setCalledAlertTicket);
  const soundAndHaptics = live.student?.profile.soundAndHaptics ?? true;
  const triggerHaptic = useCallback(
    (kind: 'light' | 'success' | 'warning' = 'light') => {
      if (!soundAndHaptics || Platform.OS === 'web') return;
      if (kind === 'success') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (kind === 'warning') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    [soundAndHaptics]
  );

  const showToast = useCallback((message: string, tone: ToastTone = 'dark') => {
    setToast({ message, tone, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);


  const activeTickets = live.student?.activeTickets ?? [];
  const hero = activeTickets.find((ticket) => ticket.id === selectedTicketId) ?? activeTickets[0] ?? null;
  const notifications = live.student?.notifications ?? [];
  const logs = live.desk?.transactions ?? [];
  const timing = logs.filter((log) => log.outcome === 'Completed' && log.durationSeconds !== undefined);
  const average = timing.length
    ? Math.round(timing.reduce((total, log) => total + (log.durationSeconds ?? 0), 0) / timing.length)
    : undefined;

  return {
    liveRole: live.role,
    restoring: live.restoring,
    restoreSession: live.restore,
    restoreError: live.restoreError,
    liveSignIn: live.signIn,
    liveChangePassword: live.changePassword,
    liveVerify: live.verify,
    liveAdminRequest: live.adminRequest,
    liveAdminDownload: live.adminDownload,
    staffDownload: live.staffDownload,
    adminIdentity: live.identity?.account,
    refresh: live.refresh,
    enterScope: live.enterScope,
    syncError: live.syncError,
    isMutating: live.isMutating,
    acknowledgeTicket: live.acknowledge,
    studentProfile: live.student?.profile ?? emptyProfile,
    offices: live.offices,
    activeTickets,
    selectedTicketId: hero?.id ?? '',
    currentHeroTicket: hero,
    historyTickets: live.student?.historyTickets ?? [],
    notifications,
    unreadNotificationsCount: notifications.filter((notification) => !notification.read).length,
    cancelReasons,
    historyFilters,
    barcodePattern,
    toast,
    calledAlertTicket,
    activeStaff: live.staff ?? emptyStaff,
    staffCounters: live.counters,
    staffServices: live.offices.flatMap((office) => office.services.map((service) => service.name)),
    logsConfig: {
      summaryTitle: 'Shift summary',
      office: live.staff?.office ?? '',
      filterTabs,
      kpis: { averageService: average === undefined ? '—' : Math.floor(average / 60) + 'm ' + average % 60 + 's' },
    },
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
    staffStartCurrent: async () => Boolean(await live.deskAction('start')),
    bumpLoginReset: () => {
      setSelectedTicketId('');
      setToast(null);
      live.signOut();
    },
    issueTicket: async (input: IssueTicketInput) => {
      const ticket = await live.issue(input);
      if (ticket) setSelectedTicketId(ticket.id);
      return ticket;
    },
    cancelTicket: live.cancel,
    togglePushAlerts: () => { void live.preferences('pushAlerts'); },
    toggleSoundAndHaptics: () => { void live.preferences('soundAndHaptics'); },
    markNotificationRead: (id: string) => { void live.notification(id); },
    markAllNotificationsRead: () => { void live.notification(); },
    setStaffCounterWindow: live.selectCounter,
    setStaffDeskStatus: (status: DeskStatus) => { void live.deskAction('status', { status }); },
    staffCallNext: async () => {
      const response = await live.deskAction('call-next');
      return response?.result.ticket ?? response?.desk?.servingTicket ?? null;
    },
    staffCompleteCurrent: async (advance: boolean, remarks?: string) => {
      const response = await live.deskAction('complete', { advance, remarks });
      return response ? { completedNumber: live.desk?.servingTicket?.ticketNumber, nextTicket: response.desk?.servingTicket ?? undefined } : {};
    },
    staffSendRecall: async () => (await live.deskAction('recall'))?.result.recallCount ?? 0,
    staffSkipCurrent: async (reason?: string) => {
      const response = await live.deskAction('skip', { reason });
      return response ? { skippedNumber: live.desk?.servingTicket?.ticketNumber, nextTicket: response.desk?.servingTicket ?? undefined } : {};
    },
  };
}

const QueueContext = createContext<ReturnType<typeof useQueueValue> | null>(null);

export function QueueProvider({ children }: { children: React.ReactNode }) {
  const value = useQueueValue();
  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}

export function useQueueFocus(scope: Parameters<ReturnType<typeof useQueueValue>['enterScope']>[0]) {
  const { enterScope } = useQueue();
  useFocusEffect(useCallback(() => enterScope(scope), [enterScope, scope]));
}

export function useQueue() {
  const ctx = useContext(QueueContext);
  if (!ctx) {
    throw new Error('useQueue must be used within a QueueProvider');
  }
  return ctx;
}
