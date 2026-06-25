import type { ServiceResult } from '@/types';
import type {
  ClientBillingProfile,
  ClientBudget,
  ClientConsentRecord,
  ClientContactRecord,
  ClientFullDetail,
  ClientInternalNote,
  ClientPortalAccess,
  ClientRisk,
  ClientSchedulingWishes,
  ClientSchedulingWishesInput,
  ClientTask,
  ClientTimelineEvent,
} from '@/types/modules/client';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import {
  mapClientBillingProfile,
  mapClientBudget,
  mapClientConsentExtended,
  mapClientContactExtended,
  mapClientFullDetail,
  mapClientInternalNote,
  mapClientPortalAccess,
  mapClientRisk,
  mapClientTask,
  mapClientTimelineEvent,
  mapClientDocument,
} from '@/lib/supabase/mappers';
import type { ClientPortalAccessListItem } from '@/lib/access/clientPortalAccessListMapper';
import type { ClientContactRow, ClientExtendedRow } from '@/lib/supabase/rowTypes';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import type { ClientCareContext } from '@/lib/clients/clientIntakeFieldRules';
import { aggregateClientTimelineEvents } from '@/lib/clients/clientTimelineAggregation';
import { writeClientAudit } from '@/lib/services/clients/clientAuditHelper';
import {
  mergeClientRecordDocuments,
} from '@/lib/clients/clientDocumentMerge';
import { promoteFinalizedIntakeDocumentsToClientRecord } from '@/features/intakeDocuments/intakeDocumentRepository';
import { syncClientCareEntitlementFromLegacy } from '@/lib/assist/clientCareEntitlementSyncService';
import type { ClientContactInput } from '../clientContactsService';
import {
  mapClientSchedulingWishes,
  mapSchedulingWishesToRow,
} from '../clientSchedulingWishesMapper';

function castRows(rows: unknown[] | null | undefined): Record<string, unknown>[] {
  return (rows ?? []) as Record<string, unknown>[];
}

function castRow(row: unknown): Record<string, unknown> {
  return row as Record<string, unknown>;
}

function getClient() {
  return getSupabaseClient();
}

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

async function assertClientExists(tenantId: string, clientId: string): Promise<ServiceResult<ClientExtendedRow>> {
  const supabase = getClient();
  if (!supabase) return unavailable();

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !data) {
    return { ok: false, error: error ? toGermanSupabaseError(error) : SERVICE_ERRORS.clientNotFound };
  }

  return { ok: true, data: data as unknown as ClientExtendedRow };
}

