import type { InvoiceBillingModule, InvoiceStatus } from '@/types/modules/billing';
import type { OfficeEInvoiceMetadata, OfficeEInvoiceLineTax } from './eInvoiceTypes.web';

export type OfficeInvoiceProductKey = 'assist' | 'pflege' | 'stationaer' | 'beratung';
export type OfficeInvoiceRecipientType = 'client' | 'relative' | 'care_insurance' | 'health_insurance' | 'social_welfare' | 'company' | 'other';
export type OfficeInvoiceBillingParty = 'care_insurance' | 'health_insurance' | 'self_payer' | 'social_welfare' | 'other';
export type OfficeInvoiceRecipient = { name: string; street: string; houseNumber: string; postalCode: string; city: string; country: string; email: string };
export type OfficeInvoiceDraftLine = {
  id?: string; description: string; quantity: number; unit: string; unitPriceCents: number; taxRatePercent: number;
  productKey: OfficeInvoiceProductKey; serviceDate?: string; serviceRecordId?: string; sourceUpdatedAt?: string;
  eInvoiceTax?: OfficeEInvoiceLineTax;
};
export type OfficeInvoiceLine = OfficeInvoiceDraftLine & { id: string; netCents: number | null; taxCents: number | null; totalCents: number | null };
export type InvoiceOfficeDraft = {
  id?: string; requestId: string; expectedUpdatedAt?: string; clientId: string;
  clientName?: string; clientNumber?: string; insuranceNumber?: string;
  invoiceNumber: string; invoiceDate: string; dueDate: string; servicePeriodStart: string; servicePeriodEnd: string;
  recipient: OfficeInvoiceRecipient; recipientType: OfficeInvoiceRecipientType; billingParty: OfficeInvoiceBillingParty;
  notes: string; footerText: string; includeProofs: boolean; selectedProofIds?: string[];
  lines: OfficeInvoiceDraftLine[];
  eInvoice?: OfficeEInvoiceMetadata;
};
export type OfficeInvoice = {
  id: string; tenantId: string; clientId: string | null; clientName: string; clientNumber: string; insuranceNumber: string;
  invoiceNumber: string; status: InvoiceStatus; invoiceDate: string; dueDate: string | null;
  servicePeriodStart: string | null; servicePeriodEnd: string | null;
  amountCents: number | null; paidCents: number | null; openCents: number | null;
  billingModule: InvoiceBillingModule; updatedAt: string; createdAt: string;
  recipient: OfficeInvoiceRecipient; recipientType: OfficeInvoiceRecipientType | null; billingParty: OfficeInvoiceBillingParty | null;
  officeManaged: boolean; notes: string | null; footerText: string | null;
  includeProofs: boolean; selectedProofIds: string[]; lines: OfficeInvoiceLine[]; issues: string[];
  pdfFilePath: string | null; cancellationReason: string | null; companySnapshot: Record<string, unknown> | null;
  eInvoice?: OfficeEInvoiceMetadata;
};
export type OfficeInvoiceClient = { id: string; name: string; clientNumber: string; status: string; recipient: OfficeInvoiceRecipient; insuranceName: string; insuranceNumber: string; billingParty: string };
export type OfficeInvoiceCatalogOption = { id: string; name: string; description: string; unit: string; productKey: OfficeInvoiceProductKey; unitPriceCents: number; taxRatePercent: number; taxNotice: string };
export type OfficeInvoiceEditorOptions = { clients: OfficeInvoiceClient[]; catalog: OfficeInvoiceCatalogOption[] };
export type OfficeInvoiceMutationResult = { id: string; updatedAt: string };
export type OfficeInvoicePaymentInput = {
  requestId: string; amountCents: number; paymentDate: string;
  method: 'bank_transfer' | 'direct_debit' | 'cash' | 'card' | 'paypal' | 'stripe' | 'other'; reference: string; notes: string;
};
export type OfficeInvoiceIssueArchive = { pdfFilePath: string; companySnapshot: Record<string, unknown>; selectedProofIds: string[] };
export type OfficeInvoiceIssuePreview = { invoiceNumber: string; companySnapshot: Record<string, unknown>; sourceRevision: string };
export type OfficeInvoiceIssueInput = OfficeInvoiceIssuePreview & { requestId: string; pdfFilePath: string; pdfSha256: string; eInvoiceXmlSha256?: string };
export type OfficeInvoiceDeliveryEvidence = { channel: 'email' | 'post' | 'personal' | 'other'; date: string; reference: string };

