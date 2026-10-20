import { describe, expect, it, beforeEach } from 'vitest';
import { enforcePermission } from '@/lib/permissions';
import {
  checkTIConsent,
  grantTIConsentService,
  revokeTIConsentService,
} from '@/lib/ti/tiConsentService';
import { TI_DEMO_TENANT, resetTIDemoStore } from '@/data/demo/ti';

describe('TI Consent Service', () => {
  beforeEach(() => {
    resetTIDemoStore();
  });

  it('enforcePermission schützt Consent-Service', () => {
    expect(enforcePermission(null, 'ti.consent.manage')).not.toBeNull();
  });

  it('checkTIConsent erkennt fehlende ePA-Einwilligung', async () => {
    const result = await checkTIConsent(TI_DEMO_TENANT, ['epa'], 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.hasConsent).toBe(false);
      expect(result.data.missingScopes).toContain('epa');
    }
  });

  it('checkTIConsent bestätigt KIM-Einwilligung', async () => {
    const result = await checkTIConsent(TI_DEMO_TENANT, ['kim'], 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.hasConsent).toBe(true);
  });

  it('grantTIConsentService erhöht Version', async () => {
    const result = await grantTIConsentService(
      TI_DEMO_TENANT,
      'ti-consent-epa-001',
      'Test Admin',
      'business_admin',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe('granted');
      expect(result.data.version).toBeGreaterThan(1);
    }
  });

  it('revokeTIConsentService setzt Status widerrufen', async () => {
    const result = await revokeTIConsentService(
      TI_DEMO_TENANT,
      'ti-consent-kim-001',
      'Test Admin',
      'business_admin',
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.status).toBe('revoked');
  });
});
