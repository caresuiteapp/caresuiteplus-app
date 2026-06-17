import type { WorkflowStatus } from '@/types/core/base';
import type { ClientDetail } from '@/types/detail';
import type { ClientListItem } from '@/types/modules/office';
import type { ClientFormData } from '@/types/forms/clientForm';
import type { ServiceResult } from '@/types';

export type ClientMutationContext = {
  actorProfileId?: string | null;
  actorDisplayName?: string | null;
};

export type ClientListOptions = {
  simulateError?: boolean;
  simulateEmpty?: boolean;
  search?: string;
  statusFilter?: WorkflowStatus | 'all';
  careLevelFilter?: string;
  costBearerFilter?: string;
  lifecycleFilter?: 'active' | 'archived' | 'all';
};

export type ClientUpdateInput = Partial<
  Pick<
    ClientDetail,
    | 'firstName'
    | 'lastName'
    | 'dateOfBirth'
    | 'street'
    | 'zip'
    | 'city'
    | 'phone'
    | 'email'
    | 'careLevel'
    | 'notes'
    | 'primaryContactPhone'
    | 'costCarrier'
    | 'insuranceNumber'
  >
>;

export type ClientRepository = {
  list(tenantId: string, options?: ClientListOptions): Promise<ServiceResult<ClientListItem[]>>;
  getById(tenantId: string, clientId: string): Promise<ServiceResult<ClientDetail>>;
  create(
    tenantId: string,
    form: ClientFormData,
    context?: ClientMutationContext,
  ): Promise<ServiceResult<{ id: string; detail: ClientDetail }>>;
  update(
    tenantId: string,
    clientId: string,
    input: ClientUpdateInput,
    context?: ClientMutationContext,
  ): Promise<ServiceResult<ClientDetail>>;
  changeStatus(
    tenantId: string,
    clientId: string,
    newStatus: WorkflowStatus,
    context?: ClientMutationContext,
  ): Promise<ServiceResult<ClientDetail>>;
  archive(
    tenantId: string,
    clientId: string,
    context?: ClientMutationContext,
  ): Promise<ServiceResult<ClientDetail>>;
  delete(
    tenantId: string,
    clientId: string,
    context?: ClientMutationContext,
  ): Promise<ServiceResult<void>>;
};
