import type { RoleKey, ServiceResult } from '@/types';
import type {
  TenantAuditLogEntry,
  TenantBankAccount,
  TenantBrandingProfile,
  TenantCenterSnapshot,
  TenantCompanyProfile,
  TenantContactCommunication,
  TenantCustomFieldDefinition,
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
      fetchTenantCustomFieldDefinitions(tenantId, 'business_admin'),
      fromUnknownTable(client, 'audit_logs').select('id, action, title, description, table_name, created_at').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(50),
    ]);

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
  const denied = enforcePermission<TenantCenterSnapshot>(actorRoleKey, TENANT_SETTINGS_PERMISSION);
  if (denied) return denied;
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
  const denied = enforcePermission<TenantCenterSnapshot>(actorRoleKey, TENANT_SETTINGS_PERMISSION);
  if (denied) return denied;
  if (!profile.name.trim()) return { ok: false, error: 'Firmenname ist erforderlich.' };
  const emailError = validateEmail(profile.email);
  if (emailError) return { ok: false, error: emailError };

  if (!isLiveServiceMode()) {
    const snap = ensureDemoSnapshot(tenantId);
    snap.company = profile;
    snap.updatedAt = new Date().toISOString();
    snap.sections = buildTenantCenterSections(snap);
    DEMO_STORE.set(tenantId, snap);
    return { ok: true, data: snap };
  }

  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Supabase ist nicht konfiguriert.' };

  const { error } = await client
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

  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return fetchTenantCenter(tenantId, actorRoleKey);
}

export async function saveTenantLegalProfile(
  tenantId: string,
  profile: TenantLegalProfile,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantCenterSnapshot>> {
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
  const vatError = validateVatId(profile.vatId);
  if (vatError) return { ok: false, error: vatError };

  if (isLiveServiceMode()) {
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: 'Supabase ist nicht konfiguriert.' };
    await client.from('tenants').update({
      tax_number: profile.taxNumber.trim() || null,
      vat_id: profile.vatId.trim() ? normalizeVatId(profile.vatId) : null,
      updated_at: new Date().toISOString(),
    }).eq('id', tenantId);
  }

  return upsertProfileTable(tenantId, 'tenant_tax_profiles', {
    tax_office: profile.taxOffice.trim() || null,
    kleinunternehmer: profile.kleinunternehmer,
    tax_scheme: profile.taxScheme,
    reverse_charge: profile.reverseCharge,
    tax_notes: profile.taxNotes.trim() || null,
    updated_at: new Date().toISOString(),
  }, actorRoleKey);
}

