import type {
  BodyMapAgeGroup,
  BodyMapChestAnatomy,
  BodyMapGenitalAnatomy,
  BodyMapModelSelection,
  BodyMapSex,
} from '@/types/modules/bodyMap';
import type {
  BodyMapMedicalReviewItem,
  BodyMapMedicalReviewIssue,
} from '@/types/platformConsole';
import {
  BODY_MAP_AGE_LABELS,
  BODY_MAP_SEX_LABELS,
} from './modelCatalog';

export const BODYMAP_MEDICAL_CHECKLIST_VERSION = 1;

export type BodyMapMedicalReviewCategory =
  | 'general'
  | 'age'
  | 'head'
  | 'hands_feet'
  | 'chest'
  | 'intimate'
  | 'pressure_injury'
  | 'interaction'
  | 'continuity';

export type BodyMapMedicalReviewCriterion = {
  id: string;
  category: BodyMapMedicalReviewCategory;
  label: string;
  guidance: string;
  mandatory: boolean;
  appliesTo?: (
    selection: BodyMapModelSelection,
    variantId: string,
  ) => boolean;
};

export const BODYMAP_MEDICAL_CATEGORY_LABELS: Record<
  BodyMapMedicalReviewCategory,
  string
> = {
  general: 'Gesamtkörper und Proportionen',
  age: 'Altersgerechte Anatomie',
  head: 'Kopf, Augen, Ohren und Mund',
  hands_feet: 'Hände, Füße und Gelenke',
  chest: 'Brustkorb und Brustanatomie',
  intimate: 'Genital-, Gesäß- und Perinealregion',
  pressure_injury: 'Dekubitusrelevante Regionen',
  interaction: '3D-Interaktion und Oberflächenpräzision',
  continuity: 'Dokumentationskontinuität',
};

const adult = (selection: BodyMapModelSelection) =>
  ['junger_erwachsener', 'erwachsener', 'senior', 'hochbetagt'].includes(
    selection.ageGroup,
  );
const breasts = (_selection: BodyMapModelSelection, variantId: string) =>
  variantId.includes('weiblich') || variantId.endsWith('-brueste');
const penis = (selection: BodyMapModelSelection, variantId: string) =>
  selection.sex === 'maennlich' || variantId.includes('-penis-');
const vulva = (selection: BodyMapModelSelection, variantId: string) =>
  selection.sex === 'weiblich' || variantId.includes('-vulva-');
const older = (selection: BodyMapModelSelection) =>
  selection.ageGroup === 'senior' || selection.ageGroup === 'hochbetagt';

