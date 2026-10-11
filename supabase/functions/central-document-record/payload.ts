type Snapshot = {
  context: { tenantId: string; target: string; entityId: string; company: Record<string,string>; subject: Record<string,string>; representative: Record<string,string>; payor: Record<string,string>; employee: Record<string,string>; sourceFetchedAt:string };
  documentId: string; revision: number; parentDocumentId?: string;
  definition: { key: string; version: number; target: string; sourceMode: string; fields: { key: string; required: boolean }[]; columns:string[]; sections:{key:string;heading:string;text:string}[] };
  values: Record<string, string>;
  fieldOrigins: Record<string,string>; tableRows:string[][]; sectionTexts:Record<string,string>; additionalText:string; createdAt:string;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const stringMap = (value:unknown):value is Record<string,string> => !!value && typeof value==='object' && !Array.isArray(value) && Object.values(value).every((v)=>typeof v==='string');
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value as object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(',')}}`;
}
export function validateCentralPayload(body: Record<string, unknown>): { ok: false; error: string } | { ok: true; data: { snapshot: Snapshot; pdfBase64: string; original: { base64: string; fileName: string } | null } } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Ungültige Anfrage.' };
  const snapshot = body.snapshot as Snapshot | undefined;
  if (!snapshot || !UUID.test(snapshot.documentId ?? '') || !UUID.test(snapshot.context?.tenantId ?? '') || !UUID.test(snapshot.context?.entityId ?? '') || !['client','employee','company'].includes(snapshot.context?.target) || snapshot.definition?.target !== snapshot.context.target) return { ok: false, error: 'Dokument-ID oder Aktenzuordnung ungültig.' };
  if (!Number.isInteger(snapshot.revision) || snapshot.revision < 1 || (snapshot.parentDocumentId && !UUID.test(snapshot.parentDocumentId)) || !/^csdc_[a-z]+_\d{3}$/.test(snapshot.definition.key) || !Number.isInteger(snapshot.definition.version) || snapshot.definition.version < 1) return { ok: false, error: 'Ungültige Dokumentfassung.' };
  if (snapshot.context.target === 'company' && snapshot.context.entityId !== snapshot.context.tenantId) return { ok: false, error: 'Unternehmenszuordnung ungültig.' };
  if (!snapshot.values || typeof snapshot.values !== 'object' || Array.isArray(snapshot.values) || Object.values(snapshot.values).some((v) => typeof v !== 'string') || !Array.isArray(snapshot.definition.fields) || snapshot.definition.fields.some((f) => !f || typeof f.key !== 'string' || typeof f.required !== 'boolean' || (f.required && !snapshot.values[f.key]?.trim()))) return { ok: false, error: 'Pflichtangaben fehlen.' };
  if (!['company','subject','representative','payor','employee'].every((key)=>stringMap(snapshot.context[key as keyof Snapshot['context']])) || typeof snapshot.context.sourceFetchedAt!=='string' || !Number.isFinite(Date.parse(snapshot.context.sourceFetchedAt)) || typeof snapshot.createdAt!=='string' || !Number.isFinite(Date.parse(snapshot.createdAt))) return {ok:false,error:'Stammdatenübernahme ungültig.'};
  if (!stringMap(snapshot.fieldOrigins) || Object.values(snapshot.fieldOrigins).some((v)=>!['stored','manual','default','empty'].includes(v)) || !stringMap(snapshot.sectionTexts) || typeof snapshot.additionalText!=='string' || !Array.isArray(snapshot.definition.columns) || snapshot.definition.columns.some((v)=>typeof v!=='string') || !Array.isArray(snapshot.definition.sections) || snapshot.definition.sections.some((v)=>!v || typeof v.key!=='string' || typeof v.heading!=='string' || typeof v.text!=='string') || !Array.isArray(snapshot.tableRows) || snapshot.tableRows.length>1500 || snapshot.tableRows.some((row)=>!Array.isArray(row) || row.length!==snapshot.definition.columns.length || row.some((v)=>typeof v!=='string'))) return {ok:false,error:'Textabschnitte oder Tabelleninhalt ungültig.'};
  if (JSON.stringify(snapshot).length > 1000000 || typeof body.pdfBase64 !== 'string' || body.pdfBase64.length > 12 * 1024 * 1024) return { ok: false, error: 'Dokumentinhalt fehlt oder ist zu groß.' };
  const original = body.original as { base64: string; fileName: string } | null;
  if ((snapshot.definition.sourceMode === 'original' && !original && !snapshot.parentDocumentId) || (original && (typeof original.base64 !== 'string' || original.base64.length > 12 * 1024 * 1024))) return { ok: false, error: 'Originalunterlage fehlt oder ist zu groß.' };
  return { ok: true, data: { snapshot, pdfBase64: body.pdfBase64, original } };
}
export function decodePdf(base64: string): Uint8Array {
  const binary = atob(base64); if (binary.length > 8 * 1024 * 1024) throw new Error('PDF zu groß');
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const beginning = new TextDecoder().decode(bytes.subarray(0, 8));
  const ending = new TextDecoder().decode(bytes.subarray(Math.max(0, bytes.length - 1024)));
  if (!beginning.startsWith('%PDF-') || !ending.includes('%%EOF')) throw new Error('Keine PDF-Datei');
  return bytes;
}
export function mapStoredRecord(r: Record<string, unknown>) {
  return { id: r.id, tenantId: r.tenant_id, title: r.title, templateKey: r.template_key, revision: r.revision, snapshot: r.snapshot_json, state: r.state, pdfPath: r.pdf_path, pdfHash: r.pdf_hash, originalPath: r.original_path, originalHash: r.original_hash, createdAt: r.created_at };
}
