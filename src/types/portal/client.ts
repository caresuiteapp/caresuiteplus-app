import type { WorkflowStatus } from '../core/base';

export type PortalClientProfile = {
  clientId: string;
  displayName: string;
  careLevel: string | null;
  city: string | null;
  zip: string | null;
  primaryContactPhone: string | null;
  emergencyContact: string | null;
  nextAppointmentTitle: string | null;
  nextAppointmentAt: string | null;
  openInvoices: number;
  sharedDocuments: number;
};

export type PortalClientCarePlanSummary = {
  id: string;
  title: string;
  validUntil: string | null;
  status: WorkflowStatus;
  summary: string;
  taskCount: number;
};

export type PortalClientAppointmentDetail = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: WorkflowStatus;
  location: string | null;
  caregiverName: string | null;
  caregiverPhone: string | null;
  serviceType: string;
  preparationNotes: string | null;
  canRequestChange: boolean;
};