export const BODYMAP_MEDICAL_REVIEW_CRITERIA: readonly BodyMapMedicalReviewCriterion[] = [
  { id: 'general-silhouette', category: 'general', label: 'Silhouette anatomisch plausibel', guidance: 'Vorder-, Rück- und beide Seitenansichten auf Symmetrie, Achsen und Volumen prüfen.', mandatory: true },
  { id: 'general-proportions', category: 'general', label: 'Körperproportionen korrekt', guidance: 'Kopf-Rumpf-Verhältnis, Schulter-/Beckenbreite sowie Extremitätenlängen prüfen.', mandatory: true },
  { id: 'general-surface', category: 'general', label: 'Geschlossene, fehlerfreie Hautoberfläche', guidance: 'Keine Löcher, Überschneidungen, schwebenden Flächen oder sichtbaren Mesh-Nähte.', mandatory: true },
  { id: 'general-posture', category: 'general', label: 'Neutrale klinische Körperhaltung', guidance: 'Stand, Gelenkstellung und Zugänglichkeit aller Körperregionen prüfen.', mandatory: true },
  { id: 'general-sex-characteristics', category: 'general', label: 'Gewählte körperliche Merkmale konsistent', guidance: 'Anatomie muss der gewählten Variante entsprechen, ohne stereotype Überzeichnung.', mandatory: true },

  { id: 'age-head-ratio', category: 'age', label: 'Altersgerechtes Kopf-Körper-Verhältnis', guidance: 'Besonders bei Baby, Klein- und Kind auf die entwicklungsabhängigen Proportionen achten.', mandatory: true },
  { id: 'age-torso-limbs', category: 'age', label: 'Altersgerechter Rumpf und Extremitäten', guidance: 'Längen, Umfang, Gelenkdefinition und Muskel-/Fettverteilung prüfen.', mandatory: true },
  { id: 'age-skin-soft-tissue', category: 'age', label: 'Altersgerechtes Weichteilgewebe', guidance: 'Keine erwachsene Anatomie auf pädiatrischen Varianten; altersbedingte Veränderungen plausibel.', mandatory: true },
  { id: 'age-older-posture', category: 'age', label: 'Seniorische Veränderungen plausibel', guidance: 'Haltung, Muskelmasse und Weichteilverteilung respektvoll und medizinisch plausibel prüfen.', mandatory: true, appliesTo: older },

  { id: 'head-eyes', category: 'head', label: 'Augen und Lider präzise', guidance: 'Beide Augen, Lider, Lidwinkel und Orbitalregion einzeln prüfen.', mandatory: true },
  { id: 'head-ears', category: 'head', label: 'Ohren präzise', guidance: 'Ohrmuschel, Helix, Anthelix, Tragus und retroaurikuläre Region müssen anklickbar sein.', mandatory: true },
  { id: 'head-mouth', category: 'head', label: 'Mund und Lippen präzise', guidance: 'Lippenkontur, Mundwinkel und Mundöffnung müssen eindeutig lokalisierbar sein.', mandatory: true },
  { id: 'head-nose', category: 'head', label: 'Nase und Nasenöffnungen plausibel', guidance: 'Nasenrücken, Flügel und Öffnungen ohne Artefakte prüfen.', mandatory: true },
  { id: 'head-neck', category: 'head', label: 'Halsregion vollständig zugänglich', guidance: 'Vorderer, seitlicher und hinterer Hals einschließlich Nacken müssen dokumentierbar sein.', mandatory: true },

  { id: 'hands-five-digits', category: 'hands_feet', label: 'Je Hand fünf getrennte Finger', guidance: 'Daumenstellung, Zwischenräume, Nägel und Handflächen ohne Verschmelzungen prüfen.', mandatory: true },
  { id: 'hands-palms-dorsum', category: 'hands_feet', label: 'Handfläche und Handrücken zugänglich', guidance: 'Fingerseiten, Knöchel und Handgelenk müssen exakt anwählbar sein.', mandatory: true },
  { id: 'feet-five-digits', category: 'hands_feet', label: 'Je Fuß fünf getrennte Zehen', guidance: 'Zehen, Zwischenräume, Nägel, Fußsohle und Ferse prüfen.', mandatory: true },
  { id: 'joints-landmarks', category: 'hands_feet', label: 'Gelenke und Knochenpunkte plausibel', guidance: 'Schulter, Ellenbogen, Handgelenk, Knie und Knöchel als Orientierungspunkte prüfen.', mandatory: true },

  { id: 'chest-thorax', category: 'chest', label: 'Brustkorb anatomisch plausibel', guidance: 'Sternum-, Rippen- und Axillarregion in allen Ansichten prüfen.', mandatory: true },
  { id: 'chest-breasts', category: 'chest', label: 'Brüste anatomisch korrekt', guidance: 'Form, Übergang zur Thoraxwand, Unterbrustfalte und Symmetrie prüfen.', mandatory: true, appliesTo: breasts },
  { id: 'chest-nipples', category: 'chest', label: 'Mamillen und Areolen lokalisierbar', guidance: 'Beidseits präzise und getrennt anklickbar; keine texturhafte Ersatzdarstellung.', mandatory: true, appliesTo: (selection, variantId) => adult(selection) && breasts(selection, variantId) },
  { id: 'chest-no-breasts', category: 'chest', label: 'Variante ohne Brüste korrekt', guidance: 'Brustwand und Mamillenregion entsprechend der gewählten Anatomie prüfen.', mandatory: true, appliesTo: (_selection, variantId) => variantId.endsWith('-keine-brueste') },

  { id: 'intimate-buttocks', category: 'intimate', label: 'Gesäß anatomisch präzise', guidance: 'Beide Gesäßhälften, Gesäßfalte und Übergang zur Sakralregion prüfen.', mandatory: true },
  { id: 'intimate-perineum', category: 'intimate', label: 'Perinealregion lokalisierbar', guidance: 'Zwischen Genital- und Analregion muss eine getrennte Dokumentation möglich sein.', mandatory: true },
  { id: 'intimate-anus', category: 'intimate', label: 'Analregion medizinisch lokalisierbar', guidance: 'Unaufdringlich, aber anatomisch eindeutig für pflegerische Dokumentation.', mandatory: true },
  { id: 'intimate-penis', category: 'intimate', label: 'Penis und Skrotum anatomisch korrekt', guidance: 'Schaft, Glans, Skrotum und Leistenübergänge getrennt prüfbar.', mandatory: true, appliesTo: penis },
  { id: 'intimate-vulva', category: 'intimate', label: 'Vulva anatomisch korrekt', guidance: 'Labien, Klitorisregion, Urethral- und Vaginalöffnung medizinisch differenzierbar.', mandatory: true, appliesTo: vulva },
  { id: 'intimate-unknown', category: 'intimate', label: 'Unbekannte Genitalanatomie neutral behandelt', guidance: 'Keine falsche anatomische Festlegung; Region bleibt dennoch dokumentierbar.', mandatory: true, appliesTo: (_selection, variantId) => variantId.includes('-unbekannt-') || variantId.endsWith('-divers') },

  { id: 'pressure-occiput', category: 'pressure_injury', label: 'Hinterkopf und Ohrmuscheln zugänglich', guidance: 'Dekubitusgefährdete Bereiche bei Lagerung vollständig markieren können.', mandatory: true },
  { id: 'pressure-scapulae', category: 'pressure_injury', label: 'Schulterblätter und Wirbelsäule zugänglich', guidance: 'Rechts/links und Wirbelsäulenabschnitte getrennt markieren können.', mandatory: true },
  { id: 'pressure-elbows', category: 'pressure_injury', label: 'Ellenbogen beidseits zugänglich', guidance: 'Olekranonregion präzise anwählbar.', mandatory: true },
  { id: 'pressure-sacrum', category: 'pressure_injury', label: 'Sakrum und Steißbein präzise', guidance: 'Sakral-, Steißbein- und Gesäßregionen müssen unterscheidbar sein.', mandatory: true },
  { id: 'pressure-trochanters', category: 'pressure_injury', label: 'Trochanterregionen beidseits zugänglich', guidance: 'Seitliche Hüftregionen für Lagerungs- und Dekubitusdokumentation prüfen.', mandatory: true },
  { id: 'pressure-knees-ankles-heels', category: 'pressure_injury', label: 'Knie, Knöchel und Fersen vollständig', guidance: 'Mediale/laterale Knöchel, Kniekontakte und Fersen getrennt dokumentierbar.', mandatory: true },
  { id: 'pressure-device-sites', category: 'pressure_injury', label: 'Medizinproduktbedingte Druckstellen erfassbar', guidance: 'Nase, Ohren, Gesicht, Hals und Extremitäten für Geräte-/Schlauchdruck prüfen.', mandatory: true },

  { id: 'interaction-rotate', category: 'interaction', label: 'Drehung vollständig und stabil', guidance: '360° mit Maus und Touch, ohne Sprünge oder Verlust der Auswahl.', mandatory: true },
  { id: 'interaction-zoom', category: 'interaction', label: 'Detailzoom ausreichend', guidance: 'Augen, Mund, Ohren, Finger, Zehen, Brust und Intimbereiche präzise erreichen.', mandatory: true },
  { id: 'interaction-hitpoint', category: 'interaction', label: 'Klickpunkt entspricht Oberfläche', guidance: 'Trefferpunkt darf nicht auf Rückseite oder benachbarte Region springen.', mandatory: true },
  { id: 'interaction-marker', category: 'interaction', label: 'Gelber Pulsmarker korrekt verankert', guidance: 'Marker bleibt bei Drehung, Zoom und Modellwechsel exakt an der dokumentierten Stelle.', mandatory: true },
  { id: 'interaction-mobile', category: 'interaction', label: 'Touch-Bedienung mobil nutzbar', guidance: 'Ein-Finger-Drehung, Zwei-Finger-Zoom und Auswahl ohne Gestenkonflikte.', mandatory: true },

  { id: 'continuity-age-change', category: 'continuity', label: 'Befunde bleiben bei Alterswechsel erhalten', guidance: 'Geburtstagsbedingter Modellwechsel übernimmt alle Befunde, Bilder und Verläufe verlustfrei.', mandatory: true },
  { id: 'continuity-anatomy-change', category: 'continuity', label: 'Befunde bleiben bei Variantenwechsel erhalten', guidance: 'Anatomieauswahl darf klinische Daten nicht löschen; Positionen werden nachvollziehbar remappt.', mandatory: true },
  { id: 'continuity-dual-module', category: 'continuity', label: 'Pflege und Stationär konsistent', guidance: 'Identische Befunde, Medien, Verlauf und Freigabestatus in beiden Modulen prüfen.', mandatory: true },
  { id: 'continuity-audit', category: 'continuity', label: 'Änderungen revisionssicher', guidance: 'Prüfentscheidungen, Datenübertragungen und Korrekturen mit Zeit und Benutzer protokollieren.', mandatory: true },
];

