import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

function bridge(attachments: Record<string, { filename: string; content: Uint8Array }> | null) {
  const destroy = vi.fn(async () => undefined); const getAttachments = vi.fn(async () => attachments);
  const getDocument = vi.fn(() => ({ promise: Promise.resolve({ getAttachments }), destroy }));
  const window: { CareSuiteInvoiceXmlV1?: { extractAttachments(bytes: Uint8Array): Promise<Array<{ name: string; bytes: Uint8Array }>> } } = {};
  const source = readFileSync('scripts/calendar-reader/invoice-pdf.mjs', 'utf8')
    .replace("import { getDocument, GlobalWorkerOptions } from './pdf.mjs';", '')
    .replace("const base = new URL('.', import.meta.url).href;", "const base = 'https://same-origin.test/calendar-reader/v1/';");
  runInNewContext(source, { window, getDocument, GlobalWorkerOptions: {}, Uint8Array, setTimeout, clearTimeout });
  return { reader: window.CareSuiteInvoiceXmlV1!, getDocument, getAttachments, destroy };
}

describe('PDF attachment-only reader', () => {
  it('extracts unchanged bytes without accessing pages or rendering', async () => {
    const xml = new TextEncoder().encode('<invoice/>'); const state = bridge({ x: { filename: 'invoice.xml', content: xml } });
    expect(await state.reader.extractAttachments(new Uint8Array([1, 2, 3]))).toEqual([{ name: 'invoice.xml', bytes: xml }]);
    expect(state.getDocument).toHaveBeenCalledWith(expect.objectContaining({ isEvalSupported: false, enableXfa: false, disableAutoFetch: true }));
    expect(state.destroy).toHaveBeenCalledOnce();
  });
  it('destroys the worker when attachment count or expanded size is excessive', async () => {
    const tooMany = bridge(Object.fromEntries(Array.from({ length: 33 }, (_, i) => [String(i), { filename: `${i}.xml`, content: new Uint8Array([1]) }])));
    await expect(tooMany.reader.extractAttachments(new Uint8Array([1]))).rejects.toThrow('32'); expect(tooMany.destroy).toHaveBeenCalledOnce();
    const tooLarge = bridge({ x: { filename: 'x.xml', content: new Uint8Array(5 * 1024 * 1024 + 1) } });
    await expect(tooLarge.reader.extractAttachments(new Uint8Array([1]))).rejects.toThrow('5 MB'); expect(tooLarge.destroy).toHaveBeenCalledOnce();
  });
  it('handles a PDF with no attachments and rejects an oversized original before parsing', async () => {
    const state = bridge(null); expect(await state.reader.extractAttachments(new Uint8Array([1]))).toEqual([]);
    await expect(state.reader.extractAttachments(new Uint8Array(10 * 1024 * 1024 + 1))).rejects.toThrow('10 MB'); expect(state.getDocument).toHaveBeenCalledOnce();
  });
});
