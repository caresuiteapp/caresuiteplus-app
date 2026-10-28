// Generated native presentation from src/lib/wfm/wfmOfficeLivePresence.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { RoleKey, ServiceResult } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import type { WfmLiveEmployeeRow } from '@/types/modules/wfm';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { assistBerlinDate, assistText } from "../assist/assistClientsWorkspaceModel.native.ts";
import { formatWfmStatusLabel } from './wfmClockService';
import { getWfmLiveEmployeeOverview } from './wfmLiveStatusService';
import { readOfficeEmployees, readOfficeSessions } from "./wfmOfficeTimekeepingReads.native.ts";
export type OfficeLivePresence = {
    rows: WfmLiveEmployeeRow[];
    onlineCount: number;
    totalCount: number;
};
export async function readOfficeLivePresence(input: {
    tenantId: string;
    roleKey: RoleKey | null;
    effectivePermissions: readonly PermissionKey[];
    now?: Date;
}): Promise<ServiceResult<OfficeLivePresence>> {
    const denied = guardServiceTenant(input.tenantId);
    if (denied)
        return denied;
    if (!input.roleKey || isPortalOnlyRole(input.roleKey) || !input.effectivePermissions.includes('time.tracking.team.view'))
        return { ok: false, error: 'Für die Team-Zeiterfassung fehlt die erforderliche Berechtigung.' };
    const now = input.now ?? new Date();
    if (!Number.isFinite(now.getTime()))
        return { ok: false, error: 'Der Abfragezeitpunkt ist ungültig.' };
    if (getServiceMode() !== 'supabase')
        return getWfmLiveEmployeeOverview(input.tenantId, input.roleKey);
    const workDate = assistBerlinDate(now);
    const sessions = await readOfficeSessions(input.tenantId, workDate);
    if (!sessions.ok)
        return sessions;
    if (!sessions.data.length)
        return { ok: true, data: { rows: [], onlineCount: 0, totalCount: 0 } };
    if (sessions.data.some(session => session.tenantId !== input.tenantId || session.workDate !== workDate || !assistText(session.employeeId) || [session.netMinutes, session.pauseMinutes, session.grossMinutes].some(value => !Number.isFinite(value) || value < 0)))
        return { ok: false, error: 'Die heutige Zeiterfassung enthält unvollständige oder nicht zugeordnete Daten.' };
    const employees = await readOfficeEmployees(input.tenantId);
    if (!employees.ok)
        return employees;
    const names = new Map(employees.data.filter(row => row.tenant_id === input.tenantId).map(row => [String(row.id), assistText([assistText(row.first_name), assistText(row.last_name)].filter(Boolean).join(' ')) ?? 'Name nicht verfügbar']));
    const rows = sessions.data.map(session => ({ employeeId: session.employeeId, employeeName: names.get(session.employeeId) ?? 'Name nicht verfügbar', session, statusLabel: formatWfmStatusLabel(session), locationLabel: null, lastEventAt: session.lastEventAt }));
    const active = (row: WfmLiveEmployeeRow) => Boolean(row.session?.isOnline && !['ended', 'offline'].includes(row.session.status));
    rows.sort((left, right) => Number(active(right)) - Number(active(left)) || (right.lastEventAt ?? '').localeCompare(left.lastEventAt ?? '') || left.employeeName.localeCompare(right.employeeName, 'de'));
    return { ok: true, data: { rows, onlineCount: rows.filter(active).length, totalCount: rows.length } };
}
