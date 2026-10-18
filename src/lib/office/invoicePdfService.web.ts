import { CARESUITE_PDF_FONT, registerCareSuitePdfFont, createCareSuitePdfText } from '@/lib/documents/centuryGothicPdf';
import type { RoleKey, ServiceResult } from '@/types';
import type { InvoiceDetail } from '@/types/modules/invoiceDetail';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { calculateOfficeInvoiceLines, isOfficeInvoiceDate, validateOfficeInvoiceDraft, type InvoiceOfficeDraft, type OfficeInvoice } from './invoiceWorkspaceTypes.web';
import { loadInvoiceProofPages, validateInvoicePdfBytes, type InvoiceProofPage } from './invoiceProofAttachments.web';
import { isTenantStoragePath } from '@/lib/storage/storagePaths';

export { listInvoiceProofAttachments, downloadInvoiceProofAttachment } from './invoiceProofAttachments.web';
export type { InvoiceProofAttachment } from './invoiceProofAttachments.web';

export type OfficePdfInvoice = InvoiceDetail & {
  pdfStoragePath?: string | null;
  companySnapshot?: InvoicePdfCompany | null;
  recipientName?: string;
  insuredNumber?: string;
  clientNumber?: string;
  footerText?: string;
  reconstructedCopy?: boolean;
};

export type InvoicePdfCompany = {
  legalName: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  taxNumber: string;
  vatId: string;
  registerCourt: string;
  registerNumber: string;
  ikNumber: string;
  representativeName: string;
  bankName: string;
  iban: string;
  bic: string;
  logoUrl: string;
  footerText: string;
};

export type InvoicePdfData = {
  invoice: OfficePdfInvoice;
  company: InvoicePdfCompany;
  annexPages?: InvoiceProofPage[];
};

export type InvoicePdfValidation = {
  errors: string[];
  warnings: string[];
};

export type PreparedInvoicePdf = {
  fileName: string;
  bytes: Uint8Array;
  validation: InvoicePdfValidation;
  companySnapshot?: InvoicePdfCompany;
  proofIds?: string[];
};

const emptyCompany: InvoicePdfCompany = {
  legalName: '',
  street: '',
  houseNumber: '',
  postalCode: '',
  city: '',
  country: 'Deutschland',
  phone: '',
  email: '',
  website: '',
  taxNumber: '',
  vatId: '',
  registerCourt: '',
  registerNumber: '',
  ikNumber: '',
  representativeName: '',
  bankName: '',
  iban: '',
  bic: '',
  logoUrl: '',
  footerText: '',
};

function value(row: Record<string, unknown> | null, key: string): string {
  const current = row?.[key];
  return current == null ? '' : String(current).trim();
}

