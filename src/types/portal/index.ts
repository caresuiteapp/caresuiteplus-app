export * from './visibility';
export * from './communication';
export * from './documents';
export * from './employee';
export * from './client';
export * from './clientPortalDomain';

export type PortalScope = 'portal_employee' | 'portal_client' | 'portal_family';

export type PortalTabKey = 'overview' | 'appointments' | 'messages' | 'documents';

export const PORTAL_TAB_LABELS: Record<PortalTabKey, string> = {
  overview: 'Übersicht',
  appointments: 'Einsätze',
  messages: 'Nachrichten',
  documents: 'Dokumente',
};

export const PORTAL_CLIENT_TAB_LABELS: Record<PortalTabKey, string> = {
  ...PORTAL_TAB_LABELS,
  appointments: 'Termine',
};
