import type { RoleKey, ServiceResult } from '@/types';
import type {
  FooterLayoutConfig,
  HeaderLayoutConfig,
  TenantDocumentSettings,
  TenantDocumentSettingsForm,
} from '@/types/documents/tenantDocumentSettings';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { A4_PAGE_LAYOUT } from '@/features/documents/templateEngine/a4LayoutDefaults';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { SERVICE_ERRORS } from '@/lib/services/errors';

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

type SettingsRow = Record<string, unknown>;
function object(value: unknown): SettingsRow {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as SettingsRow : {};
}
function numberOr(value: unknown, fallback: number): number {
  return value !== null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : fallback;
}

/** An unconfigured live tenant gets neutral layout defaults, never sample business data. */
function liveDefaults(tenantId: string): TenantDocumentSettings {
  const defaults = buildDefaultSettings(tenantId);
  return {
    ...defaults, id: '', updatedAt: '', logoUrl: null,
    logoNaturalWidthPx: null, logoNaturalHeightPx: null,
    primaryColor: '#1E40AF', accentColor: '#3B82F6',
    headerLayout: { ...DEFAULT_HEADER, contactPersonName: '', contactPersonEmail: '', contactPersonPhone: '' },
    defaultTaxNotice: '', defaultContractClauses: '', defaultDunningTerms: '',
    bankName: '', iban: '', bic: '',
  };
}

function fromRow(tenantId: string, row: SettingsRow): TenantDocumentSettings {
  const defaults = liveDefaults(tenantId);
  const header = object(row.header_layout);
  const footer = object(row.footer_layout);
  const documentLayout = object(header.documentLayout);
  const pageLayout = object(documentLayout.pageLayout);
  return {
    ...defaults,
    id: String(row.id ?? ''), tenantId,
    logoUrl: row.logo_url ? String(row.logo_url) : null,
    logoWidthMm: numberOr(documentLayout.logoWidthMm, defaults.logoWidthMm),
    logoNaturalWidthPx: documentLayout.logoNaturalWidthPx == null ? null : numberOr(documentLayout.logoNaturalWidthPx, 0) || null,
    logoNaturalHeightPx: documentLayout.logoNaturalHeightPx == null ? null : numberOr(documentLayout.logoNaturalHeightPx, 0) || null,
    primaryColor: String(row.primary_color ?? defaults.primaryColor),
    secondaryColor: String(row.secondary_color ?? defaults.secondaryColor),
    accentColor: String(row.accent_color ?? defaults.accentColor),
    fontFamily: String(row.font_family ?? defaults.fontFamily),
    headerLayout: { ...defaults.headerLayout, ...header } as HeaderLayoutConfig,
    footerLayout: { ...defaults.footerLayout, ...footer, byDocumentType: { ...defaults.footerLayout.byDocumentType, ...object(footer.byDocumentType) } } as FooterLayoutConfig,
    pageLayout: {
      ...defaults.pageLayout, ...pageLayout, format: 'A4', orientation: 'portrait', widthMm: 210, heightMm: 297,
      fontFamily: String(row.font_family ?? defaults.fontFamily),
      marginLeftMm: numberOr(row.default_page_margin_left_mm, defaults.pageLayout.marginLeftMm),
      marginRightMm: numberOr(row.default_page_margin_right_mm, defaults.pageLayout.marginRightMm),
      marginTopMm: numberOr(row.default_page_margin_top_mm, defaults.pageLayout.marginTopMm),
      marginBottomMm: numberOr(row.default_page_margin_bottom_mm, defaults.pageLayout.marginBottomMm),
    },
    defaultPaymentTermsDays: numberOr(row.default_payment_terms_days, defaults.defaultPaymentTermsDays),
    defaultTaxNotice: String(row.default_tax_notice ?? ''),
    defaultContractClauses: String(row.default_contract_clauses ?? ''),
    defaultDunningTerms: String(row.default_dunning_terms ?? ''),
    defaultDocumentLanguage: String(row.default_document_language ?? 'de-DE'),
    bankName: String(row.bank_name ?? ''), iban: String(row.iban ?? ''), bic: String(row.bic ?? ''),
    ciEnforcementEnabled: typeof documentLayout.ciEnforcementEnabled === 'boolean' ? documentLayout.ciEnforcementEnabled : defaults.ciEnforcementEnabled,
    updatedAt: String(row.updated_at ?? ''),
  };
}