export async function fetchInvoicePdfData(
  tenantId: string,
  invoice: OfficePdfInvoice,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InvoicePdfData>> {
  const denied = enforcePermission<InvoicePdfData>(actorRoleKey, 'office.invoices.view');
  if (denied) return denied;
  if (!tenantId || invoice.tenantId !== tenantId) return { ok: false, error: 'Die Rechnung gehört nicht zum gewählten Unternehmen.' };
  if (invoice.companySnapshot) return { ok: true, data: { invoice, company: invoice.companySnapshot } };

  if (getServiceMode() !== 'supabase') {
    return {
      ok: true,
      data: {
        invoice,
        company: {
          ...emptyCompany,
          legalName: 'CareSuite Demo Pflegedienst GmbH',
          street: 'Musterstraße',
          houseNumber: '1',
          postalCode: '10115',
          city: 'Berlin',
          email: 'rechnung@caresuite.example',
          taxNumber: '27/123/45678',
          bankName: 'Demo Bank',
          iban: 'DE89370400440532013000',
          bic: 'COBADEFFXXX',
        },
      },
    };
  }

  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Supabase ist nicht verfügbar.' };

  const [tenantResult, bankResult, brandingResult, billingResult] = await Promise.all([
    fromUnknownTable(client, 'tenants')
      .select('name, legal_name, street, house_number, postal_code, city, country, phone, email, website, tax_number, vat_id, register_court, register_number, ik_number, representative_name')
      .eq('id', tenantId)
      .maybeSingle(),
    fromUnknownTable(client, 'tenant_bank_accounts').select('bank_name, iban, bic, is_primary, sort_order').eq('tenant_id', tenantId).order('is_primary', { ascending: false, nullsFirst: false }).order('sort_order', { nullsFirst: false }).order('id').limit(1),
    fromUnknownTable(client, 'tenant_branding').select('logo_url').eq('tenant_id', tenantId).maybeSingle(),
    fromUnknownTable(client, 'tenant_billing_settings').select('invoice_footer_text,bank_name,iban,bic').eq('tenant_id', tenantId).maybeSingle(),
  ]);

  if (tenantResult.error || !tenantResult.data) {
    return { ok: false, error: 'Unternehmensdaten für die Rechnung konnten nicht geladen werden.' };
  }
  if (bankResult.error || brandingResult.error || billingResult.error) {
    return { ok: false, error: 'Steuer-, Bank- oder Unternehmensangaben konnten nicht vollständig geladen werden. Bitte erneut versuchen.' };
  }

  const tenant = tenantResult.data as Record<string, unknown>;
  const bank = ((bankResult.data ?? []) as Record<string, unknown>[])[0] ?? null;
  const branding = brandingResult.data as Record<string, unknown> | null;
  const billing = billingResult.data as Record<string, unknown> | null;

  return {
    ok: true,
    data: {
      invoice,
      company: {
        legalName: value(tenant, 'legal_name') || value(tenant, 'name'),
        street: value(tenant, 'street'),
        houseNumber: value(tenant, 'house_number'),
        postalCode: value(tenant, 'postal_code'),
        city: value(tenant, 'city'),
        country: value(tenant, 'country') || 'Deutschland',
        phone: value(tenant, 'phone'),
        email: value(tenant, 'email'),
        website: value(tenant, 'website'),
        taxNumber: value(tenant, 'tax_number'),
        vatId: value(tenant, 'vat_id'),
        registerCourt: value(tenant, 'register_court'),
        registerNumber: value(tenant, 'register_number'),
        ikNumber: value(tenant, 'ik_number'),
        representativeName: value(tenant, 'representative_name'),
        bankName: value(bank ?? billing, 'bank_name'),
        iban: value(bank ?? billing, 'iban'),
        bic: value(bank ?? billing, 'bic'),
        logoUrl: value(branding, 'logo_url'),
        footerText: invoice.footerText?.trim() || value(billing, 'invoice_footer_text'),
      },
    },
  };
}

export function validateInvoicePdf(data: InvoicePdfData): InvoicePdfValidation {
  const { company, invoice } = data;
  const errors: string[] = [];
  const warnings: string[] = [];
  const require = (condition: boolean, message: string) => {
    if (!condition) errors.push(message);
  };

  require(Boolean(company.legalName), 'Rechtlicher Unternehmensname fehlt.');
  require(Boolean(company.street && company.postalCode && company.city), 'Vollständige Unternehmensanschrift fehlt.');
  require(Boolean(company.taxNumber || company.vatId), 'Steuernummer oder Umsatzsteuer-ID fehlt.');
  require(Boolean(invoice.recipientName || invoice.clientName), 'Name der Rechnungsempfänger:in fehlt.');
  require(Boolean(invoice.recipient.street && invoice.recipient.postalCode && invoice.recipient.city), 'Vollständige Empfängeranschrift fehlt.');
  if (invoice.status !== 'draft') {
    require(Boolean(invoice.id), 'Eindeutige Rechnungs-ID fehlt.');
    require(Boolean(invoice.invoiceNumber), 'Eindeutige Rechnungsnummer fehlt.');
  }
  require(isOfficeInvoiceDate(invoice.issuedDate || ''), 'Rechnungsdatum fehlt oder ist ungültig.');
  require(isOfficeInvoiceDate(invoice.servicePeriodStart || '') && isOfficeInvoiceDate(invoice.servicePeriodEnd || '') && invoice.servicePeriodStart! <= invoice.servicePeriodEnd!, 'Leistungszeitraum fehlt oder ist ungültig.');
  require(isOfficeInvoiceDate(invoice.dueDate) && invoice.dueDate >= (invoice.issuedDate || ''), 'Fälligkeitsdatum fehlt oder liegt vor dem Rechnungsdatum.');
  require(invoice.lineItems.length > 0, 'Mindestens eine Rechnungsposition ist erforderlich.');
  require(invoice.currency === 'EUR', 'Die PDF-Ausgabe unterstützt Rechnungen in Euro.');
  require(Number.isSafeInteger(invoice.amountCents) && invoice.amountCents > 0, 'Der Rechnungsbetrag ist ungültig.');
  require(Boolean(company.bankName && company.iban), 'Bankverbindung für die Zahlung fehlt.');

  invoice.lineItems.forEach((item, index) => {
    const rate = item.taxRatePercent ?? 0;
    const net = Math.round(item.quantity * item.unitPriceCents);
    const tax = Math.round(net * rate / 100);
    if (!item.description.trim() || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isSafeInteger(item.unitPriceCents) || item.unitPriceCents < 0 || !Number.isFinite(rate) || rate < 0 || rate > 100 || !Number.isSafeInteger(item.totalCents) || item.totalCents !== net + tax || (item.netTotalCents !== undefined && item.netTotalCents !== net) || (item.taxCents !== undefined && item.taxCents !== tax)) {
      errors.push(`Position ${index + 1}: Menge, Einzelpreis oder Steuerbetrag ist ungültig.`);
    }
  });

  const itemGross = invoice.lineItems.reduce((sum, item) => sum + item.totalCents, 0);
  if (itemGross !== invoice.amountCents) {
    errors.push('Positionssumme und Rechnungsbetrag stimmen nicht überein.');
  }
  const hasZeroTax = invoice.lineItems.some((item) => (item.taxRatePercent ?? 0) === 0);
  if (hasZeroTax && !invoice.taxNotice?.trim()) {
    warnings.push('Für Positionen mit 0 % Umsatzsteuer fehlt eine Begründung. Bitte den Steuerhinweis fachlich prüfen.');
  }
  if (!company.bic) warnings.push('BIC fehlt; innerhalb des SEPA-Raums meist entbehrlich.');
  if (invoice.status === 'draft') warnings.push('Der PDF-Entwurf erhält ein sichtbares ENTWURF-Wasserzeichen.');

  return { errors, warnings };
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-');
  return year && month && day ? `${day}.${month}.${year}` : value;
}

function formatMoney(cents: number): string {
  return `${new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)} €`;
}

function formatQuantity(quantity: number): string {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 4 }).format(quantity);
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9ÄÖÜäöüß._-]+/g, '_').replace(/^_+|_+$/g, '');
}

