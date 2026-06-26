/**
 * Client portal profile projection — sanitized self-view fields only.
 * Module visibility (Einsätze, Dokumente, …) comes from client_portal_settings;
 * profile field groups are shown when portal is enabled for the client.
 */
import type { ClientPortalSettingsResolved } from '@/types/clientCore';
import type {
  PortalClientContactSummary,
  PortalClientProfile,
} from '@/types/portal/client';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { resolveClientContactDisplayName, resolveClientContactIsEmergency } from '@/lib/clients/clientContactPayload';
import { resolveCatalogLabel } from '@/lib/catalogs/systemCatalogService';

export type ClientPortalProfileFieldKey =
  | 'contact'
  | 'address'
  | 'insurance'
  | 'care'
  | 'representatives'
  | 'portalHints';

const CARE_CONTEXT_LABELS: Record<string, string> = {
  daily_assistance: 'Alltagsbegleitung',
  support_care: 'Betreuung',
  companionship: 'Begleitung',
  ambulatory_care: 'Ambulante Pflege',
  stationary_care: 'Stationäre Pflege',
  consulting: 'Beratung',
  academy_prepared: 'Akademie',
};

const REPRESENTATIVE_RELATIONSHIPS = new Set([
  'betreuung',
  'bevollmaechtigt',
  'bevollmächtigt',
  'gesetzliche betreuung',
]);

const CLIENTS_BLOCKED_KEYS = new Set([
  'internal_notes',
  'diagnoses_notes',
  'key_management_notes',
  'emergency_notes',
  'visible_notes_for_employee',
  'billing_party',
]);

export function canClientPortalSeeProfileField(
  settings: ClientPortalSettingsResolved,
  field: ClientPortalProfileFieldKey,
): boolean {
  if (!settings.portalEnabled) return false;
  return field !== 'portalHints' || settings.portalEnabled;
}

export function maskPortalInsuranceNumber(value: string | null | undefined): string | null {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;
  if (trimmed.length <= 4) return '••••';
  return `•••• •••• ${trimmed.slice(-4)}`;
}

