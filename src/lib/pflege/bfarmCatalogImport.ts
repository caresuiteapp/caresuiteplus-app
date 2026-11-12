import type { MedicationPackageInput } from './medicationMasterData';

export type CatalogSourceFile = Readonly<{ name: string; text: string }>;

const tables = [
  'REFERENCE_MEDICINAL_PRODUCT',
  'REFERENCE_PHARMACEUTICAL_PRODUCT',
  'REFERENCE_SUBSTANCE',
] as const;
type Table = typeof tables[number];

export const MAX_CATALOG_FILE_BYTES = 64 * 1024 * 1024;
export const MAX_CATALOG_ROWS = 250_000;

function fail(message: string): never { throw new Error(message); }

function pznKey(value: string): string {
  // The official DSV key is an integer. Restore leading zeros before joining.
  if (!/^\d{1,8}$/.test(value)) fail('Ungültige PZN in der BfArM-Datei.');
  const pzn = value.padStart(8, '0');
  const sum = [...pzn.slice(0, 7)].reduce((acc, digit, i) => acc + Number(digit) * (i + 1), 0);
  if (pzn === '00000000' || sum % 11 !== Number(pzn[7])) fail('Ungültige PZN-Prüfziffer in der BfArM-Datei.');
  return pzn;
}

function componentKey(value: string): string {
  const match = /^(\d{1,8})-(\d{1,3})$/.exec(value);
  if (!match || Number(match[2]) < 1) fail('Ungültiger Komponentenschlüssel in der BfArM-Datei.');
  return `${pznKey(match[1])}-${Number(match[2])}`;
}

function dsv(file: CatalogSourceFile, required: readonly string[], visit: (get: (key: string) => string) => void) {
  if (!file.text.length || file.text.length > MAX_CATALOG_FILE_BYTES || /\u0000|\ufffd/.test(file.text)) {
    fail('Die BfArM-Datei ist leer, zu groß oder nicht als UTF-8 lesbar.');
  }
  const lines = file.text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const headers = lines[0].split('|');
  const columns = new Map(headers.map((name, i) => [name, i]));
  if (columns.size !== headers.length || required.some(name => !columns.has(name))) {
    fail(`Spalten der BfArM-Datei ${file.name} stimmen nicht mit dem erwarteten Format überein.`);
  }
  let count = 0;
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i] && i === lines.length - 1) continue;
    const fields = lines[i].split('|');
    if (fields.length !== headers.length || fields.some(value => value.includes('\r'))) {
      fail(`Ungültige DSV-Zeile ${i + 1} in ${file.name}.`);
    }
    if (++count > MAX_CATALOG_ROWS * 5) fail('Die BfArM-Lieferung überschreitet die Importgrenze.');
    visit(key => { const index = columns.get(key); return index === undefined ? '' : fields[index].trim(); });
  }
  if (!count) fail(`Keine Datensätze in ${file.name}.`);
}