type PreparedLogo = {
  dataUrl: string;
  aspectRatio: number;
  format: 'PNG' | 'JPEG';
};

async function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Logo konnte nicht gelesen werden.'));
    reader.readAsDataURL(blob);
  });
}

async function prepareLogo(url: string): Promise<PreparedLogo | null> {
  if (!url) return null;
  try {
    const source = url.startsWith('data:')
      ? url
      : typeof FileReader !== 'undefined'
        ? await fetch(url).then(async (response) => response.ok ? readBlobAsDataUrl(await response.blob()) : '')
        : '';
    if (!source) return null;

    if (typeof document === 'undefined' || typeof Image === 'undefined') {
      return {
        dataUrl: source,
        aspectRatio: 3.5,
        format: source.includes('image/png') ? 'PNG' : 'JPEG',
      };
    }

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Logo konnte nicht dekodiert werden.'));
      element.src = source;
    });
    const naturalWidth = Math.max(1, image.naturalWidth || image.width);
    const naturalHeight = Math.max(1, image.naturalHeight || image.height);
    const aspectRatio = naturalWidth / naturalHeight;
    const targetWidth = Math.min(2400, Math.max(1200, naturalWidth));
    const targetHeight = Math.max(1, Math.round(targetWidth / aspectRatio));
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.clearRect(0, 0, targetWidth, targetHeight);
    context.drawImage(image, 0, 0, targetWidth, targetHeight);
    return {
      dataUrl: canvas.toDataURL('image/png', 1),
      aspectRatio,
      format: 'PNG',
    };
  } catch {
    return null;
  }
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<PreparedInvoicePdf> {
  return renderInvoicePdfDocument(data);
}

