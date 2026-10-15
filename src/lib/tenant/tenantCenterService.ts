import { Platform } from 'react-native';
import type { RoleKey, ServiceResult } from '@/types';
import type {
  TenantAuditLogEntry,
  TenantBankAccount,
  TenantBrandingProfile,
  TenantCenterSnapshot,
  TenantCompanyProfile,
  TenantContactCommunication,
  TenantLegalProfile,
  TenantModuleSettings,
  TenantPaymentTerms,
  TenantRegisterProfile,
  TenantRepresentative,
  TenantTaxProfile,
} from '@/types/tenant/tenantCenter';
import {
  DEFAULT_TENANT_MODULES,
  EMPTY_TENANT_BRANDING,
  EMPTY_TENANT_COMPANY,
  EMPTY_TENANT_LEGAL,
  EMPTY_TENANT_PAYMENT,
  EMPTY_TENANT_REGISTER,
  EMPTY_TENANT_TAX,
} from '@/types/tenant/tenantCenter';
import { demoTenant, demoTenantAddress, DEMO_TENANT_ID } from '@/data/demo/tenant';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant, isLiveServiceMode } from '@/lib/services/liveServiceGuard';
import { formatHourlyRateDocumentAmount } from '@/lib/formatters/numberFormatters';
import { TENANT_SETTINGS_PERMISSION } from './tenantSettingsRoute';
import { canManageTenantModuleSettings } from './tenantModuleSettingsPermissions';
import { buildTenantCenterSections } from './tenantCenterSections';
import {
  setTenantModuleSettingsCache,
} from './tenantModuleSettingsCache';
import { syncModuleAccessFromTenantSettings } from './syncTenantModuleAccess';
import {
  fetchTenantServiceCatalog,
  formatCatalogSummary,
  seedTenantServiceCatalogIfEmpty,
} from './tenantServiceCatalogService';
import { fetchTenantCustomFieldDefinitions } from './tenantCustomFieldService';
import { normalizeIban, normalizeVatId, validateEmail, validateIban, validateVatId } from './tenantValidation';

const DEMO_STORE = new Map<string, TenantCenterSnapshot>();
let demoRowSequence = 0;

/** Omitted rows are retained; only removals selected in the editor may be deleted. */
export type TenantRowsSaveOptions = { removedIds?: readonly string[] };

function mergeDemoRows<T extends { id?: string }>(previous: T[], next: T[], options?: TenantRowsSaveOptions): T[] {
  const removed = new Set(options?.removedIds ?? []);
  const updated = new Set(next.map(row => row.id).filter(Boolean));
  return [
    ...previous.filter(row => row.id && !removed.has(row.id) && !updated.has(row.id)),
    ...next.map(row => ({ ...structuredClone(row), id: row.id ?? `demo-tenant-row-${++demoRowSequence}` })),
  ];
}

async function webWriteGuard(tenantId: string, _roleKey?: RoleKey | null): Promise<{ ok: false; error: string } | null> {
  if (Platform.OS !== 'web') return null;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (!isLiveServiceMode()) return { ok: false, error: 'Die Unternehmensakte benötigt eine aktive Datenbankverbindung. Es werden keine Beispieldaten verwendet.' };
  try {
    const { loadCompanyAccess } = await import('./companyAccessService.web');
    const access = await loadCompanyAccess(tenantId);
    if (!access.ok) return access;
    if (access.data.scopeLimited || !access.data.permissions.includes(TENANT_SETTINGS_PERMISSION)) {
      return { ok: false, error: 'Für die unternehmensweiten Stammdaten fehlt Ihnen die Berechtigung.' };
    }
    return null;
  } catch { return { ok: false, error: 'Die Berechtigung für die Unternehmensakte konnte nicht geprüft werden. Bitte erneut versuchen.' }; }
}

function saveWebDemoSection<K extends 'legal' | 'tax' | 'register' | 'representatives' | 'bankAccounts'>(
  tenantId: string,
  key: K,
  value: TenantCenterSnapshot[K],
): ServiceResult<TenantCenterSnapshot> {
  const snapshot = ensureDemoSnapshot(tenantId);
  snapshot[key] = structuredClone(value);
  snapshot.updatedAt = new Date().toISOString();
  snapshot.sections = buildTenantCenterSections(snapshot);
  return { ok: true, data: snapshot };
}

function incompleteSave(error: string): { ok: false; error: string } {
  const message = 'Die Änderungen wurden nicht vollständig gespeichert.';
  return { ok: false, error: error.startsWith(message) ? error : `${message} Bitte die Daten neu laden, bevor Sie erneut speichern. ${error}` };
}

async function reloadAfterWebSave(tenantId: string, roleKey?: RoleKey | null): Promise<ServiceResult<TenantCenterSnapshot>> {
  const result = await fetchTenantCenter(tenantId, roleKey);
  return result.ok ? result : incompleteSave(result.error);
}

const TENANT_COLUMNS =
  'id, name, legal_name, legal_form, industry, street, house_number, postal_code, city, country, phone, fax, email, website, notes, tax_number, vat_id, register_court, register_number, ik_number, supervisory_authority, billing_email, representative_name, representative_position, updated_at';

function parseDemoStreet(streetLine: string): { street: string; houseNumber: string } {
  const match = streetLine.trim().match(/^(.+?)\s+(\d+\w*)$/);
  if (!match) return { street: streetLine.trim(), houseNumber: '' };
  return { street: match[1].trim(), houseNumber: match[2].trim() };
}

