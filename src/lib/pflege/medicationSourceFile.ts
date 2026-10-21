type Row = Record<string, unknown>;
// Compare the entire retained original. Object key order has no version meaning;
// nested values, array order, native identities and raw timestamps remain exact.
function sameMedicationSourceOriginal(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  }
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const left = a as Row, right = b as Row, keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && sameMedicationSourceOriginal(left[key], right[key]));
}
export type MedicationSourceFileScope = { tenantId: string; clientId: string; medicationId: string; linkId: string };
type Gateway = { readLink(): Promise<Row | null>; readDocument(id: string): Promise<Row | null>; download(path: string): Promise<Blob>; isCurrent(): boolean };
export type MedicationSourceFingerprint = { documentId: string; documentUpdatedAt: string; storagePath: string; sha256: string; sizeBytes: number };
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const row = (v: unknown): Row | null => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Row : null;
function linkedDocument(scope: MedicationSourceFileScope, link: Row | null): Row {
  const d = row(link?.document_snapshot), m = row(link?.order_snapshot);
  if (!link || link.id !== scope.linkId || link.tenant_id !== scope.tenantId || link.client_id !== scope.clientId || link.medication_id !== scope.medicationId || !d || !m || !uuid(d.id) || link.document_id !== d.id || m.id !== scope.medicationId || m.tenant_id !== scope.tenantId || m.client_id !== scope.clientId) throw Error('Quellenzuordnung nicht mehr zugänglich oder unvollständig.');
  return d;
}
function assertDocument(scope: MedicationSourceFileScope, snapshot: Row, doc: Row | null): asserts doc is Row {
  if (!doc || doc.id !== snapshot.id || doc.tenant_id !== scope.tenantId || doc.client_id !== scope.clientId || doc.status !== 'aktiv') throw Error('Die Quelldatei ist nicht mehr als aktives Dokument dieser Klientenakte zugänglich.');
  const prefix = `tenant/${scope.tenantId}/clients/${scope.clientId}/documents/`;
  if (typeof snapshot.storage_path !== 'string' || !snapshot.storage_path.startsWith(prefix) || !snapshot.storage_path.slice(prefix.length) || snapshot.storage_path.includes('..') || /[\\%?#\u0000-\u001f]/.test(snapshot.storage_path)) throw Error('Dateipfad der Quelle ist nicht eindeutig dieser Klientenakte zugeordnet.');
  // Exact comparison preserves sub-millisecond differences; ambiguous representations fail closed.
  if (typeof snapshot.updated_at !== 'string' || !Number.isFinite(Date.parse(snapshot.updated_at)) || doc.updated_at !== snapshot.updated_at || doc.storage_path !== snapshot.storage_path || doc.file_name !== snapshot.file_name || doc.mime_type !== snapshot.mime_type) throw Error('Die Quelldatei wurde seit der Zuordnung geändert. Die damalige Fassung kann nicht bestätigt werden.');
  if (typeof snapshot.file_name !== 'string' || !snapshot.file_name.trim() || typeof snapshot.mime_type !== 'string' || !snapshot.mime_type.trim()) throw Error('Dateiname oder Dateityp der Quelle fehlt.');
}
export function medicationSourceDownloadName(name: string): string {
  return name.replace(/[\\/\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '_').slice(0, 180).trim() || 'Quelldokument';
}
export async function medicationFileDigest(blob: Blob, subtle: Pick<SubtleCrypto, 'digest'> | null = globalThis.crypto?.subtle ?? null): Promise<string> {
  if (!(blob instanceof Blob) || blob.size <= 0 || blob.size > 52_428_800) throw Error('Quelldatei muss Daten enthalten und darf höchstens 50 MiB groß sein.');
  if (!subtle) throw Error('Die Inhaltsprüfung benötigt einen Browser mit sicherem HTTPS-Zugriff.');
  const digest = await subtle.digest('SHA-256', await blob.arrayBuffer());
  if (digest.byteLength !== 32) throw Error('Der Inhaltsfingerabdruck konnte nicht bestätigt werden.');
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
export async function loadMedicationSourceCandidate(scope: Omit<MedicationSourceFileScope, 'linkId'>, snapshot: Row, gateway: Omit<Gateway, 'readLink'>): Promise<MedicationSourceFingerprint> {
  if (![scope.tenantId, scope.clientId, scope.medicationId, snapshot.id].every(uuid)) throw Error('Ungültige Dokumentzuordnung.');
  const current = () => { if (!gateway.isCurrent()) throw Error('Dateiabruf wurde abgebrochen.'); };
  current(); const doc = await gateway.readDocument(snapshot.id as string); current(); assertDocument({...scope, linkId: ''}, snapshot, doc);
  const blob = await gateway.download(snapshot.storage_path as string); current();
  const sha256 = await medicationFileDigest(blob); current();
  const latestDoc = await gateway.readDocument(snapshot.id as string); current(); assertDocument({...scope, linkId: ''}, snapshot, latestDoc);
  return {documentId: snapshot.id as string, documentUpdatedAt: snapshot.updated_at as string, storagePath: snapshot.storage_path as string, sha256, sizeBytes: blob.size};
}
// Rechecks metadata after downloading. This is not an immutable content-version guarantee.
export async function loadMedicationSourceFile(scope: MedicationSourceFileScope, gateway: Gateway): Promise<{ blob: Blob; fileName: string; fingerprintVerified: boolean }> {
  if (![scope.tenantId, scope.clientId, scope.medicationId, scope.linkId].every(uuid)) throw Error('Ungültige Quellenzuordnung.');
  const current = () => { if (!gateway.isCurrent()) throw Error('Dateiabruf wurde abgebrochen.'); };
  current(); const originalLink = structuredClone(await gateway.readLink()); current();
  const snapshot = linkedDocument(scope, originalLink);
  const doc = await gateway.readDocument(snapshot.id as string); current(); assertDocument(scope, snapshot, doc);
  const blob = await gateway.download(snapshot.storage_path as string); current();
  if (!(blob instanceof Blob) || blob.size === 0) throw Error('Die Quelldatei ist leer oder konnte nicht geladen werden.');
  const sha256 = await medicationFileDigest(blob); current();
  const hasFingerprint = snapshot.content_sha256 != null || snapshot.content_size != null;
  if (hasFingerprint && (typeof snapshot.content_sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(snapshot.content_sha256) || !Number.isSafeInteger(snapshot.content_size) || snapshot.content_size !== blob.size || snapshot.content_sha256 !== sha256)) throw Error('Der Dateiinhalt stimmt nicht mit dem bei der Zuordnung erfassten Fingerabdruck überein. Datei nicht als damalige Quelle verwenden.');
  const latestDoc = await gateway.readDocument(snapshot.id as string); current(); assertDocument(scope, snapshot, latestDoc);
  const latestLink = await gateway.readLink(); current();
  linkedDocument(scope, latestLink);
  if (!sameMedicationSourceOriginal(originalLink, latestLink)) throw Error('Die Quellenzuordnung wurde während des Abrufs geändert.');
  // Never render arbitrary uploads as active HTML in the application origin.
  return { blob: new Blob([blob], { type: 'application/octet-stream' }), fileName: medicationSourceDownloadName(snapshot.file_name as string), fingerprintVerified: hasFingerprint };
}

function archiveInstant(value: unknown): bigint | null {
  if (typeof value !== 'string') return null;
  const parts = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!parts) return null;
  const [, year, month, day, hour, minute, second, fraction = '', zone] = parts;
  const calendar = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (calendar.getUTCFullYear() !== Number(year) || calendar.getUTCMonth() !== Number(month) - 1 || calendar.getUTCDate() !== Number(day) || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59 || (zone !== 'Z' && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4)) > 59))) return null;
  const milliseconds = Date.parse(value.replace(' ', 'T'));
  return Number.isFinite(milliseconds) ? BigInt(milliseconds) * 1000n + BigInt(fraction.padEnd(6, '0').slice(3)) : null;
}

