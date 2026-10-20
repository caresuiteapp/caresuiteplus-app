import { describe, expect, it, vi } from 'vitest';
import { analyzePlanDocument, parseAnalysisResponse, readBoundedBody, validateDocument } from '../../../supabase/functions/employee-plan-analyze/planAnalysis';
const body = { month: '2026-10', interpretation: 'availability', mime: 'application/pdf', base64: btoa('%PDF-1.7 sample document') };
const extracted = { personName: null, documentMonth: '2026-10', warnings: ['Endzeit fehlt'], rows: [{ date: '2026-10-01', kind: 'available', startTime: '17:00', endTime: null, allDay: false, label: '', sourceText: '01.10. ab 17:00', confidence: 'medium' }] };
const response = (data: unknown) => ({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(data) }] }] });
describe('employee plan document analysis', () => {
  it('preserves missing end times for mandatory manual review', () => { expect(parseAnalysisResponse(response(extracted))).toEqual(extracted); });
  it('rejects unfinished output and refusals', () => {
    expect(() => parseAnalysisResponse({ status: 'incomplete' })).toThrow();
    expect(() => parseAnalysisResponse({ status: 'completed', output: [{ content: [{ type: 'refusal' }] }] })).toThrow();
  });
  it('rejects a forged PDF extension, wrong month and oversize uploads', () => {
    expect(() => validateDocument({ ...body, base64: btoa('<script>hi</script>') })).toThrow();
    expect(() => validateDocument({ ...body, month: '2026-13' })).toThrow();
    expect(() => validateDocument({ ...body, base64: 'A'.repeat(14 * 1024 * 1024) })).toThrow();
    expect(validateDocument(body).mime).toBe('application/pdf');
  });
  it('rejects malformed or excessive extracted rows', () => {
    expect(() => parseAnalysisResponse(response({ ...extracted, rows: [{ ...extracted.rows[0], endTime: 42 }] }))).toThrow();
    expect(() => parseAnalysisResponse(response({ ...extracted, rows: Array(301).fill(extracted.rows[0]) }))).toThrow();
  });
  it('sends a non-stored structured request and returns an unsaved draft', async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(response(extracted)), { status: 200 }));
    await expect(analyzePlanDocument(body, 'test-key', 'test-model', request)).resolves.toEqual(extracted);
    const sent = JSON.parse(request.mock.calls[0][1].body);
    expect(sent.store).toBe(false); expect(sent.text.format.strict).toBe(true);
    expect(sent.input[0].content[1].type).toBe('input_file');
    expect(sent.tools).toBeUndefined();
  });
  it('handles analysis provider errors without exposing its response body', async () => {
    const request = vi.fn().mockResolvedValue(new Response('secret provider diagnostics', { status: 429 }));
    await expect(analyzePlanDocument(body, 'test-key', 'test-model', request)).rejects.toThrow(/Kontingent/);
  });
  it('bounds the request body before parsing', async () => {
    await expect(readBoundedBody(new Request('https://example.test', { method: 'POST', body: JSON.stringify(body) }))).resolves.toEqual(body);
    await expect(readBoundedBody(new Request('https://example.test', { method: 'POST', headers: { 'content-length': String(15 * 1024 * 1024) }, body: '{}' }))).rejects.toThrow(/groß/);
  });
});
