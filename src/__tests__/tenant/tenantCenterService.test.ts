import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  fetchTenantCenter,
  resetTenantCenterStore,
  saveTenantCompanyProfile,
  seedTenantCenterForTest,
} from '@/lib/tenant/tenantCenterService';
import { buildTenantCenterSections } from '@/lib/tenant/tenantCenterSections';
import { validateEmail, validateIban, validateVatId } from '@/lib/tenant/tenantValidation';

// Native company records use the same live-only authority as the Web workspace.
vi.mock('react-native', async original => {
  const actual = await original<typeof import('react-native')>();
  return { ...actual, Platform: { ...actual.Platform, OS: 'android' } };
});

const root = path.join(__dirname, '..', '..', '..');
const migrationPath = path.join(root, 'supabase/migrations/0108_tenant_center_foundation_live.sql');
const catalogMigrationPath = path.join(root, 'supabase/migrations/0109_tenant_service_catalog_all_modules.sql');

function readMigration(): string {
  return readFileSync(migrationPath, 'utf8');
}

describe('0108 tenant center migration', () => {
  const sql = readMigration();

  it('legt Kern-Tabellen idempotent an', () => {
    for (const table of [
      'tenant_legal_profiles',
      'tenant_tax_profiles',
      'tenant_register_profiles',
      'tenant_representatives',
      'tenant_bank_accounts',
      'tenant_module_settings',
      'tenant_service_catalog',
      'tenant_service_prices',
      'tenant_service_price_versions',
      'tenant_custom_field_definitions',
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
    }
  });

  it('aktiviert RLS auf allen neuen Tabellen', () => {
    expect(sql).toContain("EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl)");
    expect(sql).toContain('tenant_service_catalog');
    expect(sql).toContain('business.tenant.manage');
  });

  it('seedet Assist-Katalog nur wenn leer', () => {
    expect(sql).toContain('seed_tenant_assist_service_catalog');
    expect(sql).toContain('IF EXISTS');
    expect(sql).toContain('assist.alltagsbegleitung');
  });
});

describe('0109 tenant service catalog all modules migration', () => {
  const sql = readFileSync(catalogMigrationPath, 'utf8');

  it('seedet Pflege, Stationär und Beratung pro Modul', () => {
    expect(sql).toContain('seed_tenant_service_catalog');
    expect(sql).toContain('pflege.grundpflege');
    expect(sql).toContain('stationaer.tagespflege');
    expect(sql).toContain('beratung.pflegeberatung_7a');
  });

  it('enthält keine destruktiven DROP TABLE Befehle', () => {
    expect(sql).not.toMatch(/\bDROP TABLE\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
  });
});

describe('0108 tenant center migration destructive checks', () => {
  const sql = readMigration();

  it('enthält keine destruktiven DROP TABLE Befehle', () => {
    expect(sql).not.toMatch(/\bDROP TABLE\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
  });
});

describe('tenantCenterService', () => {
  it('liefert ohne Serververbindung keinen nativen Demo-Snapshot als Unternehmensakte', async () => {
    resetTenantCenterStore();
    seedTenantCenterForTest(DEMO_TENANT_ID);
    const result = await fetchTenantCenter(DEMO_TENANT_ID, 'business_admin');
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('aktive Datenbankverbindung') });
  });

  it('meldet ohne Serververbindung keine erfolgreiche native Speicherung', async () => {
    resetTenantCenterStore();
    const original = seedTenantCenterForTest(DEMO_TENANT_ID);
    const originalName = original.company.name;
    const saved = await saveTenantCompanyProfile(
      DEMO_TENANT_ID,
      { ...original.company, name: 'Mandant Test GmbH' },
      'business_admin',
    );
    expect(saved).toMatchObject({ ok: false, error: expect.stringContaining('aktive Datenbankverbindung') });
    expect(original.company.name).toBe(originalName);
  });

  it('berechnet Katalog-Zusammenfassung in Sektionen', () => {
    const snapshot = seedTenantCenterForTest(DEMO_TENANT_ID);
    snapshot.catalogSummary = 'Assist: Alltagsbegleitung 38,00 €/Std.';
    const sections = buildTenantCenterSections(snapshot);
    const catalog = sections.find((section) => section.key === 'catalog');
    expect(catalog?.summary).toContain('Assist');
  });
});

describe('tenantValidation', () => {
  it('validiert E-Mail, IBAN und USt-IdNr.', () => {
    expect(validateEmail('info@example.com')).toBeNull();
    expect(validateEmail('invalid')).toMatch(/E-Mail/);
    expect(validateIban('DE89370400440532013000')).toBeNull();
    expect(validateVatId('DE123456789')).toBeNull();
    expect(validateVatId('DE123')).toMatch(/USt-IdNr/);
  });
});
