export type AnatomicalLaterality = 'links' | 'rechts' | 'mittig' | 'beidseits' | 'nicht_anwendbar';

export type AnatomicalZone = {
  id: string;
  label: string;
  parentId: string | null;
  laterality: AnatomicalLaterality;
  meshTags: readonly string[];
  clinicalTags: readonly string[];
  sensitive?: boolean;
  pressureRisk?: boolean;
};

const zone = (
  id: string,
  label: string,
  parentId: string | null,
  options: Partial<Omit<AnatomicalZone, 'id' | 'label' | 'parentId'>> = {},
): AnatomicalZone => ({
  id,
  label,
  parentId,
  laterality: options.laterality ?? 'nicht_anwendbar',
  meshTags: options.meshTags ?? [id],
  clinicalTags: options.clinicalTags ?? [],
  sensitive: options.sensitive,
  pressureRisk: options.pressureRisk,
});

const bilateral = (
  id: string,
  label: string,
  parentId: string,
  options: Partial<Omit<AnatomicalZone, 'id' | 'label' | 'parentId' | 'laterality'>> = {},
): AnatomicalZone[] => [
  zone(`${id}-links`, `${label} links`, parentId, { ...options, laterality: 'links' }),
  zone(`${id}-rechts`, `${label} rechts`, parentId, { ...options, laterality: 'rechts' }),
];

