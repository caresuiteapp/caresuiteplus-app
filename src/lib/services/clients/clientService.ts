import type { ServiceResult } from '@/types';
import type { WorkflowStatus } from '@/types/core/base';
import type { ClientDetail } from '@/types/detail';
import type { ClientListItem } from '@/types/modules/office';
import type { ClientFormData } from '@/types/forms/clientForm';
import { getServiceMode } from '../mode';
import { runService } from '../serviceRunner';
import { demoClientRepository } from './clientRepository.demo';
import { supabaseClientRepository } from './clientRepository.supabase';
import type { ClientListOptions, ClientRepository, ClientUpdateInput } from './types';

const DELAYS = {
  list: 350,
  detail: 300,
  mutate: 250,
  create: 500,
} as const;

function getRepository(): ClientRepository {
  return getServiceMode() === 'demo' ? demoClientRepository : supabaseClientRepository;
}

export const clientService = {
  async list(
    tenantId: string,
    options?: ClientListOptions,
  ): Promise<ServiceResult<ClientListItem[]>> {
    return runService(() => getRepository().list(tenantId, options), { delayMs: DELAYS.list });
  },

  async getById(tenantId: string, clientId: string): Promise<ServiceResult<ClientDetail>> {
    return runService(() => getRepository().getById(tenantId, clientId), { delayMs: DELAYS.detail });
  },

  async create(
    tenantId: string,
    form: ClientFormData,
  ): Promise<ServiceResult<{ id: string; detail: ClientDetail }>> {
    return runService(() => getRepository().create(tenantId, form), { delayMs: DELAYS.create });
  },

  async update(
    tenantId: string,
    clientId: string,
    input: ClientUpdateInput,
  ): Promise<ServiceResult<ClientDetail>> {
    return runService(() => getRepository().update(tenantId, clientId, input), {
      delayMs: DELAYS.mutate,
    });
  },

  async changeStatus(
    tenantId: string,
    clientId: string,
    newStatus: WorkflowStatus,
  ): Promise<ServiceResult<ClientDetail>> {
    return runService(() => getRepository().changeStatus(tenantId, clientId, newStatus), {
      delayMs: DELAYS.mutate,
    });
  },

  async archive(tenantId: string, clientId: string): Promise<ServiceResult<ClientDetail>> {
    return runService(() => getRepository().archive(tenantId, clientId), { delayMs: DELAYS.mutate });
  },
};
