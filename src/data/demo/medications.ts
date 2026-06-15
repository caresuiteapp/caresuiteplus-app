import type { WorkflowStatus } from '@/types/core/base';
import { MEDICATION_NAMES } from './generators/pflegeDemoGenerators';
import { demoClients } from './clients';
import { DEMO_TENANT_ID } from './tenant';

export type MedicationListItem = {
  id: string;
  tenantId: string;
  clientId: string;
  clientName: string;
  medicationName: string;
  dosage: string;
  schedule: string;
  route: string;
  status: WorkflowStatus;
  prescribedBy: string;
  updatedAt: string;
};

const SCHEDULES = ['Morgens', 'Abends', 'Morgens + Abends', 'Bei Bedarf', 'Vor Mahlzeiten'];
const ROUTES = ['oral', 'subkutan', 'topisch', 'inhalativ'];
const DOCTORS = ['Dr. Schmidt', 'Dr. Bauer', 'Dr. Klein', 'Dr. Weber', 'Dr. Fischer'];
const STATUSES: WorkflowStatus[] = ['aktiv', 'aktiv', 'aktiv', 'in_bearbeitung'];

function buildMedicationSeeds(): MedicationListItem[] {
  const clients = demoClients.slice(0, 15);
  return MEDICATION_NAMES.map((medicationName, i) => {
    const client = clients[i % clients.length]!;
    return {
      id: `med-${String(i + 1).padStart(3, '0')}`,
      tenantId: DEMO_TENANT_ID,
      clientId: client.id,
      clientName: `${client.firstName} ${client.lastName}`,
      medicationName,
      dosage: `${(i % 5 + 1) * 5} mg`,
      schedule: SCHEDULES[i % SCHEDULES.length]!,
      route: ROUTES[i % ROUTES.length]!,
      status: STATUSES[i % STATUSES.length]!,
      prescribedBy: DOCTORS[i % DOCTORS.length]!,
      updatedAt: new Date(Date.now() - (i + 1) * 86_400_000).toISOString(),
    };
  });
}

const INITIAL = buildMedicationSeeds();
let medicationStore: MedicationListItem[] = INITIAL.map((item) => ({ ...item }));

export function getDemoMedicationListItems(): MedicationListItem[] {
  return medicationStore.map((item) => ({ ...item }));
}

export function getDemoMedicationById(id: string): MedicationListItem | null {
  const item = medicationStore.find((m) => m.id === id);
  return item ? { ...item } : null;
}

export function createDemoMedication(input: {
  clientId: string;
  clientName: string;
  medicationName: string;
  dosage: string;
  schedule: string;
}): MedicationListItem {
  const now = new Date().toISOString();
  const item: MedicationListItem = {
    id: `med-${Date.now()}`,
    tenantId: DEMO_TENANT_ID,
    clientId: input.clientId,
    clientName: input.clientName,
    medicationName: input.medicationName,
    dosage: input.dosage,
    schedule: input.schedule,
    route: 'oral',
    status: 'entwurf',
    prescribedBy: 'Dr. Demo',
    updatedAt: now,
  };
  medicationStore = [item, ...medicationStore];
  return { ...item };
}

export function countActiveMedications(): number {
  return medicationStore.filter((item) => item.status === 'aktiv').length;
}
