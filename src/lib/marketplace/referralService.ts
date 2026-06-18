import type { RoleKey, ServiceResult } from '@/types';
import type {
  MarketplaceAuditEvent,
  MarketplaceCommissionEvent,
  MarketplaceDataCategory,
  MarketplacePartner,
  MarketplacePartnerStatus,
  MarketplaceReferralConsent,
  MarketplaceReferralRequest,
} from '@/types/marketplace';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import {
  assertCommissionBookingAllowed,
  assertNoCustomerDataTransfer,
  assertReferralSendAllowed,
  buildDefaultDataSharingScope,
  canAdministerPartners,
  DEMO_MARKETPLACE_PARTNERS,
  getPartnerById,
  isConsentValid,
  isPartnerSelectable,
  resolveReferralStatusAfterConsent,
  stripSensitivePrefill,
} from './marketplaceGuard';

export type ReferralDraftInput = {
  partnerId: string;
  requestSubject: string;
  requestMessage: string;
  dataSharingScope?: MarketplaceDataCategory[];
};

const referralStore = new Map<string, MarketplaceReferralRequest>();
const consentStore = new Map<string, MarketplaceReferralConsent>();
const commissionStore = new Map<string, MarketplaceCommissionEvent>();
const auditStore: MarketplaceAuditEvent[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

function audit(input: Omit<MarketplaceAuditEvent, 'id' | 'createdAt'>): void {
  auditStore.push({
    ...input,
    id: `mkt-audit-${auditStore.length + 1}`,
    createdAt: nowIso(),
  });
}

async function demoDelay(ms = 120): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

export async function createReferralDraft(
  tenantId: string,
  input: ReferralDraftInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ referral: MarketplaceReferralRequest; consent: MarketplaceReferralConsent }>> {
  const denied = enforcePermission<{ referral: MarketplaceReferralRequest; consent: MarketplaceReferralConsent }>(
    actorRoleKey,
    'connect.view',
  );
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (tenantId !== DEMO_TENANT_ID) {
    return { ok: false, error: 'Marktplatz-Anfragen: Repository erweitern.' };
  }

  const partner = getPartnerById(input.partnerId);
  if (!partner) {
    return { ok: false, error: 'Partner nicht gefunden.' };
  }
  if (!isPartnerSelectable(partner)) {
    return { ok: false, error: 'Partner ist nicht aktiv — Anfrage nicht möglich.' };
  }

  await demoDelay();

  const referralId = `ref-${Date.now()}`;
  const consentId = `consent-${Date.now()}`;
  const scope = input.dataSharingScope ?? buildDefaultDataSharingScope();
  const cleanMessage = stripSensitivePrefill({ message: input.requestMessage }).message as string;

  const referral: MarketplaceReferralRequest = {
    id: referralId,
    tenantId,
    partnerId: partner.id,
    referralStatus: 'consent_required',
    requestSubject: input.requestSubject,
    requestMessage: cleanMessage,
    dataSharingScope: scope,
    clientReference: null,
    requestedAt: null,
    sentAt: null,
    completedAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  const consent: MarketplaceReferralConsent = {
    id: consentId,
    tenantId,
    referralRequestId: referralId,
    dataCategories: scope,
    scopeDescription: 'Freigabe gemäß ausgewählter Kategorien — keine sensiblen Vorbefüllungen.',
    consentTextVersion: 'v1',
    consentGiven: false,
    consentGivenAt: null,
    revokedAt: null,
  };

  referralStore.set(referralId, referral);
  consentStore.set(referralId, consent);

  audit({
    tenantId,
    eventType: 'referral_draft_created',
    entityType: 'marketplace_referral_requests',
    entityId: referralId,
    summary: `Anfrage-Entwurf für Partner ${partner.name} erstellt`,
  });

  return { ok: true, data: { referral, consent } };
}

export async function recordReferralConsent(
  tenantId: string,
  referralRequestId: string,
  consentGiven: boolean,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<MarketplaceReferralConsent>> {
  const denied = enforcePermission<MarketplaceReferralConsent>(actorRoleKey, 'connect.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const referral = referralStore.get(referralRequestId);
  const consent = consentStore.get(referralRequestId);
  if (!referral || !consent || referral.tenantId !== tenantId) {
    return { ok: false, error: 'Anfrage nicht gefunden.' };
  }

  await demoDelay();

  const updatedConsent: MarketplaceReferralConsent = {
    ...consent,
    consentGiven,
    consentGivenAt: consentGiven ? nowIso() : null,
  };
  consentStore.set(referralRequestId, updatedConsent);

  const nextStatus = resolveReferralStatusAfterConsent(isConsentValid(updatedConsent));
  referralStore.set(referralRequestId, {
    ...referral,
    referralStatus: nextStatus,
    updatedAt: nowIso(),
  });

  audit({
    tenantId,
    eventType: consentGiven ? 'consent_granted' : 'consent_withdrawn',
    entityType: 'marketplace_referral_consents',
    entityId: consent.id,
    summary: consentGiven ? 'Einwilligung erteilt' : 'Einwilligung zurückgezogen',
  });

  return { ok: true, data: updatedConsent };
}

export async function sendReferralRequest(
  tenantId: string,
  referralRequestId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<MarketplaceReferralRequest>> {
  const denied = enforcePermission<MarketplaceReferralRequest>(actorRoleKey, 'connect.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const referral = referralStore.get(referralRequestId);
  const consent = consentStore.get(referralRequestId) ?? null;
  const partner = referral ? getPartnerById(referral.partnerId) : undefined;

  if (!referral || !partner || referral.tenantId !== tenantId) {
    return { ok: false, error: 'Anfrage nicht gefunden.' };
  }

  const guard = assertReferralSendAllowed({
    partner,
    consent,
    referral,
    actorTenantId: tenantId,
  });
  if (!guard.allowed) {
    return { ok: false, error: guard.message };
  }

  const dataGuard = assertNoCustomerDataTransfer({
    consentValid: isConsentValid(consent!),
    referralSent: true,
  });
  if (!dataGuard.allowed) {
    return { ok: false, error: dataGuard.message };
  }

  await demoDelay();

  const sent: MarketplaceReferralRequest = {
    ...referral,
    referralStatus: 'sent',
    sentAt: nowIso(),
    requestedAt: nowIso(),
    updatedAt: nowIso(),
  };
  referralStore.set(referralRequestId, sent);

  audit({
    tenantId,
    eventType: 'referral_sent',
    entityType: 'marketplace_referral_requests',
    entityId: referralRequestId,
    summary: `Anfrage an Partner ${partner.name} gesendet (mit Einwilligung)`,
  });

  return { ok: true, data: sent };
}

export async function approvePartnerStatus(
  tenantId: string,
  partnerId: string,
  nextStatus: MarketplacePartnerStatus,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<MarketplacePartner>> {
  if (!canAdministerPartners(actorRoleKey)) {
    return { ok: false, error: 'Partner-Freigabe nur für Administratoren.' };
  }
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const partner = DEMO_MARKETPLACE_PARTNERS.find((item) => item.id === partnerId);
  if (!partner) {
    return { ok: false, error: 'Partner nicht gefunden.' };
  }

  await demoDelay();
  partner.status = nextStatus;

  audit({
    tenantId,
    eventType: 'partner_status_changed',
    entityType: 'marketplace_partners',
    entityId: partnerId,
    summary: `Partner-Status geändert: ${nextStatus}`,
  });

  return { ok: true, data: { ...partner } };
}

export async function prepareCommissionEvent(
  tenantId: string,
  referralRequestId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<MarketplaceCommissionEvent>> {
  const denied = enforcePermission<MarketplaceCommissionEvent>(actorRoleKey, 'connect.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const referral = referralStore.get(referralRequestId);
  if (!referral || referral.tenantId !== tenantId) {
    return { ok: false, error: 'Anfrage nicht gefunden.' };
  }

  const event: MarketplaceCommissionEvent = {
    id: `comm-${Date.now()}`,
    tenantId,
    referralRequestId,
    commissionRuleId: null,
    bookingStatus: 'prepared',
    amountCents: null,
    bookedAt: null,
  };
  commissionStore.set(event.id, event);

  return { ok: true, data: event };
}

export async function bookCommissionEvent(
  tenantId: string,
  eventId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<MarketplaceCommissionEvent>> {
  const denied = enforcePermission<MarketplaceCommissionEvent>(actorRoleKey, 'connect.configure');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const event = commissionStore.get(eventId);
  if (!event || event.tenantId !== tenantId) {
    return { ok: false, error: 'Provisionsereignis nicht gefunden.' };
  }

  const referral = referralStore.get(event.referralRequestId);
  if (!referral) {
    return { ok: false, error: 'Zugehörige Anfrage nicht gefunden.' };
  }

  const guard = assertCommissionBookingAllowed({
    referralStatus: referral.referralStatus,
    bookingStatus: 'booked',
  });
  if (!guard.allowed) {
    return { ok: false, error: guard.message };
  }

  const booked: MarketplaceCommissionEvent = {
    ...event,
    bookingStatus: 'booked',
    amountCents: 0,
    bookedAt: nowIso(),
  };
  commissionStore.set(eventId, booked);

  return { ok: true, data: booked };
}

export function __resetMarketplaceStoresForTests(): void {
  referralStore.clear();
  consentStore.clear();
  commissionStore.clear();
  auditStore.length = 0;
  for (const partner of DEMO_MARKETPLACE_PARTNERS) {
    if (partner.id === 'partner-demo-pflegebox') partner.status = 'draft';
    if (partner.id === 'partner-demo-sanitaet') partner.status = 'pending_review';
    if (partner.id === 'partner-demo-hausnotruf') partner.status = 'approved';
  }
}

export function __getMarketplaceAuditEvents(): MarketplaceAuditEvent[] {
  return [...auditStore];
}

/** Test-only: aktiviert Demo-Partner für Guard-Tests */
export function __activateDemoPartnerForTests(partnerId: string): void {
  const partner = DEMO_MARKETPLACE_PARTNERS.find((item) => item.id === partnerId);
  if (partner) {
    partner.status = 'active';
    partner.agreementSignedAt = nowIso();
  }
}
