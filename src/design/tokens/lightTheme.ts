/**
 * CareSuite+ Light Premium — mandatory demo/default palette.
 */
/** HTML document + RN root fallback before hydrated backgrounds paint. */
export const careSuiteDocumentRootBg = '#F8FAFC';

/** System-wide body ink — pure black. */
export const CARESUITE_INK = '#000000';

/** Light modal/popup scrim — never pure black. */
export const careSuiteModalScrim = 'rgba(15, 27, 51, 0.16)';
export const careSuiteModalScrimStrong = 'rgba(15, 27, 51, 0.28)';

export const careLightColors = {
  page: '#F8FAFC',
  surface: '#FFFFFF',
  navy: '#07122A',
  text: CARESUITE_INK,
  muted: CARESUITE_INK,
  orange: '#FF7A1A',
  gold: '#FFB347',
  cyan: '#0EA5E9',
  green: '#22C55E',
  violet: '#8B5CF6',
  danger: '#EF4444',
  warning: '#F59E0B',
  border: 'rgba(7,18,42,0.08)',
  borderStrong: 'rgba(7,18,42,0.14)',
} as const;

export type CareLightColors = typeof careLightColors;
