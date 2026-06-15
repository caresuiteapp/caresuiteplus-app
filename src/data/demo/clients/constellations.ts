import type { ClientCareContext } from '@/lib/clients/clientIntakeFieldRules';
import type { ClientFullDetail } from '@/types/modules/client';
import { helgaSchneiderFull } from './helga-schneider';
import { wernerMuellerFull } from './werner-mueller';
import { upsertDemoClientIntakeRecord } from './intakeRecords';
import { DEMO_TENANT_ID } from '../tenant';
import { EMPTY_CLIENT_INTAKE_FORM } from '@/types/forms/clientIntakeForm';

type Constellation = {
  id: string;
  contexts: ClientCareContext[];
  firstName: string;
  lastName: string;
  template: ClientFullDetail;
};

const CONSTELLATIONS: Constellation[] = [
  { id: 'client-001', contexts: ['daily_assistance'], firstName: 'Helga', lastName: 'Schneider', template: helgaSchneiderFull },
  { id: 'client-002', contexts: ['support_care', 'companionship'], firstName: 'Werner', lastName: 'Müller', template: wernerMuellerFull },
  { id: 'client-003', contexts: ['ambulatory_care'], firstName: 'Maria', lastName: 'Wagner', template: wernerMuellerFull },
  { id: 'client-004', contexts: ['ambulatory_care', 'support_care'], firstName: 'Friedrich', lastName: 'Bauer', template: wernerMuellerFull },
  { id: 'client-005', contexts: ['stationary_care'], firstName: 'Ingrid', lastName: 'Hoffmann', template: helgaSchneiderFull },
  { id: 'client-006', contexts: ['stationary_care', 'support_care'], firstName: 'Klaus', lastName: 'Richter', template: helgaSchneiderFull },
  { id: 'client-007', contexts: ['consulting'], firstName: 'Ursula', lastName: 'Klein', template: helgaSchneiderFull },
  { id: 'client-008', contexts: ['consulting', 'daily_assistance'], firstName: 'Hans', lastName: 'Neumann', template: helgaSchneiderFull },
  { id: 'client-009', contexts: ['ambulatory_care'], firstName: 'Gertrud', lastName: 'Scholz', template: wernerMuellerFull },
  { id: 'client-010', contexts: ['ambulatory_care'], firstName: 'Peter', lastName: 'Lang', template: wernerMuellerFull },
];

function cloneForConstellation(c: Constellation): ClientFullDetail {
  const now = new Date().toISOString();
  const detail: ClientFullDetail & {
    medications?: { id: string; clientId: string; name: string; scheduleSchema?: string; status: string }[];
    vitals?: { id: string; clientId: string; vitalType: string; value: string; recordedAt: string }[];
  } = {
    ...c.template,
    id: c.id,
    tenantId: DEMO_TENANT_ID,
    firstName: c.firstName,
    lastName: c.lastName,
    updatedAt: now,
    core: { ...c.template.core, id: c.id, tenantId: DEMO_TENANT_ID, firstName: c.firstName, lastName: c.lastName, updatedAt: now },
  };

  if (c.contexts.includes('ambulatory_care')) {
    detail.medications = [
      { id: `med-${c.id}-1`, clientId: c.id, name: 'Metformin 500mg', scheduleSchema: '1-0-1-0', status: 'aktiv' },
    ];
    detail.vitals = [
      { id: `vital-${c.id}-1`, clientId: c.id, vitalType: 'puls', value: '72', recordedAt: now },
    ];
    if ((c.id === 'client-009' || c.id === 'client-010') && detail.risks.length > 0) {
      detail.risks = [
        ...detail.risks,
        {
          ...detail.risks[0],
          id: `risk-${c.id}`,
          clientId: c.id,
          category: 'sturz' as const,
          description: 'Sturzrisiko dokumentiert',
        },
      ];
    }
  }

  upsertDemoClientIntakeRecord(c.id, {
    ...EMPTY_CLIENT_INTAKE_FORM,
    careContexts: c.contexts,
    firstName: c.firstName,
    lastName: c.lastName,
    city: detail.city ?? '',
    zip: detail.zip ?? '',
  });

  return detail;
}

export function buildDemoConstellationClients(): ClientFullDetail[] {
  return CONSTELLATIONS.map(cloneForConstellation);
}

export const DEMO_CONSTELLATION_IDS = CONSTELLATIONS.map((c) => c.id);