/** Join the three official files without inferring administration instructions. */
export function parseBfarmCatalog(files: readonly CatalogSourceFile[]): {
  source: string; sourceVersion: string; rows: MedicationPackageInput[];
} {
  if (files.length !== 3) fail('Bitte alle drei DSV-Dateien derselben BfArM-Lieferung auswählen.');
  const inputs = new Map<Table, CatalogSourceFile>();
  let version = '';
  for (const file of files) {
    const match = /^(\d{4})(\d{2})(\d{2})-(REFERENCE_[A-Z_]+)\.dsv$/i.exec(file.name);
    const table = match?.[4].toUpperCase() as Table | undefined;
    if (!match || !table || !tables.includes(table) || inputs.has(table)) fail('Die drei originalen BfArM-Dateinamen werden benötigt.');
    const date = `${match[1]}-${match[2]}-${match[3]}`;
    const time = new Date(`${date}T00:00:00Z`);
    if (!Number.isFinite(time.getTime()) || time.toISOString().slice(0, 10) !== date || (version && version !== date)) {
      fail('Die BfArM-Dateien müssen dasselbe gültige Lieferdatum tragen.');
    }
    version = date;
    inputs.set(table, file);
  }

  type Substance = { name: string; strength: string; rank: number };
  type Product = { row: MedicationPackageInput; parts: Map<string, Substance[]>; combined: boolean };
  const products = new Map<string, Product>();
  const components = new Map<string, Substance[]>();
  dsv(inputs.get(tables[0])!, ['RMP_KEY', 'RMP_PZN', 'RMP_MPD_NAME', 'RMP_PFM_NAME', 'RMP_MULTIPLE_PPT'], get => {
    const pzn = pznKey(get('RMP_PZN'));
    const combined = get('RMP_MULTIPLE_PPT');
    if (pznKey(get('RMP_KEY')) !== pzn || products.has(pzn) || !['0', '1'].includes(combined)) {
      fail('Doppelte oder widersprüchliche Präparate in der BfArM-Lieferung.');
    }
    if (products.size >= MAX_CATALOG_ROWS) fail('Die BfArM-Lieferung überschreitet die Importgrenze.');
    products.set(pzn, { row: { pzn, name: get('RMP_MPD_NAME') || `PZN ${pzn}`,
      dosageForm: get('RMP_PFM_NAME') || get('RMP_PFM_PUT_LONG') || null }, parts: new Map(), combined: combined === '1' });
  });
  dsv(inputs.get(tables[1])!, ['RPP_KEY', 'RMP_KEY', 'RPP_NUMBER'], get => {
    const pzn = pznKey(get('RMP_KEY')), key = componentKey(get('RPP_KEY')), number = get('RPP_NUMBER');
    const product = products.get(pzn);
    if (!product || !/^\d{1,3}$/.test(number) || key !== `${pzn}-${Number(number)}` || components.has(key)) {
      fail('Eine BfArM-Komponente ist doppelt oder keinem Präparat zugeordnet.');
    }
    const rows: Substance[] = [];
    components.set(key, rows);
    product.parts.set(key, rows);
  });
  dsv(inputs.get(tables[2])!, ['RSE_KEY', 'RPP_KEY', 'RSE_SUBSTANCE_NAME', 'RSE_SUBSTANCE_STRENGTH', 'RSE_SUBSTANCE_RANK'], get => {
    const key = componentKey(get('RPP_KEY')), rows = components.get(key), rank = Number(get('RSE_SUBSTANCE_RANK'));
    const rawKey = /^(\d{1,8}-\d{1,3})-(\d{1,3})$/.exec(get('RSE_KEY'));
    if (!rows || !rawKey || componentKey(rawKey[1]) !== key || Number(rawKey[2]) !== rank || !Number.isInteger(rank) || rank < 1 || rank > 999 || rows.some(row => row.rank === rank)) {
      fail('Ein BfArM-Wirkstoff ist doppelt oder keiner Komponente zugeordnet.');
    }
    rows.push({ name: get('RSE_SUBSTANCE_NAME'), strength: get('RSE_SUBSTANCE_STRENGTH'), rank });
  });

  const rows = [...products.values()].map(({ row, parts, combined }) => {
    if (!parts.size || (parts.size > 1) !== combined) fail('Die drei BfArM-Dateien ergeben keine vollständige Lieferung.');
    const substances = [...parts.values()].flatMap(part => [...part].sort((a, b) => a.rank - b.rank));
    const names = [...new Set(substances.map(part => part.name).filter(Boolean))];
    const strength = !combined && substances.length && substances.every(part => part.name && part.strength)
      ? (substances.length === 1 ? substances[0].strength : substances.map(part => `${part.name}: ${part.strength}`).join(' · ')) : null;
    // A combination pack can contain different strengths per component.
    // No single strength, brand, manufacturer, dose or route is derived for it.
    return { ...row, ingredient: names.join(' · ') || null, strength };
  });
  return { source: 'bfarm-31b', sourceVersion: version, rows };
}
