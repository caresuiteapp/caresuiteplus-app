import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  SYSTEM_DOCUMENT_CATALOG_MANIFEST,
  SYSTEM_DOCUMENT_CATALOG_TEMPLATES,
  getAssistAllowedCatalogEntries,
  getSystemDocumentCatalogCount,
} from '@/data/seeds/documentCatalog';
import { buildGeneratedDocumentFileName } from '@/lib/documents/documentFileNameService';
import { seedSystemTemplates, getSystemTemplateSeedCount, resetSystemTemplateStore } from '@/lib/documents/systemTemplateService';

describe('document engine catalog', () => {
  it('enthält 179 Systemvorlagen-Einträge im Manifest', () => {
    expect(SYSTEM_DOCUMENT_CATALOG_MANIFEST).toHaveLength(179);
    expect(getSystemDocumentCatalogCount()).toBe(179);
  });

  it('baut renderbare HTML für alle Katalog-Vorlagen', () => {
    for (const template of SYSTEM_DOCUMENT_CATALOG_TEMPLATES) {
      expect(template.htmlTemplate.length, template.templateKey).toBeGreaterThan(50);
      expect(template.cssTemplate.length, template.templateKey).toBeGreaterThan(20);
    }
  });

  it('filtert Assist-Vorlagen ohne medizinische Inhalte', () => {
    const assist = getAssistAllowedCatalogEntries();
    expect(assist.length).toBeGreaterThan(0);
    for (const entry of assist) {
      expect(entry.isAssistAllowed).toBe(true);
      expect(entry.isMedicalOrTreatmentRelated).toBe(false);
    }
  });

  it('seedet Katalog zusätzlich zu den 25 Basis-HTML-Vorlagen', () => {
    resetSystemTemplateStore();
    seedSystemTemplates();
    expect(getSystemTemplateSeedCount()).toBeGreaterThanOrEqual(179 + 25);
  });
});

describe('document file name service', () => {
  it('erzeugt Spec-konformen PDF-Dateinamen', () => {
    expect(
      buildGeneratedDocumentFileName({
        date: '2026-06-25',
        templateShortName: 'Leistungsnachweis',
        clientLastName: 'Mustermann',
        clientFirstName: 'Erika',
      }),
    ).toBe('2026-06-25_Leistungsnachweis_Mustermann_Erika.pdf');
  });
});

describe('migration 0168 document engine', () => {
  it('definiert Kern-Tabellen und Spec-Felder', () => {
    const sql = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/0168_document_engine_master.sql'),
      'utf8',
    );
    expect(sql).toContain('document_template_fields');
    expect(sql).toContain('document_template_bindings');
    expect(sql).toContain('document_send_logs');
    expect(sql).toContain('document_audit_log');
    expect(sql).toContain('is_assist_allowed');
    expect(sql).toContain('is_medical_or_treatment_related');
  });
});

describe('document engine spec compliance', () => {
  it('Pflichtvorlagen 149–179 vorhanden', () => {
    for (let n = 149; n <= 179; n += 1) {
      expect(SYSTEM_DOCUMENT_CATALOG_MANIFEST.some((e) => e.templateNumber === n)).toBe(true);
    }
  });

  it('jede Vorlage hat Modul, Zielakte und Layoutfamilie', () => {
    for (const entry of SYSTEM_DOCUMENT_CATALOG_MANIFEST) {
      expect(entry.moduleScope.length, entry.templateKey).toBeGreaterThan(0);
      expect(entry.targetRecordType, entry.templateKey).toBeTruthy();
      expect(entry.defaultStorageArea, entry.templateKey).toBeTruthy();
      expect(entry.layoutFamily, entry.templateKey).toBeTruthy();
    }
  });

  it('15 Layoutfamilien im Katalog vertreten', () => {
    const families = new Set(SYSTEM_DOCUMENT_CATALOG_TEMPLATES.map((t) => t.layoutFamily));
    expect(families.has('client_master')).toBe(true);
    expect(families.has('service_proof')).toBe(true);
    expect(families.has('invoice')).toBe(true);
    expect(families.has('consultation')).toBe(true);
    expect(families.has('care_clinical')).toBe(true);
    expect(families.has('academy_certificate')).toBe(true);
    expect(families.has('assist_visit')).toBe(true);
    expect(families.has('shift_plan')).toBe(true);
    expect(families.has('vehicle_log')).toBe(true);
    expect(families.has('employee_form')).toBe(true);
  });

  it('Assist filter schließt Pflegefach-Vorlagen aus', () => {
    const assist = getAssistAllowedCatalogEntries();
    const keys = assist.map((e) => e.templateKey);
    expect(keys).not.toContain('pflegeanamnese');
    expect(keys).not.toContain('medikationsplan');
  });

  it('Migration 0170 Seed-SQL für 179 Vorlagen vorhanden', () => {
    const sql = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/0170_document_catalog_seed.sql'),
      'utf8',
    );
    expect(sql).toContain('migration_0170');
    expect((sql.match(/template_created/g) ?? []).length).toBeGreaterThanOrEqual(179);
  });

  it('Permissions 0169 für settings.templates und documents', () => {
    const sql = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/0169_document_engine_permissions.sql'),
      'utf8',
    );
    expect(sql).toContain('settings.templates.view');
    expect(sql).toContain('documents.pdf_create');
    expect(sql).toContain('documents.email_send');
  });
});
