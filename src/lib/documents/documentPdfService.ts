import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Platform } from 'react-native';
import type { ServiceResult } from '@/types';
import type { ClientDocumentRecord } from '@/types/modules/client';
import { getSupabaseClient } from '@/lib/supabase/client';
import { getServiceMode } from '@/lib/services/mode';
import {
  buildDocumentPdfFileName,
  isDirectPdfDownloadMimeType,
} from './documentPdfFileName';
import {
  resolveDocumentPdfSource,
} from './documentPdfLogic';

export {
  isDocumentPdfDownloadSupported,
  resolveDocumentPdfSource,
  type DocumentPdfSource,
} from './documentPdfLogic';

const STORAGE_BUCKET = 'office-documents';

export type DocumentPdfPayload = {
  fileName: string;
  mimeType: 'application/pdf';
  base64: string;
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

function triggerBrowserDownload(bytes: Uint8Array, fileName: string, mimeType: string): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function fetchStoredDocumentBytes(storagePath: string): Promise<ServiceResult<Uint8Array>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase-Client nicht verfügbar.' };

  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(storagePath);
  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Datei konnte nicht geladen werden.' };
  }

  const buffer = await data.arrayBuffer();
  return { ok: true, data: new Uint8Array(buffer) };
}

async function renderHtmlToPdfBytes(html: string): Promise<Uint8Array> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    throw new Error('PDF-Erzeugung ist nur im Web-Browser verfügbar.');
  }

  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '794px';
  container.style.background = '#ffffff';
  container.style.padding = '24px';
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    });

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * contentWidth) / canvas.width;
    const imgData = canvas.toDataURL('image/png');

    let heightLeft = imgHeight;
    let position = margin;

    pdf.addImage(imgData, 'PNG', margin, position, contentWidth, imgHeight);
    heightLeft -= pageHeight - margin * 2;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight + margin;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, position, contentWidth, imgHeight);
      heightLeft -= pageHeight - margin * 2;
    }

    return new Uint8Array(pdf.output('arraybuffer'));
  } finally {
    document.body.removeChild(container);
  }
}

async function imageBytesToPdfBytes(imageBytes: Uint8Array, mimeType: string): Promise<Uint8Array> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    throw new Error('PDF-Erzeugung ist nur im Web-Browser verfügbar.');
  }

  const blob = new Blob([imageBytes], { type: mimeType });
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Bild konnte nicht gelesen werden.'));
    reader.readAsDataURL(blob);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Bildvorschau fehlgeschlagen.'));
    img.src = dataUrl;
  });

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const maxWidth = pageWidth - margin * 2;
  const maxHeight = pageHeight - margin * 2;
  const ratio = Math.min(maxWidth / image.width, maxHeight / image.height);
  const width = image.width * ratio;
  const height = image.height * ratio;

  pdf.addImage(dataUrl, 'PNG', margin, margin, width, height);
  return new Uint8Array(pdf.output('arraybuffer'));
}

export async function prepareDocumentPdf(input: {
  doc: ClientDocumentRecord;
  clientLastName?: string | null;
}): Promise<ServiceResult<DocumentPdfPayload>> {
  const source = resolveDocumentPdfSource(input.doc);
  const fileName = buildDocumentPdfFileName(input.doc.title, input.clientLastName);

  if (source === 'none') {
    return { ok: false, error: 'Für dieses Dokument ist kein PDF verfügbar.' };
  }

  if (getServiceMode() !== 'supabase' && Platform.OS !== 'web') {
    return {
      ok: true,
      data: {
        fileName,
        mimeType: 'application/pdf',
        base64: btoa('%PDF-1.4 demo'),
      },
    };
  }

  try {
    if (source === 'html') {
      const html = input.doc.previewHtml?.trim();
      if (!html) return { ok: false, error: 'HTML-Inhalt fehlt — PDF kann nicht erzeugt werden.' };
      const bytes = await renderHtmlToPdfBytes(html);
      return {
        ok: true,
        data: { fileName, mimeType: 'application/pdf', base64: bytesToBase64(bytes) },
      };
    }

    if (!input.doc.storagePath) {
      return { ok: false, error: 'Speicherpfad fehlt — Datei kann nicht geladen werden.' };
    }

    const stored = await fetchStoredDocumentBytes(input.doc.storagePath);
    if (!stored.ok) return stored;

    if (isDirectPdfDownloadMimeType(input.doc.mimeType)) {
      return {
        ok: true,
        data: {
          fileName,
          mimeType: 'application/pdf',
          base64: bytesToBase64(stored.data),
        },
      };
    }

    const pdfBytes = await imageBytesToPdfBytes(stored.data, input.doc.mimeType);
    return {
      ok: true,
      data: { fileName, mimeType: 'application/pdf', base64: bytesToBase64(pdfBytes) },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'PDF-Erzeugung fehlgeschlagen.',
    };
  }
}

export async function downloadDocumentPdf(input: {
  doc: ClientDocumentRecord;
  clientLastName?: string | null;
}): Promise<ServiceResult<{ fileName: string }>> {
  const prepared = await prepareDocumentPdf(input);
  if (!prepared.ok) return prepared;

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    triggerBrowserDownload(
      base64ToBytes(prepared.data.base64),
      prepared.data.fileName,
      prepared.data.mimeType,
    );
    return { ok: true, data: { fileName: prepared.data.fileName } };
  }

  if (getServiceMode() !== 'supabase') {
    return {
      ok: true,
      data: { fileName: prepared.data.fileName },
    };
  }

  return {
    ok: false,
    error: 'PDF-Download ist nur im Web-Browser verfügbar.',
  };
}
