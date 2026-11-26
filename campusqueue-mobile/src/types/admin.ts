export type AdminDateRange =
  | 'Today (Live)'
  | 'Yesterday'
  | 'Last 7 Days'
  | 'This Month';

export type AdminOfficeStatus = 'open' | 'closed';

export type AdminWindowStatus = 'Online' | 'Break' | 'Closed';

export type AdminUserRole = 'staff' | 'student' | 'admin';

export type AdminAccountStatus = 'active' | 'suspended';

export type AuditOutcome = 'Completed' | 'Skipped' | 'Cancelled';

export type BroadcastAudience =
  | 'All Active Waiting Students'
  | 'Specific Office Queue'
  | 'All Campus Staff';

export interface AdminAccount {
  id: string;
  adminId: string;
  password: string;
  fullName: string;
  email: string;
  role: 'admin';
  institution: string;
}

export interface AdminKpiSnapshot {
  totalIssued: number;
  issuedDeltaLabel: string;
  completedCount: number;
  completionRate: number;
  activeWaiting: number;
  skippedCount: number;
  skippedRate: number;
  peakHours: { hourLabel: string; count: number }[];
}

export interface AdminOfficeWindow {
  label: string;
  status: AdminWindowStatus;
  staffName?: string;
  staffId?: string;
}

export interface AdminServiceItem {
  id: string;
  name: string;
  estimatedDurationMinutes: number;
  requiredDocumentsNote: string;
  isActive: boolean;
  waitingCount: number;
}

export interface AdminOfficeRecord {
  id: string;
  name: string;
  shortLabel: string;
  prefix: string;
  status: AdminOfficeStatus;
  operatingHours: string;
  locationDescription: string;
  windowCount: number;
  dailyCapacityLimit?: number;
  lastIssuedNumber: number;
  activeWaitingCount: number;
  avgWaitMinutes: number;
  themeColor: string;
  windows: AdminOfficeWindow[];
  services: AdminServiceItem[];
}

export interface AdminUserRecord {
  id: string;
  identifier: string;
  fullName: string;
  email: string;
  role: AdminUserRole;
  status: AdminAccountStatus;
  assignedOfficeId?: string;
  assignedOfficeName?: string;
  defaultWindow?: string;
  courseYear?: string;
  mustChangePassword: boolean;
}

export interface AdminBroadcastRecord {
  id: string;
  targetAudience: BroadcastAudience;
  officeId?: string;
  officeName?: string;
  title: string;
  message: string;
  recipientCount: number;
  sentAt: string;
  sentBy: string;
}

export interface AdminAuditRecord {
  id: string;
  documentId: string;
  ticketCode: string;
  dateKey: string;
  dateTimeLabel: string;
  officeId: string;
  officeName: string;
  serviceName: string;
  studentName: string;
  studentUsn: string;
  outcome: AuditOutcome;
  issuedAt: string;
  approachingAlertAt: string;
  calledAt: string;
  qrVerifiedAt: string;
  closedAt: string;
  waitDurationSeconds: number;
  serviceDurationSeconds: number;
  waitDurationLabel: string;
  serviceDurationLabel: string;
  verificationMethod: 'QR Scan' | 'Manual';
  handledByStaffId: string;
  handledByStaffName: string;
  counterWindow: string;
}

export interface SaveOfficeInput {
  id?: string;
  name: string;
  prefix: string;
  locationDescription: string;
  windowCount: number;
  dailyCapacityLimit?: number;
}

export interface SaveServiceInput {
  id?: string;
  name: string;
  estimatedDurationMinutes: number;
  requiredDocumentsNote: string;
  isActive: boolean;
}

export interface ProvisionUserInput {
  role: 'staff' | 'admin';
  identifier: string;
  fullName: string;
  email: string;
  assignedOfficeId?: string;
}

export interface SendBroadcastInput {
  targetAudience: BroadcastAudience;
  officeId?: string;
  title: string;
  message: string;
}
