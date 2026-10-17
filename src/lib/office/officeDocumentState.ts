import type { OfficeDocumentFile } from './officeDocumentsService';
import type { PortalDocumentListItem } from '@/types/portal/documents';

export function pendingDocument(doc: PortalDocumentListItem): boolean {
  return doc.status !== 'gesperrt' && ((doc as Partial<OfficeDocumentFile>).signaturePending === true || /\.pending$/i.test(doc.fileName));
}