export const ANATOMICAL_ZONES: readonly AnatomicalZone[] = [
  zone('koerper', 'Körper', null),

  zone('kopf', 'Kopf', 'koerper'),
  zone('hinterkopf', 'Hinterkopf', 'kopf', { pressureRisk: true, clinicalTags: ['dekubitus'] }),
  zone('scheitel', 'Scheitel', 'kopf'),
  zone('stirn', 'Stirn', 'kopf', { pressureRisk: true }),
  ...bilateral('schlaefe', 'Schläfe', 'kopf'),
  zone('gesicht', 'Gesicht', 'kopf'),
  ...bilateral('wange', 'Wange', 'gesicht', { pressureRisk: true }),
  zone('nase', 'Nase', 'gesicht', { pressureRisk: true, clinicalTags: ['medizinprodukt'] }),
  ...bilateral('nasenfluegel', 'Nasenflügel', 'nase', {
    pressureRisk: true,
    clinicalTags: ['medizinprodukt'],
  }),
  ...bilateral('auge', 'Auge', 'gesicht'),
  ...bilateral('oberlid', 'Oberlid', 'gesicht'),
  ...bilateral('unterlid', 'Unterlid', 'gesicht'),
  ...bilateral('ohr', 'Ohr', 'kopf', {
    pressureRisk: true,
    clinicalTags: ['dekubitus', 'medizinprodukt'],
  }),
  zone('mund', 'Mund', 'gesicht', { sensitive: true, clinicalTags: ['schleimhaut'] }),
  zone('oberlippe', 'Oberlippe', 'mund', {
    sensitive: true,
    pressureRisk: true,
    clinicalTags: ['schleimhaut', 'medizinprodukt'],
  }),
  zone('unterlippe', 'Unterlippe', 'mund', {
    sensitive: true,
    pressureRisk: true,
    clinicalTags: ['schleimhaut', 'medizinprodukt'],
  }),
  zone('mundhoehle', 'Mundhöhle', 'mund', { sensitive: true, clinicalTags: ['schleimhaut'] }),
  zone('zunge', 'Zunge', 'mundhoehle', { sensitive: true, clinicalTags: ['schleimhaut'] }),
  zone('zaehne', 'Zähne und Zahnfleisch', 'mundhoehle', {
    sensitive: true,
    clinicalTags: ['schleimhaut'],
  }),
  zone('kinn', 'Kinn', 'gesicht', { pressureRisk: true }),

  zone('hals', 'Hals', 'koerper'),
  zone('nacken', 'Nacken', 'hals'),
  zone('kehlkopfregion', 'Kehlkopfregion', 'hals'),
  ...bilateral('schluesselbein', 'Schlüsselbein', 'hals'),

  zone('oberkoerper', 'Oberkörper', 'koerper'),
  zone('brustkorb', 'Brustkorb', 'oberkoerper'),
  ...bilateral('brust', 'Brust', 'brustkorb', { sensitive: true, pressureRisk: true }),
  ...bilateral('brustwarze', 'Brustwarze', 'brustkorb', { sensitive: true }),
  zone('brustbein', 'Brustbein', 'brustkorb', { pressureRisk: true }),
  ...bilateral('rippen', 'Rippenbereich', 'brustkorb', { pressureRisk: true }),
  zone('oberer-ruecken', 'Oberer Rücken', 'oberkoerper'),
  ...bilateral('schulterblatt', 'Schulterblatt', 'oberer-ruecken', {
    pressureRisk: true,
    clinicalTags: ['dekubitus'],
  }),
  zone('wirbelsaeule-brust', 'Brustwirbelsäule', 'oberer-ruecken', { pressureRisk: true }),
  zone('bauch', 'Bauch', 'oberkoerper'),
  zone('oberbauch', 'Oberbauch', 'bauch'),
  zone('unterbauch', 'Unterbauch', 'bauch'),
  zone('bauchnabel', 'Bauchnabel', 'bauch'),
  ...bilateral('flanke', 'Flanke', 'bauch'),
  zone('unterer-ruecken', 'Unterer Rücken', 'oberkoerper'),
  zone('lendenwirbelsaeule', 'Lendenwirbelsäule', 'unterer-ruecken', {
    pressureRisk: true,
  }),

  zone('becken', 'Becken', 'koerper', { sensitive: true }),
  ...bilateral('beckenkamm', 'Beckenkamm', 'becken', {
    pressureRisk: true,
    clinicalTags: ['dekubitus'],
  }),
  zone('kreuzbein', 'Kreuzbein', 'becken', {
    pressureRisk: true,
    clinicalTags: ['dekubitus'],
  }),
  zone('steissbein', 'Steißbein', 'becken', {
    pressureRisk: true,
    clinicalTags: ['dekubitus'],
  }),
  ...bilateral('gesaess', 'Gesäß', 'becken', {
    sensitive: true,
    pressureRisk: true,
    clinicalTags: ['dekubitus'],
  }),
  ...bilateral('sitzbeinhoecker', 'Sitzbeinhöcker', 'becken', {
    sensitive: true,
    pressureRisk: true,
    clinicalTags: ['dekubitus'],
  }),
  zone('anogenitalregion', 'Anogenitalregion', 'becken', {
    sensitive: true,
    clinicalTags: ['schleimhaut', 'inkontinenz'],
  }),
  zone('anus', 'Analregion', 'anogenitalregion', {
    sensitive: true,
    clinicalTags: ['schleimhaut', 'inkontinenz'],
  }),
  zone('penis', 'Penis', 'anogenitalregion', {
    sensitive: true,
    pressureRisk: true,
    clinicalTags: ['schleimhaut', 'medizinprodukt', 'katheter'],
  }),
  zone('eichel', 'Eichel', 'penis', {
    sensitive: true,
    clinicalTags: ['schleimhaut', 'katheter'],
  }),
  zone('harnroehrenoeffnung-penis', 'Harnröhrenöffnung', 'penis', {
    sensitive: true,
    clinicalTags: ['schleimhaut', 'katheter'],
  }),
  zone('skrotum', 'Skrotum', 'anogenitalregion', {
    sensitive: true,
    pressureRisk: true,
  }),
  zone('vulva', 'Vulva', 'anogenitalregion', {
    sensitive: true,
    pressureRisk: true,
    clinicalTags: ['schleimhaut', 'medizinprodukt', 'katheter'],
  }),
  ...bilateral('labium-majus', 'Große Schamlippe', 'vulva', { sensitive: true }),
  ...bilateral('labium-minus', 'Kleine Schamlippe', 'vulva', {
    sensitive: true,
    clinicalTags: ['schleimhaut'],
  }),
  zone('klitorisregion', 'Klitorisregion', 'vulva', {
    sensitive: true,
    clinicalTags: ['schleimhaut'],
  }),
  zone('harnroehrenoeffnung-vulva', 'Harnröhrenöffnung', 'vulva', {
    sensitive: true,
    clinicalTags: ['schleimhaut', 'katheter'],
  }),
  zone('vaginaloeffnung', 'Vaginalöffnung', 'vulva', {
    sensitive: true,
    clinicalTags: ['schleimhaut'],
  }),

  zone('obere-extremitaeten', 'Obere Extremitäten', 'koerper'),
  ...bilateral('schulter', 'Schulter', 'obere-extremitaeten', { pressureRisk: true }),
  ...bilateral('oberarm', 'Oberarm', 'obere-extremitaeten'),
  ...bilateral('ellenbogen', 'Ellenbogen', 'obere-extremitaeten', {
    pressureRisk: true,
    clinicalTags: ['dekubitus'],
  }),
  ...bilateral('unterarm', 'Unterarm', 'obere-extremitaeten'),
  ...bilateral('handgelenk', 'Handgelenk', 'obere-extremitaeten', {
    pressureRisk: true,
    clinicalTags: ['medizinprodukt'],
  }),
  ...bilateral('handruecken', 'Handrücken', 'obere-extremitaeten'),
  ...bilateral('handflaeche', 'Handfläche', 'obere-extremitaeten'),
  ...bilateral('daumen', 'Daumen', 'obere-extremitaeten'),
  ...bilateral('zeigefinger', 'Zeigefinger', 'obere-extremitaeten'),
  ...bilateral('mittelfinger', 'Mittelfinger', 'obere-extremitaeten'),
  ...bilateral('ringfinger', 'Ringfinger', 'obere-extremitaeten'),
  ...bilateral('kleiner-finger', 'Kleiner Finger', 'obere-extremitaeten'),

  zone('untere-extremitaeten', 'Untere Extremitäten', 'koerper'),
  ...bilateral('huefte', 'Hüfte', 'untere-extremitaeten'),
  ...bilateral('trochanter', 'Trochanter', 'untere-extremitaeten', {
    pressureRisk: true,
    clinicalTags: ['dekubitus'],
  }),
  ...bilateral('oberschenkel-vorn', 'Oberschenkel vorne', 'untere-extremitaeten'),
  ...bilateral('oberschenkel-hinten', 'Oberschenkel hinten', 'untere-extremitaeten', {
    pressureRisk: true,
  }),
  ...bilateral('knie', 'Knie', 'untere-extremitaeten', { pressureRisk: true }),
  ...bilateral('kniekehle', 'Kniekehle', 'untere-extremitaeten', { pressureRisk: true }),
  ...bilateral('unterschenkel-vorn', 'Unterschenkel vorne', 'untere-extremitaeten'),
  ...bilateral('unterschenkel-hinten', 'Wade', 'untere-extremitaeten'),
  ...bilateral('innenknoechel', 'Innenknöchel', 'untere-extremitaeten', {
    pressureRisk: true,
    clinicalTags: ['dekubitus'],
  }),
  ...bilateral('aussenknoechel', 'Außenknöchel', 'untere-extremitaeten', {
    pressureRisk: true,
    clinicalTags: ['dekubitus'],
  }),
  ...bilateral('ferse', 'Ferse', 'untere-extremitaeten', {
    pressureRisk: true,
    clinicalTags: ['dekubitus'],
  }),
  ...bilateral('achillessehne', 'Achillessehnenbereich', 'untere-extremitaeten', {
    pressureRisk: true,
  }),
  ...bilateral('fussruecken', 'Fußrücken', 'untere-extremitaeten', { pressureRisk: true }),
  ...bilateral('fusssohle', 'Fußsohle', 'untere-extremitaeten', { pressureRisk: true }),
  ...bilateral('fussinnenkante', 'Fußinnenkante', 'untere-extremitaeten', {
    pressureRisk: true,
  }),
  ...bilateral('fussaussenkante', 'Fußaußenkante', 'untere-extremitaeten', {
    pressureRisk: true,
  }),
  ...bilateral('grosszehe', 'Großzehe', 'untere-extremitaeten', { pressureRisk: true }),
  ...bilateral('zweite-zehe', 'Zweite Zehe', 'untere-extremitaeten', { pressureRisk: true }),
  ...bilateral('dritte-zehe', 'Dritte Zehe', 'untere-extremitaeten', { pressureRisk: true }),
  ...bilateral('vierte-zehe', 'Vierte Zehe', 'untere-extremitaeten', { pressureRisk: true }),
  ...bilateral('kleine-zehe', 'Kleine Zehe', 'untere-extremitaeten', {
    pressureRisk: true,
  }),
];

export const ANATOMICAL_ZONE_BY_ID = new Map(
  ANATOMICAL_ZONES.map((entry) => [entry.id, entry] as const),
);

export const PRESSURE_RISK_ZONES = ANATOMICAL_ZONES.filter((entry) => entry.pressureRisk);

export function getAnatomicalZone(zoneId: string): AnatomicalZone | null {
  return ANATOMICAL_ZONE_BY_ID.get(zoneId) ?? null;
}

export function getAnatomicalPath(zoneId: string): AnatomicalZone[] {
  const path: AnatomicalZone[] = [];
  let current = getAnatomicalZone(zoneId);
  const visited = new Set<string>();
  while (current && !visited.has(current.id)) {
    path.unshift(current);
    visited.add(current.id);
    current = current.parentId ? getAnatomicalZone(current.parentId) : null;
  }
  return path;
}