/** Drafts and final PDFs use this same renderer; it never writes to storage or allocates a number. */
export async function renderInvoicePdfDocument(data: InvoicePdfData): Promise<PreparedInvoicePdf> {
  const validation = validateInvoicePdf(data);
  if (validation.errors.length) throw new Error(`PDF gesperrt: ${validation.errors.join(' ')}`);
  // @ts-expect-error jspdf ships no type declarations for its ESM browser entry
  const { jsPDF } = await import('jspdf/dist/jspdf.es.min.js');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  registerCareSuitePdfFont(pdf);
  const write = createCareSuitePdfText(pdf);
  const { invoice, company } = data;
  const draft = invoice.status === 'draft';
  const number = invoice.invoiceNumber || 'Wird beim Speichern vergeben';
  const logo = await prepareLogo(company.logoUrl);
  const left = 18, right = 192, contentWidth = 174, bottom = 253;
  const ink: [number, number, number] = [25, 40, 60];
  const muted: [number, number, number] = [80, 96, 116];
  const accent: [number, number, number] = [35, 97, 200];
  const pale: [number, number, number] = [245, 248, 252];
  const line: [number, number, number] = [217, 226, 237];
  const font = (size: number, bold = false, color = ink) => { pdf.setFont(CARESUITE_PDF_FONT, bold ? 'bold' : 'normal'); pdf.setFontSize(size); pdf.setTextColor(...color); };
  const lines = (text: string, width: number): string[] => pdf.splitTextToSize(text, width) as string[];
  let y = 0;
  const header = () => {
    pdf.setFillColor(...accent); pdf.rect(0, 0, 210, 2.4, 'F');
    font(11, true); const nameLines = lines(company.legalName, 112); write(nameLines, left, 15);
    const addressY = Math.max(28, 15 + nameLines.length * 5);
    font(7.4, false, muted); const addressLines = lines(`${company.street} ${company.houseNumber} · ${company.postalCode} ${company.city}`, 112); write(addressLines, left, addressY);
    if (logo) {
      const width = Math.min(48, 18 * logo.aspectRatio), height = width / logo.aspectRatio;
      try { pdf.addImage(logo.dataUrl, logo.format, right - width, 9, width, height, 'tenant-logo', 'SLOW'); } catch { /* Company name remains readable. */ }
    }
    const headerEnd = addressY + addressLines.length * 4 + 2;
    pdf.setDrawColor(...line); pdf.line(left, headerEnd, right, headerEnd);
    y = headerEnd + 10;
  };
  const newPage = () => { pdf.addPage('a4', 'portrait'); header(); };
  const reserve = (height: number) => { if (y + height > bottom) newPage(); };
  const paragraph = (text: string, size = 8.6, bold = false, color = muted) => {
    font(size, bold, color);
    for (const row of lines(text, contentWidth)) {
      reserve(5); font(size, bold, color); write(row, left, y); y += 4.5;
    }
    y += 3;
  };
  pdf.setProperties({ title: `${draft ? 'Entwurf' : 'Rechnung'} ${invoice.invoiceNumber || invoice.clientName}`,
    subject: invoice.id ? `Rechnungs-ID ${invoice.id}` : 'Rechnungsentwurf ohne vergebene Rechnungsnummer',
    author: company.legalName, creator: 'CareSuite HealthOS Software Technologie' });
  header();
  font(7, true, muted); write('RECHNUNGSEMPFÄNGER', left, y);
  font(10);
  const recipientLines = [invoice.recipientName || invoice.clientName, `${invoice.recipient.street} ${invoice.recipient.houseNumber}`.trim(),
    `${invoice.recipient.postalCode} ${invoice.recipient.city}`, invoice.recipient.country !== 'Deutschland' ? invoice.recipient.country : ''].filter(Boolean).flatMap(value => lines(value, 88));
  let addressY = y + 8;
  recipientLines.forEach(row => { write(row, left, addressY); addressY += 5; });
  const info: [string, string][] = [['Rechnungsnummer', number], ['Rechnungsdatum', formatDate(invoice.issuedDate)],
    ['Leistungszeitraum', `${formatDate(invoice.servicePeriodStart)} - ${formatDate(invoice.servicePeriodEnd)}`], ['Fällig am', formatDate(invoice.dueDate)]];
  if (invoice.recipient.customerNumber) info.push(['Kundennummer', invoice.recipient.customerNumber]);
  if (invoice.insuredNumber) info.push(['Versichertennummer', invoice.insuredNumber]);
  let infoY = y;
  info.forEach(([label, value]) => { font(7, false, muted); write(label, 119, infoY); infoY += 4; font(8, true); const valueLines = lines(value, 73); write(valueLines, 119, infoY); infoY += valueLines.length * 4 + 4; });
  y = Math.max(addressY, infoY) + 8;
  font(23, true); write(draft ? 'Rechnungsentwurf' : 'Rechnung', left, y); y += 10;
  if (draft) paragraph('ENTWURF · Keine Zahlungsaufforderung. Die Vorschau vergibt keine Rechnungsnummer.', 8, true, accent);
  if (invoice.recipientName && invoice.recipientName !== invoice.clientName) paragraph(`Leistungen für ${invoice.clientName}`, 9, true, ink);
  paragraph('Für die im genannten Zeitraum erbrachten Leistungen berechnen wir:', 9);
  y += 2;
  const tableHeader = () => {
    reserve(14); pdf.setFillColor(...ink); pdf.roundedRect(left, y, contentWidth, 9, 1.2, 1.2, 'F'); font(6.8, true, [255, 255, 255]);
    write('POS.', 21, y + 6); write('LEISTUNG', 32, y + 6); write('MENGE', 119, y + 6, { align: 'right' });
    write('EINZELPREIS', 147, y + 6, { align: 'right' }); write('UST.', 164, y + 6, { align: 'right' }); write('GESAMT', 189, y + 6, { align: 'right' }); y += 12;
  };
  tableHeader();
  invoice.lineItems.forEach((item, index) => {
    font(8.3);
    const description = lines(item.description, 69);
    const normalized = item.unit?.toLowerCase();
    const unit = ['hour', 'stunde', 'stunden'].includes(normalized || '') ? 'Std.' : item.unit || '';
    const quantity = lines(`${formatQuantity(item.quantity)} ${unit}`.trim(), 20);
    const rowLines = Math.max(description.length, quantity.length);
    let offset = 0;
    while (offset < rowLines) {
      if (y + 11 > bottom) { newPage(); tableHeader(); }
      const count = Math.min(rowLines - offset, Math.max(1, Math.floor((bottom - y - 5) / 4.3)));
      const height = Math.max(11, count * 4.3 + 5);
      if (index % 2 === 0) { pdf.setFillColor(...pale); pdf.rect(left, y - 1, contentWidth, height, 'F'); }
      font(8.3);
      write(offset === 0 ? String(index + 1) : '…', 24, y + 5, { align: 'center' });
      write(description.slice(offset, offset + count), 32, y + 5);
      write(quantity.slice(offset, offset + count), 119, y + 5, { align: 'right' });
      if (offset === 0) {
        write(formatMoney(item.unitPriceCents), 147, y + 5, { align: 'right' });
        write(`${formatQuantity(item.taxRatePercent ?? 0)} %`, 164, y + 5, { align: 'right' });
        font(8.3, true); write(formatMoney(item.totalCents), 189, y + 5, { align: 'right' });
      }
      offset += count; y += height;
      if (offset < rowLines) { newPage(); tableHeader(); }
    }
  });
  reserve(38); y += 8;
  const net = invoice.lineItems.reduce((sum, item) => sum + Math.round(item.quantity * item.unitPriceCents), 0);
  const taxGroups = new Map<number, number>();
  invoice.lineItems.forEach(item => { const rate = item.taxRatePercent ?? 0; taxGroups.set(rate, (taxGroups.get(rate) || 0) + Math.round(Math.round(item.quantity * item.unitPriceCents) * rate / 100)); });
  const totalRow = (label: string, value: number, bold = false) => { reserve(9); font(bold ? 10 : 8.8, bold); write(label, 112, y); write(formatMoney(value), right, y, { align: 'right' }); y += bold ? 10 : 7; };
  totalRow('Nettobetrag', net);
  for (const [rate, value] of taxGroups) totalRow(`Umsatzsteuer ${formatQuantity(rate)} %`, value);
  totalRow('Rechnungsbetrag', invoice.amountCents, true); y += 3;
  if (invoice.taxNotice?.trim()) paragraph(invoice.taxNotice.trim(), 8.2);
  if (invoice.notes?.trim()) paragraph(invoice.notes.trim(), 8.6);
  reserve(24);
  paragraph(draft ? `Vorgesehene Zahlung bis ${formatDate(invoice.dueDate)}` : `Zahlbar bis ${formatDate(invoice.dueDate)}`, 9, true, ink);
  paragraph(`Bankverbindung: ${company.bankName} · IBAN ${company.iban}${company.bic ? ` · BIC ${company.bic}` : ''}`, 8.2);
  if (!draft) paragraph(`Verwendungszweck: ${invoice.invoiceNumber}`, 8.6, true, accent);
  if (company.footerText && company.footerText !== invoice.taxNotice) paragraph(company.footerText, 8);
  const legalDetails = [company.representativeName ? `Vertreten durch ${company.representativeName}` : '', company.registerCourt, company.registerNumber,
    company.taxNumber ? `Steuernummer ${company.taxNumber}` : '', company.vatId ? `USt-IdNr. ${company.vatId}` : '', company.ikNumber ? `IK ${company.ikNumber}` : ''].filter(Boolean).join(' · ');
  if (legalDetails) paragraph(legalDetails, 7.4);
  const contactDetails = [company.phone, company.email, company.website].filter(Boolean).join(' · ');
  if (contactDetails) paragraph(contactDetails, 7.4);
  if (data.annexPages?.length) paragraph(`Anlagen: ${data.annexPages.length} PDF-Seite(n) ausgewählter Leistungsnachweise. Die Anlagen sind PDF-Kopien; gespeicherte Originale bleiben unverändert.`, 8);
  const invoicePages = pdf.getNumberOfPages();
  for (const page of data.annexPages ?? []) {
    const landscape = page.width > page.height;
    pdf.addPage('a4', landscape ? 'landscape' : 'portrait');
    const width = landscape ? 297 : 210, height = landscape ? 210 : 297;
    font(8, true); write(`Anlage · PDF-Kopie · ${page.title}`, 12, 10);
    const scale = Math.min((width - 24) / page.width, (height - 30) / page.height);
    pdf.addImage(page.dataUrl, 'PNG', (width - page.width * scale) / 2, 15, page.width * scale, page.height * scale, undefined, 'SLOW');
    font(6.5, false, muted); write(`Originalseite ${page.sourcePage} von ${page.sourcePages} · ${draft ? 'Rechnungsentwurf' : invoice.invoiceNumber}`, 12, height - 8);
  }
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    const width = pdf.internal.pageSize.getWidth(), height = pdf.internal.pageSize.getHeight();
    if (page <= invoicePages) {
      pdf.setDrawColor(...line); pdf.line(left, 263, right, 263);
      font(7, true, muted); write(draft ? 'Rechnungsentwurf' : `Rechnung ${invoice.invoiceNumber}`, left, 271);
      font(5.7, false, muted); write('Erstellt mit: CareSuite HealthOS Software Technologie', left, 291);
      if (invoice.id) write(`Rechnungs-ID: ${invoice.id}`, left, 295);
    }
    font(6.5, false, muted); write(`Seite ${page} von ${pages}`, width - 12, height - 3, { align: 'right' });
    if (draft) {
      // Mark every invoice and annex page; a detached page still remains identifiable as a preview.
      font(7, true, [187, 91, 30]); write('ENTWURF · NICHT VERSENDET', width - 12, height - 12, { align: 'right' });
    }
  }
  const fileName = `${draft ? 'Entwurf_' : ''}${sanitizeFileName(invoice.invoiceNumber || 'Rechnung')}_${sanitizeFileName(invoice.clientName)}.pdf`;
  return { fileName, bytes: new Uint8Array(pdf.output('arraybuffer')), validation, companySnapshot: company };
}

