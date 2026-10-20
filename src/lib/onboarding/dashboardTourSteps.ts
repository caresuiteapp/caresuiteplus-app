import { CLIENT_INTAKE_NEW_ROUTE } from '@/lib/navigation/clientRoutes';

export type DashboardTourAnchorKey =
  | 'welcome'
  | 'kpis'
  | 'recent'
  | 'quickActions'
  | 'moreActions'
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
      'Kurz Überblick: Oben Kennzahlen, in der Mitte Ihre letzten Aktivitäten, rechts bzw. darunter Schnellzugriff und der Bereich „Ihre Module“.',
    placement: 'center',
    spotlight: false,
  },
  {
    id: 'kpis',
    title: 'Kennzahlen',
    body:
      'Hier sehen Sie die wichtigsten Zahlen Ihres Mandanten — zum Beispiel Klient:innen, Einsätze oder offene Aufgaben. Bei neuen Mandanten starten die Werte bei 0.',
    placement: 'auto',
    spotlight: true,
  },
  {
    id: 'recent',
    title: 'Letzte Aktivitäten',
    body:
      'Im Verlauf erscheinen neue Vorgänge — angelegte Klient:innen, Einsätze oder Rechnungen. Solange noch nichts passiert ist, bleibt die Liste leer.',
    placement: 'auto',
    spotlight: true,
  },
  {
    id: 'quickActions',
    title: 'Schnellzugriff',
    body:
      'Unter „Schnellzugriff“ finden Sie die zwei wichtigsten Aktionen direkt als Buttons — z. B. „Klient:in anlegen“ und „Einsatz planen“.',
    placement: 'auto',
    spotlight: true,
  },
  {
    id: 'moreActions',
    title: 'Mehr Aktionen',
    body:
      'Über „Mehr Aktionen“ öffnet sich ein Dropdown mit weiteren Funktionen — Klient:innenliste, Rechnung, Mitarbeitende oder Nachrichten.',
    placement: 'auto',
    spotlight: true,
  },
  {
    id: 'modules',
    title: 'Ihre Module',
    body:
      'Der Bereich „Ihre Module“ ist bewusst getrennt vom Schnellzugriff: Hier wechseln Sie zwischen Office, Pflege und Assist.',
    placement: 'auto',
    spotlight: true,
  },
  {
    id: 'nav',
    title: 'Navigation',
    body:
      'Unten auf dem Smartphone oder links am Desktop erreichen Sie weitere Bereiche — Dashboard, Klient:innen, Mitarbeitende und mehr.',
    placement: 'bottom',
    spotlight: false,
  },
  {
    id: 'firstClient',
    title: 'Erste Klient:in anlegen',
    body:
      'Starten Sie mit dem orangenen Button „Klient:in anlegen“. Die Klient:innenliste finden Sie im Dropdown unter „Mehr Aktionen“ — nicht noch einmal als zweiter Button.',
    placement: 'auto',
    spotlight: true,
    ctaRoute: CLIENT_INTAKE_NEW_ROUTE,
    ctaLabel: 'Klient:in anlegen',
  },
];
