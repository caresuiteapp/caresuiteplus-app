/**
 * Programmatic Pflege demo seed expansion — keeps demo files maintainable.
 */
import type { VitalReading } from '@/types/modules/pflege';
import type { WorkflowStatus } from '@/types/core/base';
import { demoClients } from '../clients';
import { DEMO_TENANT_ID } from '../tenant';

const VITAL_TYPES: VitalReading['type'][] = [
  'blood_pressure',
  'pulse',
  'temperature',
  'weight',
  'oxygen',
];

const VITAL_VALUES: Record<VitalReading['type'], string[]> = {
  blood_pressure: ['118/76', '128/82', '135/88', '142/90', '155/98'],
  pulse: ['68', '72', '78', '84', '92', '102'],
  temperature: ['36.4', '36.7', '37.0', '37.4', '37.8', '38.2'],
  weight: ['62.0', '68.4', '74.2', '81.5', '55.8'],
  oxygen: ['96', '94', '92', '98', '89'],
};

const VITAL_UNITS: Record<VitalReading['type'], string> = {
  blood_pressure: 'mmHg',
  pulse: 'bpm',
  temperature: '°C',
  weight: 'kg',
  oxygen: '%',
};

const STATUSES: WorkflowStatus[] = ['aktiv', 'aktiv', 'aktiv', 'in_bearbeitung', 'fehlerhaft'];

export function generateExtraVitalReadings(startIndex: number, count: number): VitalReading[] {
  const clients = demoClients.slice(0, 20);
  const items: VitalReading[] = [];

  for (let i = 0; i < count; i++) {
    const idx = startIndex + i;
    const client = clients[i % clients.length]!;
    const type = VITAL_TYPES[i % VITAL_TYPES.length]!;
    const values = VITAL_VALUES[type];
    const hoursBack = 2 + (i % 72);
    const measuredAt = new Date(Date.now() - hoursBack * 3_600_000).toISOString();

    items.push({
      id: `vital-${String(idx).padStart(3, '0')}`,
      tenantId: DEMO_TENANT_ID,
      clientId: client.id,
      carePlanId: `plan-${String((i % 8) + 1).padStart(3, '0')}`,
      type,
      value: values[i % values.length]!,
      unit: VITAL_UNITS[type],
      measuredAt,
      status: STATUSES[i % STATUSES.length]!,
      sensitivity: i % 3 === 0 ? 'health' : 'care',
      createdAt: measuredAt,
      updatedAt: measuredAt,
      visibility: 'team',
    });
  }

  return items;
}

export const MEDICATION_NAMES = [
  'Ramipril',
  'Metformin',
  'Insulin NovoRapid',
  'Ibuprofen',
  'Amlodipin',
  'Pantoprazol',
  'Bisoprolol',
  'ASS 100',
  'Torasemid',
  'Levothyroxin',
  'Macrogol',
  'Paracetamol',
  'Candesartan',
  'Atorvastatin',
  'Salbutamol',
];

export const WOUND_LOCATIONS = [
  'Unterschenkel links',
  'Sakrum',
  'Großzehe rechts',
  'Ferse links',
  'Ellenbogen rechts',
  'Oberarm links',
  'Knie rechts',
  'Steißbein',
  'Handrücken links',
  'Schulter rechts',
  'Wade links',
  'Brustwand',
];

export const WOUND_DESCRIPTIONS = [
  'Chronisches Ulcus cruris — feuchte Wundheilungsphase',
  'Dekubitus Grad II — lokale Behandlung',
  'Diabetisches Fußsyndrom — abgeheilt, Kontrolle',
  'OP-Narbe — reizlos, Verbandwechsel',
  'Hautriss — trockene Einheitsdecke',
  'Druckstelle — Prävention Grad I',
  'Verbrennung 1. Grades — kühlende Salbe',
  'Lymphödem — Kompressionstherapie',
  'Abszess — abgeklopft, Antibiose',
  'Schürfwunde — desinfiziert',
  'Malignes Ulcus — palliative Versorgung',
  'Stoma-Umgebung — Hautschutz',
];

export const SHIFT_STAFF = [
  { name: 'Thomas Keller', role: 'Pflegefachkraft' },
  { name: 'Anna Müller', role: 'Pflegehilfskraft' },
  { name: 'Sabine Richter', role: 'Pflegedienstleitung' },
  { name: 'Michael Braun', role: 'Pflegefachkraft' },
  { name: 'Lisa Wagner', role: 'Pflegehilfskraft' },
  { name: 'Julia Schmidt', role: 'Pflegefachkraft' },
  { name: 'Markus Hoffmann', role: 'Pflegehilfskraft' },
  { name: 'Petra Neumann', role: 'Pflegefachkraft' },
  { name: 'Frank Lehmann', role: 'Pflegehilfskraft' },
  { name: 'Claudia Berger', role: 'Wohnbereichsleitung' },
];

export const SHIFT_LOCATIONS = ['Ambulant Nord', 'Ambulant Süd', 'Ambulant West', 'Zentrale', 'Station A'];

export const CARE_REPORT_TEMPLATES = [
  'Grundpflege abgeschlossen — Mobilisation und Körperpflege dokumentiert.',
  'Medikamentengabe gemäß Plan — keine Auffälligkeiten.',
  'Wundversorgung durchgeführt — Verband gewechselt, Wundrand reizlos.',
  'Haushaltsführung — Einkauf und Wäsche erledigt.',
  'Begleitung Arzttermin — Rücktransport sichergestellt.',
  'Demenzbetreuung — Tagesstruktur und Orientierung.',
  'Ernährung — Mahlzeit vorbereitet und dokumentiert.',
  'Angehörigenentlastung — Gespräch und Übergabe.',
  'Vitalwerte gemessen — Werte im Normbereich.',
  'Sturzprotokoll — keine Verletzung, Arzt informiert.',
];
