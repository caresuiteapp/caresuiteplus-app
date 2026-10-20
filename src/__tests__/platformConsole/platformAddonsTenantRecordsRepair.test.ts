import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Platform Add-ons und Mandantenakten Reparatur', () => {
  const sql = readFileSync('supabase/migrations/0259_platform_addons_and_tenant_records_repair.sql', 'utf8');

  it('liefert den Add-on-Katalog über geschützte RPCs statt fragile Tabellenabfragen', () => {
    const service = readFileSync('src/lib/platformConsole/platformOperatorDataService.ts', 'utf8');
    expect(service).toContain("platformRpc<Record<string, unknown>[]>('platform_list_addons_catalog')");
    expect(service).toContain("platformRpc<Record<string, unknown>[]>('platform_list_addon_versions'");
    expect(sql).toContain("platform_assert_capability('plans.read')");
    expect(sql).toContain("NOTIFY pgrst, 'reload schema'");
  });

  it('stellt Add-on Anlage, Versionierung, Zuweisung und Entfernung atomar bereit', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.platform_addons');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.platform_create_addon(');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.platform_create_addon_version(');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.platform_assign_addon_to_tenant(');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.platform_remove_addon_from_tenant(');
  });

  it('kennzeichnet echte, fiktive und ungeklärte Mandanten getrennt', () => {
    expect(sql).toContain("'56180c22-b894-4fab-b55e-a563c94dd6e7'::uuid, 'production'");
    expect(sql).toContain("'11111111-1111-1111-1111-111111111101'::uuid, 'pilot'");
    expect(sql).toContain("COALESCE(tes.mode, 'unclassified')");
    const screen = readFileSync('src/screens/platformConsole/PlatformTenantDetailScreen.tsx', 'utf8');
    expect(screen).toContain('Datenklassifizierung');
    expect(screen).toContain('Vertrag & Produkte');
    expect(screen).toContain('Betrieb & Prüfung');
    expect(screen).toContain('Stammdaten bearbeiten');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.platform_update_tenant_record(');
    expect(sql).toContain("'tenant.record_updated'");
  });
});
