export type DeskStatus = 'online' | 'break' | 'closed';

export type LogOutcome = 'Completed' | 'Skipped';

export type LogFilterTab = 'My Counter Only' | 'All Office Counters' | 'Skipped Only';

export interface StaffAccountRecord {
  staffId: string;
  password?: string;
  staffName: string;
  office: string;
  officeShort: string;
  defaultCounterWindow: string;
  role: 'registrar_staff' | 'staff';
  officeId?: string;
}

export interface StaffQueueTicket {
  id: string;
  ticketNumber: string;
  studentName: string;
  usn: string;
  program: string;
  serviceType: string;
  waitMinutes: number;
  issuedAt: string;
  notes?: string;
  isQrVerified: boolean;
  status?: 'waiting' | 'called' | 'serving';
  acknowledgedAt?: string | null;
}

export interface VerifiedTicketData {
  ticketNumber: string;
  studentName: string;
  usn: string;
  program: string;
  serviceType: string;
  issuedAt: string;
  method: 'qr_scan' | 'manual_usn_check';
}

export interface ProcessedTransaction {
  id: string;
  ticketNumber: string;
  studentName: string;
  usn: string;
  serviceType: string;
  outcome: LogOutcome;
  counterWindow: string;
  staffName: string;
  issuedAt: string;
  calledAt: string;
  verifiedAt?: string;
  closedAt: string;
  durationFormatted: string;
  remarks?: string;
}

export interface StaffRegistrarDataBundle {
  staffAccounts: StaffAccountRecord[];
  desk: {
    staffName: string;
    staffId: string;
    office: string;
    initialCounterWindow: string;
    initialElapsedSeconds: number;
    services: string[];
    initialServing: StaffQueueTicket;
    initialWaiting: StaffQueueTicket[];
  };
  scanner: {
    expectedTicket: string;
    manualUsnSuffix: string;
    verifiedTicket: Omit<VerifiedTicketData, 'method'>;
    wrongOfficeError: string;
    invalidQrError: string;
    manualInputError: string;
    manualPlaceholder: string;
    usnPlaceholder: string;
  };
  logs: {
    staffName: string;
    staffId: string;
    office: string;
    counter: string;
    summaryTitle: string;
    filterTabs: LogFilterTab[];
    kpis: {
      servedByMe: string;
      officeCompleted: string;
      skipped: string;
      averageService: string;
    };
    transactions: ProcessedTransaction[];
  };
}
