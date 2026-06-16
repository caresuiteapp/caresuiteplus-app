import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const migrationPath = path.join(root, 'supabase/migrations/0047_documents_connect_prepared.sql');

function readMigration(): string {
  return readFileSync(migrationPath, 'utf8');
}

describe('0047_documents_connect_prepared migration', () => {
  const sql = readMigration();

  it('legt alle acht Dokument-Connect-Tabellen an', () => {
    const tables = [
      'document_provider_configs',
      'document_templates',
      'generated_documents',
      'document_versions',
      'document_signing_requests',
      'document_ocr_jobs',
      'document_audit_events',
    ];
    for (const table of tables) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
    }
  });

  it('erweitert document_archive_entries aus 0046', () => {
    expect(sql).toContain('ALTER TABLE public.document_archive_entries');
    expect(sql).toContain('generated_document_id');
    expect(sql).toContain('gobd_protection_active');
  });

  it('speichert keine Klartext-Secrets', () => {
    expect(sql).toContain('credential_vault_ref');
    expect(sql).not.toMatch(/api_key\s+TEXT/i);
    expect(sql).not.toMatch(/secret_value/i);
  });

  it('blockiert externen Signatur- und OCR-Transfer per Default', () => {
    expect(sql).toContain('external_transfer       BOOLEAN     NOT NULL DEFAULT FALSE');
    expect(sql).toContain('ocr_external_approved   BOOLEAN     NOT NULL DEFAULT FALSE');
    expect(sql).toContain('health_data_ocr_approved BOOLEAN    NOT NULL DEFAULT FALSE');
  });

  it('definiert alle Dokument-Statuswerte', () => {
    for (const status of [
      'draft', 'generated', 'sent', 'signed', 'rejected', 'archived',
      'corrected', 'cancelled', 'export_ready', 'exported',
      'ocr_pending', 'ocr_completed', 'ocr_failed',
    ]) {
      expect(sql).toContain(`'${status}'`);
    }
  });

  it('registriert alle Signatur- und OCR-Anbieter', () => {
    for (const provider of [
      'docusign', 'adobe_sign', 'skribble', 'fp_sign',
      'google_vision', 'azure_document_intelligence', 'aws_textract',
      'abbyy', 'klippa', 'mindee', 'generic_pdf', 'internal_archive',
    ]) {
      expect(sql).toContain(`'${provider}'`);
    }
  });

  it('aktiviert RLS auf allen neuen Tabellen', () => {
    const tables = [
      'document_provider_configs',
      'document_templates',
      'generated_documents',
      'document_versions',
      'document_signing_requests',
      'document_ocr_jobs',
      'document_audit_events',
    ];
    for (const table of tables) {
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
    }
  });

  it('enthält keine destruktiven Befehle', () => {
    expect(sql).not.toMatch(/\bDROP TABLE\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bDELETE FROM\b/i);
  });

  it('mandantenspezifische Tabellen referenzieren tenant_id', () => {
    for (const table of [
      'document_provider_configs',
      'generated_documents',
      'document_versions',
      'document_signing_requests',
      'document_ocr_jobs',
      'document_audit_events',
    ]) {
      expect(sql).toMatch(
        new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}[\\s\\S]*tenant_id`, 'm'),
      );
    }
  });
});
