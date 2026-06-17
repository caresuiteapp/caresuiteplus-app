import type { ClientDocumentRecord } from '@/types/modules/client';
import {
  isDirectImageDownloadMimeType,
  isDirectPdfDownloadMimeType,
  isHtmlDocumentMimeType,
} from './documentPdfFileName';

export type DocumentPdfSource = 'html' | 'storage' | 'none';

export function resolveDocumentPdfSource(doc: ClientDocumentRecord): DocumentPdfSource {
  if (doc.previewHtml?.trim()) return 'html';
  if (isHtmlDocumentMimeType(doc.mimeType)) return 'html';
  if (doc.storagePath && (isDirectPdfDownloadMimeType(doc.mimeType) || isDirectImageDownloadMimeType(doc.mimeType))) {
    return 'storage';
  }
  return 'none';
}

export function isDocumentPdfDownloadSupported(doc: ClientDocumentRecord): boolean {
  return resolveDocumentPdfSource(doc) !== 'none';
}
