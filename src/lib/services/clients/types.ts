import type { WorkflowStatus } from '@/types/core/base';
import type { ClientDetail } from '@/types/detail';
import type { ClientListItem } from '@/types/modules/office';
import type { ClientFormData } from '@/types/forms/clientForm';
import type { ServiceResult } from '@/types';

export type ClientListOptions = {
  simulateError?: boolean;
  simulateEmpty?: boolean;
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
  >
>;

export type ClientRepository = {
  list(tenantId: string, options?: ClientListOptions): Promise<ServiceResult<ClientListItem[]>>;
  getById(tenantId: string, clientId: string): Promise<ServiceResult<ClientDetail>>;
  create(tenantId: string, form: ClientFormData): Promise<ServiceResult<{ id: string; detail: ClientDetail }>>;
  update(
    tenantId: string,
    clientId: string,
    input: ClientUpdateInput,
  ): Promise<ServiceResult<ClientDetail>>;
  changeStatus(
    tenantId: string,
    clientId: string,
    newStatus: WorkflowStatus,
  ): Promise<ServiceResult<ClientDetail>>;
  archive(tenantId: string, clientId: string): Promise<ServiceResult<ClientDetail>>;
};
