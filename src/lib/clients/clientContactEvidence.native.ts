// Generated native presentation from src/lib/clients/clientContactEvidence.web.ts. Update through scripts/port-native-workspaces.mjs.
import { captureClientNativePage, freezeClientNativeOriginal, type ClientNativeRow, type ClientNativeScope } from "./clientRecordNativeOriginal.native.ts";
import type { ClientTimelineReadCapture } from "./clientTimelineNoteAction.native.ts";
export type ClientContactTextEvidence = Readonly<{
    state: 'missing' | 'null' | 'empty' | 'present' | 'invalid';
    value: string | null;
}>;
export type ClientContactBooleanEvidence = Readonly<{
    state: 'missing' | 'null' | 'known' | 'invalid';
    value: boolean | null;
}>;
export type ClientContactMetadata = Readonly<{
    nativeId: string;
    legacyName: ClientContactTextEvidence;
    fullName: ClientContactTextEvidence;
    firstName: ClientContactTextEvidence;
    lastName: ClientContactTextEvidence;
    category: ClientContactTextEvidence;
    relationship: ClientContactTextEvidence;
    phone: ClientContactTextEvidence;
    email: ClientContactTextEvidence;
    notes: ClientContactTextEvidence;
    emergencyMark: ClientContactBooleanEvidence;
    portalMark: ClientContactBooleanEvidence;
    configuredModules: ReadonlyArray<Readonly<{
        key: string;
        configured: ClientContactBooleanEvidence;
    }>>;
    moduleConfiguration: 'missing' | 'null' | 'object' | 'invalid';
    createdAt: ClientContactTextEvidence;
    updatedAt: ClientContactTextEvidence;
    // These contacts do not deliver a current relative identity, entitlement or consent receipt.
    accessEvidence: 'not_confirmed';
    representationEvidence: 'not_confirmed';
}>;
export type ClientContactEvidence = Readonly<{
    originals: readonly ClientNativeRow[];
    entries: readonly ClientContactMetadata[];
}>;
export type ClientContactReadCapture = ClientTimelineReadCapture & {
    entries: readonly ClientContactMetadata[];
};
const capturedEntries = new WeakSet<object>();
const moduleKeys = ['canViewAppointments', 'canViewDocuments', 'canViewCarePlan', 'canSendMessages', 'canViewBilling'] as const;
function text(row: ClientNativeRow, key: string): ClientContactTextEvidence {
    if (!Object.hasOwn(row, key))
        return { state: 'missing', value: null };
    const value = row[key];
    return value === null ? { state: 'null', value: null } : typeof value !== 'string' ? { state: 'invalid', value: null }
        : { state: value.trim() ? 'present' : 'empty', value };
}
function flag(row: ClientNativeRow, key: string): ClientContactBooleanEvidence {
    if (!Object.hasOwn(row, key))
        return { state: 'missing', value: null };
    const value = row[key];
    return value === null ? { state: 'null', value: null } : typeof value === 'boolean' ? { state: 'known', value }
        : { state: 'invalid', value: null };
}
/** A pure lossless read of the complete delivered contact pool, not an access grant or a new query. */
export function captureClientContactEvidence(input: unknown, scope: ClientNativeScope): ClientContactEvidence {
    const originals = captureClientNativePage(input, scope, null);
    const entries = freezeClientNativeOriginal(originals.map(row => {
        const configured = Object.hasOwn(row, 'portal_permissions') ? row.portal_permissions : undefined;
        const object = configured !== null && typeof configured === 'object' && !Array.isArray(configured);
        return {
            nativeId: row.id as string, legacyName: text(row, 'name'), fullName: text(row, 'full_name'), firstName: text(row, 'first_name'), lastName: text(row, 'last_name'),
            category: text(row, 'contact_type'), relationship: text(row, 'relationship'),
            phone: text(row, 'phone'), email: text(row, 'email'), notes: text(row, 'notes'),
            emergencyMark: flag(row, 'is_emergency_contact'), portalMark: flag(row, 'is_portal_user'),
            configuredModules: moduleKeys.map(key => ({ key, configured: flag(object ? configured as ClientNativeRow : {}, key) })),
            moduleConfiguration: !Object.hasOwn(row, 'portal_permissions') ? 'missing' : configured === null ? 'null' : object ? 'object' : 'invalid',
            createdAt: text(row, 'created_at'), updatedAt: text(row, 'updated_at'),
            accessEvidence: 'not_confirmed', representationEvidence: 'not_confirmed',
        } satisfies ClientContactMetadata;
    }));
    capturedEntries.add(entries);
    return Object.freeze({ originals, entries });
}
/** Recognizes our immutable primitive projection only; it supplies no native authorization. */
export function isCapturedClientContactEntries(value: unknown): value is readonly ClientContactMetadata[] {
    return !!value && typeof value === 'object' && capturedEntries.has(value);
}