export function formatPortalDate(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function pickString(row: Record<string, unknown> | null | undefined, key: string): string | null {
  if (!row) return null;
  const value = row[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function buildStreetLine(row: Record<string, unknown>): string | null {
  const street = pickString(row, 'street');
  const houseNumber = pickString(row, 'house_number');
  if (street && houseNumber) return `${street} ${houseNumber}`;
  return street ?? houseNumber;
}

function mapCareContextLabel(key: string): string {
  return CARE_CONTEXT_LABELS[key] ?? key.replace(/_/g, ' ');
}

function isRepresentativeContact(row: Record<string, unknown>): boolean {
  if (row.is_portal_user === true) return true;
  const relationship = String(row.relationship ?? '').trim().toLowerCase();
  if (REPRESENTATIVE_RELATIONSHIPS.has(relationship)) return true;
  const contactType = String(row.contact_type ?? '').trim();
  return contactType === 'relative' && REPRESENTATIVE_RELATIONSHIPS.has(relationship);
}

function mapContactSummary(row: Record<string, unknown>): PortalClientContactSummary {
  const isEmergency = resolveClientContactIsEmergency({
    is_emergency_contact: row.is_emergency_contact as boolean | null,
    is_emergency: row.is_emergency as boolean | null,
    contact_type: row.contact_type as string | null,
  });
  const relationship = pickString(row, 'relationship');
  const contactType = String(row.contact_type ?? '').trim();
  let role: PortalClientContactSummary['role'] = 'other';
  if (isEmergency) role = 'emergency';
  else if (isRepresentativeContact(row)) role = 'representative';
  else if (contactType === 'relative' || relationship === 'angehoerige') role = 'relative';
  else if (contactType === 'doctor' || relationship === 'arzt') role = 'doctor';

  return {
    id: String(row.id ?? ''),
    name: resolveClientContactDisplayName({
      full_name: row.full_name as string | null,
      name: row.name as string | null,
      first_name: row.first_name as string | null,
      last_name: row.last_name as string | null,
    }),
    relationship: relationship ?? pickString(row, 'relationship_label'),
    phone: pickString(row, 'phone'),
    email: pickString(row, 'email'),
    role,
  };
}

export type BuildClientPortalProfileInput = {
  tenantId: string;
  clientId: string;
  settings: ClientPortalSettingsResolved;
  clientRow: Record<string, unknown>;
  contacts?: Record<string, unknown>[] | null;
  insuranceRow?: Record<string, unknown> | null;
  careContexts?: Record<string, unknown>[] | null;
  supportPreferences?: Record<string, unknown> | null;
  metrics?: { documents: number };
  nextAssignment?: Record<string, unknown> | null;
  displayName: string;
};

export function buildClientPortalProfileProjection(
  input: BuildClientPortalProfileInput,
): PortalClientProfile {
  const { clientRow, settings } = input;
  const phone = pickString(clientRow, 'phone');
  const mobile = pickString(clientRow, 'mobile');
  const primaryPhone = mobile ?? phone;

  const insuranceRow = input.insuranceRow ?? null;
  const insuranceNumberRaw =
    pickString(insuranceRow, 'insurance_number') ?? pickString(clientRow, 'insurance_number');
  const careLevelRaw =
    pickString(insuranceRow, 'care_level') ?? pickString(clientRow, 'care_level');
  const careLevelSince =
    formatPortalDate(pickString(insuranceRow, 'care_level_valid_from')) ??
    formatPortalDate(pickString(clientRow, 'admission_date'));

  const careModels = (input.careContexts ?? [])
    .map((row) => mapCareContextLabel(String(row.context_key ?? '')))
    .filter(Boolean);

  const preferredContactRaw = pickString(input.supportPreferences, 'communication');
  const preferredContactLabel = preferredContactRaw
    ? resolveCatalogLabel('contact_method', preferredContactRaw)
    : null;

  const allContacts = (input.contacts ?? []).map(mapContactSummary).filter((c) => c.name);
  const emergencySummary = allContacts.find((c) => c.role === 'emergency');
  const emergencyContactLabel = emergencySummary
    ? [emergencySummary.name, emergencySummary.phone].filter(Boolean).join(' · ') ||
      emergencySummary.name
    : null;

  const releasedContactRows = (input.contacts ?? []).filter((row) => {
    if (
      resolveClientContactIsEmergency({
        is_emergency_contact: row.is_emergency_contact as boolean | null,
        is_emergency: row.is_emergency as boolean | null,
        contact_type: row.contact_type as string | null,
      })
    ) {
      return false;
    }
    return row.is_portal_user === true || isRepresentativeContact(row);
  });

  const representativeContacts = canClientPortalSeeProfileField(settings, 'representatives')
    ? releasedContactRows.map(mapContactSummary).filter((c) => c.name)
    : [];

  const portalHints = canClientPortalSeeProfileField(settings, 'portalHints')
    ? pickString(clientRow, 'access_notes')
    : null;

  const assignment = input.nextAssignment;
  const nextAppointmentTitle = assignment
    ? String(assignment.service_type ?? 'Einsatz').trim() || 'Einsatz'
    : null;
  const nextAppointmentAt = assignment?.planned_start_at
    ? String(assignment.planned_start_at)
    : null;

  const profile: PortalClientProfile = {
    clientId: input.clientId,
    displayName: input.displayName,
    careLevel: careLevelRaw ? formatCareLevel(careLevelRaw) || null : null,
    city: pickString(clientRow, 'city'),
    zip: pickString(clientRow, 'postal_code'),
    primaryContactPhone: canClientPortalSeeProfileField(settings, 'contact') ? primaryPhone : null,
    emergencyContact: canClientPortalSeeProfileField(settings, 'representatives')
      ? emergencyContactLabel
      : null,
    nextAppointmentTitle,
    nextAppointmentAt,
    openInvoices: 0,
    sharedDocuments: input.metrics?.documents ?? 0,
    email: canClientPortalSeeProfileField(settings, 'contact')
      ? pickString(clientRow, 'email')
      : null,
    mobile: canClientPortalSeeProfileField(settings, 'contact') ? mobile : null,
    phone: canClientPortalSeeProfileField(settings, 'contact') ? phone : null,
    preferredContactLabel: canClientPortalSeeProfileField(settings, 'contact')
      ? preferredContactLabel
      : null,
    dateOfBirth: canClientPortalSeeProfileField(settings, 'contact')
      ? formatPortalDate(pickString(clientRow, 'date_of_birth'))
      : null,
    street: canClientPortalSeeProfileField(settings, 'address') ? buildStreetLine(clientRow) : null,
    floor: canClientPortalSeeProfileField(settings, 'address') ? pickString(clientRow, 'floor') : null,
    apartmentNumber: canClientPortalSeeProfileField(settings, 'address')
      ? pickString(clientRow, 'apartment_number')
      : null,
    doorbellName: canClientPortalSeeProfileField(settings, 'address')
      ? pickString(clientRow, 'doorbell_name')
      : null,
    country: canClientPortalSeeProfileField(settings, 'address')
      ? pickString(clientRow, 'country') ?? 'Deutschland'
      : null,
    healthInsurance: canClientPortalSeeProfileField(settings, 'insurance')
      ? pickString(insuranceRow, 'health_insurance') ?? pickString(clientRow, 'insurance_name')
      : null,
    careFundName: canClientPortalSeeProfileField(settings, 'insurance')
      ? pickString(insuranceRow, 'care_fund_name')
      : null,
    costBearer: canClientPortalSeeProfileField(settings, 'insurance')
      ? pickString(clientRow, 'cost_bearer') ?? pickString(clientRow, 'insurance_name')
      : null,
    insuranceNumberMasked: canClientPortalSeeProfileField(settings, 'insurance')
      ? maskPortalInsuranceNumber(insuranceNumberRaw)
      : null,
    careLevelSince: canClientPortalSeeProfileField(settings, 'care') ? careLevelSince : null,
    careStartDate: canClientPortalSeeProfileField(settings, 'care')
      ? formatPortalDate(pickString(clientRow, 'admission_date'))
      : null,
    careModels: canClientPortalSeeProfileField(settings, 'care') ? careModels : [],
    representativeContacts,
    portalHints,
  };

  for (const blocked of CLIENTS_BLOCKED_KEYS) {
    if (blocked in clientRow) {
      delete (clientRow as Record<string, unknown>)[blocked];
    }
  }

  return profile;
}

export function profileSectionHasContent(
  profile: PortalClientProfile,
  section: ClientPortalProfileFieldKey,
): boolean {
  switch (section) {
    case 'contact':
      return Boolean(
        profile.email ||
          profile.mobile ||
          profile.phone ||
          profile.primaryContactPhone ||
          profile.preferredContactLabel ||
          profile.dateOfBirth,
      );
    case 'address':
      return Boolean(
        profile.street || profile.zip || profile.city || profile.floor || profile.apartmentNumber,
      );
    case 'insurance':
      return Boolean(
        profile.healthInsurance ||
          profile.careFundName ||
          profile.costBearer ||
          profile.insuranceNumberMasked,
      );
    case 'care':
      return Boolean(
        profile.careLevel ||
          profile.careLevelSince ||
          profile.careStartDate ||
          profile.careModels.length > 0,
      );
    case 'representatives':
      return profile.representativeContacts.length > 0 || Boolean(profile.emergencyContact);
    case 'portalHints':
      return Boolean(profile.portalHints?.trim());
    default:
      return false;
  }
}
