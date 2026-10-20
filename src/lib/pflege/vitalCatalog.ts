import type { VitalReadingType } from '@/types/modules/pflege';

export type VitalCategoryKey =
  | 'basis'
  | 'koerper'
  | 'pflege'
  | 'haemodynamik'
  | 'beatmung'
  | 'blutgas';

export type VitalComponentDefinition = {
  key: string;
  label: string;
  unit: string;
  placeholder: string;
  decimals?: number;
};

export type VitalSignDefinition = {
  key: VitalReadingType;
  category: VitalCategoryKey;
  label: string;
  shortLabel: string;
  icon: string;
  color: string;
  defaultEnabled: boolean;
  components: readonly VitalComponentDefinition[];
  contextFields?: readonly { key: string; label: string; placeholder: string }[];
};

export const VITAL_CATEGORY_LABELS: Record<VitalCategoryKey, string> = {
  basis: 'Basisvitalzeichen',
  koerper: 'Körpermaße',
  pflege: 'Pflegerische Verlaufswerte',
  haemodynamik: 'Intensiv · Hämodynamik & Neuromonitoring',
  beatmung: 'Intensiv · Atmung & Beatmung',
  blutgas: 'Intensiv · Blutgase',
};

const single = (label: string, unit: string, placeholder: string, decimals = 0) => [
  { key: 'value', label, unit, placeholder, decimals },
] as const;

