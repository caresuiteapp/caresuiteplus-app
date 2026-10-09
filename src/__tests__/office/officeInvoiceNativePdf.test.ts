import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateInvoicePdf, type InvoicePdfData, type PreparedInvoicePdf } from '@/lib/office/invoicePdfService';
import { previewInvoicePdf, downloadInvoicePdf } from '@/lib/office/invoicePdfDelivery';
import * as webDelivery from '@/lib/office/invoicePdfDelivery.web';

const native = vi.hoisted(() => ({
  available: vi.fn(), share: vi.fn(), folder: vi.fn(), create: vi.fn(), write: vi.fn(), names: [] as string[],
}));
vi.mock('expo-file-system', () => ({
  Paths: { cache: 'file://cache' },
  Directory: class {
    uri: string;
    constructor(base: string, name: string) { this.uri = `${base}/${name}`; }
    create = native.folder;
  },
  File: class {
    uri: string;
    constructor(folder: { uri: string }, name: string) { native.names.push(name); this.uri = `${folder.uri}/${name}`; }
    create = native.create;
    write = native.write;
  },
}));
vi.mock('expo-sharing', () => ({ isAvailableAsync: native.available, shareAsync: native.share }));
const payload: PreparedInvoicePdf = {
  fileName: 'Rechnung.pdf', bytes: new Uint8Array([37, 80, 68, 70]), validation: { errors: [], warnings: [] },
};

beforeEach(() => {
  vi.clearAllMocks(); native.names.length = 0;
  native.available.mockResolvedValue(true); native.share.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllGlobals());

describe('Native invoice PDF delivery', () => {
  it('provides actual PDF bytes to the system share sheet without browser globals', async () => {
    await previewInvoicePdf(payload);
    expect(native.write).toHaveBeenCalledWith(payload.bytes);
    expect(native.share).toHaveBeenCalledWith('file://cache/caresuite-invoices/Rechnung.pdf', {
      mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Rechnung öffnen oder teilen',
    });
  });
  it('allows saving/sharing with a filename that cannot escape the app cache directory', async () => {
    await downloadInvoicePdf({ ...payload, fileName: '../../other/Invoice.pdf' });
    expect(native.names[0]).not.toMatch(/[/\\]|^\./);
    expect(native.share).toHaveBeenCalledWith(expect.stringContaining('/caresuite-invoices/'), expect.objectContaining({ dialogTitle: 'Rechnung speichern oder teilen' }));
  });
  it('reports unavailable sharing before writing files', async () => {
    native.available.mockResolvedValue(false);
    await expect(previewInvoicePdf(payload)).rejects.toThrow('diesem Gerät');
    expect(native.write).not.toHaveBeenCalled(); expect(native.share).not.toHaveBeenCalled();
  });
  it('propagates file and share failures instead of claiming a successful download', async () => {
    native.write.mockImplementationOnce(() => { throw new Error('storage unavailable'); });
    await expect(downloadInvoicePdf(payload)).rejects.toThrow('storage unavailable');
    expect(native.share).not.toHaveBeenCalled();
    native.share.mockRejectedValueOnce(new Error('share unavailable'));
    await expect(downloadInvoicePdf(payload)).rejects.toThrow('share unavailable');
  });
});

describe('Browser invoice PDF delivery', () => {
  it('uses the preopened preview window and releases its object URL', async () => {
    const revoke = vi.fn(); const schedule = vi.fn((callback: () => void) => { callback(); return 1; });
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:invoice'), revokeObjectURL: revoke });
    vi.stubGlobal('window', { open: vi.fn(), setTimeout: schedule });
    const target = { location: { href: '' } } as Window;
    await webDelivery.previewInvoicePdf(payload, target);
    expect(target.location.href).toBe('blob:invoice'); expect(revoke).toHaveBeenCalledWith('blob:invoice');
  });
  it('reports a blocked popup and revokes the generated object URL', async () => {
    const revoke = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:invoice'), revokeObjectURL: revoke });
    vi.stubGlobal('window', { open: vi.fn(() => null) });
    await expect(webDelivery.previewInvoicePdf(payload)).rejects.toThrow('blockiert');
    expect(revoke).toHaveBeenCalledWith('blob:invoice');
  });
});

function invoiceData(): InvoicePdfData {
  return {
    company: {
      legalName: 'Testunternehmen', street: 'Teststraße', houseNumber: '1', postalCode: '10115', city: 'Berlin', country: 'Deutschland',
      phone: '', email: '', website: '', taxNumber: '123', vatId: '', registerCourt: '', registerNumber: '', ikNumber: '', representativeName: '',
      bankName: 'Testbank', iban: 'DE89370400440532013000', bic: 'COBADEFFXXX', logoUrl: '', footerText: '',
    },
    invoice: {
      id: 'invoice-1', tenantId: 'tenant-1', clientId: 'client-1', clientName: 'Testperson', invoiceNumber: 'RE-1', amountCents: 1000, currency: 'EUR',
      dueDate: '2026-10-15', status: 'draft', billingModule: 'assist', updatedAt: '2026-10-02', createdAt: '2026-10-02', issuedDate: '2026-10-02',
      servicePeriodStart: '2026-10-01', servicePeriodEnd: '2026-10-01',
      recipient: { street: 'Testweg', houseNumber: '2', postalCode: '10115', city: 'Berlin', country: 'Deutschland', customerNumber: 'K-1' },
      taxNotice: 'Umsatzsteuerfreie Leistung.', notes: null,
      lineItems: [{ id: 'line-1', description: 'Leistung', quantity: 1, unit: 'hour', unitPriceCents: 1000, netTotalCents: 1000, taxRatePercent: 0, taxCents: 0, totalCents: 1000 }],
      auditEntries: [], allowedStatusActions: ['ready'], nextActionHint: '',
    },
  };
}
describe('Invoice generation outside a browser', () => {
  it('renders a real PDF with no document/window and keeps mandatory validation', async () => {
    const generated = await generateInvoicePdf(invoiceData());
    expect(new TextDecoder().decode(generated.bytes.subarray(0, 5))).toBe('%PDF-');
    expect(generated.bytes.length).toBeGreaterThan(1000);
    expect(generated.fileName).toBe('RE-1_Testperson.pdf');
    const invalid = invoiceData(); invalid.company.legalName = '';
    await expect(generateInvoicePdf(invalid)).rejects.toThrow('Unternehmensname fehlt');
  });
});
