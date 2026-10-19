import { blankCase, isDate, type BillingCase, type Issue, type ServiceLine } from './model';
import { newLine, parseHundredths } from './editor';

export type SourceRow = Record<string, unknown>;
export type InvoiceSnapshot = SourceRow & { items: SourceRow[]; records: SourceRow[]; proofs: SourceRow[]; client: SourceRow };
export const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const row = (value: unknown): value is SourceRow => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const text = (value: unknown) => typeof value === 'string' ? value : '';
export const normalizeHash = (value: unknown) => text(value).replace(/^sha256:/, '');
const amount = (value: unknown) => typeof value === 'number' || typeof value === 'string' ? parseHundredths(String(value)) : NaN;
const sameSet = (a: unknown, b: unknown): boolean => Array.isArray(a) && Array.isArray(b)
  && a.every(x => typeof x === 'string') && b.every(x => typeof x === 'string')
  && new Set(a).size === a.length && new Set(b).size === b.length && a.length === b.length && a.every(x => b.includes(x));

/** Validate the entire bounded RPC response, never accept a partial financial selection. */
export function readSourceSnapshot(value: unknown, tenantId: string, ids: string[]): InvoiceSnapshot[] {
  if (!row(value) || value.version !== 'gkv-invoice-source-v1' || !Array.isArray(value.invoices)
    || value.invoices.length !== ids.length || new Set(ids).size !== ids.length) throw new Error('Rechnungsquellen konnten nicht vollständig geladen werden.');
  const seen = new Set<string>();
  for (const v of value.invoices) {
    if (!row(v) || !UUID.test(text(v.id)) || !ids.includes(text(v.id)) || seen.has(text(v.id)) || v.tenant_id !== tenantId
      || !Array.isArray(v.items) || !v.items.length || v.items.length > 1000 || !v.items.every(row)
      || !Array.isArray(v.records) || v.records.length > 1000 || !v.records.every(row)
      || !Array.isArray(v.proofs) || v.proofs.length > 30 || !v.proofs.every(row)
      || !row(v.client) || v.client.tenant_id !== tenantId || v.client.id !== v.client_id
      || !sameSet(v.selected_proof_ids, v.proofs.map(p => p.id)) || v.proofs.some(p => !text(p.id).startsWith('record:') || !UUID.test(text(p.id).slice(7)))) throw new Error('Die Rechnungsquelle oder ihre Nachweisauswahl ist unvollständig.');
    seen.add(text(v.id));
    const itemIds = new Set<string>(); const recordIds = new Set<string>();
    for (const item of v.items) {
      if (!UUID.test(text(item.id)) || itemIds.has(text(item.id)) || item.tenant_id !== tenantId || item.invoice_id !== v.id) throw new Error('Rechnungsposition ist doppelt oder falsch zugeordnet.');
      itemIds.add(text(item.id));
    }
    for (const record of v.records) {
      if (!UUID.test(text(record.id)) || recordIds.has(text(record.id)) || record.tenant_id !== tenantId || record.client_id !== v.client_id) throw new Error('Leistungsquelle ist doppelt oder falsch zugeordnet.');
      recordIds.add(text(record.id));
    }
  }
  return value.invoices as InvoiceSnapshot[];
}
export function importInvoiceCase(source: InvoiceSnapshot, month: string): BillingCase {
  if (['draft','cancelled'].includes(text(source.status)) || !isDate(source.invoice_date)) throw new Error('Bitte eine ausgestellte Rechnung mit gültigem Datum auswählen.');
  const c = blankCase(month, source.invoice_date);
  Object.assign(c, { sourceInvoiceId: source.id, sourceUpdatedAt: source.updated_at, clientId: source.client_id,
    invoiceNumber: source.invoice_number, proofIds: [...source.selected_proof_ids as string[]],
    sourceProofs: source.proofs.map(p => ({recordId:text(p.id).replace(/^record:/,''),updatedAt:text(p.updated_at),pdfSha256:normalizeHash(p.sha256)})),
    firstName:text(source.client.first_name), lastName:text(source.client.last_name), birthDate:text(source.client.date_of_birth),
    insuranceNumber:text(source.client.insurance_number), careGrade:text(source.client.care_level),
    street:text(source.client.street), houseNumber:text(source.client.house_number), postalCode:text(source.client.postal_code), city:text(source.client.city),
  });
  c.lines = [...source.items].sort((a,b) => Number(a.sort_order) - Number(b.sort_order) || text(a.id).localeCompare(text(b.id))).map(item => {
    if (!isDate(item.service_date) || item.service_date.slice(0,7) !== month) throw new Error('Alle übernommenen Positionen müssen im gewählten Leistungsmonat liegen.');
    if (amount(item.vat_amount) !== 0 || amount(item.vat_rate) !== 0 || amount(item.net_amount) !== amount(item.gross_amount)) throw new Error('Dieses Profil unterstützt nur vollständig umsatzsteuerbefreite Rechnungspositionen.');
    const record = source.records.find(r => r.id === item.service_record_id);
    const line: ServiceLine = { ...newLine(), sourceItemId:text(item.id), sourceItemUpdatedAt:text(item.updated_at),
      sourceDescription:text(item.description), sourceId:text(item.service_record_id) || undefined,
      sourceRecordUpdatedAt:record ? text(record.updated_at) : undefined, day:item.service_date.slice(8),
      unitPriceCents:amount(item.unit_price), quantityHundredths:amount(item.quantity), totalCents:amount(item.gross_amount) };
    if (![line.unitPriceCents,line.quantityHundredths,line.totalCents].every(Number.isSafeInteger)) throw new Error('Ein Rechnungsbetrag hat eine nicht unterstützte Genauigkeit.');
    return line;
  });
  c.grossCents = c.lines.reduce((sum,l) => sum + l.totalCents,0);
  if (c.grossCents !== amount(source.total_amount)) throw new Error('Die Quellrechnung stimmt nicht mit ihren Positionsbeträgen überein.');
  return c;
}

