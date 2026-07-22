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
    street?: string | null;
    city?: string | null;
    zip?: string | null;
    /** Domain-Feld → DB `clients.cost_bearer` */
    costCarrier?: string | null;
    /** Domain-Feld → DB `clients.insurance_number` */
    insuranceNumber?: string | null;
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
  | 'dateOfBirth'
  | 'primaryContactPhone'
  | 'street'
  | 'city'
  | 'zip'
  | 'costCarrier'
  | 'insuranceNumber'
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
