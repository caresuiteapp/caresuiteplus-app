import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const migrationPath = path.join(root, 'supabase/migrations/0045_connect_api_connector.sql');

function readMigration(): string {
  return readFileSync(migrationPath, 'utf8');
}

describe('0045_connect_api_connector migration', () => {
  const sql = readMigration();

  it('legt alle neun Connect-Tabellen an', () => {
    const tables = [
      'connect_providers',
      'connect_provider_capabilities',
      'tenant_connect_integrations',
      'tenant_connect_credentials',
      'connect_data_permissions',
      'connect_sync_jobs',
      'connect_webhook_events',
      'connect_audit_events',
      'connect_partner_marketplace_entries',
    ];
    for (const table of tables) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
    }
  });

  it('speichert keine Klartext-Secrets in Credentials', () => {
    expect(sql).toContain('credential_reference');
    expect(sql).not.toMatch(/api_key\s+TEXT/i);
    expect(sql).not.toMatch(/secret_value/i);
    expect(sql).toContain('kein SELECT für authenticated');
  });

  it('trennt Anbieter-, Feature- und Integrationsstatus', () => {
    expect(sql).toContain("CHECK (status IN ('draft', 'preview', 'active', 'deprecated', 'disabled')");
    expect(sql).toContain("CHECK (status IN ('planned', 'beta', 'active', 'deprecated', 'disabled')");
    expect(sql).toContain('integration_status');
    expect(sql).toContain('display_status');
  });

  it('aktiviert RLS auf allen Connect-Tabellen', () => {
    const tables = [
      'connect_providers',
      'connect_provider_capabilities',
      'tenant_connect_integrations',
      'tenant_connect_credentials',
      'connect_data_permissions',
      'connect_sync_jobs',
      'connect_webhook_events',
      'connect_audit_events',
      'connect_partner_marketplace_entries',
    ];
    for (const table of tables) {
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
    }
  });

  it('blockiert Credential-Zugriff für authenticated (keine Policy/Grant SELECT)', () => {
    expect(sql).not.toMatch(/GRANT SELECT ON public\.tenant_connect_credentials TO authenticated/);
    expect(sql).toContain('GRANT ALL ON public.tenant_connect_credentials TO service_role');
  });

  it('dupliziert keine Bestandstabellen integration_providers oder ti_providers', () => {
    expect(sql).not.toMatch(/CREATE TABLE IF NOT EXISTS public\.integration_providers/);
    expect(sql).not.toMatch(/CREATE TABLE IF NOT EXISTS public\.ti_providers/);
    expect(sql).toContain('integration_providers (0007)');
    expect(sql).toContain('ti_providers (0009)');
  });

  it('enthält keine destruktiven Befehle', () => {
    expect(sql).not.toMatch(/\bDROP TABLE\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bDELETE FROM\b/i);
  });

  it('mandantenspezifische Tabellen referenzieren tenant_id', () => {
    for (const table of [
      'tenant_connect_integrations',
      'tenant_connect_credentials',
      'connect_data_permissions',
      'connect_sync_jobs',
      'connect_audit_events',
    ]) {
      expect(sql).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}[\\s\\S]*tenant_id`, 'm'));
    }
  });
});
