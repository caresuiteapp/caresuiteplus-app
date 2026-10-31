// Generated native presentation from src/components/office/documentSignatures/signatureWorkspaceModel.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { CsDocumentRequestListItem } from '@/types/documents/csTemplateDatabase';
import type { PortalSignatureDocument } from '@/types/portal/documentSignatures';
export type SignatureWorkspaceTab = 'open' | 'in_progress' | 'completed' | 'all';
export type SignatureWorkspaceRow = {
    source: 'request';
    item: CsDocumentRequestListItem;
} | {
    source: 'portal';
    item: PortalSignatureDocument;
};
export const SIGNER_LABELS: Record<string, string> = {
    employee: 'Mitarbeitende', client: 'Klient:in', representative: 'Vertretung',
    office: 'Verwaltung', payor: 'Kostenträger', both: 'Mitarbeitende und Klient:in', internal: 'Intern',
};
export function matchesSignatureTab(row: SignatureWorkspaceRow, tab: SignatureWorkspaceTab): boolean {
    if (tab === 'all')
        return true;
    const status = row.item.status;
    if (tab === 'completed')
        return ['completed', 'archived'].includes(status);
    // Captures alone do not confirm the final PDF/archive step.
    if (tab === 'in_progress')
        return ['opened', 'in_progress', 'partially_signed', 'fully_signed'].includes(status);
    return ['new', 'open', 'sent', 'opened', 'in_progress', 'partially_signed', 'fully_signed'].includes(status);
}
export function signatureRows(requests: CsDocumentRequestListItem[], portal: PortalSignatureDocument[]): SignatureWorkspaceRow[] {
    return [
        ...requests.map((item): SignatureWorkspaceRow => ({ source: 'request', item })),
        ...portal.map((item): SignatureWorkspaceRow => ({ source: 'portal', item })),
    ].sort((a, b) => b.item.createdAt.localeCompare(a.item.createdAt));
}
export function signatureDate(value: string | null | undefined): string {
    if (!value)
        return 'Ohne Frist';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Datum nicht verfügbar' : date.toLocaleDateString('de-DE');
}
export function isSignatureOverdue(row: SignatureWorkspaceRow, now = new Date()): boolean {
    if (!matchesSignatureTab(row, 'open') || !row.item.dueDate)
        return false;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return new Date(row.item.dueDate).getTime() < today.getTime();
}
export function matchesSignatureSearch(row: SignatureWorkspaceRow, search: string): boolean {
    const text = row.source === 'portal'
        ? [row.item.title, row.item.clientName, row.item.creatorName, row.item.documentType]
        : [row.item.title, ...row.item.signatures.map((signature) => signature.signerName)];
    return text.join(' ').toLocaleLowerCase('de-DE').includes(search.trim().toLocaleLowerCase('de-DE'));
}
