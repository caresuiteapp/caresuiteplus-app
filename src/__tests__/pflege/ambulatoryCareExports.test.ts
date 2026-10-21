import { describe, expect, it, vi } from 'vitest';
vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));
import { buildCareFoundationCsv, type CareFoundationDetail } from '@/lib/pflege/careInvoiceFoundationService';
import { generateCareProofPdf } from '@/lib/pflege/careProofPdfService';
import type { PflegeServiceProofItem } from '@/types/modules/pflege';
const foundation: CareFoundationDetail = { id: 'test', number: 'PF-TEST', clientId: 'client', from: '2026-10-01', to: '2026-10-31', recipient: 'Kasse "Test"', recipientIk: '123456789', totalCents: 3275, lines: [{ id: 'case', proofId: 'proof', date: '2026-10-02', serviceCode: '=IMPORTXML("malicious")', amountCents: 3275, status: 'invoiced' }] };
describe('Pflege-Exporte', () => {
  it('escapes CSV text, protects spreadsheet formulas and preserves amounts', () => {
    const csv = buildCareFoundationCsv(foundation); expect(csv).toContain('"32,75"'); expect(csv).toContain('"Kasse ""Test"""'); expect(csv).toContain('"\'=IMPORTXML'); expect(csv.split('\r\n')).toHaveLength(2);
  });
  it('creates a real PDF from the recorded proof', async () => {
    const proof = { id: 'proof', status: 'draft', clientName: 'Testperson', serviceDate: '2026-10-02', startedAt: '2026-10-02T07:00:00Z', endedAt: '2026-10-02T07:30:00Z', durationMinutes: 30, serviceCode: 'LK01', serviceLabel: 'Testleistung', legalBasis: 'sgb_xi', costCarrierName: 'Testkasse', grossAmountCents: 3275, performanceNote: 'Versorgung dokumentiert.', employeeName: 'Testpflegekraft' } as PflegeServiceProofItem;
    const pdf = await generateCareProofPdf(proof, null); expect(new TextDecoder().decode(pdf.bytes.slice(0, 8))).toMatch(/^%PDF-/); expect(pdf.bytes.length).toBeGreaterThan(1000); expect(pdf.fileName).toContain('2026-10-02');
  });
  it('blocks a signed export when signature evidence has not loaded', async () => { await expect(generateCareProofPdf({ status: 'signed' } as PflegeServiceProofItem, null)).rejects.toThrow(/Unterschrift/); });
});