const AGE_SLUGS: Record<string, BodyMapAgeGroup> = {
  baby: 'baby',
  kleinkind: 'kleinkind',
  kind: 'kind',
  jugendlicher: 'jugendlicher',
  'junger-erwachsener': 'junger_erwachsener',
  erwachsener: 'erwachsener',
  senior: 'senior',
  hochbetagt: 'hochbetagt',
};

export function selectionFromBodyMapVariantId(
  variantId: string,
): BodyMapModelSelection {
  const withoutPrefix = variantId.replace(/^body-/, '');
  const ageSlug = Object.keys(AGE_SLUGS)
    .sort((a, b) => b.length - a.length)
    .find((slug) => withoutPrefix.startsWith(`${slug}-`));
  if (!ageSlug) throw new Error(`Unbekannte Bodymap-Variante: ${variantId}`);
  const remainder = withoutPrefix.slice(ageSlug.length + 1);
  const sex = (['maennlich', 'weiblich', 'divers'] as BodyMapSex[]).find(
    (value) => remainder === value || remainder.startsWith(`${value}-`),
  );
  if (!sex) throw new Error(`Unbekanntes Geschlecht in Variante: ${variantId}`);
  let genitalAnatomy: BodyMapGenitalAnatomy | null = null;
  let chestAnatomy: BodyMapChestAnatomy | null = null;
  if (sex === 'divers') {
    genitalAnatomy =
      (['penis', 'vulva', 'unbekannt'] as BodyMapGenitalAnatomy[]).find(
        (value) => remainder.includes(`-${value}-`),
      ) ?? 'unbekannt';
    chestAnatomy = remainder.endsWith('-keine-brueste')
      ? 'keine_brueste'
      : remainder.endsWith('-brueste')
        ? 'brueste'
        : 'unbekannt';
  }
  return {
    sex,
    ageGroup: AGE_SLUGS[ageSlug],
    genitalAnatomy,
    chestAnatomy,
    skinTone: 'mittel',
  };
}