type ArchiveGateway = Gateway & { readArchive(): Promise<Row | null>; downloadArchive(path: string): Promise<Blob> };
export type MedicationSourceDownload = { blob: Blob; fileName: string; fingerprintVerified: boolean; origin: 'archive' | 'document' };
// A ready archive is the historical source. Failure must never substitute current document bytes.
export async function loadMedicationSourceWithArchive(scope: MedicationSourceFileScope, gateway: ArchiveGateway): Promise<MedicationSourceDownload> {
  if (![scope.tenantId, scope.clientId, scope.medicationId, scope.linkId].every(uuid)) throw Error('Ungültige Quellenzuordnung.');
  const current = () => { if (!gateway.isCurrent()) throw Error('Dateiabruf wurde abgebrochen.'); };
  current(); const archive = structuredClone(await gateway.readArchive()); current();
  if (!archive) return { ...await loadMedicationSourceFile(scope, gateway), origin: 'document' };
  const originalLink = structuredClone(await gateway.readLink()); current();
  const snapshot = linkedDocument(scope, originalLink);

  assertMedicationSourceArchive(scope, archive, snapshot);
  const blob = await gateway.downloadArchive(archive.archive_path as string); current();
  const digest = await medicationFileDigest(blob); current();
  if (digest !== archive.content_sha256 || blob.size !== archive.content_size) throw Error('Archivinhalt stimmt nicht mit dem gespeicherten Fingerabdruck überein.');
  const latestLink = await gateway.readLink(); current();
  const latestSnapshot = linkedDocument(scope, latestLink);
  if (!sameMedicationSourceOriginal(originalLink, latestLink)) throw Error('Die Quellenzuordnung wurde während des Abrufs geändert.');
  const latestArchive = await gateway.readArchive(); current(); assertMedicationSourceArchive(scope, latestArchive, latestSnapshot);
  if (!sameMedicationSourceOriginal(archive, latestArchive)) throw Error('Der Archivstand wurde während des Abrufs geändert.');
  return { blob: new Blob([blob], { type: 'application/octet-stream' }), fileName: medicationSourceDownloadName(snapshot.file_name as string), fingerprintVerified: true, origin: 'archive' };
}