function buildDemoSnapshot(tenantId: string): TenantCenterSnapshot {
  const parsedStreet = parseDemoStreet(demoTenantAddress.street);
  const company: TenantCompanyProfile = {
    ...EMPTY_TENANT_COMPANY,
    name: demoTenant.name,
    legalName: demoTenant.name,
    street: parsedStreet.street,
    houseNumber: parsedStreet.houseNumber,
    zip: demoTenantAddress.zip,
    city: demoTenantAddress.city,
    country: demoTenantAddress.country,
    phone: demoTenant.phone ?? '',
    email: demoTenant.email ?? '',
    website: demoTenant.website ?? '',
  };
  const branding: TenantBrandingProfile = {
    ...EMPTY_TENANT_BRANDING,
    logoUrl: tenantId === DEMO_TENANT_ID ? 'https://example.com/demo-logo.png' : '',
  };
  const snapshot: TenantCenterSnapshot = {
    tenantId,
    updatedAt: demoTenant.updatedAt,
    company,
    legal: { ...EMPTY_TENANT_LEGAL },
    tax: { ...EMPTY_TENANT_TAX },
    register: { ...EMPTY_TENANT_REGISTER },
    contact: {
      billingEmail: demoTenant.email ?? '',
      supportEmail: demoTenant.email ?? '',
      supportPhone: demoTenant.phone ?? '',
      contactPersons: [],
    },
    representatives: [],
    bankAccounts: [],
    payment: { ...EMPTY_TENANT_PAYMENT },
    branding,
    modules: { ...DEFAULT_TENANT_MODULES },
    catalogSummary: 'Assist: Alltagsbegleitung 38,00 €/Std.',
    catalogItems: [],
    customFields: [],
    auditLogs: [],
    assistDefaultHourlyRate: '38,00',
    sections: [],
  };
  snapshot.sections = buildTenantCenterSections(snapshot);
  setTenantModuleSettingsCache(tenantId, snapshot.modules);
  return snapshot;
}

function ensureDemoSnapshot(tenantId: string): TenantCenterSnapshot {
  if (!DEMO_STORE.has(tenantId)) {
    DEMO_STORE.set(tenantId, buildDemoSnapshot(tenantId));
  }
  return DEMO_STORE.get(tenantId)!;
}

function shouldUseInMemoryTenantCenterStore(): boolean {
  return !isLiveServiceMode() || !getSupabaseClient();
}

function mapTenantRow(row: Record<string, unknown>): TenantCompanyProfile {
  return {
    name: String(row.name ?? ''),
    legalName: String(row.legal_name ?? row.name ?? ''),
    legalForm: String(row.legal_form ?? ''),
    industry: String(row.industry ?? ''),
    street: String(row.street ?? ''),
    houseNumber: String(row.house_number ?? ''),
    zip: String(row.postal_code ?? ''),
    city: String(row.city ?? ''),
    country: String(row.country ?? 'Deutschland'),
    phone: String(row.phone ?? ''),
    fax: String(row.fax ?? ''),
    email: String(row.email ?? ''),
    website: String(row.website ?? ''),
    notes: String(row.notes ?? ''),
  };
}

function mapTaxFromTenant(row: Record<string, unknown>): Partial<TenantTaxProfile> {
  return {
    taxNumber: String(row.tax_number ?? ''),
    vatId: String(row.vat_id ?? ''),
  };
}

function mapRegisterFromTenant(row: Record<string, unknown>): Partial<TenantRegisterProfile> {
  return {
    registerCourt: String(row.register_court ?? ''),
    registerNumber: String(row.register_number ?? ''),
    ikNumber: String(row.ik_number ?? ''),
    supervisoryAuthority: String(row.supervisory_authority ?? ''),
  };
}

