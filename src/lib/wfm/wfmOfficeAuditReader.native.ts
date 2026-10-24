// Generated native presentation from src/lib/wfm/wfmOfficeAuditReader.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { RoleKey, ServiceResult } from '@/types';
import type { WfmOfficeAuditEntry, WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from "../supabase/client.ts";
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { listWfmOfficeAuditForEntry as demoAudit } from './wfmOfficeAuditService';
import { officeReviewIdentity } from './wfmOfficeReviewIntegrity';
import { readAllOfficeAccountRows } from './wfmOfficeAccountTotals';
import { readOfficeReviews, readOfficeReviewActions } from './wfmOfficeTimekeepingReads';
const string = (value: unknown): string | null => typeof value === 'string' ? value : null;
/** Reload saved audit records; local cached actions must not conceal a failed remote read. */
export async function listOfficeWebAudit(tenantId: string, roleKey: RoleKey | null, entryId: string, entry: WfmOfficeTimeEntry): Promise<ServiceResult<WfmOfficeAuditEntry[]>> {
    const denied = enforcePermission(roleKey, 'time.tracking.team.view') ?? guardServiceTenant(tenantId);
    if (denied)
        return denied;
    if (entry.id !== entryId || entry.tenantId !== tenantId)
        return { ok: false, error: 'Die ausgewählte Buchung gehört nicht zu dieser Ansicht.' };
    if (getServiceMode() !== 'supabase')
        return demoAudit(tenantId, roleKey, entryId, entry);
    const db = getSupabaseClient();
    if (!db)
        return { ok: false, error: 'Der Änderungsverlauf ist ohne Datenverbindung nicht verfügbar.' };
    try {
        const [reviews, audits] = await Promise.all([
            readOfficeReviews(tenantId, entry.workDate, entry.workDate),
            readAllOfficeAccountRows((from, to) => fromUnknownTable(db, 'workforce_audit_log').select('*')
                .eq('tenant_id', tenantId).eq('entity_id', entryId).order('created_at', { ascending: false }).order('id').range(from, to)),
        ]);
        if (!reviews.ok)
            return reviews;
        if (audits.error)
            throw audits.error;
        const key = officeReviewIdentity(entry).referenceKey;
        const matching = reviews.data.filter(row => row.tenantId === tenantId && row.employeeId === entry.employeeId && row.referenceKey === key);
        const actions = await readOfficeReviewActions(tenantId, matching.map(row => row.id));
        if (!actions.ok)
            return actions;
        const rows: WfmOfficeAuditEntry[] = audits.data.filter(row => row.tenant_id === tenantId && row.entity_id === entryId).map(row => {
            const metadata = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata) ? row.metadata as Record<string, unknown> : {};
            return { id: String(row.id), tenantId, entityType: String(row.entity_type), entityId: entryId, action: String(row.action),
                actorId: string(row.actor_id), summary: string(row.summary) ?? 'Arbeitszeit geändert', field: string(metadata.field), oldValue: string(metadata.oldValue),
                newValue: string(metadata.newValue), reason: string(metadata.reason), source: string(metadata.source), metadata, createdAt: String(row.created_at) };
        });
        rows.push(...actions.data.filter(action => action.tenantId === tenantId).map(action => ({
            id: action.id, tenantId, entityType: 'wfm_office_time_entry', entityId: entryId, action: action.action, actorId: action.actorId,
            summary: action.comment || (action.action === 'review_approved' ? 'Arbeitszeit genehmigt' : action.action === 'review_rejected' ? 'Arbeitszeit abgelehnt' : 'Arbeitszeitprüfung aktualisiert'),
            field: action.newValue ? 'Arbeitszeit' : 'Prüfstatus', oldValue: action.oldValue ? JSON.stringify(action.oldValue) : action.prevStatus,
            newValue: action.newValue ? JSON.stringify(action.newValue) : action.newStatus, reason: action.reason ?? action.comment, source: 'office', metadata: {}, createdAt: action.createdAt,
        })));
        return { ok: true, data: [...new Map(rows.map(row => [row.id, row])).values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : toGermanSupabaseError(error) };
    }
}
