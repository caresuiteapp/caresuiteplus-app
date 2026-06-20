import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../..');

function readSrc(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

describe('Client Core K.4 — record UI wiring', () => {
  it('ClientRecordScreen uses ClientEditModal not separate edit page flow', () => {
    const screen = readSrc('src/screens/business/office/ClientRecordScreen.tsx');
    expect(screen).toContain('ClientEditModal');
    expect(screen).not.toMatch(/ClientIntakeModal[\s\S]*mode="edit"/);
  });

  it('ClientEditScreen redirects to record with edit param (modal unification)', () => {
    const edit = readSrc('src/screens/office/ClientEditScreen.tsx');
    expect(edit).toContain('?edit=1');
    expect(edit).toContain('router.replace');
  });

  it('modal stack registers client record and edit modals', () => {
    const modals = readSrc('src/lib/navigation/modulenav/modalscreens.ts');
    expect(modals).toContain("'prep.client.record'");
    expect(modals).toContain("'prep.client.edit'");
    expect(modals).toContain("'client.serviceProfile.add'");
  });

  it('ClientRecordTabPanels wires leistungsbereiche budget portal panels', () => {
    const panels = readSrc('src/screens/business/office/ClientRecordTabPanels.tsx');
    expect(panels).toContain('ClientServiceProfilesPanel');
    expect(panels).toContain('ClientBudgetCorePanel');
    expect(panels).toContain('ClientPortalCorePanel');
    expect(panels).toContain("case 'leistungsbereiche'");
    expect(panels).toContain("case 'budget'");
    expect(panels).toContain("case 'portal'");
  });

  it('service profiles use endClientServiceProfile not hard delete', () => {
    const service = readSrc('src/lib/client/clientServiceTypeService.ts');
    expect(service).toContain('endClientServiceProfile');
    expect(service).not.toMatch(/client_service_profiles[\s\S]*\.delete\(\)/);
  });

  it('tenant settings screens list DB-backed types and budget', () => {
    const types = readSrc('app/settings/tenant/client-service-types.tsx');
    const budget = readSrc('app/settings/tenant/client-budget.tsx');
    expect(types).toContain('listTenantClientServiceTypes');
    expect(budget).toContain('listTenantBudgetDefaults');
    expect(budget).not.toMatch(/13100|353900/);
  });
});
