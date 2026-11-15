import { VITAL_CATEGORY_LABELS, VITAL_SIGN_CATALOG, type VitalCategoryKey } from './vitalCatalog';

export type VitalCatalogFilter = 'quick' | 'enabled' | 'all' | VitalCategoryKey;

const quickOrder = [
  'blood_pressure', 'pulse', 'oxygen', 'temperature', 'respiratory_rate', 'blood_glucose', 'weight', 'pain_score',
];

const categoryNames: Record<VitalCategoryKey, string> = {
  basis: 'Basiswerte',
  koerper: 'Körpermaße',
  pflege: 'Pflegeverlauf',
  haemodynamik: 'Hämodynamik',
  beatmung: 'Beatmung',
  blutgas: 'Blutgase',
};

export const vitalCatalogFilters = Object.entries(categoryNames).map(([key, label]) => ({
  key: key as VitalCategoryKey,
  label,
}));

export function vitalSearchText(value: string) {
  return value.toLocaleLowerCase('de').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replaceAll('ß', 'ss');
}

export function vitalCatalogSelection(filter: VitalCatalogFilter, search: string, enabled: ReadonlySet<string>) {
  const words = vitalSearchText(search).trim().split(/\s+/).filter(Boolean);
  if (words.length) {
    return VITAL_SIGN_CATALOG.filter(item => {
      const text = vitalSearchText([item.label, item.shortLabel, VITAL_CATEGORY_LABELS[item.category],
        ...item.components.flatMap(component => [component.label, component.unit])].join(' '));
      return words.every(word => text.includes(word)) && (filter !== 'enabled' || enabled.has(item.key));
    });
  }
  if (filter === 'all') return VITAL_SIGN_CATALOG;
  if (filter === 'enabled') return VITAL_SIGN_CATALOG.filter(item => enabled.has(item.key));
  if (filter === 'quick') {
    return VITAL_SIGN_CATALOG.filter(item => quickOrder.includes(item.key))
      .sort((a, b) => Number(enabled.has(b.key)) - Number(enabled.has(a.key)) || quickOrder.indexOf(a.key) - quickOrder.indexOf(b.key));
  }
  return VITAL_SIGN_CATALOG.filter(item => item.category === filter);
}

const periods = ['Frühdienst', 'Spätdienst', 'Nachtdienst', '24 Stunden'];
const lightReaction = ['Prompt', 'Träge', 'Keine Reaktion', 'Nicht beurteilbar'];
const oxygenSystems = ['Nasenbrille', 'Maske', 'Reservoirmaske', 'High-Flow-Nasenkanüle'];

export const vitalContextOptions: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
  blood_pressure: {
    position: ['Sitzend', 'Liegend', 'Stehend'],
    arm: ['Links', 'Rechts'],
    cuff: ['Klein', 'Standard', 'Groß', 'XL', 'Handgelenk'],
  },
  pulse: { rhythm: ['Regelmäßig', 'Unregelmäßig'], method: ['Manuell', 'Monitor', 'Pulsoximeter'] },
  respiratory_rate: { pattern: ['Regelmäßig', 'Unregelmäßig', 'Flach', 'Vertieft'] },
  oxygen: { oxygenSupport: ['Raumluft', ...oxygenSystems], perfusion: ['Stabiles Signal', 'Eingeschränktes Signal', 'Wechselndes Signal'] },
  temperature: {
    site: ['Ohr', 'Stirn', 'Oral', 'Axillär', 'Rektal'],
    method: ['Kontakt', 'Kontaktlos'],
  },
  weight: {
    clothing: ['Ohne Kleidung', 'Leicht bekleidet', 'Bekleidet'],
    scale: ['Standwaage', 'Sitzwaage', 'Bettwaage', 'Rollstuhlwaage'],
  },
  blood_glucose: {
    mealContext: ['Nüchtern', 'Vor der Mahlzeit', 'Nach der Mahlzeit', 'Ohne Mahlzeitenbezug'],
    sample: ['Kapillär', 'Venös', 'Sensor'],
  },
  pain_score: {
    location: ['Kopf', 'Hals', 'Brustkorb', 'Bauch', 'Rücken', 'Arm', 'Bein', 'Mehrere Regionen'],
  },
  capillary_refill: { site: ['Finger', 'Zehe', 'Sternum'] },
  urine_output: { period: periods, route: ['Spontan', 'Dauerkatheter', 'Einmalkatheter', 'Urostoma'] },
  fluid_balance: { period: periods },
  pupils: { leftReaction: lightReaction, rightReaction: lightReaction },
  arterial_pressure: { site: ['A. radialis', 'A. femoralis', 'A. brachialis', 'A. dorsalis pedis'] },
  cvp: { reference: ['Phlebostatische Achse', 'Rückenlage', 'Oberkörper erhöht'] },
  etco2: { method: ['Hauptstrom', 'Nebenstrom'] },
  oxygen_flow: { device: oxygenSystems },
  ventilator_rate: { mode: ['PSV', 'PCV', 'VC', 'SIMV', 'CPAP'] },
  ph: { sample: ['Arteriell', 'Venös', 'Kapillär'] },
};

export function vitalScoreChoices(type: string, component: string): string[] | undefined {
  if (type === 'pain_score') return Array.from({ length: 11 }, (_, index) => String(index));
  if (type === 'rass') return Array.from({ length: 10 }, (_, index) => String(index - 5));
  if (type !== 'gcs') return undefined;
  const count = component === 'eyes' ? 4 : component === 'verbal' ? 5 : component === 'motor' ? 6 : 0;
  return count ? Array.from({ length: count }, (_, index) => String(index + 1)) : undefined;
}

export function vitalCatalogUnit(type: (typeof VITAL_SIGN_CATALOG)[number]) {
  if (type.key === 'gcs') return 'E / V / M';
  return type.components[0].unit || 'Ohne Einheit';
}
