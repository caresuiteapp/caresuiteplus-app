import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import {
  ASSIST_SERVICE_AREA_KEYS,
  ASSIST_SERVICE_CATALOG_LIVE_MIGRATION,
  ASSIST_SERVICE_CATALOG_REQUIRED_MIGRATION,
  canUseAssistServiceCatalogInCurrentMode,
  createAssistService,
  defineServiceTaskPackage,
  fetchAssistServices,
  generateAssignmentTemplateFromService,
  isAssistServiceCatalogLiveReady,
  isAssistServiceCatalogWiringPrepared,
  listAssistServiceCatalogAuditEvents,
  resetAssistServiceCatalogStore,
  setServiceBillingRule,
  setServiceDocumentationRequirement,
  setServiceHourlyRate,
  validateAssistServiceCategory,
} from '@/lib/assistServiceCatalog';
import {
  listAssistServices,
  saveAssistService,
} from '@/lib/assistServiceCatalog/assistServiceCatalogStore';
import { listServiceRates, resetCareBillingStore } from '@/lib/careBilling';

const TENANT_A = DEMO_TENANT_ID;
const TENANT_B = '00000000-0000-4000-8000-000000000098';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Assist Leistungskatalog (Migration 0053)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetAssistServiceCatalogStore();
    resetCareBillingStore();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetAssistServiceCatalogStore();
    resetCareBillingStore();
  });

  it('1. Migration 0053 und zehn Leistungsbereiche existieren', () => {
    expect(
      fs.existsSync(
        path.join(process.cwd(), 'supabase/migrations/0053_assist_service_catalog_prepared.sql'),
      ),
    ).toBe(true);
    expect(ASSIST_SERVICE_AREA_KEYS).toHaveLength(10);
    expect(ASSIST_SERVICE_AREA_KEYS).toContain('alltagsbegleitung');
    expect(ASSIST_SERVICE_AREA_KEYS).toContain('sonstige_unterstuetzung');
  });

  it('2. blockiert Fehldeklaration medizinischer Leistungen als Alltagsbegleitung', () => {
    const blocked = validateAssistServiceCategory(
      'alltagsbegleitung',
      'Wundversorgung zu Hause',
      'Medikamentengabe und Injektion',
    );
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.error).toContain('Alltagsbegleitung');
      expect(blocked.error).toContain('Pflege');
    }

    const createResult = createAssistService({
      tenantId: TENANT_A,
      serviceKey: 'AB-MED',
      title: 'Medikamentengabe',
      description: 'Tägliche Injektion',
      category: 'alltagsbegleitung',
    });
    expect(createResult.ok).toBe(false);
  });

  it('3. Leistung ist abrechenbar mit versioniertem Stundensatz', () => {
    const services = fetchAssistServices(TENANT_A);
    expect(services.ok).toBe(true);
    if (!services.ok) return;

    const service = services.data.find((entry) => entry.serviceKey === 'AB-STD');
    expect(service).toBeDefined();
    expect(service?.billable).toBe(true);

    const rate = setServiceHourlyRate({
      tenantId: TENANT_A,
      serviceCatalogItemId: service!.id,
      versionLabel: '2026-Q2',
      hourlyRateNetCents: 3200,
      taxMode: 'ustg_4_16_exempt',
      validFrom: '2026-04-01',
    });
    expect(rate.ok).toBe(true);
    if (rate.ok) {
      expect(rate.data.versionLabel).toBe('2026-Q2');
      expect(rate.data.hourlyRateNetCents).toBe(3200);
    }

    const rateV2 = setServiceHourlyRate({
      tenantId: TENANT_A,
      serviceCatalogItemId: service!.id,
      versionLabel: '2026-Q3',
      hourlyRateNetCents: 3400,
      taxMode: 'ustg_4_16_exempt',
      validFrom: '2026-07-01',
    });
    expect(rateV2.ok).toBe(true);

    const tenantRates = listServiceRates(TENANT_A);
    expect(tenantRates.some((entry) => entry.hourlyRateNetCents === 3400)).toBe(true);
  });

  it('4. Aufgabenpaket erzeugt Einsatzvorlage', () => {
    const services = fetchAssistServices(TENANT_A);
    expect(services.ok).toBe(true);
    if (!services.ok) return;

    const service = services.data.find((entry) => entry.serviceKey === 'AB-STD')!;
    const extraTask = defineServiceTaskPackage({
      tenantId: TENANT_A,
      serviceCatalogItemId: service.id,
      taskKey: 'tee',
      title: 'Tee zubereiten',
      description: 'Gemeinsam in der Küche',
      sortOrder: 3,
    });
    expect(extraTask.ok).toBe(true);

    const template = generateAssignmentTemplateFromService(TENANT_A, service.id);
    expect(template.ok).toBe(true);
    if (template.ok) {
      expect(template.data.tasks.length).toBeGreaterThanOrEqual(4);
      expect(template.data.billingRelevant).toBe(true);
      expect(template.data.requiresDocumentation).toBe(true);
      expect(template.data.serviceType).toBe('alltagsbegleitung');
    }

    const audit = listAssistServiceCatalogAuditEvents(TENANT_A, service.id);
    expect(audit.some((event) => event.action === 'assignment_template_generated')).toBe(true);
  });

  it('5. Dokumentations- und Signaturpflichten sind konfigurierbar', () => {
    const services = fetchAssistServices(TENANT_A);
    expect(services.ok).toBe(true);
    if (!services.ok) return;

    const service = services.data.find((entry) => entry.serviceKey === 'BT-STD')!;
    expect(service.requiresSignature).toBe(true);

    const doc = setServiceDocumentationRequirement({
      tenantId: TENANT_A,
      serviceCatalogItemId: service.id,
      requirementKey: 'leistungsnachweis',
      kind: 'signature',
      label: 'Unterschrift Klient:in',
      isMandatory: true,
    });
    expect(doc.ok).toBe(true);

    const billing = setServiceBillingRule({
      tenantId: TENANT_A,
      serviceCatalogItemId: service.id,
      budgetType: 'paragraph_45b',
      requiresServiceProof: true,
    });
    expect(billing.ok).toBe(true);
    if (billing.ok) {
      expect(billing.data.requiresServiceProof).toBe(true);
      expect(billing.data.budgetType).toBe('paragraph_45b');
    }
  });

  it('6. Mandantenisolation und kein Demo-Fallback im Produktivmodus', () => {
    const tenantBlock = guardServiceTenant('wrong-tenant-id');
    expect(tenantBlock).not.toBeNull();
    expect(tenantBlock?.ok).toBe(false);

    const now = '2026-06-01T10:00:00.000Z';
    saveAssistService(TENANT_B, {
      id: 'asc-iso-b',
      tenantId: TENANT_B,
      serviceKey: 'ISO-001',
      title: 'Isolierte Leistung',
      description: '',
      category: 'betreuung',
      billable: true,
      requiresSignature: false,
      requiresDocumentation: true,
      defaultDurationMinutes: 60,
      defaultTaskTemplateIds: [],
      allowedModules: ['assist'],
      taxMode: 'ustg_4_16_exempt',
      budgetEligible: true,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    expect(listAssistServices(TENANT_B).some((entry) => entry.serviceKey === 'ISO-001')).toBe(true);
    expect(listAssistServices(TENANT_A).some((entry) => entry.serviceKey === 'ISO-001')).toBe(false);

    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');

    expect(canUseAssistServiceCatalogInCurrentMode()).toBe(false);
    expect(isAssistServiceCatalogLiveReady()).toBe(false);
    expect(isAssistServiceCatalogWiringPrepared()).toBe(true);

    const liveBlocked = fetchAssistServices(TENANT_A);
    expect(liveBlocked.ok).toBe(false);
    if (!liveBlocked.ok) {
      expect(
        liveBlocked.error.includes('Live-Modus') ||
          liveBlocked.error.includes('Produktionsmodus'),
      ).toBe(true);
    }
  });
});

describe('Assist Leistungskatalog Wiring', () => {
  it('Live-Repository referenziert Migration 0053', () => {
    const repo = readSrc('src/lib/assistServiceCatalog/assistServiceCatalogLiveRepository.ts');
    expect(repo).toContain(ASSIST_SERVICE_CATALOG_REQUIRED_MIGRATION);
    expect(repo).toContain('assist_service_catalog_items');
    expect(repo).toContain('tenant_service_rates');
  });

  it('Admin-UI ist unter Mehr → Verwaltung erreichbar', () => {
    const screen = readSrc('src/screens/admin/AssistServiceCatalogScreen.tsx');
    expect(screen).toContain('Mehr → Verwaltung → Leistungen & Aufgaben');
    expect(screen).toContain('AssistServiceCatalogHero');

    const routes = readSrc('src/lib/navigation/routes.ts');
    expect(routes).toContain('/business/office/admin/services');
    expect(routes).toContain('Leistungen & Aufgaben');
  });

  it('Live-Migrationskennung ist konsistent', () => {
    expect(ASSIST_SERVICE_CATALOG_LIVE_MIGRATION).toBe('0053_assist_service_catalog_prepared.sql');
  });
});
