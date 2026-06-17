import type { ClientDetail } from '@/types/detail';
import type { ClientFullDetail } from '@/types/modules/client';
import type { ClientCareContext } from '@/lib/clients/clientIntakeFieldRules';
import type { ClientEditFormData } from '@/types/forms/clientEditForm';
import { EMPTY_CLIENT_EDIT_FORM } from '@/types/forms/clientEditForm';
import { splitStreetLine } from '@/lib/clients/clientEditAddressUtils';

export type ClientEditRawFields = {
  mobile: string;
  houseNumber: string;
  accessNotes: string;
  floor: string;
  doorbellName: string;
  diagnosesNotes: string;
  mobilityNotes: string;
  visibleNotesForEmployee: string;
  emergencyNotes: string;
  keyManagementNotes: string;
};

export const EMPTY_CLIENT_EDIT_RAW: ClientEditRawFields = {
  mobile: '',
  houseNumber: '',
  accessNotes: '',
  floor: '',
  doorbellName: '',
  diagnosesNotes: '',
  mobilityNotes: '',
  visibleNotesForEmployee: '',
  emergencyNotes: '',
  keyManagementNotes: '',
};

function resolveEmergencyContact(fullClient: ClientFullDetail) {
  return fullClient.contacts.find((c) => c.isEmergency) ?? null;
}

function resolveRelativeContact(fullClient: ClientFullDetail) {
  return (
    fullClient.contacts.find(
      (c) => !c.isEmergency && (c.relationship === 'angehoerige' || c.relationship === 'ehepartner' || c.relationship === 'kind'),
    ) ?? fullClient.contacts.find((c) => !c.isEmergency) ?? null
  );
}

function resolvePrimaryAddress(fullClient: ClientFullDetail) {
  return fullClient.addresses.find((a) => a.isPrimary) ?? fullClient.addresses[0] ?? null;
}

export function mapClientEditRawFields(raw: Record<string, unknown> | null | undefined): ClientEditRawFields {
  if (!raw) return { ...EMPTY_CLIENT_EDIT_RAW };
  return {
    mobile: typeof raw.mobile === 'string' ? raw.mobile : '',
    houseNumber: typeof raw.house_number === 'string' ? raw.house_number : '',
    accessNotes: typeof raw.access_notes === 'string' ? raw.access_notes : '',
    floor: typeof raw.floor === 'string' ? raw.floor : '',
    doorbellName: typeof raw.doorbell_name === 'string' ? raw.doorbell_name : '',
    diagnosesNotes: typeof raw.diagnoses_notes === 'string' ? raw.diagnoses_notes : '',
    mobilityNotes: typeof raw.mobility_notes === 'string' ? raw.mobility_notes : '',
    visibleNotesForEmployee:
      typeof raw.visible_notes_for_employee === 'string' ? raw.visible_notes_for_employee : '',
    emergencyNotes: typeof raw.emergency_notes === 'string' ? raw.emergency_notes : '',
    keyManagementNotes:
      typeof raw.key_management_notes === 'string' ? raw.key_management_notes : '',
  };
}

export function mapClientToEditForm(
  detail: ClientDetail,
  fullClient: ClientFullDetail,
  careContexts: ClientCareContext[],
  rawFields: ClientEditRawFields = EMPTY_CLIENT_EDIT_RAW,
): ClientEditFormData {
  const primaryAddress = resolvePrimaryAddress(fullClient);
  const emergency = resolveEmergencyContact(fullClient);
  const relative = resolveRelativeContact(fullClient);

  const streetSource = primaryAddress?.street ?? detail.street ?? '';
  const parsedStreet = splitStreetLine(streetSource);
  if (rawFields.houseNumber) {
    parsedStreet.houseNumber = rawFields.houseNumber;
  }

  const riskSummary =
    fullClient.risks.length > 0
      ? fullClient.risks.map((r) => r.description).filter(Boolean).join('; ')
      : rawFields.emergencyNotes;

  return {
    ...EMPTY_CLIENT_EDIT_FORM,
    firstName: detail.firstName,
    lastName: detail.lastName,
    dateOfBirth: detail.dateOfBirth ?? fullClient.core.dateOfBirth ?? '',
    salutation: fullClient.core.salutation ?? '',
    gender: fullClient.core.gender ?? '',
    status: detail.status,
    careLevel: detail.careLevel ?? fullClient.careLevels[0]?.grade ?? '',
    careContexts: careContexts.length > 0 ? careContexts : ['daily_assistance'],
    notes: detail.notes ?? '',
    insuranceNumber: fullClient.core.insuranceNumber ?? detail.insuranceNumber ?? '',
    costCarrier: detail.costCarrier ?? fullClient.billingProfile?.costBearerName ?? '',
    billingType: fullClient.billingProfile?.billingType ?? '',
    serviceType: fullClient.billingProfile?.serviceType ?? '',
    street: parsedStreet.street,
    houseNumber: parsedStreet.houseNumber,
    zip: primaryAddress?.zip ?? detail.zip ?? fullClient.core.zip ?? '',
    city: primaryAddress?.city ?? detail.city ?? fullClient.core.city ?? '',
    accessNotes: primaryAddress?.accessNotes ?? rawFields.accessNotes,
    floor: primaryAddress?.floor ?? rawFields.floor,
    bellName: primaryAddress?.doorCode ?? rawFields.doorbellName,
    phone: detail.phone ?? detail.primaryContactPhone ?? '',
    mobile: rawFields.mobile,
    email: detail.email ?? '',
    emergencyContactName: emergency ? `${emergency.firstName} ${emergency.lastName}`.trim() : '',
    emergencyContactPhone: emergency?.phone ?? '',
    emergencyContactId: emergency?.id ?? null,
    relativeContactName: relative ? `${relative.firstName} ${relative.lastName}`.trim() : '',
    relativeContactPhone: relative?.phone ?? '',
    relativeContactId: relative?.id ?? null,
    diagnosesNotes:
      rawFields.diagnosesNotes
      || (fullClient.core.diagnoses.length > 0 ? fullClient.core.diagnoses.join(', ') : ''),
    mobilityNotes: rawFields.mobilityNotes || fullClient.preferences?.mobilityNotes || '',
    communicationNotes: rawFields.keyManagementNotes,
    riskNotes: riskSummary,
    careAgreementNotes: rawFields.visibleNotesForEmployee,
    primaryAddressId: primaryAddress?.id.startsWith('addr-fallback-') ? null : primaryAddress?.id ?? null,
    billingProfileId: fullClient.billingProfile?.id ?? null,
  };
}

export function buildStreetLine(street: string, houseNumber: string): string {
  return [street.trim(), houseNumber.trim()].filter(Boolean).join(' ');
}
