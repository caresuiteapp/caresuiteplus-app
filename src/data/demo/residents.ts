import type { ResidentListItem, Resident } from '@/types/modules/stationaer';
import type { WorkflowStatus } from '@/types';
import { DEMO_TENANT_ID } from './tenant';

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

type ResidentSeed = Resident;

const ROOM_LABELS: Record<string, string> = {
  'room-101': '101 · Sonnenschein',
  'room-102': '102 · Sonnenschein',
  'room-201': '201 · Lindenhof',
  'room-202': '202 · Lindenhof',
  'room-301': '301 · Gartenblick',
  'room-302': '302 · Gartenblick',
};

const RESIDENT_SEEDS: ResidentSeed[] = [
  {
    id: 'resident-001',
    tenantId: DEMO_TENANT_ID,
    firstName: 'Helga',
    lastName: 'Schneider',
    roomId: 'room-101',
    wing: 'Sonnenschein',
    admissionDate: daysAgo(120),
    careLevel: 'Pflegegrad 3',
    status: 'aktiv',
    notes: 'Mobilität eingeschränkt, Rollator im Flur.',
    createdAt: daysAgo(120),
    updatedAt: daysAgo(2),
    visibility: 'team',
    sensitivity: 'health',
  },
  {
    id: 'resident-002',
    tenantId: DEMO_TENANT_ID,
    firstName: 'Werner',
    lastName: 'Krause',
    roomId: 'room-102',
    wing: 'Sonnenschein',
    admissionDate: daysAgo(45),
    careLevel: 'Pflegegrad 2',
    status: 'aktiv',
    notes: 'Diabetes — Blutzucker morgens kontrollieren.',
    createdAt: daysAgo(45),
    updatedAt: daysAgo(1),
    visibility: 'team',
    sensitivity: 'health',
  },
  {
    id: 'resident-003',
    tenantId: DEMO_TENANT_ID,
    firstName: 'Ingrid',
    lastName: 'Vogt',
    roomId: 'room-201',
    wing: 'Lindenhof',
    admissionDate: daysAgo(200),
    careLevel: 'Pflegegrad 4',
    status: 'in_bearbeitung',
    notes: 'Übergangspflege nach Krankenhausaufenthalt.',
    createdAt: daysAgo(200),
    updatedAt: daysAgo(3),
    visibility: 'team',
    sensitivity: 'health',
  },
  {
    id: 'resident-004',
    tenantId: DEMO_TENANT_ID,
    firstName: 'Karl',
    lastName: 'Bergmann',
    roomId: 'room-202',
    wing: 'Lindenhof',
    admissionDate: daysAgo(14),
    careLevel: 'Pflegegrad 2',
    status: 'aktiv',
    notes: 'Neuaufnahme — Eingewöhnungsphase.',
    createdAt: daysAgo(14),
    updatedAt: daysAgo(1),
    visibility: 'team',
    sensitivity: 'care',
  },
  {
    id: 'resident-005',
    tenantId: DEMO_TENANT_ID,
    firstName: 'Margarete',
    lastName: 'Lehmann',
    roomId: 'room-301',
    wing: 'Gartenblick',
    admissionDate: daysAgo(365),
    careLevel: 'Pflegegrad 5',
    status: 'aktiv',
    notes: 'Demenz — feste Tagesstruktur wichtig.',
    createdAt: daysAgo(365),
    updatedAt: daysAgo(5),
    visibility: 'team',
    sensitivity: 'health',
  },
  {
    id: 'resident-006',
    tenantId: DEMO_TENANT_ID,
    firstName: 'Friedrich',
    lastName: 'Hartmann',
    roomId: null,
    wing: 'Gartenblick',
    admissionDate: daysAgo(7),
    careLevel: 'Pflegegrad 3',
    status: 'entwurf',
    notes: 'Zimmerzuweisung noch ausstehend.',
    createdAt: daysAgo(7),
    updatedAt: daysAgo(7),
    visibility: 'team',
    sensitivity: 'internal',
  },
];

let residentStore: ResidentSeed[] = RESIDENT_SEEDS.map((seed) => ({ ...seed }));

function roomName(roomId: string | null): string {
  if (!roomId) return 'Noch nicht zugewiesen';
  return ROOM_LABELS[roomId] ?? roomId;
}

export function getDemoResidentListItems(): ResidentListItem[] {
  return residentStore.map((resident) => ({
    id: resident.id,
    tenantId: resident.tenantId,
    firstName: resident.firstName,
    lastName: resident.lastName,
    wing: resident.wing,
    admissionDate: resident.admissionDate,
    careLevel: resident.careLevel,
    status: resident.status,
    updatedAt: resident.updatedAt,
    roomName: roomName(resident.roomId),
  }));
}

export function getDemoResidentById(id: string): ResidentSeed | null {
  const resident = residentStore.find((r) => r.id === id);
  return resident ? { ...resident } : null;
}

export function isResidentActive(status: WorkflowStatus): boolean {
  return status === 'aktiv' || status === 'in_bearbeitung';
}

export function isNewAdmission(admissionDate: string): boolean {
  const admitted = new Date(admissionDate);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
  return admitted >= thirtyDaysAgo;
}

export function getRoomLabel(roomId: string | null): string {
  return roomName(roomId);
}

export const demoResidents = RESIDENT_SEEDS;
