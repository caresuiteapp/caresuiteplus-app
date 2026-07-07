/**
 * Tenant branding for Leistungsnachweis PDF/HTML (logo + footer).
 */
import { fetchTenantBrandingLogoUrl } from '@/lib/tenant/tenantBrandingService';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

export const VISIT_PROOF_FOOTER_CREDIT = 'Erstellt mit CareSuite+ Software Technologie';
export const VISIT_PROOF_EMPLOYEE_UNKNOWN = 'Nicht dokumentiert';
export const VISIT_PROOF_TENANT_NAME_FALLBACK = 'CareSuite+ Mandant';

export type VisitProofBranding = {
  logoUrl: string | null;
  tenantName: string;
  legalName: string | null;
  addressLine: string | null;
  ikNumber: string | null;
  taxId: string | null;
};

export type VisitProofBrandingInput = {
  logoUrl?: string | null;
  tenantName?: string | null;
  legalName?: string | null;
  addressLine?: string | null;
  ikNumber?: string | null;
  taxId?: string | null;
};

function formatAddressLine(
  street?: string | null,
  postalCode?: string | null,
  city?: string | null,
): string | null {
  const parts = [street?.trim(), [postalCode?.trim(), city?.trim()].filter(Boolean).join(' ')].filter(
    Boolean,
  );
  const line = parts.join(', ');
  return line || null;
}

function readNestedLogoUrl(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const url = String(row.logo_url ?? row.logoUrl ?? '').trim();
  return url || null;
}

function resolveLogoUrl(
  input: VisitProofBrandingInput,
  snapshot: Record<string, unknown>,
): string | null {
  const candidates = [
    input.logoUrl,
    readNestedLogoUrl(snapshot.tenant_branding),
    readNestedLogoUrl(snapshot.tenantBranding),
    readNestedLogoUrl(snapshot.tenant_document_settings),
    readNestedLogoUrl(snapshot.tenantDocumentSettings),
    snapshot.tenantLogoUrl,
    snapshot.logoUrl,
    snapshot.logo_url,
    snapshot.companyLogoUrl,
    snapshot.businessLogoUrl,
    snapshot.organizationLogoUrl,
    snapshot.providerLogoUrl,
  ];
  for (const value of candidates) {
    const url = String(value ?? '').trim();
    if (url) return url;
  }
  return null;
}

function readNestedPersonName(value: unknown): string | null {
  if (typeof value === 'string') {
    const text = value.trim();
    return text && text !== '—' ? text : null;
  }
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const displayName = String(row.display_name ?? row.displayName ?? '').trim();
  if (displayName && displayName !== '—') return displayName;
  const fullName = String(row.full_name ?? row.fullName ?? row.name ?? '').trim();
  if (fullName && fullName !== '—') return fullName;
  const first = String(row.first_name ?? row.firstName ?? '').trim();
  const last = String(row.last_name ?? row.lastName ?? '').trim();
  const combined = [first, last].filter(Boolean).join(' ').trim();
  return combined || null;
}

/** Resolve performing employee name for Stammdaten block (Assist, Dokumentenmodul, Preview). */
export function resolveVisitProofEmployeeName(
  snapshot: Record<string, unknown>,
  input: { employeeName?: string | null } = {},
): string {
  const candidates: unknown[] = [
    input.employeeName,
    snapshot.employeeName,
    snapshot.caregiverName,
    snapshot.staffName,
    snapshot.performedByName,
    snapshot.assigned_employee,
    snapshot.assignedEmployee,
    snapshot.staff,
    snapshot.employee,
    snapshot.performedBy,
  ];
  for (const candidate of candidates) {
    const name =
      typeof candidate === 'string' ? readNestedPersonName(candidate) : readNestedPersonName(candidate);
    if (name) return name;
  }
  return VISIT_PROOF_EMPLOYEE_UNKNOWN;
}

export function resolveVisitProofBranding(
  snapshot: Record<string, unknown>,
  input: VisitProofBrandingInput = {},
): VisitProofBranding {
  const tenantName =
    String(
      input.tenantName ??
        snapshot.tenantName ??
        snapshot.providerName ??
        snapshot.companyName ??
        snapshot.businessName ??
        '',
    ).trim() || VISIT_PROOF_TENANT_NAME_FALLBACK;

  const legalName =
    String(input.legalName ?? snapshot.legalName ?? snapshot.tenantLegalName ?? '').trim() || null;

  const addressLine =
    input.addressLine ??
    (typeof snapshot.tenantAddress === 'string' ? snapshot.tenantAddress : null) ??
    formatAddressLine(
      snapshot.tenantStreet as string | null,
      snapshot.tenantPostalCode as string | null,
      snapshot.tenantCity as string | null,
    );

  return {
    logoUrl: resolveLogoUrl(input, snapshot),
    tenantName,
    legalName,
    addressLine: addressLine?.trim() || null,
    ikNumber: String(input.ikNumber ?? snapshot.ikNumber ?? snapshot.ik_number ?? '').trim() || null,
    taxId: String(input.taxId ?? snapshot.taxId ?? snapshot.tax_id ?? '').trim() || null,
  };
}

/** Load tenant branding from DB for proof enrichment (non-destructive read). */
export async function loadVisitProofBrandingForTenant(
  tenantId: string,
): Promise<VisitProofBrandingInput> {
  const logoFromBranding = await fetchTenantBrandingLogoUrl(tenantId);

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { logoUrl: logoFromBranding || null };
  }

  const { data: tenant } = await fromUnknownTable(supabase, 'tenants')
    .select('name, legal_name, street, postal_code, city, tax_id, ik_number')
    .eq('id', tenantId)
    .maybeSingle();

  const row = tenant as Record<string, unknown> | null;

  const { data: docSettings } = await fromUnknownTable(supabase, 'tenant_document_settings')
    .select('logo_url')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const settings = docSettings as Record<string, unknown> | null;

  const logoUrl =
    logoFromBranding ||
    (settings?.logo_url ? String(settings.logo_url).trim() : '') ||
    null;

  return {
    logoUrl,
    tenantName: row?.name ? String(row.name) : null,
    legalName: row?.legal_name ? String(row.legal_name) : row?.name ? String(row.name) : null,
    addressLine: formatAddressLine(
      row?.street as string | null,
      row?.postal_code as string | null,
      row?.city as string | null,
    ),
    ikNumber: row?.ik_number ? String(row.ik_number) : null,
    taxId: row?.tax_id ? String(row.tax_id) : null,
  };
}
