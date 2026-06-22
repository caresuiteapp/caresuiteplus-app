import { describe, expect, it, beforeEach } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  __activateDemoPartnerForTests,
  __resetMarketplaceStoresForTests,
  approvePartnerStatus,
  assertCommissionBookingAllowed,
  assertNoCustomerDataTransfer,
  assertReferralSendAllowed,
  bookCommissionEvent,
  canAdministerPartners,
  createReferralDraft,
  getSelectablePartners,
  isPartnerSelectable,
  prepareCommissionEvent,
  recordReferralConsent,
  sendReferralRequest,
  stripSensitivePrefill,
} from '@/lib/marketplace';

const ADMIN = 'business_admin' as const;
const MANAGER = 'business_manager' as const;
const OTHER_TENANT = '00000000-0000-4000-8000-000000000099';
const ACTIVE_PARTNER_ID = 'partner-demo-pflegebox';

describe('Marketplace guards & services', () => {
  beforeEach(() => {
    __resetMarketplaceStoresForTests();
  });

  it('blockiert Partner-Anfrage ohne Einwilligung', async () => {
    __activateDemoPartnerForTests(ACTIVE_PARTNER_ID);
    const draft = await createReferralDraft(
      DEMO_TENANT_ID,
      { partnerId: ACTIVE_PARTNER_ID, requestSubject: 'Test', requestMessage: 'Hallo' },
      ADMIN,
    );
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;

    const send = await sendReferralRequest(DEMO_TENANT_ID, draft.data.referral.id, ADMIN);
    expect(send.ok).toBe(false);
    if (send.ok) return;
    expect(send.error).toMatch(/Einwilligung/i);
  });

  it('inaktiver Partner ist nicht auswählbar', () => {
    expect(getSelectablePartners()).toHaveLength(0);
    expect(isPartnerSelectable({ status: 'pending_review' })).toBe(false);
    expect(isPartnerSelectable({ status: 'approved' })).toBe(false);

    const blocked = assertReferralSendAllowed({
      partner: { status: 'draft' },
      consent: {
        consentGiven: true,
        consentGivenAt: new Date().toISOString(),
        revokedAt: null,
      },
      referral: { referralStatus: 'ready', tenantId: DEMO_TENANT_ID },
      actorTenantId: DEMO_TENANT_ID,
    });
    expect(blocked.allowed).toBe(false);
    if (blocked.allowed) return;
    expect(blocked.code).toBe('partner_not_active');
  });

  it('überträgt keine Kundendaten ohne Einwilligung', () => {
    const guard = assertNoCustomerDataTransfer({ consentValid: false, referralSent: true });
    expect(guard.allowed).toBe(false);
    if (guard.allowed) return;
    expect(guard.code).toBe('no_data_transfer');

    const cleaned = stripSensitivePrefill({
      message: 'Info',
      firstName: 'Max',
      diagnosis: 'ICD',
    });
    expect(cleaned).not.toHaveProperty('firstName');
    expect(cleaned).not.toHaveProperty('diagnosis');
    expect(cleaned.message).toBe('Info');
  });

  it('bucht keine Provision ohne abgeschlossenes Ereignis', async () => {
    __activateDemoPartnerForTests(ACTIVE_PARTNER_ID);
    const draft = await createReferralDraft(
      DEMO_TENANT_ID,
      { partnerId: ACTIVE_PARTNER_ID, requestSubject: 'Test', requestMessage: 'Hallo' },
      ADMIN,
    );
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;

    await recordReferralConsent(DEMO_TENANT_ID, draft.data.referral.id, true, ADMIN);
    await sendReferralRequest(DEMO_TENANT_ID, draft.data.referral.id, ADMIN);

    const prepared = await prepareCommissionEvent(DEMO_TENANT_ID, draft.data.referral.id, ADMIN);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const booked = await bookCommissionEvent(DEMO_TENANT_ID, prepared.data.id, ADMIN);
    expect(booked.ok).toBe(false);
    if (booked.ok) return;
    expect(booked.error).toMatch(/abgeschlossen/i);

    const guard = assertCommissionBookingAllowed({
      referralStatus: 'sent',
      bookingStatus: 'booked',
    });
    expect(guard.allowed).toBe(false);
  });

  it('Admin kann Partner freigeben, Normalnutzer nicht', async () => {
    const adminResult = await approvePartnerStatus(
      DEMO_TENANT_ID,
      'partner-demo-sanitaet',
      'active',
      ADMIN,
    );
    expect(adminResult.ok).toBe(true);

    const managerResult = await approvePartnerStatus(
      DEMO_TENANT_ID,
      'partner-demo-sanitaet',
      'active',
      MANAGER,
    );
    expect(managerResult.ok).toBe(false);
    if (managerResult.ok) return;
    expect(managerResult.error).toMatch(/Administratoren/i);

    expect(canAdministerPartners(ADMIN)).toBe(true);
    expect(canAdministerPartners(MANAGER)).toBe(false);
  });

  it('erzwingt Mandantenisolation', async () => {
    __activateDemoPartnerForTests(ACTIVE_PARTNER_ID);
    const draft = await createReferralDraft(
      DEMO_TENANT_ID,
      { partnerId: ACTIVE_PARTNER_ID, requestSubject: 'Test', requestMessage: 'Hallo' },
      ADMIN,
    );
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;

    await recordReferralConsent(DEMO_TENANT_ID, draft.data.referral.id, true, ADMIN);

    const otherTenantSend = await sendReferralRequest(OTHER_TENANT, draft.data.referral.id, ADMIN);
    expect(otherTenantSend.ok).toBe(false);

    const guard = assertReferralSendAllowed({
      partner: { status: 'active' },
      consent: {
        consentGiven: true,
        consentGivenAt: new Date().toISOString(),
        revokedAt: null,
      },
      referral: { referralStatus: 'ready', tenantId: DEMO_TENANT_ID },
      actorTenantId: OTHER_TENANT,
    });
    expect(guard.allowed).toBe(false);
    if (guard.allowed) return;
    expect(guard.code).toBe('tenant_mismatch');
  });

  it('sendet Anfrage nur bei aktivem Partner und Einwilligung', async () => {
    __activateDemoPartnerForTests(ACTIVE_PARTNER_ID);
    const draft = await createReferralDraft(
      DEMO_TENANT_ID,
      { partnerId: ACTIVE_PARTNER_ID, requestSubject: 'Test', requestMessage: 'Hallo' },
      ADMIN,
    );
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;

    await recordReferralConsent(DEMO_TENANT_ID, draft.data.referral.id, true, ADMIN);
    const sent = await sendReferralRequest(DEMO_TENANT_ID, draft.data.referral.id, ADMIN);
    expect(sent.ok).toBe(true);
    if (!sent.ok) return;
    expect(sent.data.referralStatus).toBe('sent');
  });
});