async function fetchFromSupabase(tenantId: string): Promise<ServiceResult<TenantCenterSnapshot>> {
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Supabase ist nicht konfiguriert.' };

  const { data: tenant, error: tenantError } = await client
    .from('tenants')
    .select(TENANT_COLUMNS)
    .eq('id', tenantId)
    .maybeSingle();

  if (tenantError) return { ok: false, error: toGermanSupabaseError(tenantError) };
  if (!tenant) return { ok: false, error: 'Mandant nicht gefunden.' };

  const row = tenant as Record<string, unknown>;
  const company = mapTenantRow(row);

  const [legalRes, taxRes, registerRes, billingRes, brandingRes, modulesRes, contactsRes, repsRes, banksRes, catalogRes, customRes, auditRes] =
    await Promise.all([
      fromUnknownTable(client, 'tenant_legal_profiles').select('*').eq('tenant_id', tenantId).maybeSingle(),
      fromUnknownTable(client, 'tenant_tax_profiles').select('*').eq('tenant_id', tenantId).maybeSingle(),
      fromUnknownTable(client, 'tenant_register_profiles').select('*').eq('tenant_id', tenantId).maybeSingle(),
      client.from('tenant_billing_settings').select('*').eq('tenant_id', tenantId).maybeSingle(),
      client.from('tenant_branding').select('logo_url, app_name, light_primary_color, light_accent_color').eq('tenant_id', tenantId).maybeSingle(),
      fromUnknownTable(client, 'tenant_module_settings').select('*').eq('tenant_id', tenantId).maybeSingle(),
      fromUnknownTable(client, 'tenant_contacts').select('*').eq('tenant_id', tenantId).order('is_primary', { ascending: false }),
      fromUnknownTable(client, 'tenant_representatives').select('*').eq('tenant_id', tenantId).order('sort_order'),
      fromUnknownTable(client, 'tenant_bank_accounts').select('*').eq('tenant_id', tenantId).order('sort_order'),
      fetchTenantServiceCatalog(tenantId, 'business_admin'),
      fetchTenantCustomFieldDefinitions(tenantId, 'business_admin', Platform.OS === 'web'),
      fromUnknownTable(client, 'audit_logs').select('id, action, title, description, table_name, created_at').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(50),
    ]);

  if (Platform.OS === 'web') {
    const queries = [
      ['Rechtliche Angaben', legalRes], ['Steuerdaten', taxRes], ['Registerdaten', registerRes],
      ['Zahlungsbedingungen', billingRes], ['Logo', brandingRes], ['Leistungsbereiche', modulesRes],
      ['Kontaktpersonen', contactsRes], ['Vertretung', repsRes], ['Bankverbindungen', banksRes],
      ['Änderungshistorie', auditRes],
    ] as const;
    for (const [label, result] of queries) {
      if (result.error) return { ok: false, error: `${label} konnten nicht geladen werden. ${toGermanSupabaseError(result.error)}` };
    }
    if (!catalogRes.ok) return { ok: false, error: `Leistungskatalog konnte nicht geladen werden. ${catalogRes.error}` };
    if (!customRes.ok) return { ok: false, error: `Individuelle Felder konnten nicht geladen werden. ${customRes.error}` };
  }

  const legalRow = legalRes.data as Record<string, unknown> | null;
  const legal: TenantLegalProfile = {
    ...EMPTY_TENANT_LEGAL,
    liabilityInsurance: String(legalRow?.liability_insurance ?? ''),
    liabilityInsurer: String(legalRow?.liability_insurer ?? ''),
    liabilityPolicyNumber: String(legalRow?.liability_policy_number ?? ''),
    chamberMembership: String(legalRow?.chamber_membership ?? ''),
    professionalAssociation: String(legalRow?.professional_association ?? ''),
    legalNotes: String(legalRow?.legal_notes ?? ''),
  };

  const taxRow = taxRes.data as Record<string, unknown> | null;
  const tax: TenantTaxProfile = {
    ...EMPTY_TENANT_TAX,
    ...mapTaxFromTenant(row),
    taxOffice: String(taxRow?.tax_office ?? ''),
    kleinunternehmer: Boolean(taxRow?.kleinunternehmer),
    taxScheme: (taxRow?.tax_scheme as TenantTaxProfile['taxScheme']) ?? 'standard',
    reverseCharge: Boolean(taxRow?.reverse_charge),
    taxNotes: String(taxRow?.tax_notes ?? ''),
  };

  const registerRow = registerRes.data as Record<string, unknown> | null;
  const register: TenantRegisterProfile = {
    ...EMPTY_TENANT_REGISTER,
    ...mapRegisterFromTenant(row),
    registerType: String(registerRow?.register_type ?? ''),
    registerDate: registerRow?.register_date ? String(registerRow.register_date) : '',
    shareCapital: String(registerRow?.share_capital ?? ''),
    registerNotes: String(registerRow?.register_notes ?? ''),
  };

  const billing = billingRes.data;
  const payment: TenantPaymentTerms = {
    paymentTermsDays: billing?.payment_terms_days != null ? String(billing.payment_terms_days) : '14',
    dunningAfterDays: billing?.dunning_after_days != null ? String(billing.dunning_after_days) : '14',
    dunningFee: billing?.dunning_fee != null ? String(billing.dunning_fee) : '',
    invoicePrefix: billing?.invoice_prefix ?? '',
    invoiceFooterText: billing?.invoice_footer_text ?? '',
    invoiceNotes: billing?.invoice_notes ?? '',
  };

  const brandingData = brandingRes.data;
  const branding: TenantBrandingProfile = {
    logoUrl: brandingData?.logo_url ?? '',
    appName: brandingData?.app_name ?? '',
    primaryColor: brandingData?.light_primary_color ?? '',
    accentColor: brandingData?.light_accent_color ?? '',
  };

  const modulesRow = modulesRes.data as Record<string, unknown> | null;
  const modules: TenantModuleSettings = {
    assistEnabled: modulesRow?.assist_enabled != null ? Boolean(modulesRow.assist_enabled) : true,
    pflegeEnabled: Boolean(modulesRow?.pflege_enabled),
    stationaerEnabled: Boolean(modulesRow?.stationaer_enabled),
    beratungEnabled: Boolean(modulesRow?.beratung_enabled),
  };
  setTenantModuleSettingsCache(tenantId, modules);

  const contactPersons = ((contactsRes.data ?? []) as Record<string, unknown>[]).map((c) => ({
    id: String(c.id),
    firstName: String(c.first_name ?? ''),
    lastName: String(c.last_name ?? ''),
    role: String(c.role ?? ''),
    email: String(c.email ?? ''),
    phone: String(c.phone ?? ''),
    isPrimary: Boolean(c.is_primary),
  }));

  const contact: TenantContactCommunication = {
    billingEmail: String(row.billing_email ?? row.email ?? ''),
    supportEmail: String(row.email ?? ''),
    supportPhone: String(row.phone ?? ''),
    contactPersons,
  };

  const representatives: TenantRepresentative[] = ((repsRes.data ?? []) as Record<string, unknown>[]).map((r, index) => ({
    id: String(r.id),
    salutation: String(r.salutation ?? ''),
    firstName: String(r.first_name ?? ''),
    lastName: String(r.last_name ?? ''),
    position: String(r.position ?? ''),
    email: String(r.email ?? ''),
    phone: String(r.phone ?? ''),
    isPrimary: Boolean(r.is_primary),
    sortOrder: Number(r.sort_order ?? index),
  }));

  const bankAccounts: TenantBankAccount[] = ((banksRes.data ?? []) as Record<string, unknown>[]).map((b, index) => ({
    id: String(b.id),
    label: String(b.label ?? ''),
    accountHolder: String(b.account_holder ?? ''),
    bankName: String(b.bank_name ?? ''),
    iban: String(b.iban ?? ''),
    bic: String(b.bic ?? ''),
    isPrimary: Boolean(b.is_primary),
    sortOrder: Number(b.sort_order ?? index),
  }));

  const catalogItems = catalogRes.ok ? catalogRes.data.items : [];
  const catalogSummary = catalogRes.ok ? formatCatalogSummary(catalogRes.data.items) : '';
  const assistRate =
    catalogItems.find((item) => item.serviceKey === 'assist.alltagsbegleitung')?.defaultPriceNet ??
    billing?.default_hourly_rate ??
    null;

  const customFields = customRes.ok ? customRes.data : [];
  const auditLogs: TenantAuditLogEntry[] = ((auditRes.data ?? []) as Record<string, unknown>[]).map((a) => ({
    id: String(a.id),
    action: String(a.action ?? ''),
    title: a.title ? String(a.title) : null,
    description: a.description ? String(a.description) : null,
    tableName: a.table_name ? String(a.table_name) : null,
    createdAt: String(a.created_at),
  }));

  const snapshot: TenantCenterSnapshot = {
    tenantId,
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
    company,
    legal,
    tax,
    register,
    contact,
    representatives,
    bankAccounts,
    payment,
    branding,
    modules,
    catalogSummary,
    catalogItems,
    customFields,
    auditLogs,
    assistDefaultHourlyRate: assistRate != null ? formatHourlyRateDocumentAmount(assistRate) : '',
    sections: [],
  };
  snapshot.sections = buildTenantCenterSections(snapshot);
  setTenantModuleSettingsCache(tenantId, snapshot.modules);
  return { ok: true, data: snapshot };
}

