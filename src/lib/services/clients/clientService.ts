import type { ServiceResult } from '@/types';
import type { WorkflowStatus } from '@/types/core/base';
import type { ClientDetail } from '@/types/detail';
import type { ClientListItem } from '@/types/modules/office';
import type { ClientFormData } from '@/types/forms/clientForm';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { runService } from '../serviceRunner';
import { getServiceMode } from '../mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { demoClientRepository } from './clientRepository.demo';
import { supabaseClientRepository } from './clientRepository.supabase';
import type {
  ClientListOptions,
  ClientMutationContext,
  ClientRepository,
  ClientUpdateInput,
} from './types';

const DELAYS = {
  list: 350,
  detail: 300,
  mutate: 250,
  create: 500,
} as const;

function getRepository(tenantId: string): ClientRepository {
  return tenantId === DEMO_TENANT_ID || getServiceMode() !== 'supabase'
    ? demoClientRepository
    : supabaseClientRepository;
}

export const clientService = {
  async list(
    tenantId: string,
    options?: ClientListOptions,
  ): Promise<ServiceResult<ClientListItem[]>> {
    return runService(() => getRepository(tenantId).list(tenantId, options), { delayMs: DELAYS.list });
  },

  async getById(tenantId: string, clientId: string): Promise<ServiceResult<ClientDetail>> {
    return runService(() => getRepository(tenantId).getById(tenantId, clientId), { delayMs: DELAYS.detail });
  },

  async create(
    tenantId: string,
    form: ClientFormData,
    context?: ClientMutationContext,
  ): Promise<ServiceResult<{ id: string; detail: ClientDetail }>> {
    return runService(() => getRepository(tenantId).create(tenantId, form, context), { delayMs: DELAYS.create });
  },

  async update(
    tenantId: string,
    clientId: string,
    input: ClientUpdateInput,
    context?: ClientMutationContext,
  ): Promise<ServiceResult<ClientDetail>> {
    return runService(() => getRepository(tenantId).update(tenantId, clientId, input, context), {
      delayMs: DELAYS.mutate,
    });
  },

  async changeStatus(
    tenantId: string,
    clientId: string,
    newStatus: WorkflowStatus,
    context?: ClientMutationContext,
  ): Promise<ServiceResult<ClientDetail>> {
    if (getServiceMode() === 'supabase' && tenantId !== DEMO_TENANT_ID && newStatus === 'archiviert') {
      return {
        ok: false,
        error: 'Archivierung ist nur über „Kündigung & Offboarding“ nach vollständiger Endfreigabe möglich.',
      };
    }
    return runService(() => getRepository(tenantId).changeStatus(tenantId, clientId, newStatus, context), {
      delayMs: DELAYS.mutate,
    });
  },

  async archive(
    tenantId: string,
    clientId: string,
    context?: ClientMutationContext,
  ): Promise<ServiceResult<ClientDetail>> {
    if (getServiceMode() === 'supabase' && tenantId !== DEMO_TENANT_ID) {
      return {
        ok: false,
        error: 'Direkte Archivierung ist gesperrt. Bitte „Kündigung & Offboarding“ verwenden.',
      };
    }
    return runService(() => getRepository(tenantId).archive(tenantId, clientId, context), { delayMs: DELAYS.mutate });
  },

  async delete(
    tenantId: string,
    clientId: string,
    context?: ClientMutationContext,
  ): Promise<ServiceResult<void>> {
    if (getServiceMode() === 'supabase' && tenantId !== DEMO_TENANT_ID) {
      const supabase = getSupabaseClient();
      if (!supabase) return { ok: false, error: 'Die sichere Live-Datenbank ist nicht verfügbar.' };
      const [clientResult, offboardingResult] = await Promise.all([
        fromUnknownTable(supabase, 'clients').select('status').eq('tenant_id', tenantId).eq('id', clientId).maybeSingle(),
        fromUnknownTable(supabase, 'client_offboarding_cases').select('id,status').eq('tenant_id', tenantId).eq('client_id', clientId).limit(1).maybeSingle(),
      ]);
      if (clientResult.error || offboardingResult.error) {
        return { ok: false, error: clientResult.error?.message ?? offboardingResult.error?.message ?? 'Löschschutz konnte nicht geprüft werden.' };
      }
      const status = String((clientResult.data as Record<string, unknown> | null)?.status ?? '').toLowerCase();
      if (offboardingResult.data || ['inactive', 'archived', 'deceased'].includes(status)) {
        return {
          ok: false,
          error: 'Ehemalige oder im Offboarding befindliche Klient:innen werden nicht gelöscht. Die Klient:innenakte bleibt revisionssicher erhalten.',
        };
      }
    }
    return runService(() => getRepository(tenantId).delete(tenantId, clientId, context), { delayMs: DELAYS.mutate });
  },
};
