import type {
  DashboardActivity,
  DashboardKpi,
  DashboardQuickAction,
  DashboardSnapshot,
  DashboardStatusCard,
} from '@/types/dashboard';
import { CLIENT_INTAKE_NEW_ROUTE } from '@/lib/navigation/clientRoutes';
import type { OfficeDashboardMetrics } from '@/lib/office/officeDashboardMetrics';

export const OFFICE_WORKSPACE_KPI_COUNT = 8;

export type OfficeDashboardSection = {
  id: string;
  title: string;
  subtitle: string;
  links: {
    id: string;
    label: string;
    description?: string;
    route: string;
    count?: number;
    icon?: string;
  }[];
};

function unavailableSubValue(label: string, available: boolean, emptyLabel: string): string {
  if (available) return emptyLabel;
  return `${label} nicht verfügbar`;
}

/** Eight Office workspace KPIs — not Zentrale module overview tiles. */
export function buildOfficeWorkspaceKpis(metrics: OfficeDashboardMetrics): DashboardKpi[] {
  const billingOpen = metrics.openServiceRecords + metrics.draftInvoices;
  const qmOpen = metrics.openTasks + metrics.overdueTasks;
  const portalOpen = metrics.openPortalRequests;

  return [
    {
      id: 'office-ws-kpi-clients-active',
      label: 'Aktive Klient:innen',
      value: metrics.activeClients,
      subValue:
        metrics.totalClients > 0
          ? `${metrics.totalClients} gesamt`
          : unavailableSubValue('Klient:innen', metrics.tableAvailability.clients, 'Noch keine Klient:innen'),
      icon: 'teamGroup',
      accentColor: '#62F3FF',
      route: '/office/clients?status=aktiv',
    },
    {
      id: 'office-ws-kpi-employees-active',
      label: 'Aktive Mitarbeitende',
      value: metrics.activeEmployees,
      subValue:
        metrics.totalEmployees > 0
          ? `${metrics.totalEmployees} gesamt`
          : unavailableSubValue(
              'Mitarbeitende',
              metrics.tableAvailability.employees,
              'Noch keine Mitarbeitende',
            ),
      icon: 'personSingle',
      accentColor: '#FF9500',
      route: '/office/employees?status=aktiv',
    },
    {
      id: 'office-ws-kpi-appointments-today',
      label: 'Termine heute',
      value: metrics.appointmentsToday,
      subValue: unavailableSubValue(
        'Termine',
        metrics.tableAvailability.appointments,
        metrics.appointmentsToday === 0 ? 'Keine Termine heute' : `${metrics.appointmentsToday} geplant`,
      ),
      icon: 'calendar',
      accentColor: '#6366F1',
      route: '/office/appointments?date=today',
    },
    {
      id: 'office-ws-kpi-messages',
      label: 'Offene Nachrichten',
      value: metrics.unreadMessages,
      subValue: unavailableSubValue(
        'Nachrichten',
        metrics.tableAvailability.messages,
        metrics.unreadMessages === 0 ? 'Keine offenen Nachrichten' : `${metrics.unreadMessages} ungelesen`,
      ),
      icon: 'messageWave',
      accentColor: '#62F3FF',
      route: '/office/messages?filter=unread',
    },
    {
      id: 'office-ws-kpi-documents',
      label: 'Offene Dokumente',
      value: metrics.documentsForReview,
      subValue: unavailableSubValue(
        'Dokumente',
        metrics.tableAvailability.documents,
        metrics.documentsForReview === 0 ? 'Keine offenen Dokumente' : `${metrics.documentsForReview} zur Prüfung`,
      ),
      icon: 'docsReview',
      accentColor: '#EC4899',
      route: '/office/documents?status=pending',
    },
    {
      id: 'office-ws-kpi-portal',
      label: 'Portalzugänge offen',
      value: portalOpen,
      subValue: unavailableSubValue(
        'Portal-Anfragen',
        metrics.tableAvailability.portalRequests,
        portalOpen === 0 ? 'Keine offenen Portalzugänge' : `${portalOpen} Anfrage${portalOpen === 1 ? '' : 'n'}`,
      ),
      icon: 'portalInbox',
      accentColor: '#F97316',
      route: '/business/office/access/client-portal',
    },
    {
      id: 'office-ws-kpi-billing',
      label: 'Nachweise/Abrechnung offen',
      value: billingOpen,
      subValue: unavailableSubValue(
        'Abrechnung',
        metrics.tableAvailability.serviceRecords || metrics.tableAvailability.invoices,
        billingOpen === 0 ? 'Keine offenen Nachweise' : `${metrics.openServiceRecords} Nachweise · ${metrics.draftInvoices} Entwürfe`,
      ),
      icon: 'serviceRecord',
      accentColor: '#A855F7',
      route: '/office/billing-preparation',
    },
    {
      id: 'office-ws-kpi-qm',
      label: 'QM/Fristen',
      value: qmOpen,
      subValue: unavailableSubValue(
        'QM',
        metrics.tableAvailability.tasks,
        qmOpen === 0
          ? 'Keine offenen Fristen'
          : `${metrics.overdueTasks > 0 ? `${metrics.overdueTasks} überfällig · ` : ''}${metrics.openTasks} offen`,
      ),
      icon: 'qmShield',
      accentColor: '#7C5CFF',
      route: '/business/office/qm',
    },
  ];
}

