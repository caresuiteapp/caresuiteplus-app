import type { PreparedInvoicePdf } from './invoicePdfService';

function createPdfUrl(bytes: Uint8Array): string {
  return URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
}

export async function previewInvoicePdf(payload: PreparedInvoicePdf, target?: Window | null): Promise<void> {
  const url = createPdfUrl(payload.bytes);
  const preview = target ?? window.open('', '_blank');
  if (!preview) {
    URL.revokeObjectURL(url);
    throw new Error('PDF-Vorschau wurde vom Browser blockiert. Bitte Pop-ups erlauben.');
  }
  preview.location.href = url;
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadInvoicePdf(payload: PreparedInvoicePdf): Promise<void> {
  const url = createPdfUrl(payload.bytes);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = payload.fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