async function loadFullDetailParts(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<ClientFullDetail>> {
  const supabase = getClient();
  if (!supabase) return unavailable<ClientFullDetail>();

  const clientResult = await assertClientExists(tenantId, clientId);
  if (!clientResult.ok) return clientResult;

  const [
    contacts,
    consents,
    audit,
    history,
    addresses,
    careLevels,
    budgets,
    billingProfiles,
    contracts,
    documents,
    intakeDocuments,
    notes,
    risks,
    portalAccess,
    tasks,
    timeline,
  ] = await Promise.all([
    fromUnknownTable(supabase, 'client_contacts').select('*').eq('client_id', clientId).eq('tenant_id', tenantId),
    fromUnknownTable(supabase, 'client_consents').select('*').eq('client_id', clientId).eq('tenant_id', tenantId),
    fromUnknownTable(supabase, 'client_audit_entries').select('*').eq('client_id', clientId).eq('tenant_id', tenantId),
    fromUnknownTable(supabase, 'client_history_entries').select('*').eq('client_id', clientId).eq('tenant_id', tenantId),
    fromUnknownTable(supabase, 'client_addresses').select('*').eq('client_id', clientId).eq('tenant_id', tenantId),
    fromUnknownTable(supabase, 'client_care_levels').select('*').eq('client_id', clientId).eq('tenant_id', tenantId),
    fromUnknownTable(supabase, 'client_budgets').select('*').eq('client_id', clientId).eq('tenant_id', tenantId),
    fromUnknownTable(supabase, 'client_billing_profiles').select('*').eq('client_id', clientId).eq('tenant_id', tenantId),
    fromUnknownTable(supabase, 'client_contracts').select('*').eq('client_id', clientId).eq('tenant_id', tenantId),
    fromUnknownTable(supabase, 'client_documents').select('*').eq('client_id', clientId).eq('tenant_id', tenantId),
    fromUnknownTable(supabase, 'client_intake_documents').select('*').eq('client_id', clientId).eq('tenant_id', tenantId),
    fromUnknownTable(supabase, 'client_notes').select('*').eq('client_id', clientId).eq('tenant_id', tenantId),
    fromUnknownTable(supabase, 'client_risks').select('*').eq('client_id', clientId).eq('tenant_id', tenantId),
    fromUnknownTable(supabase, 'client_portal_access').select('*').eq('client_id', clientId).eq('tenant_id', tenantId),
    fromUnknownTable(supabase, 'client_tasks').select('*').eq('client_id', clientId).eq('tenant_id', tenantId),
fromUnknownTable(supabase, 'client_timeline_events')
      .select('*')
      .eq('client_id', clientId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }),
  ]);

  const firstError =
    contacts.error ??
    consents.error ??
    audit.error ??
    history.error ??
    addresses.error ??
    careLevels.error ??
    budgets.error ??
    billingProfiles.error ??
    contracts.error ??
    documents.error ??
    intakeDocuments.error ??
    notes.error ??
    risks.error ??
    portalAccess.error ??
    tasks.error ??
    timeline.error;

  if (firstError) {
    return { ok: false, error: toGermanSupabaseError(firstError) };
  }

  await syncClientCareEntitlementFromLegacy(tenantId, clientId, { regenerateAccounts: false });

  return {
    ok: true,
    data: mapClientFullDetail({
      client: clientResult.data,
      contacts: castRows(contacts.data),
      consents: castRows(consents.data),
      audit: castRows(audit.data),
      history: castRows(history.data),
      addresses: castRows(addresses.data),
      careLevels: castRows(careLevels.data),
      budgets: castRows(budgets.data),
      billingProfiles: castRows(billingProfiles.data),
      contracts: castRows(contracts.data),
      documents: castRows(documents.data),
      intakeDocuments: castRows(intakeDocuments.data),
      notes: castRows(notes.data),
      risks: castRows(risks.data),
      portalAccess: castRows(portalAccess.data),
      tasks: castRows(tasks.data),
      timeline: castRows(timeline.data),
    }),
  };
}