export const OFFICE_HEADER_PRIMARY_ACTIONS: DashboardQuickAction[] = [
  {
    id: 'office-header-client',
    label: 'Klient:in anlegen',
    icon: '➕',
    route: CLIENT_INTAKE_NEW_ROUTE,
    variant: 'primary',
  },
  {
    id: 'office-header-employee',
    label: 'Mitarbeiter:in anlegen',
    icon: '➕',
    route: '/office/employees/create',
    variant: 'primary',
  },
];

export const OFFICE_HEADER_SECONDARY_ACTIONS: DashboardQuickAction[] = [
  {
    id: 'office-header-calendar',
    label: 'Kalender öffnen',
    icon: '🗓️',
    route: '/office/calendar',
    variant: 'secondary',
  },
  {
    id: 'office-header-messages',
    label: 'Nachrichten öffnen',
    icon: '💬',
    route: '/office/messages',
    variant: 'secondary',
  },
  {
    id: 'office-header-document',
    label: 'Dokument erstellen',
    icon: '📄',
    route: '/office/documents/upload',
    variant: 'secondary',
  },
];

export const OFFICE_HEADER_OPTIONAL_ACTIONS: DashboardQuickAction[] = [
  {
    id: 'office-header-billing',
    label: 'Abrechnung prüfen',
    icon: '📋',
    route: '/office/billing-preparation',
    variant: 'secondary',
  },
];

export const OFFICE_SIDEBAR_QUICK_ACTIONS: DashboardQuickAction[] = [
  { id: 'office-qa-client', label: 'Klient anlegen', icon: '👤', route: CLIENT_INTAKE_NEW_ROUTE },
  { id: 'office-qa-employee', label: 'Mitarbeiter anlegen', icon: '👥', route: '/office/employees/create' },
  { id: 'office-qa-appointment', label: 'Termin', icon: '📅', route: '/office/appointments?create=1' },
  { id: 'office-qa-document', label: 'Dokument', icon: '📄', route: '/office/documents/upload' },
  { id: 'office-qa-message', label: 'Nachricht', icon: '💬', route: '/office/messages?create=1' },
  { id: 'office-qa-broadcast', label: 'Broadcast', icon: '📢', route: '/office/messages?audience=employees&view=broadcasts' },
  {
    id: 'office-qa-portal',
    label: 'Portalzugänge',
    icon: '🔐',
    route: '/business/office/access/client-portal',
  },
  {
    id: 'office-qa-billing',
    label: 'Abrechnung prüfen',
    icon: '📋',
    route: '/office/billing-preparation',
  },
];

