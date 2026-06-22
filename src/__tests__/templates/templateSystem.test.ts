import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { getAllCatalogEntries, getAllSystemTemplates } from '@/data/demo/templates';
import {
  archiveTemplate,
  createCatalogEntry,
  createTemplate,
  getDropdownOptions,
  listTemplates,
  renderTemplateWithVariables,
} from '@/lib/templates';
import { resetTemplateDemoStore } from '@/lib/templates/templateRepository.demo';
import { getServiceMode } from '@/lib/services/mode';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import * as fs from 'node:fs';
import * as path from 'node:path';

vi.mock('@/lib/templates/templateRepository.supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/templates/templateRepository.supabase')>();
  const demo = await import('@/lib/templates/templateRepository.demo');
  return {
    ...actual,
    templateSupabaseRepository: demo.templateDemoRepository,
    catalogSupabaseRepository: demo.catalogDemoRepository,
  };
});

const TENANT = DEMO_TENANT_ID;

describe('templateSystem — Paket F', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetTemplateDemoStore();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
  });

  it('lädt Systemvorlagen (50+)', async () => {
    expect(getAllSystemTemplates().length).toBeGreaterThanOrEqual(50);
    const result = await listTemplates(TENANT, { scope: 'system' }, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.length).toBeGreaterThanOrEqual(50);
      expect(result.data.every((t) => t.scope === 'system')).toBe(true);
    }
  });

  it('lädt Mandantenvorlagen nach Erstellung', async () => {
    const created = await createTemplate(
      TENANT,
      {
        moduleKey: 'office',
        templateType: 'documentation_text',
        title: 'Test Mandant',
        content: 'Hallo {{clientName}}',
      },
      'business_admin',
    );
    expect(created.ok).toBe(true);
    const list = await listTemplates(TENANT, { scope: 'tenant' }, 'business_admin');
    expect(list.ok).toBe(true);
    if (list.ok) {
      expect(list.data.some((t) => t.title === 'Test Mandant')).toBe(true);
    }
  });

  it('Dropdown nutzt System-Katalog als Fallback', async () => {
    expect(getAllCatalogEntries().length).toBeGreaterThanOrEqual(30);
    const options = await getDropdownOptions(TENANT, 'task_category', 'business_admin');
    expect(options.ok).toBe(true);
    if (options.ok) {
      expect(options.data.length).toBeGreaterThan(0);
      expect(options.data.some((o) => o.isSystem)).toBe(true);
    }
  });

  it('Mandanten-Katalog ergänzt System-Katalog', async () => {
    await createCatalogEntry(
      TENANT,
      {
        catalogType: 'task_category',
        valueKey: 'custom_task',
        label: 'Eigene Aufgabe',
        moduleKey: 'assist',
      },
      'business_admin',
    );
    const options = await getDropdownOptions(TENANT, 'task_category', 'business_admin');
    expect(options.ok).toBe(true);
    if (options.ok) {
      expect(options.data.some((o) => o.value === 'custom_task')).toBe(true);
      expect(options.data.some((o) => o.isSystem)).toBe(true);
    }
  });

  it('Template kann erstellt und archiviert werden', async () => {
    const created = await createTemplate(
      TENANT,
      {
        moduleKey: 'pflege',
        templateType: 'documentation_text',
        title: 'Archiv Test',
        content: 'Inhalt',
        status: 'active',
      },
      'business_admin',
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const archived = await archiveTemplate(TENANT, created.data.id, 'business_admin');
    expect(archived.ok).toBe(true);
    if (archived.ok) expect(archived.data.status).toBe('archived');
  });

  it('Live-Modus ohne Supabase wirft kontrollierten Fehler', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-key');
    expect(getServiceMode()).toBe('supabase');
    const { templateSupabaseRepository, catalogSupabaseRepository } = await vi.importActual<
      typeof import('@/lib/templates/templateRepository.supabase')
    >('@/lib/templates/templateRepository.supabase');
    const result = await templateSupabaseRepository.list(TENANT, {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(SERVICE_ERRORS.supabaseUnavailable);
    const catalog = await catalogSupabaseRepository.list(TENANT);
    expect(catalog.ok).toBe(false);
  });

  it('Hooks nutzen useServiceTenantId — kein hartes DEMO_TENANT_ID in Hook-Quellcode', () => {
    const hooksDir = path.join(process.cwd(), 'src/hooks/templates');
    const files = fs
      .readdirSync(hooksDir)
      .filter((f) => f.endsWith('.ts') && f !== 'index.ts' && f !== 'useTemplateVariables.ts');
    for (const file of files) {
      const src = fs.readFileSync(path.join(hooksDir, file), 'utf8');
      expect(src).toContain('useServiceTenantId');
      expect(src).not.toContain('DEMO_TENANT_ID');
    }
  });

  it('Template Rendering mit Variablen funktioniert', () => {
    const rendered = renderTemplateWithVariables('Hallo {{clientName}}, Termin am {{date}}.', {
      clientName: 'Helga Schneider',
      date: '2026-06-13',
    });
    expect(rendered).toBe('Hallo Helga Schneider, Termin am 2026-06-13.');
    expect(renderTemplateWithVariables('{{unknown}}', {})).toBe('{{unknown}}');
  });
});
