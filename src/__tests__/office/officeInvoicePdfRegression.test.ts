import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { validateInvoicePdf, type InvoicePdfData } from '@/lib/office/invoicePdfService';

function validData(): InvoicePdfData {
  return {
    company: {
      legalName: 'AVENTA GmbH',
      street: 'Musterstraße',
      houseNumber: '1',
      postalCode: '44623',
      city: 'Herne',
      country: 'Deutschland',
      phone: '+49 123 456789',
      email: 'rechnung@aventa.example',
      website: 'www.aventa.example',
      taxNumber: '325/1234/5678',
      vatId: '',
      registerCourt: '',
      registerNumber: '',
      ikNumber: '123456789',
      representativeName: 'Kevin Reinhardt',
      bankName: 'Musterbank',
      iban: 'DE89370400440532013000',
      bic: 'COBADEFFXXX',
      logoUrl: '',
      footerText: '',
    },
    invoice: {
      id: 'invoice-1',
      tenantId: 'tenant-1',
      clientId: 'client-1',
      clientName: 'Erika Mustermann',
      invoiceNumber: 'RE-202607-0001',
      amountCents: 13100,
      currency: 'EUR',
      dueDate: '2026-08-12',
      status: 'draft',
      updatedAt: '2026-07-29T10:00:00Z',
      createdAt: '2026-07-29T10:00:00Z',
      issuedDate: '2026-07-29',
      servicePeriodStart: '2026-07-01',
      servicePeriodEnd: '2026-07-31',
      recipient: {
        street: 'Beispielweg',
        houseNumber: '5',
        postalCode: '44625',
        city: 'Herne',
        country: 'Deutschland',
        customerNumber: 'K-1001',
      },
      taxNotice: 'Umsatzsteuerfreie Leistung gemäß § 4 Nr. 16 UStG.',
      notes: null,
      lineItems: [{
        id: 'item-1',
        description: 'Entlastungsleistung § 45b SGB XI',
        quantity: 4,
        unit: 'hour',
        unitPriceCents: 3275,
        netTotalCents: 13100,
        taxRatePercent: 0,
        taxCents: 0,
        totalCents: 13100,
      }],
      auditEntries: [],
      allowedStatusActions: ['ready', 'cancelled'],
      nextActionHint: '',
    },
  };
}

describe('Office Rechnungs-PDF', () => {
  it('akzeptiert eine vollständige und rechnerisch konsistente Rechnung', () => {
    const result = validateInvoicePdf(validData());
    expect(result.errors).toEqual([]);
    expect(result.warnings).toContain('Der PDF-Entwurf erhält ein sichtbares ENTWURF-Wasserzeichen.');
  });

  it('sperrt die PDF-Ausgabe bei fehlenden Pflichtangaben', () => {
    const data = validData();
    data.invoice.id = '';
    data.company.taxNumber = '';
    data.invoice.recipient.street = '';
    data.invoice.amountCents = 13000;
    const result = validateInvoicePdf(data);
    expect(result.errors).toContain('Steuernummer oder Umsatzsteuer-ID fehlt.');
    expect(result.errors).toContain('Eindeutige Rechnungs-ID fehlt.');
    expect(result.errors).toContain('Vollständige Empfängeranschrift fehlt.');
    expect(result.errors).toContain('Positionssumme und Rechnungsbetrag stimmen nicht überein.');
  });

  it('druckt die dauerhafte Rechnungs-ID und den CareSuite-Erstellerhinweis', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/office/invoicePdfService.ts'),
      'utf8',
    );
    expect(source).toContain('Rechnungs-ID: ${invoice.id}');
    expect(source).toContain('Erstellt mit: CareSuite HealthOS Software Technologie');
    expect(source).toContain("creator: 'CareSuite HealthOS Software Technologie'");
    expect(source).toContain("'tenant-logo',");
    expect(source).toContain("'SLOW',");
    expect(source).not.toContain("'FAST'");
    expect(source).toContain("pdf.addFont('CareSuiteSans-Regular.ttf'");
    expect(source).toContain("pdf.addFont('CareSuiteSans-Bold.ttf'");
  });
});