export const supabaseClientExtendedRepository = {
  async fetchFullDetail(tenantId: string, clientId: string): Promise<ServiceResult<ClientFullDetail>> {
    return loadFullDetailParts(tenantId, clientId);
  },

  async fetchContacts(tenantId: string, clientId: string): Promise<ServiceResult<ClientContactRecord[]>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const exists = await assertClientExists(tenantId, clientId);
    if (!exists.ok) return exists;

    const { data, error } = await fromUnknownTable(supabase, 'client_contacts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .order('created_at', { ascending: true });

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: castRows(data).map((row) => mapClientContactExtended(row as ClientContactRow)) };
  },

  async createContact(
    tenantId: string,
    clientId: string,
    input: ClientContactInput,
  ): Promise<ServiceResult<ClientContactRecord>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const exists = await assertClientExists(tenantId, clientId);
    if (!exists.ok) return exists;

    const { data, error } = await fromUnknownTable(supabase, 'client_contacts')
      .insert({
        tenant_id: tenantId,
        client_id: clientId,
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
        relationship: input.relationshipLabel ?? input.relationship,
        phone: input.phone,
        email: input.email,
        is_emergency_contact: input.contactType === 'emergency_contact',
        contact_type: input.contactType,
        is_portal_user: input.isPortalUser,
        portal_permissions: input.portalPermissions,
        notes: input.notes,
      })
      .select('*')
      .single();

    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: mapClientContactExtended(data) };
  },

  async updateContact(
    tenantId: string,
    clientId: string,
    contactId: string,
    input: Partial<ClientContactInput>,
  ): Promise<ServiceResult<ClientContactRecord>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const patch: Record<string, unknown> = {};
    if (input.firstName !== undefined) patch.first_name = input.firstName.trim();
    if (input.lastName !== undefined) patch.last_name = input.lastName.trim();
    if (input.relationship !== undefined || input.relationshipLabel !== undefined) {
      patch.relationship = input.relationshipLabel ?? input.relationship;
    }
    if (input.phone !== undefined) patch.phone = input.phone;
    if (input.email !== undefined) patch.email = input.email;
    if (input.contactType !== undefined) {
      patch.is_emergency_contact = input.contactType === 'emergency_contact';
      patch.contact_type = input.contactType;
    } else if (input.isEmergency !== undefined) {
      patch.is_emergency_contact = input.isEmergency;
      patch.contact_type = input.isEmergency ? 'emergency_contact' : 'relative';
    }
    if (input.isPortalUser !== undefined) patch.is_portal_user = input.isPortalUser;
    if (input.portalPermissions !== undefined) patch.portal_permissions = input.portalPermissions;
    if (input.notes !== undefined) patch.notes = input.notes;

    const { data, error } = await fromUnknownTable(supabase, 'client_contacts')
      .update(patch as Partial<ClientContactRow>)
      .eq('id', contactId)
      .eq('client_id', clientId)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();

    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: mapClientContactExtended(data) };
  },

  async deleteContact(tenantId: string, clientId: string, contactId: string): Promise<ServiceResult<void>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const { error } = await fromUnknownTable(supabase, 'client_contacts')
      .delete()
      .eq('id', contactId)
      .eq('client_id', clientId)
      .eq('tenant_id', tenantId);

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: undefined };
  },

  async fetchBudgets(tenantId: string, clientId: string): Promise<ServiceResult<ClientBudget[]>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const exists = await assertClientExists(tenantId, clientId);
    if (!exists.ok) return exists;

    const { data, error } = await fromUnknownTable(supabase, 'client_budgets')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .order('year', { ascending: false });

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: castRows(data).map((row) => mapClientBudget(row as Parameters<typeof mapClientBudget>[0])) };
  },

  async updateBudget(
    tenantId: string,
    clientId: string,
    budgetId: string,
    input: Partial<Pick<ClientBudget, 'usedAmountCents' | 'reservedAmountCents' | 'notes'>>,
  ): Promise<ServiceResult<ClientBudget>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const patch: Record<string, unknown> = {};
    if (input.usedAmountCents !== undefined) patch.used_amount_cents = input.usedAmountCents;
    if (input.reservedAmountCents !== undefined) patch.reserved_amount_cents = input.reservedAmountCents;
    if (input.notes !== undefined) patch.notes = input.notes;

    const { data, error } = await fromUnknownTable(supabase, 'client_budgets')
      .update(patch as Record<string, unknown>)
      .eq('id', budgetId)
      .eq('client_id', clientId)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();

    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: mapClientBudget(castRow(data) as Parameters<typeof mapClientBudget>[0]) };
  },

  async fetchBilling(
    tenantId: string,
    clientId: string,
  ): Promise<ServiceResult<{ profile: ClientBillingProfile | null; contracts: ClientFullDetail['contracts'] }>> {
    const full = await loadFullDetailParts(tenantId, clientId);
    if (!full.ok) return full;
    return {
      ok: true,
      data: { profile: full.data.billingProfile, contracts: full.data.contracts },
    };
  },

  async updateBillingProfile(
    tenantId: string,
    clientId: string,
    input: Partial<Omit<ClientBillingProfile, 'id' | 'tenantId' | 'clientId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<ServiceResult<ClientBillingProfile>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const { data: existing, error: loadError } = await fromUnknownTable(supabase, 'client_billing_profiles')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .maybeSingle();

    if (loadError) return { ok: false, error: toGermanSupabaseError(loadError) };
    if (!existing) return { ok: false, error: 'Kein Abrechnungsprofil vorhanden.' };

    const patch: Record<string, unknown> = {};
    if (input.billingType !== undefined) patch.billing_type = input.billingType;
    if (input.hourlyRateCents !== undefined) patch.hourly_rate_cents = input.hourlyRateCents;
    if (input.serviceType !== undefined) patch.service_type = input.serviceType;
    if (input.invoiceRecipient !== undefined) patch.invoice_recipient = input.invoiceRecipient;
    if (input.paymentTermsDays !== undefined) patch.payment_terms_days = input.paymentTermsDays;
    if (input.costBearerName !== undefined) patch.cost_bearer_name = input.costBearerName;
    if (input.costBearerReference !== undefined) patch.cost_bearer_reference = input.costBearerReference;
    if (input.notes !== undefined) patch.notes = input.notes;

    const { data, error } = await fromUnknownTable(supabase, 'client_billing_profiles')
      .update(patch as Record<string, unknown>)
      .eq('id', existing.id)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();

    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: mapClientBillingProfile(castRow(data) as Parameters<typeof mapClientBillingProfile>[0]) };
  },

  async fetchConsents(tenantId: string, clientId: string): Promise<ServiceResult<ClientConsentRecord[]>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const exists = await assertClientExists(tenantId, clientId);
    if (!exists.ok) return exists;

    const { data, error } = await fromUnknownTable(supabase, 'client_consents')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .order('created_at', { ascending: true });

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return {
      ok: true,
      data: castRows(data).map((row) => mapClientConsentExtended(row as Parameters<typeof mapClientConsentExtended>[0])),
    };
  },

  async updateConsent(
    tenantId: string,
    clientId: string,
    consentId: string,
    granted: boolean,
    grantedByProfileId?: string,
  ): Promise<ServiceResult<ClientConsentRecord>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const now = new Date().toISOString();
    const { data, error } = await fromUnknownTable(supabase, 'client_consents')
      .update({
        granted,
        granted_at: granted ? now : null,
        granted_by_profile_id: granted ? (grantedByProfileId ?? null) : null,
      })
      .eq('id', consentId)
      .eq('client_id', clientId)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();

    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    const consent = mapClientConsentExtended(castRow(data) as Parameters<typeof mapClientConsentExtended>[0]);
    await writeClientAudit(supabase, {
      tenantId,
      clientId,
      action: 'Einwilligung geändert',
      details: `${consent.title}: ${granted ? 'erteilt' : 'widerrufen'}`,
    });
    return { ok: true, data: consent };
  },

  async fetchTasks(tenantId: string, clientId: string): Promise<ServiceResult<ClientTask[]>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const exists = await assertClientExists(tenantId, clientId);
    if (!exists.ok) return exists;

    const { data, error } = await fromUnknownTable(supabase, 'client_tasks')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: castRows(data).map((row) => mapClientTask(row as Parameters<typeof mapClientTask>[0])) };
  },

  async createTask(
    tenantId: string,
    clientId: string,
    input: Omit<ClientTask, 'id' | 'tenantId' | 'clientId' | 'createdAt' | 'updatedAt'>,
  ): Promise<ServiceResult<ClientTask>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const exists = await assertClientExists(tenantId, clientId);
    if (!exists.ok) return exists;

    const { data, error } = await fromUnknownTable(supabase, 'client_tasks')
      .insert({
        tenant_id: tenantId,
        client_id: clientId,
        category: input.category,
        title: input.title,
        description: input.description,
        frequency: input.frequency,
        duration_minutes: input.durationMinutes,
        is_active: input.isActive,
        catalog_task_id: input.catalogTaskId,
        assigned_employee_ids: input.assignedEmployeeIds,
        module_key: input.moduleKey ?? 'assist',
        leistungsbereich: input.leistungsbereich,
        subcategory: input.subcategory,
        package_id: input.packageId,
        leistungsart: input.leistungsart,
        is_mandatory: input.isMandatory,
        proof_required: input.proofRequired,
        documentation_required: input.documentationRequired,
        billing_relevant: input.billingRelevant,
        visible_to_client: input.visibleToClient,
      })
      .select('*')
      .single();

    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    const task = mapClientTask(castRow(data) as Parameters<typeof mapClientTask>[0]);
    await writeClientAudit(supabase, {
      tenantId,
      clientId,
      action: 'Aufgabe angelegt',
      details: task.title,
    });
    return { ok: true, data: task };
  },

  async updateTask(
    tenantId: string,
    clientId: string,
    taskId: string,
    input: Partial<Omit<ClientTask, 'id' | 'tenantId' | 'clientId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<ServiceResult<ClientTask>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.category !== undefined) patch.category = input.category;
    if (input.title !== undefined) patch.title = input.title.trim();
    if (input.description !== undefined) patch.description = input.description;
    if (input.frequency !== undefined) patch.frequency = input.frequency;
    if (input.durationMinutes !== undefined) patch.duration_minutes = input.durationMinutes;
    if (input.isActive !== undefined) patch.is_active = input.isActive;
    if (input.catalogTaskId !== undefined) patch.catalog_task_id = input.catalogTaskId;
    if (input.assignedEmployeeIds !== undefined) patch.assigned_employee_ids = input.assignedEmployeeIds;
    if (input.moduleKey !== undefined) patch.module_key = input.moduleKey;
    if (input.leistungsbereich !== undefined) patch.leistungsbereich = input.leistungsbereich;
    if (input.subcategory !== undefined) patch.subcategory = input.subcategory;
    if (input.packageId !== undefined) patch.package_id = input.packageId;
    if (input.leistungsart !== undefined) patch.leistungsart = input.leistungsart;
    if (input.isMandatory !== undefined) patch.is_mandatory = input.isMandatory;
    if (input.proofRequired !== undefined) patch.proof_required = input.proofRequired;
    if (input.documentationRequired !== undefined) patch.documentation_required = input.documentationRequired;
    if (input.billingRelevant !== undefined) patch.billing_relevant = input.billingRelevant;
    if (input.visibleToClient !== undefined) patch.visible_to_client = input.visibleToClient;

    const { data, error } = await fromUnknownTable(supabase, 'client_tasks')
      .update(patch)
      .eq('id', taskId)
      .eq('client_id', clientId)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();

    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    const task = mapClientTask(castRow(data) as Parameters<typeof mapClientTask>[0]);
    await writeClientAudit(supabase, {
      tenantId,
      clientId,
      action: 'Aufgabe geändert',
      details: task.title,
    });
    return { ok: true, data: task };
  },

  async deleteTask(tenantId: string, clientId: string, taskId: string): Promise<ServiceResult<void>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const { data: existing } = await fromUnknownTable(supabase, 'client_tasks')
      .select('title')
      .eq('id', taskId)
      .eq('client_id', clientId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const { error } = await fromUnknownTable(supabase, 'client_tasks')
      .delete()
      .eq('id', taskId)
      .eq('client_id', clientId)
      .eq('tenant_id', tenantId);

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    await writeClientAudit(supabase, {
      tenantId,
      clientId,
      action: 'Aufgabe gelöscht',
      details: typeof existing?.title === 'string' ? existing.title : taskId,
    });
    return { ok: true, data: undefined };
  },

  async fetchSchedulingWishes(
    tenantId: string,
    clientId: string,
  ): Promise<ServiceResult<ClientSchedulingWishes | null>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const exists = await assertClientExists(tenantId, clientId);
    if (!exists.ok) return exists;

    const { data, error } = await fromUnknownTable(supabase, 'client_scheduling_wishes')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .maybeSingle();

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    if (!data) return { ok: true, data: null };
    return {
      ok: true,
      data: mapClientSchedulingWishes(castRow(data) as Parameters<typeof mapClientSchedulingWishes>[0]),
    };
  },

  async upsertSchedulingWishes(
    tenantId: string,
    clientId: string,
    input: ClientSchedulingWishesInput,
  ): Promise<ServiceResult<ClientSchedulingWishes>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const exists = await assertClientExists(tenantId, clientId);
    if (!exists.ok) return exists;

    const payload = mapSchedulingWishesToRow(tenantId, clientId, input);
    const { data, error } = await fromUnknownTable(supabase, 'client_scheduling_wishes')
      .upsert(payload, { onConflict: 'client_id' })
      .select('*')
      .single();

    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    const wishes = mapClientSchedulingWishes(castRow(data) as Parameters<typeof mapClientSchedulingWishes>[0]);
    await writeClientAudit(supabase, {
      tenantId,
      clientId,
      action: 'Einsatz-Wünsche aktualisiert',
      details: wishes.preferredDays.length > 0
        ? `${wishes.preferredDays.length} Wunschtage`
        : 'Präferenzen gespeichert',
    });
    return { ok: true, data: wishes };
  },

  async fetchTimeline(
    tenantId: string,
    clientId: string,
    portalOnly?: boolean,
  ): Promise<ServiceResult<ClientTimelineEvent[]>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const exists = await assertClientExists(tenantId, clientId);
    if (!exists.ok) return exists;

    const timelineLimit = 200;

    const [timelineResult, auditResult, documentResult] = await Promise.all([
      (() => {
        let query = fromUnknownTable(supabase, 'client_timeline_events')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(timelineLimit);
        if (portalOnly) {
          query = query.eq('is_internal', false);
        }
        return query;
      })(),
      fromUnknownTable(supabase, 'client_audit_entries')
        .select('id, action, details, actor_name, created_at, client_id')
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(timelineLimit),
      fromUnknownTable(supabase, 'client_document_events')
        .select('id, event_type, summary, created_at, client_id, profiles(first_name, last_name, full_name)')
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(timelineLimit),
    ]);

    const firstError = timelineResult.error ?? auditResult.error ?? documentResult.error;
    const hasData =
      (timelineResult.data?.length ?? 0) > 0 ||
      (auditResult.data?.length ?? 0) > 0 ||
      (documentResult.data?.length ?? 0) > 0;

    if (firstError && !hasData) {
      return { ok: false, error: toGermanSupabaseError(firstError) };
    }

    const timelineEvents = castRows(timelineResult.data).map((row) =>
      mapClientTimelineEvent(row as Parameters<typeof mapClientTimelineEvent>[0]),
    );

    return {
      ok: true,
      data: aggregateClientTimelineEvents({
        clientId,
        timelineEvents,
        auditEntries: castRows(auditResult.data) as Parameters<
          typeof aggregateClientTimelineEvents
        >[0]['auditEntries'],
        documentEvents: castRows(documentResult.data) as Parameters<
          typeof aggregateClientTimelineEvents
        >[0]['documentEvents'],
        portalOnly,
      }),
    };
  },

  async addTimelineEvent(
    tenantId: string,
    clientId: string,
    event: Omit<ClientTimelineEvent, 'id' | 'clientId'>,
  ): Promise<ServiceResult<ClientTimelineEvent>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const exists = await assertClientExists(tenantId, clientId);
    if (!exists.ok) return exists;

    const { data, error } = await fromUnknownTable(supabase, 'client_timeline_events')
      .insert({
        tenant_id: tenantId,
        client_id: clientId,
        event_type: event.eventType,
        icon: event.icon,
        title: event.title,
        subtitle: event.subtitle,
        status: event.status,
        actor_name: event.actorName,
        is_internal: event.isInternal,
        metadata: event.metadata,
      })
      .select('*')
      .single();

    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: mapClientTimelineEvent(castRow(data) as Parameters<typeof mapClientTimelineEvent>[0]) };
  },

  async fetchRisks(
    tenantId: string,
    clientId: string,
  ): Promise<ServiceResult<{ risks: ClientRisk[]; emergencyPlan: null }>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const exists = await assertClientExists(tenantId, clientId);
    if (!exists.ok) return exists;

    const { data, error } = await fromUnknownTable(supabase, 'client_risks')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .order('assessed_at', { ascending: false });

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return {
      ok: true,
      data: {
        risks: castRows(data).map((row) => mapClientRisk(row as Parameters<typeof mapClientRisk>[0])),
        emergencyPlan: null,
      },
    };
  },

  async createRisk(
    tenantId: string,
    clientId: string,
    input: Omit<ClientRisk, 'id' | 'tenantId' | 'clientId' | 'createdAt' | 'updatedAt'>,
  ): Promise<ServiceResult<ClientRisk>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const exists = await assertClientExists(tenantId, clientId);
    if (!exists.ok) return exists;

    const { data, error } = await fromUnknownTable(supabase, 'client_risks')
      .insert({
        tenant_id: tenantId,
        client_id: clientId,
        category: input.category,
        level: input.level,
        description: input.description,
        mitigation: input.mitigation,
        assessed_at: input.assessedAt,
        assessed_by: input.assessedBy,
      })
      .select('*')
      .single();

    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: mapClientRisk(castRow(data) as Parameters<typeof mapClientRisk>[0]) };
  },

  async listPortalAccessForTenant(tenantId: string): Promise<ServiceResult<ClientPortalAccessListItem[]>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const { data, error } = await fromUnknownTable(supabase, 'client_portal_access')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false });

    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    const rows = castRows(data).map((row) =>
      mapClientPortalAccess(row as Parameters<typeof mapClientPortalAccess>[0]),
    );

    const clientIds = [...new Set(rows.map((entry) => entry.clientId))];
    const clientNames = new Map<string, string>();

    if (clientIds.length > 0) {
      const { data: clientRows } = await fromUnknownTable(supabase, 'clients')
        .select('id, first_name, last_name')
        .eq('tenant_id', tenantId)
        .in('id', clientIds);

      for (const row of castRows(clientRows)) {
        const id = String(row.id ?? '');
        const name = `${String(row.first_name ?? '')} ${String(row.last_name ?? '')}`.trim();
        if (id && name) clientNames.set(id, name);
      }
    }

    return {
      ok: true,
      data: rows.map((access) => ({
        id: access.id,
        tenantId: access.tenantId,
        clientId: access.clientId,
        clientName: clientNames.get(access.clientId) ?? 'Unbekannt',
        portalUsername: access.portalUsername,
        portalEnabled: access.portalEnabled,
        status: access.status,
        lastLoginAt: access.lastLoginAt,
        codeCreatedAt: access.codeCreatedAt,
      })),
    };
  },

  async fetchPortalAccess(tenantId: string, clientId: string): Promise<ServiceResult<ClientPortalAccess[]>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const exists = await assertClientExists(tenantId, clientId);
    if (!exists.ok) return exists;

    const { data, error } = await fromUnknownTable(supabase, 'client_portal_access')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return {
      ok: true,
      data: castRows(data).map((row) => mapClientPortalAccess(row as Parameters<typeof mapClientPortalAccess>[0])),
    };
  },

  async invitePortalAccess(
    tenantId: string,
    clientId: string,
    email: string,
    contactId?: string,
  ): Promise<ServiceResult<ClientPortalAccess>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const exists = await assertClientExists(tenantId, clientId);
    if (!exists.ok) return exists;

    const now = new Date().toISOString();
    const { data, error } = await fromUnknownTable(supabase, 'client_portal_access')
      .insert({
        tenant_id: tenantId,
        client_id: clientId,
        contact_id: contactId ?? null,
        email,
        status: 'nicht_eingerichtet',
        invited_at: now,
        portal_enabled: false,
        modules_enabled: ['appointments', 'messages', 'documents'],
        two_factor_enabled: false,
      })
      .select('*')
      .single();

    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: mapClientPortalAccess(castRow(data) as Parameters<typeof mapClientPortalAccess>[0]) };
  },

  async listPortalUsernames(tenantId: string): Promise<string[]> {
    const supabase = getClient();
    if (!supabase) return [];

    const { data, error } = await fromUnknownTable(supabase, 'client_portal_access')
      .select('portal_username')
      .eq('tenant_id', tenantId)
      .not('portal_username', 'is', null);

    if (error) return [];
    return castRows(data)
      .map((row) => String((row as { portal_username?: string }).portal_username ?? ''))
      .filter(Boolean);
  },

  async setupPortalAccess(input: {
    tenantId: string;
    clientId: string;
    username: string;
    codeHash: string;
  }): Promise<ServiceResult<ClientPortalAccess>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const exists = await assertClientExists(input.tenantId, input.clientId);
    if (!exists.ok) return exists;

    const now = new Date().toISOString();
    const { data: existingRows } = await fromUnknownTable(supabase, 'client_portal_access')
      .select('*')
      .eq('tenant_id', input.tenantId)
      .eq('client_id', input.clientId)
      .limit(1);

    const existing = castRows(existingRows)[0] as Record<string, unknown> | undefined;

    const payload = {
      portal_username: input.username,
      portal_access_code_hash: input.codeHash,
      portal_enabled: true,
      status: 'aktiv',
      code_created_at: now,
      code_rotated_at: null,
      email: null,
      updated_at: now,
    };

    const query = existing
      ? fromUnknownTable(supabase, 'client_portal_access')
          .update(payload)
          .eq('id', existing.id as string)
      : fromUnknownTable(supabase, 'client_portal_access').insert({
          tenant_id: input.tenantId,
          client_id: input.clientId,
          contact_id: null,
          modules_enabled: ['appointments', 'messages', 'documents'],
          two_factor_enabled: false,
          invited_at: null,
          ...payload,
        });

    const { data, error } = await query.select('*').single();
    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };

    const access = mapClientPortalAccess(castRow(data) as Parameters<typeof mapClientPortalAccess>[0]);
    await writeClientAudit(supabase, {
      tenantId: input.tenantId,
      clientId: input.clientId,
      action: 'Portal-Zugang eingerichtet',
      details: `Benutzername: ${input.username}`,
    });
    return { ok: true, data: access };
  },

  async regeneratePortalAccessCode(input: {
    tenantId: string;
    clientId: string;
    accessId: string;
    codeHash: string;
  }): Promise<ServiceResult<ClientPortalAccess>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const exists = await assertClientExists(input.tenantId, input.clientId);
    if (!exists.ok) return exists;

    const now = new Date().toISOString();
    const { data, error } = await fromUnknownTable(supabase, 'client_portal_access')
      .update({
        portal_access_code_hash: input.codeHash,
        portal_enabled: true,
        status: 'aktiv',
        code_rotated_at: now,
        updated_at: now,
      })
      .eq('tenant_id', input.tenantId)
      .eq('client_id', input.clientId)
      .eq('id', input.accessId)
      .select('*')
      .single();

    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    const access = mapClientPortalAccess(castRow(data) as Parameters<typeof mapClientPortalAccess>[0]);
    if (!access.portalUsername) {
      return { ok: false, error: 'Portal-Zugang ist nicht eingerichtet.' };
    }

    await writeClientAudit(supabase, {
      tenantId: input.tenantId,
      clientId: input.clientId,
      action: 'Portal-Zugangscode erneuert',
      details: `Benutzername: ${access.portalUsername}`,
    });

    return { ok: true, data: access };
  },

  async fetchDocuments(tenantId: string, clientId: string): Promise<ServiceResult<ClientFullDetail['documents']>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const exists = await assertClientExists(tenantId, clientId);
    if (!exists.ok) return exists;

    await promoteFinalizedIntakeDocumentsToClientRecord(tenantId, clientId);

    const [documents, intakeDocuments] = await Promise.all([
      fromUnknownTable(supabase, 'client_documents')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false }),
      fromUnknownTable(supabase, 'client_intake_documents')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .order('updated_at', { ascending: false }),
    ]);

    if (documents.error) return { ok: false, error: toGermanSupabaseError(documents.error) };
    if (intakeDocuments.error) return { ok: false, error: toGermanSupabaseError(intakeDocuments.error) };

    const merged = mergeClientRecordDocuments(
      castRows(documents.data).map((row) => mapClientDocument(row as Parameters<typeof mapClientDocument>[0])),
      castRows(intakeDocuments.data) as Parameters<typeof mergeClientRecordDocuments>[1],
    );

    return { ok: true, data: merged };
  },

  async fetchCareContexts(tenantId: string, clientId: string): Promise<ServiceResult<ClientCareContext[]>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const exists = await assertClientExists(tenantId, clientId);
    if (!exists.ok) return exists;

    const { data, error } = await fromUnknownTable(supabase, 'client_care_contexts')
      .select('context_key, is_primary')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .order('is_primary', { ascending: false });

    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    const contexts = castRows(data)
      .map((row) => String((row as { context_key: string }).context_key) as ClientCareContext)
      .filter(Boolean);

    return { ok: true, data: contexts.length > 0 ? contexts : ['daily_assistance'] };
  },

  async insertDocument(
    tenantId: string,
    clientId: string,
    input: {
      title: string;
      fileName: string;
      mimeType: string;
      category: ClientFullDetail['documents'][number]['category'];
      storagePath: string;
      sizeBytes?: number;
      uploadedBy?: string | null;
    },
  ): Promise<ServiceResult<ClientFullDetail['documents'][number]>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const exists = await assertClientExists(tenantId, clientId);
    if (!exists.ok) return exists;

    const { data, error } = await fromUnknownTable(supabase, 'client_documents')
      .insert({
        tenant_id: tenantId,
        client_id: clientId,
        title: input.title,
        file_name: input.fileName,
        mime_type: input.mimeType,
        category: input.category,
        storage_path: input.storagePath,
        status: 'aktiv',
        sensitivity: 'care',
        source: 'upload',
        size_bytes: input.sizeBytes ?? null,
        uploaded_by: input.uploadedBy ?? null,
      })
      .select('*')
      .single();

    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    return {
      ok: true,
      data: mapClientDocument(castRow(data) as Parameters<typeof mapClientDocument>[0]),
    };
  },

  async fetchInternalNotes(tenantId: string, clientId: string): Promise<ServiceResult<ClientInternalNote[]>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const exists = await assertClientExists(tenantId, clientId);
    if (!exists.ok) return exists;

    const { data, error } = await fromUnknownTable(supabase, 'client_notes')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('is_internal', true)
      .order('created_at', { ascending: false });

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return {
      ok: true,
      data: castRows(data).map((row) => mapClientInternalNote(row as Parameters<typeof mapClientInternalNote>[0])),
    };
  },

  async createInternalNote(
    tenantId: string,
    clientId: string,
    content: string,
    createdBy: string,
    category: ClientInternalNote['category'] = 'allgemein',
  ): Promise<ServiceResult<ClientInternalNote>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const exists = await assertClientExists(tenantId, clientId);
    if (!exists.ok) return exists;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(createdBy);

    const { data, error } = await fromUnknownTable(supabase, 'client_notes')
      .insert({
        tenant_id: tenantId,
        client_id: clientId,
        content,
        is_internal: true,
        category,
        created_by: isUuid ? createdBy : null,
      })
      .select('*')
      .single();

    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: mapClientInternalNote(castRow(data) as Parameters<typeof mapClientInternalNote>[0]) };
  },
};