export async function previewPreparedInvoicePdf(payload: PreparedInvoicePdf, target?: Window | null): Promise<void> {
  const { previewInvoicePdf } = await import('./invoicePdfDelivery');
  await previewInvoicePdf(payload, target);
}

export async function downloadPreparedInvoicePdf(payload: PreparedInvoicePdf): Promise<void> {
  const { downloadInvoicePdf } = await import('./invoicePdfDelivery');
  await downloadInvoicePdf(payload);
}

export function draftToPdfInvoice(tenantId: string, draft: InvoiceOfficeDraft): OfficePdfInvoice {
  const calculated = calculateOfficeInvoiceLines(draft.lines);
  const modules = new Set(draft.lines.map(line => line.productKey));
  return { id: draft.id || '', tenantId, clientId: draft.clientId, clientName: draft.clientName || draft.recipient.name, recipientName: draft.recipient.name, insuredNumber: draft.insuranceNumber,
    invoiceNumber: draft.invoiceNumber, issuedDate: draft.invoiceDate, dueDate: draft.dueDate, amountCents: calculated.totalCents, currency: 'EUR',
    servicePeriodStart: draft.servicePeriodStart, servicePeriodEnd: draft.servicePeriodEnd, status: 'draft',
    createdAt: draft.invoiceDate, updatedAt: draft.expectedUpdatedAt || draft.invoiceDate, billingModule: modules.size === 1 ? draft.lines[0].productKey : 'mixed',
    recipient: { ...draft.recipient, customerNumber: draft.clientNumber || '' }, taxNotice: draft.footerText, notes: draft.notes, footerText: draft.footerText,
    lineItems: calculated.lines.map((line, index) => ({ id: line.id || `preview-${index}`, description: line.description, quantity: line.quantity, unit: line.unit,
      unitPriceCents: line.unitPriceCents, taxRatePercent: line.taxRatePercent, netTotalCents: line.netCents, taxCents: line.taxCents, totalCents: line.totalCents })),
    auditEntries: [], allowedStatusActions: [], nextActionHint: '' };
}

