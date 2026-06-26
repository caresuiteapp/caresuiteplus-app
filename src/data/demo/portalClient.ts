import type { PortalClientCarePlanSummary, PortalClientProfile } from '@/types/portal/client';
import { demoAppointments } from './appointments';
import { demoCarePlans } from './carePlans';
import { demoClients } from './clients';
import { getDemoClientDetail } from './clientDetails';
import { demoPortalDocuments } from './documents';
import { demoInvoices } from './invoices';
import { buildClientPortalProfileProjection } from '@/lib/portal/clientPortalProfileProjection';
import type { ClientPortalSettingsResolved } from '@/types/clientCore';

const DEMO_PORTAL_SETTINGS: ClientPortalSettingsResolved = {
  portalEnabled: true,
  showAppointments: true,
  showMessages: true,
  showDocuments: true,
  showProofs: true,
  showBudget: false,
  showVisitTracking: false,
  inheritTenantDefaults: true,
  source: 'tenant',
};

export function getDemoClientPortalProfile(
  clientId: string,
  profileId?: string,
): PortalClientProfile | null {
  const client = demoClients.find((c) => c.id === clientId);
  const detail = getDemoClientDetail(clientId);
  if (!client) return null;

  const upcoming = demoAppointments
    .filter((a) => a.clientId === clientId && new Date(a.startsAt) > new Date())
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];

  const openInvoices = demoInvoices.filter(
    (inv) => inv.clientId === clientId && inv.status !== 'abgeschlossen',
  ).length;

  const sharedDocuments = profileId
    ? demoPortalDocuments.filter(
        (doc) => doc.audienceScope === 'portal' && doc.ownedByProfileId === profileId,
      ).length
    : 0;

  const emergency = detail?.contacts.find((c) => c.isEmergency);
  const fullDetail = detail;

  return buildClientPortalProfileProjection({
    tenantId: client.tenantId,
    clientId: client.id,
    settings: DEMO_PORTAL_SETTINGS,
    displayName: `${client.firstName} ${client.lastName}`,
    clientRow: {
      first_name: client.firstName,
      last_name: client.lastName,
      care_level: client.careLevel,
      city: client.city,
      postal_code: client.zip,
      country: 'Deutschland',
      street: fullDetail?.street?.replace(/\s+\d+.*$/, '') ?? 'Musterstraße',
      house_number: '12',
      floor: '2',
      apartment_number: 'links',
      doorbell_name: client.lastName,
      phone: fullDetail?.phone ?? null,
      mobile: '+49 170 5551234',
      email: fullDetail?.email ?? null,
      date_of_birth: fullDetail?.dateOfBirth ?? '1948-03-15',
      admission_date: fullDetail?.admissionDate ?? null,
      insurance_name: client.costCarrier,
      insurance_number: fullDetail?.insuranceNumber ?? 'A123456789',
      cost_bearer: client.costCarrier,
      access_notes: 'Bitte klingeln — Aufzug vorhanden.',
    },
    contacts: (fullDetail?.contacts ?? []).map((contact) => ({
      id: contact.id,
      name: contact.name,
      relationship: contact.relationship,
      phone: contact.phone,
      email: contact.email,
      is_emergency: contact.isEmergency,
      contact_type: contact.isEmergency ? 'emergency_contact' : 'relative',
      is_portal_user: contact.isEmergency,
    })),
    insuranceRow: {
      care_level: client.careLevel,
      care_level_valid_from: '2024-01-15',
      care_fund_name: 'AOK Nordwest Pflegekasse',
      health_insurance: client.costCarrier ?? 'Techniker Krankenkasse',
      insurance_number: fullDetail?.insuranceNumber ?? 'A123456789',
      is_primary: true,
    },
    careContexts: [{ context_key: 'daily_assistance', is_primary: true }],
    supportPreferences: { communication: 'telefon' },
    metrics: { documents: sharedDocuments },
    nextAssignment: upcoming
      ? { service_type: upcoming.title, planned_start_at: upcoming.startsAt }
      : null,
  });
}

export function getDemoClientCarePlanSummaries(clientId: string): PortalClientCarePlanSummary[] {
  return demoCarePlans
    .filter((plan) => plan.clientId === clientId && plan.status === 'aktiv')
    .map((plan) => ({
      id: plan.id,
      title: plan.title,
      validUntil: plan.validUntil,
      status: plan.status,
      summary: plan.summary,
      taskCount: plan.tasks.length,
    }));
}
