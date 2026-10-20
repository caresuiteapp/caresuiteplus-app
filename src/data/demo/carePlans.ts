import type { CarePlan, CarePlanListItem } from '@/types/modules/pflege';
import { demoClients } from './clients';
import { DEMO_TENANT_ID } from './tenant';

function clientMeta(clientId: string) {
  const client = demoClients.find((c) => c.id === clientId);
  return {
    clientName: client ? `${client.firstName} ${client.lastName}` : 'Unbekannt',
    careLevel: client?.careLevel ?? null,
  };
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

const CARE_PLAN_SEEDS: CarePlan[] = [
  {
    id: 'plan-001',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-001',
    title: 'Grundpflege & Mobilisation',
    validFrom: daysAgo(90),
    validUntil: daysFromNow(180),
    status: 'aktiv',
    sensitivity: 'care',
    summary: 'Unterstützung bei Körperpflege, An- und Auskleiden sowie täglicher Mobilisation.',
    primaryNurseId: 'employee-002',
    tasks: [
      { id: 'task-001-1', label: 'Ganzkörperwäsche', frequency: 'täglich', status: 'aktiv' },
      { id: 'task-001-2', label: 'Mobilisation im Wohnbereich', frequency: '2× täglich', status: 'aktiv' },
      { id: 'task-001-3', label: 'Hautinspektion', frequency: 'wöchentlich', status: 'in_bearbeitung' },
    ],
    createdAt: daysAgo(90),
    updatedAt: daysAgo(2),
    visibility: 'team',
  },
  {
    id: 'plan-002',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-002',
    title: 'Medikamentenmanagement & Wundversorgung',
    validFrom: daysAgo(60),
    validUntil: daysFromNow(120),
    status: 'aktiv',
    sensitivity: 'health',
    summary: 'Medikamentengabe nach Plan, Wundkontrolle und Dokumentation sensibler Vitalwerte.',
    primaryNurseId: 'employee-002',
    tasks: [
      { id: 'task-002-1', label: 'Medikamentengabe morgens', frequency: 'täglich', status: 'aktiv' },
      { id: 'task-002-2', label: 'Wundversorgung Unterschenkel', frequency: '3× wöchentlich', status: 'aktiv' },
      { id: 'task-002-3', label: 'Blutdruckmessung', frequency: 'täglich', status: 'fehlerhaft' },
    ],
    createdAt: daysAgo(60),
    updatedAt: daysAgo(1),
    visibility: 'team',
  },
  {
    id: 'plan-003',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-003',
    title: 'Angehörigenentlastung & Haushalt',
    validFrom: daysAgo(30),
    validUntil: null,
    status: 'in_bearbeitung',
    sensitivity: 'care',
    summary: 'Entlastung der Angehörigen durch Haushaltsführung und Begleitung bei Terminen.',
    primaryNurseId: 'employee-003',
    tasks: [
      { id: 'task-003-1', label: 'Haushaltsführung', frequency: '2× wöchentlich', status: 'in_bearbeitung' },
      { id: 'task-003-2', label: 'Begleitung Arzttermin', frequency: 'monatlich', status: 'entwurf' },
    ],
    createdAt: daysAgo(30),
    updatedAt: daysAgo(5),
    visibility: 'team',
  },
  {
    id: 'plan-004',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-005',
    title: 'Intensivpflege zu Hause',
    validFrom: daysAgo(120),
    validUntil: daysFromNow(365),
    status: 'aktiv',
    sensitivity: 'health',
    summary: 'Beatmungsnahe Pflege, Trachealkanülenpflege und engmaschige Vitalüberwachung.',
    primaryNurseId: 'employee-002',
    tasks: [
      { id: 'task-004-1', label: 'Sauerstoffsättigung messen', frequency: '4× täglich', status: 'aktiv' },
      { id: 'task-004-2', label: 'Trachealkanülenpflege', frequency: 'täglich', status: 'aktiv' },
      { id: 'task-004-3', label: 'Lagerung', frequency: '2× täglich', status: 'aktiv' },
    ],
    createdAt: daysAgo(120),
    updatedAt: daysAgo(0),
    visibility: 'team',
  },
  {
    id: 'plan-005',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-010',
    title: 'Demenzbetreuung & Aktivierung',
    validFrom: daysAgo(45),
    validUntil: daysFromNow(90),
    status: 'aktiv',
    sensitivity: 'care',
    summary: 'Biografiearbeit, Gedächtnistraining und strukturierter Tagesablauf.',
    primaryNurseId: 'employee-001',
    tasks: [
      { id: 'task-005-1', label: 'Biografiearbeit', frequency: 'wöchentlich', status: 'aktiv' },
      { id: 'task-005-2', label: 'Gedächtnistraining', frequency: '3× wöchentlich', status: 'aktiv' },
    ],
    createdAt: daysAgo(45),
    updatedAt: daysAgo(3),
    visibility: 'team',
  },
  {
    id: 'plan-006',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-011',
    title: 'Sturzprophylaxe & Ernährung',
    validFrom: daysAgo(20),
    validUntil: daysFromNow(60),
    status: 'aktiv',
    sensitivity: 'care',
    summary: 'Sturzrisiko-Assessment, Ernährungsberatung und Unterstützung bei Mahlzeiten.',
    primaryNurseId: 'employee-003',
    tasks: [
      { id: 'task-006-1', label: 'Sturzrisiko-Check', frequency: 'wöchentlich', status: 'aktiv' },
      { id: 'task-006-2', label: 'Gewichtskontrolle', frequency: 'wöchentlich', status: 'in_bearbeitung' },
      { id: 'task-006-3', label: 'Mahlzeitenhilfe', frequency: 'täglich', status: 'aktiv' },
    ],
    createdAt: daysAgo(20),
    updatedAt: daysAgo(4),
    visibility: 'team',
  },
  {
    id: 'plan-007',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-012',
    title: 'Diabetesmanagement',
    validFrom: daysAgo(75),
    validUntil: daysFromNow(200),
    status: 'in_bearbeitung',
    sensitivity: 'health',
    summary: 'BZ-Messung, Insulinberatung und Fußinspektion bei Diabetes mellitus Typ 2.',
    primaryNurseId: 'employee-002',
    tasks: [
      { id: 'task-007-1', label: 'BZ-Messung nüchtern', frequency: 'täglich', status: 'in_bearbeitung' },
      { id: 'task-007-2', label: 'Fußinspektion', frequency: 'wöchentlich', status: 'aktiv' },
    ],
    createdAt: daysAgo(75),
    updatedAt: daysAgo(6),
    visibility: 'team',
  },
  {
    id: 'plan-008',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-006',
    title: 'Abschlusspflegeplan',
    validFrom: daysAgo(200),
    validUntil: daysAgo(10),
    status: 'abgeschlossen',
    sensitivity: 'care',
    summary: 'Abgeschlossener Pflegeplan nach Verlegung in stationäre Einrichtung.',
    primaryNurseId: 'employee-003',
    tasks: [
      { id: 'task-008-1', label: 'Übergabeprotokoll', frequency: 'einmalig', status: 'abgeschlossen' },
    ],
    createdAt: daysAgo(200),
    updatedAt: daysAgo(10),
    visibility: 'team',
  },
];

let planStore: CarePlan[] = CARE_PLAN_SEEDS.map((plan) => ({ ...plan }));

export const demoCarePlans = CARE_PLAN_SEEDS;

export function createDemoCarePlan(input: {
  title: string;
  sisTopic: string;
  clientId?: string;
}): CarePlan {
  const now = new Date().toISOString();
  const clientId = input.clientId ?? demoClients[0]?.id ?? 'client-001';
  const plan: CarePlan = {
    id: `plan-${Date.now().toString(36)}`,
    tenantId: DEMO_TENANT_ID,
    clientId,
    title: input.title.trim(),
    validFrom: now,
    validUntil: daysFromNow(180),
    status: 'entwurf',
    sensitivity: 'care',
    summary: `SIS-Thema: ${input.sisTopic.trim()}`,
    primaryNurseId: 'employee-002',
    tasks: [
      {
        id: `task-${Date.now()}-1`,
        label: input.sisTopic.trim(),
        frequency: 'täglich',
        status: 'entwurf',
      },
    ],
    createdAt: now,
    updatedAt: now,
    visibility: 'team',
  };
  planStore = [plan, ...planStore];
  return { ...plan };
}

export function getDemoCarePlanById(planId: string): CarePlan | undefined {
  const plan = planStore.find((entry) => entry.id === planId);
  return plan ? { ...plan } : undefined;
}

export function updateDemoCarePlan(
  planId: string,
  patch: Partial<Pick<CarePlan, 'title' | 'summary' | 'status'>>,
): CarePlan | null {
  const index = planStore.findIndex((entry) => entry.id === planId);
  if (index < 0) return null;
  const now = new Date().toISOString();
  planStore[index] = {
    ...planStore[index]!,
    ...patch,
    updatedAt: now,
  };
  return { ...planStore[index]! };
}

export function getDemoCarePlanListItems(): CarePlanListItem[] {
  return planStore.map((plan) => {
    const meta = clientMeta(plan.clientId);
    const alertCount = plan.tasks.filter(
      (task) => task.status === 'fehlerhaft' || task.status === 'gesperrt',
    ).length;
    return {
      id: plan.id,
      tenantId: plan.tenantId,
      title: plan.title,
      validFrom: plan.validFrom,
      validUntil: plan.validUntil,
      status: plan.status,
      clientId: plan.clientId,
      updatedAt: plan.updatedAt,
      clientName: meta.clientName,
      careLevel: meta.careLevel,
      alertCount,
    };
  });
}

export function countActiveCarePlans(): number {
  return planStore.filter((plan) => plan.status === 'aktiv').length;
}
