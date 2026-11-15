import { TISSUE_LABELS, woundPlanimetry, type WoundMeasurement } from './woundPlanimetry';

export const RISK_SCALES = {
  norton: { label: 'Norton', domains: [
    ['Körperlicher Zustand', 4], ['Geistiger Zustand', 4], ['Aktivität', 4], ['Mobilität', 4], ['Inkontinenz', 4],
  ] },
  braden: { label: 'Braden', domains: [
    ['Sensorische Wahrnehmung', 4], ['Feuchtigkeit', 4], ['Aktivität', 4],
    ['Mobilität', 4], ['Ernährung', 4], ['Reibung und Scherkräfte', 3],
  ] },
} as const;
export type RiskScale = keyof typeof RISK_SCALES;

export const COMPLICATING_FACTORS = {
  diabetes: 'Diabetes mellitus',
  perfusion: 'Durchblutungsstörung',
  pressure: 'Druckbelastung',
  mobility: 'Eingeschränkte Mobilität',
  nutrition: 'Ernährungsrisiko',
  oedema: 'Ödem',
  infection: 'Dokumentierte Infektion',
  other: 'Weitere Faktoren',
};

export const CLINICAL_FIELDS = {
  anamnesis: [
    ['general', 'Allgemeinzustand'], ['nutrition', 'Ernährungssituation'],
    ['psychosocial', 'Psychosoziale Situation'], ['diagnoses', 'Bekannte Diagnosen'],
    ['effects', 'Sonstige Einflussfaktoren'], ['notes', 'Notizen und Anmerkungen'],
  ],
  diabetic_foot: [
    ['history', 'Anamnese'], ['findings', 'Fußbefund'],
    ['neurology', 'Neurologie'], ['angiology', 'Angiologie'],
    ['footwear', 'Schuhversorgung'], ['assessment', 'Zusammenfassende Beurteilung und Maßnahmen'],
  ],
  tracheostomy: [
    ['stoma', 'Stoma und Hautumgebung'], ['device', 'Kanüle und Hilfsmittel'],
    ['secretion', 'Sekret und Atmung'], ['care', 'Pflegerische Beobachtung und Maßnahmen'],
    ['training', 'Schulungsinhalte und Rückdemonstration'], ['participants', 'Teilnehmende'],
    ['followUp', 'Nächste Kontrolle oder Vereinbarung'],
  ],
} as const;

export const ENTRY_LABELS = {
  measurement: 'Digitale Wundvermessung', note: 'Wundnotiz',
  risk: 'Dekubitusprophylaxe', anamnesis: 'Pflegeanamnese',
  diabetic_foot: 'Diabetischer Fuß', tracheostomy: 'Tracheostomie',
  material: 'Material und Kosten', body_mark: 'Markierung auf der Körperkarte',
} as const;
export type WoundEntryKind = keyof typeof ENTRY_LABELS;
export type ClinicalFormKind = keyof typeof CLINICAL_FIELDS;
export type RecordPayload = Record<string, unknown>;
export type WoundEntry = {
  id: string;
  client_id: string;
  wound_case_id: string | null;
  kind: WoundEntryKind;
  observed_at: string;
  created_at: string;
  recorded_by_name: string;
  payload: RecordPayload;
};

export type WoundMediaKind = 'wound_photo' | 'patient_photo' | 'voice';
export type WoundMedia = {
  id: string; kind: WoundMediaKind; file_name: string; mime_type: string;
  observed_at: string; size_bytes: number; assessment_id: string | null;
};
export type WoundCatalogKind = 'description' | 'treatment' | 'article';
export type WoundCatalogItem = {
  id: string; kind: WoundCatalogKind; name: string; text: string;
  supplier: string; code: string; unit: string; unit_cents: number | null; updated_at: string;
};

