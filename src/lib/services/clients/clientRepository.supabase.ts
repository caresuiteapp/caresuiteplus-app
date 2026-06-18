import type { ServiceResult } from '@/types';
import type { WorkflowStatus } from '@/types/core/base';
import type { ClientDetail } from '@/types/detail';
import type { ClientListItem } from '@/types/modules/office';
import type { ClientFormData } from '@/types/forms/clientForm';
import { getSupabaseClient } from '@/lib/supabase/client';
import { mapClientDetail, mapClientListItem } from '@/lib/supabase/mappers';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import type { Database } from '@/lib/supabase/database.types';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import type { ClientContactRow, ClientDetailRow, ClientRow } from '@/lib/supabase/rowTypes';
import { SERVICE_ERRORS } from '../errors';
import { writeClientAudit, writeClientHistory } from './clientAuditHelper';
import { workflowStatusToRemote } from './clientStatusBridge';
import type {
  ClientListOptions,
  ClientMutationContext,
  ClientRepository,
  ClientUpdateInput,
} from './types';

function getClient(): NonNullable<ReturnType<typeof getSupabaseClient>> | null {
  return getSupabaseClient();
}

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

function escapeIlikeTerm(value: string): string {
  return value.replace(/[%_,]/g, '');
}

function buildChangedFieldsSummary(
  before: ClientDetail,
  patch: ClientUpdateInput,
): string | undefined {
  const changes: string[] = [];
  const fields: Array<[keyof ClientUpdateInput, string]> = [
    ['firstName', 'Vorname'],
    ['lastName', 'Nachname'],
    ['dateOfBirth', 'Geburtsdatum'],
    ['street', 'Straße'],
    ['zip', 'PLZ'],
    ['city', 'Ort'],
    ['phone', 'Telefon'],
    ['email', 'E-Mail'],
    ['careLevel', 'Pflegegrad'],
    ['notes', 'Notizen'],
    ['costCarrier', 'Kostenträger'],
    ['insuranceNumber', 'Versichertennummer'],
  ];

  for (const [key, label] of fields) {
    if (patch[key] === undefined) continue;
    const next = String(patch[key] ?? '').trim();
    const prev = String(before[key as keyof ClientDetail] ?? '').trim();
    if (next !== prev) changes.push(label);
  }

  return changes.length > 0 ? `Geändert: ${changes.join(', ')}` : undefined;
}

async function applyArchivePatch(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  tenantId: string,
  clientId: string,
  context?: ClientMutationContext,
): Promise<ServiceResult<void>> {
  const now = new Date().toISOString();
  const remoteStatus = workflowStatusToRemote('archiviert');
  const withArchivedAt = {
    status: remoteStatus,
    updated_by: context?.actorProfileId ?? null,
    archived_at: now,
  };

  let { error } = await supabase
    .from('clients')
    .update(withArchivedAt as Database['public']['Tables']['clients']['Update'])
    .eq('id', clientId)
    .eq('tenant_id', tenantId);

  if (error && /archived_at/i.test(error.message ?? '')) {
    const retry = await supabase
      .from('clients')
      .update({
        status: remoteStatus,
        updated_by: context?.actorProfileId ?? null,
      } as Database['public']['Tables']['clients']['Update'])
      .eq('id', clientId)
      .eq('tenant_id', tenantId);
    error = retry.error;
  }

  if (error) {
    return { ok: false, error: toGermanSupabaseError(error) };
  }
  return { ok: true, data: undefined };
}

