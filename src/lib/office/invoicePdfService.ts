import type { RoleKey, ServiceResult } from '@/types';
import type { InvoiceDetail } from '@/types/modules/invoiceDetail';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

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
  invoice: InvoiceDetail;
  company: InvoicePdfCompany;
};

export type InvoicePdfValidation = {
  errors: string[];
  warnings: string[];
};

export type PreparedInvoicePdf = {
  fileName: string;
  bytes: Uint8Array;
  validation: InvoicePdfValidation;
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
  invoice: InvoiceDetail,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InvoicePdfData>> {
  const denied = enforcePermission<InvoicePdfData>(actorRoleKey, 'office.invoices.view');
  if (denied) return denied;

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

  const [tenantResult, taxResult, bankResult, brandingResult, billingResult] = await Promise.all([
    fromUnknownTable(client, 'tenants')
      .select('name, legal_name, street, house_number, postal_code, city, country, phone, email, website, tax_number, vat_id, register_court, register_number, ik_number, representative_name')
      .eq('id', tenantId)
      .maybeSingle(),
    fromUnknownTable(client, 'tenant_tax_profiles').select('tax_number, vat_id').eq('tenant_id', tenantId).maybeSingle(),
    fromUnknownTable(client, 'tenant_bank_accounts').select('bank_name, iban, bic, is_primary, sort_order').eq('tenant_id', tenantId).order('is_primary', { ascending: false }).order('sort_order').limit(1),
    fromUnknownTable(client, 'tenant_branding').select('logo_url').eq('tenant_id', tenantId).maybeSingle(),
    fromUnknownTable(client, 'tenant_billing_settings').select('invoice_footer_text').eq('tenant_id', tenantId).maybeSingle(),
  ]);

  if (tenantResult.error || !tenantResult.data) {
    return { ok: false, error: 'Unternehmensdaten für die Rechnung konnten nicht geladen werden.' };
  }

  const tenant = tenantResult.data as Record<string, unknown>;
  const tax = taxResult.data as Record<string, unknown> | null;
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
        taxNumber: value(tax, 'tax_number') || value(tenant, 'tax_number'),
        vatId: value(tax, 'vat_id') || value(tenant, 'vat_id'),
        registerCourt: value(tenant, 'register_court'),
        registerNumber: value(tenant, 'register_number'),
        ikNumber: value(tenant, 'ik_number'),
        representativeName: value(tenant, 'representative_name'),
        bankName: value(bank, 'bank_name'),
        iban: value(bank, 'iban'),
        bic: value(bank, 'bic'),
        logoUrl: value(branding, 'logo_url'),
        footerText: value(billing, 'invoice_footer_text'),
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
  require(Boolean(company.street && company.houseNumber && company.postalCode && company.city), 'Vollständige Unternehmensanschrift fehlt.');
  require(Boolean(company.taxNumber || company.vatId), 'Steuernummer oder Umsatzsteuer-ID fehlt.');
  require(Boolean(invoice.clientName), 'Name der Rechnungsempfänger:in fehlt.');
  require(Boolean(invoice.recipient.street && invoice.recipient.houseNumber && invoice.recipient.postalCode && invoice.recipient.city), 'Vollständige Empfängeranschrift fehlt.');
  require(Boolean(invoice.invoiceNumber), 'Eindeutige Rechnungsnummer fehlt.');
  require(Boolean(invoice.issuedDate), 'Rechnungsdatum fehlt.');
  require(Boolean(invoice.servicePeriodStart && invoice.servicePeriodEnd), 'Leistungszeitraum fehlt.');
  require(Boolean(invoice.dueDate), 'Fälligkeitsdatum fehlt.');
  require(invoice.lineItems.length > 0, 'Mindestens eine Rechnungsposition ist erforderlich.');
  require(Boolean(company.bankName && company.iban), 'Bankverbindung für die Zahlung fehlt.');

  const itemGross = invoice.lineItems.reduce((sum, item) => sum + item.totalCents, 0);
  if (Math.abs(itemGross - invoice.amountCents) > 1) {
    errors.push('Positionssumme und Rechnungsbetrag stimmen nicht überein.');
  }
  const hasZeroTax = invoice.lineItems.some((item) => (item.taxRatePercent ?? 0) === 0);
  if (hasZeroTax && !invoice.taxNotice?.trim()) {
    warnings.push('Für steuerfreie Positionen wird der allgemeine Hinweis „Umsatzsteuerfreie Leistung“ verwendet.');
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
  return `${new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)} EUR`;
}

function formatQuantity(quantity: number): string {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(quantity);
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9ÄÖÜäöüß._-]+/g, '_').replace(/^_+|_+$/g, '');
}

