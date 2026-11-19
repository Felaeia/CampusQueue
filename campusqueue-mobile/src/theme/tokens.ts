import { Platform, ViewStyle } from 'react-native';

/**
 * CampusQueue Design System — "Warm Campus Utility"
 * Replicated from the interactive mobile UI/UX prototype.
 */
export const Colors = {
  // Primary Canvas & Surfaces
  canvas: '#F5F3EE',
  canvasOuter: '#EAE6DD',
  surface: '#FFFFFF',
  surfaceSubtle: '#F5F3EE',
  surfaceMuted: '#F1EFEA',

  // Borders & Dividers
  border: '#E3DFD7',
  borderSubtle: '#E6E2DA',
  divider: '#ECE9E2',
  dashedTicket: '#D6D1C7',
  dashedReceipt: '#DFDBD2',

  // Primary Ink & Dark Anchors
  ink: '#121417',
  inkHover: '#1E2228',
  inkSoft: '#646B75',
  inkMuted: '#8E96A0',
  inkTabInactive: '#9CA3AF',
  inkNeutral: '#52525B',

  // Dark Card Recessed Surfaces (Live Queue Track)
  darkRecessed: '#1A1D22',
  darkDivider: '#23272F',
  darkNode: '#252A33',
  darkBorder: '#2A2F38',

  // Brand & Live Accents
  matcha: '#B8F23A',
  matchaSoftBg: '#E4F9BE',

  // Campus Office Accents
  registrar: '#0E8AA8',
  registrarPillBg: '#E0F2FE',
  registrarPillText: '#0284C7',
  registrarHistoryBg: '#E8F0FE',
  registrarActiveBorder: 'rgba(14, 138, 168, 0.55)',

  accounting: '#134E4A',
  accountingPillBg: '#C4DCD9',
  accountingPillText: '#134E4A',

  sao: '#14532D',
  saoPillBg: '#A7E3B8',
  saoPillText: '#14532D',

  // Semantic Feedback
  successText: '#15803D',
  successDarkBg: 'rgba(21, 128, 61, 0.25)',
  warning: '#FF6B2C',
  warningDark: '#EA580C',
  warningSoftBg: '#FFEDE6',
  danger: '#DC2626',
  dangerSoftBg: '#FEF2F2',
  dangerBorder: '#FECACA',
  dangerOutline: '#F5B7B1',
  dangerOutlineStrong: '#FCA5A5',

  // Modal Backdrop
  backdrop: 'rgba(18, 20, 23, 0.60)',
  backdropSheet: 'rgba(18, 20, 23, 0.55)',
  backdropAlert: 'rgba(18, 20, 23, 0.65)',
} as const;

export const Fonts = {
  displayBold: 'PlusJakartaSans_700Bold',
  displayExtraBold: 'PlusJakartaSans_800ExtraBold',
  bodyRegular: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
  monoMedium: 'JetBrainsMono_500Medium',
  monoSemiBold: 'JetBrainsMono_600SemiBold',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

export const Radii = {
  sm: 9,
  md: 12,
  lg: 14,
  xl: 16,
  card: 20,
  officeCard: 22,
  modal: 24,
  alertModal: 26,
  sheet: 28,
  pill: 9999,
} as const;

export const Shadows: Record<string, ViewStyle> = {
  card: Platform.select({
    ios: {
      shadowColor: '#121417',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
    },
    android: { elevation: 2 },
    default: {},
  }) as ViewStyle,
  cardElevated: Platform.select({
    ios: {
      shadowColor: '#121417',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
    },
    android: { elevation: 4 },
    default: {},
  }) as ViewStyle,
  heroDark: Platform.select({
    ios: {
      shadowColor: '#121417',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.28,
      shadowRadius: 20,
    },
    android: { elevation: 8 },
    default: {},
  }) as ViewStyle,
  floatingNav: Platform.select({
    ios: {
      shadowColor: '#121417',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.34,
      shadowRadius: 24,
    },
    android: { elevation: 12 },
    default: {},
  }) as ViewStyle,
  modal: Platform.select({
    ios: {
      shadowColor: '#121417',
      shadowOffset: { width: 0, height: 18 },
      shadowOpacity: 0.32,
      shadowRadius: 32,
    },
    android: { elevation: 16 },
    default: {},
  }) as ViewStyle,
};

export function getOfficeAccent(officeId: string): string {
  if (officeId === 'registrar') return Colors.registrar;
  if (officeId === 'accounting') return Colors.accounting;
  return Colors.sao;
}

export function getDepartmentBadgeStyle(officeId: string): {
  bg: string;
  text: string;
  label: string;
} {
  if (officeId === 'registrar') {
    return { bg: Colors.registrarHistoryBg, text: Colors.registrar, label: 'REGISTRAR' };
  }
  if (officeId === 'accounting') {
    return { bg: Colors.accountingPillBg, text: Colors.accounting, label: 'ACCOUNTING' };
  }
  return { bg: Colors.saoPillBg, text: Colors.sao, label: 'SAO' };
}

export function getTicketStatusBadgeStyle(status: string): { bg: string; text: string } {
  if (status === 'Completed') {
    return { bg: Colors.matchaSoftBg, text: Colors.successText };
  }
  if (status === 'Skipped') {
    return { bg: Colors.warningSoftBg, text: Colors.warningDark };
  }
  return { bg: Colors.surfaceMuted, text: Colors.inkNeutral };
}
