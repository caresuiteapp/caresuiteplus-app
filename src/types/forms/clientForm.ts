import type { WorkflowStatus } from '../core/base';
import type { SensitivityLevel } from '../portal/visibility';
import type { BillingType, ServiceType } from '../modules/client/clientBilling';
import type { TaskCategory } from '../modules/client/clientTasks';

export type ClientFormData = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  street: string;
  zip: string;
  city: string;
  phone: string;
  email: string;
  careLevel: string;
  status: WorkflowStatus;
  notes: string;
  sensitivity: SensitivityLevel;
  /** v1 Pflichtfelder */
  careFundName: string;
  billingType: BillingType | '';
  contractStart: string;
  serviceType: ServiceType | '';
  hourlyRate: string;
  taskCategories: TaskCategory[];
  emergencyContactName: string;
  emergencyContactPhone: string;
  consentDatenschutz: boolean;
  consentVertrag: boolean;
};

export const EMPTY_CLIENT_FORM: ClientFormData = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  street: '',
  zip: '',
  city: '',
  phone: '',
  email: '',
  careLevel: '',
  status: 'entwurf',
  notes: '',
  sensitivity: 'care',
  careFundName: '',
  billingType: '',
  contractStart: '',
  serviceType: '',
  hourlyRate: '',
  taskCategories: [],
  emergencyContactName: '',
  emergencyContactPhone: '',
  consentDatenschutz: false,
  consentVertrag: false,
};

export type ClientFormErrors = Partial<Record<keyof ClientFormData, string>>;