export function buildOfficeDashboardSections(snapshot: DashboardSnapshot): OfficeDashboardSection[] {
  const kpiValue = (id: string) => Number(snapshot.kpis.find((k) => k.id === id)?.value ?? 0);
  const areaCount = (id: string) => snapshot.areaShortcuts?.find((a) => a.id === id)?.count;

  const clientsCount = areaCount('clients');
  const employeesCount = areaCount('employees');
  const appointmentsCount = areaCount('appointments');

  return [
    {
      id: 'operations',
      title: 'Heute im Betrieb',
      subtitle: 'Offene Vorgänge und letzte Aktivitäten',
      links: [
        ...(snapshot.statusCards.length > 0
          ? snapshot.statusCards.map((card) => ({
              id: card.id,
              label: card.title,
              description: card.description,
              route: statusCardRoute(card),
              count: card.count,
              icon: statusCardIcon(card),
            }))
          : [
              {
                id: 'operations-empty',
                label: 'Keine offenen Vorgänge',
                description: 'Alle Vorgänge sind erledigt oder noch nicht erfasst.',
                route: '/business/office/access/tasks',
                icon: '✓',
              },
            ]),
      ],
    },
    {
      id: 'people',
      title: 'Klient:innen & Mitarbeitende',
      subtitle: 'Stammdaten, Aufnahme und Team',
      links: [
        {
          id: 'people-clients',
          label: 'Klient:innen',
          description: 'Liste, Suche und Aufnahme',
          route: '/office/clients',
          count: clientsCount,
          icon: '👥',
        },
        {
          id: 'people-employees',
          label: 'Mitarbeitende',
          description: 'Teamliste und Qualifikationen',
          route: '/office/employees',
          count: employeesCount,
          icon: '👤',
        },
        {
          id: 'people-intake',
          label: 'Klient:in anlegen',
          description: 'Neue Aufnahme starten',
          route: CLIENT_INTAKE_NEW_ROUTE,
          icon: '➕',
        },
      ],
    },
    {
      id: 'calendar',
      title: 'Kalender & Planung',
      subtitle: 'Termine und Wochenübersicht',
      links: [
        {
          id: 'calendar-view',
          label: 'Kalender',
          description: 'Mehransicht und Planung',
          route: '/office/calendar',
          icon: '🗓️',
        },
        {
          id: 'calendar-appointments',
          label: 'Terminverwaltung',
          description: 'Termine anlegen und bearbeiten',
          route: '/office/appointments',
          count: appointmentsCount,
          icon: '📅',
        },
      ],
    },
    {
      id: 'communication',
      title: 'Kommunikation',
      subtitle: 'Nachrichten, Broadcasts und Vorlagen',
      links: [
        {
          id: 'comm-inbox',
          label: 'Nachrichten',
          description: 'Interne Kommunikation',
          route: '/office/messages',
          count: kpiValue('office-ws-kpi-messages'),
          icon: '💬',
        },
        {
          id: 'comm-broadcast',
          label: 'Broadcast',
          description: 'Rundschreiben an Mitarbeitende',
          route: '/office/messages?audience=employees&view=broadcasts',
          icon: '📢',
        },
        {
          id: 'comm-templates',
          label: 'Nachrichten-Vorlagen',
          description: 'Schnellantworten verwalten',
          route: '/office/messages/templates',
          icon: '📝',
        },
      ],
    },
    {
      id: 'documents',
      title: 'Dokumente & Unterschriften',
      subtitle: 'Signaturaufträge, zentrale Akte und Uploads',
      links: [
        {
          id: 'docs-signatures',
          label: 'Dokumente & Unterschriften',
          description: 'Signaturaufträge an Mitarbeitende und Klient:innen',
          route: '/business/office/documents/signatures',
          icon: '✍️',
        },
        {
          id: 'docs-list',
          label: 'Dokumentenablage',
          description: 'Zentrale Akte durchsuchen',
          route: '/office/documents',
          count: kpiValue('office-ws-kpi-documents'),
          icon: '📁',
        },
        {
          id: 'docs-upload',
          label: 'Dokument erstellen',
          description: 'Neues Dokument hochladen',
          route: '/office/documents/upload',
          icon: '📤',
        },
      ],
    },
    {
      id: 'billing',
      title: 'Abrechnungsvorbereitung',
      subtitle: 'Kandidaten prüfen — keine finale Rechnung',
      links: [
        {
          id: 'billing-prep',
          label: 'Abrechnung prüfen',
          description: 'Nachweise und Entwürfe vorbereiten',
          route: '/office/billing-preparation',
          count: kpiValue('office-ws-kpi-billing'),
          icon: '📋',
        },
        {
          id: 'billing-budgets',
          label: 'Budgets & Warnungen',
          description: 'Budgetverbrauch im Blick behalten',
          route: '/office/clients',
          icon: '⚠️',
        },
      ],
    },
    {
      id: 'quality',
      title: 'Qualität & Organisation',
      subtitle: 'QM, Module und Audit',
      links: [
        {
          id: 'quality-qm',
          label: 'Qualitätsmanagement',
          description: 'Handbuch, Prüfungen, Compliance',
          route: '/business/office/qm',
          count: kpiValue('office-ws-kpi-qm'),
          icon: '✅',
        },
        {
          id: 'quality-modules',
          label: 'Modulzuordnungen',
          description: 'Klient:innen und Leistungen je Modul',
          route: '/business/office/modules',
          count: areaCount('modules'),
          icon: '🧩',
        },
        {
          id: 'quality-audit',
          label: 'Audit-Log',
          description: 'Office Änderungsprotokoll',
          route: '/business/office/audit-log',
          icon: '📋',
        },
      ],
    },
  ];
}

function statusCardRoute(card: DashboardStatusCard): string {
  if (card.id.includes('clients') || card.id.includes('intake')) return '/office/clients?status=in_bearbeitung';
  if (card.id.includes('invoice') || card.id.includes('billing')) return '/office/billing-preparation';
  if (card.id.includes('modules')) return '/business/office/modules';
  return '/business/office/access/tasks';
}

function statusCardIcon(card: DashboardStatusCard): string {
  if (card.id.includes('clients')) return '👥';
  if (card.id.includes('invoice') || card.id.includes('billing')) return '📋';
  if (card.id.includes('modules')) return '🧩';
  return '📌';
}

export function buildOfficeWorkspaceSnapshotFields(
  metrics: OfficeDashboardMetrics,
): Pick<DashboardSnapshot, 'kpis' | 'quickActions' | 'primaryAction' | 'heroSubtitle'> {
  return {
    kpis: buildOfficeWorkspaceKpis(metrics),
    quickActions: OFFICE_SIDEBAR_QUICK_ACTIONS,
    primaryAction: OFFICE_HEADER_PRIMARY_ACTIONS[0],
    heroSubtitle: 'Verwaltung, Organisation und Kommunikation',
  };
}