export function isOfficeInvoiceDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function isOfficeInvoiceUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
export function calculateOfficeInvoiceLines(lines: OfficeInvoiceDraftLine[]) {
  const calculated = lines.map(line => {
    if (!Number.isFinite(line.quantity) || line.quantity <= 0 || !Number.isSafeInteger(Math.round(line.quantity * 100)) ||
      Math.abs(line.quantity * 100 - Math.round(line.quantity * 100)) > 0.00001 || !Number.isSafeInteger(line.unitPriceCents) || line.unitPriceCents < 0 ||
      !Number.isFinite(line.taxRatePercent) || line.taxRatePercent < 0 || line.taxRatePercent > 100 || Math.abs(line.taxRatePercent * 100 - Math.round(line.taxRatePercent * 100)) > 0.00001) throw new Error('Eine Rechnungsposition enthält ungültige Werte.');
    const netCents = Number((BigInt(Math.round(line.quantity * 100)) * BigInt(line.unitPriceCents) + BigInt(50)) / BigInt(100));
    const taxCents = Number((BigInt(netCents) * BigInt(Math.round(line.taxRatePercent * 100)) + BigInt(5000)) / BigInt(10000));
    const totalCents = netCents + taxCents;
    if (![netCents, taxCents, totalCents].every(Number.isSafeInteger)) throw new Error('Der Rechnungsbetrag ist zu groß.');
    return { ...line, netCents, taxCents, totalCents };
  });
  const totals = calculated.reduce((sum, line) => ({ netCents: sum.netCents + line.netCents, taxCents: sum.taxCents + line.taxCents,
    totalCents: sum.totalCents + line.totalCents }), { netCents: 0, taxCents: 0, totalCents: 0 });
  if (!Object.values(totals).every(value => Number.isSafeInteger(value) && value <= 9999999999)) throw new Error('Der Rechnungsbetrag ist zu groß.');
  return { ...totals, lines: calculated };
}
export function validateOfficeInvoiceDraft(input: InvoiceOfficeDraft): string[] {
  const issues: string[] = [];
  if (!isOfficeInvoiceUuid(input.requestId)) issues.push('Die Speicherkennung fehlt. Bitte die Ansicht erneut öffnen.');
  if (!isOfficeInvoiceUuid(input.clientId)) issues.push('Bitte eine Klientin oder einen Klienten auswählen.');
  if (input.id && (!isOfficeInvoiceUuid(input.id) || !input.expectedUpdatedAt || !Number.isFinite(Date.parse(input.expectedUpdatedAt)))) issues.push('Der gespeicherte Bearbeitungsstand fehlt. Bitte die Rechnung neu laden.');
  if (input.invoiceNumber.length > 120) issues.push('Die Rechnungsnummer darf höchstens 120 Zeichen lang sein.');
  if (!['client', 'relative', 'care_insurance', 'health_insurance', 'social_welfare', 'company', 'other'].includes(input.recipientType)) issues.push('Bitte die Empfängerart auswählen.');
  if (!['care_insurance', 'health_insurance', 'self_payer', 'social_welfare', 'other'].includes(input.billingParty)) issues.push('Bitte den Kostenträger auswählen.');
  for (const [date, label] of [[input.invoiceDate, 'Rechnungsdatum'], [input.dueDate, 'Fälligkeitsdatum'], [input.servicePeriodStart, 'Beginn des Leistungszeitraums'], [input.servicePeriodEnd, 'Ende des Leistungszeitraums']]) {
    if (!isOfficeInvoiceDate(date)) issues.push(`${label} ist ungültig.`);
  }
  if (input.dueDate < input.invoiceDate) issues.push('Das Fälligkeitsdatum liegt vor dem Rechnungsdatum.');
  if (input.invoiceDate < '2000-01-01' || input.invoiceDate > '2100-12-31') issues.push('Das Rechnungsdatum muss zwischen 2000 und 2100 liegen.');
  if (input.servicePeriodEnd < input.servicePeriodStart) issues.push('Das Ende des Leistungszeitraums liegt vor seinem Beginn.');
  if (!input.recipient.name.trim()) issues.push('Der Rechnungsempfänger fehlt.');
  if (!input.recipient.street.trim() || !input.recipient.postalCode.trim() || !input.recipient.city.trim() || !input.recipient.country.trim()) issues.push('Die Anschrift des Rechnungsempfängers ist unvollständig.');
  if (input.recipient.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.recipient.email.trim())) issues.push('Die E-Mail-Adresse des Empfängers ist ungültig.');
  if (input.notes.length > 10000 || input.footerText.length > 10000 || Object.values(input.recipient).some(value => value.length > 500)) issues.push('Ein Textfeld ist zu lang. Bitte den Inhalt kürzen.');
  const proofIds = input.selectedProofIds ?? [];
  if (proofIds.length > 30 || new Set(proofIds).size !== proofIds.length || proofIds.some(id => !id.startsWith('record:') || !isOfficeInvoiceUuid(id.slice(7)))) issues.push('Die Auswahl der Leistungsnachweise ist ungültig.');
  if (input.includeProofs && !proofIds.length) issues.push('Bitte mindestens einen Leistungsnachweis für die Anlage auswählen.');
  if (!input.includeProofs && proofIds.length) issues.push('Die Anlagen sind ausgeschaltet. Bitte die Auswahl entfernen oder die Anlagen einschalten.');
  if (!input.lines.length) issues.push('Mindestens eine Rechnungsposition ist erforderlich.');
  if (input.lines.length > 500) issues.push('Eine Rechnung darf höchstens 500 Positionen enthalten.');
  const sources = new Set<string>();
  input.lines.forEach((line, index) => {
    const label = `Position ${index + 1}`;
    if (line.id && !isOfficeInvoiceUuid(line.id)) issues.push(`${label}: Die Positionskennung ist ungültig. Bitte neu laden.`);
    if (!line.description.trim() || line.description.length > 2000) issues.push(`${label}: Bitte eine gültige Beschreibung eingeben.`);
    if (!Number.isFinite(line.quantity) || line.quantity <= 0 || line.quantity > 1000000 || Math.abs(line.quantity * 100 - Math.round(line.quantity * 100)) > 0.00001) issues.push(`${label}: Die Menge muss positiv sein und darf höchstens zwei Nachkommastellen enthalten.`);
    if (!Number.isSafeInteger(line.unitPriceCents) || line.unitPriceCents < 0 || line.unitPriceCents > 100000000) issues.push(`${label}: Der Einzelpreis ist ungültig.`);
    if (!Number.isFinite(line.taxRatePercent) || line.taxRatePercent < 0 || line.taxRatePercent > 100 || Math.abs(line.taxRatePercent * 100 - Math.round(line.taxRatePercent * 100)) > 0.00001) issues.push(`${label}: Der Umsatzsteuersatz ist ungültig.`);
    if (!line.unit.trim() || line.unit.length > 50) issues.push(`${label}: Die Einheit fehlt oder ist zu lang.`);
    if (!['assist', 'pflege', 'stationaer', 'beratung'].includes(line.productKey)) issues.push(`${label}: Der Leistungsbereich ist ungültig.`);
    if (line.serviceDate && (!isOfficeInvoiceDate(line.serviceDate) || line.serviceDate < input.servicePeriodStart || line.serviceDate > input.servicePeriodEnd)) issues.push(`${label}: Das Leistungsdatum liegt außerhalb des gewählten Zeitraums.`);
    if (line.serviceRecordId) {
      if (!isOfficeInvoiceUuid(line.serviceRecordId) || !line.sourceUpdatedAt || !Number.isFinite(Date.parse(line.sourceUpdatedAt))) issues.push(`${label}: Der Leistungsnachweis muss neu geladen werden.`);
      if (sources.has(line.serviceRecordId)) issues.push(`${label}: Derselbe Leistungsnachweis ist bereits enthalten.`);
      sources.add(line.serviceRecordId);
    }
  });
  if (!issues.length) {
    try { if (calculateOfficeInvoiceLines(input.lines).totalCents <= 0) issues.push('Die Rechnungssumme muss größer als null sein.'); }
    catch (error) { issues.push(error instanceof Error ? error.message : 'Die Rechnungssumme ist ungültig.'); }
  }
  return issues;
}
