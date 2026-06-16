import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const migrationPath = path.join(root, 'supabase/migrations/0047_marketplace_prepared.sql');

function readMigration(): string {
  return readFileSync(migrationPath, 'utf8');
}

describe('0047_marketplace_prepared migration', () => {
  const sql = readMigration();

  it('legt alle neun Marktplatz-Tabellen an', () => {
    const tables = [
      'marketplace_categories',
      'marketplace_partners',
      'marketplace_partner_services',
      'marketplace_partner_regions',
      'marketplace_referral_requests',
      'marketplace_referral_consents',
      'marketplace_commission_rules',
      'marketplace_commission_events',
      'marketplace_audit_events',
    ];
    for (const table of tables) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
    }
  });

  it('definiert Partner- und Referral-Status', () => {
    expect(sql).toContain("'draft', 'pending_review', 'approved', 'active', 'paused', 'rejected', 'archived'");
    expect(sql).toContain("'draft', 'consent_required', 'ready', 'sent', 'accepted'");
    expect(sql).toContain("'rejected', 'completed', 'cancelled'");
  });

  it('aktiviert RLS auf allen Marktplatz-Tabellen', () => {
    const tables = [
      'marketplace_categories',
      'marketplace_partners',
      'marketplace_partner_services',
      'marketplace_partner_regions',
      'marketplace_referral_requests',
      'marketplace_referral_consents',
      'marketplace_commission_rules',
      'marketplace_commission_events',
      'marketplace_audit_events',
    ];
    for (const table of tables) {
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
    }
  });

  it('seedet alle 13 Partner-Kategorien', () => {
    const categories = [
      'pflegehilfsmittel',
      'sanitaetshaus',
      'apotheke',
      'wundversorgung',
      'hausnotruf',
      'essensdienst',
      'fahrdienst',
      'reinigungsdienst',
      'alltagshilfe',
      'schulungsanbieter',
      'abrechnungszentrum',
      'steuerberater',
      'versicherung_beratung',
    ];
    for (const key of categories) {
      expect(sql).toContain(`'${key}'`);
    }
  });

  it('mandantenspezifische Tabellen referenzieren tenant_id', () => {
    for (const table of [
      'marketplace_referral_requests',
      'marketplace_referral_consents',
      'marketplace_commission_events',
      'marketplace_audit_events',
    ]) {
      expect(sql).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}[\\s\\S]*tenant_id`, 'm'));
    }
  });

  it('enthält keine destruktiven Befehle', () => {
    expect(sql).not.toMatch(/\bDROP TABLE\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bDELETE FROM\b/i);
  });
});
