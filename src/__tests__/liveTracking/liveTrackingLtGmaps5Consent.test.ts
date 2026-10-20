import { describe, expect, it } from 'vitest';
import {
  EMPLOYEE_PORTAL_CONSENT_PENDING_WARNING,
  rebuildEmployeePortalTrackingWarnings,
} from '@/lib/portal/employeePortalVisitTrackingService';

describe('rebuildEmployeePortalTrackingWarnings', () => {
  it('entfernt Einwilligungs-Warnung nach DB-Consent', () => {
    const warnings = rebuildEmployeePortalTrackingWarnings(
      { granted: true, grantedAt: '2026-06-29T10:00:00.000Z', explainedAt: null },
      'granted',
      [EMPLOYEE_PORTAL_CONSENT_PENDING_WARNING, 'Andere Meldung'],
    );
    expect(warnings).not.toContain(EMPLOYEE_PORTAL_CONSENT_PENDING_WARNING);
    expect(warnings).toContain('Andere Meldung');
  });

  it('behält Einwilligungs-Warnung wenn Consent fehlt', () => {
    const warnings = rebuildEmployeePortalTrackingWarnings(
      { granted: false, grantedAt: null, explainedAt: null },
      'granted',
      [],
    );
    expect(warnings[0]).toBe(EMPLOYEE_PORTAL_CONSENT_PENDING_WARNING);
  });
});

describe('LT.GMAPS.5 employeeLocationConsentPersistence', () => {
  it('exports fetch and upsert helpers', async () => {
    const mod = await import('@/features/liveTracking/employeeLocationConsentPersistence');
    expect(typeof mod.fetchEmployeeLocationConsentRecord).toBe('function');
    expect(typeof mod.upsertEmployeeLocationConsentRecord).toBe('function');
  });
});

describe('LT.GMAPS.5 resolveEmployeeLiveContext consent sources', () => {
  it('references employee-level consent reader', async () => {
    const mod = await import('@/features/liveTracking/resolveEmployeeLiveContext');
    expect(mod.resolveEmployeeLiveContext.toString()).toContain('fetchEmployeeLocationConsentRecord');
    expect(mod.resolveEmployeeLiveContext.toString()).toContain('fetchLatestTrackingSessionWithConsent');
  });
});

describe('LT.GMAPS.5 saveEmployeeLocationConsent employee scope', () => {
  it('persists employee-level consent on save', async () => {
    const mod = await import('@/features/liveTracking/saveEmployeeLocationConsent');
    expect(mod.saveEmployeeLocationConsent.toString()).toContain('persistEmployeeConsentScope');
  });
});
