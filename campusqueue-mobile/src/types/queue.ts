export type OfficeId = 'registrar' | 'accounting' | 'sao';

export type ActiveTicketStatus = 'waiting' | 'serving';

export type HistoryTicketStatus = 'Completed' | 'Skipped' | 'Cancelled';

export type HistoryFilterOption = 'All' | HistoryTicketStatus;

export type ToastTone = 'dark' | 'matcha' | 'warning';

export interface AuthDefaults {
  defaultUsn: string;
  defaultStudentId: string;
  defaultPassword: string;
  minPasswordLength: number;
}

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
  service: string;
  holderShort: string;
  serial: string;
  issuedAt: string;
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
}

export interface ToastMessage {
  id: number;
  message: string;
  tone: ToastTone;
}

export interface IssueTicketInput {
  officeId: OfficeId;
  serviceName: string;
  notes?: string;
}

export interface MockDataBundle {
  authDefaults: AuthDefaults;
  studentProfile: StudentProfile;
  offices: Office[];
  activeTickets: ActiveTicket[];
  historyTickets: HistoryTicket[];
  notifications: NotificationItem[];
  cancelReasons: string[];
  historyFilters: HistoryFilterOption[];
  historicalBasePassCount: number;
  barcodePattern: number[];
}
