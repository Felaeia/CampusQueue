export type DeskStatus = 'online' | 'break' | 'closed';

export type LogOutcome = 'Completed' | 'Skipped' | 'Cancelled';

export type LogFilterTab = 'My Counter Only' | 'All Office Counters' | 'Skipped Only';

export interface StaffCounterOption {
  id: string;
  name: string;
  status: DeskStatus;
}

export interface StaffAccountRecord {
  staffId: string;
  staffName: string;
  office: string;
  officeShort: string;
  officeId?: string;
  defaultCounterWindow: string;
  counterIds?: string[];
  role: 'staff' | 'registrar_staff';
}

export interface StaffQueueTicket {
  id: string;
  ticketNumber: string;
  studentName: string;
  usn: string;
  program: string;
  serviceType: string;
  waitMinutes: number;
  estWaitMins?: number;
  issuedAt: string;
  calledAt?: string | null;
  startedAt?: string | null;
  acknowledgedAt?: string | null;
  recallCount?: number;
  status?: 'waiting' | 'called' | 'serving' | string;
  notes?: string;
  isQrVerified: boolean;
}

export interface VerifiedTicketData {
  id?: string;
  ticketNumber: string;
  studentName: string;
  usn: string;
  program: string;
  serviceType: string;
  issuedAt: string;
  status?: string;
  isQrVerified?: boolean;
  method: 'qr_scan' | 'manual_usn_check';
}

export interface ProcessedTransaction {
  id: string;
  ticketId?: string;
  ticketNumber: string;
  studentName: string;
  usn: string;
  serviceType: string;
  outcome: LogOutcome;
  lifecycleStatus?: string;
  counterWindow: string;
  staffName: string;
  issuedAt: string;
  calledAt: string;
  verifiedAt?: string;
  closedAt: string;
  durationFormatted: string;
  durationSeconds?: number;
  isMine?: boolean;
  remarks?: string;
}
