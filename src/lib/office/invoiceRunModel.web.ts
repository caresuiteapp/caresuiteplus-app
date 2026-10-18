import type { ServiceResult } from '@/types';
import { berlinDateKey } from '@/lib/employeeLogbook/employeeLogbookDate';
import {
  calculateOfficeInvoiceLines, isOfficeInvoiceDate, validateOfficeInvoiceDraft,
  type InvoiceOfficeDraft, type OfficeInvoiceDraftLine, type OfficeInvoiceProductKey, type OfficeInvoiceRecipient,
} from './invoiceWorkspaceTypes.web';

export type InvoiceRunInput = {
  month: string;
  productKey?: OfficeInvoiceProductKey | 'all';
  clientId?: string;
  includeProofs: boolean;
  invoiceDate: string;
  dueDate?: string;
  /** Explicit choices override stored defaults only for this preview. */
  recipientIdsByClient?: Record<string, string>;
  taxRatePercent?: number;
  footerText?: string;
};
export type InvoiceRunRow = Record<string, unknown>;
export type InvoiceRunSourceData = {
  sources: InvoiceRunRow[];
  clients: InvoiceRunRow[];
  billingProfiles: InvoiceRunRow[];
  recipients: InvoiceRunRow[];
  settings: InvoiceRunRow[];
};
export type InvoiceRunGroup = {
  id: string; clientId: string; clientName: string; recipientName: string;
  sourceCount: number; totalCents: number | null; eligible: boolean;
  blockers: string[]; proofIds: string[]; draft: InvoiceOfficeDraft;
};
export type InvoiceRunPreview = {
  tenantId: string; month: string; start: string; end: string; createdAt: string;
  groups: InvoiceRunGroup[]; blockedCount: number; eligibleCount: number;
  alreadyBilledCount: number; excludedCount: number; totalCents: number;
};

const value = (row: InvoiceRunRow | undefined, key: string): string => typeof row?.[key] === 'string' ? (row[key] as string).trim() : '';
function number(row: InvoiceRunRow, key: string): number | null {
  const raw = row[key];
  if ((typeof raw !== 'number' && typeof raw !== 'string') || raw === '') return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}