export const DEFAULT_WOUND_SNIPPETS = [
  { id: 'bed', kind: 'description', name: 'Wundbett und Wundrand', text: 'Wundbett beurteilt. Gewebeanteile, Exsudat und Befund am Wundrand einzeln dokumentiert.' },
  { id: 'environment', kind: 'description', name: 'Wundumgebung', text: 'Haut der Wundumgebung hinsichtlich Farbe, Feuchtigkeit, Temperatur und Auffälligkeiten beurteilt.' },
  { id: 'response', kind: 'treatment', name: 'Versorgung und Reaktion', text: 'Die durchgeführten Versorgungsschritte, das verwendete Material und die beobachtete Reaktion sind dokumentiert.' },
  { id: 'review', kind: 'treatment', name: 'Weiteres Vorgehen', text: 'Die nächste Kontrolle und Zuständigkeit wurden abgestimmt.' },
] as const;

export function object(value: unknown): RecordPayload | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordPayload : null;
}

export function scorePressureRisk(scale: RiskScale, scores: unknown): number | null {
  const domains = RISK_SCALES[scale]?.domains;
  if (!domains || !Array.isArray(scores) || scores.length !== domains.length) return null;
  if (domains.some(([, max], i) => !Number.isInteger(scores[i]) || scores[i] < 1 || scores[i] > max)) return null;
  return scores.reduce((total, score) => total + score, 0);
}

export function woundNumber(input: string): number | null {
  const raw = input.trim();
  if (!/^\d+([.,]\d{1,3})?$/.test(raw)) return null;
  const value = Number(raw.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

export function ageAt(birth: unknown, date: string) {
  if (typeof birth !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birth)) return null;
  const start = new Date(birth + 'T00:00:00Z');
  if (!Number.isFinite(start.valueOf()) || start.toISOString().slice(0, 10) !== birth) return null;
  const end = new Date(date);
  if (!Number.isFinite(end.valueOf())) return null;
  const values = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(end);
  const part = (type: string) => values.find(value => value.type === type)?.value ?? '';
  const monthDay = part('month') + '-' + part('day');
  const age = Number(part('year')) - start.getUTCFullYear() - (monthDay < birth.slice(5) ? 1 : 0);
  return age >= 0 && age <= 130 ? age : null;
}

export function woundBmi(heightCm: unknown, weightKg: unknown) {
  if (typeof heightCm !== 'number' || typeof weightKg !== 'number' || heightCm <= 0 || weightKg <= 0) return null;
  return Math.round(weightKg / (heightCm / 100) ** 2 * 10) / 10;
}

export function validateWoundMeasurement(value: unknown): WoundMeasurement | null {
  const data = object(value);
  if (!data || !Array.isArray(data.outline) || !Array.isArray(data.sections) || data.sections.length > 24) return null;
  const trace = data as unknown as WoundMeasurement;
  if (!trace.scale || !object(trace.scale) || !object(trace.shares)) return null;
  for (const section of trace.sections) {
    if (!object(section) || !['necrosis', 'granulation', 'fibrin', 'epithelium'].includes(section.tissue)) return null;
    if ('shape' in section) {
      if (!woundPlanimetry.usableContour(section.shape)) return null;
    } else if (!Array.isArray(section.sample) || section.sample.length !== 3
      || section.sample.some(n => !Number.isInteger(n) || n < 0 || n > 255)
      || !Number.isInteger(section.tolerance) || section.tolerance < 0 || section.tolerance > 165) return null;
  }
  const computed = woundPlanimetry.dimensions(trace)?.centimetres;
  if (!computed || Object.keys(trace.shares).length !== 5) return null;
  let sum = 0;
  for (const key of Object.keys(TISSUE_LABELS) as (keyof typeof TISSUE_LABELS)[]) {
    const share = trace.shares[key];
    if (!Number.isFinite(share) || share < 0 || share > 100) return null;
    sum += Math.round(share * 100);
  }
  if (sum !== 10000) return null;
  return { width: trace.width, height: trace.height, outline: trace.outline, scale: trace.scale,
    sections: trace.sections, shares: trace.shares, ...computed };
}

export function formatWoundNumber(value: number, fractions = 2) {
  return value.toLocaleString('de-DE', { maximumFractionDigits: fractions });
}

export function formatWoundDate(value: string) {
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(new Date(value));
}

export function materialCost(payload: RecordPayload): number | null {
  return typeof payload.unitCents === 'number' && typeof payload.quantity === 'number'
    ? Math.round(payload.unitCents * payload.quantity) : null;
}