export async function saveTenantRegisterProfile(
  tenantId: string,
  profile: TenantRegisterProfile,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantCenterSnapshot>> {
  if (isLiveServiceMode()) {
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: 'Supabase ist nicht konfiguriert.' };
    await client.from('tenants').update({
      register_court: profile.registerCourt.trim() || null,
      register_number: profile.registerNumber.trim() || null,
      ik_number: profile.ikNumber.trim() || null,
      supervisory_authority: profile.supervisoryAuthority.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', tenantId);
  }

  return upsertProfileTable(tenantId, 'tenant_register_profiles', {
    register_type: profile.registerType.trim() || null,
    register_date: profile.registerDate.trim() || null,
    share_capital: profile.shareCapital.trim() || null,
    register_notes: profile.registerNotes.trim() || null,
    updated_at: new Date().toISOString(),
  }, actorRoleKey);
}

export async function saveTenantContactProfile(
  tenantId: string,
  contact: TenantContactCommunication,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantCenterSnapshot>> {
  const emailError = validateEmail(contact.billingEmail) ?? validateEmail(contact.supportEmail);
  if (emailError) return { ok: false, error: emailError };

  if (!isLiveServiceMode()) {
    const snap = ensureDemoSnapshot(tenantId);
    snap.contact = contact;
    snap.sections = buildTenantCenterSections(snap);
    return { ok: true, data: snap };
  }

  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Supabase ist nicht konfiguriert.' };

  await client.from('tenants').update({
    billing_email: contact.billingEmail.trim() || null,
    email: contact.supportEmail.trim() || null,
    phone: contact.supportPhone.trim() || null,
    updated_at: new Date().toISOString(),
  }).eq('id', tenantId);

  return fetchTenantCenter(tenantId, actorRoleKey);
}

export async function saveTenantRepresentatives(
  tenantId: string,
  representatives: TenantRepresentative[],
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantCenterSnapshot>> {
  for (const rep of representatives) {
    const err = validateEmail(rep.email);
    if (err) return { ok: false, error: err };
  }
  return replaceMultiRow(tenantId, 'tenant_representatives', representatives.map((r, index) => ({
    salutation: r.salutation.trim() || null,
    first_name: r.firstName.trim(),
    last_name: r.lastName.trim(),
    position: r.position.trim() || null,
    email: r.email.trim() || null,
    phone: r.phone.trim() || null,
    is_primary: r.isPrimary,
    sort_order: index,
    updated_at: new Date().toISOString(),
  })), actorRoleKey);
}

export async function saveTenantBankAccounts(
  tenantId: string,
  accounts: TenantBankAccount[],
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantCenterSnapshot>> {
  for (const account of accounts) {
    const err = validateIban(account.iban);
    if (err) return { ok: false, error: err };
  }
  return replaceMultiRow(tenantId, 'tenant_bank_accounts', accounts.map((a, index) => ({
    label: a.label.trim() || null,
    account_holder: a.accountHolder.trim() || null,
    bank_name: a.bankName.trim() || null,
    iban: a.iban.trim() ? normalizeIban(a.iban) : null,
    bic: a.bic.trim() || null,
    is_primary: a.isPrimary,
    sort_order: index,
    updated_at: new Date().toISOString(),
  })), actorRoleKey);
}

export async function saveTenantPaymentTerms(
  tenantId: string,
  payment: TenantPaymentTerms,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantCenterSnapshot>> {
  const denied = enforcePermission<TenantCenterSnapshot>(actorRoleKey, TENANT_SETTINGS_PERMISSION);
  if (denied) return denied;

  if (!isLiveServiceMode()) {
    const snap = ensureDemoSnapshot(tenantId);
    snap.payment = payment;
    snap.sections = buildTenantCenterSections(snap);
    return { ok: true, data: snap };
  }

  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Supabase ist nicht konfiguriert.' };

  const { error } = await client.from('tenant_billing_settings').upsert({
    tenant_id: tenantId,
    payment_terms_days: Number.parseInt(payment.paymentTermsDays, 10) || 14,
    dunning_after_days: Number.parseInt(payment.dunningAfterDays, 10) || 14,
    dunning_fee: payment.dunningFee.trim() ? Number.parseFloat(payment.dunningFee.replace(',', '.')) : null,
    invoice_prefix: payment.invoicePrefix.trim() || null,
    invoice_footer_text: payment.invoiceFooterText.trim() || null,
    invoice_notes: payment.invoiceNotes.trim() || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'tenant_id' });

  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return fetchTenantCenter(tenantId, actorRoleKey);
}

export async function saveTenantModuleSettings(
  tenantId: string,
  modules: TenantModuleSettings,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantCenterSnapshot>> {
  const denied = canManageTenantModuleSettings(actorRoleKey);
  if (denied) return denied;

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

  if (!result.ok) return result;
  setTenantModuleSettingsCache(tenantId, modules);
  syncModuleAccessFromTenantSettings(tenantId, modules);
  return fetchTenantCenterSnapshot(tenantId, actorRoleKey);
}

export async function ensureTenantCatalogSeeded(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantCenterSnapshot>> {
  if (isLiveServiceMode()) {
    await seedTenantServiceCatalogIfEmpty(tenantId);
  }
  return fetchTenantCenter(tenantId, actorRoleKey);
}

async function upsertProfileTable(
  tenantId: string,
  table: string,
  payload: Record<string, unknown>,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantCenterSnapshot>> {
  const denied = enforcePermission<TenantCenterSnapshot>(actorRoleKey, TENANT_SETTINGS_PERMISSION);
  if (denied) return denied;

  if (!isLiveServiceMode()) {
    return fetchTenantCenter(tenantId, actorRoleKey);
  }

  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Supabase ist nicht konfiguriert.' };

  const { error } = await fromUnknownTable(client, table).upsert(
    { tenant_id: tenantId, ...payload },
    { onConflict: 'tenant_id' },
  );
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return fetchTenantCenter(tenantId, actorRoleKey);
}

async function replaceMultiRow(
  tenantId: string,
  table: string,
  rows: Record<string, unknown>[],
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantCenterSnapshot>> {
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
}

export function seedTenantCenterForTest(tenantId: string): TenantCenterSnapshot {
  const snapshot = buildDemoSnapshot(tenantId);
  DEMO_STORE.set(tenantId, snapshot);
  return snapshot;
}
