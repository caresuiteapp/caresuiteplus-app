import type { DashboardKpi, DashboardQuickAction } from '@/types/dashboard';
import type { ResidentListItem, StationaerDashboardStats } from '@/types/modules/stationaer';

export const STATIONAER_WORKSPACE_KPI_COUNT = 12;
export const STATIONAER_ACCENT = '#EF4444';

export type StationaerDashboardSection = {
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

export type StationaerPriorityItem = {
  id: string;
  label: string;
  description: string;
  route: string;
  severity: 'high' | 'medium' | 'low';
  count?: number;
};

function emptySubValue(count: number, emptyLabel: string, activeLabel: (n: number) => string): string {
  return count === 0 ? emptyLabel : activeLabel(count);
}

/** Twelve residential facility workspace KPIs — not Zentrale or Office tiles. */
export function buildStationaerWorkspaceKpis(stats: StationaerDashboardStats): DashboardKpi[] {
  const accent = STATIONAER_ACCENT;
  const warn = '#F59E0B';
  const danger = '#DC2626';

  return [
    {
      id: 'stationaer-ws-kpi-residents',
      label: 'Bewohner:innen aktuell',
      value: stats.activeCount,
      subValue:
        stats.totalResidents > 0
          ? `${stats.totalResidents} gesamt`
          : 'Noch keine Bewohner:innen',
      icon: '🏠',
      accentColor: accent,
      route: '/stationaer/bewohner?status=aktiv',
    },
    {
      id: 'stationaer-ws-kpi-occupancy',
      label: 'Belegungsquote',
      value: `${stats.occupancyPercent} %`,
      subValue:
        stats.totalBeds > 0
          ? `${stats.totalBeds - stats.freeBeds} von ${stats.totalBeds} Betten`
          : stats.occupancyPercent === 0
            ? 'Keine Belegungsdaten'
            : `${stats.occupancyPercent} % belegt`,
      icon: '🛏️',
      accentColor: stats.occupancyPercent >= 90 ? warn : accent,
      route: '/stationaer/belegung',
    },
    {
      id: 'stationaer-ws-kpi-free-beds',
      label: 'Freie Plätze',
      value: stats.freeBeds,
      subValue: emptySubValue(stats.freeBeds, 'Keine freien Plätze erfasst', (n) => `${n} verfügbar`),
      icon: '✨',
      accentColor: accent,
      route: '/stationaer/belegung?filter=free',
    },
    {
      id: 'stationaer-ws-kpi-admissions',
      label: 'Neuaufnahmen heute/diese Woche',
      value: stats.admissionsToday,
      subValue:
        stats.admissionsThisWeek === 0
          ? 'Keine Neuaufnahmen diese Woche'
          : `${stats.admissionsThisWeek} diese Woche`,
      icon: '📥',
      accentColor: stats.admissionsThisWeek > 0 ? warn : accent,
      route: '/stationaer/belegung?filter=admissions',
    },
    {
      id: 'stationaer-ws-kpi-discharges',
      label: 'Entlassungen heute/diese Woche',
      value: stats.dischargesToday,
      subValue:
        stats.dischargesThisWeek === 0
          ? 'Keine Entlassungen diese Woche'
          : `${stats.dischargesThisWeek} diese Woche`,
      icon: '📤',
      accentColor: accent,
      route: '/stationaer/bewohner?status=archiviert',
    },
    {
      id: 'stationaer-ws-kpi-room-assignments',
      label: 'Offene Zimmerbelegung',
      value: stats.openRoomAssignments,
      subValue: emptySubValue(
        stats.openRoomAssignments,
        'Keine offenen Zimmerzuweisungen',
        (n) => `${n} offen`,
      ),
      icon: '🚪',
      accentColor: stats.openRoomAssignments > 0 ? warn : accent,
      route: '/stationaer/zimmer?status=open',
    },
    {
      id: 'stationaer-ws-kpi-living-areas',
      label: 'Wohnbereiche aktiv',
      value: stats.activeLivingAreas,
      subValue: emptySubValue(stats.activeLivingAreas, 'Keine Wohnbereiche erfasst', (n) => `${n} aktiv`),
      icon: '🏘️',
      accentColor: accent,
      route: '/stationaer/wohnbereiche?status=aktiv',
    },
    {
      id: 'stationaer-ws-kpi-daily-structure',
      label: 'Tagesstruktur offen',
      value: stats.openDailyStructureCount,
      subValue: emptySubValue(
        stats.openDailyStructureCount,
        'Tagesstruktur vollständig',
        (n) => `${n} offen`,
      ),
      icon: '⏰',
      accentColor: stats.openDailyStructureCount > 0 ? warn : accent,
      route: '/stationaer/tagesstruktur?status=open',
    },
    {
      id: 'stationaer-ws-kpi-meals',
      label: 'Mahlzeitenorganisation offen',
      value: stats.openMealPlanningCount,
      subValue: emptySubValue(
        stats.openMealPlanningCount,
        'Mahlzeiten geplant',
        (n) => `${n} offen`,
      ),
      icon: '🍽️',
      accentColor: stats.openMealPlanningCount > 0 ? warn : accent,
      route: '/stationaer/mahlzeiten?status=open',
    },
    {
      id: 'stationaer-ws-kpi-handovers',
      label: 'Offene Übergaben',
      value: stats.openHandoversCount,
      subValue: emptySubValue(
        stats.openHandoversCount,
        'Keine offenen Übergaben',
        (n) => `${n} offen`,
      ),
      icon: '🔄',
      accentColor: stats.openHandoversCount > 0 ? warn : accent,
      route: '/stationaer/uebergabe?status=open',
    },
    {
      id: 'stationaer-ws-kpi-handover-reports',
      label: 'Übergabeberichte offen',
      value: stats.openHandoverReportsCount,
      subValue: emptySubValue(
        stats.openHandoverReportsCount,
        'Keine offenen Berichte',
        (n) => `${n} offen`,
      ),
      icon: '📝',
      accentColor: stats.openHandoverReportsCount > 0 ? warn : accent,
      route: '/stationaer/uebergabebericht?status=open',
    },
    {
      id: 'stationaer-ws-kpi-alerts',
      label: 'Auffälligkeiten / Hinweise',
      value: stats.alertsCount,
      subValue: emptySubValue(stats.alertsCount, 'Keine Auffälligkeiten', (n) => `${n} prüfen`),
      icon: '⚠️',
      accentColor: stats.alertsCount > 0 ? danger : accent,
      route: '/stationaer/auswertungen?filter=alerts',
    },
  ];
}

export const STATIONAER_HEADER_PRIMARY_ACTIONS: DashboardQuickAction[] = [
  {
    id: 'stationaer-header-resident',
    label: 'Bewohner:in anlegen',
    icon: '➕',
    route: '/stationaer/bewohner?create=1',
    variant: 'primary',
  },
  {
    id: 'stationaer-header-admission',
    label: 'Aufnahme starten',
    icon: '➕',
    route: '/stationaer/belegung?aufnahme=1',
    variant: 'primary',
  },
];

export const STATIONAER_HEADER_SECONDARY_ACTIONS: DashboardQuickAction[] = [
  {
    id: 'stationaer-header-occupancy',
    label: 'Belegung öffnen',
    icon: '🛏️',
    route: '/stationaer/belegung',
    variant: 'secondary',
  },
  {
    id: 'stationaer-header-handover',
    label: 'Übergabe schreiben',
    icon: '🔄',
    route: '/stationaer/uebergabe?create=1',
    variant: 'secondary',
  },
  {
    id: 'stationaer-header-rooms',
    label: 'Zimmerübersicht',
    icon: '🚪',
    route: '/stationaer/zimmer',
    variant: 'secondary',
  },
  {
    id: 'stationaer-header-daily',
    label: 'Tagesstruktur öffnen',
    icon: '⏰',
    route: '/stationaer/tagesstruktur',
    variant: 'secondary',
  },
];

export const STATIONAER_SIDEBAR_QUICK_ACTIONS: DashboardQuickAction[] = [
  {
    id: 'stationaer-qa-resident',
    label: 'Bewohner:in anlegen',
    icon: '➕',
    route: '/stationaer/bewohner?create=1',
  },
  {
    id: 'stationaer-qa-admission',
    label: 'Aufnahme starten',
    icon: '📥',
    route: '/stationaer/belegung?aufnahme=1',
  },
  {
    id: 'stationaer-qa-occupancy',
    label: 'Belegung öffnen',
    icon: '🛏️',
    route: '/stationaer/belegung',
  },
  {
    id: 'stationaer-qa-rooms',
    label: 'Zimmerübersicht',
    icon: '🚪',
    route: '/stationaer/zimmer',
  },
  {
    id: 'stationaer-qa-handover',
    label: 'Übergabe schreiben',
    icon: '🔄',
    route: '/stationaer/uebergabe?create=1',
  },
  {
    id: 'stationaer-qa-daily',
    label: 'Tagesstruktur',
    icon: '⏰',
    route: '/stationaer/tagesstruktur',
  },
  {
    id: 'stationaer-qa-meals',
    label: 'Mahlzeiten',
    icon: '🍽️',
    route: '/stationaer/mahlzeiten',
  },
  {
    id: 'stationaer-qa-reports',
    label: 'Auswertungen',
    icon: '📈',
    route: '/stationaer/auswertungen',
  },
];

export const STATIONAER_QUICK_ACCESS: DashboardQuickAction[] = [
  { id: 'stationaer-qa-all-residents', label: 'Alle Bewohner:innen', icon: '🏥', route: '/stationaer/bewohner' },
  { id: 'stationaer-qa-belegung', label: 'Belegung', icon: '🛏️', route: '/stationaer/belegung' },
  { id: 'stationaer-qa-planung', label: 'Bewohnerplanung', icon: '📋', route: '/stationaer/bewohnerplanung' },
  { id: 'stationaer-qa-wohnbereiche', label: 'Wohnbereiche', icon: '🏘️', route: '/stationaer/wohnbereiche' },
  { id: 'stationaer-qa-zimmer', label: 'Zimmer', icon: '🚪', route: '/stationaer/zimmer' },
  { id: 'stationaer-qa-tagesstruktur', label: 'Tagesstruktur', icon: '⏰', route: '/stationaer/tagesstruktur' },
  { id: 'stationaer-qa-mahlzeiten', label: 'Mahlzeiten', icon: '🍽️', route: '/stationaer/mahlzeiten' },
  { id: 'stationaer-qa-uebergabe', label: 'Übergabe', icon: '🔄', route: '/stationaer/uebergabe' },
  {
    id: 'stationaer-qa-uebergabebericht',
    label: 'Übergabeberichte',
    icon: '📝',
    route: '/stationaer/uebergabebericht',
  },
  { id: 'stationaer-qa-auswertungen', label: 'Auswertungen', icon: '📈', route: '/stationaer/auswertungen' },
  { id: 'stationaer-qa-settings', label: 'Einstellungen', icon: '⚙️', route: '/stationaer/settings' },
];

export function buildStationaerDashboardPriorities(
  stats: StationaerDashboardStats,
): StationaerPriorityItem[] {
  const items: StationaerPriorityItem[] = [];

  if (stats.roomConflictCount > 0) {
    items.push({
      id: 'priority-room-conflicts',
      label: 'Zimmerkonflikte',
      description: `${stats.roomConflictCount} Belegungskonflikt(e) — bitte prüfen.`,
      route: '/stationaer/zimmer?filter=conflict',
      severity: 'high',
      count: stats.roomConflictCount,
    });
  }
  if (stats.openHandoversCount > 0) {
    items.push({
      id: 'priority-handovers',
      label: 'Offene Übergaben',
      description: `${stats.openHandoversCount} Übergabe(n) sind noch nicht abgeschlossen.`,
      route: '/stationaer/uebergabe?status=open',
      severity: 'high',
      count: stats.openHandoversCount,
    });
  }
  if (stats.admissionsToday > 0) {
    items.push({
      id: 'priority-admissions-today',
      label: 'Neuaufnahmen heute',
      description: `${stats.admissionsToday} Neuaufnahme(n) stehen heute an.`,
      route: '/stationaer/belegung?filter=admissions&date=today',
      severity: 'medium',
      count: stats.admissionsToday,
    });
  }
  if (stats.openRoomAssignments > 0) {
    items.push({
      id: 'priority-room-assignments',
      label: 'Offene Zimmerbelegung',
      description: `${stats.openRoomAssignments} Zimmerzuweisung(en) warten auf Abschluss.`,
      route: '/stationaer/zimmer?status=open',
      severity: 'medium',
      count: stats.openRoomAssignments,
    });
  }
  if (stats.openMealPlanningCount > 0) {
    items.push({
      id: 'priority-meals',
      label: 'Mahlzeitenorganisation offen',
      description: `${stats.openMealPlanningCount} Mahlzeit(en) sind noch nicht geplant.`,
      route: '/stationaer/mahlzeiten?status=open',
      severity: 'low',
      count: stats.openMealPlanningCount,
    });
  }
  if (stats.openResidentPlanningCount > 0) {
    items.push({
      id: 'priority-resident-planning',
      label: 'Offene Bewohnerplanung',
      description: `${stats.openResidentPlanningCount} Planung(en) stehen aus.`,
      route: '/stationaer/bewohnerplanung?status=open',
      severity: 'low',
      count: stats.openResidentPlanningCount,
    });
  }

  return items;
}

export function buildStationaerOpenTasks(
  stats: StationaerDashboardStats | null | undefined,
): { title: string; count: number | string }[] {
  if (!stats) {
    return [{ title: 'Keine Einrichtungsdaten', count: '—' }];
  }

  return [
    { title: 'Neuaufnahmen', count: stats.admissionsToday },
    { title: 'Entlassungen', count: stats.dischargesToday },
    { title: 'Offene Übergaben', count: stats.openHandoversCount },
    { title: 'Freie Plätze', count: stats.freeBeds },
    { title: 'Offene Bewohnerplanung', count: stats.openResidentPlanningCount },
    { title: 'Zimmerkonflikte', count: stats.roomConflictCount },
  ];
}

export function buildStationaerDashboardSections(
  stats: StationaerDashboardStats,
  activeResidents: ResidentListItem[],
): StationaerDashboardSection[] {
  return [
    {
      id: 'residents-occupancy',
      title: 'Bewohner:innen & Belegung',
      subtitle: 'Aktive Bewohner:innen, Belegung und Aufnahmen',
      links: [
        {
          id: 'res-all',
          label: 'Alle Bewohner:innen',
          description: 'Suche, Filter und Zimmer',
          route: '/stationaer/bewohner',
          count: stats.activeCount,
          icon: '🏥',
        },
        {
          id: 'res-occupancy',
          label: 'Belegung',
          description: 'Betten, freie Plätze und Zuweisungen',
          route: '/stationaer/belegung',
          count: stats.freeBeds,
          icon: '🛏️',
        },
        {
          id: 'res-planning',
          label: 'Bewohnerplanung',
          description: 'Pflegefokus und Review-Termine',
          route: '/stationaer/bewohnerplanung',
          count: stats.openResidentPlanningCount,
          icon: '📋',
        },
        {
          id: 'res-create',
          label: 'Bewohner:in anlegen',
          description: 'Neue Bewohner:in erfassen',
          route: '/stationaer/bewohner?create=1',
          icon: '➕',
        },
        {
          id: 'res-admission',
          label: 'Aufnahme starten',
          description: 'Neuaufnahme-Prozess beginnen',
          route: '/stationaer/belegung?aufnahme=1',
          icon: '📥',
        },
      ],
    },
    {
      id: 'areas-rooms',
      title: 'Wohnbereiche & Zimmer',
      subtitle: 'Wohnbereiche, Zimmer und Belegungsstatus',
      links: [
        {
          id: 'areas-list',
          label: 'Wohnbereiche',
          description: 'Bereiche und Belegungsübersicht',
          route: '/stationaer/wohnbereiche',
          count: stats.activeLivingAreas,
          icon: '🏘️',
        },
        {
          id: 'rooms-list',
          label: 'Zimmer',
          description: 'Zimmerübersicht und Konflikte',
          route: '/stationaer/zimmer',
          count: stats.openRoomAssignments,
          icon: '🚪',
        },
        {
          id: 'rooms-free',
          label: 'Freie Plätze',
          description: 'Verfügbare Betten und Kapazität',
          route: '/stationaer/belegung?filter=free',
          count: stats.freeBeds,
          icon: '✨',
        },
      ],
    },
    {
      id: 'daily-care',
      title: 'Alltag & Versorgung',
      subtitle: 'Tagesstruktur, Mahlzeiten und Einrichtungsalltag',
      links: [
        {
          id: 'daily-structure',
          label: 'Tagesstruktur',
          description: 'Tagesablauf und Aktivitäten',
          route: '/stationaer/tagesstruktur',
          count: stats.openDailyStructureCount,
          icon: '⏰',
        },
        {
          id: 'meals',
          label: 'Mahlzeiten',
          description: 'Speiseplan und Diät-Hinweise',
          route: '/stationaer/mahlzeiten',
          count: stats.openMealPlanningCount,
          icon: '🍽️',
        },
        {
          id: 'calendar',
          label: 'Kalender',
          description: 'Termine, Aufnahmen und Aktivitäten',
          route: '/stationaer/calendar',
          icon: '📅',
        },
      ],
    },
    {
      id: 'handover-reports',
      title: 'Übergabe & Berichte',
      subtitle: 'Schichtübergaben und Übergabeberichte',
      links: [
        {
          id: 'handover',
          label: 'Übergabe',
          description: 'Schicht- und Teamübergaben',
          route: '/stationaer/uebergabe',
          count: stats.openHandoversCount,
          icon: '🔄',
        },
        {
          id: 'handover-reports',
          label: 'Übergabeberichte',
          description: 'Dokumentierte Übergaben',
          route: '/stationaer/uebergabebericht',
          count: stats.openHandoverReportsCount,
          icon: '📝',
        },
        {
          id: 'handover-create',
          label: 'Übergabe schreiben',
          description: 'Neue Übergabe dokumentieren',
          route: '/stationaer/uebergabe?create=1',
          icon: '➕',
        },
      ],
    },
    {
      id: 'analytics',
      title: 'Auswertungen',
      subtitle: 'Belegung, Kennzahlen und Einrichtungsstatus',
      links: [
        {
          id: 'analytics-main',
          label: 'Auswertungen',
          description: 'Belegung und Kennzahlen',
          route: '/stationaer/auswertungen',
          icon: '📈',
        },
        {
          id: 'analytics-alerts',
          label: 'Auffälligkeiten',
          description: 'Hinweise und Konflikte',
          route: '/stationaer/auswertungen?filter=alerts',
          count: stats.alertsCount,
          icon: '⚠️',
        },
        {
          id: 'settings',
          label: 'Einstellungen',
          description: 'Modul-Konfiguration',
          route: '/stationaer/settings',
          icon: '⚙️',
        },
      ],
    },
    ...(activeResidents.length > 0
      ? [
          {
            id: 'active-residents',
            title: 'Aktive Bewohner:innen',
            subtitle: 'Zuletzt aktualisierte Bewohner:innen',
            links: activeResidents.slice(0, 4).map((resident) => ({
              id: `resident-${resident.id}`,
              label: `${resident.firstName} ${resident.lastName}`,
              description: resident.roomName || resident.wing || 'Kein Zimmer',
              route: `/stationaer/bewohner/${resident.id}`,
              icon: '👤' as const,
            })),
          },
        ]
      : []),
  ];
}