export function validateTenantDocumentSettingsForm(form: TenantDocumentSettingsForm): string | null {
  const p = form.pageLayout;
  if (!p || !form.headerLayout || !form.footerLayout) return 'Die Dokumentgestaltung ist unvollständig.';
  const inRange = (value: number, min: number, max: number) => Number.isFinite(value) && value >= min && value <= max;
  if (!inRange(form.logoWidthMm, 5, 150)) return 'Die Logobreite muss zwischen 5 und 150 mm liegen.';
  if (![p.marginLeftMm, p.marginRightMm, p.marginTopMm, p.marginBottomMm].every(value => inRange(value, 0, 80))) return 'Die Seitenränder müssen zwischen 0 und 80 mm liegen.';
  if (p.marginLeftMm + p.marginRightMm >= 170 || p.marginTopMm + p.marginBottomMm >= 257) return 'Die Seitenränder lassen zu wenig Platz für den Dokumentinhalt.';
  if (!inRange(p.baseFontSizePt, 6, 36) || !inRange(p.headingFontSizePt, 6, 48) || !inRange(p.lineHeight, 1, 3)) return 'Bitte gültige Schriftgrößen und einen Zeilenabstand zwischen 1 und 3 angeben.';
  if (!Number.isInteger(form.defaultPaymentTermsDays) || !inRange(form.defaultPaymentTermsDays, 0, 365)) return 'Das Zahlungsziel muss zwischen 0 und 365 Tagen liegen.';
  if (![form.primaryColor, form.secondaryColor, form.accentColor].every(color => /^#[0-9a-f]{6}$/i.test(color))) return 'Bitte Farben im Format #RRGGBB angeben.';
  if (!form.fontFamily?.trim() || /[<>{};\n\r]/.test(form.fontFamily)) return 'Die Schriftfamilie enthält ungültige Zeichen.';
  if (form.logoUrl) {
    try { if (new URL(form.logoUrl).protocol !== 'https:') return 'Bitte eine sichere https-Adresse für das Logo verwenden.'; }
    catch { return 'Die Logo-Adresse ist ungültig.'; }
  }
  return null;
}

function toRow(tenantId: string, form: TenantDocumentSettingsForm): SettingsRow {
  // These additional layout fields belong in the existing JSON column; no new schema is required.
  return {
    tenant_id: tenantId, logo_url: form.logoUrl?.trim() || null,
    primary_color: form.primaryColor, secondary_color: form.secondaryColor, accent_color: form.accentColor,
    font_family: form.fontFamily,
    header_layout: {
      ...form.headerLayout,
      documentLayout: {
        ...object(object(form.headerLayout).documentLayout),
        logoWidthMm: form.logoWidthMm, logoNaturalWidthPx: form.logoNaturalWidthPx, logoNaturalHeightPx: form.logoNaturalHeightPx,
        pageLayout: { ...form.pageLayout, fontFamily: form.fontFamily }, ciEnforcementEnabled: form.ciEnforcementEnabled,
      },
    },
    footer_layout: form.footerLayout,
    default_page_margin_left_mm: form.pageLayout.marginLeftMm,
    default_page_margin_right_mm: form.pageLayout.marginRightMm,
    default_page_margin_top_mm: form.pageLayout.marginTopMm,
    default_page_margin_bottom_mm: form.pageLayout.marginBottomMm,
    default_payment_terms_days: form.defaultPaymentTermsDays,
    default_tax_notice: form.defaultTaxNotice, default_contract_clauses: form.defaultContractClauses,
    default_dunning_terms: form.defaultDunningTerms, default_document_language: form.defaultDocumentLanguage,
    bank_name: form.bankName, iban: form.iban, bic: form.bic,
    updated_at: new Date().toISOString(),
  };
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

  if (getServiceMode() === 'supabase') {
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
    try {
      const { data, error } = await fromUnknownTable(client, 'tenant_document_settings').select('*').eq('tenant_id', tenantId).maybeSingle();
      if (error) return { ok: false, error: toGermanSupabaseError(error) };
      return { ok: true, data: data ? fromRow(tenantId, data) : liveDefaults(tenantId) };
    } catch { return { ok: false, error: 'Die Dokumentgestaltung konnte nicht geladen werden. Bitte erneut versuchen.' }; }
  }
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

  if (getServiceMode() === 'supabase') {
    const invalid = validateTenantDocumentSettingsForm(form);
    if (invalid) return { ok: false, error: invalid };
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
    try {
      const { data, error } = await fromUnknownTable(client, 'tenant_document_settings')
        .upsert(toRow(tenantId, form), { onConflict: 'tenant_id', defaultToNull: false })
        .select('*').single();
      if (error) return { ok: false, error: toGermanSupabaseError(error) };
      if (!data) return { ok: false, error: 'Die gespeicherte Dokumentgestaltung konnte nicht bestätigt werden.' };
      return { ok: true, data: fromRow(tenantId, data) };
    } catch { return { ok: false, error: 'Die Dokumentgestaltung konnte nicht gespeichert werden. Bitte erneut versuchen.' }; }
  }
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
