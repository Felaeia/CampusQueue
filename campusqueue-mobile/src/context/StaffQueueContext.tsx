import { useQueue } from './QueueContext';

export function useStaffQueue() {
  const queue = useQueue();
  return {
    activeStaff: queue.activeStaff,
    counters: queue.staffCounters,
    services: queue.staffServices,
    logsConfig: queue.logsConfig,
    counterWindow: queue.staffCounterWindow,
    deskStatus: queue.staffDeskStatus,
    servingTicket: queue.staffServingTicket,
    waitingQueue: queue.staffWaitingQueue,
    elapsedSeconds: queue.staffElapsedSeconds,
    recallCount: queue.staffRecallCount,
    transactions: queue.staffTransactions,
    servedByMeCount: queue.staffServedByMeCount,
    officeCompletedCount: queue.staffOfficeCompletedCount,
    skippedCount: queue.staffSkippedCount,
    setCounterWindow: queue.setStaffCounterWindow,
    setDeskStatus: queue.setStaffDeskStatus,
    callNext: queue.staffCallNext,
    startCurrent: queue.staffStartCurrent,
    completeCurrent: queue.staffCompleteCurrent,
    sendRecall: queue.staffSendRecall,
    skipCurrent: queue.staffSkipCurrent,
  };
}