export async function fetchTenantCenter(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantCenterSnapshot>> {
  const webDenied = await webWriteGuard(tenantId, actorRoleKey);
  if (webDenied) return webDenied;
  const denied = Platform.OS === 'web' ? null : enforcePermission<TenantCenterSnapshot>(actorRoleKey, TENANT_SETTINGS_PERMISSION);
  if (denied) return { ok: false, error: denied.ok ? 'Keine Berechtigung.' : denied.error };
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (isLiveServiceMode()) {
    return fetchFromSupabase(tenantId);
  }
  return { ok: true, data: ensureDemoSnapshot(tenantId) };
}

export async function saveTenantCompanyProfile(
  tenantId: string,
  profile: TenantCompanyProfile,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantCenterSnapshot>> {
  const webDenied = await webWriteGuard(tenantId, actorRoleKey);
  if (webDenied) return webDenied;
  const denied = Platform.OS === 'web' ? null : enforcePermission<TenantCenterSnapshot>(actorRoleKey, TENANT_SETTINGS_PERMISSION);
  if (denied) return denied;
  if (!profile.name.trim()) return { ok: false, error: 'Firmenname ist erforderlich.' };
  const emailError = validateEmail(profile.email);
  if (emailError) return { ok: false, error: emailError };

  if (!isLiveServiceMode()) {
    const snap = ensureDemoSnapshot(tenantId);
    snap.company = Platform.OS === 'web' ? structuredClone(profile) : profile;
    if (Platform.OS === 'web') snap.contact = { ...snap.contact, supportEmail: profile.email, supportPhone: profile.phone };
    snap.updatedAt = new Date().toISOString();
    snap.sections = buildTenantCenterSections(snap);
    DEMO_STORE.set(tenantId, snap);
    return { ok: true, data: snap };
  }

  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Supabase ist nicht konfiguriert.' };

  const update = client
    .from('tenants')
    .update({
      name: profile.name.trim(),
      legal_name: profile.legalName.trim() || profile.name.trim(),
      legal_form: profile.legalForm.trim() || null,
      industry: profile.industry.trim() || null,
      street: profile.street.trim() || null,
      house_number: profile.houseNumber.trim() || null,
      postal_code: profile.zip.trim() || null,
      city: profile.city.trim() || null,
      country: profile.country.trim() || 'Deutschland',
      phone: profile.phone.trim() || null,
      fax: profile.fax.trim() || null,
      email: profile.email.trim() || null,
      website: profile.website.trim() || null,
      notes: profile.notes.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tenantId);

  const { data, error } = Platform.OS === 'web' ? await update.select('id').maybeSingle() : await update;

  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  if (Platform.OS === 'web' && !data) return { ok: false, error: 'Unternehmensdaten konnten nicht gespeichert werden. Bitte Zugriff und Mandant prüfen.' };
  return Platform.OS === 'web' ? reloadAfterWebSave(tenantId, actorRoleKey) : fetchTenantCenter(tenantId, actorRoleKey);
}

export async function saveTenantLegalProfile(
  tenantId: string,
  profile: TenantLegalProfile,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantCenterSnapshot>> {
  const webDenied = await webWriteGuard(tenantId, actorRoleKey);
  if (webDenied) return webDenied;
  if (Platform.OS === 'web' && !isLiveServiceMode()) return saveWebDemoSection(tenantId, 'legal', profile);
  return upsertProfileTable(tenantId, 'tenant_legal_profiles', {
    liability_insurance: profile.liabilityInsurance.trim() || null,
    liability_insurer: profile.liabilityInsurer.trim() || null,
    liability_policy_number: profile.liabilityPolicyNumber.trim() || null,
    chamber_membership: profile.chamberMembership.trim() || null,
    professional_association: profile.professionalAssociation.trim() || null,
    legal_notes: profile.legalNotes.trim() || null,
    updated_at: new Date().toISOString(),
  }, actorRoleKey);
}

export async function saveTenantTaxProfile(
  tenantId: string,
  profile: TenantTaxProfile,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantCenterSnapshot>> {
  const webDenied = await webWriteGuard(tenantId, actorRoleKey);
  if (webDenied) return webDenied;
  const vatError = validateVatId(profile.vatId);
  if (vatError) return { ok: false, error: vatError };
  if (Platform.OS === 'web' && !isLiveServiceMode()) return saveWebDemoSection(tenantId, 'tax', profile);

  if (isLiveServiceMode()) {
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: 'Supabase ist nicht konfiguriert.' };
    const update = client.from('tenants').update({
      tax_number: profile.taxNumber.trim() || null,
      vat_id: profile.vatId.trim() ? normalizeVatId(profile.vatId) : null,
      updated_at: new Date().toISOString(),
    }).eq('id', tenantId);
    if (Platform.OS === 'web') {
      const { data, error } = await update.select('id').maybeSingle();
      if (error) return { ok: false, error: toGermanSupabaseError(error) };
      if (!data) return { ok: false, error: 'Steuerdaten konnten nicht gespeichert werden. Bitte Zugriff und Mandant prüfen.' };
    } else {
      await update;
    }
  }

  const saved = await upsertProfileTable(tenantId, 'tenant_tax_profiles', {
    tax_office: profile.taxOffice.trim() || null,
    kleinunternehmer: profile.kleinunternehmer,
    tax_scheme: profile.taxScheme,
    reverse_charge: profile.reverseCharge,
    tax_notes: profile.taxNotes.trim() || null,
    updated_at: new Date().toISOString(),
  }, actorRoleKey);
  return Platform.OS === 'web' && !saved.ok ? incompleteSave(saved.error) : saved;
}

export async function saveTenantRegisterProfile(
  tenantId: string,
  profile: TenantRegisterProfile,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantCenterSnapshot>> {
  const webDenied = await webWriteGuard(tenantId, actorRoleKey);
  if (webDenied) return webDenied;
  if (Platform.OS === 'web' && !isLiveServiceMode()) return saveWebDemoSection(tenantId, 'register', profile);
  if (isLiveServiceMode()) {
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: 'Supabase ist nicht konfiguriert.' };
    const update = client.from('tenants').update({
      register_court: profile.registerCourt.trim() || null,
      register_number: profile.registerNumber.trim() || null,
      ik_number: profile.ikNumber.trim() || null,
      supervisory_authority: profile.supervisoryAuthority.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', tenantId);
    if (Platform.OS === 'web') {
      const { data, error } = await update.select('id').maybeSingle();
      if (error) return { ok: false, error: toGermanSupabaseError(error) };
      if (!data) return { ok: false, error: 'Registerdaten konnten nicht gespeichert werden. Bitte Zugriff und Mandant prüfen.' };
    } else {
      await update;
    }
  }

  const saved = await upsertProfileTable(tenantId, 'tenant_register_profiles', {
    register_type: profile.registerType.trim() || null,
    register_date: profile.registerDate.trim() || null,
    share_capital: profile.shareCapital.trim() || null,
    register_notes: profile.registerNotes.trim() || null,
    updated_at: new Date().toISOString(),
  }, actorRoleKey);
  return Platform.OS === 'web' && !saved.ok ? incompleteSave(saved.error) : saved;
}

export async function saveTenantContactProfile(
  tenantId: string,
  contact: TenantContactCommunication,
  actorRoleKey?: RoleKey | null,
  options?: TenantRowsSaveOptions,
): Promise<ServiceResult<TenantCenterSnapshot>> {
  const webDenied = await webWriteGuard(tenantId, actorRoleKey);
  if (webDenied) return webDenied;
  const emailError = validateEmail(contact.billingEmail) ?? validateEmail(contact.supportEmail);
  if (emailError) return { ok: false, error: emailError };
  if (Platform.OS === 'web') {
    for (const person of contact.contactPersons) {
      if (!person.firstName.trim() && !person.lastName.trim()) return { ok: false, error: 'Bitte einen Namen für jede Kontaktperson eingeben.' };
      const personError = validateEmail(person.email);
      if (personError) return { ok: false, error: `Kontaktperson: ${personError}` };
    }
  }

  if (!isLiveServiceMode()) {
    const snap = ensureDemoSnapshot(tenantId);
    snap.contact = Platform.OS === 'web'
      ? { ...structuredClone(contact), contactPersons: mergeDemoRows(snap.contact.contactPersons, contact.contactPersons, options) }
      : contact;
    if (Platform.OS === 'web') {
      snap.company = { ...snap.company, email: contact.supportEmail, phone: contact.supportPhone };
      snap.updatedAt = new Date().toISOString();
    }
    snap.sections = buildTenantCenterSections(snap);
    return { ok: true, data: snap };
  }

  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Supabase ist nicht konfiguriert.' };

  if (Platform.OS === 'web') {
    const saved = await saveWebRows(tenantId, 'tenant_contacts', contact.contactPersons.map(person => ({
      ...(person.id ? { id: person.id } : {}),
      first_name: person.firstName.trim(), last_name: person.lastName.trim(), role: person.role.trim(),
      email: person.email.trim(), phone: person.phone.trim() || null, is_primary: person.isPrimary,
    })), actorRoleKey, options);
    if (!saved.ok) return saved;
    const blocked = await webWriteGuard(tenantId, actorRoleKey);
    if (blocked) return incompleteSave(blocked.error);
  }

  const update = client.from('tenants').update({
    billing_email: contact.billingEmail.trim() || null,
    email: contact.supportEmail.trim() || null,
    phone: contact.supportPhone.trim() || null,
    updated_at: new Date().toISOString(),
  }).eq('id', tenantId);

  if (Platform.OS === 'web') {
    const { data, error } = await update.select('id').maybeSingle();
    if (error) return incompleteSave(toGermanSupabaseError(error));
    if (!data) return incompleteSave('Kontaktdaten konnten nicht aktualisiert werden. Bitte Zugriff und Mandant prüfen.');
    return reloadAfterWebSave(tenantId, actorRoleKey);
  }
  await update;

  return fetchTenantCenter(tenantId, actorRoleKey);
}

export async function saveTenantRepresentatives(
  tenantId: string,
  representatives: TenantRepresentative[],
  actorRoleKey?: RoleKey | null,
  options?: TenantRowsSaveOptions,
): Promise<ServiceResult<TenantCenterSnapshot>> {
  const webDenied = await webWriteGuard(tenantId, actorRoleKey);
  if (webDenied) return webDenied;
  for (const rep of representatives) {
    if (Platform.OS === 'web' && !rep.firstName.trim() && !rep.lastName.trim()) return { ok: false, error: 'Bitte einen Namen für jede vertretungsberechtigte Person eingeben.' };
    const err = validateEmail(rep.email);
    if (err) return { ok: false, error: err };
  }
  if (Platform.OS === 'web' && !isLiveServiceMode()) {
    return saveWebDemoSection(tenantId, 'representatives', mergeDemoRows(ensureDemoSnapshot(tenantId).representatives, representatives, options));
  }
  return replaceMultiRow(tenantId, 'tenant_representatives', representatives.map((r, index) => ({
    ...(Platform.OS === 'web' && r.id ? { id: r.id } : {}),
    salutation: r.salutation.trim() || null,
    first_name: r.firstName.trim(),
    last_name: r.lastName.trim(),
    position: r.position.trim() || null,
    email: r.email.trim() || null,
    phone: r.phone.trim() || null,
    is_primary: r.isPrimary,
    sort_order: index,
    updated_at: new Date().toISOString(),
  })), actorRoleKey, options);
}

export async function saveTenantBankAccounts(
  tenantId: string,
  accounts: TenantBankAccount[],
  actorRoleKey?: RoleKey | null,
  options?: TenantRowsSaveOptions,
): Promise<ServiceResult<TenantCenterSnapshot>> {
  const webDenied = await webWriteGuard(tenantId, actorRoleKey);
  if (webDenied) return webDenied;
  for (const account of accounts) {
    if (Platform.OS === 'web' && (!account.accountHolder.trim() || !account.iban.trim())) return { ok: false, error: 'Kontoinhaber und IBAN sind für jede Bankverbindung erforderlich.' };
    const err = validateIban(account.iban);
    if (err) return { ok: false, error: err };
  }
  if (Platform.OS === 'web' && !isLiveServiceMode()) {
    return saveWebDemoSection(tenantId, 'bankAccounts', mergeDemoRows(ensureDemoSnapshot(tenantId).bankAccounts, accounts, options));
  }
  return replaceMultiRow(tenantId, 'tenant_bank_accounts', accounts.map((a, index) => ({
    ...(Platform.OS === 'web' && a.id ? { id: a.id } : {}),
    label: a.label.trim() || null,
    account_holder: a.accountHolder.trim() || null,
    bank_name: a.bankName.trim() || null,
    iban: a.iban.trim() ? normalizeIban(a.iban) : null,
    bic: a.bic.trim() || null,
    is_primary: a.isPrimary,
    sort_order: index,
    updated_at: new Date().toISOString(),
  })), actorRoleKey, options);
}

export async function saveTenantPaymentTerms(
  tenantId: string,
  payment: TenantPaymentTerms,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantCenterSnapshot>> {
  const webDenied = await webWriteGuard(tenantId, actorRoleKey);
  if (webDenied) return webDenied;
  const denied = Platform.OS === 'web' ? null : enforcePermission<TenantCenterSnapshot>(actorRoleKey, TENANT_SETTINGS_PERMISSION);
  if (denied) return denied;
  if (Platform.OS === 'web') {
    for (const value of [payment.paymentTermsDays, payment.dunningAfterDays]) {
      if (!/^\d+$/.test(value.trim()) || Number(value) > 3650) return { ok: false, error: 'Zahlungs- und Mahnfrist müssen ganze Tage zwischen 0 und 3650 sein.' };
    }
    if (payment.dunningFee.trim() && (!/^\d+(?:[.,]\d{1,2})?$/.test(payment.dunningFee.trim()) || !Number.isFinite(Number(payment.dunningFee.replace(',', '.'))))) {
      return { ok: false, error: 'Die Mahngebühr muss ein gültiger Betrag ab 0 mit höchstens zwei Nachkommastellen sein.' };
    }
  }

  if (!isLiveServiceMode()) {
    const snap = ensureDemoSnapshot(tenantId);
    snap.payment = Platform.OS === 'web' ? structuredClone(payment) : payment;
    if (Platform.OS === 'web') snap.updatedAt = new Date().toISOString();
    snap.sections = buildTenantCenterSections(snap);
    return { ok: true, data: snap };
  }

  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Supabase ist nicht konfiguriert.' };

  const upsert = client.from('tenant_billing_settings').upsert({
    tenant_id: tenantId,
    payment_terms_days: Platform.OS === 'web' ? Number(payment.paymentTermsDays) : Number.parseInt(payment.paymentTermsDays, 10) || 14,
    dunning_after_days: Platform.OS === 'web' ? Number(payment.dunningAfterDays) : Number.parseInt(payment.dunningAfterDays, 10) || 14,
    dunning_fee: payment.dunningFee.trim() ? Number.parseFloat(payment.dunningFee.replace(',', '.')) : null,
    invoice_prefix: payment.invoicePrefix.trim() || null,
    invoice_footer_text: payment.invoiceFooterText.trim() || null,
    invoice_notes: payment.invoiceNotes.trim() || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'tenant_id' });

  const { data, error } = Platform.OS === 'web' ? await upsert.select('tenant_id').maybeSingle() : await upsert;
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  if (Platform.OS === 'web' && !data) return { ok: false, error: 'Zahlungsbedingungen konnten nicht gespeichert werden.' };
  return Platform.OS === 'web' ? reloadAfterWebSave(tenantId, actorRoleKey) : fetchTenantCenter(tenantId, actorRoleKey);
}

export async function saveTenantModuleSettings(
  tenantId: string,
  modules: TenantModuleSettings,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantCenterSnapshot>> {
  const webDenied = await webWriteGuard(tenantId, actorRoleKey);
  if (webDenied) return webDenied;
  const denied = Platform.OS === 'web' ? null : canManageTenantModuleSettings(actorRoleKey);
  if (denied) {
    return { ok: false, error: denied.ok ? 'Keine Berechtigung.' : denied.error };
  }
  if (Platform.OS === 'web') {
    const tenantBlock = guardServiceTenant(tenantId);
    if (tenantBlock) return tenantBlock;
    if (isLiveServiceMode() && !getSupabaseClient()) return { ok: false, error: 'Supabase ist nicht konfiguriert.' };
  }

  if (shouldUseInMemoryTenantCenterStore()) {
    const snap = ensureDemoSnapshot(tenantId);
    snap.modules = { ...modules };
    snap.updatedAt = new Date().toISOString();
    snap.sections = buildTenantCenterSections(snap);
    DEMO_STORE.set(tenantId, snap);
    setTenantModuleSettingsCache(tenantId, snap.modules);
    syncModuleAccessFromTenantSettings(tenantId, snap.modules);
    return { ok: true, data: snap };
  }

  const result = await upsertProfileTable(tenantId, 'tenant_module_settings', {
    assist_enabled: modules.assistEnabled,
    pflege_enabled: modules.pflegeEnabled,
    stationaer_enabled: modules.stationaerEnabled,
    beratung_enabled: modules.beratungEnabled,
    updated_at: new Date().toISOString(),
  }, actorRoleKey);

  if (!result.ok) return { ok: false, error: result.error };
  setTenantModuleSettingsCache(tenantId, modules);
  syncModuleAccessFromTenantSettings(tenantId, modules);
  return fetchTenantCenter(tenantId, actorRoleKey);
}

export async function ensureTenantCatalogSeeded(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantCenterSnapshot>> {
  const webDenied = await webWriteGuard(tenantId, actorRoleKey);
  if (webDenied) return webDenied;
  if (isLiveServiceMode()) {
    const result = await seedTenantServiceCatalogIfEmpty(tenantId);
    if (Platform.OS === 'web' && !result.ok) return result;
  }
  return fetchTenantCenter(tenantId, actorRoleKey);
}

async function upsertProfileTable(
  tenantId: string,
  table: string,
  payload: Record<string, unknown>,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantCenterSnapshot>> {
  const webDenied = await webWriteGuard(tenantId, actorRoleKey);
  if (webDenied) return webDenied;
  const denied = Platform.OS === 'web' ? null : enforcePermission<TenantCenterSnapshot>(actorRoleKey, TENANT_SETTINGS_PERMISSION);
  if (denied) return denied;

  if (!isLiveServiceMode()) {
    return fetchTenantCenter(tenantId, actorRoleKey);
  }

  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Supabase ist nicht konfiguriert.' };

  const upsert = fromUnknownTable(client, table).upsert(
    { tenant_id: tenantId, ...payload },
    { onConflict: 'tenant_id' },
  );
  const { data, error } = Platform.OS === 'web' ? await upsert.select('tenant_id').maybeSingle() : await upsert;
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  if (Platform.OS === 'web' && !data) return { ok: false, error: 'Die Angaben konnten nicht gespeichert werden. Bitte Zugriff und Mandant prüfen.' };
  return Platform.OS === 'web' ? reloadAfterWebSave(tenantId, actorRoleKey) : fetchTenantCenter(tenantId, actorRoleKey);
}

/** Keep existing identities and never remove rows before the requested writes succeed. */
async function saveWebRows(
  tenantId: string,
  table: string,
  rows: Record<string, unknown>[],
  actorRoleKey?: RoleKey | null,
  options?: TenantRowsSaveOptions,
): Promise<ServiceResult<void>> {
  const denied = await webWriteGuard(tenantId, actorRoleKey);
  if (denied) return denied;
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Supabase ist nicht konfiguriert.' };
  const current = await fromUnknownTable(client, table).select('id').eq('tenant_id', tenantId);
  if (current.error) return { ok: false, error: toGermanSupabaseError(current.error) };
  const knownIds = new Set((current.data ?? []).map((row: Record<string, unknown>) => String(row.id)));
  const suppliedIds = rows.filter(row => row.id != null).map(row => String(row.id));
  const removedIds = [...new Set(options?.removedIds ?? [])];
  if (new Set(suppliedIds).size !== suppliedIds.length || suppliedIds.some(id => !knownIds.has(id)) ||
      removedIds.some(id => !knownIds.has(id) || suppliedIds.includes(id))) {
    return { ok: false, error: 'Die Liste wurde zwischenzeitlich geändert oder enthält fremde Datensätze. Bitte neu laden.' };
  }
  const newRows = rows.filter(row => row.id == null).map(row => ({ ...row, tenant_id: tenantId }));
  const existingRows = rows.filter(row => row.id != null).map(row => ({ ...row, tenant_id: tenantId }));
  let wrote = false;
  const failure = (message: string): { ok: false; error: string } => wrote ? incompleteSave(message) : { ok: false, error: message };

  for (const batch of [newRows, existingRows]) {
    if (!batch.length) continue;
    const blocked = await webWriteGuard(tenantId, actorRoleKey);
    if (blocked) return failure(blocked.error);
    const query = batch === newRows
      ? fromUnknownTable(client, table).insert(batch)
      : fromUnknownTable(client, table).upsert(batch, { onConflict: 'id' });
    const result = await query.select('id');
    if (result.error) return failure(toGermanSupabaseError(result.error));
    wrote = true;
    if (!result.data || result.data.length !== batch.length) return failure('Nicht alle Datensätze wurden bestätigt.');
  }

  if (removedIds.length) {
    const blocked = await webWriteGuard(tenantId, actorRoleKey);
    if (blocked) return failure(blocked.error);
    const result = await fromUnknownTable(client, table).delete().eq('tenant_id', tenantId).in('id', removedIds).select('id');
    if (result.error) return failure(toGermanSupabaseError(result.error));
    if (!result.data || result.data.length !== removedIds.length) return incompleteSave('Nicht alle gewählten Datensätze konnten entfernt werden.');
  }
  return { ok: true, data: undefined };
}

async function replaceMultiRow(
  tenantId: string,
  table: string,
  rows: Record<string, unknown>[],
  actorRoleKey?: RoleKey | null,
  options?: TenantRowsSaveOptions,
): Promise<ServiceResult<TenantCenterSnapshot>> {
  if (Platform.OS === 'web') {
    const saved = await saveWebRows(tenantId, table, rows, actorRoleKey, options);
    return saved.ok ? reloadAfterWebSave(tenantId, actorRoleKey) : saved;
  }
  const denied = enforcePermission<TenantCenterSnapshot>(actorRoleKey, TENANT_SETTINGS_PERMISSION);
  if (denied) return denied;

  if (!isLiveServiceMode()) {
    return fetchTenantCenter(tenantId, actorRoleKey);
  }

  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Supabase ist nicht konfiguriert.' };

  await fromUnknownTable(client, table).delete().eq('tenant_id', tenantId);
  if (rows.length > 0) {
    const { error } = await fromUnknownTable(client, table).insert(
      rows.map((row) => ({ tenant_id: tenantId, ...row })),
    );
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
  }
  return fetchTenantCenter(tenantId, actorRoleKey);
}

export function patchDemoTenantBrandingLogo(
  tenantId: string,
  logoUrl: string,
): TenantBrandingProfile {
  const snap = ensureDemoSnapshot(tenantId);
  snap.branding = { ...snap.branding, logoUrl };
  snap.updatedAt = new Date().toISOString();
  snap.sections = buildTenantCenterSections(snap);
  DEMO_STORE.set(tenantId, snap);
  return snap.branding;
}

export function resetTenantCenterStore(): void {
  DEMO_STORE.clear();
  demoRowSequence = 0;
}

export function seedTenantCenterForTest(tenantId: string): TenantCenterSnapshot {
  const snapshot = buildDemoSnapshot(tenantId);
  DEMO_STORE.set(tenantId, snapshot);
  return snapshot;
}
