// Generated native presentation from src/lib/pflege/medicationSourceComparisonRead.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import type { RoleKey } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from "../supabase/client.ts";
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { loadCompleteMedicationHistory, medicationHistoryFilter } from './medicationHistoryPagination.ts';
import { captureMedicationComparisonOriginals, type MedicationComparisonScope } from "./medicationSourceComparison.native.ts";
import { woundUuid } from './woundCareDomain.ts';
import { sameMedicationListOriginal } from "./medicationListOriginal.native.ts";
/** Only existing read facilities; no write/RPC or inferred reconciliation status. */
export async function readMedicationComparisonOriginals(scope: MedicationComparisonScope, role: RoleKey | null, isCurrent: () => boolean) {
    if (![scope.tenantId, scope.clientId, scope.medicationId].every(woundUuid) || typeof role !== 'string' || !role.trim())
        throw Error('Der native eigene Verordnungslesebezug ist ungültig.');
    scope = structuredClone(scope);
    const current = () => { if (!isCurrent())
        throw Error('Der eigene aktuelle Quellenlesebezug fehlt.'); };
    current();
    for (const permission of ['pflege.medications.view', 'office.documents.view', 'office.clients.view_sensitive'] as const) {
        const denied = enforcePermission(role, permission);
        if (denied)
            throw Error(denied.error);
    }
    const denied = guardServiceTenant(scope.tenantId);
    if (denied)
        throw Error(denied.error);
    const client = getSupabaseClient();
    if (!client || getServiceMode() !== 'supabase')
        throw Error('Die Originalverordnungsdatenbank ist nicht verfügbar.');
    const readOrder = async () => { current(); const result = await withServiceQueryTimeout(Promise.resolve(fromUnknownTable(client, 'medications').select('*').eq('tenant_id', scope.tenantId).eq('client_id', scope.clientId).eq('id', scope.medicationId).maybeSingle()), 'Originalverordnung'); current(); if (result.error || !result.data)
        throw Error('Der aktuelle native Verordnungsstand ist nicht verfügbar.'); return structuredClone(result.data); };
    const before = await readOrder();
    const sources = await loadCompleteMedicationHistory<Record<string, unknown>>(async (cursor) => {
        current();
        let q = fromUnknownTable(client, 'medication_order_sources').select('*').eq('tenant_id', scope.tenantId).eq('client_id', scope.clientId).eq('medication_id', scope.medicationId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(250);
        if (cursor)
            q = q.or(medicationHistoryFilter(cursor));
        const result = await withServiceQueryTimeout(Promise.resolve(q), 'Originalquellenbestand');
        current();
        if (result.error)
            throw Error('Der vollständige native Quellenbestand ist nicht verfügbar.');
        return structuredClone(result.data);
    }, scope.tenantId, row => row.medication_id === scope.medicationId && row.client_id === scope.clientId);
    const after = await readOrder();
    current();
    if (!sameMedicationListOriginal(before, after))
        throw Error('Der ganze Verordnungsstand änderte sich während des Lesens. Bitte erneut lesen.');
    return captureMedicationComparisonOriginals(after, sources, scope);
}
