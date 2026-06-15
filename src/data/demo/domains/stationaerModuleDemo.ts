import type { WorkflowStatus } from '@/types';
import { demoEmployees } from '../employees';
import { DEMO_TENANT_ID } from '../tenant';

export type LivingAreaListItem = {
  id: string;
  tenantId: string;
  wing: string;
  roomLabel: string;
  capacity: number;
  occupied: number;
  status: WorkflowStatus;
};

export type HandoverReportItem = {
  id: string;
  tenantId: string;
  shiftLabel: string;
  authorName: string;
  handoverAt: string;
  summary: string;
  openItemsCount: number;
  status: WorkflowStatus;
};

export type StationaerModuleSettings = {
  occupancyAlertsEnabled: boolean;
  handoverRemindersEnabled: boolean;
  roomChangeWorkflowEnabled: boolean;
  portalFamilyUpdatesEnabled: boolean;
};

export type StationaerReportKpi = {
  id: string;
  label: string;
  value: string | number;
  subValue?: string;
  accentColor: string;
};

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function authorName(profileId: string): string {
  const employee = demoEmployees.find((e) => e.id === profileId);
  return employee ? `${employee.firstName} ${employee.lastName}` : 'Unbekannt';
}

const LIVING_AREAS: LivingAreaListItem[] = [
  { id: 'area-101', tenantId: DEMO_TENANT_ID, wing: 'Sonnenschein', roomLabel: '101 · Einzelzimmer', capacity: 1, occupied: 1, status: 'aktiv' },
  { id: 'area-102', tenantId: DEMO_TENANT_ID, wing: 'Sonnenschein', roomLabel: '102 · Doppelzimmer', capacity: 2, occupied: 1, status: 'aktiv' },
  { id: 'area-201', tenantId: DEMO_TENANT_ID, wing: 'Lindenhof', roomLabel: '201 · Einzelzimmer', capacity: 1, occupied: 1, status: 'aktiv' },
  { id: 'area-202', tenantId: DEMO_TENANT_ID, wing: 'Lindenhof', roomLabel: '202 · Doppelzimmer', capacity: 2, occupied: 1, status: 'in_bearbeitung' },
  { id: 'area-301', tenantId: DEMO_TENANT_ID, wing: 'Gartenblick', roomLabel: '301 · Einzelzimmer', capacity: 1, occupied: 1, status: 'aktiv' },
  { id: 'area-302', tenantId: DEMO_TENANT_ID, wing: 'Gartenblick', roomLabel: '302 · frei', capacity: 1, occupied: 0, status: 'entwurf' },
];

const HANDOVERS: HandoverReportItem[] = [
  {
    id: 'ho-001',
    tenantId: DEMO_TENANT_ID,
    shiftLabel: 'Frühdienst · 06:00–14:00',
    authorName: authorName('employee-002'),
    handoverAt: daysAgo(0),
    summary: 'Alle Bewohner:innen stabil. Herr Krause — Blutzucker morgens erhöht.',
    openItemsCount: 1,
    status: 'aktiv',
  },
  {
    id: 'ho-002',
    tenantId: DEMO_TENANT_ID,
    shiftLabel: 'Spätdienst · 14:00–22:00',
    authorName: authorName('employee-003'),
    handoverAt: daysAgo(1),
    summary: 'Frau Schneider mobilisiert. Physiotherapie-Termin morgen 10:00.',
    openItemsCount: 0,
    status: 'abgeschlossen',
  },
  {
    id: 'ho-003',
    tenantId: DEMO_TENANT_ID,
    shiftLabel: 'Nachtdienst · 22:00–06:00',
    authorName: authorName('employee-004'),
    handoverAt: daysAgo(1),
    summary: 'Ruhender Verlauf. Frau Lehmann zweimal aufgestanden.',
    openItemsCount: 2,
    status: 'abgeschlossen',
  },
];

const DEFAULT_SETTINGS: StationaerModuleSettings = {
  occupancyAlertsEnabled: true,
  handoverRemindersEnabled: true,
  roomChangeWorkflowEnabled: false,
  portalFamilyUpdatesEnabled: true,
};

const REPORT_KPIS: StationaerReportKpi[] = [
  { id: 'skpi-1', label: 'Belegung', value: '83 %', subValue: '5 von 6 Zimmern', accentColor: '#AF52DE' },
  { id: 'skpi-2', label: 'Neuaufnahmen', value: 2, subValue: 'Letzte 30 Tage', accentColor: '#62F3FF' },
  { id: 'skpi-3', label: 'Offene Übergaben', value: 1, subValue: 'Frühdienst', accentColor: '#FF9500' },
  { id: 'skpi-4', label: 'Aktive Bewohner:innen', value: 5, subValue: 'Demo-Mandant', accentColor: '#34C759' },
];

export function getDemoLivingAreas(): LivingAreaListItem[] {
  return LIVING_AREAS.map((item) => ({ ...item }));
}

export function getDemoHandoverReports(): HandoverReportItem[] {
  return HANDOVERS.map((item) => ({ ...item }));
}

export function getDemoStationaerSettings(): StationaerModuleSettings {
  return { ...DEFAULT_SETTINGS };
}

export function getDemoStationaerReportKpis(): StationaerReportKpi[] {
  return REPORT_KPIS.map((item) => ({ ...item }));
}
