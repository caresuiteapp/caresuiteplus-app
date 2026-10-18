import { describe, expect, it } from 'vitest';
import { extractEInvoicePdfXml } from '../../../api/_lib/einvoice-pdf-extract.mjs';

/** A synthetic, ordinary PDF with genuine embedded files; no legal/PDF-A assertion. */
function pdfWithAttachments(xmls: string[]): Uint8Array {
  const names = xmls.map((_, index) => `(invoice-${index}.xml) ${6 + index * 2} 0 R`).join(' ');
  const objects = [
    `<< /Type /Catalog /Pages 2 0 R /Names << /EmbeddedFiles << /Names [${names}] >> >> >>`,
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> /Contents 4 0 R >>',
    '<< /Length 0 >>\nstream\n\nendstream',
    ...xmls.flatMap((xml, index) => [
      `<< /Type /EmbeddedFile /Subtype /text#2Fxml /Length ${Buffer.byteLength(xml)} >>\nstream\n${xml}\nendstream`,
      `<< /Type /Filespec /F (invoice-${index}.xml) /UF (invoice-${index}.xml) /EF << /F ${5 + index * 2} 0 R >> >>`,
    ]),
  ];
  let content = '%PDF-1.7\n'; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(content)); content += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(content);
  content += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}`;
  content += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Uint8Array(Buffer.from(content));
}

describe('independent server PDF original extraction', () => {
  it('extracts actual embedded bytes in an isolated worker and preserves the PDF', async () => {
    const xml = '<?xml version="1.0"?><Invoice>Original embedded bytes</Invoice>'; const pdf = pdfWithAttachments([xml]); const original = pdf.slice();
    expect(await extractEInvoicePdfXml(pdf)).toEqual(new TextEncoder().encode(xml)); expect(pdf).toEqual(original);
  }, 25_000);
  it('rejects multiple XML attachments instead of attesting a caller-selected XML', async () => {
    await expect(extractEInvoicePdfXml(pdfWithAttachments(['<Invoice>one</Invoice>', '<Invoice>two</Invoice>']))).rejects.toThrow('genau eine');
  }, 25_000);
  it('rejects ordinary PDFs without embedded XML and invalid originals', async () => {
    await expect(extractEInvoicePdfXml(pdfWithAttachments([]))).rejects.toThrow('genau eine');
    await expect(extractEInvoicePdfXml(new Uint8Array())).rejects.toThrow('leer');
  }, 25_000);
});