export const VITAL_SIGN_CATALOG: readonly VitalSignDefinition[] = [
  { key: 'blood_pressure', category: 'basis', label: 'Nichtinvasiver Blutdruck', shortLabel: 'Blutdruck', icon: '🩺', color: '#096BDE', defaultEnabled: true, components: [
    { key: 'systolic', label: 'Systolisch', unit: 'mmHg', placeholder: '120' },
    { key: 'diastolic', label: 'Diastolisch', unit: 'mmHg', placeholder: '80' },
    { key: 'map', label: 'Mittlerer arterieller Druck', unit: 'mmHg', placeholder: '93' },
  ], contextFields: [
    { key: 'position', label: 'Körperlage', placeholder: 'z. B. sitzend' },
    { key: 'arm', label: 'Messarm', placeholder: 'links / rechts' },
    { key: 'cuff', label: 'Manschette', placeholder: 'Größe / Typ' },
  ] },
  { key: 'pulse', category: 'basis', label: 'Puls / Herzfrequenz', shortLabel: 'Puls', icon: '💓', color: '#E02C5A', defaultEnabled: true, components: single('Frequenz', '/min', '72'), contextFields: [
    { key: 'rhythm', label: 'Rhythmus', placeholder: 'regelmäßig / unregelmäßig' },
    { key: 'method', label: 'Messmethode', placeholder: 'manuell / Monitor' },
  ] },
  { key: 'respiratory_rate', category: 'basis', label: 'Atemfrequenz', shortLabel: 'Atmung', icon: '🫁', color: '#00A6A6', defaultEnabled: true, components: single('Atemzüge', '/min', '16'), contextFields: [
    { key: 'pattern', label: 'Atemmuster', placeholder: 'regelmäßig / flach / vertieft' },
  ] },
  { key: 'oxygen', category: 'basis', label: 'Sauerstoffsättigung (SpO₂)', shortLabel: 'SpO₂', icon: '◉', color: '#0087D4', defaultEnabled: true, components: single('SpO₂', '%', '96'), contextFields: [
    { key: 'oxygenSupport', label: 'Sauerstoffgabe', placeholder: 'Raumluft / System' },
    { key: 'perfusion', label: 'Signal / Perfusion', placeholder: 'gut / eingeschränkt' },
  ] },
  { key: 'temperature', category: 'basis', label: 'Körpertemperatur', shortLabel: 'Temperatur', icon: '🌡️', color: '#F05A28', defaultEnabled: true, components: single('Temperatur', '°C', '36,8', 1), contextFields: [
    { key: 'site', label: 'Messort', placeholder: 'Ohr / oral / axillär / rektal' },
    { key: 'method', label: 'Messmethode', placeholder: 'Kontakt / kontaktlos' },
  ] },

  { key: 'weight', category: 'koerper', label: 'Körpergewicht', shortLabel: 'Gewicht', icon: '⚖️', color: '#7057D9', defaultEnabled: true, components: single('Gewicht', 'kg', '68,5', 2), contextFields: [
    { key: 'clothing', label: 'Bekleidung', placeholder: 'leicht bekleidet' },
    { key: 'scale', label: 'Waage', placeholder: 'Stand- / Sitz- / Bettwaage' },
  ] },
  { key: 'height', category: 'koerper', label: 'Körpergröße', shortLabel: 'Größe', icon: '↕️', color: '#7057D9', defaultEnabled: false, components: single('Größe', 'cm', '172', 1) },
  { key: 'bmi', category: 'koerper', label: 'Body-Mass-Index', shortLabel: 'BMI', icon: '◫', color: '#7057D9', defaultEnabled: false, components: single('BMI', 'kg/m²', '23,1', 1) },
  { key: 'body_surface_area', category: 'koerper', label: 'Körperoberfläche', shortLabel: 'KOF', icon: '◇', color: '#7057D9', defaultEnabled: false, components: single('Körperoberfläche', 'm²', '1,82', 2) },
  { key: 'head_circumference', category: 'koerper', label: 'Kopfumfang', shortLabel: 'Kopfumfang', icon: '◯', color: '#7057D9', defaultEnabled: false, components: single('Umfang', 'cm', '48,0', 1) },

  { key: 'blood_glucose', category: 'pflege', label: 'Blutzucker', shortLabel: 'BZ', icon: '🩸', color: '#B9365D', defaultEnabled: false, components: single('Glukose', 'mg/dl', '110'), contextFields: [
    { key: 'mealContext', label: 'Mahlzeitenbezug', placeholder: 'nüchtern / prä- / postprandial' },
    { key: 'sample', label: 'Probe', placeholder: 'kapillär / venös / Sensor' },
  ] },
  { key: 'blood_ketones', category: 'pflege', label: 'Blutketone', shortLabel: 'Ketone', icon: '🩸', color: '#B9365D', defaultEnabled: false, components: single('β-Hydroxybutyrat', 'mmol/l', '0,3', 1) },
  { key: 'pain_score', category: 'pflege', label: 'Schmerzskala', shortLabel: 'Schmerz', icon: '⚡', color: '#D97706', defaultEnabled: false, components: single('Schmerzintensität', '0–10', '0'), contextFields: [
    { key: 'scale', label: 'Skala', placeholder: 'NRS / VAS / BESD / PAINAD' },
    { key: 'location', label: 'Lokalisation', placeholder: 'Körperregion' },
  ] },
  { key: 'capillary_refill', category: 'pflege', label: 'Kapilläre Rückfüllzeit', shortLabel: 'Rekap.', icon: '✋', color: '#D97706', defaultEnabled: false, components: single('Rückfüllzeit', 's', '2', 1), contextFields: [
    { key: 'site', label: 'Messstelle', placeholder: 'Finger / Sternum' },
  ] },
  { key: 'urine_output', category: 'pflege', label: 'Urinausscheidung', shortLabel: 'Diurese', icon: '💧', color: '#0B86C5', defaultEnabled: false, components: single('Menge', 'ml', '250'), contextFields: [
    { key: 'period', label: 'Zeitraum', placeholder: 'z. B. seit 06:00 Uhr' },
    { key: 'route', label: 'Erfassung', placeholder: 'spontan / DK / Urostoma' },
  ] },
  { key: 'fluid_balance', category: 'pflege', label: 'Flüssigkeitsbilanz', shortLabel: 'Bilanz', icon: '⇄', color: '#0B86C5', defaultEnabled: false, components: [
    { key: 'intake', label: 'Einfuhr', unit: 'ml', placeholder: '1500' },
    { key: 'output', label: 'Ausfuhr', unit: 'ml', placeholder: '1200' },
    { key: 'balance', label: 'Bilanz', unit: 'ml', placeholder: '+300' },
  ], contextFields: [{ key: 'period', label: 'Bilanzzeitraum', placeholder: 'Schicht / 24 Stunden' }] },
  { key: 'gcs', category: 'pflege', label: 'Glasgow Coma Scale', shortLabel: 'GCS', icon: '🧠', color: '#6B4FD3', defaultEnabled: false, components: [
    { key: 'eyes', label: 'Augen öffnen', unit: 'E (1–4)', placeholder: '4' },
    { key: 'verbal', label: 'Verbale Reaktion', unit: 'V (1–5)', placeholder: '5' },
    { key: 'motor', label: 'Motorische Reaktion', unit: 'M (1–6)', placeholder: '6' },
    { key: 'total', label: 'Gesamt', unit: '3–15', placeholder: '15' },
  ] },
  { key: 'rass', category: 'pflege', label: 'Richmond Agitation-Sedation Scale', shortLabel: 'RASS', icon: '◐', color: '#6B4FD3', defaultEnabled: false, components: single('RASS', '−5 bis +4', '0') },
  { key: 'pupils', category: 'pflege', label: 'Pupillenstatus', shortLabel: 'Pupillen', icon: '👁️', color: '#6B4FD3', defaultEnabled: false, components: [
    { key: 'leftSize', label: 'Links', unit: 'mm', placeholder: '3', decimals: 1 },
    { key: 'rightSize', label: 'Rechts', unit: 'mm', placeholder: '3', decimals: 1 },
  ], contextFields: [
    { key: 'leftReaction', label: 'Lichtreaktion links', placeholder: 'prompt / träge / keine' },
    { key: 'rightReaction', label: 'Lichtreaktion rechts', placeholder: 'prompt / träge / keine' },
  ] },

  { key: 'arterial_pressure', category: 'haemodynamik', label: 'Invasiver arterieller Blutdruck', shortLabel: 'ART', icon: '〰️', color: '#C62F57', defaultEnabled: false, components: [
    { key: 'systolic', label: 'Systolisch', unit: 'mmHg', placeholder: '120' },
    { key: 'diastolic', label: 'Diastolisch', unit: 'mmHg', placeholder: '65' },
    { key: 'map', label: 'MAP', unit: 'mmHg', placeholder: '83' },
  ], contextFields: [{ key: 'site', label: 'Katheterlage', placeholder: 'A. radialis / femoralis' }] },
  { key: 'map', category: 'haemodynamik', label: 'Mittlerer arterieller Druck', shortLabel: 'MAP', icon: 'Ⓜ', color: '#C62F57', defaultEnabled: false, components: single('MAP', 'mmHg', '75') },
  { key: 'cvp', category: 'haemodynamik', label: 'Zentralvenöser Druck', shortLabel: 'ZVD', icon: '↗', color: '#C62F57', defaultEnabled: false, components: single('ZVD', 'mmHg', '8', 1), contextFields: [{ key: 'reference', label: 'Referenz / Lage', placeholder: 'Phlebostatische Achse / Rückenlage' }] },
  { key: 'cardiac_output', category: 'haemodynamik', label: 'Herzzeitvolumen', shortLabel: 'HZV', icon: '♥', color: '#C62F57', defaultEnabled: false, components: single('Herzzeitvolumen', 'l/min', '5,2', 2) },
  { key: 'cardiac_index', category: 'haemodynamik', label: 'Herzindex', shortLabel: 'HI', icon: '♥', color: '#C62F57', defaultEnabled: false, components: single('Herzindex', 'l/min/m²', '2,8', 2) },
  { key: 'svv', category: 'haemodynamik', label: 'Schlagvolumenvariation', shortLabel: 'SVV', icon: '≈', color: '#C62F57', defaultEnabled: false, components: single('SVV', '%', '10', 1) },
  { key: 'icp', category: 'haemodynamik', label: 'Intrakranieller Druck', shortLabel: 'ICP', icon: '🧠', color: '#6B4FD3', defaultEnabled: false, components: single('ICP', 'mmHg', '12', 1) },
  { key: 'cpp', category: 'haemodynamik', label: 'Zerebraler Perfusionsdruck', shortLabel: 'CPP', icon: '🧠', color: '#6B4FD3', defaultEnabled: false, components: single('CPP', 'mmHg', '70', 1) },

  { key: 'etco2', category: 'beatmung', label: 'Endtidales CO₂', shortLabel: 'etCO₂', icon: '🫁', color: '#008E83', defaultEnabled: false, components: single('etCO₂', 'mmHg', '38', 1), contextFields: [{ key: 'method', label: 'Messung', placeholder: 'Hauptstrom / Nebenstrom' }] },
  { key: 'oxygen_flow', category: 'beatmung', label: 'Sauerstofffluss', shortLabel: 'O₂-Fluss', icon: 'O₂', color: '#008E83', defaultEnabled: false, components: single('Fluss', 'l/min', '2', 1), contextFields: [{ key: 'device', label: 'Applikationssystem', placeholder: 'Nasenbrille / Maske / HFNC' }] },
  { key: 'fio2', category: 'beatmung', label: 'Inspiratorische Sauerstofffraktion', shortLabel: 'FiO₂', icon: 'O₂', color: '#008E83', defaultEnabled: false, components: single('FiO₂', '%', '30', 1) },
  { key: 'peep', category: 'beatmung', label: 'Positiver endexspiratorischer Druck', shortLabel: 'PEEP', icon: '↥', color: '#008E83', defaultEnabled: false, components: single('PEEP', 'mbar', '5', 1) },
  { key: 'tidal_volume', category: 'beatmung', label: 'Atemzugvolumen', shortLabel: 'Vt', icon: '↔', color: '#008E83', defaultEnabled: false, components: single('Atemzugvolumen', 'ml', '450') },
  { key: 'minute_ventilation', category: 'beatmung', label: 'Atemminutenvolumen', shortLabel: 'AMV', icon: '↻', color: '#008E83', defaultEnabled: false, components: single('Minutenvolumen', 'l/min', '7,2', 1) },
  { key: 'peak_airway_pressure', category: 'beatmung', label: 'Spitzen-Atemwegsdruck', shortLabel: 'Ppeak', icon: '⌃', color: '#008E83', defaultEnabled: false, components: single('Spitzendruck', 'mbar', '22', 1) },
  { key: 'plateau_pressure', category: 'beatmung', label: 'Plateaudruck', shortLabel: 'Pplat', icon: '▔', color: '#008E83', defaultEnabled: false, components: single('Plateaudruck', 'mbar', '18', 1) },
  { key: 'ventilator_rate', category: 'beatmung', label: 'Beatmungsfrequenz', shortLabel: 'AF Gerät', icon: '↻', color: '#008E83', defaultEnabled: false, components: single('Frequenz', '/min', '14'), contextFields: [{ key: 'mode', label: 'Beatmungsmodus', placeholder: 'z. B. PSV / PCV / VC' }] },

  { key: 'ph', category: 'blutgas', label: 'pH-Wert', shortLabel: 'pH', icon: '🧪', color: '#8651C7', defaultEnabled: false, components: single('pH', '', '7,40', 2), contextFields: [{ key: 'sample', label: 'Probenart', placeholder: 'arteriell / venös / kapillär' }] },
  { key: 'pco2', category: 'blutgas', label: 'Kohlendioxidpartialdruck', shortLabel: 'pCO₂', icon: '🧪', color: '#8651C7', defaultEnabled: false, components: single('pCO₂', 'mmHg', '40', 1) },
  { key: 'po2', category: 'blutgas', label: 'Sauerstoffpartialdruck', shortLabel: 'pO₂', icon: '🧪', color: '#8651C7', defaultEnabled: false, components: single('pO₂', 'mmHg', '90', 1) },
  { key: 'bicarbonate', category: 'blutgas', label: 'Bicarbonat', shortLabel: 'HCO₃⁻', icon: '🧪', color: '#8651C7', defaultEnabled: false, components: single('HCO₃⁻', 'mmol/l', '24', 1) },
  { key: 'base_excess', category: 'blutgas', label: 'Basenüberschuss', shortLabel: 'BE', icon: '🧪', color: '#8651C7', defaultEnabled: false, components: single('Base Excess', 'mmol/l', '0', 1) },
  { key: 'lactate', category: 'blutgas', label: 'Laktat', shortLabel: 'Laktat', icon: '🧪', color: '#8651C7', defaultEnabled: false, components: single('Laktat', 'mmol/l', '1,2', 1) },
] as const;

export const VITAL_SIGN_BY_KEY = new Map(VITAL_SIGN_CATALOG.map((item) => [item.key, item]));

export function getVitalDefinition(key: string): VitalSignDefinition | undefined {
  return VITAL_SIGN_BY_KEY.get(key as VitalReadingType);
}

export function formatVitalValues(key: string, values: Record<string, number>): string {
  const definition = getVitalDefinition(key);
  if (!definition) return Object.values(values).join(' / ');
  if (key === 'blood_pressure' || key === 'arterial_pressure') {
    const systolic = values.systolic;
    const diastolic = values.diastolic;
    const map = values.map;
    return `${systolic ?? '—'}/${diastolic ?? '—'}${map == null ? '' : ` (MAP ${map})`}`;
  }
  if (key === 'gcs') return `GCS ${values.total ?? '—'} (E${values.eyes ?? '—'} V${values.verbal ?? '—'} M${values.motor ?? '—'})`;
  if (key === 'fluid_balance') return `${(values.balance ?? 0) >= 0 ? '+' : ''}${values.balance ?? '—'}`;
  if (key === 'pupils') return `L ${values.leftSize ?? '—'} / R ${values.rightSize ?? '—'}`;
  return String(values.value ?? Object.values(values)[0] ?? '—');
}
