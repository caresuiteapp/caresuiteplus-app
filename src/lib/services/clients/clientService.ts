import type { ServiceResult } from '@/types';
import type { WorkflowStatus } from '@/types/core/base';
import type { ClientDetail } from '@/types/detail';
import type { ClientListItem } from '@/types/modules/office';
import type { ClientFormData } from '@/types/forms/clientForm';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { runService } from '../serviceRunner';
import { getServiceMode } from '../mode';
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
    return runService(() => getRepository(tenantId).changeStatus(tenantId, clientId, newStatus, context), {
      delayMs: DELAYS.mutate,
    });
  },

  async archive(
    tenantId: string,
    clientId: string,
    context?: ClientMutationContext,
  ): Promise<ServiceResult<ClientDetail>> {
    return runService(() => getRepository(tenantId).archive(tenantId, clientId, context), { delayMs: DELAYS.mutate });
  },

  async delete(
    tenantId: string,
    clientId: string,
    context?: ClientMutationContext,
  ): Promise<ServiceResult<void>> {
    return runService(() => getRepository(tenantId).delete(tenantId, clientId, context), { delayMs: DELAYS.mutate });
  },
};
