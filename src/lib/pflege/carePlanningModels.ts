export const carePlanningModels = [
  { key: 'atl', label: 'ATL (Juchli)' },
  { key: 'aedl', label: 'AEDL (Krohwinkel)' },
  { key: 'fedl', label: 'FEDL (Messer)' },
  { key: 'roper', label: 'Roper' },
  { key: 'orem', label: 'Orem' },
  { key: 'henderson', label: 'Henderson' },
] as const;

export type CarePlanningModel = (typeof carePlanningModels)[number]['key'];
export type CarePlanningSetting = 'ambulant' | 'stationaer';

export const planningDomains = {
  communication: 'Verständigung',
  orientation: 'Orientierung',
  movement: 'Mobilität',
  positioning: 'Lage und Positionierung',
  cleansing: 'Körperpflege',
  clothing: 'An- und Auskleiden',
  meals: 'Essen',
  drinks: 'Trinken',
  elimination: 'Ausscheidung',
  breathing: 'Atmung und Belastung',
  temperature: 'Wärmeempfinden',
  sleep: 'Ruhe und Schlaf',
  safety: 'Sicherheit',
  routine: 'Tagesgestaltung',
  relationships: 'Soziale Beziehungen',
  intimacy: 'Privatsphäre und Nähe',
  development: 'Entwicklung und Übergänge',
  meaning: 'Existentielle Anliegen',
  treatment: 'Umgang mit gesundheitlichen Anforderungen',
  learning: 'Lernen und Mitwirken',
} as const;

export type CarePlanningDomain = keyof typeof planningDomains;
type ModelGroup = { label: string; domains: readonly CarePlanningDomain[] };

