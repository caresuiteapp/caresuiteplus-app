import type { PortalClientCarePlanSummary, PortalClientProfile } from '@/types/portal/client';
import { demoAppointments } from './appointments';
import { demoCarePlans } from './carePlans';
import { demoClients } from './clients';
import { getDemoClientDetail } from './clientDetails';
import { demoPortalDocuments } from './documents';
import { demoInvoices } from './invoices';

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

  return {
    clientId: client.id,
    displayName: `${client.firstName} ${client.lastName}`,
    careLevel: client.careLevel,
    city: client.city ?? null,
    zip: client.zip ?? null,
    primaryContactPhone: detail?.primaryContactPhone ?? null,
    emergencyContact: emergency ? `${emergency.name} (${emergency.phone})` : null,
    nextAppointmentTitle: upcoming?.title ?? null,
    nextAppointmentAt: upcoming?.startsAt ?? null,
    openInvoices,
    sharedDocuments,
  };
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
