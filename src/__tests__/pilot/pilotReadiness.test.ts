import { describe, expect, it } from 'vitest';
import {
  PILOT_MILESTONE_ID,
  PILOT_TENANT_IDS,
  getPilotTenantConfig,
  isPilotFeatureEnabled,
  isPilotTenant,
} from '@/lib/pilot/pilotConfig';
import {
  computeReadinessPercent,
  PILOT_CHECKLIST_TEMPLATE,
} from '@/lib/pilot/pilotReadinessService';
import { getPilotTenantById, getPilotTenantSummary, pilotAmbulantTenants } from '@/data/demo/pilotTenants';
import { enforcePermission } from '@/lib/permissions';

describe('Pilot-Konfiguration', () => {
  it('definiert 3 ambulante Pilot-Mandanten für rm-001', () => {
    expect(PILOT_MILESTONE_ID).toBe('rm-001');
    expect(PILOT_TENANT_IDS).toHaveLength(3);
    expect(pilotAmbulantTenants).toHaveLength(3);
  });

  it('erkennt Pilot-Mandanten und Feature-Flags', () => {
    const id = PILOT_TENANT_IDS[0];
    expect(isPilotTenant(id)).toBe(true);
    expect(isPilotTenant('tenant-unknown')).toBe(false);
    expect(isPilotFeatureEnabled(id, 'datev_export')).toBe(true);
    expect(getPilotTenantConfig(id)?.phase).toBe('aktiv');
  });

  it('liefert realistische Mandanten-Daten', () => {
    const tenant = getPilotTenantById(PILOT_TENANT_IDS[1]);
    expect(tenant?.region).toContain('Düsseldorf');
    expect(tenant?.invoiceSampleNumber).toMatch(/^RE-PILOT-/);
    const summary = getPilotTenantSummary();
    expect(summary.activeTenants).toBe(3);
    expect(summary.totalClients).toBeGreaterThan(50);
  });
});

describe('Pilot-Checkliste', () => {
  it('enthält Pflichtpunkte für alle Kategorien', () => {
    const categories = new Set(PILOT_CHECKLIST_TEMPLATE.map((i) => i.category));
    expect(categories.has('auth')).toBe(true);
    expect(categories.has('clients')).toBe(true);
    expect(categories.has('assignments')).toBe(true);
    expect(categories.has('reporting')).toBe(true);
    expect(categories.has('release_gates')).toBe(true);
    expect(PILOT_CHECKLIST_TEMPLATE.filter((i) => i.required).length).toBeGreaterThanOrEqual(8);
  });

  it('berechnet Readiness-Prozent korrekt', () => {
    const requiredIds = PILOT_CHECKLIST_TEMPLATE.filter((i) => i.required).map((i) => i.id);
    expect(computeReadinessPercent([])).toBe(0);
    expect(computeReadinessPercent(requiredIds)).toBe(100);
    expect(computeReadinessPercent(requiredIds.slice(0, Math.floor(requiredIds.length / 2)))).toBeLessThan(100);
  });

  it('enforcePermission schützt Pilot-Services', () => {
    expect(enforcePermission(null, 'roadmap.view')).not.toBeNull();
    expect(enforcePermission(null, 'integrations.manage')).not.toBeNull();
  });
});
