export type OfficeId = string;

export type ActiveTicketStatus = 'waiting' | 'serving';

export type TicketLifecycleStatus =
  | 'waiting'
  | 'called'
  | 'serving'
  | 'Completed'
  | 'Cancelled'
  | 'Skipped'
  | 'no_show';

export type HistoryTicketStatus = 'Completed' | 'Skipped' | 'Cancelled';

export type HistoryFilterOption = 'All' | HistoryTicketStatus;

export type ToastTone = 'dark' | 'matcha' | 'warning';

export interface StudentProfile {
  fullName: string;
  firstName: string;
  firstLetter: string;
  holderShort: string;
  usn: string;
  studentId: string;
  program: string;
  institution: string;
  campusShort: string;
  email: string;
  pushAlerts: boolean;
  soundAndHaptics: boolean;
}

export interface OfficeService {
  id: string;
  name: string;
  duration: number;
  docs: string;
  description?: string;
  available?: boolean;
}

export interface Office {
  id: OfficeId;
  name: string;
  shortLabel: string;
  prefix: string;
  windowLabel: string;
  officerName: string;
  nowServing: string;
  lastIssuedNumber: number;
  waitingCount: number;
  crowdBadge: string;
  themeColor: string;
  crowdPillBg: string;
  crowdPillText: string;
  acceptingTickets?: boolean;
  description?: string;
  estWaitMins?: number;
  services: OfficeService[];
}

export interface ActiveTicket {
  id: string;
  ticketNumber: string;
  sequence: number;
  officeId: OfficeId;
  officeName: string;
  shortOffice: string;
  counter: string;
  status: ActiveTicketStatus;
  lifecycleStatus?: TicketLifecycleStatus;
  service: string;
  serviceId?: string;
  holderShort: string;
  studentUsn: string;
  serial: string;
  qrPayload: string;
  issuedAt: string;
  calledAt?: string | null;
  startedAt?: string | null;
  acknowledgedAt?: string | null;
  isQrVerified?: boolean;
  recallCount?: number;
  requeueCount?: number;
  estWaitMins: number;
  aheadCount: number;
  nowServing: string;
  trackNodes: string[];
  notes: string;
}

export interface HistoryTicket {
  id: string;
  ticketNumber: string;
  officeId: OfficeId;
  officeName: string;
  service: string;
  status: HistoryTicketStatus;
  lifecycleStatus?: string;
  timestamp: string;
  issuedAt: string;
  calledAt: string;
  counter: string;
  waitDuration: string;
  reason?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  dotColor: string;
  ticketId?: string;
  kind?: string;
}

export interface ToastMessage {
  id: number;
  message: string;
  tone: ToastTone;
}

export interface IssueTicketInput {
  officeId: OfficeId;
  serviceId?: string;
  serviceName: string;
  notes?: string;
  requestId?: string;
}
