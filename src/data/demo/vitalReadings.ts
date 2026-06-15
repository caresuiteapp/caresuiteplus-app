import type { VitalReading, VitalReadingListItem } from '@/types/modules/pflege';
import { generateExtraVitalReadings } from './generators/pflegeDemoGenerators';
import { demoClients } from './clients';
import { DEMO_TENANT_ID } from './tenant';

export const VITAL_TYPE_LABELS: Record<VitalReading['type'], string> = {
  blood_pressure: 'Blutdruck',
  pulse: 'Puls',
  temperature: 'Temperatur',
  weight: 'Gewicht',
  oxygen: 'Sauerstoffsättigung',
};

const DUE_THRESHOLD_HOURS = 24;

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

function clientName(clientId: string): string {
  const client = demoClients.find((c) => c.id === clientId);
  return client ? `${client.firstName} ${client.lastName}` : 'Unbekannt';
}

export const demoVitalReadings: VitalReading[] = [
  {
    id: 'vital-001',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-001',
    carePlanId: 'plan-001',
    type: 'blood_pressure',
    value: '128/82',
    unit: 'mmHg',
    measuredAt: hoursAgo(6),
    status: 'aktiv',
    sensitivity: 'health',
    createdAt: hoursAgo(6),
    updatedAt: hoursAgo(6),
    visibility: 'team',
  },
  {
    id: 'vital-002',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-002',
    carePlanId: 'plan-002',
    type: 'blood_pressure',
    value: '158/96',
    unit: 'mmHg',
    measuredAt: hoursAgo(30),
    status: 'fehlerhaft',
    sensitivity: 'health',
    createdAt: hoursAgo(30),
    updatedAt: hoursAgo(30),
    visibility: 'team',
  },
  {
    id: 'vital-003',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-002',
    carePlanId: 'plan-002',
    type: 'pulse',
    value: '92',
    unit: 'bpm',
    measuredAt: hoursAgo(30),
    status: 'aktiv',
    sensitivity: 'health',
    createdAt: hoursAgo(30),
    updatedAt: hoursAgo(30),
    visibility: 'team',
  },
  {
    id: 'vital-004',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-005',
    carePlanId: 'plan-004',
    type: 'oxygen',
    value: '94',
    unit: '%',
    measuredAt: hoursAgo(2),
    status: 'in_bearbeitung',
    sensitivity: 'health',
    createdAt: hoursAgo(2),
    updatedAt: hoursAgo(2),
    visibility: 'team',
  },
  {
    id: 'vital-005',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-005',
    carePlanId: 'plan-004',
    type: 'temperature',
    value: '37.8',
    unit: '°C',
    measuredAt: hoursAgo(4),
    status: 'fehlerhaft',
    sensitivity: 'health',
    createdAt: hoursAgo(4),
    updatedAt: hoursAgo(4),
    visibility: 'team',
  },
  {
    id: 'vital-006',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-011',
    carePlanId: 'plan-006',
    type: 'weight',
    value: '68.4',
    unit: 'kg',
    measuredAt: hoursAgo(48),
    status: 'aktiv',
    sensitivity: 'care',
    createdAt: hoursAgo(48),
    updatedAt: hoursAgo(48),
    visibility: 'team',
  },
  {
    id: 'vital-007',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-012',
    carePlanId: 'plan-007',
    type: 'blood_pressure',
    value: '142/88',
    unit: 'mmHg',
    measuredAt: hoursAgo(28),
    status: 'in_bearbeitung',
    sensitivity: 'health',
    createdAt: hoursAgo(28),
    updatedAt: hoursAgo(28),
    visibility: 'team',
  },
  {
    id: 'vital-008',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-010',
    carePlanId: 'plan-005',
    type: 'pulse',
    value: '74',
    unit: 'bpm',
    measuredAt: hoursAgo(72),
    status: 'aktiv',
    sensitivity: 'care',
    createdAt: hoursAgo(72),
    updatedAt: hoursAgo(72),
    visibility: 'team',
  },
  {
    id: 'vital-009',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-003',
    carePlanId: 'plan-003',
    type: 'temperature',
    value: '36.7',
    unit: '°C',
    measuredAt: hoursAgo(8),
    status: 'aktiv',
    sensitivity: 'care',
    createdAt: hoursAgo(8),
    updatedAt: hoursAgo(8),
    visibility: 'team',
  },
  {
    id: 'vital-010',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-001',
    carePlanId: 'plan-001',
    type: 'pulse',
    value: '68',
    unit: 'bpm',
    measuredAt: hoursAgo(26),
    status: 'aktiv',
    sensitivity: 'care',
    createdAt: hoursAgo(26),
    updatedAt: hoursAgo(26),
    visibility: 'team',
  },
  ...generateExtraVitalReadings(11, 22),
];

let vitalStore: VitalReading[] = demoVitalReadings.map((r) => ({ ...r }));

const VITAL_UNITS: Record<VitalReading['type'], string> = {
  blood_pressure: 'mmHg',
  pulse: 'bpm',
  temperature: '°C',
  weight: 'kg',
  oxygen: '%',
};

export function createDemoVitalReading(input: {
  clientId: string;
  type: VitalReading['type'];
  value: string;
  carePlanId?: string;
}): VitalReadingListItem {
  const now = new Date().toISOString();
  const id = `vital-${Date.now()}`;
  const reading: VitalReading = {
    id,
    tenantId: DEMO_TENANT_ID,
    clientId: input.clientId,
    carePlanId: input.carePlanId ?? 'plan-001',
    type: input.type,
    value: input.value,
    unit: VITAL_UNITS[input.type],
    measuredAt: now,
    status: 'aktiv',
    sensitivity: 'health',
    createdAt: now,
    updatedAt: now,
    visibility: 'team',
  };
  vitalStore = [reading, ...vitalStore];
  return {
    ...reading,
    clientName: clientName(reading.clientId),
    typeLabel: VITAL_TYPE_LABELS[reading.type],
    isDue: false,
    isAlert: false,
  };
}

export function isVitalDue(measuredAt: string): boolean {
  const hoursSince = (Date.now() - new Date(measuredAt).getTime()) / 3_600_000;
  return hoursSince >= DUE_THRESHOLD_HOURS;
}

export function isVitalAlert(status: VitalReading['status']): boolean {
  return status === 'fehlerhaft' || status === 'gesperrt';
}

export function getDemoVitalReadings(): VitalReadingListItem[] {
  return vitalStore.map((reading) => ({
    ...reading,
    clientName: clientName(reading.clientId),
    typeLabel: VITAL_TYPE_LABELS[reading.type],
    isDue: isVitalDue(reading.measuredAt),
    isAlert: isVitalAlert(reading.status),
  }));
}

export function getDemoVitalsForCarePlan(carePlanId: string): VitalReadingListItem[] {
  return getDemoVitalReadings()
    .filter((reading) => reading.carePlanId === carePlanId)
    .sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime());
}

export function countDueVitals(): number {
  return getDemoVitalReadings().filter((reading) => reading.isDue).length;
}

export function countVitalAlerts(): number {
  return getDemoVitalReadings().filter((reading) => reading.isAlert).length;
}
