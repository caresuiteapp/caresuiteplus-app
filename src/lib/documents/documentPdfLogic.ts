import type { ClientDocumentRecord } from '@/types/modules/client';
import {
  isDirectImageDownloadMimeType,
  isDirectPdfDownloadMimeType,
  isHtmlDocumentMimeType,
} from './documentPdfFileName';

export type DocumentPdfSource = 'html' | 'stored_html' | 'storage' | 'none';

export const MISSING_DOCUMENT_CONTENT_MESSAGE =
  'Der gespeicherte Dokumentinhalt fehlt. Bitte das Original als PDF hochladen.';

export function resolveDocumentPdfSource(doc: ClientDocumentRecord): DocumentPdfSource {
  if (doc.previewHtml?.trim()) return 'html';
  if (isHtmlDocumentMimeType(doc.mimeType) && doc.storagePath) return 'stored_html';
  if (doc.storagePath && (isDirectPdfDownloadMimeType(doc.mimeType) || isDirectImageDownloadMimeType(doc.mimeType))) {
    return 'storage';
  }
  return 'none';
}

export function isDocumentPdfDownloadSupported(doc: ClientDocumentRecord): boolean {
  return resolveDocumentPdfSource(doc) !== 'none';
}

export function isIntakeDocumentContentMissing(doc: ClientDocumentRecord): boolean {
  return (doc.documentSource === 'intake' || Boolean(doc.intakeDocumentId))
    && isHtmlDocumentMimeType(doc.mimeType)
    && resolveDocumentPdfSource(doc) === 'none';
}