export function officeInvoiceToPdfInvoice(invoice: OfficeInvoice): OfficePdfInvoice {
  if (invoice.status === 'draft' && (invoice.amountCents === null || invoice.lines.some(line => line.netCents === null || line.taxCents === null || line.totalCents === null))) throw new Error('Die Rechnungsbeträge sind unvollständig. Bitte die Positionen prüfen.');
  return { id: invoice.id, tenantId: invoice.tenantId, clientId: invoice.clientId || '', clientName: invoice.clientName,
    recipientName: invoice.recipient.name, insuredNumber: invoice.insuranceNumber, invoiceNumber: invoice.invoiceNumber, amountCents: invoice.amountCents ?? Number.NaN,
    currency: 'EUR', status: invoice.status, dueDate: invoice.dueDate || '', issuedDate: invoice.invoiceDate,
    servicePeriodStart: invoice.servicePeriodStart, servicePeriodEnd: invoice.servicePeriodEnd, billingModule: invoice.billingModule,
    createdAt: invoice.createdAt, updatedAt: invoice.updatedAt, recipient: { ...invoice.recipient, customerNumber: invoice.clientNumber },
    taxNotice: invoice.footerText, footerText: invoice.footerText || '', notes: invoice.notes, pdfStoragePath: invoice.pdfFilePath,
    companySnapshot: invoice.companySnapshot ? normalizeInvoiceCompanySnapshot(invoice.companySnapshot) : null,
    lineItems: invoice.lines.map(line => ({ id: line.id, description: line.description, quantity: line.quantity, unit: line.unit,
      unitPriceCents: line.unitPriceCents, taxRatePercent: line.taxRatePercent, netTotalCents: line.netCents!, taxCents: line.taxCents!, totalCents: line.totalCents! })),
    auditEntries: [], allowedStatusActions: [], nextActionHint: '' };
}