export function bodyMapVariantLabel(variantId: string): string {
  const selection = selectionFromBodyMapVariantId(variantId);
  const details =
    selection.sex === 'divers' && variantId.split('-').length > 4
      ? ` · ${selection.genitalAnatomy === 'vulva' ? 'Vulva' : selection.genitalAnatomy === 'penis' ? 'Penis' : 'Genital unbekannt'} · ${selection.chestAnatomy === 'brueste' ? 'mit Brüsten' : selection.chestAnatomy === 'keine_brueste' ? 'ohne Brüste' : 'Brust unbekannt'}`
      : '';
  return `${BODY_MAP_AGE_LABELS[selection.ageGroup]} · ${BODY_MAP_SEX_LABELS[selection.sex]}${details}`;
}

export function getBodyMapMedicalCriteria(
  variantId: string,
): BodyMapMedicalReviewCriterion[] {
  const selection = selectionFromBodyMapVariantId(variantId);
  return BODYMAP_MEDICAL_REVIEW_CRITERIA.filter(
    (criterion) => !criterion.appliesTo || criterion.appliesTo(selection, variantId),
  );
}

export function createPendingMedicalReviewItems(
  variantId: string,
): BodyMapMedicalReviewItem[] {
  return getBodyMapMedicalCriteria(variantId).map((criterion) => ({
    criterionId: criterion.id,
    category: criterion.category,
    result: 'pending',
    notes: '',
    evidence: [],
  }));
}

export function evaluateBodyMapMedicalApproval(
  variantId: string,
  items: BodyMapMedicalReviewItem[],
  issues: BodyMapMedicalReviewIssue[],
): { allowed: boolean; reasons: string[]; completed: number; total: number } {
  const criteria = getBodyMapMedicalCriteria(variantId);
  const itemMap = new Map(items.map((item) => [item.criterionId, item]));
  const blockingResults = new Set(['pending', 'major', 'blocker']);
  const unresolved = issues.filter(
    (issue) =>
      issue.status === 'open' &&
      (issue.severity === 'major' || issue.severity === 'blocker'),
  );
  const missing = criteria.filter((criterion) => {
    const result = itemMap.get(criterion.id)?.result ?? 'pending';
    return criterion.mandatory && blockingResults.has(result);
  });
  const reasons: string[] = [];
  if (missing.length) reasons.push(`${missing.length} Pflichtkriterien sind offen oder nicht bestanden.`);
  if (unresolved.length) reasons.push(`${unresolved.length} wesentliche/blockierende Probleme sind offen.`);
  return {
    allowed: reasons.length === 0,
    reasons,
    completed: criteria.filter(
      (criterion) => (itemMap.get(criterion.id)?.result ?? 'pending') !== 'pending',
    ).length,
    total: criteria.length,
  };
}
