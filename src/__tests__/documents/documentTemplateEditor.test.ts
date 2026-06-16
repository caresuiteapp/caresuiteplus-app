import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import {
  buildDocumentPreview,
  createEmptyDocumentContext,
  sanitizeTemplateHtml,
  validateKnownPlaceholders,
} from '@/features/documents/templateEngine';
import { assertCanActivateTemplateVersion } from '@/features/documents/templateEngine/validateTemplateActivation';
import { buildDocumentContext } from '@/features/documents/templateEngine/documentContext';
import {
  activateDocumentTemplateVersion,
  archiveDocumentTemplate,
  createDocumentTemplateVersion,
  listDocumentTemplates,
  resetDocumentTemplateStore,
  runLivePreview,
  seedDocumentTemplateForTest,
  updateDocumentTemplateVersion,
} from '@/lib/documents';

const TENANT = DEMO_TENANT_ID;
const ADMIN = 'business_admin' as const;

describe('document template editor & live preview', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetDocumentTemplateStore();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetDocumentTemplateStore();
  });

  it('Live-Vorschau rendert bekannte Platzhalter', async () => {
    const { template } = seedDocumentTemplateForTest(TENANT, {
      htmlTemplate: '<p>{{company.name}} — {{invoice.number}}</p>',
    });

    const result = await runLivePreview({
      tenantId: TENANT,
      templateId: template.id,
      sampleId: 'sample-demo',
    }, ADMIN);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.html).toContain('CareSuite');
      expect(result.data.renderResult.unresolvedPlaceholders).not.toContain('company.name');
    }
  });

  it('Fehlende Pflichtfelder erscheinen', async () => {
    const { template } = seedDocumentTemplateForTest(TENANT, {
      htmlTemplate: '<p>{{invoice.number}}</p>',
    });

    const empty = createEmptyDocumentContext({
      tenantId: TENANT,
      entityType: 'invoice',
      entityId: 'x',
    });

    const preview = buildDocumentPreview({
      templateVersion: { htmlTemplate: '<p>{{invoice.number}}</p>' },
      context: empty,
      documentType: 'invoice',
      showDraftWatermark: true,
    });

    expect(preview.renderResult.validation.status).toBe('error');
    expect(preview.renderResult.missingRequiredFields.length).toBeGreaterThan(0);

    await runLivePreview({ tenantId: TENANT, templateId: template.id, sampleId: 'sample-demo' }, ADMIN);
  });

  it('Unbekannte Platzhalter blockieren Aktivierung', async () => {
    const { template, version } = seedDocumentTemplateForTest(TENANT, {
      htmlTemplate: '<p>{{unknown.xyz}}</p>',
    });

    await runLivePreview({ tenantId: TENANT, templateId: template.id, sampleId: 'sample-demo' }, ADMIN);

    const ctx = await buildDocumentContext('invoice', 'inv-demo-1', TENANT);
    expect(ctx.ok).toBe(true);
    if (!ctx.ok) return;

    const check = assertCanActivateTemplateVersion({
      documentType: 'invoice',
      context: ctx.context,
      templateVersion: { htmlTemplate: version.htmlTemplate },
      hasLivePreview: true,
      versionStatus: 'draft',
    });

    expect(check.allowed).toBe(false);
    expect(check.validation.issues.some((i) => i.placeholderKey === 'unknown.xyz')).toBe(true);
  });

  it('Unsicheres HTML wird blockiert', () => {
    const { blocked } = sanitizeTemplateHtml('<p>OK</p><script>alert(1)</script>');
    expect(blocked.some((b) => b.code === 'blocked_tag')).toBe(true);

    const validation = validateKnownPlaceholders(['company.name']);
    expect(validation.status).toBe('valid');
  });

  it('Entwurfswasserzeichen erscheint bei draft', async () => {
    const { template } = seedDocumentTemplateForTest(TENANT);

    const result = await runLivePreview({
      tenantId: TENANT,
      templateId: template.id,
      sampleId: 'sample-demo',
      showDraftWatermark: true,
    }, ADMIN);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.html).toContain('cs-draft-watermark');
      expect(result.data.html).toContain('ENTWURF');
    }
  });

  it('Aktivsetzen nur bei valider Vorlage', async () => {
    const { template, version } = seedDocumentTemplateForTest(TENANT, {
      htmlTemplate: '<p>{{company.name}} {{invoice.number}} {{invoice.date}} {{invoice.service_period}} {{invoice.net_total}} {{invoice.gross_total}} {{invoice.tax_total}} {{invoice.due_date}} {{recipient.full_name}} {{recipient.address}}</p>',
    });

    const withoutPreview = await activateDocumentTemplateVersion(TENANT, version.id, ADMIN);
    expect(withoutPreview.ok).toBe(false);

    await runLivePreview({ tenantId: TENANT, templateId: template.id, sampleId: 'sample-demo' }, ADMIN);

    const activated = await activateDocumentTemplateVersion(TENANT, version.id, ADMIN);
    expect(activated.ok).toBe(true);
  });

  it('Archivierte Vorlage kann nicht bearbeitet werden, nur kopiert/versioniert', async () => {
    const { template, version } = seedDocumentTemplateForTest(TENANT);

    const updateArchived = await updateDocumentTemplateVersion(
      TENANT,
      version.id,
      { htmlTemplate: '<p>Geändert</p>' },
      ADMIN,
    );
    expect(updateArchived.ok).toBe(true);

    await archiveDocumentTemplate(TENANT, template.id, ADMIN);

    const editBlocked = await updateDocumentTemplateVersion(
      TENANT,
      version.id,
      { htmlTemplate: '<p>Nochmal</p>' },
      ADMIN,
    );
    expect(editBlocked.ok).toBe(false);

    const newVersion = await createDocumentTemplateVersion(TENANT, template.id, ADMIN);
    expect(newVersion.ok).toBe(true);
  });

  it('Mandanten-Isolation', async () => {
    const tenantB = '00000000-0000-4000-8000-000000000099';
    seedDocumentTemplateForTest(TENANT, { title: 'Mandant A Vorlage' });
    seedDocumentTemplateForTest(tenantB, { title: 'Mandant B Vorlage', htmlTemplate: '<p>B {{invoice.number}}</p>' });

    const listA = await listDocumentTemplates(TENANT, ADMIN);
    const listB = await listDocumentTemplates(tenantB, ADMIN);

    expect(listA.ok).toBe(true);
    expect(listB.ok).toBe(false);
    if (listA.ok) {
      expect(listA.data.every((t) => t.tenantId === TENANT)).toBe(true);
      expect(listA.data.some((t) => t.title.includes('Mandant B'))).toBe(false);
    }
  });
});