/** SQL snapshots use the same named company fields; aliases support existing stored snapshots. */
export function normalizeInvoiceCompanySnapshot(input: Record<string, unknown>): InvoicePdfCompany {
  const aliases: Record<keyof InvoicePdfCompany, string> = { legalName: 'legal_name', street: 'street', houseNumber: 'house_number', postalCode: 'postal_code', city: 'city', country: 'country',
    phone: 'phone', email: 'email', website: 'website', taxNumber: 'tax_number', vatId: 'vat_id', registerCourt: 'register_court', registerNumber: 'register_number', ikNumber: 'ik_number',
    representativeName: 'representative_name', bankName: 'bank_name', iban: 'iban', bic: 'bic', logoUrl: 'logo_url', footerText: 'invoice_footer_text' };
  return Object.fromEntries(Object.entries(aliases).map(([field, alias]) => [field, value(input, field) || value(input, alias)])) as InvoicePdfCompany;
}

export async function prepareOfficeInvoicePdf(tenantId: string, invoice: OfficePdfInvoice, actorRoleKey?: RoleKey | null, options: { proofIds?: string[] } = {}): Promise<ServiceResult<PreparedInvoicePdf>> {
  const denied = enforcePermission<PreparedInvoicePdf>(actorRoleKey, 'office.invoices.view');
  if (denied) return denied;
  if (invoice.tenantId !== tenantId) return { ok: false, error: 'Die Rechnung gehört nicht zum gewählten Unternehmen.' };
  try {
    if (invoice.status !== 'draft') {
      if (!invoice.pdfStoragePath) return { ok: false, error: 'Für diese ausgestellte Rechnung ist keine archivierte PDF hinterlegt. Die ursprüngliche Datei muss in der Rechnungsakte ergänzt werden.' };
      if (!isTenantStoragePath(invoice.pdfStoragePath, tenantId)) return { ok: false, error: 'Der Verweis auf die archivierte Rechnung ist ungültig.' };
      const client = getSupabaseClient();
      if (!client) return { ok: false, error: 'Die archivierte Rechnung kann gerade nicht geladen werden.' };
      // Resolve the path against the actual invoice, never trust a caller-supplied tenant path.
      const stored = await fromUnknownTable(client, 'invoices').select('id,tenant_id,pdf_file_path').eq('tenant_id', tenantId).eq('id', invoice.id).maybeSingle();
      const archive = stored.data as Record<string, unknown> | null;
      if (stored.error || !archive || archive.id !== invoice.id || archive.tenant_id !== tenantId || archive.pdf_file_path !== invoice.pdfStoragePath) return { ok: false, error: 'Die archivierte Rechnung ist nicht mehr in dieser Fassung verfügbar. Bitte neu laden.' };
      const downloaded = await client.storage.from('office-documents').download(invoice.pdfStoragePath);
      if (downloaded.error || !downloaded.data) return { ok: false, error: 'Die archivierte Rechnung konnte nicht geöffnet werden. Bitte erneut versuchen.' };
      const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
      await validateInvoicePdfBytes(bytes);
      return { ok: true, data: { fileName: `${sanitizeFileName(invoice.invoiceNumber)}_${sanitizeFileName(invoice.clientName)}.pdf`, bytes, validation: { errors: [], warnings: [] } } };
    }
    const loaded = await fetchInvoicePdfData(tenantId, invoice, actorRoleKey);
    if (!loaded.ok) return loaded;
    const proofIds = options.proofIds ?? [];
    const annexPages = await loadInvoiceProofPages({ tenantId, clientId: invoice.clientId, start: invoice.servicePeriodStart || '', end: invoice.servicePeriodEnd || '', invoiceId: invoice.id, proofIds, actorRoleKey });
    const prepared = await generateInvoicePdf({ ...loaded.data, annexPages });
    return { ok: true, data: { ...prepared, proofIds } };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Die Rechnungs-PDF konnte nicht erstellt werden.' }; }
}

export async function prepareOfficeDraftPdf(tenantId: string, draft: InvoiceOfficeDraft, actorRoleKey?: RoleKey | null, options: { proofIds?: string[] } = {}): Promise<ServiceResult<PreparedInvoicePdf>> {
  const selectedProofIds = draft.includeProofs ? options.proofIds ?? draft.selectedProofIds ?? [] : [];
  const issues = validateOfficeInvoiceDraft({ ...draft, selectedProofIds });
  if (issues.length) return { ok: false, error: issues.join(' ') };
  return prepareOfficeInvoicePdf(tenantId, draftToPdfInvoice(tenantId, draft), actorRoleKey, { proofIds: selectedProofIds });
}
