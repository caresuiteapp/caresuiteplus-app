// Generated native presentation from src/lib/pflege/tourPlanningInbox.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { sameWoundJson, woundInstant } from './woundCareDomain.ts';
import { validatePlanningPacket } from "./tourPlanningWorkspaceRules.native.ts";
import { tourPlanningId, tourPlanningJson, tourPlanningObject, tourPlanningVersion, tourPlanningLegacyVersion, validateTourPlanningCommand, type TourPlanningEvent, type TourPlanningPerson, type TourPlanningRow, type TourPlanningVersion } from "./tourPlanningWorkspaceDomain.native.ts";
/** Deliberate publication projection, not a rewritten original event: no raw tour notes, other recipients or personnel histories. */
export type PlanningInboxPublication = {
    id: string;
    tenantId: string;
    planId: string;
    sequence: number;
    actorId: string;
    actorName: string;
    recordedAt: string;
    version: TourPlanningVersion;
    versionLabel: string;
    validFrom: string;
    validUntil: string;
    packet: TourPlanningRow | null;
};
export type PlanningInboxEntry = {
    publication: PlanningInboxPublication;
    recipient: TourPlanningPerson;
    headId: string;
    current: boolean;
    acknowledgement: TourPlanningEvent | null;
};
function fail(): never { throw Error('Die vollständigen persönlichen Planfassungen sind nicht bestätigt.'); }
const exact = (v: unknown, keys: string[]): v is TourPlanningRow => tourPlanningObject(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim() && v.length <= 4000;
function event(value: unknown): asserts value is TourPlanningEvent {
    if (!exact(value, ['actorId', 'actorName', 'command', 'id', 'planId', 'previousId', 'recordedAt', 'sequence', 'tenantId']) || !tourPlanningId(value.id) || !Number.isSafeInteger(value.sequence) || Number(value.sequence) < 1 || !text(value.actorName) || typeof value.recordedAt !== 'string' || woundInstant(value.recordedAt) === null)
        fail();
    validateTourPlanningCommand(value.command);
    const c = value.command;
    if (c.eventId !== value.id || c.tenantId !== value.tenantId || c.planId !== value.planId || c.actorId !== value.actorId || c.expectedHeadId !== value.previousId || woundInstant(c.occurredAt)! > woundInstant(value.recordedAt)!)
        fail();
}
export function decodePlanningInbox(value: unknown, scope: {
    tenantId: string;
    actorId: string;
}): PlanningInboxEntry[] {
    tourPlanningJson(value, 32000000);
    if (!exact(value, ['actorId', 'count', 'publications', 'tenantId', 'version']) || value.version !== tourPlanningVersion || value.tenantId !== scope.tenantId || value.actorId !== scope.actorId || !Array.isArray(value.publications) || value.count !== value.publications.length || value.publications.length > 10000)
        fail();
    const seen = new Set<string>();
    for (const row of value.publications) {
        if (!exact(row, ['acknowledgement', 'current', 'headId', 'publication', 'recipient']) || !tourPlanningId(row.headId) || typeof row.current !== 'boolean')
            fail();
        const p = row.publication;
        if (!exact(p, ['id', 'tenantId', 'planId', 'sequence', 'actorId', 'actorName', 'recordedAt', 'version', 'versionLabel', 'validFrom', 'validUntil', 'packet']) || !['id', 'tenantId', 'planId', 'actorId'].every(k => tourPlanningId(p[k])) || p.tenantId !== scope.tenantId || !Number.isSafeInteger(p.sequence) || Number(p.sequence) < 1 || !text(p.actorName) || !text(p.versionLabel) || typeof p.recordedAt !== 'string' || woundInstant(p.recordedAt) === null || ![tourPlanningVersion, tourPlanningLegacyVersion].includes(p.version as TourPlanningVersion) || seen.has(String(p.id)))
            fail();
        for (const key of ['validFrom', 'validUntil'])
            if (typeof p[key] !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p[key] as string) || !Number.isFinite(Date.parse(p[key] as string)) || new Date(p[key] as string).toISOString().slice(0, 10) !== p[key])
                fail();
        if (String(p.validFrom) > String(p.validUntil))
            fail();
        const recipient = row.recipient;
        if (!exact(recipient, ['id', 'profileId', 'tenantId', 'name', 'roleKey', 'active', 'updatedAt']) || !tourPlanningId(recipient.id) || recipient.profileId !== scope.actorId || recipient.tenantId !== scope.tenantId || !text(recipient.name) || !text(recipient.roleKey) || recipient.active !== true || typeof recipient.updatedAt !== 'string' || woundInstant(recipient.updatedAt) === null)
            fail();
        if (p.version === tourPlanningVersion) {
            if (!tourPlanningObject(p.packet))
                fail();
            validatePlanningPacket(p.packet, { ...p, planVersionEventId: p.packet.versionEventId });
        }
        else if (p.packet !== null || row.current)
            fail();
        seen.add(String(p.id));
        if (row.acknowledgement !== null) {
            event(row.acknowledgement);
            const a = row.acknowledgement;
            if (a.tenantId !== p.tenantId || a.planId !== p.planId || a.actorId !== scope.actorId || a.sequence <= Number(p.sequence) || woundInstant(a.recordedAt)! < woundInstant(p.recordedAt)! || a.command.kind !== 'acknowledge' || a.command.payload.publishEventId !== p.id || !sameWoundJson(a.command.payload.recipient, recipient))
                fail();
        }
    }
    return structuredClone(value.publications) as PlanningInboxEntry[];
}
