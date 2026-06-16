export type DashboardTourAnchorKey =
  | 'welcome'
  | 'kpis'
  | 'quickActions'
  | 'modules'
  | 'nav'
  | 'firstClient';

export type DashboardTourPlacement = 'center' | 'bottom' | 'auto';

export type DashboardTourStep = {
  id: DashboardTourAnchorKey;
  title: string;
  body: string;
  placement: DashboardTourPlacement;
  /** Centered steps omit the spotlight ring. */
  spotlight: boolean;
  ctaRoute?: string;
  ctaLabel?: string;
};

export const DASHBOARD_TOUR_STEPS: DashboardTourStep[] = [
  {
    id: 'welcome',
    title: 'Willkommen in CareSuite+',
    body:
      'Schön, dass Sie da sind. Diese kurze Tour zeigt Ihnen, wo Sie nach dem Login die wichtigsten Bereiche finden.',
    placement: 'center',
    spotlight: false,
  },
  {
    id: 'kpis',
    title: 'Kennzahlen',
    body:
      'Hier sehen Sie die wichtigsten Zahlen Ihres Mandanten — zum Beispiel Klient:innen, Einsätze oder offene Aufgaben.',
    placement: 'auto',
    spotlight: true,
  },
  {
    id: 'quickActions',
    title: 'Schnellzugriff',
    body:
      'Mit diesen Schaltflächen starten Sie häufige Aufgaben direkt — ohne lange Suche im Menü.',
    placement: 'auto',
    spotlight: true,
  },
  {
    id: 'modules',
    title: 'Module',
    body:
      'Wechseln Sie hier zwischen Office, Pflege und Assist. Jedes Modul bündelt die passenden Funktionen für Ihren Alltag.',
    placement: 'auto',
    spotlight: true,
  },
  {
    id: 'nav',
    title: 'Navigation',
    body:
      'Unten auf dem Smartphone oder links am Desktop erreichen Sie weitere Bereiche — Dashboard, Klient:innen, Team und mehr.',
    placement: 'bottom',
    spotlight: false,
  },
  {
    id: 'firstClient',
    title: 'Erste Klient:in anlegen',
    body:
      'Wenn Sie neu starten, legen Sie zuerst eine Klient:in an. Danach können Sie Einsätze planen und dokumentieren.',
    placement: 'auto',
    spotlight: true,
    ctaRoute: '/office/clients',
    ctaLabel: 'Zu Klient:innen',
  },
];
