// Generated native presentation from src/lib/clients/clientSignatureOriginals.web.ts. Update through scripts/port-native-workspaces.mjs.
import { woundUuid } from '../pflege/woundCareDomain.ts';
import { captureClientNativePage, cloneClientNativeOriginal, freezeClientNativeOriginal, type ClientNativeRow, type ClientNativeScope, } from "./clientRecordNativeOriginal.native.ts";
export const CLIENT_SIGNATURE_ORIGINAL_POOLS = {
    documents: 'client_intake_documents', signatures: 'client_document_signatures',
} as const;
export type ClientSignatureOriginalLink = {
    signatureId: string;
    /** Unchanged native value, including unresolved legacy metadata. */
    documentId: unknown;
    state: 'delivered_document' | 'unresolved';
    document: ClientNativeRow | null;
    original: ClientNativeRow;
};
export type ClientSignatureOriginalCollection = {
    pools: {
        documents: ClientNativeRow[];
        signatures: ClientNativeRow[];
    };
    links: ClientSignatureOriginalLink[];
};
/** Native FK evidence only. No role deduplication, status promotion, signature verification or clinical approval. */
export function captureClientSignatureOriginals(input: unknown, scope: ClientNativeScope): ClientSignatureOriginalCollection {
    const whole = cloneClientNativeOriginal(input);
    if (!whole || typeof whole !== 'object' || Array.isArray(whole)
        || Object.keys(whole).length !== 2 || !Object.hasOwn(whole, 'documents') || !Object.hasOwn(whole, 'signatures')) {
        throw Error('Die beiden nativen Signaturquellen wurden nicht vollständig geliefert.');
    }
    const supplied = whole as Record<string, unknown>;
    const documents = captureClientNativePage(supplied.documents, scope, null);
    const signatures = captureClientNativePage(supplied.signatures, scope, null);
    const documentsById = new Map(documents.map(row => [(row.id as string).toLowerCase(), row]));
    const links = signatures.map(original => {
        const documentId = Object.hasOwn(original, 'document_id') ? original.document_id : undefined;
        const document = woundUuid(documentId) ? documentsById.get((documentId as string).toLowerCase()) ?? null : null;
        return {
            signatureId: original.id as string, documentId,
            state: document === null ? 'unresolved' as const : 'delivered_document' as const,
            document, original,
        };
    });
    return freezeClientNativeOriginal({ pools: { documents, signatures }, links });
}
