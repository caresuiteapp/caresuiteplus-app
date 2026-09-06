import type { LiquidPortalKey } from '../types';

export type LiquidPortalNavigationItem = {
  id: string;
  label: string;
  glyph: string;
  route: string;
  compact?: boolean;
  group: 'overview' | 'work' | 'communication' | 'account';
};

export type ProductPortalKind = Extract<LiquidPortalKey, 'employee' | 'client'>;

export const liquidPortalRoots: Record<ProductPortalKind, string> = {
  employee: '/portal/employee',
  client: '/portal/client',
};

export const liquidPortalLoginRoutes: Record<ProductPortalKind, string> = {
  employee: '/auth/employee-login',
  client: '/auth/client-login',
};

export const liquidPortalNavigation: Record<
  ProductPortalKind,
  readonly LiquidPortalNavigationItem[]
> = {
  employee: [
    { id: 'home', label: 'Heute', glyph: '⌂', route: '/portal/employee', compact: true, group: 'overview' },
    { id: 'assignments', label: 'Einsätze', glyph: '◇', route: '/portal/employee/assignments', compact: true, group: 'work' },
    { id: 'open-assignments', label: 'Offene Einsätze', glyph: '◷', route: '/portal/employee/offene-einsaetze', compact: true, group: 'work' },
    { id: 'clients', label: 'Klient:innen', glyph: '○', route: '/portal/employee/clients', group: 'work' },
    { id: 'calendar', label: 'Kalender', glyph: '□', route: '/portal/employee/calendar', group: 'work' },
    { id: 'time', label: 'Arbeitszeit', glyph: '◷', route: '/portal/employee/arbeitszeit', group: 'work' },
    { id: 'logbook', label: 'Fahrtenbuch', glyph: '⌖', route: '/portal/employee/fahrtenbuch', compact: true, group: 'work' },
    { id: 'leave', label: 'Urlaub', glyph: '☼', route: '/portal/employee/arbeitszeit/urlaub', group: 'work' },
    { id: 'absence', label: 'Abwesenheit', glyph: '◌', route: '/portal/employee/arbeitszeit/abwesenheiten', group: 'work' },
    { id: 'documents', label: 'Dokumente', glyph: '▤', route: '/portal/employee/documents', group: 'communication' },
    { id: 'uploads', label: 'Uploads', glyph: '↑', route: '/portal/employee/uploads', group: 'communication' },
    { id: 'messages', label: 'Nachrichten', glyph: '▱', route: '/portal/employee/messages', compact: true, group: 'communication' },
    { id: 'payroll', label: 'Gehaltsstatistik', glyph: '€', route: '/portal/employee/payroll', group: 'account' },
    { id: 'profile', label: 'Profil', glyph: '♙', route: '/portal/employee/profile', group: 'account' },
  ],
  client: [
    { id: 'home', label: 'Übersicht', glyph: '⌂', route: '/portal/client', compact: true, group: 'overview' },
    { id: 'appointments', label: 'Einsätze', glyph: '□', route: '/portal/client/appointments', compact: true, group: 'work' },
    { id: 'live', label: 'Live-Anfahrt', glyph: '⌖', route: '/portal/client/live', group: 'work' },
    { id: 'documents', label: 'Dokumente', glyph: '▤', route: '/portal/client/documents', compact: true, group: 'communication' },
    { id: 'signatures', label: 'Unterschriften', glyph: '✎', route: '/portal/client/documents/signatures', group: 'communication' },
    { id: 'proofs', label: 'Nachweise', glyph: '✓', route: '/portal/client/proofs', group: 'communication' },
    { id: 'messages', label: 'Nachrichten', glyph: '▱', route: '/portal/client/messages', compact: true, group: 'communication' },
    { id: 'announcements', label: 'Mitteilungen', glyph: '!', route: '/portal/client/announcements', group: 'communication' },
    { id: 'budget', label: 'Budget', glyph: '€', route: '/portal/client/budget', group: 'account' },
    { id: 'help', label: 'Hilfe', glyph: '?', route: '/portal/client/help', group: 'account' },
    { id: 'profile', label: 'Profil', glyph: '♙', route: '/portal/client/profile', group: 'account' },
  ],
};
