import type { LivingAreaListItem, HandoverReportListItem, LivingAreaDetail, HandoverDetail } from '@/types/modules/stationaer';
import { demoEmployees } from './employees';
import { DEMO_TENANT_ID } from './tenant';

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

const LIVING_AREAS: LivingAreaListItem[] = [
  { id: 'area-101', name: '101 · Sonnenschein', wing: 'Sonnenschein', capacity: 2, status: 'aktiv', occupiedBeds: 2, freeBeds: 0 },
  { id: 'area-102', name: '102 · Sonnenschein', wing: 'Sonnenschein', capacity: 2, status: 'aktiv', occupiedBeds: 1, freeBeds: 1 },
  { id: 'area-201', name: '201 · Lindenhof', wing: 'Lindenhof', capacity: 2, status: 'aktiv', occupiedBeds: 2, freeBeds: 0 },
  { id: 'area-202', name: '202 · Lindenhof', wing: 'Lindenhof', capacity: 2, status: 'in_bearbeitung', occupiedBeds: 0, freeBeds: 2 },
  { id: 'area-301', name: '301 · Gartenblick', wing: 'Gartenblick', capacity: 2, status: 'aktiv', occupiedBeds: 1, freeBeds: 1 },
];

const HANDOVERS: HandoverReportListItem[] = [
  {
    id: 'handover-001',
    tenantId: DEMO_TENANT_ID,
    shiftLabel: 'Frühdienst',
    authorProfileId: 'employee-002',
    authorName: 'Sabine Keller',
    wing: 'Sonnenschein',
    content: 'Zimmer 101: Mobilisation gut. Blutzucker morgens 142 mg/dl — Diabetikerberatung informiert.',
    handoverAt: daysAgo(0),
    status: 'aktiv',
    createdAt: daysAgo(0),
    updatedAt: daysAgo(0),
  },
  {
    id: 'handover-002',
    tenantId: DEMO_TENANT_ID,
    shiftLabel: 'Spätdienst',
    authorProfileId: 'employee-003',
    authorName: 'Thomas Richter',
    wing: 'Lindenhof',
    content: 'Zimmer 201: Sturzprotokoll ausgefüllt. Angehörige über nächtliche Unruhe informiert.',
    handoverAt: daysAgo(1),
    status: 'abgeschlossen',
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
  },
  {
    id: 'handover-003',
    tenantId: DEMO_TENANT_ID,
    shiftLabel: 'Nachtdienst',
    authorProfileId: 'employee-004',
    authorName: 'Lisa Wagner',
    wing: 'Gartenblick',
    content: 'Schlafmedikation 22:00 wie verordnet. Keine Vorfälle.',
    handoverAt: daysAgo(2),
    status: 'abgeschlossen',
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
  },
];

export function getDemoLivingAreas(): LivingAreaListItem[] {
  return LIVING_AREAS.map((a) => ({ ...a }));
}

export function getDemoLivingAreaDetail(id: string): LivingAreaDetail | null {
  const area = LIVING_AREAS.find((a) => a.id === id);
  if (!area) return null;
  const residentsByArea: Record<string, string[]> = {
    'area-101': ['Helga Müller', 'Werner Schmidt'],
    'area-102': ['Ingrid Bauer'],
    'area-201': ['Karl Weber', 'Maria Hoffmann'],
    'area-202': [],
    'area-301': ['Gertrud Klein'],
  };
  return {
    ...area,
    residentNames: residentsByArea[id] ?? [],
    lastCleaningLabel: 'Heute, 06:30 Uhr',
    nextActionHint:
      area.freeBeds > 0 ? `${area.freeBeds} freie Betten — Aufnahme möglich` : 'Voll belegt — Warteliste prüfen',
  };
}

export function getDemoHandoverReports(): HandoverReportListItem[] {
  return HANDOVERS.map((h) => {
    const author = demoEmployees.find((e) => e.id === h.authorProfileId);
    return {
      ...h,
      authorName: author ? `${author.firstName} ${author.lastName}` : h.authorName,
    };
  });
}

export function countHandoversThisWeek(): number {
  const weekAgo = Date.now() - 7 * 86_400_000;
  return HANDOVERS.filter((h) => new Date(h.handoverAt).getTime() >= weekAgo).length;
}

export function getDemoHandoverDetail(id: string): HandoverDetail | null {
  const items = getDemoHandoverReports();
  const item = items.find((h) => h.id === id);
  if (!item) return null;
  return {
    ...item,
    recipientNames: ['Schichtleitung', 'Pflegedienstleitung'],
    priorityLabel: item.status === 'aktiv' ? 'Aktuell' : 'Archiviert',
    nextActionHint:
      item.status === 'aktiv' ? 'Vor Schichtwechsel bestätigen' : 'Im Übergabe-Archiv abgelegt',
  };
}
