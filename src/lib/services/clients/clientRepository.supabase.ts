import type { ServiceResult } from '@/types';
import type { ClientDetail } from '@/types/detail';
import type { ClientListItem } from '@/types/modules/office';
import type { ClientFormData } from '@/types/forms/clientForm';
import { getSupabaseClient } from '@/lib/supabase/client';
import { mapClientDetail, mapClientListItem } from '@/lib/supabase/mappers';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import type { Database } from '@/lib/supabase/database.types';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import type {
  ClientContactRow,
  ClientDetailRow,
  ClientInsert,
  ClientRow,
  WorkflowStatusDb,
} from '@/lib/supabase/rowTypes';
import { SERVICE_ERRORS } from '../errors';
import type { ClientRepository } from './types';

function getClient(): NonNullable<ReturnType<typeof getSupabaseClient>> | null {
  return getSupabaseClient();
}

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
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

    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('tenant_id', tenantId)
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

    const detailRow: ClientDetailRow = {
      ...(client as unknown as ClientRow),
      ...(client as unknown as Omit<ClientDetailRow, keyof ClientRow>),
      client_contacts: (contacts.data ?? []) as ClientContactRow[],
      client_consents: (consents.data ?? []) as ClientDetailRow['client_consents'],
      client_audit_entries: (audit.data ?? []) as ClientDetailRow['client_audit_entries'],
      client_history_entries: (history.data ?? []) as ClientDetailRow['client_history_entries'],
    };

    return { ok: true, data: mapClientDetail(detailRow) };
  },

  async create(tenantId, form) {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('clients')
      .insert({
        tenant_id: tenantId,
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        date_of_birth: form.dateOfBirth || null,
        care_level: (form.careLevel.trim() || null) as Database['public']['Enums']['care_level'] | null,
        status: form.status as unknown as Database['public']['Enums']['client_status'],
        street: form.street.trim(),
        city: form.city.trim(),
        postal_code: form.zip.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        internal_notes: form.notes.trim() || null,
      })
      .select('*')
      .single();

    if (error || !data) {
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    await fromUnknownTable(supabase, 'client_history_entries').insert({
      tenant_id: tenantId,
      client_id: data.id,
      icon: '✨',
      title: 'Klient:in angelegt',
      status: form.status,
      actor_name: 'System',
      created_at: now,
    });

    await fromUnknownTable(supabase, 'client_audit_entries').insert({
      tenant_id: tenantId,
      client_id: data.id,
      action: 'Klient:in angelegt',
      actor_name: 'System',
      details: 'Anlage über Assistent',
      created_at: now,
    });

    const detailResult = await supabaseClientRepository.getById(tenantId, data.id);
    if (!detailResult.ok) {
      return { ok: false, error: detailResult.error };
    }

    return { ok: true, data: { id: data.id, detail: detailResult.data } };
  },

  async update(tenantId, clientId, input) {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const patch: Partial<ClientInsert> & {
      postal_code?: string | null;
      internal_notes?: string | null;
      care_level?: Database['public']['Enums']['care_level'] | null;
    } = {};
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
    if (input.primaryContactPhone !== undefined) {
      patch.phone = input.primaryContactPhone?.trim() ?? null;
    }

    const { error } = await supabase
      .from('clients')
      .update(patch as Database['public']['Tables']['clients']['Update'])
      .eq('id', clientId)
      .eq('tenant_id', tenantId);

    if (error) {
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    return supabaseClientRepository.getById(tenantId, clientId);
  },

  async changeStatus(tenantId, clientId, newStatus) {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const { error } = await supabase.rpc('change_client_status' as never, {
      p_client_id: clientId,
      p_new_status: newStatus as WorkflowStatusDb,
    } as never);

    if (error) {
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    return supabaseClientRepository.getById(tenantId, clientId);
  },

  async archive(tenantId, clientId) {
    return supabaseClientRepository.changeStatus(tenantId, clientId, 'archiviert');
  },
};