// CareSuite group labels for the model-specific library presentation.
export const planningGroups = {
  atl: [
    { label: 'Kommunizieren', domains: ['communication', 'orientation', 'learning'] },
    { label: 'Bewegung', domains: ['movement', 'positioning'] },
    { label: 'Körperpflege und Kleidung', domains: ['cleansing', 'clothing'] },
    { label: 'Essen und Trinken', domains: ['meals', 'drinks'] },
    { label: 'Ausscheiden', domains: ['elimination'] },
    { label: 'Atmung', domains: ['breathing'] },
    { label: 'Wärme und Kälte', domains: ['temperature'] },
    { label: 'Ruhen und Schlafen', domains: ['sleep'] },
    { label: 'Sich sicher fühlen', domains: ['safety', 'treatment'] },
    { label: 'Alltag und Beschäftigung', domains: ['routine', 'relationships'] },
    { label: 'Identität und Nähe', domains: ['intimacy'] },
    { label: 'Sinn und Übergänge', domains: ['meaning', 'development'] },
  ],
  aedl: [
    { label: 'Kommunizieren', domains: ['communication', 'orientation'] },
    { label: 'Sich bewegen', domains: ['movement', 'positioning'] },
    { label: 'Vitale Funktionen', domains: ['breathing', 'temperature', 'treatment'] },
    { label: 'Sich pflegen', domains: ['cleansing'] },
    { label: 'Essen und Trinken', domains: ['meals', 'drinks'] },
    { label: 'Ausscheiden', domains: ['elimination'] },
    { label: 'Sich kleiden', domains: ['clothing'] },
    { label: 'Ruhen und Schlafen', domains: ['sleep'] },
    { label: 'Sich beschäftigen', domains: ['routine', 'learning'] },
    { label: 'Identität und Intimsphäre', domains: ['intimacy'] },
    { label: 'Sichere Umgebung', domains: ['safety'] },
    { label: 'Soziale Beziehungen', domains: ['relationships'] },
    { label: 'Existentielle Erfahrungen', domains: ['meaning', 'development'] },
  ],
  fedl: [
    { label: 'Wahrnehmen und sich mitteilen', domains: ['communication', 'orientation'] },
    { label: 'Bewegungsfähigkeiten', domains: ['movement', 'positioning'] },
    { label: 'Sich versorgen', domains: ['cleansing', 'clothing', 'elimination'] },
    { label: 'Mahlzeiten und Trinken gestalten', domains: ['meals', 'drinks'] },
    { label: 'Wohlbefinden', domains: ['breathing', 'temperature', 'sleep'] },
    { label: 'Alltagsfähigkeiten und Entscheidungen', domains: ['routine', 'learning', 'safety', 'treatment'] },
    { label: 'Begegnung, Nähe und Zugehörigkeit', domains: ['relationships', 'intimacy'] },
    { label: 'Biografie und existentielle Erfahrungen', domains: ['meaning', 'development'] },
  ],
  roper: [
    { label: 'Sichere Umgebung', domains: ['safety', 'orientation', 'treatment'] },
    { label: 'Kommunikation', domains: ['communication', 'relationships'] },
    { label: 'Atmung', domains: ['breathing'] },
    { label: 'Essen und Trinken', domains: ['meals', 'drinks'] },
    { label: 'Ausscheidung', domains: ['elimination'] },
    { label: 'Körperpflege und Kleidung', domains: ['cleansing', 'clothing'] },
    { label: 'Körpertemperatur', domains: ['temperature'] },
    { label: 'Bewegung', domains: ['movement', 'positioning'] },
    { label: 'Arbeiten und Freizeit', domains: ['routine', 'learning', 'development'] },
    { label: 'Sexualität und Nähe', domains: ['intimacy'] },
    { label: 'Schlafen', domains: ['sleep'] },
    { label: 'Sterben und Abschied', domains: ['meaning'] },
  ],
  orem: [
    { label: 'Allgemeine Selbstpflege', domains: ['breathing', 'temperature', 'meals', 'drinks', 'elimination', 'movement', 'positioning', 'sleep', 'cleansing', 'clothing', 'safety', 'communication', 'relationships', 'intimacy'] },
    { label: 'Entwicklungsbezogene Selbstpflege', domains: ['routine', 'orientation', 'development', 'meaning'] },
    { label: 'Selbstpflege bei gesundheitlichen Veränderungen', domains: ['treatment', 'learning'] },
  ],
  henderson: [
    { label: 'Atmen', domains: ['breathing'] },
    { label: 'Essen und Trinken', domains: ['meals', 'drinks'] },
    { label: 'Ausscheiden', domains: ['elimination'] },
    { label: 'Bewegung und Haltung', domains: ['movement', 'positioning'] },
    { label: 'Schlafen und Ruhen', domains: ['sleep'] },
    { label: 'Kleidung wählen', domains: ['clothing'] },
    { label: 'Körpertemperatur regulieren', domains: ['temperature'] },
    { label: 'Körper und Haut pflegen', domains: ['cleansing'] },
    { label: 'Gefahren vermeiden', domains: ['safety', 'orientation', 'treatment'] },
    { label: 'Bedürfnisse und Gefühle äußern', domains: ['communication', 'relationships', 'intimacy'] },
    { label: 'Werten und Glauben Raum geben', domains: ['meaning'] },
    { label: 'Sinnvolle Aufgaben übernehmen', domains: ['development'] },
    { label: 'Freizeit gestalten', domains: ['routine'] },
    { label: 'Lernen und Hilfen nutzen', domains: ['learning'] },
  ],
} as const satisfies Record<CarePlanningModel, readonly ModelGroup[]>;

export function carePlanningGroup(model: CarePlanningModel, domain: CarePlanningDomain) {
  const groups: readonly ModelGroup[] = planningGroups[model];
  return groups.find(group => group.domains.includes(domain));
}

export function carePlanningCategory(model: CarePlanningModel, domain: CarePlanningDomain) {
  const label = carePlanningModels.find(option => option.key === model)?.label;
  const group = carePlanningGroup(model, domain);
  return group ? `${label} · ${group.label}` : label;
}
