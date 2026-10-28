// Generated native presentation from src/lib/clients/clientIntakeCompletion.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { ServiceResult } from '@/types';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { getSupabaseClient } from "../supabase/client.ts";
import { isUuid } from '@/lib/validation/uuid';
import { confirmWebClientIntakeDocuments as confirmClientIntakeDocuments } from "../../features/intakeDocuments/intakeDocumentTransaction.native.ts";
import { persistIntakeCostCarriers } from '@/features/costCarriers/costCarrierService';
import { syncIntakeClientExtendedData } from './clientIntakePersistence';
import { syncClientCoreAfterIntake } from '@/lib/client/clientCoreIntakeSyncService';
import { findExactClientIdentityConflictFromIntake } from './repositories/clientIntakeRepository.supabase';
import { mapIntakeModulesToPortal, saveClientModuleAssignments } from '@/lib/portal/clientModuleAssignmentService';
import { finalizeClientIntakeCompletion, prepareClientIntakeCompletion } from "./repositories/clientIntakeCompletionRepository.supabase.native.ts";
const unresolved = 'Der Abschluss der bestehenden Aufnahme konnte nicht vollständig bestätigt werden. Bitte prüfen Sie die Akte; beginnen Sie keine zweite Aufnahme.';
type Row = Record<string, unknown>;
const row = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value);
const nativeTime = (value: unknown): value is string => typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value));
/** Completes only an already secured lead. Each phase and final activation recheck the live owner. */
export async function completeWebClientIntake(tenantId: string, clientId: string, input: ClientIntakeFormData, actorId: string, completionRequestId: string, identityReviewId: string, documentsRequestId: string, isCurrent: () => boolean): Promise<ServiceResult<{
    id: string;
}>> {
    try {
        if (![tenantId, clientId, actorId, completionRequestId, identityReviewId, documentsRequestId].every(isUuid) || !isCurrent())
            return { ok: false, error: unresolved };
        const form = JSON.parse(JSON.stringify(input)) as ClientIntakeFormData;
        const supabase = getSupabaseClient();
        if (!supabase)
            return { ok: false, error: unresolved };
        const current = () => isCurrent() && getSupabaseClient() === supabase;
        const requireCurrent = () => { if (!current())
            throw Error(unresolved); };
        const readLead = async () => {
            requireCurrent();
            const result = await supabase.from('clients').select('id,tenant_id,status,updated_at')
                .eq('tenant_id', tenantId).eq('id', clientId).maybeSingle();
            requireCurrent();
            if (result.error || !row(result.data) || result.data.id !== clientId
                || result.data.tenant_id !== tenantId || result.data.status !== 'lead' || !nativeTime(result.data.updated_at))
                throw Error(unresolved);
            return result.data.updated_at;
        };
        const conflict = await findExactClientIdentityConflictFromIntake(tenantId, form, clientId);
        requireCurrent();
        if (!conflict.ok || conflict.data)
            return { ok: false, error: unresolved };
        const version = await readLead();
        // Common draft fields were saved and read back by the workflow immediately
        // before this phase. Complete the remaining native master-data fields here.
        const patch = {
            salutation: form.salutation.trim() || null, service_start: form.serviceStart || null,
            housing_form: form.housingForm.trim() || null, special_notes: form.specialNotes.trim() || null,
            preferred_contact: form.preferredContact.trim() || null, updated_by: actorId,
        };
        requireCurrent();
        const saved = await supabase.from('clients').update(patch)
            .eq('tenant_id', tenantId).eq('id', clientId).eq('status', 'lead').eq('updated_at', version)
            .select('*').maybeSingle();
        requireCurrent();
        const persisted: unknown = saved.data;
        if (saved.error || !row(persisted) || persisted.id !== clientId || persisted.tenant_id !== tenantId
            || persisted.status !== 'lead' || Object.entries(patch).some(([key, value]) => persisted[key] !== value))
            throw Error(unresolved);
        const phase = async (operation: () => Promise<ServiceResult<unknown>>) => {
            requireCurrent();
            const result = await operation();
            requireCurrent();
            if (!result.ok)
                throw Error(unresolved);
        };
        await phase(() => confirmClientIntakeDocuments(tenantId, clientId, form, actorId, {
            requestId: documentsRequestId, isCurrent: current,
        }));
        const preparedVersion = await readLead();
        const prepared = await prepareClientIntakeCompletion(tenantId, clientId, actorId, completionRequestId, identityReviewId, preparedVersion, form, documentsRequestId);
        requireCurrent();
        if (!prepared.ok || prepared.data.id !== clientId || prepared.data.requestId !== completionRequestId
            || prepared.data.status !== 'prepared' || prepared.data.leadUpdatedAt !== preparedVersion)
            throw Error(unresolved);
        await phase(() => persistIntakeCostCarriers(tenantId, clientId, form, actorId));
        await phase(() => syncIntakeClientExtendedData(tenantId, clientId, form, actorId, { eventMode: 'create' }));
        const modules = mapIntakeModulesToPortal(form.assignedModules);
        if (modules.length > 0)
            await phase(() => saveClientModuleAssignments(tenantId, clientId, modules, actorId));
        await phase(() => syncClientCoreAfterIntake(tenantId, clientId, form));
        const finalVersion = await readLead();
        requireCurrent();
        const activated = await finalizeClientIntakeCompletion(tenantId, clientId, actorId, completionRequestId, finalVersion);
        requireCurrent();
        if (!activated.ok || activated.data.id !== clientId || activated.data.requestId !== completionRequestId
            || activated.data.status !== 'active')
            throw Error(unresolved);
        return { ok: true, data: { id: clientId } };
    }
    catch {
        return { ok: false, error: unresolved };
    }
}
