import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { extractPlaceholders } from '@/features/documents/templateEngine';
import {
  copySystemTemplateForTenant,
  getSystemTemplate,
  getSystemTemplateSeedCount,
  isSystemTemplateProtected,
  listSystemTemplates,
  resetAllDocumentTemplateStores,
  seedSystemTemplates,
  SYSTEM_TEMPLATE_IDS,
  SYSTEM_TEMPLATE_SEEDS,
  validateSystemTemplatePlaceholders,
  validateSystemTemplateRender,
  validateSystemTemplateRequiredFields,
} from '@/lib/documents';
import {
  getDocumentTemplateDetail,
  updateDocumentTemplateVersion,
} from '@/lib/documents/documentTemplateService';

const TENANT = DEMO_TENANT_ID;
const ADMIN = 'business_admin' as const;

describe('system standard document templates', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetAllDocumentTemplateStores();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetAllDocumentTemplateStores();
  });

  it('enthält genau 25 Systemvorlagen', () => {
    seedSystemTemplates();
    expect(SYSTEM_TEMPLATE_SEEDS).toHaveLength(25);
    expect(SYSTEM_TEMPLATE_IDS).toHaveLength(25);
    expect(getSystemTemplateSeedCount()).toBe(25);
  });

  it('alle 25 Standardvorlagen rendern mit Beispieldaten', () => {
    seedSystemTemplates();
    for (const template of SYSTEM_TEMPLATE_SEEDS) {
      const result = validateSystemTemplateRender(template);
      expect(result.unresolvedPlaceholders, template.templateName).toHaveLength(0);
      expect(result.html, template.templateName).toContain('<!DOCTYPE html>');
      expect(result.validation.status, template.templateName).not.toBe('error');
    }
  });

  it('keine unbekannten Platzhalter in Systemvorlagen', () => {
    seedSystemTemplates();
    for (const template of SYSTEM_TEMPLATE_SEEDS) {
      const placeholders = extractPlaceholders(template.htmlTemplate);
      const validation = validateSystemTemplatePlaceholders(template);
      expect(validation.status, `${template.templateName}: ${placeholders.join(', ')}`).toBe('valid');
      expect(validation.issues, template.templateName).toHaveLength(0);
    }
  });

  it('Pflichtfeld-Validierung funktioniert mit example_context', () => {
    seedSystemTemplates();
    for (const template of SYSTEM_TEMPLATE_SEEDS) {
      const withContext = validateSystemTemplateRequiredFields(template, TENANT);
      expect(withContext.status, template.templateName).toBe('valid');
      expect(template.requiredFields.length, template.templateName).toBeGreaterThan(0);
      expect(template.exampleContext.company.name, template.templateName).toBeTruthy();
    }
  });

  it('Systemvorlage kann für Mandant kopiert werden', async () => {
    seedSystemTemplates();
    const systemId = 'sys-dtpl-001';
    const copy = await copySystemTemplateForTenant(TENANT, systemId, ADMIN);
    expect(copy.ok).toBe(true);
    if (!copy.ok) return;

    expect(copy.data.systemTemplateId).toBe(systemId);
    expect(copy.data.tenantTemplateId).not.toBe(systemId);

    const detail = await getDocumentTemplateDetail(TENANT, copy.data.tenantTemplateId, ADMIN);
    expect(detail.ok).toBe(true);
    if (detail.ok) {
      expect(detail.data.title).toContain('Rechnung Standard');
      expect(detail.data.title).toContain('Kopie');
      expect(detail.data.templateStatus).toBe('draft');
    }
  });

  it('Re-Seed erzeugt keine Duplikate', () => {
    seedSystemTemplates();
    const first = getSystemTemplateSeedCount();
    seedSystemTemplates();
    seedSystemTemplates();
    expect(getSystemTemplateSeedCount()).toBe(first);
    expect(getSystemTemplateSeedCount()).toBe(25);
  });

  it('Mandant kann Kopie bearbeiten', async () => {
    seedSystemTemplates();
    const copy = await copySystemTemplateForTenant(TENANT, 'sys-dtpl-006', ADMIN);
    expect(copy.ok).toBe(true);
    if (!copy.ok) return;

    const updated = await updateDocumentTemplateVersion(
      TENANT,
      copy.data.tenantVersionId,
      { htmlTemplate: '<p>{{company.name}} — Angebot angepasst</p>' },
      ADMIN,
    );
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.data.htmlTemplate).toContain('Angebot angepasst');
    }
  });

  it('Original-Systemvorlage bleibt geschützt', async () => {
    seedSystemTemplates();
    const systemId = 'sys-dtpl-007';
    expect(isSystemTemplateProtected(systemId)).toBe(true);

    const system = await getSystemTemplate(systemId, ADMIN);
    expect(system.ok).toBe(true);
    if (system.ok) {
      const originalHtml = system.data.htmlTemplate;
      await copySystemTemplateForTenant(TENANT, systemId, ADMIN);
      const again = await getSystemTemplate(systemId, ADMIN);
      expect(again.ok).toBe(true);
      if (again.ok) {
        expect(again.data.htmlTemplate).toBe(originalHtml);
        expect(again.data.isSystemTemplate).toBe(true);
      }
    }

    const list = await listSystemTemplates(ADMIN);
    expect(list.ok).toBe(true);
    if (list.ok) {
      expect(list.data.every((t) => t.isSystemTemplate)).toBe(true);
    }
  });

  it('listet active und draft Status korrekt', async () => {
    seedSystemTemplates();
    const list = await listSystemTemplates(ADMIN);
    expect(list.ok).toBe(true);
    if (!list.ok) return;

    const active = list.data.filter((t) => t.templateStatus === 'active');
    const draft = list.data.filter((t) => t.templateStatus === 'draft');
    expect(active.length).toBe(13);
    expect(draft.length).toBe(12);
    expect(active.length + draft.length).toBe(25);
  });
});