function datePlusDays(date: string, days: number): string {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}
function blankRecipient(): OfficeInvoiceRecipient {
  return { name: '', street: '', houseNumber: '', postalCode: '', city: '', country: '', email: '' };
}
function validVat(rate: number | null | undefined): rate is number {
  return rate != null && Number.isFinite(rate) && rate >= 0 && rate <= 100 && Math.abs(rate * 100 - Math.round(rate * 100)) < 0.00001;
}
export function invoiceRunPeriod(month: string): { start: string; end: string } | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const start = `${month}-01`;
  if (!isOfficeInvoiceDate(start)) return null;
  const end = new Date(`${start}T12:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() + 1, 0);
  return { start, end: end.toISOString().slice(0, 10) };
}

/** Resolve only persisted billing choices and addresses, never a name-only payer guess. */
export function resolveOfficeInvoiceRunRecipient(client: InvoiceRunRow | undefined, profiles: InvoiceRunRow[], assignments: InvoiceRunRow[],
  period: { start: string; end: string }, selectedId?: string): {
  recipient: OfficeInvoiceRecipient; recipientType: InvoiceOfficeDraft['recipientType']; billingParty: InvoiceOfficeDraft['billingParty']; blockers: string[];
} {
  const blockers: string[] = [];
  if (profiles.length > 1) blockers.push('Mehrere Abrechnungsprofile sind hinterlegt. Bitte die Empfängerzuordnung prüfen.');
  const profileType = value(profiles[0], 'billing_type');
  if (profileType === 'kombi') blockers.push('Die Aufteilung zwischen Kostenträger und Eigenanteil muss vor der Abrechnung geprüft werden.');
  const profileParty: Record<string, InvoiceOfficeDraft['billingParty']> = { selbstzahler: 'self_payer', pflegekasse: 'care_insurance', beihilfe: 'other', sonstige: 'other' };
  const clientParty = value(client, 'billing_party');
  const billingParty: InvoiceOfficeDraft['billingParty'] = profileParty[profileType]
    ?? (['care_insurance', 'health_insurance', 'self_payer', 'social_welfare', 'other'].includes(clientParty) ? clientParty as InvoiceOfficeDraft['billingParty'] : 'other');
  const name = [value(client, 'first_name'), value(client, 'last_name')].filter(Boolean).join(' ');
  const namedRecipient = value(profiles[0], 'invoice_recipient');
  if (billingParty === 'self_payer' && !selectedId && (!namedRecipient || namedRecipient.toLocaleLowerCase('de') === name.toLocaleLowerCase('de'))) {
    return { recipientType: 'client', billingParty, blockers, recipient: { name, street: value(client, 'street'), houseNumber: value(client, 'house_number'),
      postalCode: value(client, 'postal_code'), city: value(client, 'city'), country: value(client, 'country'), email: value(client, 'email') } };
  }
  const carrierType = billingParty === 'social_welfare' ? 'social_welfare_office' : billingParty === 'self_payer' ? 'selbstzahler' : billingParty;
  const active = assignments.filter(row => !value(row, 'archived_at') && row.billing_relevant === true
    && (!value(row, 'valid_from') || value(row, 'valid_from') <= period.start)
    && (!value(row, 'valid_until') || value(row, 'valid_until') >= period.end)
    && (billingParty === 'other' || row.carrier_type === carrierType));
  const byName = namedRecipient ? active.filter(row => value(row, 'name_snapshot').toLocaleLowerCase('de') === namedRecipient.toLocaleLowerCase('de')) : [];
  if (namedRecipient && !byName.length && !selectedId) blockers.push('Der hinterlegte Rechnungsempfänger stimmt mit keiner gültigen Kostenträgeranschrift überein.');
  const candidates = namedRecipient && !selectedId ? byName : active;
  const primary = candidates.filter(row => row.is_primary === true);
  const selected = selectedId ? active.find(row => row.id === selectedId)
    : primary.length === 1 ? primary[0] : candidates.length === 1 ? candidates[0] : undefined;
  if (selectedId && !selected) blockers.push('Der ausgewählte Rechnungsempfänger ist im Leistungszeitraum nicht mehr verfügbar.');
  if (!selectedId && primary.length > 1) blockers.push('Mehrere Rechnungsempfänger sind als bevorzugt markiert.');
  if (selected) {
    const snapshot = selected.address_snapshot && typeof selected.address_snapshot === 'object' && !Array.isArray(selected.address_snapshot)
      ? selected.address_snapshot as InvoiceRunRow : undefined;
    const recipientType: InvoiceOfficeDraft['recipientType'] = billingParty === 'care_insurance' || billingParty === 'health_insurance' || billingParty === 'social_welfare' ? billingParty : 'other';
    return { recipientType, billingParty, blockers, recipient: { name: value(selected, 'name_snapshot'), street: value(snapshot, 'street'), houseNumber: '',
      postalCode: value(snapshot, 'postalCode'), city: value(snapshot, 'city'), country: value(snapshot, 'country'), email: '' } };
  }
  blockers.push(active.length > 1 ? 'Bitte einen Rechnungsempfänger für diesen Lauf auswählen.'
    : 'Eine vollständige Empfängeranschrift für die Abrechnung fehlt. Bitte das Abrechnungsprofil prüfen.');
  return { recipient: blankRecipient(), recipientType: 'other', billingParty, blockers };
}

function sourceLine(source: InvoiceRunRow, tenantId: string, clientId: string, today: string, includeProofs: boolean, taxRatePercent: number, now: number): {
  line: OfficeInvoiceDraftLine | null; blockers: string[];
} {
  const label = value(source, 'record_number') || value(source, 'service_date') || 'Leistungsnachweis';
  const blockers: string[] = [];
  const fail = (message: string) => blockers.push(`${label}: ${message}`);
  const serviceDate = value(source, 'service_date');
  const product = value(source, 'product_key');
  if (source.tenant_id !== tenantId || source.client_id !== clientId) fail('Die Zuordnung gehört nicht zum gewählten Mandanten und Klienten.');
  if (!['approved', 'billable'].includes(value(source, 'status'))) fail('Der Leistungsnachweis ist noch nicht zur Abrechnung freigegeben.');
  if (value(source, 'billed_invoice_id')) fail('Der Leistungsnachweis ist bereits einer Rechnung zugeordnet.');
  if (!isOfficeInvoiceDate(serviceDate) || serviceDate > today) fail('Das tatsächliche Leistungsdatum ist ungültig oder liegt in der Zukunft.');
  if (!['assist', 'pflege', 'stationaer', 'beratung'].includes(product)) fail('Der Leistungsbereich ist nicht unterstützt.');
  if (!value(source, 'updated_at') || !Number.isFinite(Date.parse(value(source, 'updated_at')))) fail('Der aktuelle Bearbeitungsstand fehlt.');
  const minutes = number(source, 'billable_minutes');
  const actual = number(source, 'actual_minutes');
  const rate = number(source, 'hourly_rate');
  const amount = number(source, 'total_amount');
  if (minutes == null || !Number.isSafeInteger(minutes) || minutes <= 0) fail('Eine positive abrechenbare Dauer fehlt.');
  if (actual == null || !Number.isSafeInteger(actual) || actual <= 0) fail('Die tatsächlich erfasste Leistungsdauer fehlt.');
  if (minutes != null && actual != null && minutes > actual) fail('Die abrechenbare Dauer überschreitet die tatsächlich erfasste Leistungsdauer.');
  if (rate == null || rate <= 0 || !Number.isSafeInteger(Math.round(rate * 100))) fail('Der vereinbarte Stundensatz fehlt oder ist ungültig.');
  if (amount == null || amount <= 0 || !Number.isSafeInteger(Math.round(amount * 100))) fail('Der geprüfte Leistungsbetrag fehlt oder ist ungültig.');
  const receipt = source.source_receipt && typeof source.source_receipt === 'object' && !Array.isArray(source.source_receipt)
    ? source.source_receipt as InvoiceRunRow : undefined;
  if (value(source, 'assignment_id')) {
    const validReceipt = receipt?.version === 'workflow-assignment-record-v1' && receipt.tenant_id === tenantId
      && receipt.client_id === clientId && receipt.assignment_id === source.assignment_id
      && berlinDateKey(value(receipt, 'service_started_at')) === serviceDate
      && number(receipt, 'actual_minutes') === actual && Boolean(value(receipt, 'pdf_storage_path'))
      && /^(sha256:)?[0-9a-f]{64}$/.test(value(receipt, 'pdf_sha256'))
      && Number.isFinite(Date.parse(value(receipt, 'attested_at'))) && Date.parse(value(receipt, 'attested_at')) <= now;
    if (!validReceipt) fail('Die bestätigte signierte Nachweisfassung fehlt oder passt nicht zum Einsatz.');
  }
  if (!value(source, 'assignment_id') && (!value(source, 'signature_id') || !value(source, 'documentation_entry_id'))) fail('Die Zuordnung zur unterschriebenen Nachweisfassung fehlt.');
  if (includeProofs && !value(receipt, 'pdf_storage_path') && !value(source, 'pdf_url')) fail('Für die gewählte Anlage ist keine Nachweis-PDF hinterlegt.');
  if (minutes == null || minutes <= 0 || rate == null || rate <= 0 || !['assist', 'pflege', 'stationaer', 'beratung'].includes(product)) return { line: null, blockers };
  const calculated = Math.round(minutes / 60 * Math.round(rate * 100));
  // invoice_items.quantity has two decimals. Keep the approved cent amount exact
  // and explain actual duration/rate in the description instead of truncating hours.
  const quantity = 1;
  const unitPriceCents = amount != null ? Math.round(amount * 100) : calculated;
  if (amount != null && calculated !== Math.round(amount * 100)) fail('Dauer, Stundensatz und freigegebener Betrag stimmen nicht überein.');
  return { blockers, line: { description: `${value(source, 'record_number') ? `Leistungsnachweis ${label}` : `Leistung vom ${serviceDate.split('-').reverse().join('.')}`} · ${minutes} Minuten × ${(rate).toFixed(2).replace('.', ',')} €/Stunde`,
    quantity, unit: 'Leistung', unitPriceCents, taxRatePercent, productKey: product as OfficeInvoiceProductKey,
    serviceDate, serviceRecordId: value(source, 'id'), sourceUpdatedAt: value(source, 'updated_at') } };
}

/** Read-only preview: no invoice numbers, writes, source claims or dispatch. */
export function buildInvoiceRunPreview(tenantId: string, input: InvoiceRunInput, data: InvoiceRunSourceData,
  now = new Date(), makeRequestId = () => globalThis.crypto.randomUUID()): ServiceResult<InvoiceRunPreview> {
  const period = invoiceRunPeriod(input.month);
  if (!period) return { ok: false, error: 'Bitte einen gültigen Abrechnungsmonat auswählen.' };
  if (!isOfficeInvoiceDate(input.invoiceDate) || (input.dueDate && (!isOfficeInvoiceDate(input.dueDate) || input.dueDate < input.invoiceDate))) {
    return { ok: false, error: 'Rechnungsdatum und Fälligkeit müssen gültig sein. Die Fälligkeit darf nicht vor dem Rechnungsdatum liegen.' };
  }
  if (input.taxRatePercent !== undefined && !validVat(input.taxRatePercent)) return { ok: false, error: 'Der ausgewählte Umsatzsteuersatz ist ungültig.' };
  if (input.productKey && input.productKey !== 'all' && !['assist', 'pflege', 'stationaer', 'beratung'].includes(input.productKey)) return { ok: false, error: 'Bitte einen gültigen Leistungsbereich auswählen.' };
  if (Object.values(data).some(rows => rows.some(row => row.tenant_id !== tenantId))) return { ok: false, error: 'Die Abrechnungsdaten gehören nicht zum aktuellen Mandanten.' };
  if (data.settings.length > 1) return { ok: false, error: 'Die Abrechnungseinstellungen sind nicht eindeutig. Bitte die Unternehmenseinstellungen prüfen.' };
  const seenSources = new Set<string>();
  for (const source of data.sources) {
    const id = value(source, 'id');
    if (!id || seenSources.has(id)) return { ok: false, error: 'Ein Leistungsnachweis wurde mehrfach oder ohne Kennung geladen. Bitte erneut prüfen.' };
    seenSources.add(id);
  }
  const settings = data.settings[0];
  const byClient = new Map<string, InvoiceRunRow[]>();
  let alreadyBilledCount = 0;
  let excludedCount = 0;
  for (const source of data.sources) {
    const date = value(source, 'service_date');
    if (date < period.start || date > period.end || (input.productKey && input.productKey !== 'all' && source.product_key !== input.productKey)
      || (input.clientId && source.client_id !== input.clientId)) continue;
    if (value(source, 'billed_invoice_id') || source.status === 'billed') { alreadyBilledCount += 1; continue; }
    if (source.status === 'cancelled' || source.status === 'corrected') { excludedCount += 1; continue; }
    const clientId = value(source, 'client_id');
    const rows = byClient.get(clientId) ?? [];
    rows.push(source); byClient.set(clientId, rows);
  }
  const today = berlinDateKey(now.toISOString());
  const groups: InvoiceRunGroup[] = [];
  for (const [clientId, records] of byClient) {
    const clients = data.clients.filter(row => row.id === clientId);
    const client = clients[0];
    const clientName = [value(client, 'first_name'), value(client, 'last_name')].filter(Boolean).join(' ') || 'Klient:in nicht zugeordnet';
    const profiles = data.billingProfiles.filter(row => row.client_id === clientId);
    const sourceDates = records.map(row => value(row, 'service_date')).sort();
    const recipient = resolveOfficeInvoiceRunRecipient(client, profiles, data.recipients.filter(row => row.client_id === clientId),
      { start: sourceDates[0], end: sourceDates[sourceDates.length - 1] }, input.recipientIdsByClient?.[clientId]);
    const blockers = [...recipient.blockers];
    if (clients.length !== 1) blockers.push('Die Klientenzuordnung fehlt oder ist nicht eindeutig.');
    if (value(client, 'deleted_at')) blockers.push('Die Klientenakte wurde gelöscht. Bitte die Zuordnung prüfen.');
    const configuredTax = settings ? number(settings, recipient.billingParty === 'self_payer' ? 'self_payer_vat_rate' : 'insurance_vat_rate') : null;
    const tax = input.taxRatePercent ?? configuredTax;
    if (validVat(tax) && tax > 0 && input.taxRatePercent === undefined) blockers.push('Bitte bestätigen, dass die gespeicherten Leistungsbeträge Nettobeträge sind, und den Umsatzsteuersatz für diesen Lauf auswählen.');
    if (!validVat(tax)) blockers.push('Für diesen Rechnungsempfänger ist kein gültiger Umsatzsteuersatz hinterlegt. Bitte in den Unternehmenseinstellungen ergänzen oder für diesen Lauf auswählen.');
    const lines: OfficeInvoiceDraftLine[] = [];
    for (const source of [...records].sort((a, b) => value(a, 'service_date').localeCompare(value(b, 'service_date')) || value(a, 'id').localeCompare(value(b, 'id')))) {
      const checked = sourceLine(source, tenantId, clientId, today, input.includeProofs, validVat(tax) ? tax : 0, now.getTime());
      blockers.push(...checked.blockers);
      if (checked.line) lines.push(checked.line);
    }
    const paymentDays = profiles[0] ? number(profiles[0], 'payment_terms_days') : settings ? number(settings, 'payment_terms_days') : null;
    if (!input.dueDate && (paymentDays == null || !Number.isSafeInteger(paymentDays) || paymentDays < 0 || paymentDays > 365)) blockers.push('Ein gültiges Zahlungsziel fehlt. Bitte die Fälligkeit für diesen Lauf auswählen.');
    const draft: InvoiceOfficeDraft = { requestId: makeRequestId(), clientId, invoiceNumber: '', invoiceDate: input.invoiceDate,
      dueDate: input.dueDate ?? datePlusDays(input.invoiceDate, paymentDays != null && Number.isSafeInteger(paymentDays) && paymentDays >= 0 && paymentDays <= 365 ? paymentDays : 0),
      servicePeriodStart: period.start, servicePeriodEnd: period.end, recipient: recipient.recipient, recipientType: recipient.recipientType, billingParty: recipient.billingParty,
      notes: value(settings, 'invoice_notes'), footerText: input.footerText ?? value(settings, 'invoice_footer_text'), includeProofs: input.includeProofs, selectedProofIds: input.includeProofs ? records.map(row => `record:${value(row, 'id')}`) : [], lines };
    blockers.push(...validateOfficeInvoiceDraft(draft));
    let totalCents: number | null = null;
    try { if (lines.length === records.length && validVat(tax)) totalCents = calculateOfficeInvoiceLines(lines).totalCents; }
    catch { blockers.push('Der Rechnungsbetrag liegt außerhalb des unterstützten Bereichs.'); }
    const uniqueBlockers = [...new Set(blockers)];
    groups.push({ id: clientId || `missing-client:${value(records[0], 'id')}`, clientId, clientName,
      recipientName: recipient.recipient.name || 'Empfänger offen', sourceCount: records.length, totalCents,
      eligible: uniqueBlockers.length === 0, blockers: uniqueBlockers, proofIds: input.includeProofs ? records.map(row => `record:${value(row, 'id')}`) : [], draft });
  }
  groups.sort((a, b) => a.clientName.localeCompare(b.clientName, 'de'));
  const eligible = groups.filter(group => group.eligible);
  const totalCents = eligible.reduce((sum, group) => sum + (group.totalCents ?? 0), 0);
  if (!Number.isSafeInteger(totalCents)) return { ok: false, error: 'Die Summe des Rechnungslaufs liegt außerhalb des unterstützten Bereichs.' };
  return { ok: true, data: { tenantId, month: input.month, ...period, createdAt: now.toISOString(), groups,
    blockedCount: groups.length - eligible.length, eligibleCount: eligible.length, alreadyBilledCount, excludedCount, totalCents } };
}