async function loadLogoDataUrl(url: string): Promise<string | null> {
  if (!url || typeof FileReader === 'undefined') return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('Logo konnte nicht gelesen werden.'));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<PreparedInvoicePdf> {
  if (typeof document === 'undefined') {
    throw new Error('PDF-Erzeugung ist derzeit im Web-Browser verfügbar.');
  }
  return renderInvoicePdfDocument(data);
}

/** Pure PDF renderer used by browser delivery and visual regression tooling. */
export async function renderInvoicePdfDocument(data: InvoicePdfData): Promise<PreparedInvoicePdf> {
  const validation = validateInvoicePdf(data);
  if (validation.errors.length > 0) {
    throw new Error(`PDF gesperrt: ${validation.errors.join(' ')}`);
  }

  // @ts-expect-error jspdf ships no type declarations for its ESM browser entry
  const { jsPDF } = await import('jspdf/dist/jspdf.es.min.js');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const { invoice, company } = data;
  const logo = await loadLogoDataUrl(company.logoUrl);
  const width = 210;
  const left = 18;
  const right = 192;
  const contentWidth = right - left;
  const ink: [number, number, number] = [30, 35, 48];
  const muted: [number, number, number] = [94, 103, 120];
  const violet: [number, number, number] = [132, 83, 246];
  const pink: [number, number, number] = [236, 63, 155];
  const cyan: [number, number, number] = [31, 194, 224];
  const pale: [number, number, number] = [246, 247, 251];
  const line: [number, number, number] = [222, 226, 235];

  const drawHeader = () => {
    pdf.setFillColor(...violet);
    pdf.rect(0, 0, width * 0.5, 4, 'F');
    pdf.setFillColor(...pink);
    pdf.rect(width * 0.5, 0, width * 0.3, 4, 'F');
    pdf.setFillColor(...cyan);
    pdf.rect(width * 0.8, 0, width * 0.2, 4, 'F');
    if (logo) {
      const format = logo.includes('image/png') ? 'PNG' : 'JPEG';
      try { pdf.addImage(logo, format, 158, 12, 34, 16, undefined, 'FAST'); } catch { /* text fallback below */ }
    }
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(...ink);
    pdf.text(pdf.splitTextToSize(company.legalName, 112), left, 18);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(...muted);
    pdf.text(`${company.street} ${company.houseNumber} · ${company.postalCode} ${company.city}`, left, 25);
  };

  const drawFooter = (page: number, totalPages: number) => {
    pdf.setDrawColor(...line);
    pdf.line(left, 272, right, 272);
    pdf.setFontSize(7.2);
    pdf.setTextColor(...muted);
    const companyLines = [company.legalName, `${company.street} ${company.houseNumber}`, `${company.postalCode} ${company.city}`];
    const contactLines = [company.phone, company.email, company.website].filter(Boolean);
    const bankLines = [`${company.bankName}`, `IBAN ${company.iban}`, company.bic ? `BIC ${company.bic}` : ''].filter(Boolean);
    pdf.text(companyLines, left, 278);
    pdf.text(contactLines, 75, 278);
    pdf.text(bankLines, 132, 278);
    const registerParts = [
      company.representativeName ? `Vertreten durch ${company.representativeName}` : '',
      company.registerCourt,
      company.registerNumber,
    ].filter(Boolean).join(' · ');
    const legalParts = [company.taxNumber ? `St.-Nr. ${company.taxNumber}` : '', company.vatId ? `USt-IdNr. ${company.vatId}` : '', company.ikNumber ? `IK ${company.ikNumber}` : ''].filter(Boolean).join(' · ');
    pdf.text(registerParts, left, 289);
    pdf.text(legalParts, left, 293);
    pdf.text(`Seite ${page} von ${totalPages}`, right, 293, { align: 'right' });
  };

  drawHeader();
  pdf.setDrawColor(...line);
  pdf.line(left, 31, right, 31);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(...muted);
  pdf.text(`${company.legalName} · ${company.street} ${company.houseNumber} · ${company.postalCode} ${company.city}`, left, 39);

  pdf.setFontSize(10.5);
  pdf.setTextColor(...ink);
  pdf.text(invoice.clientName, left, 49);
  pdf.text(`${invoice.recipient.street} ${invoice.recipient.houseNumber}`, left, 55);
  pdf.text(`${invoice.recipient.postalCode} ${invoice.recipient.city}`, left, 61);
  if (invoice.recipient.country && invoice.recipient.country !== 'Deutschland') pdf.text(invoice.recipient.country, left, 67);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(25);
  pdf.text('RECHNUNG', left, 86);
  pdf.setFontSize(11);
  pdf.setTextColor(...violet);
  pdf.text(invoice.invoiceNumber, left, 94);

  pdf.setFillColor(...pale);
  pdf.roundedRect(118, 39, 74, 50, 3, 3, 'F');
  const info = [
    ['Rechnungsnummer', invoice.invoiceNumber],
    ['Rechnungsdatum', formatDate(invoice.issuedDate)],
    ['Leistungszeitraum', `${formatDate(invoice.servicePeriodStart)} - ${formatDate(invoice.servicePeriodEnd)}`],
    ['Fällig am', formatDate(invoice.dueDate)],
    ['Kundennummer', invoice.recipient.customerNumber || '—'],
  ];
  let infoY = 47;
  info.forEach(([label, current]) => {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.3);
    pdf.setTextColor(...muted);
    pdf.text(label, 123, infoY);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.3);
    pdf.setTextColor(...ink);
    pdf.text(current, 154, infoY);
    infoY += 8.2;
  });

  if (invoice.status === 'draft') {
    pdf.setTextColor(225, 228, 235);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(38);
    pdf.text('ENTWURF', 105, 150, { align: 'center', angle: 35 });
  }

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(...ink);
  pdf.text('Sehr geehrte Damen und Herren,', left, 106);
  pdf.text('für die im genannten Zeitraum erbrachten Leistungen berechnen wir:', left, 113);

  let y = 124;
  const drawTableHead = () => {
    pdf.setFillColor(...ink);
    pdf.roundedRect(left, y, contentWidth, 10, 2, 2, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(255, 255, 255);
    pdf.text('POS.', 21, y + 6.3);
    pdf.text('LEISTUNG', 34, y + 6.3);
    pdf.text('MENGE', 116, y + 6.3, { align: 'right' });
    pdf.text('EINZELPREIS', 148, y + 6.3, { align: 'right' });
    pdf.text('MWST.', 165, y + 6.3, { align: 'right' });
    pdf.text('GESAMT', right - 3, y + 6.3, { align: 'right' });
    y += 12;
  };
  drawTableHead();

  invoice.lineItems.forEach((item, index) => {
    const descriptionLines = pdf.splitTextToSize(item.description, 70) as string[];
    const rowHeight = Math.max(11, descriptionLines.length * 4.2 + 4);
    if (y + rowHeight > 255) {
      pdf.addPage();
      drawHeader();
      y = 40;
      drawTableHead();
    }
    if (index % 2 === 0) {
      pdf.setFillColor(...pale);
      pdf.rect(left, y - 1, contentWidth, rowHeight, 'F');
    }
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(...ink);
    pdf.text(String(index + 1), 24, y + 5, { align: 'center' });
    pdf.text(descriptionLines, 34, y + 5);
    const normalizedUnit = item.unit?.toLowerCase();
    const unit = item.unit
      ? ` ${normalizedUnit === 'hour' || normalizedUnit === 'stunde' ? 'Std.' : item.unit}`
      : '';
    pdf.text(`${formatQuantity(item.quantity)}${unit}`, 116, y + 5, { align: 'right' });
    pdf.text(formatMoney(item.unitPriceCents), 148, y + 5, { align: 'right' });
    pdf.text(`${formatQuantity(item.taxRatePercent ?? 0)} %`, 165, y + 5, { align: 'right' });
    pdf.setFont('helvetica', 'bold');
    pdf.text(formatMoney(item.totalCents), right - 3, y + 5, { align: 'right' });
    y += rowHeight;
  });

  const netTotal = invoice.lineItems.reduce((sum, item) => sum + (item.netTotalCents ?? item.totalCents - (item.taxCents ?? 0)), 0);
  const taxTotal = invoice.lineItems.reduce((sum, item) => sum + (item.taxCents ?? 0), 0);
  if (y > 225) {
    pdf.addPage();
    drawHeader();
    y = 45;
  }
  y += 8;
  const totalsX = 128;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(...muted);
  pdf.text('Nettobetrag', totalsX, y);
  pdf.setTextColor(...ink);
  pdf.text(formatMoney(netTotal), right, y, { align: 'right' });
  y += 7;
  pdf.setTextColor(...muted);
  pdf.text('Umsatzsteuer', totalsX, y);
  pdf.setTextColor(...ink);
  pdf.text(formatMoney(taxTotal), right, y, { align: 'right' });
  y += 8;
  pdf.setDrawColor(...violet);
  pdf.setLineWidth(0.7);
  pdf.line(totalsX, y - 4, right, y - 4);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text('Rechnungsbetrag', totalsX, y + 2);
  pdf.setTextColor(...violet);
  pdf.text(formatMoney(invoice.amountCents), right, y + 2, { align: 'right' });
  y += 14;

  const taxNotice = invoice.taxNotice?.trim() || (taxTotal === 0 ? 'Umsatzsteuerfreie Leistung.' : '');
  if (taxNotice) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.3);
    pdf.setTextColor(...muted);
    pdf.text(pdf.splitTextToSize(taxNotice, contentWidth), left, y);
    y += 10;
  }
  pdf.setFillColor(248, 246, 255);
  pdf.roundedRect(left, y, contentWidth, 25, 3, 3, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.setTextColor(...ink);
  pdf.text(`Zahlbar bis ${formatDate(invoice.dueDate)}`, left + 5, y + 8);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.2);
  pdf.text(`Bitte überweisen Sie auf ${company.iban} bei ${company.bankName}.`, left + 5, y + 15);
  pdf.text(`Verwendungszweck: ${invoice.invoiceNumber}`, left + 5, y + 21);

  if (company.footerText) {
    pdf.setFontSize(7.5);
    pdf.setTextColor(...muted);
    pdf.text(pdf.splitTextToSize(company.footerText, contentWidth), left, Math.min(y + 35, 266));
  }

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    drawFooter(page, pages);
  }

  const fileName = `${sanitizeFileName(invoice.invoiceNumber)}_${sanitizeFileName(invoice.clientName)}.pdf`;
  return { fileName, bytes: new Uint8Array(pdf.output('arraybuffer')), validation };
}

function createPdfUrl(bytes: Uint8Array): string {
  return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
}

export function previewPreparedInvoicePdf(payload: PreparedInvoicePdf, target?: Window | null): void {
  const url = createPdfUrl(payload.bytes);
  const preview = target ?? window.open('', '_blank');
  if (!preview) {
    URL.revokeObjectURL(url);
    throw new Error('PDF-Vorschau wurde vom Browser blockiert. Bitte Pop-ups erlauben.');
  }
  preview.location.href = url;
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function downloadPreparedInvoicePdf(payload: PreparedInvoicePdf): void {
  const url = createPdfUrl(payload.bytes);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = payload.fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
