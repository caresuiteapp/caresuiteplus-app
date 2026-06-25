/**
 * CareSuite+ Light Premium — mandatory demo/default palette.
 */
export const careLightColors = {
  page: '#F8FAFC',
  surface: '#FFFFFF',
  navy: '#07122A',
  text: '#0F1B33',
  muted: '#475569',
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
