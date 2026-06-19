import type { DashboardKpi } from '@/types/dashboard';
import type { MainModuleKey, ModuleNavConfig, ModuleNavItem } from '@/types/navigation/platform';
import { useOfficeDashboard } from '@/hooks/useOfficeDashboard';
import { CLIENT_INTAKE_NEW_ROUTE } from '@/lib/navigation/clientRoutes';
import { getModuleNavConfig } from '@/lib/navigation/modulenav';
import { zentraleNav } from '@/lib/navigation/modulenav/zentralenav';

export const OFFICE_QUICK_ACTIONS = [
  { label: 'Klient:in anlegen', icon: '➕', href: CLIENT_INTAKE_NEW_ROUTE },
  { label: 'Rechnung erstellen', icon: '🧾', href: '/office/invoices/create' },
  { label: 'Termin planen', icon: '📅', href: '/office/appointments/create' },
  { label: 'Dokument hochladen', icon: '📁', href: '/office/documents/upload' },
];

/** Nav links shown beside Schnellaktionen in the right context panel (Office → business hub). */
export function resolveContextPanelNavConfig(mainModule: MainModuleKey): ModuleNavConfig {
  if (mainModule === 'office' || mainModule === 'zentrale') {
    return zentraleNav;
  }
  return getModuleNavConfig(mainModule);
}

export function buildContextPanelNavItems(mainModule: MainModuleKey): ModuleNavItem[] {
  return resolveContextPanelNavConfig(mainModule).groups.flatMap((group) => group.items);
}

export const DEMO_MODULE_STATUS: Record<MainModuleKey, { label: string; status: string }[]> = {
  zentrale: [
    { label: 'Module aktiv', status: '3/6' },
    { label: 'Nachrichten', status: '2 neu' },
  ],
  office: [
    { label: 'Klient:innen', status: 'Aktiv' },
    { label: 'Rechnungen', status: '3 offen' },
  ],
  assist: [
    { label: 'Einsätze heute', status: '5' },
    { label: 'Nachweise', status: '2 offen' },
  ],
  pflege: [
    { label: 'Pflegepläne', status: 'Aktuell' },
    { label: 'Vitalwerte', status: '1 Warnung' },
  ],
  stationaer: [
    { label: 'Belegung', status: '92%' },
    { label: 'Übergaben', status: '1 offen' },
  ],
  beratung: [
    { label: 'Offene Fälle', status: '4' },
    { label: 'Wiedervorlagen', status: '2 heute' },
  ],
  akademie: [
    { label: 'Kurse aktiv', status: '6' },
    { label: 'Pflichtschulungen', status: '3 fällig' },
  ],
  admin: [
    { label: 'Benutzer', status: '12 aktiv' },
    { label: 'Integrationen', status: '2 verbunden' },
  ],
};

const DEMO_OPEN_TASKS = [
  { title: 'Offene Aufgaben', count: 2 },
  { title: 'Zu prüfen', count: 1 },
];

function findKpi(kpis: DashboardKpi[] | undefined, id: string): DashboardKpi | undefined {
  return kpis?.find((kpi) => kpi.id === id);
}

export function buildOfficeModuleStatusChips(
  kpis: DashboardKpi[] | undefined,
): { label: string; status: string }[] {
  const clientsKpi = findKpi(kpis, 'office-kpi-clients');
  const invoicesKpi = findKpi(kpis, 'office-kpi-invoices');
  const openInvoices = Number(invoicesKpi?.value ?? 0);

  return [
    {
      label: 'Klient:innen',
      status:
        clientsKpi && Number(clientsKpi.value) > 0
          ? `${clientsKpi.value} aktiv`
          : 'Keine Klient:innen',
    },
    {
      label: 'Rechnungen',
      status: openInvoices > 0 ? `${openInvoices} offen` : 'Keine offenen',
    },
  ];
}

export function buildLiveModuleStatusChips(mainModule: MainModuleKey): { label: string; status: string }[] {
  return [{ label: 'Modul', status: mainModule === 'office' ? 'Office Live' : 'Live' }];
}

export function buildOpenTasks(
  mainModule: MainModuleKey,
  officeData: ReturnType<typeof useOfficeDashboard>['data'],
  isLive: boolean,
): { title: string; count: number | string }[] {
  if (mainModule === 'office' && officeData) {
    const cards = officeData.statusCards.slice(0, 3);
    if (cards.length > 0) {
      return cards.map((card) => ({
        title: card.title,
        count: card.count ?? 0,
      }));
    }
    if (isLive) {
      return [{ title: 'Keine offenen Vorgänge', count: 0 }];
    }
  }

  if (isLive) {
    return [{ title: 'Keine offenen Vorgänge', count: 0 }];
  }

  return DEMO_OPEN_TASKS;
}