export const supabaseClientRepository: ClientRepository = {
  async list(tenantId, options) {
    const supabase = getClient();
    if (!supabase) return unavailable();

    if (options?.simulateError) {
      return { ok: false, error: SERVICE_ERRORS.loadListFailed };
    }
    if (options?.simulateEmpty) {
      return { ok: true, data: [] };
    }

    let query = supabase.from('clients').select('*').eq('tenant_id', tenantId);

    if (options?.lifecycleFilter === 'active') {
      query = query.neq('status', 'archived');
    } else if (options?.lifecycleFilter === 'archived') {
      query = query.eq('status', 'archived');
    }

    if (options?.statusFilter && options.statusFilter !== 'all') {
      query = query.eq('status', workflowStatusToRemote(options.statusFilter));
    }

    if (options?.careLevelFilter && options.careLevelFilter !== 'all') {
      if (options.careLevelFilter === 'none') {
        query = query.is('care_level', null);
      } else {
        query = query.eq('care_level', options.careLevelFilter as Database['public']['Enums']['care_level']);
      }
    }

    if (options?.costBearerFilter && options.costBearerFilter !== 'all') {
      query = query.eq('cost_bearer', options.costBearerFilter);
    }

    const searchTerm = options?.search?.trim();
    if (searchTerm) {
      const term = `%${escapeIlikeTerm(searchTerm)}%`;
      query = query.or(
        `first_name.ilike.${term},last_name.ilike.${term},city.ilike.${term},postal_code.ilike.${term}`,
      );
    }

    const { data, error } = await query
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true });

    if (error) {
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    return { ok: true, data: (data ?? []).map((row) => mapClientListItem(row as unknown as ClientRow)) };
  },

  async getById(tenantId, clientId) {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const { data: client, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !client) {
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    const [contacts, consents, audit, history] = await Promise.all([
      fromUnknownTable(supabase, 'client_contacts').select('*').eq('client_id', clientId),
      fromUnknownTable(supabase, 'client_consents').select('*').eq('client_id', clientId),
      fromUnknownTable(supabase, 'client_audit_entries').select('*').eq('client_id', clientId),
      fromUnknownTable(supabase, 'client_history_entries').select('*').eq('client_id', clientId),
    ]);

    const detailRow = {
      ...(client as unknown as ClientRow),
      ...(client as unknown as Omit<ClientDetailRow, keyof ClientRow>),
      client_contacts: (contacts.data ?? []) as ClientContactRow[],
      client_consents: (consents.data ?? []) as ClientDetailRow['client_consents'],
      client_audit_entries: (audit.data ?? []) as ClientDetailRow['client_audit_entries'],
      client_history_entries: (history.data ?? []) as ClientDetailRow['client_history_entries'],
    } as ClientDetailRow;

    return { ok: true, data: mapClientDetail(detailRow) };
  },

  async create(tenantId, form, context) {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const remoteStatus = workflowStatusToRemote(form.status === 'entwurf' ? 'aktiv' : form.status);
    const { data, error } = await supabase
      .from('clients')
      .insert({
        tenant_id: tenantId,
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        date_of_birth: form.dateOfBirth || null,
        care_level: (form.careLevel.trim() || null) as Database['public']['Enums']['care_level'] | null,
        status: remoteStatus,
        street: form.street.trim() || null,
        city: form.city.trim(),
        postal_code: form.zip.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        internal_notes: form.notes.trim() || null,
        cost_bearer: form.costCarrier.trim() || null,
        insurance_number: form.insuranceNumber.trim() || null,
        created_by: context?.actorProfileId ?? null,
        updated_by: context?.actorProfileId ?? null,
      })
      .select('*')
      .single();

    if (error || !data) {
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    await Promise.all([
      writeClientHistory(supabase, {
        tenantId,
        clientId: data.id,
        icon: '✨',
        title: 'Klient:in angelegt',
        status: 'aktiv',
        actor: context,
      }),
      writeClientAudit(supabase, {
        tenantId,
        clientId: data.id,
        action: 'Klient:in angelegt',
        details: 'Anlage über Assistent',
        actor: context,
      }),
    ]);

    const detailResult = await supabaseClientRepository.getById(tenantId, data.id);
    if (!detailResult.ok) {
      return { ok: false, error: detailResult.error };
    }

    return { ok: true, data: { id: data.id, detail: detailResult.data } };
  },

  async update(tenantId, clientId, input, context) {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const beforeResult = await supabaseClientRepository.getById(tenantId, clientId);
    if (!beforeResult.ok) {
      return beforeResult;
    }

    const patch: Database['public']['Tables']['clients']['Update'] = {
      updated_by: context?.actorProfileId ?? null,
    };
    if (input.firstName !== undefined) patch.first_name = input.firstName.trim();
    if (input.lastName !== undefined) patch.last_name = input.lastName.trim();
    if (input.dateOfBirth !== undefined) patch.date_of_birth = input.dateOfBirth;
    if (input.street !== undefined) patch.street = input.street?.trim() ?? null;
    if (input.zip !== undefined) patch.postal_code = input.zip?.trim() ?? null;
    if (input.city !== undefined) patch.city = input.city?.trim() ?? null;
    if (input.phone !== undefined) patch.phone = input.phone?.trim() ?? null;
    if (input.email !== undefined) patch.email = input.email?.trim() ?? null;
    if (input.notes !== undefined) patch.internal_notes = input.notes?.trim() ?? null;
    if (input.careLevel !== undefined) {
      patch.care_level = (input.careLevel?.trim() || null) as Database['public']['Enums']['care_level'] | null;
    }
    if (input.costCarrier !== undefined) patch.cost_bearer = input.costCarrier?.trim() ?? null;
    if (input.insuranceNumber !== undefined) patch.insurance_number = input.insuranceNumber?.trim() ?? null;
    if (input.primaryContactPhone !== undefined) {
      patch.phone = input.primaryContactPhone?.trim() ?? null;
    }

    const { error } = await supabase
      .from('clients')
      .update(patch)
      .eq('id', clientId)
      .eq('tenant_id', tenantId);

    if (error) {
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    const auditDetails = buildChangedFieldsSummary(beforeResult.data, input);
    if (auditDetails) {
      await Promise.all([
        writeClientAudit(supabase, {
          tenantId,
          clientId,
          action: 'Stammdaten geändert',
          details: auditDetails,
          actor: context,
        }),
        writeClientHistory(supabase, {
          tenantId,
          clientId,
          icon: '✏️',
          title: 'Stammdaten aktualisiert',
          subtitle: auditDetails,
          status: beforeResult.data.status,
          actor: context,
        }),
      ]);
    }

    return supabaseClientRepository.getById(tenantId, clientId);
  },

  async changeStatus(tenantId, clientId, newStatus, context) {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const beforeResult = await supabaseClientRepository.getById(tenantId, clientId);
    if (!beforeResult.ok) {
      return beforeResult;
    }

    const remoteStatus = workflowStatusToRemote(newStatus);
    const { error } = await supabase
      .from('clients')
      .update({
        status: remoteStatus,
        updated_by: context?.actorProfileId ?? null,
      })
      .eq('id', clientId)
      .eq('tenant_id', tenantId);

    if (error) {
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    await Promise.all([
      writeClientHistory(supabase, {
        tenantId,
        clientId,
        icon: '🔄',
        title: 'Status geändert',
        subtitle: `Neuer Status: ${newStatus}`,
        status: newStatus,
        actor: context,
      }),
      writeClientAudit(supabase, {
        tenantId,
        clientId,
        action: 'Status geändert',
        details: `Von ${beforeResult.data.status} nach ${newStatus}`,
        actor: context,
      }),
    ]);

    return supabaseClientRepository.getById(tenantId, clientId);
  },

  async archive(tenantId, clientId, context) {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const archiveResult = await applyArchivePatch(supabase, tenantId, clientId, context);
    if (!archiveResult.ok) {
      return archiveResult;
    }

    await Promise.all([
      writeClientHistory(supabase, {
        tenantId,
        clientId,
        icon: '📦',
        title: 'Klient:in archiviert',
        status: 'archiviert',
        actor: context,
      }),
      writeClientAudit(supabase, {
        tenantId,
        clientId,
        action: 'Klient:in archiviert',
        details: 'Soft-Archivierung',
        actor: context,
      }),
    ]);

    return supabaseClientRepository.getById(tenantId, clientId);
  },
};
