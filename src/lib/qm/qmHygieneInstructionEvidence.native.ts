// Generated native presentation from src/lib/qm/qmHygieneInstructionEvidence.web.ts. Update through scripts/port-native-workspaces.mjs.
import { freezeClientNativeOriginal, type ClientNativeRow } from "../clients/clientRecordNativeOriginal.native.ts";
import { projectQmDocumentVersionReferenceWeb } from "./qmDocumentVersionReference.native.ts";
export type QmHygieneEvidenceFieldWeb = Readonly<{
    state: 'missing' | 'undefined' | 'null' | 'empty' | 'value' | 'unresolved';
    value: string | null;
}>;
export type QmHygieneEvidenceTagsWeb = Readonly<{
    state: 'missing' | 'undefined' | 'null' | 'empty' | 'value' | 'unresolved';
    value: readonly string[] | null;
}>;
export type QmHygieneInstructionEvidenceWeb = Readonly<{
    provenance: 'supplied_unverified_qm_excerpt';
    classification: 'not_inferred';
    activityRelation: 'not_provided';
    protectionNeedRelation: 'not_provided';
    pointOfCareRelation: 'not_provided';
    useValidity: 'not_inferred';
    document: Readonly<{
        nativeId: string;
        documentNumber: QmHygieneEvidenceFieldWeb;
        title: QmHygieneEvidenceFieldWeb;
        documentType: QmHygieneEvidenceFieldWeb;
        status: QmHygieneEvidenceFieldWeb;
        tags: QmHygieneEvidenceTagsWeb;
        storedResponsibleLabel: QmHygieneEvidenceFieldWeb;
        reviewDueAt: QmHygieneEvidenceFieldWeb;
        currentVersionId: QmHygieneEvidenceFieldWeb;
    }>;
    referencedVersion: Readonly<{
        nativeId: string;
        versionNumber: QmHygieneEvidenceFieldWeb;
        status: QmHygieneEvidenceFieldWeb;
        content: QmHygieneEvidenceFieldWeb;
        approvedBy: QmHygieneEvidenceFieldWeb;
        approvedAt: QmHygieneEvidenceFieldWeb;
        publishedAt: QmHygieneEvidenceFieldWeb;
        createdAt: QmHygieneEvidenceFieldWeb;
        updatedAt: QmHygieneEvidenceFieldWeb;
    }> | null;
}>;
export type QmHygieneInstructionEvidenceResultWeb = Readonly<{
    ok: true;
    data: QmHygieneInstructionEvidenceWeb;
} | {
    ok: false;
    error: string;
}>;
const field = (row: ClientNativeRow, key: string): QmHygieneEvidenceFieldWeb => {
    if (!Object.hasOwn(row, key))
        return { state: 'missing', value: null };
    const value = Object.getOwnPropertyDescriptor(row, key)!.value;
    if (value === undefined)
        return { state: 'undefined', value: null };
    if (value === null)
        return { state: 'null', value: null };
    if (value === '')
        return { state: 'empty', value: '' };
    return typeof value === 'string' ? { state: 'value', value } : { state: 'unresolved', value: null };
};
const tags = (row: ClientNativeRow): QmHygieneEvidenceTagsWeb => {
    if (!Object.hasOwn(row, 'tags'))
        return { state: 'missing', value: null };
    const value = Object.getOwnPropertyDescriptor(row, 'tags')!.value;
    if (value === undefined)
        return { state: 'undefined', value: null };
    if (value === null)
        return { state: 'null', value: null };
    if (!Array.isArray(value) || value.some(item => typeof item !== 'string'))
        return { state: 'unresolved', value: null };
    return value.length ? { state: 'value', value: [...value] } : { state: 'empty', value: [] };
};
/**
 * Projects only a selected, already delivered QM document and its exact stored current-version pointer.
 * Names, tags, statuses and owner labels never classify a hygiene plan or prove use-time validity.
 */
export function projectQmHygieneInstructionEvidenceWeb(input: unknown, scope: unknown): QmHygieneInstructionEvidenceResultWeb {
    const reference = projectQmDocumentVersionReferenceWeb(input, scope);
    if (!reference.ok)
        return reference;
    const document = reference.data.originals.document, version = reference.data.reference.version;
    const data: QmHygieneInstructionEvidenceWeb = {
        provenance: 'supplied_unverified_qm_excerpt', classification: 'not_inferred', activityRelation: 'not_provided', protectionNeedRelation: 'not_provided', pointOfCareRelation: 'not_provided', useValidity: 'not_inferred',
        document: { nativeId: document.id as string, documentNumber: field(document, 'documentNumber'), title: field(document, 'title'), documentType: field(document, 'documentType'), status: field(document, 'status'), tags: tags(document), storedResponsibleLabel: field(document, 'ownerRole'), reviewDueAt: field(document, 'reviewDueAt'), currentVersionId: field(document, 'currentVersionId') },
        referencedVersion: version ? { nativeId: version.id as string, versionNumber: field(version, 'versionNumber'), status: field(version, 'status'), content: field(version, 'content'), approvedBy: field(version, 'approvedBy'), approvedAt: field(version, 'approvedAt'), publishedAt: field(version, 'publishedAt'), createdAt: field(version, 'createdAt'), updatedAt: field(version, 'updatedAt') } : null,
    };
    return freezeClientNativeOriginal({ ok: true as const, data });
}