export function assertMedicationSourceArchive(scope: MedicationSourceFileScope, candidate: Row | null, source: Row): asserts candidate is Row {
    if (!source || ![scope.tenantId, scope.clientId, scope.medicationId, scope.linkId, source.id].every(uuid)) throw Error('Archivquelle oder Aktenzuordnung ist unvollständig.');
    const sourceInstant = archiveInstant(source.updated_at);
    if (!candidate || !uuid(candidate.id) || candidate.status !== 'ready' || candidate.tenant_id !== scope.tenantId || candidate.client_id !== scope.clientId || candidate.medication_id !== scope.medicationId || candidate.source_id !== scope.linkId || candidate.document_id !== source.id || !uuid(candidate.finalized_by) || archiveInstant(candidate.finalized_at) === null || sourceInstant === null || archiveInstant(candidate.document_version) !== sourceInstant || candidate.original_path !== source.storage_path || typeof source.content_sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(source.content_sha256) || !Number.isSafeInteger(source.content_size) || Number(source.content_size) <= 0 || Number(source.content_size) > 52_428_800 || candidate.content_sha256 !== source.content_sha256 || candidate.content_size !== source.content_size || candidate.archive_path !== `tenant/${scope.tenantId}/clients/${scope.clientId}/medication-sources/${scope.linkId}/${source.content_sha256}.bin` || typeof source.file_name !== 'string' || !source.file_name.trim()) throw Error('Archivkopie ist nicht eindeutig als bereitgestellte historische Quelle bestätigt.');
  };
