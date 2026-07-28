import type { LiquidPortalKey } from '../types';

export type LiquidPortalNavigationItem = {
  id: string;
  label: string;
  glyph: string;
  route: string;
};

export type ProductPortalKind = Extract<LiquidPortalKey, 'employee' | 'client'> | 'relative';

export const liquidPortalRoots: Record<ProductPortalKind, string> = {
  employee: '/portal/employee',
  client: '/portal/client',
  relative: '/portal/relative',
};

export const liquidPortalNavigation: Record<
  ProductPortalKind,
  readonly LiquidPortalNavigationItem[]
> = {
  employee: [
    { id: 'home', label: 'Heute', glyph: '⌂', route: '/portal/employee' },
    { id: 'assignments', label: 'Einsätze', glyph: '◇', route: '/portal/employee/assignments' },
    { id: 'calendar', label: 'Kalender', glyph: '□', route: '/portal/employee/calendar' },
    { id: 'time', label: 'Arbeitszeit', glyph: '◷', route: '/portal/employee/arbeitszeit' },
    { id: 'documents', label: 'Dokumente', glyph: '▤', route: '/portal/employee/documents' },
    { id: 'messages', label: 'Nachrichten', glyph: '▱', route: '/portal/employee/messages' },
    { id: 'payroll', label: 'Gehalt', glyph: '€', route: '/portal/employee/payroll' },
    { id: 'profile', label: 'Profil', glyph: '♙', route: '/portal/employee/profile' },
  ],
  client: [
    { id: 'home', label: 'Übersicht', glyph: '⌂', route: '/portal/client' },
    { id: 'appointments', label: 'Termine', glyph: '□', route: '/portal/client/appointments' },
    { id: 'live', label: 'Live-Anfahrt', glyph: '⌖', route: '/portal/client/live' },
    { id: 'documents', label: 'Dokumente', glyph: '▤', route: '/portal/client/documents' },
    { id: 'proofs', label: 'Nachweise', glyph: '✓', route: '/portal/client/proofs' },
    { id: 'messages', label: 'Nachrichten', glyph: '▱', route: '/portal/client/messages' },
    { id: 'budget', label: 'Budget', glyph: '€', route: '/portal/client/budget' },
    { id: 'profile', label: 'Profil', glyph: '♙', route: '/portal/client/profile' },
  ],
  relative: [
    { id: 'home', label: 'Übersicht', glyph: '⌂', route: '/portal/relative' },
    { id: 'messages', label: 'Nachrichten', glyph: '▱', route: '/portal/relative/messages' },
  ],
};
