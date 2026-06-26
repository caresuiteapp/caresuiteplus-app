import type { WorkflowStatus } from '../core/base';

export type PortalClientContactSummary = {
  id: string;
  name: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  role: 'emergency' | 'representative' | 'relative' | 'doctor' | 'other';
};

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
  email: string | null;
  mobile: string | null;
  phone: string | null;
  preferredContactLabel: string | null;
  dateOfBirth: string | null;
  street: string | null;
  floor: string | null;
  apartmentNumber: string | null;
  doorbellName: string | null;
  country: string | null;
  healthInsurance: string | null;
  careFundName: string | null;
  costBearer: string | null;
  insuranceNumberMasked: string | null;
  careLevelSince: string | null;
  careStartDate: string | null;
  careModels: string[];
  representativeContacts: PortalClientContactSummary[];
  portalHints: string | null;
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
  liveVisit?: {
    mapVisible: boolean;
    statusLabel: string | null;
    lastPosition: {
      latitude: number;
      longitude: number;
      accuracyMeters: number | null;
      capturedAt: string | null;
    } | null;
    fallbackMessage: string | null;
  } | null;
};
