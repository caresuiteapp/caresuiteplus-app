// Generated native presentation from src/lib/office/eInvoiceInboxTypes.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { OfficeEInvoiceXmlPreview } from "./eInvoiceImport.native.ts";
export type OfficeEInvoiceInboxRecord = {
    id: string;
    tenantId: string;
    createdAt: string;
    updatedAt: string;
    originalFileName: string;
    originalMimeType: string;
    originalSha256: string;
    xmlFileName: string;
    xmlSha256: string;
    originalSize: number;
    sourceKind: 'xml' | 'hybrid_pdf';
    preview: OfficeEInvoiceXmlPreview;
    reviewStatus: 'unreviewed' | 'reviewed' | 'rejected';
    reviewNote: string;
    validationStatus: 'valid' | 'invalid' | 'unsupported' | 'pending_validation' | 'error';
    validationMessage: string;
    validationFindings: string[];
};
export type OfficeEInvoiceInboxReview = {
    status: OfficeEInvoiceInboxRecord['reviewStatus'];
    note: string;
    expectedUpdatedAt: string;
};
export type OfficeEInvoiceOriginal = {
    bytes: Uint8Array;
    mimeType: string;
    fileName: string;
};
