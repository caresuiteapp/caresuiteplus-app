import type { RoleKey, ServiceResult } from '@/types';
import type {
  FooterLayoutConfig,
  HeaderLayoutConfig,
  TenantDocumentSettings,
  TenantDocumentSettingsForm,
} from '@/types/documents/tenantDocumentSettings';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { A4_PAGE_LAYOUT } from '@/features/documents/templateEngine/a4LayoutDefaults';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';

const DEMO_STORE = new Map<string, TenantDocumentSettings>();

const DEFAULT_HEADER: HeaderLayoutConfig = {
  logoPosition: 'left',
  showCompanyName: true,
  showBrandLine: true,
  showSlogan: false,
  showDocumentType: true,
  showAccentLine: true,
  showDocumentNumber: true,
  showPageNumber: false,
  contactPersonName: 'Sabine Muster',
  contactPersonEmail: 'info@demo-pflege.de',
  contactPersonPhone: '+49 30 123456',
};

const DEFAULT_FOOTER: FooterLayoutConfig = {
  showPageNumber: true,
  showMandatoryDisclosures: true,
  byDocumentType: {
    invoice: {
      enabled: true,
      showBankDetails: true,
      bankRequired: true,
      showMandatoryDisclosures: true,
    },
    business_letter: {
      enabled: true,
      showBankDetails: false,
      bankRequired: false,
      showMandatoryDisclosures: true,
    },
    contract: {
      enabled: true,
      showBankDetails: false,
      bankRequired: false,
      showMandatoryDisclosures: true,
    },
  },
};

function buildDefaultSettings(tenantId: string, overrides?: Partial<TenantDocumentSettingsForm>): TenantDocumentSettings {
  const base: TenantDocumentSettings = {
    id: `tds-${tenantId.slice(0, 8)}`,
    tenantId,
    logoUrl: null,
    logoWidthMm: 45,
    logoNaturalWidthPx: 300,
    logoNaturalHeightPx: 100,
    primaryColor: tenantId === DEMO_TENANT_ID ? '#1E40AF' : '#047857',
    secondaryColor: '#334155',
    accentColor: tenantId === DEMO_TENANT_ID ? '#3B82F6' : '#10B981',
    fontFamily: A4_PAGE_LAYOUT.fontFamily,
    headerLayout: { ...DEFAULT_HEADER },
    footerLayout: JSON.parse(JSON.stringify(DEFAULT_FOOTER)) as FooterLayoutConfig,
    pageLayout: { ...A4_PAGE_LAYOUT },
    defaultPaymentTermsDays: 14,
    defaultTaxNotice: 'Gemäß §19 UStG wird keine Umsatzsteuer ausgewiesen.',
    defaultContractClauses: 'Standardvertragsklauseln gemäß Mandantenvorlage.',
    defaultDunningTerms: 'Zahlungserinnerung nach 7 Tagen, Mahnung nach 14 Tagen.',
    defaultDocumentLanguage: 'de-DE',
    bankName: 'Sparkasse Berlin',
    iban: 'DE89370400440532013000',
    bic: 'COBADEFFXXX',
    ciEnforcementEnabled: true,
    updatedAt: new Date().toISOString(),
  };

  if (tenantId === DEMO_TENANT_ID) {
    base.logoUrl = 'https://example.com/demo-logo.png';
    base.primaryColor = '#1E40AF';
    base.accentColor = '#3B82F6';
  }

  if (overrides) {
    return { ...base, ...overrides, updatedAt: new Date().toISOString() };
  }
  return base;
}

function ensureDemoSettings(tenantId: string): TenantDocumentSettings {
  if (!DEMO_STORE.has(tenantId)) {
    DEMO_STORE.set(tenantId, buildDefaultSettings(tenantId));
  }
  return DEMO_STORE.get(tenantId)!;
}

async function demoDelay(ms = 160): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

export async function fetchTenantDocumentSettings(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantDocumentSettings>> {
  const denied = enforcePermission<TenantDocumentSettings>(actorRoleKey, 'office.catalogs.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  await demoDelay();
  return { ok: true, data: ensureDemoSettings(tenantId) };
}

export async function saveTenantDocumentSettings(
  tenantId: string,
  form: TenantDocumentSettingsForm,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantDocumentSettings>> {
  const denied = enforcePermission<TenantDocumentSettings>(actorRoleKey, 'office.catalogs.edit');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  await demoDelay();

  const next: TenantDocumentSettings = {
    id: `tds-${tenantId.slice(0, 8)}`,
    tenantId,
    ...form,
    updatedAt: new Date().toISOString(),
  };
  DEMO_STORE.set(tenantId, next);
  return { ok: true, data: next };
}

/** Wendet Mandanten-CI auf DocumentContext company/invoice Defaults an. */
export function mergeTenantSettingsIntoContext(
  context: import('@/features/documents/templateEngine/types').DocumentContext,
  settings: TenantDocumentSettings,
): import('@/features/documents/templateEngine/types').DocumentContext {
  return {
    ...context,
    company: {
      ...context.company,
      bank_name: context.company.bank_name ?? settings.bankName,
      iban: context.company.iban ?? settings.iban,
      bic: context.company.bic ?? settings.bic,
    },
    invoice: {
      ...context.invoice,
      tax_notice: context.invoice.tax_notice ?? settings.defaultTaxNotice,
      due_date: context.invoice.due_date,
    },
    contract: {
      ...context.contract,
      privacy_clause: context.contract.privacy_clause ?? settings.defaultContractClauses,
    },
  };
}

/** Nur für Tests — Demo-Store zurücksetzen. */
export function resetTenantDocumentSettingsStore(): void {
  DEMO_STORE.clear();
}

export function seedTenantDocumentSettingsForTest(
  tenantId: string,
  overrides?: Partial<TenantDocumentSettingsForm>,
): TenantDocumentSettings {
  const settings = buildDefaultSettings(tenantId, overrides);
  DEMO_STORE.set(tenantId, settings);
  return settings;
}
