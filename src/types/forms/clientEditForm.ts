import type { WorkflowStatus } from '../core/base';
import type { ClientCareContext } from '@/lib/clients/clientIntakeFieldRules';
import type { BillingType, ServiceType } from '../modules/client/clientBilling';

/** Fokussierter Formularzustand für Stammdaten-Bearbeitung (kein voller Intake). */
export type ClientEditFormData = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  salutation: string;
  gender: string;
  status: WorkflowStatus;
  careLevel: string;
  careContexts: ClientCareContext[];
  notes: string;
  insuranceNumber: string;
  costCarrier: string;
  billingType: BillingType | '';
  serviceType: ServiceType | '';
  street: string;
  houseNumber: string;
  zip: string;
  city: string;
  accessNotes: string;
  floor: string;
  apartmentNumber: string;
  accessCode: string;
  bellName: string;
  phone: string;
  mobile: string;
  email: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactId: string | null;
  relativeContactName: string;
  relativeContactPhone: string;
  relativeContactId: string | null;
  diagnosesNotes: string;
  mobilityNotes: string;
  communicationNotes: string;
  riskNotes: string;
  careAgreementNotes: string;
  primaryAddressId: string | null;
  billingProfileId: string | null;
};

export const EMPTY_CLIENT_EDIT_FORM: ClientEditFormData = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  salutation: '',
  gender: '',
  status: 'entwurf',
  careLevel: '',
  careContexts: [],
  notes: '',
  insuranceNumber: '',
  costCarrier: '',
  billingType: '',
  serviceType: '',
  street: '',
  houseNumber: '',
  zip: '',
  city: '',
  accessNotes: '',
  floor: '',
  apartmentNumber: '',
  accessCode: '',
  bellName: '',
  phone: '',
  mobile: '',
  email: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactId: null,
  relativeContactName: '',
  relativeContactPhone: '',
  relativeContactId: null,
  diagnosesNotes: '',
  mobilityNotes: '',
  communicationNotes: '',
  riskNotes: '',
  careAgreementNotes: '',
  primaryAddressId: null,
  billingProfileId: null,
};

export type ClientEditFormErrors = Partial<Record<keyof ClientEditFormData, string>>;
