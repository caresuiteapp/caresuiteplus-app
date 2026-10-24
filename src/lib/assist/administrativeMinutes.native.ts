// Generated native presentation from src/lib/assist/administrativeMinutes.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { RoleKey, ServiceResult } from '@/types';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from "../supabase/client.ts";
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { fetchTimeEventsForVisit } from './assistTrackingPersistenceService';
import { getVisitTimeSegments } from '@/features/assistWorkflow/getVisitTimeSegments';
import { calculateVisitTimes } from '@/features/assistWorkflow/calculateVisitTimes';
export type AdministrativeMinutes = {
    pause: string;
    travel: string;
};
/** Read existing corrections before offering another correction; never silently reset them to zero. */
export async function fetchAdministrativeMinutes(tenantId: string, visitId: string, status: AssignmentStatus, role?: RoleKey | null): Promise<ServiceResult<AdministrativeMinutes>> {
    const denied = enforcePermission<AdministrativeMinutes>(role, 'assist.execution.manage');
    if (denied)
        return denied;
    const blocked = guardServiceTenant(tenantId);
    if (blocked)
        return blocked;
    const client = getSupabaseClient();
    if (!client)
        return { ok: false, error: 'Die gespeicherten Pausen- und Fahrzeiten sind derzeit nicht verfügbar.' };
    try {
        const result = await fromUnknownTable(client, 'workforce_time_events')
            .select('metadata').eq('tenant_id', tenantId).eq('reference_type', 'visit').eq('reference_id', visitId)
            .eq('metadata->>source', 'administrative_follow_up').order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (result.error)
            return { ok: false, error: 'Die gespeicherten Pausen- und Fahrzeiten konnten nicht geladen werden. Bitte erneut laden.' };
        const metadata = (result.data as {
            metadata?: Record<string, unknown>;
        } | null)?.metadata;
        if (metadata) {
            const pause = metadata.pause_minutes, travel = metadata.travel_minutes;
            if (typeof pause !== 'number' || typeof travel !== 'number' || !Number.isSafeInteger(pause) || !Number.isSafeInteger(travel) || pause < 0 || travel < 0) {
                return { ok: false, error: 'Die bisherige Zeitkorrektur enthält keine vollständigen Minutenwerte. Bitte die Arbeitszeiterfassung prüfen.' };
            }
            return { ok: true, data: { pause: String(pause), travel: String(travel) } };
        }
        const events = await fetchTimeEventsForVisit(tenantId, visitId);
        if (!events.ok || events.tableMissing)
            return { ok: false, error: 'Die bisherigen Einsatzzeiten konnten nicht vollständig geladen werden.' };
        // A missing WFM correction must not cause existing administrative values to be replaced.
        if (events.data.some(event => event.metadata?.source === 'administrative_follow_up'))
            return { ok: false, error: 'Die korrigierten Minutenwerte konnten nicht zugeordnet werden. Bitte die Arbeitszeiterfassung prüfen.' };
        if (events.data.some(event => !Number.isFinite(Date.parse(event.occurredAt))))
            return { ok: false, error: 'Der bisherige Zeitverlauf enthält ungültige Zeitangaben. Bitte die Arbeitszeiterfassung prüfen.' };
        const latestServiceStart = events.data.filter(event => event.eventType === 'service_start')
            .reduce((latest, event) => Math.max(latest, Date.parse(event.occurredAt)), Number.NEGATIVE_INFINITY);
        const currentPauses = events.data.filter(event => Date.parse(event.occurredAt) >= latestServiceStart);
        if (currentPauses.filter(event => event.eventType === 'pause_start').length !== currentPauses.filter(event => event.eventType === 'pause_end').length) {
            return { ok: false, error: 'Der Pausenverlauf ist unvollständig. Bitte die Arbeitszeiterfassung prüfen.' };
        }
        const segments = getVisitTimeSegments(events.data);
        const incomplete = segments.some(segment => (segment.kind === 'drive' || segment.kind === 'pause') && (!segment.endedAt || Date.parse(segment.endedAt) < Date.parse(segment.startedAt) || !Number.isFinite(segment.durationSeconds)));
        if (incomplete)
            return { ok: false, error: 'Eine erfasste Fahrt oder Pause ist noch offen. Bitte den Zeitverlauf zuerst vervollständigen.' };
        const times = calculateVisitTimes(events.data, status);
        if (![times.pauseSeconds ?? 0, times.driveSeconds ?? 0].every(value => Number.isFinite(value) && value >= 0))
            return { ok: false, error: 'Die bisherigen Minutenwerte konnten nicht sicher ermittelt werden.' };
        return { ok: true, data: { pause: String(Math.round((times.pauseSeconds ?? 0) / 60)), travel: String(Math.round((times.driveSeconds ?? 0) / 60)) } };
    }
    catch {
        return { ok: false, error: 'Die gespeicherten Pausen- und Fahrzeiten konnten nicht geladen werden. Bitte erneut laden.' };
    }
}
