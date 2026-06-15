import type { TenantScopedEntity, WorkflowStatus } from '../core/base';
import type { PortalScopedEntity } from '../portal/visibility';

export type Client = TenantScopedEntity &
  PortalScopedEntity & {
    firstName: string;
    lastName: string;
    dateOfBirth: string | null;
    careLevel: string | null;
    status: WorkflowStatus;
    primaryContactPhone: string | null;
    city?: string | null;
    zip?: string | null;
    costCarrier?: string | null;
    insuranceNumber?: string | null;
    archivedAt?: string | null;
    createdBy?: string | null;
  };

/** Kompakte Darstellung für Listenansichten */
export type ClientListItem = Pick<
  Client,
  | 'id'
  | 'tenantId'
  | 'firstName'
  | 'lastName'
  | 'status'
  | 'careLevel'
  | 'city'
  | 'zip'
  | 'costCarrier'
  | 'insuranceNumber'
  | 'archivedAt'
  | 'createdBy'
  | 'sensitivity'
  | 'updatedAt'
>;

export type Employee = TenantScopedEntity & {
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  status: WorkflowStatus;
};

export type Appointment = TenantScopedEntity & {
  clientId: string;
  employeeId: string | null;
  title: string;
  startsAt: string;
  endsAt: string;
  status: WorkflowStatus;
  location: string | null;
};

export type Invoice = TenantScopedEntity & {
  clientId: string;
  invoiceNumber: string;
  amountCents: number;
  currency: string;
  dueDate: string;
  status: WorkflowStatus;
};

export type Document = TenantScopedEntity &
  PortalScopedEntity & {
    title: string;
    fileName: string;
    mimeType: string;
    storagePath: string | null;
    status: WorkflowStatus;
  };
