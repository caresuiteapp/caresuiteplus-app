import type { ClientDetail } from '@/types/detail';
import type { ClientFullDetail } from '@/types/modules/client';
import type { ClientCareContext } from '@/lib/clients/clientIntakeFieldRules';
import type { ClientEditFormData } from '@/types/forms/clientEditForm';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { EMPTY_CLIENT_INTAKE_FORM } from '@/types/forms/clientIntakeForm';
import { createEmptyIntakeForm } from '@/lib/clients/clientIntakeService';
import { parseHomeAccessStoredValue } from '@/lib/clients/clientIntakeHomeAccess';
import { splitStreetLine } from '@/lib/clients/clientEditAddressUtils';

function resolvePrimaryAddress(fullClient: ClientFullDetail) {
  return fullClient.addresses.find((a) => a.isPrimary) ?? fullClient.addresses[0] ?? null;
}

function resolveEmergencyContact(fullClient: ClientFullDetail) {
  return fullClient.contacts.find((c) => c.isEmergency) ?? null;
}

function resolveDoctorContact(fullClient: ClientFullDetail) {
  return fullClient.contacts.find((c) => c.relationship === 'arzt') ?? null;
}

function inferCostBearerTypes(edit: ClientEditFormData): string[] {
  const types: string[] = [];
  if (edit.costCarrier.trim()) types.push('pflegekasse');
  if (edit.insuranceNumber.trim() && !types.includes('krankenkasse')) {
    // Keep pflegekasse as primary when care fund name is set.
  }
  return types;
}

function inferBillingTypes(edit: ClientEditFormData, billingNotes?: string | null): string[] {
  if (billingNotes?.trim()) {
    const parsed = billingNotes
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (parsed.length > 0) return parsed;
  }
  if (!edit.billingType) return [];
  return [edit.billingType];
}

/** Maps loaded client edit data into the shared intake wizard form shape. */
export function mapClientEditLoadToIntakeForm(input: {
  detail: ClientDetail;
  fullClient: ClientFullDetail;
  careContexts: ClientCareContext[];
  form: ClientEditFormData;
  ambulatoryHomeAccess?: string | null;
}): ClientIntakeFormData {
  const { detail, fullClient, careContexts, form: edit, ambulatoryHomeAccess } = input;
  const primaryAddress = resolvePrimaryAddress(fullClient);
  const careLevel = fullClient.careLevels[0] ?? null;
  const billing = fullClient.billingProfile;
  const emergency = resolveEmergencyContact(fullClient);
  const doctor = resolveDoctorContact(fullClient);

  const streetSource = primaryAddress?.street ?? detail.street ?? '';
  const parsedStreet = splitStreetLine(streetSource);
  if (edit.houseNumber.trim()) {
    parsedStreet.houseNumber = edit.houseNumber;
  }
  if (edit.street.trim()) {
    parsedStreet.street = edit.street;
  }

  const costBearerTypes = inferCostBearerTypes(edit);

  return {
    ...createEmptyIntakeForm(),
    careContexts: careContexts.length > 0 ? [...careContexts] : [...edit.careContexts],
    firstName: edit.firstName,
    lastName: edit.lastName,
    salutation: edit.salutation,
    gender: edit.gender,
    dateOfBirth: edit.dateOfBirth,
    status: edit.status,
    specialNotes: edit.notes,
    admissionDate: EMPTY_CLIENT_INTAKE_FORM.admissionDate,
    serviceStart: careLevel?.validFrom ?? '',
    street: parsedStreet.street,
    houseNumber: parsedStreet.houseNumber,
    zip: primaryAddress?.zip ?? edit.zip,
    city: primaryAddress?.city ?? edit.city,
    floor: primaryAddress?.floor ?? edit.floor,
    accessNotes: primaryAddress?.accessNotes ?? edit.accessNotes,
    doorCode: primaryAddress?.doorCode ?? edit.accessCode,
    bellName: edit.bellName,
    phone: edit.phone,
    mobile: edit.mobile,
    email: edit.email,
    careLevel: edit.careLevel,
    careLevelValidFrom: careLevel?.validFrom ?? '',
    careFundName: edit.costCarrier || careLevel?.careFundName || '',
    insuranceNumber: edit.insuranceNumber,
    billingTypes: inferBillingTypes(edit, billing?.notes),
    billingType: edit.billingType,
    costBearerTypes,
    costBearerType: costBearerTypes[0] ?? '',
    familyDoctor: doctor ? `${doctor.firstName} ${doctor.lastName}`.trim() : edit.familyDoctorName,
    emergencyContactName: emergency
      ? `${emergency.firstName} ${emergency.lastName}`.trim()
      : edit.emergencyContactName,
    emergencyContactPhone: emergency?.phone ?? edit.emergencyContactPhone,
    assignedModules:
      edit.portalModules.length > 0 ? [...edit.portalModules] : [...EMPTY_CLIENT_INTAKE_FORM.assignedModules],
    hourlyRate: billing?.hourlyRateCents ? String(billing.hourlyRateCents / 100) : '',
    mobility: fullClient.preferences?.mobilityNotes ?? edit.mobilityNotes,
    communication: edit.communicationNotes,
    consentDatenschutz: fullClient.consents.some((c) => c.consentType === 'datenschutz' && c.granted),
    consentVertrag: fullClient.consents.some((c) => c.consentType === 'vertrag' && c.granted),
    homeAccess: parseHomeAccessStoredValue(ambulatoryHomeAccess),
  };
}