export function verifyCaseSources(c: BillingCase, source: InvoiceSnapshot): Issue[] {
  const issues: Issue[] = [];
  const add = (path:string,message:string) => issues.push({path,message,severity:'error'});
  if (source.id !== c.sourceInvoiceId || !c.sourceUpdatedAt || source.updated_at !== c.sourceUpdatedAt
    || ['draft','cancelled'].includes(text(source.status)) || source.invoice_number !== c.invoiceNumber
    || source.invoice_date !== c.invoiceDate || source.client_id !== c.clientId || amount(source.total_amount) !== c.grossCents) add('sourceInvoiceId','Quellrechnung geändert oder falsch zugeordnet. Bitte erneut übernehmen.');
  if (c.firstName !== text(source.client.first_name) || c.lastName !== text(source.client.last_name)
    || c.birthDate !== text(source.client.date_of_birth) || c.insuranceNumber !== text(source.client.insurance_number)) add('clientId','Die versicherte Person stimmt nicht mit der aktuellen Klientenakte überein. Bitte erneut übernehmen.');
  if (!sameSet(c.lines.map(l => l.sourceItemId), source.items.map(i => i.id))) add('lines','Alle Rechnungspositionen müssen genau einmal zugeordnet sein. Bitte die Rechnung erneut übernehmen.');
  let gross = 0;
  for (const [index,l] of c.lines.entries()) {
    const item = source.items.find(i => i.id === l.sourceItemId);
    if (!item) continue;
    gross += amount(item.gross_amount);
    if (!l.sourceItemUpdatedAt || item.updated_at !== l.sourceItemUpdatedAt || item.service_date !== `${c.month}-${l.day}`
      || amount(item.gross_amount) !== l.totalCents || amount(item.net_amount) !== l.totalCents || amount(item.vat_amount) !== 0
      || amount(item.vat_rate) !== 0 || (item.service_record_id || undefined) !== l.sourceId) add(`lines.${index}`,'Rechnungsposition, Datum, Steuer oder Betrag wurde geändert oder stimmt nicht überein.');
    if (l.sourceId) {
      const record = source.records.find(r => r.id === l.sourceId);
      if (!record || !l.sourceRecordUpdatedAt || record.updated_at !== l.sourceRecordUpdatedAt
        || record.service_date !== item.service_date || !['approved','billable','billed'].includes(text(record.status))
        || record.billed_invoice_id && record.billed_invoice_id !== source.id) add(`lines.${index}.sourceId`,'Die zugehörige Leistung wurde geändert oder ist nicht für diese Rechnung freigegeben.');
      if (record && l.remuneration === '02' && (Number(l.duration) !== Number(record.billable_minutes) || l.quantityHundredths !== 100)) add(`lines.${index}.duration`,'Zeitposition muss der bestätigten abrechenbaren Dauer eines Leistungsdatensatzes entsprechen.');
    }
  }
  if (!Number.isSafeInteger(gross) || gross !== c.grossCents) add('grossCents','Die vollständigen Rechnungspositionen ergeben einen anderen Gesamtbetrag.');
  if (!sameSet(c.proofIds || [], source.selected_proof_ids)) add('proofIds','Die Auswahl der Leistungsnachweise wurde geändert. Bitte erneut übernehmen.');
  const proofs = c.sourceProofs;
  if (!Array.isArray(proofs) || !sameSet(proofs.map(p => p.recordId), source.proofs.map(p => text(p.id).replace(/^record:/,'')))) add('sourceProofs','Die gespeicherten Nachweisreferenzen sind unvollständig. Bitte erneut übernehmen.');
  else for (const proof of source.proofs) {
    const saved = proofs.find(p => `record:${p.recordId}` === proof.id);
    if (!saved || saved.updatedAt !== proof.updated_at || saved.pdfSha256 !== normalizeHash(proof.sha256)
      || !/^[a-f0-9]{64}$/.test(saved.pdfSha256) || !isDate(proof.service_date) || proof.service_date.slice(0,7) !== c.month) add('sourceProofs','Ein Originalnachweis wurde geändert oder liegt außerhalb des Leistungsmonats.');
  }
  return issues;
}

/** Only canonical tenant paths from the verified RPC are downloadable; never URLs. */
export function proofStoragePath(proof: SourceRow, tenantId: string): string {
  const path = text(proof.path);
  if (!path.startsWith(`tenant/${tenantId}/`) || path.includes('..') || /[\\%?#\x00-\x20\x7f]/.test(path)
    || path.split('/').some(part => !part) || !/^[a-f0-9]{64}$/.test(normalizeHash(proof.sha256))) throw new Error('Der Originalnachweis hat einen ungültigen Speicherverweis.');
  return path;
}
